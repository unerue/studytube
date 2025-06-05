'use client';

import { useState, useEffect } from 'react';
import { Button, Typography, Badge, Dropdown, Tabs, Avatar, Space, Tooltip, Divider } from 'antd';
import type { MenuProps } from 'antd';
import { 
  SettingOutlined, 
  LogoutOutlined, 
  UserOutlined,
  ExpandOutlined,
  CompressOutlined,
  VideoCameraOutlined,
  AudioOutlined,
  MessageOutlined,
  SoundOutlined,
  ShareAltOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  GlobalOutlined
} from '@ant-design/icons';

// 서브 컴포넌트들을 import하되, 에러 방지를 위해 try-catch로 감싸거나 조건부 렌더링 사용
import { VideoArea } from './VideoArea';
import { ParticipantList } from './ParticipantList';
import { ChatPanel } from './ChatPanel';
import { SubtitlePanel } from './SubtitlePanel';

const { Title, Text } = Typography;

interface LiveLectureRoomProps {
  lectureId: string;
  lectureTitle: string;
  userRole: 'instructor' | 'student';
  participantCount: number;
}

interface Participant {
  id: string;
  name: string;
  role: 'instructor' | 'student';
  isAudioOn: boolean;
  isVideoOn: boolean;
  isRaiseHand: boolean;
}

// 간단한 LanguageSelector 컴포넌트 (임시)
const SimpleLanguageSelector = ({ size = 'small' }: { size?: string }) => {
  return (
    <Button type="text" icon={<GlobalOutlined />} className="text-gray-300 hover:text-white">
      KO
    </Button>
  );
};

export default function LiveLectureRoom({ 
  lectureId, 
  lectureTitle, 
  userRole, 
  participantCount 
}: LiveLectureRoomProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [activePanel, setActivePanel] = useState<'chat' | 'subtitle'>('chat');
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [realTimeParticipantCount, setRealTimeParticipantCount] = useState(participantCount);
  
  // WebSocket 연결 및 상태 관리
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    console.log(`[${userRole}] WebSocket 연결 시도...`, { lectureId, token: token ? 'exists' : 'missing' });
    
    if (!token) {
      console.error(`[${userRole}] 토큰이 없습니다! 로그인이 필요합니다.`);
      console.log(`[${userRole}] 로컬스토리지 내용:`, Object.keys(localStorage));
      setIsConnected(false);
      return;
    }
    
    // 토큰 내용 디버깅
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          console.log(`[${userRole}] 토큰 페이로드:`, payload);
        }
      } catch (err) {
        console.error(`[${userRole}] 토큰 파싱 실패:`, err);
      }
      
      const wsUrl = `ws://localhost:8000/ws/chat/${lectureId}?token=${token}`;
      console.log(`[${userRole}] WebSocket URL:`, wsUrl);
      const ws = new WebSocket(wsUrl);
      
      // 연결 타임아웃 설정 (10초)
      const connectionTimeout = setTimeout(() => {
        console.error(`[${userRole}] WebSocket 연결 타임아웃`);
        ws.close();
        setIsConnected(false);
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(`[${userRole}] Main WebSocket connected successfully`);
        setIsConnected(true);
        setWsConnection(ws);
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(`[${userRole}] WebSocket message received:`, data);
        
        if (data.type === 'participants_update') {
          console.log(`[${userRole}] Participants updated:`, data.participants);
          setParticipants(data.participants || []);
          setRealTimeParticipantCount(data.participants?.length || 0);
        } else if (data.type === 'chat_message' || data.type === 'user_joined' || data.type === 'user_left') {
          console.log(`[${userRole}] Chat message:`, data);
          setChatMessages(prev => [...prev, {
            id: `${Date.now()}-${Math.random()}`,
            ...data
          }]);
        } else if (data.type === 'screen_share') {
          console.log(`[${userRole}] Screen share update:`, data);
          console.log(`[${userRole}] Setting screen share state to:`, data.is_sharing);
          setIsScreenSharing(data.is_sharing);
          // 추가: 화면공유 상태가 변경되었음을 알리는 메시지도 채팅에 표시
          const screenShareMessage = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'system',
            username: 'System',
            message: data.is_sharing 
              ? `${data.username}님이 화면 공유를 시작했습니다.`
              : `${data.username}님이 화면 공유를 종료했습니다.`,
            timestamp: data.timestamp
          };
          setChatMessages(prev => [...prev, screenShareMessage]);
        }
      };
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log(`[${userRole}] Main WebSocket disconnected:`, event.code, event.reason);
        
        // 구체적인 에러 코드 분석
        switch(event.code) {
          case 1008:
            console.error(`[${userRole}] 토큰 인증 실패 (1008)`);
            break;
          case 1011:
            console.error(`[${userRole}] 서버 내부 에러 (1011)`);
            break;
          case 1006:
            console.error(`[${userRole}] 비정상 연결 종료 (1006)`);
            break;
          default:
            console.log(`[${userRole}] 정상 연결 종료 (${event.code})`);
        }
        
        setIsConnected(false);
        setWsConnection(null);
        // 3초 후 재연결 시도
        setTimeout(() => {
          // 재연결 로직은 여기에 추가 가능
        }, 3000);
      };
      
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error(`[${userRole}] Main WebSocket error:`, error);
        setIsConnected(false);
      };
      
      return () => {
        clearTimeout(connectionTimeout);
        ws.close();
      };
    }
  }, [lectureId]);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleLeaveLecture = () => {
    if (confirm('강의실을 나가시겠습니까?')) {
      window.location.href = '/lectures/new';
    }
  };

  const handleScreenShare = () => {
    console.log(`[${userRole}] 화면공유 버튼 클릭, 현재 상태:`, isScreenSharing);
    console.log(`[${userRole}] WebSocket 연결 상태:`, wsConnection?.readyState);
    
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
      const newSharingState = !isScreenSharing;
      const screenShareData = {
        type: 'screen_share',
        is_sharing: newSharingState
      };
      console.log(`[${userRole}] 화면공유 메시지 전송:`, screenShareData);
      wsConnection.send(JSON.stringify(screenShareData));
      
      // 로컬 상태 업데이트 제거: 서버 응답을 기다림
    } else {
      console.error(`[${userRole}] WebSocket 연결이 없거나 닫힘`);
    }
  };

  const settingsMenuItems: MenuProps['items'] = [
    {
      key: 'audio',
      icon: <AudioOutlined />,
      label: '오디오 설정',
    },
    {
      key: 'video',
      icon: <VideoCameraOutlined />,
      label: '비디오 설정',
    },
    {
      key: 'language',
      icon: <PlayCircleOutlined />,
      label: '언어 설정',
    },
  ];

  const tabItems = [
    {
      key: 'chat',
      label: (
        <Space>
          <MessageOutlined />
          채팅
        </Space>
      ),
      children: (
        <ChatPanel 
          lectureId={lectureId}
          userRole={userRole}
          messages={chatMessages}
          wsConnection={wsConnection}
          isConnected={isConnected}
        />
      ),
    },
    {
      key: 'subtitle',
      label: (
        <Space>
          <PlayCircleOutlined />
          자막
        </Space>
      ),
      children: (
        <SubtitlePanel 
          language="ko"
          onLanguageChange={(lang) => {
            console.log('Change subtitle language to:', lang);
          }}
        />
      ),
    },
  ];

  return (
    <div className="h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col overflow-hidden">
      {/* 상단 헤더 */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <Title level={4} className="text-white m-0 font-semibold">
                {lectureTitle}
              </Title>
            </div>
            
            <div className="flex items-center space-x-3">
              <Badge 
                count={realTimeParticipantCount} 
                showZero 
                style={{ backgroundColor: '#10b981' }}
              />
              <Text className="text-gray-300 text-sm">
                <UserOutlined className="mr-1" />
                참여자
              </Text>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* 언어 선택 */}
            <SimpleLanguageSelector size="small" />
            
            <Tooltip title="전체화면">
              <Button
                type="text"
                icon={isFullscreen ? <CompressOutlined /> : <FullscreenOutlined />}
                onClick={handleToggleFullscreen}
                className="text-gray-300 hover:text-white hover:bg-white/10"
              />
            </Tooltip>
            
            <Dropdown menu={{ items: settingsMenuItems }} placement="bottomRight">
              <Button
                type="text"
                icon={<SettingOutlined />}
                className="text-gray-300 hover:text-white hover:bg-white/10"
              />
            </Dropdown>
            
            <Tooltip title="강의실 나가기">
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLeaveLecture}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                danger
              />
            </Tooltip>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 참가자 목록 사이드바 */}
        {showParticipants && (
          <div className="w-80 bg-black/20 backdrop-blur-sm border-r border-white/10 flex flex-col">
            <div className="p-4 border-b border-white/10">
              <Text className="text-white font-semibold text-lg">참여자 목록</Text>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ParticipantList 
                lectureId={lectureId}
                userRole={userRole}
                participants={participants}
                isConnected={isConnected}
              />
            </div>
          </div>
        )}

        {/* 중앙 영역 */}
        <div className={`flex-1 flex flex-col ${showParticipants ? 'mr-80' : ''}`}>
          {/* 메인 비디오/화면공유 영역 */}
          <div className="flex-1 relative">
            <VideoArea 
              isInstructor={userRole === 'instructor'}
              isScreenSharing={isScreenSharing}
              onStartScreenShare={handleScreenShare}
              onStopScreenShare={handleScreenShare}
            />
            
            {/* 비디오 오버레이 정보 */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3">
              <Space direction="vertical" size="small">
                <Text className="text-white text-sm">
                  {userRole === 'instructor' ? '강사' : '학생'} 모드
                </Text>
                {isScreenSharing && (
                  <div className="flex items-center space-x-2 text-green-400">
                    <ShareAltOutlined />
                    <Text className="text-green-400 text-xs">화면 공유 중</Text>
                  </div>
                )}
              </Space>
            </div>
          </div>

          {/* 하단 채팅/자막 패널 */}
          {showBottomPanel && (
            <div className="h-96 bg-white/5 backdrop-blur-sm border-t border-white/10">
              <Tabs 
                activeKey={activePanel}
                onChange={(key) => setActivePanel(key as 'chat' | 'subtitle')}
                items={tabItems}
                className="h-full"
                tabBarStyle={{ 
                  color: 'white',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  margin: 0,
                  padding: '0 16px'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 하단 컨트롤 바 */}
      <div className="bg-black/30 backdrop-blur-md border-t border-white/10 p-4">
        <div className="flex items-center justify-center space-x-4">
          <Tooltip title={isAudioOn ? '마이크 끄기' : '마이크 켜기'}>
            <Button
              type={isAudioOn ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={<SoundOutlined />}
              onClick={() => setIsAudioOn(!isAudioOn)}
              className={isAudioOn ? 'bg-green-500 border-green-500' : 'bg-red-500 border-red-500 text-white'}
            />
          </Tooltip>
          
          <Tooltip title={isVideoOn ? '비디오 끄기' : '비디오 켜기'}>
            <Button
              type={isVideoOn ? 'primary' : 'default'}
              shape="circle"
              size="large"
              icon={<EyeOutlined />}
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={isVideoOn ? 'bg-green-500 border-green-500' : 'bg-red-500 border-red-500 text-white'}
            />
          </Tooltip>

          {userRole === 'instructor' && (
            <Tooltip title={isScreenSharing ? '화면 공유 중지' : '화면 공유'}>
              <Button
                type={isScreenSharing ? 'primary' : 'default'}
                shape="circle"
                size="large"
                icon={<ShareAltOutlined />}
                onClick={handleScreenShare}
                className={isScreenSharing ? 'bg-blue-500 border-blue-500' : ''}
              />
            </Tooltip>
          )}

          <Divider type="vertical" className="border-white/20 h-8" />

          <Tooltip title={showParticipants ? '참여자 목록 숨기기' : '참여자 목록 보기'}>
            <Button
              type={showParticipants ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setShowParticipants(!showParticipants)}
              className="text-white"
            >
              참여자
            </Button>
          </Tooltip>

          <Tooltip title={showBottomPanel ? '패널 숨기기' : '패널 보기'}>
            <Button
              type={showBottomPanel ? 'primary' : 'default'}
              icon={<MessageOutlined />}
              onClick={() => setShowBottomPanel(!showBottomPanel)}
              className="text-white"
            >
              채팅/자막
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
} 
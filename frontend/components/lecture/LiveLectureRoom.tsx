'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, Tabs, Button, message } from 'antd';
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  AudioOutlined, 
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  ShareAltOutlined,
  MessageOutlined,
  TeamOutlined,
  CloseOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  EyeOutlined,
  UserOutlined,
  FieldTimeOutlined,
  WifiOutlined,
  SignalFilled
} from '@ant-design/icons';
import VideoArea from './VideoArea';
import { ChatPanel } from './ChatPanel';
import { SubtitlePanel } from './SubtitlePanel';
import { useWebRTC } from '@/hooks/useWebRTC';

interface LiveLectureRoomProps {
  lectureId: string;
  lectureTitle: string;
  userRole: 'instructor' | 'student';
  participantCount: number;
}

export default function LiveLectureRoom({
  lectureId,
  lectureTitle,
  userRole,
  participantCount
}: LiveLectureRoomProps) {
  // UI 상태
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'chat' | 'subtitle'>('chat');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lectureDuration, setLectureDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor'>('good');

  // 상태 관리
  const [participants, setParticipants] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [subtitles, setSubtitles] = useState<any[]>([]);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed' | 'disconnected'>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  // WebSocket 상태
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebRTC 훅
  const {
    localStream,
    remoteStreams,
    isScreenSharing,
    startScreenShare,
    stopScreenShare
  } = useWebRTC({
    wsConnection: wsConnection, // WebSocket 연결 전달
    isInstructor: userRole === 'instructor',
    lectureId
  });

  // WebSocket 연결 설정
  useEffect(() => {
    console.log(`[${userRole}] 컴포넌트 마운트됨, lectureId: ${lectureId}`);
    
    const connectWebSocket = () => {
      // 토큰 가져오기 및 디버깅
      const token = localStorage.getItem('access_token');
      console.log(`[${userRole}] 토큰 검사:`, {
        존재여부: token ? '존재함' : '없음',
        길이: token ? token.length : 0,
        첫10글자: token ? token.substring(0, 10) + '...' : 'N/A'
      });
      
      // 모든 localStorage 항목 확인
      const allStorageItems = Object.keys(localStorage).map(key => ({
        key,
        value: localStorage.getItem(key)?.substring(0, 20) + '...'
      }));
      console.log(`[${userRole}] LocalStorage 전체 항목:`, allStorageItems);
      
      if (!token) {
        console.error(`[${userRole}] 접근 토큰이 없습니다!`);
        setConnectionStatus('failed');
        setIsConnected(false);
        
        // 로그인 페이지로 리다이렉트 또는 사용자에게 알림
        message.error('로그인이 필요합니다. 다시 로그인해주세요.');
        
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          window.location.href = '/login';
        }, 3000);
        return;
      }
      
      // WebSocket URL 구성
      const wsUrl = `ws://localhost:8000/ws/chat/${lectureId}?token=${token}`;
      console.log(`[${userRole}] WebSocket URL:`, wsUrl);
      
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        // 연결 타임아웃 설정 (10초)
        const connectionTimeout = setTimeout(() => {
          console.error(`[${userRole}] WebSocket 연결 타임아웃`);
          ws.close();
          setConnectionStatus('failed');
          setIsConnected(false);
        }, 10000);
        
        ws.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log(`[${userRole}] WebSocket 연결 성공`);
          setConnectionStatus('connected');
          setIsConnected(true);
          setWsConnection(ws);
          
          // 연결 성공 메시지
          message.success('강의실에 연결되었습니다');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log(`[${userRole}] WebSocket 메시지 수신:`, data);
            
            switch (data.type) {
              case 'participants_update':
                console.log(`[${userRole}] 참여자 업데이트:`, data.participants);
                setParticipants(data.participants || []);
                break;
                
              case 'chat_message':
              case 'user_joined':
              case 'user_left':
                console.log(`[${userRole}] 채팅 메시지:`, data);
                const newChatMessage = {
                  id: `${Date.now()}-${Math.random()}`,
                  type: data.type === 'chat_message' ? 'chat' : 'system',
                  content: data.message || data.content,
                  sender: data.username || data.sender,
                  timestamp: new Date(data.timestamp || Date.now())
                };
                setChatMessages(prev => [...prev, newChatMessage]);
                break;
                
              case 'screen_share':
                console.log(`[${userRole}] 화면 공유 상태:`, data.is_sharing);
                // 화면 공유 상태는 useWebRTC에서 처리됨
                break;
                
              case 'subtitle':
                console.log(`[${userRole}] 자막 수신:`, data);
                const newSubtitle = {
                  id: `${Date.now()}-${Math.random()}`,
                  text: data.text,
                  translatedText: data.translatedText,
                  timestamp: new Date(data.timestamp || Date.now()),
                  confidence: data.confidence,
                  speaker: data.speaker
                };
                setSubtitles(prev => [...prev, newSubtitle]);
                break;
                
              default:
                console.log(`[${userRole}] 알 수 없는 메시지 타입:`, data.type);
            }
          } catch (error) {
            console.error(`[${userRole}] 메시지 파싱 오류:`, error);
          }
        };
        
        ws.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.log(`[${userRole}] WebSocket 연결 종료:`, event.code, event.reason);
          
          setConnectionStatus('disconnected');
          setIsConnected(false);
          setWsConnection(null);
          wsRef.current = null;
          
          // 비정상 종료인 경우 재연결 시도
          if (event.code !== 1000 && event.code !== 1001) {
            console.log(`[${userRole}] 3초 후 재연결 시도...`);
            setTimeout(() => {
              if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
                connectWebSocket();
              }
            }, 3000);
          }
        };
        
        ws.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error(`[${userRole}] WebSocket 오류:`, error);
          setConnectionStatus('failed');
          setIsConnected(false);
          message.error('서버 연결에 실패했습니다');
        };
        
      } catch (error) {
        console.error(`[${userRole}] WebSocket 생성 오류:`, error);
        setConnectionStatus('failed');
        setIsConnected(false);
      }
    };

    setConnectionStatus('connecting');
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [lectureId, userRole]);

  // 강의 시간 계산
  useEffect(() => {
    const timer = setInterval(() => {
      setLectureDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 화면 공유 핸들러
  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  // 오디오 토글
  const toggleAudio = () => {
    setIsAudioEnabled(prev => !prev);
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !isAudioEnabled;
      });
    }
  };

  // 비디오 토글
  const toggleVideo = () => {
    setIsVideoEnabled(prev => !prev);
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !isVideoEnabled;
      });
    }
  };

  // 통화 종료
  const endCall = () => {
    if (confirm('강의를 종료하시겠습니까?')) {
      stopScreenShare();
      // 추가적인 정리 작업
    }
  };

  // 전체화면 토글
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // 시간 포맷팅
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 연결 품질 아이콘
  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <SignalFilled className="text-green-400" />;
      case 'good': return <WifiOutlined className="text-blue-400" />;
      case 'fair': return <WifiOutlined className="text-yellow-400" />;
      case 'poor': return <WifiOutlined className="text-red-400" />;
      default: return <WifiOutlined className="text-gray-400" />;
    }
  };

  // 그리드 클래스 결정
  const getGridClass = () => {
    if (showSidebar && showBottomPanel) {
      return 'grid-cols-[280px_1fr_320px] grid-rows-[1fr_260px]';
    } else if (showSidebar) {
      return 'grid-cols-[280px_1fr]';
    } else if (showBottomPanel) {
      return 'grid-cols-[1fr_320px] grid-rows-[1fr_260px]';
    }
    return 'grid-cols-[1fr]';
  };

  // 채팅 전송
  const handleSendMessage = (content: string) => {
    if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
      message.error('서버에 연결되지 않았습니다');
      return;
    }

    const messageData = {
      type: 'chat_message',
      message: content,
      lectureId: lectureId,
      timestamp: new Date().toISOString()
    };

    try {
      wsConnection.send(JSON.stringify(messageData));
      console.log(`[${userRole}] 채팅 메시지 전송:`, messageData);
    } catch (error) {
      console.error(`[${userRole}] 메시지 전송 오류:`, error);
      message.error('메시지 전송에 실패했습니다');
    }
  };

  return (
    <div className="h-screen w-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white grid grid-rows-[auto_1fr_auto] overflow-hidden">
      {/* 헤더 영역 - 강의 정보와 상태 */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <h1 className="text-xl font-bold text-white">{lectureTitle}</h1>
            </div>
            
            {/* 강의 시간과 참여자 정보 */}
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                <FieldTimeOutlined />
                <span>{formatDuration(lectureDuration)}</span>
              </div>
              
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                <UserOutlined />
                <span>{participants.length + 1}명 참여</span>
              </div>
              
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                {getConnectionIcon()}
                <span className="capitalize">{connectionQuality}</span>
              </div>
            </div>
          </div>

          {/* 상단 컨트롤 */}
          <div className="flex items-center gap-2">
            <Button
              icon={<TeamOutlined />}
              onClick={() => setShowSidebar(!showSidebar)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              참여자
            </Button>
            
            <Button
              icon={<MessageOutlined />}
              onClick={() => setShowBottomPanel(!showBottomPanel)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              채팅/자막
            </Button>
            
            <Button
              icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFullscreen}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            />
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className={`grid ${getGridClass()} gap-4 p-4 overflow-hidden`}>
        {/* 참여자 목록 사이드바 */}
        {showSidebar && (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <TeamOutlined />
                참여자 ({participants.length + 1})
              </h3>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setShowSidebar(false)}
                className="text-white/60 hover:text-white"
                size="small"
              />
            </div>
            
            <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
              {/* 현재 사용자 (교수 또는 학생) */}
              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-600/30 to-purple-600/30 rounded-lg border border-white/10">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-semibold">
                  {userRole === 'instructor' ? '교' : '학'}
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {userRole === 'instructor' ? '교수님' : '나'}
                  </div>
                  <div className="text-xs text-gray-300">
                    {userRole === 'instructor' ? '강의자' : '참여자'}
                  </div>
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              </div>

              {/* 다른 참여자들 */}
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center text-sm font-semibold">
                    {participant.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="text-white">{participant.name || '익명'}</div>
                    <div className="text-xs text-gray-300">{participant.role || '참여자'}</div>
                  </div>
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 비디오 영역 */}
        <div className={`${showBottomPanel ? 'row-span-2' : ''} bg-black/20 backdrop-blur-sm rounded-lg border border-white/10 overflow-hidden`}>
          <VideoArea
            localStream={localStream}
            remoteStreams={remoteStreams}
            isScreenSharing={isScreenSharing}
            userRole={userRole}
            connectionStatus={connectionStatus}
          />
        </div>

        {/* 채팅/자막 패널 */}
        {showBottomPanel && (
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 h-[260px] overflow-hidden">
            <Tabs
              activeKey={activeBottomTab}
              onChange={(key) => setActiveBottomTab(key as 'chat' | 'subtitle')}
              className="custom-tabs h-full"
              items={[
                {
                  key: 'chat',
                  label: (
                    <span className="flex items-center gap-2 text-white">
                      <MessageOutlined />
                      채팅 ({chatMessages.filter(m => m.type === 'chat').length})
                    </span>
                  ),
                  children: (
                    <div className="h-[200px]">
                      <ChatPanel
                        lectureId={lectureId}
                        userRole={userRole}
                        messages={chatMessages}
                        wsConnection={wsConnection}
                        isConnected={isConnected}
                        onSendMessage={handleSendMessage}
                      />
                    </div>
                  )
                },
                {
                  key: 'subtitle',
                  label: (
                    <span className="flex items-center gap-2 text-white">
                      <EyeOutlined />
                      자막
                    </span>
                  ),
                  children: (
                    <div className="h-[200px]">
                      <SubtitlePanel 
                        language="ko"
                        onLanguageChange={(lang) => console.log('Language changed:', lang)}
                        subtitles={subtitles}
                        showInFooter={false}
                      />
                    </div>
                  )
                }
              ]}
            />
          </Card>
        )}
      </div>

      {/* 하단 자막 영역 (showBottomPanel이 false일 때만 표시) */}
      {!showBottomPanel && (
        <div className="bg-black/50 backdrop-blur-sm border-t border-white/10 p-4 max-h-32 overflow-y-auto">
          <SubtitlePanel 
            language="ko"
            onLanguageChange={(lang) => console.log('Language changed:', lang)}
            subtitles={subtitles} 
            showInFooter={true} 
          />
        </div>
      )}

      {/* 컨트롤 바 */}
      <div className="bg-white/5 backdrop-blur-xl border-t border-white/10 p-4">
        <div className="grid grid-cols-3 items-center">
          {/* 미디어 컨트롤 */}
          <div className="flex items-center gap-3">
            <Button
              icon={isAudioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
              onClick={toggleAudio}
              className={`${isAudioEnabled ? 'bg-blue-600 border-blue-500' : 'bg-red-600 border-red-500'} text-white hover:opacity-80`}
              size="large"
            />
            
            <Button
              icon={isVideoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
              onClick={toggleVideo}
              className={`${isVideoEnabled ? 'bg-blue-600 border-blue-500' : 'bg-red-600 border-red-500'} text-white hover:opacity-80`}
              size="large"
            />
            
            {userRole === 'instructor' && (
              <Button
                icon={<ShareAltOutlined />}
                onClick={handleScreenShare}
                className={`${isScreenSharing ? 'bg-green-600 border-green-500' : 'bg-gray-600 border-gray-500'} text-white hover:opacity-80`}
                size="large"
              >
                {isScreenSharing ? '공유 중지' : '화면 공유'}
              </Button>
            )}
          </div>

          {/* 중앙 - 연결 상태 */}
          <div className="text-center">
            <div className="text-sm text-gray-300">
              연결 상태: <span className={`font-semibold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                {connectionStatus === 'connecting' && '연결 중...'}
                {connectionStatus === 'connected' && '연결됨'}
                {connectionStatus === 'failed' && '연결 실패'}
                {connectionStatus === 'disconnected' && '연결 끊김'}
              </span>
            </div>
            {connectionStatus === 'failed' && (
              <div className="text-xs text-red-300 mt-1">
                로그인 토큰을 확인해주세요
              </div>
            )}
            {connectionStatus === 'connecting' && (
              <div className="text-xs text-yellow-300 mt-1">
                서버에 연결하는 중...
              </div>
            )}
          </div>

          {/* 종료 버튼 */}
          <div className="flex justify-end">
            <Button
              icon={<StopOutlined />}
              onClick={endCall}
              className="bg-red-600 border-red-500 text-white hover:bg-red-700"
              size="large"
            >
              강의 종료
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button, Typography, Badge, Dropdown, Tabs, Avatar, Space, Tooltip, Input, Card, List, Progress, message } from 'antd';
import type { MenuProps, TabsProps } from 'antd';
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
  UsergroupAddOutlined,
  FileTextOutlined,
  SendOutlined,
  ShareAltOutlined,
  HeartOutlined,
  LikeOutlined,
  DislikeOutlined
} from '@ant-design/icons';
import { useAuth } from '@/lib/context/AuthContext';
import { useWebRTC } from '@/hooks/useWebRTC';
import AudioVisualizer from './AudioVisualizer';
import VoiceTranscription from './VoiceTranscription';

const { Title, Text } = Typography;

interface LiveLectureRoomProps {
  lectureId: string;
  lectureTitle: string;
  userRole: 'instructor' | 'student';
  participantCount: number;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'emoji' | 'system';
}

interface Participant {
  id: string;
  username: string;
  role: 'instructor' | 'student';
  isOnline: boolean;
  joinedAt: Date;
}

export default function LiveLectureRoomSimple({
  lectureId,
  lectureTitle,
  userRole,
  participantCount
}: LiveLectureRoomProps) {
  const { user } = useAuth();
  
  // UI 상태
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [isParticipantsVisible, setIsParticipantsVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  
  // 채팅 상태
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      userId: 'system',
      username: 'System',
      message: '강의실에 입장하셨습니다.',
      timestamp: new Date(),
      type: 'system'
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  
  // 참여자 상태
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: '1',
      username: user?.username || 'Unknown',
      role: userRole,
      isOnline: true,
      joinedAt: new Date()
    }
  ]);

  // WebRTC
  const {
    localStream,
    remoteStreams,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    createOffer
  } = useWebRTC({
    wsConnection: ws,
    isInstructor: userRole === 'instructor',
    lectureId
  });

  // 채팅 WebSocket 연결
  useEffect(() => {
    const connectWebSocket = () => {
      const token = localStorage.getItem('token');
      const wsUrl = token 
        ? `ws://localhost:8000/ws/chat/${lectureId}?token=${encodeURIComponent(token)}`
        : `ws://localhost:8000/ws/chat/${lectureId}`;
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('Chat WebSocket 연결됨');
        setWs(websocket);
      };
      
      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'chat_message') {
          const newMsg: ChatMessage = {
            id: Date.now().toString(),
            userId: data.userId,
            username: data.username,
            message: data.message,
            timestamp: new Date(data.timestamp),
            type: 'text'
          };
          setChatMessages(prev => [...prev, newMsg]);
        }
      };
      
      websocket.onclose = () => {
        console.log('Chat WebSocket 연결 끊어짐');
        setTimeout(connectWebSocket, 3000);
      };
    };
    
    connectWebSocket();
    
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [lectureId]);

  const sendMessage = () => {
    if (newMessage.trim() && ws) {
      const messageData = {
        type: 'chat_message',
        message: newMessage.trim(),
        lectureId: parseInt(lectureId)
      };
      
      ws.send(JSON.stringify(messageData));
      setNewMessage('');
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // 사용자 메뉴
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '프로필',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '설정',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '강의실 나가기',
      danger: true,
    },
  ];

  // 탭 설정
  const tabItems: TabsProps['items'] = [
    {
      key: 'chat',
      label: (
        <span>
          <MessageOutlined />
          채팅 ({chatMessages.length})
        </span>
      ),
      children: (
        <div className="h-96 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-2 p-2 bg-white/5 rounded-lg">
            {chatMessages.map((msg) => (
              <div key={msg.id} className="flex items-start space-x-2">
                <Avatar size="small" icon={<UserOutlined />} />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Text className="text-white font-medium text-sm">{msg.username}</Text>
                    <Text className="text-white/50 text-xs">
                      {msg.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                  <Text className="text-white/80 text-sm">{msg.message}</Text>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onPressEnter={sendMessage}
              placeholder="메시지를 입력하세요..."
              className="flex-1"
            />
            <Button 
              type="primary" 
              icon={<SendOutlined />} 
              onClick={sendMessage}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'participants',
      label: (
        <span>
          <UsergroupAddOutlined />
          참여자 ({participants.length})
        </span>
      ),
      children: (
        <div className="h-96 overflow-y-auto">
          <List
            dataSource={participants}
            renderItem={(participant) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={
                    <div className="flex items-center space-x-2">
                      <Text className="text-white">{participant.username}</Text>
                      <Badge 
                        status={participant.isOnline ? "success" : "default"} 
                        text={
                          <Text className="text-white/60 text-xs">
                            {participant.role === 'instructor' ? '강사' : '학생'}
                          </Text>
                        }
                      />
                    </div>
                  }
                  description={
                    <Text className="text-white/50 text-xs">
                      {participant.joinedAt.toLocaleTimeString()} 입장
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'stt',
      label: (
        <span>
          <SoundOutlined />
          음성인식
        </span>
      ),
      children: (
        <div className="h-96 overflow-y-auto">
          <VoiceTranscription 
            lectureId={parseInt(lectureId)} 
            className="h-full"
          />
        </div>
      ),
    },
  ];

  return (
    <div className={`bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white ${isFullscreen ? 'h-screen w-screen' : 'h-screen'} flex flex-col`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between p-4 border-b border-white/20 bg-black/20 backdrop-blur-md">
        <div className="flex items-center space-x-4">
          <Title level={4} className="!text-white !mb-0">{lectureTitle}</Title>
          <Badge count={participantCount} showZero className="ml-2">
            <Button type="text" icon={<UsergroupAddOutlined />} className="text-white" />
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          {userRole === 'instructor' && (
            <>
              <Tooltip title={isScreenSharing ? "화면 공유 중지" : "화면 공유 시작"}>
                <Button
                  type={isScreenSharing ? "primary" : "default"}
                  icon={<ShareAltOutlined />}
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                  className={isScreenSharing ? "animate-pulse" : ""}
                />
              </Tooltip>
            </>
          )}
          
          <Tooltip title={isFullscreen ? "전체화면 해제" : "전체화면"}>
            <Button
              type="text"
              icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              onClick={toggleFullscreen}
              className="text-white"
            />
          </Tooltip>
          
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />} className="text-white">
              {user?.username}
            </Button>
          </Dropdown>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex">
        {/* 메인 비디오 영역 */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center">
            {isScreenSharing && localStream ? (
              <video
                autoPlay
                muted
                playsInline
                className="w-full h-full object-contain"
                ref={(video) => {
                  if (video && localStream) {
                    video.srcObject = localStream;
                  }
                }}
              />
            ) : (
              <div className="text-center">
                <VideoCameraOutlined className="text-6xl text-white/40 mb-4" />
                <Text className="text-white/60 text-lg">
                  {userRole === 'instructor' 
                    ? "화면 공유를 시작하세요" 
                    : "강사의 화면을 기다리는 중..."
                  }
                </Text>
              </div>
            )}
          </div>
          
          {/* 컨트롤 바 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black/60 backdrop-blur-md rounded-lg px-4 py-2 border border-white/20">
              <Space>
                <Button
                  type="text"
                  icon={<HeartOutlined />}
                  className="text-white"
                />
                <Button
                  type="text"
                  icon={<LikeOutlined />}
                  className="text-white"
                />
                <Button
                  type="text"
                  icon={<DislikeOutlined />}
                  className="text-white"
                />
              </Space>
            </div>
          </div>
        </div>

        {/* 사이드바 */}
        <div className="w-96 bg-black/20 backdrop-blur-md flex flex-col">
          <div className="p-4 border-b border-white/20">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              className="custom-tabs"
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
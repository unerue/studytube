'use client';

import { useState, useEffect } from 'react';
import { List, Avatar, Typography, Badge, Space, Button, Tooltip } from 'antd';
import { 
  UserOutlined, 
  VideoCameraOutlined, 
  AudioOutlined, 
  RocketOutlined,
  CrownOutlined,
  WifiOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface Participant {
  user_id: number;
  username: string;
  is_online: boolean;
  role?: 'instructor' | 'student';
  isAudioOn?: boolean;
  isVideoOn?: boolean;
  isRaiseHand?: boolean;
}

interface ParticipantListProps {
  lectureId: string;
  userRole: 'instructor' | 'student';
  participants?: Participant[];
  isConnected?: boolean;
}

export function ParticipantList({ 
  lectureId, 
  userRole, 
  participants: externalParticipants = [],
  isConnected: externalIsConnected = false 
}: ParticipantListProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // 외부에서 전달받은 참여자 목록과 연결 상태 사용
  useEffect(() => {
    setParticipants(externalParticipants);
  }, [externalParticipants]);

  useEffect(() => {
    setIsConnected(externalIsConnected);
  }, [externalIsConnected]);

  useEffect(() => {
    // 초기 참여자 목록 로드 (외부 데이터가 없을 때만)
    if (externalParticipants.length === 0) {
      fetchParticipants();
    }
  }, [lectureId, externalParticipants]);

  const fetchParticipants = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/lectures/${lectureId}/participants`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
      }
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const getAvatarColor = (participant: Participant) => {
    // 강사는 파란색, 학생은 초록색
    if (participant.role === 'instructor' || participant.username.includes('교수')) {
      return '#1890ff';
    }
    return '#52c41a';
  };

  const renderParticipant = (participant: Participant) => {
    const isInstructor = participant.role === 'instructor' || participant.username.includes('교수');
    
    return (
      <List.Item key={participant.user_id} className="px-4 py-3 hover:bg-gray-50">
        <div className="flex items-center space-x-3 w-full">
          <div className="relative">
            <Avatar 
              size="default"
              style={{ backgroundColor: getAvatarColor(participant) }}
              icon={<UserOutlined />}
            >
              {participant.username.charAt(0).toUpperCase()}
            </Avatar>
            
            {/* 온라인 상태 표시 */}
            <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              participant.is_online ? 'bg-green-500' : 'bg-gray-400'
            }`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <Text strong className="text-sm truncate">
                {participant.username}
              </Text>
              
              {isInstructor && (
                <Tooltip title="강사">
                  <CrownOutlined className="text-yellow-500 text-xs" />
                </Tooltip>
              )}
              
              <Badge 
                status={participant.is_online ? "success" : "default"} 
                text={participant.is_online ? "온라인" : "오프라인"}
                className="text-xs"
              />
            </div>
            
            {/* 미디어 상태 표시 */}
            <div className="flex items-center space-x-2 mt-1">
              <Tooltip title={participant.isAudioOn ? "음성 켜짐" : "음성 꺼짐"}>
                <Button 
                  type="text" 
                  size="small"
                  icon={<AudioOutlined />}
                  className={participant.isAudioOn ? "text-green-500" : "text-gray-400"}
                />
              </Tooltip>
              
              <Tooltip title={participant.isVideoOn ? "비디오 켜짐" : "비디오 꺼짐"}>
                <Button 
                  type="text" 
                  size="small"
                  icon={<VideoCameraOutlined />}
                  className={participant.isVideoOn ? "text-green-500" : "text-gray-400"}
                />
              </Tooltip>
              
              {participant.isRaiseHand && (
                <Tooltip title="손 들기">
                  <RocketOutlined className="text-orange-500 animate-bounce" />
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </List.Item>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserOutlined className="text-blue-500" />
            <Text className="font-medium">참여자</Text>
            <Badge 
              count={participants.length} 
              showZero 
              style={{ backgroundColor: '#52c41a' }}
            />
          </div>
          
          <div className="flex items-center space-x-1">
            <WifiOutlined className={isConnected ? "text-green-500" : "text-red-500"} />
            <Text className="text-xs text-gray-500">
              {isConnected ? "실시간" : "연결 끊김"}
            </Text>
          </div>
        </div>
      </div>

      {/* 참여자 목록 */}
      <div className="flex-1 overflow-y-auto">
        {participants.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <UserOutlined className="text-4xl text-gray-300 mb-2" />
              <Text className="text-gray-500">참여자가 없습니다</Text>
            </div>
          </div>
        ) : (
          <List
            dataSource={participants}
            renderItem={renderParticipant}
            className="p-0"
          />
        )}
      </div>

      {/* 하단 정보 */}
      <div className="px-4 py-2 border-t border-gray-200">
        <Text className="text-xs text-gray-500">
          총 {participants.length}명 참여 중
        </Text>
      </div>
    </div>
  );
} 
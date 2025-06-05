'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Avatar, Typography, Space, Badge, Tooltip } from 'antd';
import { SendOutlined, GlobalOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ChatMessage {
  id: string;
  type: 'chat_message' | 'user_joined' | 'user_left' | 'system';
  user_id?: number;
  username: string;
  message: string;
  is_private?: boolean;
  timestamp: string;
  translated_message?: string;
  original_language?: string;
}

interface ChatPanelProps {
  lectureId: string;
  userRole: 'instructor' | 'student';
  messages?: ChatMessage[];
  wsConnection?: WebSocket | null;
  isConnected?: boolean;
}

export function ChatPanel({ 
  lectureId, 
  userRole, 
  messages: externalMessages = [], 
  wsConnection: externalWsConnection = null,
  isConnected: externalIsConnected = false 
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 외부에서 전달받은 메시지와 연결 상태 사용
  useEffect(() => {
    if (externalMessages.length > 0) {
      setMessages(externalMessages);
    }
  }, [externalMessages]);

  useEffect(() => {
    setIsConnected(externalIsConnected);
  }, [externalIsConnected]);

  useEffect(() => {
    if (externalWsConnection) {
      wsRef.current = externalWsConnection;
    }
  }, [externalWsConnection]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    console.log(`[${userRole}] 채팅 메시지 전송 시도:`, newMessage.trim());
    console.log(`[${userRole}] 연결 상태 - wsRef:`, wsRef.current?.readyState, 'isConnected:', isConnected);
    
    if (!newMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`[${userRole}] 메시지 전송 실패:`, {
        hasMessage: !!newMessage.trim(),
        hasConnection: !!wsRef.current,
        connectionState: wsRef.current?.readyState
      });
      return;
    }

    const messageData = {
      type: 'chat_message',
      message: newMessage.trim(),
      is_private: isPrivateMode
    };

    console.log(`[${userRole}] 채팅 메시지 JSON 전송:`, messageData);
    wsRef.current.send(JSON.stringify(messageData));
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageColor = (msgType: string) => {
    switch (msgType) {
      case 'user_joined':
        return '#52c41a';
      case 'user_left':
        return '#ff4d4f';
      case 'system':
        return '#1890ff';
      default:
        return '#000';
    }
  };

  const renderMessage = (msg: ChatMessage) => {
    if (msg.type === 'user_joined' || msg.type === 'user_left') {
      return (
        <div key={msg.id} className="text-center py-2">
          <Text style={{ color: getMessageColor(msg.type), fontSize: '12px' }}>
            {msg.message}
          </Text>
        </div>
      );
    }

    return (
      <div key={msg.id} className="mb-3">
        <div className="flex items-start space-x-3">
          <Avatar size="small" className="bg-blue-500">
            {msg.username?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <Text strong className="text-sm">
                {msg.username}
              </Text>
              <Text className="text-xs text-gray-500">
                {formatTime(msg.timestamp)}
              </Text>
              {msg.is_private && (
                <Badge 
                  count={<EyeInvisibleOutlined style={{ color: '#ff4d4f' }} />} 
                  showZero={false}
                />
              )}
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <Text className="text-sm break-words">
                {msg.message}
              </Text>
              {msg.translated_message && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center space-x-1 mb-1">
                    <GlobalOutlined className="text-xs text-blue-500" />
                    <Text className="text-xs text-gray-500">번역</Text>
                  </div>
                  <Text className="text-sm text-gray-700">
                    {msg.translated_message}
                  </Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* 연결 상태 표시 */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <Text className="text-sm font-medium">실시간 채팅</Text>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Text className="text-xs text-gray-500">
              {isConnected ? '연결됨' : '연결 끊김'}
            </Text>
          </div>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Text className="text-gray-500">
              아직 채팅 메시지가 없습니다.<br />
              첫 번째 메시지를 보내보세요!
            </Text>
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      <div className="p-4 border-t border-gray-200">
        {userRole === 'instructor' && (
          <div className="mb-3">
            <Tooltip title="비공개 모드에서는 강사만 메시지를 볼 수 있습니다">
              <Button
                type={isPrivateMode ? 'primary' : 'default'}
                size="small"
                icon={<EyeInvisibleOutlined />}
                onClick={() => setIsPrivateMode(!isPrivateMode)}
              >
                {isPrivateMode ? '비공개 모드' : '공개 모드'}
              </Button>
            </Tooltip>
          </div>
        )}
        
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요..."
            disabled={!isConnected}
            maxLength={500}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
          />
        </Space.Compact>
        
        <div className="mt-2 text-right">
          <Text className="text-xs text-gray-400">
            {newMessage.length}/500 • Enter로 전송
          </Text>
        </div>
      </div>
    </div>
  );
} 
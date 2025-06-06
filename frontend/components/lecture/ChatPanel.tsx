'use client';

import { useState, useEffect, useRef } from 'react';
import { Input, Button, List, Avatar, Typography, Space, Badge, Tooltip } from 'antd';
import { SendOutlined, GlobalOutlined, EyeInvisibleOutlined, MessageOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { TextArea } = Input;

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
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ 
  lectureId, 
  userRole, 
  messages: externalMessages = [], 
  wsConnection: externalWsConnection = null,
  isConnected: externalIsConnected = false,
  onSendMessage
}: ChatPanelProps) {
  const [newMessage, setNewMessage] = useState('');
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 외부에서 전달받은 연결 상태와 WebSocket 연결만 관리
  useEffect(() => {
    console.log(`[ChatPanel-${userRole}] === WEBSOCKET CONNECTION UPDATE ===`);
    console.log(`[ChatPanel-${userRole}] Previous wsRef:`, wsRef.current?.readyState);
    console.log(`[ChatPanel-${userRole}] New externalWsConnection:`, externalWsConnection?.readyState);
    if (externalWsConnection) {
      console.log(`[ChatPanel-${userRole}] Setting wsRef to external connection`);
      wsRef.current = externalWsConnection;
    }
  }, [externalWsConnection]);

  useEffect(() => {
    console.log(`[ChatPanel-${userRole}] === MESSAGES UPDATE - SCROLLING ===`);
    console.log(`[ChatPanel-${userRole}] Messages updated, scrolling to bottom. Count:`, externalMessages.length);
    scrollToBottom();
  }, [externalMessages, userRole]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = () => {
    console.log(`[ChatPanel-${userRole}] ===== 채팅 메시지 전송 시작 =====`);
    console.log(`[ChatPanel-${userRole}] Message content:`, newMessage.trim());
    console.log(`[ChatPanel-${userRole}] Message length:`, newMessage.trim().length);
    console.log(`[ChatPanel-${userRole}] IsPrivateMode:`, isPrivateMode);
    console.log(`[ChatPanel-${userRole}] wsRef.current:`, wsRef.current);
    console.log(`[ChatPanel-${userRole}] wsRef readyState:`, wsRef.current?.readyState);
    console.log(`[ChatPanel-${userRole}] isConnected:`, externalIsConnected);
    console.log(`[ChatPanel-${userRole}] WebSocket.OPEN constant:`, WebSocket.OPEN);
    
    if (!newMessage.trim()) {
      console.warn(`[ChatPanel-${userRole}] 메시지가 비어있음 - 전송 중단`);
      return;
    }
    
    if (!wsRef.current) {
      console.warn(`[ChatPanel-${userRole}] WebSocket 연결이 없음 - 전송 중단`);
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`[ChatPanel-${userRole}] WebSocket이 열려있지 않음 - 전송 중단. State:`, wsRef.current.readyState);
      return;
    }

    const messageData = {
      type: 'chat_message',
      message: newMessage.trim(),
      is_private: isPrivateMode
    };

    console.log(`[ChatPanel-${userRole}] 전송할 메시지 데이터:`, messageData);
    console.log(`[ChatPanel-${userRole}] JSON 문자열:`, JSON.stringify(messageData));
    
    try {
      wsRef.current.send(JSON.stringify(messageData));
      console.log(`[ChatPanel-${userRole}] 메시지 전송 성공!`);
      setNewMessage('');
      console.log(`[ChatPanel-${userRole}] 입력 필드 초기화 완료`);
    } catch (error) {
      console.error(`[ChatPanel-${userRole}] 메시지 전송 실패:`, error);
    }
    
    console.log(`[ChatPanel-${userRole}] ===== 채팅 메시지 전송 완료 =====`);
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
    if (msg.type === 'user_joined' || msg.type === 'user_left' || msg.type === 'system') {
      return (
        <div key={msg.id} className="text-center py-2">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
            <div className={`w-1.5 h-1.5 rounded-full ${
              msg.type === 'user_joined' ? 'bg-green-400' : 
              msg.type === 'user_left' ? 'bg-red-400' : 'bg-blue-400'
            }`} />
            <Text className="text-white/80 text-xs">
              {msg.message}
            </Text>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} className="group">
        <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
          <Avatar 
            size="small" 
            className="bg-gradient-to-br from-blue-500 to-purple-600 border border-white/20 shadow-lg"
          >
            {msg.username?.charAt(0)?.toUpperCase()}
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Text className="text-white font-medium text-sm">
                {msg.username}
              </Text>
              <Text className="text-white/50 text-xs">
                {formatTime(msg.timestamp)}
              </Text>
              {msg.is_private && (
                <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full border border-yellow-500/30">
                  <EyeInvisibleOutlined className="text-yellow-400 text-xs" />
                  <Text className="text-yellow-100 text-xs font-medium">비공개</Text>
                </div>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
              <Text className="text-white text-sm break-words leading-relaxed">
                {msg.message}
              </Text>
              {msg.translated_message && (
                <div className="mt-3 pt-3 border-t border-white/20">
                  <div className="flex items-center gap-2 mb-2">
                    <GlobalOutlined className="text-blue-400 text-xs" />
                    <Text className="text-blue-300 text-xs font-medium">번역</Text>
                  </div>
                  <Text className="text-white/80 text-sm leading-relaxed">
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
    <div className="h-full grid grid-rows-[auto_1fr_auto] bg-black/20 backdrop-blur-sm">
      {/* 헤더 */}
      <div className="p-3 border-b border-white/10 bg-gradient-to-r from-green-600/30 to-blue-600/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageOutlined className="text-green-400" />
            <Text className="font-semibold text-white text-sm">실시간 채팅</Text>
            <Badge 
              count={externalMessages.length} 
              showZero 
              style={{ backgroundColor: '#10b981', fontSize: '10px' }}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {userRole === 'instructor' && (
              <Tooltip title="비공개 모드에서는 강사만 메시지를 볼 수 있습니다">
                <Button
                  type="text"
                  size="small"
                  icon={<EyeInvisibleOutlined />}
                  onClick={() => setIsPrivateMode(!isPrivateMode)}
                  className={`border-0 text-xs ${
                    isPrivateMode 
                      ? 'text-yellow-400 hover:bg-yellow-500/20' 
                      : 'text-white/60 hover:bg-white/10'
                  }`}
                >
                  {isPrivateMode ? '비공개' : '공개'}
                </Button>
              </Tooltip>
            )}
            
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${
                externalIsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`} />
              <Text className="text-white/80 text-xs">
                {externalIsConnected ? '연결됨' : '연결 끊김'}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20">
        {externalMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <TeamOutlined className="text-4xl text-white/30 mb-4" />
            <Text className="text-white/60 text-sm">
              아직 채팅 메시지가 없습니다.<br />
              첫 번째 메시지를 보내보세요!
            </Text>
          </div>
        ) : (
          <div className="space-y-3">
            {externalMessages.map(renderMessage)}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 메시지 입력 */}
      <div className="p-3 border-t border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex gap-2">
          <TextArea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요..."
            autoSize={{ minRows: 1, maxRows: 3 }}
            className="flex-1 bg-transparent border-white/20 text-white placeholder-gray-400 resize-none"
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={sendMessage}
            disabled={!newMessage.trim() || !externalIsConnected}
            className="bg-blue-600 border-blue-500 hover:bg-blue-700 shrink-0"
          >
            전송
          </Button>
        </div>
        
        <div className="mt-2 flex justify-between items-center text-xs">
          <Text className="text-white/50">
            Enter로 전송
          </Text>
          <Text className="text-white/50">
            {newMessage.length}/500
          </Text>
        </div>
      </div>
    </div>
  );
} 
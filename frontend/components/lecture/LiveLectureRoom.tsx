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
import VoiceWaveform from './VoiceWaveform';

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

interface SubtitleEntry {
  id: string;
  text: string;
  timestamp: Date;
  speaker?: string;
}

export default function LiveLectureRoom({
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
  
  // STT 상태
  const [isSTTActive, setIsSTTActive] = useState(false);
  const [sttWebSocket, setSTTWebSocket] = useState<WebSocket | null>(null);
  const [subtitleWebSocket, setSubtitleWebSocket] = useState<WebSocket | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  
  // 음성 시각화를 위한 상태
  const [audioLevel, setAudioLevel] = useState<number>(0);
  
  // 자막 히스토리
  const [subtitleHistory, setSubtitleHistory] = useState<SubtitleEntry[]>([]);
  
  // 자막 히스토리 스크롤 참조
  const subtitleHistoryRef = useRef<HTMLDivElement>(null);
  
  // 자막 애니메이션 키 (텍스트가 변경될 때마다 새로운 애니메이션 트리거)
  const [subtitleKey, setSubtitleKey] = useState(0);
  
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
      // 토큰 가져오기
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

  // STT WebSocket 연결
  useEffect(() => {
    if (userRole === 'instructor') {
      connectToSTTServer();
    }
    
    return () => {
      if (sttWebSocket) {
        sttWebSocket.close();
      }
    };
  }, [lectureId, userRole]);

  // STT 서버에 연결하는 함수
  const connectToSTTServer = () => {
    if (sttWebSocket && sttWebSocket.readyState === WebSocket.OPEN) {
      console.log('🎤 STT WebSocket 이미 연결됨');
      return;
    }

    // 토큰 가져오기 및 URL 생성
    const token = localStorage.getItem('access_token');
    if (!token) {
      console.error('인증 토큰이 없습니다');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = process.env.NODE_ENV === 'development' ? '8000' : window.location.port;
    
    // 토큰을 쿼리 파라미터가 아닌 WebSocket 메시지로 전달
    const wsUrl = `${protocol}//${host}:${port}/ws/stt/${lectureId}`;
    
    console.log('STT WebSocket 연결 시도:', wsUrl);
    const ws = new WebSocket(wsUrl);
    
    ws.binaryType = 'arraybuffer'; // 바이너리 데이터 처리 최적화
    
    // 연결 후 인증 메시지 전송
    ws.onopen = () => {
      console.log('STT WebSocket 연결됨, 인증 메시지 전송');
      // 인증 메시지 전송
      const authMessage = JSON.stringify({
        type: 'auth',
        token: token
      });
      ws.send(authMessage);
    };
    
    ws.onmessage = (event) => {
      try {
        if (typeof event.data === 'string') {
          const data = JSON.parse(event.data);
          
          // 인증 응답 처리
          if (data.type === 'auth_response') {
            if (data.status === 'success') {
              console.log('STT 인증 성공:', data.message);
            } else {
              console.error('STT 인증 실패:', data.message);
            }
            return;
          }
          
          // RealtimeSTT 응답 처리
          if (data.type === 'realtime') {
            console.log('실시간 텍스트 수신:', data.text);
            setCurrentSubtitle(data.text);
            setSubtitleKey(prev => prev + 1);
          } else if (data.type === 'fullSentence') {
            console.log('완성된 문장 수신:', data.text);
            // 완성된 문장을 히스토리에 추가
            const newSubtitle: SubtitleEntry = {
              id: Date.now().toString(),
              text: data.text,
              timestamp: new Date(),
              speaker: '강사'
            };
            setSubtitleHistory(prev => [...prev, newSubtitle]);
            setCurrentSubtitle('');
            
            // 자막 히스토리가 업데이트되면 스크롤을 맨 아래로
            setTimeout(() => {
              if (subtitleHistoryRef.current) {
                subtitleHistoryRef.current.scrollTop = subtitleHistoryRef.current.scrollHeight;
              }
            }, 100);
          }
        }
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
      }
    };
    
    ws.onclose = (event) => {
      console.log('STT WebSocket 연결 끊김', {
        code: event.code,
        reason: event.reason || '이유 없음',
        wasClean: event.wasClean
      });
      
      // 자동 재연결 시도 (5초 후)
      if (event.code !== 1000) { // 정상 종료가 아닌 경우
        console.log('STT WebSocket 5초 후 재연결 시도...');
        setTimeout(() => {
          console.log('STT WebSocket 재연결 시도');
          connectToSTTServer();
        }, 5000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('STT WebSocket 오류:', error);
    };
    
    setSTTWebSocket(ws);
  };

  // 자막 수신용 WebSocket 연결 (모든 사용자)
  useEffect(() => {
    const connectSubtitleWebSocket = () => {
      const token = localStorage.getItem('token');
      const subtitleWsUrl = token 
        ? `ws://localhost:8000/api/stt/ws/${lectureId}?token=${encodeURIComponent(token)}`
        : `ws://localhost:8000/api/stt/ws/${lectureId}`;
      
      const subtitleWs = new WebSocket(subtitleWsUrl);
      
      subtitleWs.onopen = () => {
        console.log('📺 자막 WebSocket 연결 성공');
        console.log('📺 WebSocket URL:', subtitleWsUrl);
        setSubtitleWebSocket(subtitleWs);
      };
      
      let subtitleMessageCount = 0;
      
      subtitleWs.onmessage = (event) => {
        subtitleMessageCount++;
        console.log('📺 *** 자막 WebSocket 메시지 수신 ***:', {
          messageNumber: subtitleMessageCount,
          dataType: typeof event.data,
          dataSize: event.data.length,
          rawData: event.data,
          timestamp: new Date().toISOString()
        });
        
        try {
          const data = JSON.parse(event.data);
          console.log('📺 *** 파싱된 자막 데이터 ***:', {
            messageNumber: subtitleMessageCount,
            type: data.type,
            hasText: !!data.text,
            textLength: data.text?.length || 0,
            fullData: data,
            timestamp: new Date().toISOString()
          });
          
          if (data.type === 'subtitle') {
            console.log('🎯 *** 자막 데이터 처리 시작 ***:', {
              messageNumber: subtitleMessageCount,
              text: data.text,
              textLength: data.text?.length || 0,
              timestamp: new Date().toISOString()
            });
            
            if (data.text && data.text.trim()) {
              console.log('✅ *** 유효한 자막 텍스트 처리 ***:', data.text);
              
              setCurrentSubtitle(data.text);
              setSubtitleKey(prev => prev + 1); // 애니메이션 트리거
              console.log('📝 *** 현재 자막 및 애니메이션 키 업데이트 완료 ***');
              
              const newSubtitle: SubtitleEntry = {
                id: `${Date.now()}-${subtitleMessageCount}`,
                text: data.text.trim(),
                timestamp: new Date(),
                speaker: data.username || user?.username || 'Unknown'
              };
              
              console.log('📝 *** 새 자막 엔트리 생성 ***:', newSubtitle);
              
              setSubtitleHistory(prev => {
                const updated = [...prev, newSubtitle];
                console.log('📚 *** 자막 히스토리 업데이트 ***:', {
                  previousCount: prev.length,
                  newCount: updated.length,
                  latestSubtitle: newSubtitle.text,
                  timestamp: new Date().toISOString()
                });
                
                // 자막 히스토리 자동 스크롤
                setTimeout(() => {
                  if (subtitleHistoryRef.current) {
                    subtitleHistoryRef.current.scrollTop = subtitleHistoryRef.current.scrollHeight;
                    console.log('📜 *** 자막 히스토리 자동 스크롤 완료 ***');
                  }
                }, 100);
                return updated;
              });
            } else {
              console.warn('⚠️ *** 빈 자막 텍스트 수신 ***:', {
                messageNumber: subtitleMessageCount,
                hasText: !!data.text,
                text: data.text,
                timestamp: new Date().toISOString()
              });
            }
          } else if (data.type === 'ping') {
            console.log('🏓 자막 WebSocket ping 수신:', subtitleMessageCount);
          } else {
            console.log('❓ *** 알 수 없는 메시지 타입 ***:', {
              messageNumber: subtitleMessageCount,
              type: data.type,
              data: data,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('❌ *** 자막 WebSocket 메시지 파싱 오류 ***:', {
            messageNumber: subtitleMessageCount,
            error: error,
            rawData: event.data,
            timestamp: new Date().toISOString()
          });
        }
      };
      
      subtitleWs.onerror = (error) => {
        console.error('❌ 자막 WebSocket 오류:', error);
      };
      
      subtitleWs.onclose = (event) => {
        console.log('🔌 자막 WebSocket 연결 끊어짐');
        console.log('🔌 Close Code:', event.code, 'Reason:', event.reason);
        setTimeout(connectSubtitleWebSocket, 3000);
      };
    };
    
    connectSubtitleWebSocket();
    
    return () => {
      if (subtitleWebSocket) {
        subtitleWebSocket.close();
      }
    };
  }, [lectureId]);

  // STT 토글 (RealtimeSTT 예제 파일 참고하여 개선)
  const toggleSTT = async () => {
    console.log('🎛️ STT 토글 시작, 현재 상태:', isSTTActive);
    
    if (!isSTTActive) {
      try {
        // 마이크 액세스 요청
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            sampleRate: 16000, // 서버에서 처리하기 위해 16kHz로 변경
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true
          } 
        });
        
        // STT WebSocket 연결 확인
        if (!sttWebSocket || sttWebSocket.readyState !== WebSocket.OPEN) {
          connectToSTTServer();
        }
        
        // 토큰 확인
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
        }
        
        // AudioContext 생성 - 16kHz 설정 (RealtimeSTT와 호환)
        const audioContext = new AudioContext({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(stream);
        
        // ScriptProcessorNode 생성 (RealtimeSTT 예제에 맞추어 버퍼 크기 조정)
        // 버퍼 크기를 늘려 처리 효율성 향상
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(processor);
        processor.connect(audioContext.destination);
        
        // 오디오 처리 핸들러 - RealtimeSTT 예제 참고하여 개선
        processor.onaudioprocess = (e) => {
          if (!sttWebSocket || sttWebSocket.readyState !== WebSocket.OPEN) {
            return;
          }
          
          const inputData = e.inputBuffer.getChannelData(0);
          const outputData = new Int16Array(inputData.length);
          
          // Float32Array를 16-bit PCM으로 변환
          for (let i = 0; i < inputData.length; i++) {
            outputData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }
          
          // 오디오 레벨 계산 (파형 시각화용)
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += Math.abs(inputData[i]);
          }
          const average = sum / inputData.length;
          setAudioLevel(average * 5); // 스케일 조정
          
          // 메타데이터 생성 - RealtimeSTT 서버가 예상하는 형식
          const metadata = JSON.stringify({ 
            sampleRate: audioContext.sampleRate || 16000
          });
          const metadataBytes = new TextEncoder().encode(metadata);
          
          // 메타데이터 길이를 4바이트로 인코딩 (little-endian)
          const metadataLength = new ArrayBuffer(4);
          const metadataLengthView = new DataView(metadataLength);
          metadataLengthView.setInt32(0, metadataBytes.byteLength, true);
          
          // 메타데이터 길이 + 메타데이터 + 오디오 데이터 결합 - RealtimeSTT 서버 형식에 맞춤
          const combinedData = new Blob([metadataLength, metadataBytes, outputData.buffer]);
          
          // 디버깅 정보 (오디오 데이터 크기 등)
          if (audioLevel > 0.01) { // 일정 레벨 이상일 때만 로그 출력 (소음 무시)
            console.debug('오디오 데이터 전송:', {
              bufferSize: inputData.length,
              outputSize: outputData.length,
              sampleRate: audioContext.sampleRate,
              avgLevel: average.toFixed(4)
            });
          }
          
          sttWebSocket.send(combinedData);
        };
        
        // MediaRecorder 설정 (녹음 중지 및 오디오 시각화 용도)
        let mimeType = 'audio/webm;codecs=opus';
        if (MediaRecorder.isTypeSupported('audio/wav')) {
          mimeType = 'audio/wav';
        }
        
        const mr = new MediaRecorder(stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 16000 // RealtimeSTT 서버가 예상하는 비트레이트
        });
        
        console.log('MediaRecorder 생성 완료:', {
          mimeType: mr.mimeType,
          state: mr.state
        });
        
        setMediaRecorder(mr);
        
        setIsSTTActive(true);
        console.log('✅ STT 활성화 완료');
        
      } catch (error) {
        console.error('❌ STT 시작 실패:', error);
        alert('STT 시작에 실패했습니다: ' + (error instanceof Error ? error.message : String(error)));
      }
    } else {
      // STT 중지
      console.log('⏹️ STT 중지 시작');
      
      // 모든 오디오 처리 중지
      if (mediaRecorder) {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
        
        // 모든 트랙 중지
        mediaRecorder.stream.getTracks().forEach(track => {
          track.stop();
        });
        
        setMediaRecorder(null);
      }
      
      setIsSTTActive(false);
      console.log('✅ STT 비활성화 완료');
    }
  };

  // 채팅 메시지 전송
  const sendMessage = () => {
    if (newMessage.trim() && ws?.readyState === WebSocket.OPEN) {
      const messageData = {
        type: 'chat_message',
        message: newMessage,
        userId: user?.id,
        username: user?.username,
        timestamp: new Date().toISOString()
      };
      
      ws.send(JSON.stringify(messageData));
      setNewMessage('');
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
      label: '로그아웃',
      danger: true,
    },
  ];

  // 탭 아이템
  const tabItems: TabsProps['items'] = [
    {
      key: 'chat',
      label: (
        <Space>
          <MessageOutlined />
          채팅
          {chatMessages.length > 0 && (
            <Badge 
              count={chatMessages.filter(msg => msg.type !== 'system').length} 
              size="small" 
            />
          )}
        </Space>
      ),
      children: (
        <div className="h-96 flex flex-col">
          {/* 채팅 메시지 영역 */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-2 pr-2 custom-scrollbar">
            {chatMessages.map((msg) => (
              <div key={msg.id} className={`p-3 rounded-lg backdrop-blur-md ${
                msg.type === 'system' 
                  ? 'bg-blue-500/20 border border-blue-400/30' 
                  : msg.userId === user?.id?.toString()
                    ? 'bg-primary-500/20 border border-primary-400/30 ml-8'
                    : 'bg-white/10 border border-white/20 mr-8'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <Text className="text-white text-sm font-medium">
                    {msg.username}
                  </Text>
                  <Text className="text-white/60 text-xs">
                    {msg.timestamp.toLocaleTimeString()}
                  </Text>
                </div>
                <Text className="text-white">
                  {msg.message}
                </Text>
              </div>
            ))}
          </div>
          
          {/* 메시지 입력 영역 */}
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              onPressEnter={sendMessage}
                             className="bg-white/10 border-white/20 text-white placeholder-white/60 focus:text-white"
            />
            <Button 
              type="primary"
              icon={<SendOutlined />}
              onClick={sendMessage}
              disabled={!newMessage.trim()}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'participants',
      label: (
        <Space>
          <UsergroupAddOutlined />
          참여자
          <Badge count={participants.length} size="small" />
        </Space>
      ),
      children: (
        <div className="h-96 overflow-y-auto pr-2 custom-scrollbar">
          <List
            dataSource={participants}
            renderItem={(participant) => (
              <List.Item className="border-none px-0">
                <div className="w-full p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar 
                        icon={<UserOutlined />} 
                        className="bg-primary-500"
                      />
                      <div>
                        <Text className="text-white font-medium block">
                          {participant.username}
                        </Text>
                        <Text className="text-white/60 text-sm">
                          {participant.role === 'instructor' ? '강사' : '학생'}
                        </Text>
                      </div>
                    </div>
                    <Badge 
                      status={participant.isOnline ? "success" : "default"} 
                      text={<span className="text-white/60 text-sm">
                        {participant.isOnline ? "온라인" : "오프라인"}
                      </span>}
                    />
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      ),
    },
         {
       key: 'subtitles',
       label: (
         <Space>
           <FileTextOutlined />
           자막 히스토리
           <Badge count={subtitleHistory.length} size="small" />
         </Space>
       ),
      children: (
        <div className="h-96 overflow-y-auto pr-2 custom-scrollbar">
          <List
            dataSource={subtitleHistory.slice().reverse()}
            renderItem={(subtitle) => (
              <List.Item className="border-none px-0">
                <div className="w-full p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                  <div className="flex justify-between items-start mb-2">
                    <Text className="text-white/60 text-sm">
                      {subtitle.speaker} • {subtitle.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                  <Text className="text-white">
                    {subtitle.text}
                  </Text>
                </div>
              </List.Item>
            )}
          />
        </div>
      ),
    },
    {
      key: 'stt',
      label: (
        <Space>
          <SoundOutlined />
          음성인식
          {isSTTActive && <Badge status="processing" color="#52c41a" />}
        </Space>
      ),
      children: (
        <div className="h-96 flex flex-col space-y-4">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="text-white text-center mb-2">
                <h3 className="text-lg font-medium">실시간 음성 인식</h3>
                <p className="text-white/60 text-sm">
                  {isSTTActive ? '음성이 인식되고 있습니다' : '시작 버튼을 눌러 음성 인식을 시작하세요'}
                </p>
              </div>
              
              {/* 음성 파형 시각화 */}
              <VoiceWaveform 
                audioLevel={audioLevel}
                isActive={isSTTActive}
                width={320} 
                height={100}
              />
              
              <Button
                type={isSTTActive ? "primary" : "default"}
                icon={<SoundOutlined />}
                onClick={toggleSTT}
                size="large"
                danger={isSTTActive}
                className={`w-full ${isSTTActive ? "bg-red-500 hover:bg-red-600 border-red-500" : ""}`}
              >
                {isSTTActive ? "음성 인식 중지" : "음성 인식 시작"}
              </Button>
            </div>
          </div>
          
          {/* 현재 인식 중인 텍스트 (실시간) */}
          {isSTTActive && (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-4">
              <h4 className="text-white/80 font-medium mb-2">실시간 인식 중:</h4>
              <div className="p-3 bg-black/30 rounded-lg min-h-[60px] text-white">
                {currentSubtitle || <span className="text-white/40">음성을 인식하고 있습니다...</span>}
              </div>
            </div>
          )}
          
          {/* 최근 자막 목록 */}
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <h4 className="text-white/80 font-medium mb-2">최근 변환 결과:</h4>
            {subtitleHistory.length > 0 ? (
              <div className="space-y-2">
                {subtitleHistory.slice(-5).reverse().map((subtitle) => (
                  <div key={subtitle.id} className="p-3 rounded-lg bg-white/10 backdrop-blur-md border border-white/20">
                    <div className="flex justify-between items-start mb-1">
                      <Text className="text-white/60 text-xs">
                        {subtitle.timestamp.toLocaleTimeString()}
                      </Text>
                    </div>
                    <Text className="text-white">
                      {subtitle.text}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-white/40 p-4">
                아직 변환된 자막이 없습니다
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="lecture-room-page h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="bg-black/20 backdrop-blur-md border-b border-white/20 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Title level={3} className="text-white m-0">
              {lectureTitle}
            </Title>
            <Badge 
              count={`${participantCount}명 참여`} 
              className="bg-green-500"
            />
          </div>
          
          <div className="flex items-center space-x-3">
            {/* STT 컨트롤 (강사만) */}
            {userRole === 'instructor' && (
              <>
                <Tooltip title={isSTTActive ? "STT 끄기" : "STT 켜기"}>
                  <Button
                    type={isSTTActive ? "primary" : "default"}
                    icon={<SoundOutlined />}
                    onClick={toggleSTT}
                    className={isSTTActive ? "animate-pulse" : ""}
                  >
                    STT
                  </Button>
                </Tooltip>
              </>
            )}
            
            {/* 오디오 시각화 */}
            {isSTTActive && (
              <AudioVisualizer
                mediaRecorder={mediaRecorder}
                isActive={isSTTActive}
                width={60}
                height={30}
              />
            )}
            
            {/* 화면 공유 */}
            {userRole === 'instructor' && (
              <Tooltip title={isScreenSharing ? "화면 공유 중지" : "화면 공유 시작"}>
                <Button
                  type={isScreenSharing ? "primary" : "default"}
                  icon={<ShareAltOutlined />}
                  onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                >
                  화면 공유
                </Button>
              </Tooltip>
            )}
            
            {/* 오디오 토글 - 추후 구현 */}
            <Tooltip title="마이크 제어">
              <Button
                icon={<AudioOutlined />}
                disabled
              />
            </Tooltip>
            
            {/* 전체화면 */}
            <Tooltip title={isFullscreen ? "전체화면 해제" : "전체화면"}>
              <Button
                icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={toggleFullscreen}
              />
            </Tooltip>
            
            {/* 사용자 메뉴 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Button icon={<UserOutlined />}>
                {user?.username}
              </Button>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* 메인 영상 영역 */}
        <div className="flex-1 relative bg-black/30 backdrop-blur-sm border-r border-white/20">
          {/* 비디오 스트림 영역 */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isScreenSharing && localStream ? (
              <video
                ref={(video) => {
                  if (video && localStream) {
                    video.srcObject = localStream;
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-center">
                <VideoCameraOutlined className="text-white/50 text-6xl mb-4" />
                <Text className="text-white/60 text-lg">
                  {userRole === 'instructor' 
                    ? "화면 공유를 시작하세요" 
                    : "강사의 화면을 기다리는 중..."
                  }
                </Text>
              </div>
            )}
          </div>
          
          {/* 현재 자막 표시 - 비디오 영역 내 */}
          {currentSubtitle && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 max-w-4xl z-50">
              <div 
                className="rounded-xl px-8 py-5 shadow-2xl border-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95))',
                  borderColor: '#fbbf24',
                  backdropFilter: 'blur(20px)',
                  // boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(251, 191, 36, 0.3)'
                }}
              >
                <div 
                  className="text-center font-white text-2xl leading-relaxed"
                  style={{
                    color: '#FFFF00 !important',
                    // textShadow: `
                    //   4px 4px 8px rgba(0, 0, 0, 1),
                    //   -2px -2px 4px rgba(0, 0, 0, 1),
                    //   2px 2px 6px rgba(0, 0, 0, 1),
                    //   0 0 15px rgba(255, 255, 0, 0.8),
                    //   0 0 30px rgba(255, 255, 0, 0.4)
                    // `,
                    filter: 'contrast(1.3) brightness(1.2) saturate(1.1)',
                    fontWeight: '900',
                    letterSpacing: '0.025em',
                    WebkitTextStroke: '1px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  {currentSubtitle}
                </div>
              </div>
            </div>
          )}
          
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

      {/* 페이지 하단 STT 자막 영역 */}
      <div className="bg-black/30 backdrop-blur-md border-t border-white/20 p-4">
        <div className="max-w-6xl mx-auto">
          {/* STT 상태 및 현재 자막 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isSTTActive ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                <Text className="text-white/80 text-sm font-medium">
                  {isSTTActive ? 'STT 활성화됨' : 'STT 비활성화됨'}
                </Text>
              </div>
              {userRole === 'instructor' && (
                <>
                  <Button
                    size="small"
                    type={isSTTActive ? "primary" : "default"}
                    icon={<SoundOutlined />}
                    onClick={toggleSTT}
                    className="text-xs"
                  >
                    {isSTTActive ? "STT 끄기" : "STT 켜기"}
                  </Button>
                </>
              )}
            </div>
            
            {/* 자막 히스토리 카운트 */}
            <Text className="text-white/80 text-sm">
              총 {subtitleHistory.length}개의 자막
            </Text>
          </div>

          {/* 현재 자막 표시 */}
          {currentSubtitle || isSTTActive ? (
            <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 mb-3 animate-fade-in">
              <div className="flex items-start">
                {/* 음성 시각화 영역 */}
                {isSTTActive && (
                  <div className="mr-4 mt-1 hidden md:block">
                    <VoiceWaveform 
                      audioLevel={audioLevel}
                      isActive={isSTTActive}
                      width={180} 
                      height={70}
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <Text className="text-white text-xs">실시간 자막</Text>
                  </div>
                  <Text 
                    key={subtitleKey}
                    className="text-white text-xl font-medium leading-relaxed animate-slide-up"
                  >
                    {currentSubtitle || "말씀해주세요..."}
                  </Text>
                </div>
                <Text className="text-white/40 text-xs ml-3 mt-1">
                  {new Date().toLocaleTimeString()}
                </Text>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 mb-3">
              <div className="flex items-center justify-center space-x-2">
                <SoundOutlined className="text-white/40" />
                <Text className="text-white/60 text-sm">
                  {userRole === 'instructor' 
                    ? 'STT를 활성화하여 실시간 자막을 시작하세요'
                    : '강사의 음성을 자막으로 변환하여 표시합니다'
                  }
                </Text>
              </div>
            </div>
          )}

          {/* 최근 자막 히스토리 (최근 5개만) */}
          {subtitleHistory.length > 0 && (
            <div className="space-y-2">
              <Text className="text-white text-sm font-medium">최근 자막</Text>
              <div 
                ref={subtitleHistoryRef}
                className="grid gap-2 max-h-40 overflow-y-auto custom-scrollbar"
              >
                {subtitleHistory.slice(-5).reverse().map((subtitle, index) => (
                  <div 
                    key={subtitle.id} 
                    className="bg-white/5 backdrop-blur-sm rounded-lg p-3 border border-white/10 transition-all hover:bg-white/10 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Text className="text-white/80 text-sm leading-relaxed">
                          {subtitle.text}
                        </Text>
                      </div>
                      <div className="ml-3 text-right">
                        <Text className="text-white/40 text-xs">
                          {subtitle.timestamp.toLocaleTimeString()}
                        </Text>
                        {subtitle.speaker && (
                          <Text className="text-white/50 text-xs">
                            {subtitle.speaker}
                          </Text>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
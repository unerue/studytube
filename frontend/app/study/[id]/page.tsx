'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Typography, Spin, Button, Input, Tabs, Card, Space, Divider, message, Badge, Tooltip } from 'antd';
import { SendOutlined, TranslationOutlined, SoundOutlined, RobotOutlined, LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { VIDEO_ENDPOINTS, QA_ENDPOINTS, TRANSCRIPT_ENDPOINTS, AUDIO_ENDPOINTS, getAuthHeaders, DEFAULT_FETCH_OPTIONS, API_BASE_URL } from '@/lib/api/config';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface MessageProps {
  id?: string | number;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

interface VideoData {
  id: string;
  title: string;
  url: string;
  thumbnail_url: string;
  description: string;
  summary: string;
  transcript: {
    ko: string;
    en: string;
  };
}

// VideoProcessStatus 인터페이스 추가
interface VideoProcessStatus {
  is_processed: boolean;
  error: string | null;
  has_transcript: boolean;
  has_translation: boolean;
  has_tts: boolean;
}

export default function VideoDetailPage({ params }: { params: { id: string } }) {
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcripts, setTranscripts] = useState<{ ko: string; en: string }>({ ko: '', en: '' });
  const [selectedLanguage, setSelectedLanguage] = useState<'ko' | 'en'>('ko');
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<MessageProps[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();

  // 비디오 플레이어에 대한 ref 추가
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // AI 처리 상태 추가
  const [processingStatus, setProcessingStatus] = useState<VideoProcessStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 트랜스크립트 상태 추가
  const [transcriptData, setTranscriptData] = useState<{ ko: any[]; en: any[] }>({ ko: [], en: [] });

  const videoId = params.id;
  
  // 타임스탬프 포맷 함수 추가
  const formatTimestamp = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 타임스탬프 클릭 핸들러 추가
  const handleTimestampClick = (seconds: number) => {
    // 로컬 비디오인 경우 (videoRef 사용)
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(err => console.error('비디오 재생 오류:', err));
    } 
    // 유튜브 비디오인 경우 (postMessage API 사용)
    else if (iframeRef.current) {
      try {
        // YouTube Player API로 메시지 전송
        const iframe = iframeRef.current;
        const message = {
          event: 'command',
          func: 'seekTo',
          args: [seconds, true]
        };
        iframe.contentWindow?.postMessage(JSON.stringify(message), '*');
      } catch (err) {
        console.error('유튜브 플레이어 제어 오류:', err);
        message.info('유튜브 영상은 직접 자막 구간을 클릭해주세요.');
      }
    }
  };

  // 비디오 데이터 가져오기 함수를 상위 범위로 이동
  const fetchVideoData = async () => {
    try {
      console.log(`비디오 상세 정보 요청: ${VIDEO_ENDPOINTS.VIDEO_DETAIL(videoId)}`);
      const response = await fetch(VIDEO_ENDPOINTS.VIDEO_DETAIL(videoId), {
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (!response.ok) {
        throw new Error("영상을 가져올 수 없습니다.");
      }
      
      const data = await response.json();
      console.log('비디오 데이터:', data);
      setVideoData(data);
      
      // 비디오 데이터를 가져온 후 자막을 별도로 가져옵니다.
      try {
        // 한국어 자막 시도
        const koUrl = TRANSCRIPT_ENDPOINTS.GET_TRANSCRIPT_BY_LANGUAGE(videoId, 'ko');
        console.log('한국어 자막 요청:', koUrl);
        const koResponse = await fetch(koUrl, { 
          headers: getAuthHeaders(), 
          ...DEFAULT_FETCH_OPTIONS 
        });
        
        let koTranscript = '';
        let koSegments = null;
        if (koResponse.ok) {
          const koData = await koResponse.json();
          
          // 구조체 확인 및 데이터 추출
          if (typeof koData === 'string') {
            koTranscript = koData;
          } else if (koData && koData.content) {
            koTranscript = koData.content;
          } else if (koData && koData.text) {
            koTranscript = koData.text;
            if (koData.segments) {
              koSegments = koData.segments;
            }
          } else if (koData && Array.isArray(koData) && koData.length > 0) {
            // 배열 형태의 자막 데이터를 타임스탬프와 함께 저장
            koSegments = koData;
            koTranscript = koData.map((item: any) => item.text || '').join('\n');
          } else if (koData && koData.segments && Array.isArray(koData.segments)) {
            // segments 배열이 있는 경우
            koSegments = koData.segments;
            koTranscript = koData.text || koData.segments.map((item: any) => item.text || '').join('\n');
          }
        }
        
        // 영어 자막 시도
        const enUrl = TRANSCRIPT_ENDPOINTS.GET_TRANSCRIPT_BY_LANGUAGE(videoId, 'en');
        console.log('영어(원본) 자막 요청:', enUrl);
        const enResponse = await fetch(enUrl, { 
          headers: getAuthHeaders(), 
          ...DEFAULT_FETCH_OPTIONS 
        });
        
        let enTranscript = '';
        let enSegments = null;
        if (enResponse.ok) {
          const enData = await enResponse.json();
          
          // 구조체 확인 및 데이터 추출
          if (typeof enData === 'string') {
            enTranscript = enData;
          } else if (enData && enData.content) {
            enTranscript = enData.content;
          } else if (enData && enData.text) {
            enTranscript = enData.text;
            if (enData.segments) {
              enSegments = enData.segments;
            }
          } else if (enData && Array.isArray(enData) && enData.length > 0) {
            // 배열 형태의 자막 데이터를 타임스탬프와 함께 저장
            enSegments = enData;
            enTranscript = enData.map((item: any) => item.text || '').join('\n');
          } else if (enData && enData.segments && Array.isArray(enData.segments)) {
            // segments 배열이 있는 경우
            enSegments = enData.segments;
            enTranscript = enData.text || enData.segments.map((item: any) => item.text || '').join('\n');
          }
        }
        
        // 가져온 자막 설정 (비어있는 경우 기본 메시지 사용)
        setTranscripts({
          ko: koTranscript || '한국어 자막이 준비되지 않았습니다.',
          en: enTranscript || '영어 자막이 준비되지 않았습니다.'
        });
        
        // 세그먼트 데이터가 있으면 저장
        setTranscriptData({
          ko: koSegments || [],
          en: enSegments || []
        });
        
      } catch (err) {
        console.error('자막 가져오기 실패:', err);
        
        // API 요청 실패 시 비디오 데이터에서 자막 정보를 가져옵니다.
        if (data.transcript) {
          console.log('비디오 데이터에서 자막 정보 발견:', data.transcript);
          // 백엔드에서 단일 문자열로 자막을 제공하는 경우 처리
          if (typeof data.transcript === 'string') {
            setTranscripts({
              ko: data.transcript,
              en: data.transcript
            });
          } else if (typeof data.transcript === 'object') {
            // 백엔드가 객체 형태로 자막을 제공하는 경우
            setTranscripts({
              ko: data.transcript.ko || '한국어 자막이 준비되지 않았습니다.',
              en: data.transcript.en || '영어 자막이 준비되지 않았습니다.'
            });
          }
        } else {
          // 기본 메시지 설정
          setTranscripts({
            ko: '자막이 아직 준비되지 않았습니다. AI 처리를 시작해주세요.',
            en: 'Transcripts are not ready yet. Please start AI processing.'
          });
        }
      }
      
      // 비디오 처리 상태 확인
      checkVideoProcessStatus();
    } catch (err: any) {
      console.error("영상을 가져오는 중 오류 발생:", err.message || "오류가 발생했습니다.");
      message.error("영상을 가져오는 중 오류가 발생했습니다.");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 언어 전환
  const toggleLanguage = () => {
    setSelectedLanguage(prev => prev === 'ko' ? 'en' : 'ko');
  };

  // 메시지 전송
  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // 사용자 메시지 추가
    const userMessage: MessageProps = {
      content: newMessage,
      sender: 'user',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setChatLoading(true);

    try {
      const response = await fetch(QA_ENDPOINTS.ASK, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          video_id: videoId,
          question: newMessage
        }),
        ...DEFAULT_FETCH_OPTIONS
      });

      if (!response.ok) {
        throw new Error('질문 처리 중 오류가 발생했습니다.');
      }

      const data = await response.json();
      
      // AI 응답 추가
      const aiResponse: MessageProps = {
        id: data.id,
        content: data.answer,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (err: any) {
      console.error('질문 처리 중 오류:', err);
      message.error(err.message || '질문 처리 중 오류가 발생했습니다.');
      
      // 에러 발생 시 기본 응답 추가
      const errorResponse: MessageProps = {
        content: '죄송합니다. 질문 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setChatLoading(false);
    }
  };

  // 유튜브 URL에서 임베드 URL로 변환하는 함수
  const getVideoSource = (url: string) => {
    if (!url) return '';
    
    // 로컬 비디오(static 폴더) URL 확인
    if (url.startsWith('static/')) {
      const videoUrl = `${API_BASE_URL}/${url}`;
      console.log('로컬 비디오 URL:', videoUrl);
      return videoUrl;
    }
    
    // 유튜브 URL 처리
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/)?.[1];
    // enablejsapi=1 파라미터 추가로 JavaScript API 활성화
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?enablejsapi=1` : '';
    console.log('유튜브 임베드 URL:', embedUrl);
    return embedUrl;
  };

  // 영상 AI 처리 상태 확인
  const checkVideoProcessStatus = async () => {
    try {
      console.log(`비디오 처리 상태 요청: ${VIDEO_ENDPOINTS.VIDEO_STATUS(videoId)}`);
      const response = await fetch(VIDEO_ENDPOINTS.VIDEO_STATUS(videoId), {
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      console.log('처리 상태 응답:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json();
        console.log('처리 상태 데이터:', data);
        setProcessingStatus(data);
        
        // 처리 완료 상태이면 자막과 오디오 다시 확인
        if (data.is_processed) {
          await fetchVideoData();
        }
      }
    } catch (err) {
      console.error("AI 처리 상태 확인 중 오류 발생:", err);
    }
  };

  // 영상 AI 처리 요청
  const startVideoProcessing = async () => {
    setIsProcessing(true);
    
    try {
      console.log(`비디오 처리 요청: ${VIDEO_ENDPOINTS.PROCESS_VIDEO(videoId)}`);
      const response = await fetch(VIDEO_ENDPOINTS.PROCESS_VIDEO(videoId), {
        method: 'POST',
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (!response.ok) {
        throw new Error("영상 처리 요청에 실패했습니다.");
      }
      
      const data = await response.json();
      console.log('처리 요청 응답:', data);
      message.success("영상 AI 처리가 시작되었습니다. 완료까지 몇 분 소요될 수 있습니다.");
      
      // 상태 확인 인터벌 시작
      const checkInterval = setInterval(async () => {
        await checkVideoProcessStatus();
        
        // 처리가 완료되었거나 에러가 발생한 경우 인터벌 종료
        if (processingStatus?.is_processed || processingStatus?.error) {
          clearInterval(checkInterval);
          setIsProcessing(false);
          
          if (processingStatus?.error) {
            message.error(`AI 처리 중 오류가 발생했습니다: ${processingStatus.error}`);
          } else if (processingStatus?.is_processed) {
            message.success("영상 AI 처리가 완료되었습니다.");
            await fetchVideoData();
          }
        }
      }, 5000); // 5초마다 확인
      
      // 1분 후 자동으로 인터벌 종료 (최대 대기 시간)
      setTimeout(() => {
        clearInterval(checkInterval);
        if (isProcessing) {
          setIsProcessing(false);
          message.info("처리가 진행 중입니다. 새로고침 후 결과를 확인해주세요.");
        }
      }, 60000);
      
    } catch (err: any) {
      setIsProcessing(false);
      message.error(err.message || "영상 처리 요청 중 오류가 발생했습니다.");
      console.error("영상 처리 요청 중 오류:", err);
    }
  };

  // 비디오 데이터 및 채팅 기록 가져오기
  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }

    if (isLoggedIn) {
      // 채팅 기록 가져오기
      const fetchChatHistory = async () => {
        try {
          const response = await fetch(QA_ENDPOINTS.HISTORY(videoId), {
            headers: getAuthHeaders(),
            ...DEFAULT_FETCH_OPTIONS
          });
          
          if (response.ok) {
            const data = await response.json();
            // API 응답 형식에 맞게 변환
            const formattedHistory = data.map((item: any) => ([
              {
                id: item.id,
                content: item.question,
                sender: 'user',
                timestamp: new Date(item.created_at)
              },
              {
                id: item.id,
                content: item.answer,
                sender: 'ai',
                timestamp: new Date(item.created_at)
              }
            ])).flat();
            
            setMessages(formattedHistory);
          }
        } catch (err) {
          console.error("채팅 기록을 가져오는 중 오류 발생:", err);
        }
      };
      
      // 데이터 가져오기
      fetchVideoData();
      fetchChatHistory();
    }
  }, [videoId, router, isLoggedIn, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <Title level={2}>{videoData?.title || '영상 제목'}</Title>
        <Divider />

        {/* AI 처리 상태 표시 (버튼은 제거) */}
        {videoData && videoData.url.startsWith('static/') && (
          <div className="flex items-center mb-4">
            <div className="flex items-center space-x-2">
              <Text>처리 상태:</Text>
              <Badge 
                status={processingStatus?.is_processed ? "success" : "processing"} 
                text={processingStatus?.is_processed ? "완료" : (processingStatus?.error ? "오류" : "대기 중")}
              />
              {processingStatus?.has_transcript && (
                <Tooltip title="원본 자막 생성됨">
                  <CheckCircleOutlined style={{ color: 'green' }} />
                </Tooltip>
              )}
              {processingStatus?.has_translation && (
                <Tooltip title="번역 자막 생성됨">
                  <TranslationOutlined style={{ color: 'green' }} />
                </Tooltip>
              )}
              {processingStatus?.has_tts && (
                <Tooltip title="AI 음성 생성됨">
                  <SoundOutlined style={{ color: 'green' }} />
                </Tooltip>
              )}
            </div>
          </div>
        )}

        {/* 영상과 자막 영역 (나란히 배치) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* 영상 플레이어 */}
          <Card className="h-[350px]">
            {videoData?.url ? (
              videoData.url.startsWith('static/') ? (
                <video 
                  ref={videoRef}
                  src={getVideoSource(videoData.url)} 
                  controls 
                  className="w-full h-full" 
                  title={videoData.title}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  src={getVideoSource(videoData.url)}
                  className="w-full h-full border-0"
                  title={videoData.title}
                  allowFullScreen
                ></iframe>
              )
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-800 text-white">
                <p className="text-center">영상을 로드할 수 없습니다</p>
              </div>
            )}
          </Card>

          {/* 자막 영역 */}
          <Card
            title={
              <div className="flex justify-between items-center">
                <span>{selectedLanguage === 'ko' ? '한국어 자막' : '영어 자막'}</span>
                <Button
                  type="primary"
                  icon={<TranslationOutlined />}
                  onClick={toggleLanguage}
                >
                  {selectedLanguage === 'ko' ? '영어로 보기' : '한국어로 보기'}
                </Button>
              </div>
            }
            className="h-[350px] overflow-auto"
          >
            {selectedLanguage === 'ko' ? (
              transcripts.ko ? (
                <div className="transcript-container p-2">
                  {transcriptData?.ko?.length > 0 ? (
                    <div className="space-y-3">
                      {transcriptData.ko.map((segment: any, index: number) => (
                        <div key={index} className="transcript-segment">
                          <div className="flex items-start">
                            <span 
                              className="text-xs text-gray-500 mr-2 mt-1 w-12 flex-shrink-0 cursor-pointer hover:text-blue-500"
                              onClick={() => handleTimestampClick(segment.start)}
                              title="이 시간으로 이동"
                            >
                              {formatTimestamp(segment.start)}
                            </span>
                            <p className="text-base leading-relaxed flex-grow">{segment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Paragraph className="whitespace-pre-line text-base leading-relaxed">
                      {transcripts.ko}
                    </Paragraph>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                  <LoadingOutlined style={{ fontSize: 24, marginBottom: 16 }} spin />
                  <Text type="secondary">한국어 자막을 불러오는 중입니다...</Text>
                  <Text type="secondary" className="mt-2 text-xs">자막이 없는 경우 영상 AI 처리 버튼을 클릭하여 자막을 생성해주세요.</Text>
                </div>
              )
            ) : (
              transcripts.en ? (
                <div className="transcript-container p-2">
                  {transcriptData?.en?.length > 0 ? (
                    <div className="space-y-3">
                      {transcriptData.en.map((segment: any, index: number) => (
                        <div key={index} className="transcript-segment">
                          <div className="flex items-start">
                            <span 
                              className="text-xs text-gray-500 mr-2 mt-1 w-12 flex-shrink-0 cursor-pointer hover:text-blue-500"
                              onClick={() => handleTimestampClick(segment.start)}
                              title="이 시간으로 이동"
                            >
                              {formatTimestamp(segment.start)}
                            </span>
                            <p className="text-base leading-relaxed flex-grow">{segment.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Paragraph className="whitespace-pre-line text-base leading-relaxed">
                      {transcripts.en}
                    </Paragraph>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[250px] text-center">
                  <LoadingOutlined style={{ fontSize: 24, marginBottom: 16 }} spin />
                  <Text type="secondary">영어 자막을 불러오는 중입니다...</Text>
                  <Text type="secondary" className="mt-2 text-xs">자막이 없는 경우 영상 AI 처리 버튼을 클릭하여 자막을 생성해주세요.</Text>
                </div>
              )
            )}
          </Card>
        </div>

        {/* 오디오 플레이어 (파일 존재 시 무조건 표시) */}
        <Card title="AI 음성 재생" className="mb-6">
          <Tabs defaultActiveKey="ko">
            <TabPane tab="한국어 음성" key="ko">
              <div className="mb-4">
                <Text strong>한국어 TTS 음성:</Text>
                {processingStatus?.has_tts ? (
                  <Badge status="success" text="생성됨" className="ml-2" />
                ) : (
                  <Badge status="default" text="미생성" className="ml-2" />
                )}
              </div>
              <div>
                <audio
                  // 직접 static 폴더 경로 사용
                  src={`${API_BASE_URL}/static/audio/${videoId}/ko.mp3`}
                  controls
                  className="w-full"
                  preload="metadata"
                  autoPlay={false}
                  onLoadStart={() => console.log('한국어 오디오 로드 시작')}
                  onCanPlay={() => console.log('한국어 오디오 재생 가능')}
                  onError={(e) => {
                    console.error('한국어 오디오 로드 오류:', e);
                    message.error('한국어 오디오 파일을 로드할 수 없습니다.');
                  }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  * AI가 생성한 한국어 음성입니다. 로딩에 시간이 걸릴 수 있습니다.
                </div>
                <div className="mt-2">
                  <Text type="secondary">오디오 경로: /static/audio/{videoId}/ko.mp3</Text>
                </div>
              </div>
            </TabPane>
            <TabPane tab="영어 음성" key="en">
              <div className="mb-4">
                <Text strong>영어 TTS 음성:</Text>
                {processingStatus?.has_transcript ? (
                  <Badge status="success" text="생성됨" className="ml-2" />
                ) : (
                  <Badge status="default" text="미생성" className="ml-2" />
                )}
              </div>
              <div>
                <audio
                  // 직접 static 폴더 경로 사용
                  src={`${API_BASE_URL}/static/audio/${videoId}/en.mp3`}
                  controls
                  className="w-full"
                  preload="metadata"
                  autoPlay={false}
                  onLoadStart={() => console.log('영어 오디오 로드 시작')}
                  onCanPlay={() => console.log('영어 오디오 재생 가능')}
                  onError={(e) => {
                    console.error('영어 오디오 로드 오류:', e);
                    message.error('영어 오디오 파일을 로드할 수 없습니다.');
                  }}
                />
                <div className="mt-2 text-sm text-gray-500">
                  * AI가 생성한 영어 음성입니다. 로딩에 시간이 걸릴 수 있습니다.
                </div>
                <div className="mt-2">
                  <Text type="secondary">오디오 경로: /static/audio/{videoId}/en.mp3</Text>
                </div>
              </div>
            </TabPane>
            <TabPane tab="원본 음성" key="original">
              <div className="mb-4">
                <Text strong>원본 음성:</Text>
                <Badge status="processing" text="추출 중" className="ml-2" />
              </div>
              <div className="text-center py-4 bg-gray-50 rounded-md">
                <p>원본 음성은 현재 지원되지 않습니다. AI 처리를 통해 한국어 또는 영어 음성을 생성해주세요.</p>
                {!processingStatus?.is_processed && !isProcessing && (
                  <Button 
                    type="primary"
                    onClick={startVideoProcessing}
                    loading={isProcessing}
                    className="mt-2"
                  >
                    AI 처리 시작하기
                  </Button>
                )}
              </div>
            </TabPane>
          </Tabs>
          
          {/* AI 처리 버튼 표시 */}
          {!processingStatus?.is_processed && !isProcessing && (
            <div className="mt-4 text-center">
              <Button 
                type="primary" 
                icon={<RobotOutlined />} 
                onClick={startVideoProcessing}
                loading={isProcessing}
                size="large"
              >
                영상 AI 처리 시작하기
              </Button>
              <div className="mt-2 text-xs text-gray-500">
                * 영상 처리, 자막 생성, 음성 합성 등이 자동으로 진행됩니다 (약 1-2분 소요).
              </div>
            </div>
          )}

          {/* 처리 상태 표시 */}
          {isProcessing && (
            <div className="mt-4 text-center">
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <p className="mt-2">AI 처리 중입니다... 잠시만 기다려주세요.</p>
            </div>
          )}
        </Card>

        {/* 채팅 영역 */}
        <Card
          title="강의 내용 질문하기"
          className="flex-grow mt-4"
          style={{ minHeight: '300px' }}
        >
          <div className="flex flex-col h-full">
            <div className="flex-grow overflow-auto mb-4 max-h-[300px]">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 my-8">
                  <p>이 강의 내용에 대해 질문해보세요!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.sender === 'user'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <div
                          className={`text-xs mt-1 ${
                            msg.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {msg.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            <div className="mt-auto">
              <div className="flex">
                <TextArea
                  placeholder="질문을 입력하세요..."
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onPressEnter={e => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className="flex-grow mr-2"
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                  loading={chatLoading}
                >
                  전송
                </Button>
              </div>
              <Text type="secondary" className="text-xs mt-1">
                Enter 키를 누르면 전송됩니다. Shift+Enter로 줄바꿈.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
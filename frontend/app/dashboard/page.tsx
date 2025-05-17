'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Row, Col, Typography, Empty, Button, Spin, Alert, Badge, Tooltip, Modal, message } from 'antd';
import { VIDEO_ENDPOINTS, getAuthHeaders, DEFAULT_FETCH_OPTIONS } from '@/lib/api/config';
import { PlayCircleOutlined, RobotOutlined, SoundOutlined, TranslationOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Video {
  id: number;
  title: string;
  thumbnail_url: string;
  created_at: string;
  url: string;
  is_processed?: boolean;
}

interface VideoStatus {
  is_processed: boolean;
  error: string | null;
  has_transcript: boolean;
  has_translation: boolean;
  has_tts: boolean;
}

export default function DashboardPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingVideos, setProcessingVideos] = useState<{[key: string]: boolean}>({});
  const [videoStatuses, setVideoStatuses] = useState<{[key: string]: VideoStatus}>({});
  
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  
  useEffect(() => {
    // 로그인 상태 확인
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    
    if (isLoggedIn) {
      // 내 영상 목록 가져오기
      const fetchMyVideos = async () => {
        try {
          const response = await fetch(VIDEO_ENDPOINTS.MY_VIDEOS, {
            headers: getAuthHeaders(),
            ...DEFAULT_FETCH_OPTIONS
          });
          
          if (!response.ok) {
            throw new Error("영상 목록을 가져올 수 없습니다.");
          }
          
          const data = await response.json();
          setVideos(data);
          
          // 각 비디오의 처리 상태 가져오기 (정적 파일만)
          const statuses: {[key: string]: VideoStatus} = {};
          for (const video of data) {
            if (video.url && video.url.startsWith('static/')) {
              try {
                const statusResponse = await fetch(VIDEO_ENDPOINTS.VIDEO_STATUS(video.id), {
                  headers: getAuthHeaders(),
                  ...DEFAULT_FETCH_OPTIONS
                });
                
                if (statusResponse.ok) {
                  const statusData = await statusResponse.json();
                  statuses[video.id] = statusData;
                }
              } catch (err) {
                console.error(`Failed to fetch status for video ${video.id}:`, err);
              }
            }
          }
          
          setVideoStatuses(statuses);
        } catch (err: any) {
          setError(err.message || "오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
      };
      
      fetchMyVideos();
    }
  }, [router, isLoggedIn, authLoading]);
  
  // 비디오 AI 처리 시작
  const startVideoProcessing = async (videoId: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
    
    try {
      setProcessingVideos(prev => ({ ...prev, [videoId]: true }));
      
      const response = await fetch(VIDEO_ENDPOINTS.PROCESS_VIDEO(videoId.toString()), {
        method: 'POST',
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (!response.ok) {
        throw new Error("영상 처리 요청에 실패했습니다.");
      }
      
      const data = await response.json();
      message.success("영상 AI 처리가 시작되었습니다. 완료까지 몇 분 소요될 수 있습니다.");
      
      // 상태 확인 인터벌 시작 (5초마다)
      const checkInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(VIDEO_ENDPOINTS.VIDEO_STATUS(videoId.toString()), {
            headers: getAuthHeaders(),
            ...DEFAULT_FETCH_OPTIONS
          });
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            setVideoStatuses(prev => ({ ...prev, [videoId]: statusData }));
            
            // 처리가 완료되었거나 에러가 발생한 경우 인터벌 종료
            if (statusData.is_processed || statusData.error) {
              clearInterval(checkInterval);
              setProcessingVideos(prev => ({ ...prev, [videoId]: false }));
              
              if (statusData.error) {
                message.error(`AI 처리 중 오류가 발생했습니다: ${statusData.error}`);
              } else if (statusData.is_processed) {
                message.success("영상 AI 처리가 완료되었습니다.");
              }
            }
          }
        } catch (err) {
          console.error("AI 처리 상태 확인 중 오류 발생:", err);
        }
      }, 5000);
      
      // 1분 후 자동으로 인터벌 종료 (최대 대기 시간)
      setTimeout(() => {
        clearInterval(checkInterval);
        if (processingVideos[videoId]) {
          setProcessingVideos(prev => ({ ...prev, [videoId]: false }));
          message.info("처리가 진행 중입니다. 새로고침 후 결과를 확인해주세요.");
        }
      }, 60000);
      
    } catch (err: any) {
      setProcessingVideos(prev => ({ ...prev, [videoId]: false }));
      message.error(err.message || "영상 처리 요청 중 오류가 발생했습니다.");
    }
  };
  
  // 날짜 형식 변환 함수
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  
  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }
  
  if (!isLoggedIn) {
    return null;
  }
  
  const content = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      );
    }
    
    if (error) {
      return (
        <Alert type="error" message={error} className="mb-4" />
      );
    }
    
    if (videos.length === 0) {
      return (
        <Empty
          description="아직 추가한 영상이 없습니다."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => router.push('/video')}>
            첫 영상 추가하기
          </Button>
        </Empty>
      );
    }
    
    return (
      <Row gutter={[16, 16]}>
        {videos.map(video => (
          <Col key={video.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              cover={
                video.thumbnail_url ? (
                  <img 
                    alt={video.title} 
                    src={video.thumbnail_url}
                    className="aspect-video object-cover" 
                  />
                ) : (
                  <div className="aspect-video bg-gray-200 flex items-center justify-center text-gray-500">
                    No Thumbnail
                  </div>
                )
              }
              onClick={() => router.push(`/study/${video.id}`)}
              actions={
                video.url && video.url.startsWith('static/') 
                  ? [
                      <Button 
                        key="play" 
                        type="link" 
                        icon={<PlayCircleOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/study/${video.id}`);
                        }}
                      >
                        보기
                      </Button>,
                      <Button
                        key="process"
                        type="link"
                        icon={<RobotOutlined />}
                        loading={processingVideos[video.id]}
                        disabled={videoStatuses[video.id]?.is_processed || processingVideos[video.id]}
                        onClick={(e) => startVideoProcessing(video.id, e)}
                      >
                        {processingVideos[video.id] ? "처리 중..." : 
                          (videoStatuses[video.id]?.is_processed ? "처리 완료" : "AI 변환")}
                      </Button>
                    ]
                  : undefined
              }
            >
              <Card.Meta
                title={video.title}
                description={
                  <div>
                    <div>{formatDate(video.created_at)}</div>
                    {video.url && video.url.startsWith('static/') && videoStatuses[video.id] && (
                      <div className="mt-2 flex items-center space-x-2">
                        {videoStatuses[video.id].has_transcript && (
                          <Tooltip title="원본 자막 생성됨">
                            <CheckCircleOutlined style={{ color: 'green' }} />
                          </Tooltip>
                        )}
                        {videoStatuses[video.id].has_translation && (
                          <Tooltip title="번역 자막 생성됨">
                            <TranslationOutlined style={{ color: 'green' }} />
                          </Tooltip>
                        )}
                        {videoStatuses[video.id].has_tts && (
                          <Tooltip title="AI 음성 생성됨">
                            <SoundOutlined style={{ color: 'green' }} />
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    );
  };
  
  return (
    <MainLayout>
      <div>
        <div className="flex justify-between items-center mb-6">
          <Title level={2}>내 학습 영상</Title>
          <Button type="primary" onClick={() => router.push('/video')}>
            새 영상 추가
          </Button>
        </div>
        
        {content()}
      </div>
    </MainLayout>
  );
} 
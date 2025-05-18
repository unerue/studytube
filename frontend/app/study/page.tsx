'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Row, Col, Typography, Spin, Alert, List, Avatar } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { VIDEO_ENDPOINTS, getAuthHeaders, DEFAULT_FETCH_OPTIONS } from '@/lib/api/config';

const { Title } = Typography;

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  duration: string;
  description?: string;
  created_at?: string;
}

export default function StudyPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const { isLoggedIn, loading: authLoading } = useAuth();
  
  useEffect(() => {
    // 로그인 상태 확인
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    
    if (isLoggedIn) {
      // 학습 영상 목록 가져오기
      const fetchVideos = async () => {
        try {
          // 백엔드 API URL - 모든 학습 영상 목록을 가져오는 엔드포인트
          const response = await fetch(VIDEO_ENDPOINTS.AVAILABLE_VIDEOS, {
            headers: getAuthHeaders(),
            ...DEFAULT_FETCH_OPTIONS
          });
          
          if (!response.ok) {
            throw new Error("영상 목록을 가져올 수 없습니다.");
          }
          
          const data = await response.json();
          setVideos(data);
        } catch (err: any) {
          setError(err.message || "오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
      };
      
      fetchVideos();
    }
  }, [router, isLoggedIn, authLoading]);
  
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
  
  const handleVideoSelect = (videoId: string) => {
    router.push(`/study/${videoId}`);
  };
  
  // 영상 재생 시간 형식화 함수 (백엔드에서 초 단위로 제공한다고 가정)
  const formatDuration = (seconds: number) => {
    if (!seconds) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  return (
    <MainLayout>
      <div>
        <Title level={2} className="mb-6">학습 영상 목록</Title>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : error ? (
          <Alert type="error" message={error} className="mb-4" />
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={videos}
            renderItem={(video) => (
              <List.Item 
                className="cursor-pointer hover:bg-gray-50 transition-colors rounded-md p-2"
                onClick={() => handleVideoSelect(video.id)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar 
                      shape="square" 
                      size={64} 
                      src={video.thumbnail_url
                        ? (video.thumbnail_url.startsWith('http')
                            ? video.thumbnail_url
                            : `${API_BASE_URL}/${video.thumbnail_url}`)
                        : undefined}
                      icon={<PlayCircleOutlined />} 
                    />
                  }
                  title={video.title}
                  description={
                    <>
                      <div>{video.description?.substring(0, 100)}{video.description && video.description.length > 100 ? '...' : ''}</div>
                      <div className="text-gray-500 mt-1">재생 시간: {video.duration || "알 수 없음"}</div>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </MainLayout>
  );
} 
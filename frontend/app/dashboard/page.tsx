'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Video {
  id: number;
  title: string;
  thumbnail_url: string;
  created_at: string;
}

export default function DashboardPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  
  useEffect(() => {
    // 로그인 상태 확인
    const token = localStorage.getItem('access_token');
    setIsLoggedIn(!!token);
    
    if (!token) {
      router.push('/login');
      return;
    }
    
    // 내 영상 목록 가져오기
    async function fetchMyVideos() {
      try {
        const response = await fetch("http://localhost:8000/videos/my", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
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
    }
    
    fetchMyVideos();
  }, [router]);
  
  // 날짜 형식 변환 함수
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };
  
  if (!isLoggedIn) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow py-4 px-6">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-700">내 학습 영상</h1>
          
          <div>
            <Link href="/video" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              새 영상 추가
            </Link>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4 md:p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <p className="text-xl">로딩 중...</p>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-white p-6 rounded-lg shadow text-center">
            <p className="text-lg text-gray-600 mb-6">아직 추가한 영상이 없습니다.</p>
            <Link href="/video" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
              첫 영상 추가하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map(video => (
              <Link key={video.id} href={`/study/${video.id}`}>
                <div className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gray-200">
                    {video.thumbnail_url ? (
                      <img 
                        src={video.thumbnail_url} 
                        alt={video.title} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        No Thumbnail
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h2 className="font-semibold text-lg mb-2 line-clamp-2">{video.title}</h2>
                    <p className="text-sm text-gray-500">{formatDate(video.created_at)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
} 
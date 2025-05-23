'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import VideoForm from '@/components/video/VideoForm';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function VideoPage() {
  const router = useRouter();
  const { isLoggedIn, loading } = useAuth();
  
  useEffect(() => {
    // 로그인 상태가 아니면 로그인 페이지로 리다이렉트
    if (!loading && !isLoggedIn) {
      router.push('/login');
    }
  }, [isLoggedIn, loading, router]);
  
  // 로딩 중이거나 로그인 상태가 아니면 아무것도 표시하지 않음
  if (loading || !isLoggedIn) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex flex-col items-center p-8">
      <h1 className="text-3xl font-bold mb-8 text-blue-700">StudyTube</h1>
      
      <VideoForm />
      
      <div className="mt-12 text-center">
        <p className="text-gray-600 mb-4">
          이전에 분석한 영상을 보고 싶으신가요?
        </p>
        <Link href="/dashboard" className="text-blue-500 hover:text-blue-700">
          내 영상 대시보드로 가기
        </Link>
      </div>
    </div>
  );
} 
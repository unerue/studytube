'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-white">
      <div className="text-center px-6">
        <h1 className="text-4xl font-bold text-blue-700 mb-6">StudyTube에 오신 것을 환영합니다!</h1>
        <p className="text-xl text-gray-700 mb-12">AI와 함께 유튜브로 쉽고 재미있게 학습하세요.</p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {isLoggedIn ? (
            <>
              <Link href="/video" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">
                영상 분석하기
              </Link>
              <Link href="/dashboard" className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">
                내 영상 보기
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg">
                로그인
              </Link>
              <Link href="/register" className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
} 
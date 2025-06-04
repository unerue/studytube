'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

export default function Home() {
  const { isLoggedIn } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-white">
      <div className="text-center px-6">
        <h1 className="text-4xl font-bold text-blue-700 mb-6">StudyTube에 오신 것을 환영합니다!</h1>
        <p className="text-xl text-gray-700 mb-12">AI와 함께 유튜브로 쉽고 재미있게 학습하고, 실시간 강의를 진행하세요.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {isLoggedIn ? (
            <>
              <Link href="/video" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">📹</div>
                  <div>영상 분석하기</div>
                </div>
              </Link>
              <Link href="/lectures" className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">🎓</div>
                  <div>실시간 강의</div>
                </div>
              </Link>
              <Link href="/dashboard" className="bg-green-500 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">📊</div>
                  <div>내 영상 보기</div>
                </div>
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">🔑</div>
                  <div>로그인</div>
                </div>
              </Link>
              <Link href="/register" className="bg-green-500 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">📝</div>
                  <div>회원가입</div>
                </div>
              </Link>
              <Link href="/lectures" className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-4 px-6 rounded-lg transition-colors">
                <div className="text-center">
                  <div className="text-2xl mb-2">🎓</div>
                  <div>실시간 강의 (체험)</div>
                </div>
              </Link>
            </>
          )}
        </div>

        {/* 기능 소개 */}
        <div className="mt-16 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-8">주요 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4 text-center">🤖</div>
              <h3 className="text-lg font-semibold mb-2">AI 영상 분석</h3>
              <p className="text-gray-600">유튜브 영상을 AI가 분석하여 학습 요약본과 퀴즈를 자동 생성합니다.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4 text-center">🌍</div>
              <h3 className="text-lg font-semibold mb-2">실시간 번역 강의</h3>
              <p className="text-gray-600">한국어 강의를 실시간으로 다국어 자막으로 번역하여 글로벌 학습을 지원합니다.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-3xl mb-4 text-center">💻</div>
              <h3 className="text-lg font-semibold mb-2">PPT 화면 공유</h3>
              <p className="text-gray-600">강사의 PPT를 실시간으로 공유하고 학생들과 동기화된 학습 환경을 제공합니다.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 
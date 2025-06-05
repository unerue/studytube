'use client';

import { Button, Typography } from 'antd';
import { 
  UserOutlined,
  ArrowRightOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';

const { Title, Paragraph } = Typography;

export default function LandingPage() {
  const { isLoggedIn, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserOutlined className="text-3xl text-white" />
          </div>
          <Paragraph className="text-lg text-gray-600">로딩 중...</Paragraph>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        {/* 로고 및 제목 */}
        <div className="mb-12">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserOutlined className="text-3xl text-white" />
          </div>
          <Title level={1} className="text-gray-800 mb-4">
            StudyTube
          </Title>
          <Paragraph className="text-lg text-gray-600 leading-relaxed">
            AI 기반 실시간 다국어 강의 플랫폼
          </Paragraph>
        </div>

        {/* 인증 상태에 따른 버튼 */}
        <div className="space-y-4">
          {isLoggedIn ? (
            <>
              <Paragraph className="text-green-600 mb-4">
                안녕하세요, {user?.username || user?.email}님! 👋
              </Paragraph>
              <Link href="/dashboard">
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<DashboardOutlined />}
                  className="w-full h-12 text-lg font-semibold"
                >
                  대시보드로 이동
                </Button>
              </Link>
              <div className="pt-4 space-y-2">
                <div>
                  <Link href="/study" className="text-blue-500 hover:text-blue-700 mr-4">
                    스터디 시작
                  </Link>
                  <Link href="/lectures" className="text-blue-500 hover:text-blue-700">
                    강의 목록
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button 
                  type="primary" 
                  size="large" 
                  icon={<ArrowRightOutlined />}
                  className="w-full h-12 text-lg font-semibold"
                >
                  로그인하여 시작하기
                </Button>
              </Link>
              
              <Paragraph className="text-sm text-gray-500">
                계정이 없으신가요?{' '}
                <Link href="/register" className="text-blue-500 hover:text-blue-700">
                  회원가입
                </Link>
              </Paragraph>
            </>
          )}
        </div>

        {/* 간단한 특징 */}
        <div className="mt-16 pt-8 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl mb-2">🌐</div>
              <div className="text-xs text-gray-600">실시간 번역</div>
            </div>
            <div>
              <div className="text-2xl mb-2">🖥️</div>
              <div className="text-xs text-gray-600">화면 공유</div>
            </div>
            <div>
              <div className="text-2xl mb-2">💬</div>
              <div className="text-xs text-gray-600">실시간 채팅</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
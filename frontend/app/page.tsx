'use client';

import { Button, Typography, Spin, Alert } from 'antd';
import {
  UserOutlined,
  ArrowRightOutlined,
  DashboardOutlined,
  WarningOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api/config';

const { Title, Paragraph } = Typography;

export default function LandingPage() {
  const { isLoggedIn, user, loading, error } = useAuth();
  const [serverCheckFailed, setServerCheckFailed] = useState(false);
  const [serverCheckLoading, setServerCheckLoading] = useState(true);
  const [serverResponseText, setServerResponseText] = useState<string | null>(null);

  // 백엔드 서버 연결 확인
  const checkServerConnection = async () => {
    setServerCheckLoading(true);
    try {
      console.log('서버 연결 확인 시도:', `${API_BASE_URL}/`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${API_BASE_URL}/`, { 
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      setServerResponseText(responseText);
      
      console.log('백엔드 서버 응답 상태:', response.status);
      console.log('백엔드 서버 응답 본문:', responseText);
      console.log('백엔드 서버 응답 헤더:', Object.fromEntries([...response.headers.entries()]));
      
      if (response.ok) {
        setServerCheckFailed(false);
        console.log('백엔드 서버 연결 성공');
      } else {
        setServerCheckFailed(true);
        console.error('백엔드 서버 응답 오류:', response.status);
      }
    } catch (err) {
      console.error('백엔드 서버 연결 실패:', err);
      setServerCheckFailed(true);
      setServerResponseText(err instanceof Error ? err.message : String(err));
    } finally {
      setServerCheckLoading(false);
    }
  };

  // 서버 연결 확인
  useEffect(() => {
    checkServerConnection();
  }, []);

  if (loading || serverCheckLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <UserOutlined className="text-3xl text-white" />
          </div>
          <Spin size="large" />
          <Paragraph className="text-lg text-gray-600 mt-4">로딩 중...</Paragraph>
        </div>
      </div>
    );
  }

  if (serverCheckFailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <WarningOutlined className="text-3xl text-red-500" />
          </div>
          <Title level={2} className="text-gray-800 mb-4">
            서버 연결 오류
          </Title>
          <Alert
            message="백엔드 서버에 연결할 수 없습니다"
            description={
              <>
                <p>백엔드 서버가 실행 중인지 확인하세요. 서버가 실행 중이라면 브라우저 콘솔에서 CORS 오류가 있는지 확인하세요.</p>
                {serverResponseText && (
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-left overflow-auto max-h-24">
                    <code>{serverResponseText}</code>
                  </div>
                )}
                <p className="mt-2">서버 URL: {API_BASE_URL}</p>
              </>
            }
            type="error"
            showIcon
            className="mb-6"
          />
          <Button 
            type="primary" 
            icon={<ReloadOutlined />}
            onClick={checkServerConnection}
            size="large"
          >
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Alert
            message="인증 오류"
            description={error}
            type="error"
            showIcon
            className="mb-6"
          />
          <div className="space-y-4">
            <Link href="/login">
              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                className="w-full"
              >
                로그인 페이지로 이동
              </Button>
            </Link>
          </div>
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
                  <Link href="/lectures" className="text-blue-500 hover:text-blue-700 mr-4">
                    강의 목록
                  </Link>
                  <Link href="/profile" className="text-blue-500 hover:text-blue-700">
                    내 프로필
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

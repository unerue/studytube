'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spin, message } from 'antd';
import { useAuth } from '@/lib/context/AuthContext';
import LiveLectureRoom from '@/components/lecture/LiveLectureRoom';
import { lectureService } from '@/lib/api/lectures';
import { Lecture } from '@/types/lecture';

export default function LectureRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { isLoggedIn, user, loading: authLoading } = useAuth();
  const lectureId = params.id as string;
  
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [userRole, setUserRole] = useState<'instructor' | 'student'>('student');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 인증이 완료되지 않았으면 대기
    if (authLoading) return;
    
    // 로그인하지 않은 사용자는 로그인 페이지로 리디렉션
    if (!isLoggedIn) {
      message.warning('로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    // 강의 정보 로드
    loadLectureData();
  }, [lectureId, authLoading, isLoggedIn, router]);

  const loadLectureData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 실제 API에서 강의 정보 가져오기
      const lectureData = await lectureService.getLecture(lectureId);
      setLecture(lectureData);
      
      // 사용자 역할 결정
      determineUserRole(lectureData);
      
    } catch (error) {
      console.error('강의 정보 로드 실패:', error);
      setError('강의 정보를 불러오는데 실패했습니다.');
      message.error('강의 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const determineUserRole = (lectureData: Lecture) => {
    // 사용자가 강의 강사인지 확인 (최우선)
    if (user && lectureData.instructor_id === user.id) {
      setUserRole('instructor');
      return;
    }
    
    // 사용자 정보에서 역할 확인
    if (user?.role === 'instructor') {
      setUserRole('instructor');
      return;
    }
    
    // 기본값은 학생
    setUserRole('student');
  };

  // 권한 체크 함수
  const hasLectureAccess = () => {
    if (!lecture || !user) return false;
    
    // 강사인 경우: 모든 강의에 접근 가능 (본인 강의가 아니어도 참관 가능)
    if (user.role === 'instructor') {
      return true;
    }
    
    // 학생인 경우: 진행 중이거나 예정된 강의만 접근 가능
    if (user.role === 'student') {
      return lecture.status === 'live' || lecture.status === 'scheduled';
    }
    
    return false;
  };

  // 로딩 중
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 grid place-items-center p-4">
        <div className="grid gap-6 text-center text-white max-w-md mx-auto">
          <div className="grid place-items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-600/20 backdrop-blur-sm grid place-items-center">
              <Spin size="large" className="text-blue-400" />
            </div>
            <div className="grid gap-2">
              <h2 className="text-xl font-semibold">강의실 준비 중</h2>
              <p className="text-gray-300">잠시만 기다려주세요...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 에러 발생
  if (error && !lecture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900/20 via-gray-900 to-red-900/20 grid place-items-center p-4">
        <div className="grid gap-8 text-center max-w-md mx-auto">
          <div className="grid place-items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-red-500/20 backdrop-blur-sm grid place-items-center">
              <span className="text-4xl">❌</span>
            </div>
            <div className="grid gap-3 text-white">
              <h1 className="text-2xl font-bold">오류가 발생했습니다</h1>
              <p className="text-red-300 font-medium">{error}</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            강의 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 강의를 찾을 수 없음
  if (!lecture) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-900/20 via-gray-900 to-yellow-900/20 grid place-items-center p-4">
        <div className="grid gap-8 text-center max-w-md mx-auto">
          <div className="grid place-items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-yellow-500/20 backdrop-blur-sm grid place-items-center">
              <span className="text-4xl">🔍</span>
            </div>
            <div className="grid gap-3 text-white">
              <h1 className="text-2xl font-bold">강의를 찾을 수 없습니다</h1>
              <div className="grid gap-1">
                <p className="text-yellow-300">존재하지 않는 강의입니다</p>
                <code className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                  강의 ID: {lectureId}
                </code>
              </div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            강의 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 접근 권한 없음
  if (!hasLectureAccess()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-900/20 via-gray-900 to-orange-900/20 grid place-items-center p-4">
        <div className="grid gap-8 text-center max-w-md mx-auto">
          <div className="grid place-items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-orange-500/20 backdrop-blur-sm grid place-items-center">
              <span className="text-4xl">🔒</span>
            </div>
            <div className="grid gap-3 text-white">
              <h1 className="text-2xl font-bold">접근 권한이 없습니다</h1>
              <div className="grid gap-2">
                <p className="text-orange-300 font-medium">
                  {userRole === 'student' && lecture.status === 'ended' 
                    ? '이미 종료된 강의입니다.'
                    : '이 강의에 참여할 권한이 없습니다.'
                  }
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 bg-gray-800/50 rounded-lg p-3">
                  <div>역할: <span className="text-blue-300">{userRole}</span></div>
                  <div>상태: <span className="text-green-300">{lecture.status}</span></div>
                </div>
              </div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl"
          >
            강의 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 강의실 렌더링 - MainLayout 없이 전체 화면 사용
  return (
    <div className="h-screen w-screen overflow-hidden">
      <LiveLectureRoom
        lectureId={lecture.id.toString()}
        lectureTitle={lecture.title}
        userRole={userRole}
        participantCount={lecture.participant_count}
      />
    </div>
  );
} 
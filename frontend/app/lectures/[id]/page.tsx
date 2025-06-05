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
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Spin size="large" className="mb-4" />
          <div>강의실에 입장하고 있습니다...</div>
        </div>
      </div>
    );
  }

  // 에러 발생
  if (error && !lecture) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 text-6xl mb-4">❌</div>
          <div className="text-xl mb-2">오류가 발생했습니다</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
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
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-red-400 text-6xl mb-4">🔍</div>
          <div className="text-xl mb-2">강의를 찾을 수 없습니다</div>
          <div className="text-gray-400 mb-4">
            강의 ID: {lectureId}
          </div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
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
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-yellow-400 text-6xl mb-4">🔒</div>
          <div className="text-xl mb-2">접근 권한이 없습니다</div>
          <div className="text-gray-400 mb-4">
            {userRole === 'student' && lecture.status === 'ended' 
              ? '이미 종료된 강의입니다.'
              : '이 강의에 참여할 권한이 없습니다.'
            }
          </div>
          <button 
            onClick={() => router.push('/lectures/new')}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            강의 목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  // 강의실 렌더링
  return (
    <LiveLectureRoom
      lectureId={lecture.id.toString()}
      lectureTitle={lecture.title}
      userRole={userRole}
      participantCount={lecture.participant_count}
    />
  );
} 
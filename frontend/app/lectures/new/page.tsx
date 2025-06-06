'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Row, Col, Spin, message, Typography, Space, Empty, Statistic, Divider } from 'antd';
import { VideoCameraOutlined, UserOutlined, CalendarOutlined, PlayCircleOutlined, PlusOutlined, BookOutlined, TeamOutlined, DesktopOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { getAuthHeaders, DEFAULT_FETCH_OPTIONS } from '@/lib/api/config';

const { Title, Text } = Typography;

interface Lecture {
  id: number;
  title: string;
  description: string;
  scheduled_start: string;
  status: string;
  participant_count: number;
  instructor_name?: string;
}

export default function NewLecturePage() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // 로그인 상태 확인
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    
    if (isLoggedIn) {
      fetchLectures();
    }
  }, [router, isLoggedIn, authLoading]);

  // 실제 API에서 강의 목록 가져오기 (대시보드와 동일)
  const fetchLectures = async () => {
    try {
      setLoading(true);
      const lecturesResponse = await fetch('http://localhost:8000/lectures/', {
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (lecturesResponse.ok) {
        const lecturesData = await lecturesResponse.json();
        setLectures(lecturesData);
      } else {
        throw new Error('강의 목록을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('강의 목록 로드 실패:', err);
      setError(err.message || "오류가 발생했습니다.");
      message.error('강의 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLectureStatusColor = (status: string): "error" | "default" | "success" | "warning" | "processing" => {
    switch (status) {
      case 'live':
        return "processing";
      case 'scheduled':
        return "default";
      case 'ended':
        return "success";
      default:
        return "default";
    }
  };

  const handleJoinLecture = async (lectureId: number) => {
    // 로그인 상태 확인
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      message.warning('강의에 참여하려면 로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    try {
      message.success('강의실에 입장합니다...');
      // 강의실 페이지로 이동 - 실제 강의 ID 사용
      router.push(`/lectures/${lectureId}`);
    } catch (error) {
      console.error('Failed to join lecture:', error);
      message.error('강의 참가에 실패했습니다.');
    }
  };

  // 강사용 인터페이스
  const InstructorInterface = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>👨‍🏫 실시간 강의 관리</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/lectures/create')}>
          새 강의 개설
        </Button>
      </div>

      {/* 강사 통계 */}
      <Row gutter={16} className="mb-8">
        <Col span={6}>
          <Card className="text-center border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <Statistic 
              title="총 강의 수" 
              value={lectures.length} 
              prefix={<BookOutlined className="text-blue-500" />} 
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border border-green-200 bg-gradient-to-br from-green-50 to-green-100">
            <Statistic 
              title="진행 중 강의" 
              value={lectures.filter(l => l.status === 'live').length} 
              prefix={<VideoCameraOutlined className="text-green-500" />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <Statistic 
              title="예정된 강의" 
              value={lectures.filter(l => l.status === 'scheduled').length} 
              prefix={<DesktopOutlined className="text-purple-500" />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
            <Statistic 
              title="총 참가자" 
              value={lectures.reduce((sum, l) => sum + l.participant_count, 0)} 
              prefix={<TeamOutlined className="text-orange-500" />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 빠른 액션 */}
      <Row gutter={16} className="mb-8">
        <Col span={8}>
          <Link href="/lectures/create">
            <Card 
              hoverable 
              className="text-center h-32 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div>
                <PlusOutlined className="text-3xl mb-2" />
                <div className="font-semibold text-lg">새 강의 생성</div>
                <Text className="text-indigo-100 text-sm">실시간 강의 시작</Text>
              </div>
            </Card>
          </Link>
        </Col>
        <Col span={8}>
          <Link href="/lectures/demo">
            <Card 
              hoverable 
              className="text-center h-32 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div>
                <VideoCameraOutlined className="text-3xl mb-2" />
                <div className="font-semibold text-lg">데모 강의실</div>
                <Text className="text-emerald-100 text-sm">테스트용 강의실</Text>
              </div>
            </Card>
          </Link>
        </Col>
        <Col span={8}>
          <Link href="/dashboard">
            <Card 
              hoverable 
              className="text-center h-32 flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white border-0 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
            >
              <div>
                <BookOutlined className="text-3xl mb-2" />
                <div className="font-semibold text-lg">대시보드</div>
                <Text className="text-rose-100 text-sm">전체 강의 관리</Text>
              </div>
            </Card>
          </Link>
        </Col>
      </Row>

      <Divider />

      {/* 강의 목록 */}
      <Title level={3}>내 강의 목록</Title>
      {renderLectureList()}
    </div>
  );

  // 학생용 인터페이스
  const StudentInterface = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>👨‍🎓 실시간 강의 참여</Title>
        <Button type="primary" onClick={() => router.push('/dashboard')}>
          대시보드로 이동
        </Button>
      </div>

      {/* 진행 중인 강의 강조 */}
      {lectures.filter(l => l.status === 'live').length > 0 && (
        <>
          <div className="bg-gradient-to-r from-red-500 to-pink-600 rounded-xl p-6 mb-8 text-white">
            <Title level={3} className="text-white mb-4">🔴 지금 진행 중인 강의</Title>
            <Text className="text-red-100 mb-4 block">
              실시간으로 진행되고 있는 강의에 바로 참여하세요!
            </Text>
            <Row gutter={[16, 16]}>
              {lectures.filter(l => l.status === 'live').map(lecture => (
                <Col key={lecture.id} xs={24} sm={12} md={8}>
                  <Card
                    className="bg-white/10 backdrop-blur-sm border-white/20 text-white"
                    actions={[
                      <Button 
                        key="join" 
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleJoinLecture(lecture.id)}
                        className="w-full mx-3"
                        size="large"
                        danger
                      >
                        지금 참여하기
                      </Button>
                    ]}
                  >
                    <div className="space-y-2">
                      <Title level={5} className="text-white mb-2">
                        {lecture.title}
                      </Title>
                      <Text className="text-red-100 text-sm block">
                        {lecture.description}
                      </Text>
                      <div className="flex items-center justify-between mt-3">
                        <Text className="text-red-100 text-sm">
                          참가자: {lecture.participant_count}명
                        </Text>
                        <div className="flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
          <Divider />
        </>
      )}

      {/* 전체 강의 목록 */}
      <Title level={3}>📚 수강 가능한 강의</Title>
      {renderLectureList()}
    </div>
  );

  // 강의 목록 렌더링 (공통)
  const renderLectureList = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <Space direction="vertical" align="center" size="large">
            <Spin size="large" />
            <Text className="text-gray-600">강의 목록을 불러오는 중...</Text>
          </Space>
        </div>
      );
    }

    if (lectures.length === 0) {
      return (
        <Empty
          description={user?.role === 'instructor' ? "아직 개설한 강의가 없습니다." : "수강 가능한 강의가 없습니다."}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {user?.role === 'instructor' ? (
            <Button type="primary" onClick={() => router.push('/lectures/create')}>
              첫 강의 개설하기
            </Button>
          ) : (
            <Button type="primary" onClick={() => router.push('/dashboard')}>
              강의 찾아보기
            </Button>
          )}
        </Empty>
      );
    }

    return (
      <Row gutter={[16, 16]}>
        {lectures.map(lecture => (
          <Col key={lecture.id} xs={24} sm={12} md={8}>
            <Card
              hoverable
              className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl"
              cover={
                <div className={`h-32 flex items-center justify-center relative ${
                  lecture.status === 'live' 
                    ? 'bg-gradient-to-br from-red-500 to-pink-600' 
                    : lecture.status === 'scheduled'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                    : 'bg-gradient-to-br from-gray-400 to-gray-600'
                }`}>
                  <VideoCameraOutlined className="text-4xl text-white opacity-80" />
                  {lecture.status === 'live' && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>
                  )}
                  {lecture.status === 'scheduled' && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                      <CalendarOutlined className="text-xs" />
                      예정
                    </div>
                  )}
                </div>
              }
              actions={[
                <Button 
                  key="join" 
                  type={lecture.status === 'live' ? 'primary' : 'default'}
                  icon={<PlayCircleOutlined />}
                  disabled={lecture.status === 'ended'}
                  onClick={() => handleJoinLecture(lecture.id)}
                  className="w-full mx-3 shadow-sm"
                  size="large"
                  danger={lecture.status === 'live'}
                >
                  {lecture.status === 'live' ? '지금 참여' : 
                   lecture.status === 'scheduled' ? '대기실 입장' : 
                   user?.role === 'instructor' ? '강의실 입장' : '다시보기'}
                </Button>
              ]}
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <Title level={5} className="line-clamp-2 mb-2 text-gray-900">
                    {lecture.title}
                  </Title>
                  <Badge status={getLectureStatusColor(lecture.status)} text={lecture.status} />
                </div>
                
                <Text className="text-gray-600 text-sm line-clamp-2 block">
                  {lecture.description}
                </Text>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>시작: {formatDate(lecture.scheduled_start)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text className={`font-medium text-sm ${
                      lecture.status === 'live' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      참가자: {lecture.participant_count}명
                      {lecture.status === 'live' && ' 실시간 참여 중'}
                    </Text>
                    {lecture.instructor_name && (
                      <Text className="text-gray-500 text-xs">
                        <UserOutlined className="mr-1" />
                        {lecture.instructor_name}
                      </Text>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    );
  };

  if (authLoading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-screen">
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {user?.role === 'instructor' ? <InstructorInterface /> : <StudentInterface />}
        </div>
      </div>
    </MainLayout>
  );
} 
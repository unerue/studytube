'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Row, Col, Typography, Empty, Button, Spin, Alert, Badge, Tooltip, Modal, message, Statistic, Divider } from 'antd';
import { getAuthHeaders, DEFAULT_FETCH_OPTIONS } from '@/lib/api/config';
import { PlayCircleOutlined, PlusOutlined, TeamOutlined, VideoCameraOutlined, BookOutlined, DesktopOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Lecture {
  id: number;
  title: string;
  description: string;
  scheduled_start: string;
  status: string;
  participant_count: number;
}

export default function DashboardPage() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [lecturesLoading, setLecturesLoading] = useState(true);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const { isLoggedIn, loading: authLoading, user } = useAuth();
  
  useEffect(() => {
    // 로그인 상태 확인
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
      return;
    }
    
    if (isLoggedIn) {
      // 사용자 역할에 따라 다른 데이터 로드
      if (user?.role === 'instructor') {
        fetchInstructorData();
      } else {
        fetchStudentData();
      }
    }
  }, [router, isLoggedIn, authLoading, user]);

  // 강사용 데이터 로드
  const fetchInstructorData = async () => {
    try {
      // 강의 목록 가져오기
      const lecturesResponse = await fetch('http://localhost:8000/lectures/', {
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (lecturesResponse.ok) {
        const lecturesData = await lecturesResponse.json();
        setLectures(lecturesData);
      }
      
      setLecturesLoading(false);
    } catch (err: any) {
      console.error('강사 데이터 로드 실패:', err);
      setError(err.message || "오류가 발생했습니다.");
      setLecturesLoading(false);
    }
  };

  // 학생용 데이터 로드
  const fetchStudentData = async () => {
    try {
      // 수강 가능한 강의 목록 가져오기
      const lecturesResponse = await fetch('http://localhost:8000/lectures/', {
        headers: getAuthHeaders(),
        ...DEFAULT_FETCH_OPTIONS
      });
      
      if (lecturesResponse.ok) {
        const lecturesData = await lecturesResponse.json();
        setLectures(lecturesData);
      }
      
    } catch (err: any) {
      setError(err.message || "오류가 발생했습니다.");
    } finally {
      setLecturesLoading(false);
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

  // 강사용 대시보드
  const InstructorDashboard = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>👨‍🏫 강사 대시보드</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/lectures/create')}>
          새 강의 개설
        </Button>
      </div>

      {/* 강사 통계 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic title="총 강의 수" value={lectures.length} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="진행 중 강의" 
              value={lectures.filter(l => l.status === 'live').length} 
              prefix={<VideoCameraOutlined />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="예정된 강의" 
              value={lectures.filter(l => l.status === 'scheduled').length} 
              prefix={<DesktopOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic 
              title="총 참가자" 
              value={lectures.reduce((sum, l) => sum + l.participant_count, 0)} 
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 강의 목록 */}
      <Title level={3}>내 강의 목록</Title>
      {lecturesLoading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : lectures.length === 0 ? (
        <Empty
          description="아직 개설한 강의가 없습니다."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => router.push('/lectures/create')}>
            첫 강의 개설하기
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {lectures.map(lecture => (
            <Col key={lecture.id} xs={24} sm={12} md={8}>
              <Card
                hoverable
                className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-transform hover:scale-105"
                cover={
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-32 flex items-center justify-center relative">
                    <VideoCameraOutlined className="text-4xl text-white opacity-80" />
                    {lecture.status === 'live' && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        LIVE
                      </div>
                    )}
                  </div>
                }
                actions={[
                  <Button 
                    key="enter" 
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => router.push(`/lectures/${lecture.id}`)}
                    className="w-full mx-3 shadow-sm"
                    size="large"
                  >
                    강의실 입장
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
                    <Text className="text-blue-600 font-medium text-sm">
                      참가자: {lecture.participant_count}명
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  // 학생용 대시보드
  const StudentDashboard = () => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <Title level={2}>👨‍🎓 학습 대시보드</Title>
        <Button type="primary" onClick={() => router.push('/lectures/new')}>
          강의 둘러보기
        </Button>
      </div>

      {/* 진행 중인 강의 */}
      {lectures.filter(l => l.status === 'live').length > 0 && (
        <>
          <Title level={3}>🔴 진행 중인 강의</Title>
          <Row gutter={[16, 16]} className="mb-8">
            {lectures.filter(l => l.status === 'live').map(lecture => (
              <Col key={lecture.id} xs={24} sm={12} md={8}>
                <Card
                  hoverable
                  className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-transform hover:scale-105"
                  cover={
                    <div className="bg-gradient-to-br from-red-500 to-pink-600 h-32 flex items-center justify-center relative">
                      <VideoCameraOutlined className="text-4xl text-white opacity-80" />
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        LIVE
                      </div>
                    </div>
                  }
                  actions={[
                    <Button 
                      key="join" 
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => router.push(`/lectures/${lecture.id}`)}
                      className="w-full mx-3 shadow-sm"
                      size="large"
                    >
                      지금 참여하기
                    </Button>
                  ]}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <Title level={5} className="line-clamp-2 mb-2 text-gray-900">
                        {lecture.title}
                      </Title>
                      <Badge status="processing" text="실시간" />
                    </div>
                    
                    <Text className="text-gray-600 text-sm line-clamp-2 block">
                      {lecture.description}
                    </Text>
                    
                    <div className="pt-2 border-t border-gray-100">
                      <Text className="text-red-600 font-medium text-sm">
                        참가자: {lecture.participant_count}명 실시간 참여 중
                      </Text>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <Divider />
        </>
      )}

      {/* 전체 강의 목록 */}
      <Title level={3}>📚 수강 가능한 강의</Title>
      {lecturesLoading ? (
        <div className="flex justify-center py-8">
          <Spin size="large" />
        </div>
      ) : lectures.length === 0 ? (
        <Empty
          description="수강 가능한 강의가 없습니다."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => router.push('/lectures/new')}>
            강의 찾아보기
          </Button>
        </Empty>
      ) : (
        <Row gutter={[16, 16]}>
          {lectures.map(lecture => (
            <Col key={lecture.id} xs={24} sm={12} md={8}>
              <Card
                hoverable
                className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-transform hover:scale-105"
                cover={
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-32 flex items-center justify-center relative">
                    <VideoCameraOutlined className="text-4xl text-white opacity-80" />
                    {lecture.status === 'live' && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        LIVE
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
                    onClick={() => router.push(`/lectures/${lecture.id}`)}
                    className="w-full mx-3 shadow-sm"
                    size="large"
                  >
                    {lecture.status === 'live' ? '참여하기' : 
                     lecture.status === 'scheduled' ? '대기실 입장' : '다시보기'}
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
                    <Text className="text-blue-600 font-medium text-sm">
                      참가자: {lecture.participant_count}명
                    </Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

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
          {/* {error && (
            <Alert 
              message="오류 발생" 
              description={error} 
              type="error" 
              showIcon 
              className="mb-6"
              closable
              onClose={() => setError('')}
            />
          )} */}
          
          {user?.role === 'instructor' ? <InstructorDashboard /> : <StudentDashboard />}
        </div>
      </div>
    </MainLayout>
  );
} 
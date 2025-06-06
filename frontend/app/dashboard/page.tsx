'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Row, Col, Typography, Empty, Button, Spin, Alert, Badge, Tooltip, Modal, message, Statistic, Divider } from 'antd';
import { getAuthHeaders, DEFAULT_FETCH_OPTIONS } from '@/lib/api/config';
import { PlayCircleOutlined, PlusOutlined, TeamOutlined, VideoCameraOutlined, BookOutlined, DesktopOutlined, CalendarOutlined } from '@ant-design/icons';

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

      {/* 강사 통계 - 개선된 디자인 */}
      <Row gutter={16} className="mb-8">
        <Col span={6}>
          <Card className="text-center border-0 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 hover:from-blue-100 hover:to-blue-300 transition-all duration-300 hover:shadow-lg rounded-xl overflow-hidden">
            <Statistic 
              title={<span className="text-blue-700 font-semibold">총 강의 수</span>} 
              value={lectures.length} 
              prefix={<BookOutlined className="text-blue-600" />} 
              valueStyle={{ color: '#1d4ed8', fontSize: '24px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border-0 bg-gradient-to-br from-emerald-50 via-emerald-100 to-emerald-200 hover:from-emerald-100 hover:to-emerald-300 transition-all duration-300 hover:shadow-lg rounded-xl overflow-hidden">
            <Statistic 
              title={<span className="text-emerald-700 font-semibold">진행 중 강의</span>} 
              value={lectures.filter(l => l.status === 'live').length} 
              prefix={<VideoCameraOutlined className="text-emerald-600" />}
              valueStyle={{ color: '#059669', fontSize: '24px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border-0 bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 hover:from-purple-100 hover:to-purple-300 transition-all duration-300 hover:shadow-lg rounded-xl overflow-hidden">
            <Statistic 
              title={<span className="text-purple-700 font-semibold">예정된 강의</span>} 
              value={lectures.filter(l => l.status === 'scheduled').length} 
              prefix={<DesktopOutlined className="text-purple-600" />}
              valueStyle={{ color: '#7c3aed', fontSize: '24px', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="text-center border-0 bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 hover:from-orange-100 hover:to-orange-300 transition-all duration-300 hover:shadow-lg rounded-xl overflow-hidden">
            <Statistic 
              title={<span className="text-orange-700 font-semibold">총 참가자</span>} 
              value={lectures.reduce((sum, l) => sum + l.participant_count, 0)} 
              prefix={<TeamOutlined className="text-orange-600" />}
              valueStyle={{ color: '#ea580c', fontSize: '24px', fontWeight: 'bold' }}
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
                className="h-full shadow-md border-0 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group"
                cover={
                  <div className={`h-36 flex items-center justify-center relative overflow-hidden ${
                    lecture.status === 'live' 
                      ? 'bg-gradient-to-br from-red-500 via-pink-500 to-rose-600' 
                      : lecture.status === 'scheduled'
                      ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'
                      : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600'
                  }`}>
                    <VideoCameraOutlined className="text-5xl text-white opacity-90 group-hover:scale-110 transition-transform duration-300" />
                    {lecture.status === 'live' && (
                      <>
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                        {/* 라이브 효과 애니메이션 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 animate-pulse"></div>
                      </>
                    )}
                    {lecture.status === 'scheduled' && (
                      <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                        <CalendarOutlined className="text-sm" />
                        예정
                      </div>
                    )}
                    {/* 미묘한 패턴 효과 */}
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_50%,white_20%,transparent_20%),radial-gradient(circle_at_80%_50%,white_20%,transparent_20%)]"></div>
                  </div>
                }
                actions={[
                  <Button 
                    key="enter" 
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={() => router.push(`/lectures/${lecture.id}`)}
                    className="w-full mx-4 shadow-md hover:shadow-lg transition-shadow duration-300 font-semibold"
                    size="large"
                    style={{ 
                      background: lecture.status === 'live' 
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                        : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      border: 'none'
                    }}
                  >
                    {lecture.status === 'live' ? '🔴 강의실 입장' : '📚 강의실 입장'}
                  </Button>
                ]}
              >
                <div className="space-y-4 p-2">
                  <div className="flex justify-between items-start">
                    <Title level={5} className="line-clamp-2 mb-2 text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                      {lecture.title}
                    </Title>
                    <Badge 
                      status={getLectureStatusColor(lecture.status)} 
                      text={
                        <span className="font-medium text-xs uppercase tracking-wide">
                          {lecture.status === 'live' ? '진행중' : lecture.status === 'scheduled' ? '예정됨' : '종료됨'}
                        </span>
                      } 
                    />
                  </div>
                  
                  <Text className="text-gray-600 text-sm line-clamp-3 leading-relaxed block">
                    {lecture.description}
                  </Text>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <CalendarOutlined />
                        {formatDate(lecture.scheduled_start)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          lecture.status === 'live' ? 'bg-red-500 animate-pulse' : 
                          lecture.status === 'scheduled' ? 'bg-blue-500' : 'bg-gray-400'
                        }`}></div>
                        <Text className={`font-semibold text-sm ${
                          lecture.status === 'live' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          참가자: {lecture.participant_count}명
                        </Text>
                      </div>
                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                        <TeamOutlined className="text-xs text-gray-500" />
                        <Text className="text-xs text-gray-600 font-medium">
                          {lecture.participant_count > 0 ? '활성' : '대기'}
                        </Text>
                      </div>
                    </div>
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
          <div className="bg-gradient-to-r from-red-500 via-pink-500 to-rose-600 rounded-2xl p-8 mb-8 text-white shadow-xl">
            <Title level={3} className="text-white mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              🔴 진행 중인 강의
            </Title>
            <Text className="text-red-100 mb-6 block text-lg">
              지금 실시간으로 진행되고 있는 강의에 바로 참여하세요!
            </Text>
            <Row gutter={[16, 16]}>
              {lectures.filter(l => l.status === 'live').map(lecture => (
                <Col key={lecture.id} xs={24} sm={12} md={8}>
                  <Card
                    className="bg-white/15 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 transition-all duration-300 rounded-xl shadow-lg hover:shadow-xl"
                    actions={[
                      <Button 
                        key="join" 
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => router.push(`/lectures/${lecture.id}`)}
                        className="w-full mx-3 font-semibold"
                        size="large"
                        danger
                        style={{ 
                          background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                          border: 'none',
                          boxShadow: '0 4px 15px rgba(220, 38, 38, 0.4)'
                        }}
                      >
                        🚀 지금 참여하기
                      </Button>
                    ]}
                  >
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <Title level={5} className="text-white mb-2 line-clamp-2">
                          {lecture.title}
                        </Title>
                        <div className="flex items-center gap-1 bg-red-600/80 text-white px-2 py-1 rounded-full text-xs font-bold">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                      </div>
                      
                      <Text className="text-red-100 text-sm line-clamp-2 block leading-relaxed">
                        {lecture.description}
                      </Text>
                      
                      <div className="pt-2 border-t border-white/20">
                        <div className="flex items-center justify-between">
                          <Text className="text-red-100 text-sm font-medium">
                            👥 {lecture.participant_count}명 실시간 참여 중
                          </Text>
                          <div className="flex items-center gap-1 text-xs text-red-200">
                            <CalendarOutlined />
                            진행중
                          </div>
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
                className="h-full shadow-md border-0 rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group"
                cover={
                  <div className={`h-36 flex items-center justify-center relative overflow-hidden ${
                    lecture.status === 'live' 
                      ? 'bg-gradient-to-br from-red-500 via-pink-500 to-rose-600' 
                      : lecture.status === 'scheduled'
                      ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600'
                      : 'bg-gradient-to-br from-gray-400 via-gray-500 to-gray-600'
                  }`}>
                    <VideoCameraOutlined className="text-5xl text-white opacity-90 group-hover:scale-110 transition-transform duration-300" />
                    {lecture.status === 'live' && (
                      <>
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                        {/* 라이브 효과 애니메이션 */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/10 animate-pulse"></div>
                      </>
                    )}
                    {lecture.status === 'scheduled' && (
                      <div className="absolute top-4 right-4 flex items-center gap-2 bg-blue-600/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg">
                        <CalendarOutlined className="text-sm" />
                        예정
                      </div>
                    )}
                    {/* 미묘한 패턴 효과 */}
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_50%,white_20%,transparent_20%),radial-gradient(circle_at_80%_50%,white_20%,transparent_20%)]"></div>
                  </div>
                }
                actions={[
                  <Button 
                    key="join" 
                    type={lecture.status === 'live' ? 'primary' : 'default'}
                    icon={<PlayCircleOutlined />}
                    disabled={lecture.status === 'ended'}
                    onClick={() => router.push(`/lectures/${lecture.id}`)}
                    className="w-full mx-4 shadow-md hover:shadow-lg transition-shadow duration-300 font-semibold"
                    size="large"
                    danger={lecture.status === 'live'}
                    style={lecture.status === 'live' ? { 
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      border: 'none'
                    } : {}}
                  >
                    {lecture.status === 'live' ? '🔴 지금 참여' : 
                     lecture.status === 'scheduled' ? '⏰ 대기실 입장' : '📖 다시보기'}
                  </Button>
                ]}
              >
                <div className="space-y-4 p-2">
                  <div className="flex justify-between items-start">
                    <Title level={5} className="line-clamp-2 mb-2 text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                      {lecture.title}
                    </Title>
                    <Badge 
                      status={getLectureStatusColor(lecture.status)} 
                      text={
                        <span className="font-medium text-xs uppercase tracking-wide">
                          {lecture.status === 'live' ? '진행중' : lecture.status === 'scheduled' ? '예정됨' : '종료됨'}
                        </span>
                      } 
                    />
                  </div>
                  
                  <Text className="text-gray-600 text-sm line-clamp-3 leading-relaxed block">
                    {lecture.description}
                  </Text>
                  
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <CalendarOutlined />
                        {formatDate(lecture.scheduled_start)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          lecture.status === 'live' ? 'bg-red-500 animate-pulse' : 
                          lecture.status === 'scheduled' ? 'bg-blue-500' : 'bg-gray-400'
                        }`}></div>
                        <Text className={`font-semibold text-sm ${
                          lecture.status === 'live' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          참가자: {lecture.participant_count}명
                          {lecture.status === 'live' && ' 실시간 참여 중'}
                        </Text>
                      </div>
                      <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-full">
                        <TeamOutlined className="text-xs text-gray-500" />
                        <Text className="text-xs text-gray-600 font-medium">
                          {lecture.status === 'live' ? '진행중' : lecture.participant_count > 0 ? '활성' : '대기'}
                        </Text>
                      </div>
                    </div>
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
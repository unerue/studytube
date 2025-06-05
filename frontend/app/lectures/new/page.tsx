'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Row, Col, Input, Select, Spin, message, Typography, Space } from 'antd';
import { VideoCameraOutlined, UserOutlined, CalendarOutlined, PlayCircleOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { lectureService } from '@/lib/api/lectures';
import { Lecture } from '@/types/lecture';

const { Search } = Input;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

export default function NewLecturePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<string>('student');
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    // AuthContext에서 사용자 역할 확인
    if (user?.role) {
      setUserRole(user.role);
    } else {
      setUserRole('student');
    }
    
    // 강의 목록 로드
    fetchLectures();
  }, [user]);

  // 실제 API에서 강의 목록 가져오기
  const fetchLectures = async () => {
    setLoading(true);
    try {
      const lecturesData = await lectureService.getLectures();
      setLectures(lecturesData);
    } catch (error) {
      console.error('Failed to fetch lectures:', error);
      message.error('강의 목록을 불러오는데 실패했습니다.');
      setLectures([]); // 빈 배열로 설정
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge status="processing" text="진행중" className="font-medium" />;
      case 'scheduled':
        return <Badge status="default" text="예정됨" className="font-medium" />;
      case 'ended':
        return <Badge status="success" text="종료됨" className="font-medium" />;
      default:
        return <Badge status="default" text="알 수 없음" />;
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

  const filteredLectures = lectures.filter(lecture => {
    const matchesSearch = lecture.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lecture.instructor_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lecture.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleJoinLecture = async (lectureId: number) => {
    // 로그인 상태 확인
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      message.warning('강의에 참여하려면 로그인이 필요합니다.');
      router.push('/login');
      return;
    }

    try {
      await lectureService.joinLecture(lectureId);
      message.success('강의실에 입장합니다...');
      // 강의실 페이지로 이동
      window.location.href = `/lectures/${lectureId}`;
    } catch (error) {
      console.error('Failed to join lecture:', error);
      if (error instanceof Error && error.message.includes('401')) {
        message.error('인증이 만료되었습니다. 다시 로그인해주세요.');
        localStorage.removeItem('access_token');
        router.push('/login');
      } else {
        message.error('강의 참가에 실패했습니다.');
      }
    }
  };

  const handleStartNewLecture = () => {
    if (userRole === 'instructor') {
      router.push('/lectures/create');
    } else {
      message.info('강의를 생성하려면 강사 권한이 필요합니다.');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[calc(100vh-4rem)] bg-gray-50 flex items-center justify-center">
          <Space direction="vertical" align="center" size="large">
            <Spin size="large" />
            <Text className="text-gray-600">강의 목록을 불러오는 중...</Text>
          </Space>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <Title level={2} className="text-gray-900 mb-2 flex items-center gap-2">
                  <VideoCameraOutlined className="text-blue-500" />
                  실시간 강의
                </Title>
                <Text className="text-gray-600 text-lg">
                  AI 기반 실시간 번역과 화면 공유로 새로운 학습 경험을 시작하세요
                </Text>
              </div>
              {userRole === 'instructor' && (
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />} 
                  size="large" 
                  className="shadow-md"
                  onClick={handleStartNewLecture}
                >
                  새 강의 만들기
                </Button>
              )}
            </div>

            {/* 빠른 액션 카드 */}
            <Row gutter={[24, 24]} className="mb-8">
              {userRole === 'instructor' && (
                <Col xs={24} md={24}>
                  <Card 
                    hoverable
                    className="text-center border-blue-200 hover:border-blue-400 shadow-lg rounded-xl"
                  >
                    <PlayCircleOutlined className="text-5xl text-blue-500 mb-4" />
                    <Title level={4} className="text-blue-600 mb-3">
                      새 강의 시작
                    </Title>
                    <Paragraph className="text-gray-600 mb-6">
                      실시간 화면 공유, 채팅, 다국어 자막으로 강의를 진행하세요
                    </Paragraph>
                    <Button 
                      type="primary" 
                      size="large" 
                      icon={<PlayCircleOutlined />}
                      onClick={handleStartNewLecture}
                      className="w-full"
                    >
                      강의 생성하기
                    </Button>
                  </Card>
                </Col>
              )}
            </Row>

            {/* 검색 및 필터 */}
            <div className="flex gap-4 mb-6">
              <Search
                placeholder="강의 제목이나 강사명으로 검색..."
                allowClear
                size="large"
                style={{ width: 400 }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select
                size="large"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
              >
                <Option value="all">전체</Option>
                <Option value="live">진행중</Option>
                <Option value="scheduled">예정됨</Option>
                <Option value="ended">종료됨</Option>
              </Select>
            </div>
          </div>

          {/* 진행 중인 강의 목록 */}
          <div className="mb-8">
            <Title level={3} className="mb-4">🔴 진행 중인 강의</Title>
            <Row gutter={[24, 24]}>
              {filteredLectures.filter(lecture => lecture.status === 'live').map((lecture) => (
                <Col xs={24} sm={12} lg={8} key={lecture.id}>
                  <Card
                    hoverable
                    className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-transform hover:scale-105"
                    cover={
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-40 flex items-center justify-center relative">
                        <VideoCameraOutlined className="text-5xl text-white opacity-80" />
                        <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                          LIVE
                        </div>
                      </div>
                    }
                    actions={[
                      <Button
                        key="join"
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleJoinLecture(lecture.id)}
                        className="w-full mx-4 shadow-sm"
                        size="large"
                      >
                        참여하기
                      </Button>
                    ]}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <Title level={4} className="line-clamp-2 mb-2 text-gray-900">
                          {lecture.title}
                        </Title>
                        {getStatusBadge(lecture.status)}
                      </div>
                      
                      <Text className="text-gray-600 text-sm line-clamp-2 block">
                        {lecture.description}
                      </Text>
                      
                      <div className="space-y-3 text-sm text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <UserOutlined className="text-blue-500" />
                          <span className="font-medium">{lecture.instructor_name}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <Text className="text-blue-600 font-medium">
                            참여자: {lecture.participant_count}명
                          </Text>
                          <Badge status="processing" text="실시간" />
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {/* 전체 강의 목록 */}
          <div>
            <Title level={3} className="mb-4">📚 전체 강의 목록</Title>
            <Row gutter={[24, 24]}>
              {filteredLectures.map((lecture) => (
                <Col xs={24} sm={12} lg={8} key={lecture.id}>
                  <Card
                    hoverable
                    className="h-full shadow-lg border-0 rounded-xl overflow-hidden transition-transform hover:scale-105"
                    cover={
                      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-40 flex items-center justify-center relative">
                        <VideoCameraOutlined className="text-5xl text-white opacity-80" />
                        {lecture.status === 'live' && (
                          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
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
                        onClick={() => handleJoinLecture(lecture.id)}
                        disabled={lecture.status === 'ended'}
                        className="w-full mx-4 shadow-sm"
                        size="large"
                      >
                        {lecture.status === 'live' ? '참여하기' : 
                         lecture.status === 'scheduled' ? '대기실 입장' : '다시보기'}
                      </Button>
                    ]}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <Title level={4} className="line-clamp-2 mb-2 text-gray-900">
                          {lecture.title}
                        </Title>
                        {getStatusBadge(lecture.status)}
                      </div>
                      
                      <Text className="text-gray-600 text-sm line-clamp-2 block">
                        {lecture.description}
                      </Text>
                      
                      <div className="space-y-3 text-sm text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <UserOutlined className="text-blue-500" />
                          <span className="font-medium">{lecture.instructor_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarOutlined className="text-blue-500" />
                          <span>{formatDate(lecture.scheduled_start)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <Text className="text-blue-600 font-medium">
                            참여자: {lecture.participant_count}명
                          </Text>
                          {lecture.status === 'live' && (
                            <Badge status="processing" text="실시간" />
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>

          {filteredLectures.length === 0 && (
            <div className="text-center py-16">
              <div className="bg-white rounded-2xl shadow-lg p-12 max-w-md mx-auto">
                <VideoCameraOutlined className="text-6xl text-gray-300 mb-6" />
                <Title level={3} className="text-gray-500 mb-4">강의가 없습니다</Title>
                <Text className="text-gray-400 block mb-6">
                  검색 조건을 변경하거나 새로운 강의를 만들어보세요
                </Text>
                {userRole === 'instructor' && (
                  <Button type="primary" icon={<PlusOutlined />} size="large" onClick={handleStartNewLecture}>
                    첫 번째 강의 만들기
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
} 
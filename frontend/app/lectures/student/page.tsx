'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Row, Col, Input, Select, Spin, message } from 'antd';
import { VideoCameraOutlined, UserOutlined, CalendarOutlined, PlayCircleOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';

const { Search } = Input;
const { Option } = Select;

interface Lecture {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  status: 'scheduled' | 'live' | 'ended';
  participant_count: number;
  scheduled_start: string;
  created_at: string;
}

export default function StudentLecturesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // 임시 더미 데이터 (실제로는 API에서 가져올 예정)
  useEffect(() => {
    const fetchLectures = async () => {
      setLoading(true);
      const dummyLectures: Lecture[] = [
        {
          id: 1,
          title: "차량용 신호등 인식 AI 개발",
          description: "딥러닝을 활용한 실시간 신호등 인식 시스템 구현에 대해 알아봅니다.",
          instructor_name: "강경수 교수",
          status: 'live',
          participant_count: 24,
          scheduled_start: "2024-01-15T14:00:00Z",
          created_at: "2024-01-10T10:00:00Z"
        },
        {
          id: 2,
          title: "머신러닝 기초와 응용",
          description: "머신러닝의 기본 개념부터 실제 응용 사례까지 다룹니다.",
          instructor_name: "김진수 교수",
          status: 'scheduled',
          participant_count: 12,
          scheduled_start: "2024-01-16T10:00:00Z",
          created_at: "2024-01-12T15:30:00Z"
        },
        {
          id: 3,
          title: "웹 개발 실습",
          description: "React와 FastAPI를 활용한 풀스택 웹 개발 실습입니다.",
          instructor_name: "이소영 교수",
          status: 'ended',
          participant_count: 18,
          scheduled_start: "2024-01-14T16:00:00Z",
          created_at: "2024-01-08T09:00:00Z"
        }
      ];
      
      setTimeout(() => {
        setLectures(dummyLectures);
        setLoading(false);
      }, 1000);
    };

    fetchLectures();
  }, []);

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

  const handleJoinLecture = (lectureId: number) => {
    message.success('강의실에 입장합니다...');
    router.push(`/lectures/room/${lectureId}?role=student`);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center min-h-96">
          <Spin size="large" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div>
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">참여 가능한 강의</h1>
              <p className="text-gray-600">진행 중인 강의에 참여하여 학습하세요</p>
            </div>
          </div>

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

        {/* 강의 목록 */}
        <Row gutter={[24, 24]}>
          {filteredLectures.map((lecture) => (
            <Col xs={24} sm={12} lg={8} key={lecture.id}>
              <Card
                hoverable
                className="h-full shadow-md border-0"
                cover={
                  <div className="bg-gradient-to-r from-green-500 to-blue-600 h-32 flex items-center justify-center">
                    <VideoCameraOutlined className="text-4xl text-white" />
                  </div>
                }
                actions={[
                  <Button
                    key="join"
                    type={lecture.status === 'live' ? 'primary' : 'default'}
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleJoinLecture(lecture.id)}
                    disabled={lecture.status === 'ended'}
                    className="w-full mx-4"
                  >
                    {lecture.status === 'live' ? '참여하기' : 
                     lecture.status === 'scheduled' ? '대기실 입장' : '다시보기'}
                  </Button>
                ]}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold line-clamp-2 mb-2">
                      {lecture.title}
                    </h3>
                    {getStatusBadge(lecture.status)}
                  </div>
                  
                  <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                    {lecture.description}
                  </p>
                  
                  <div className="space-y-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <UserOutlined />
                      <span>{lecture.instructor_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarOutlined />
                      <span>{formatDate(lecture.scheduled_start)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>참여자: {lecture.participant_count}명</span>
                      {lecture.status === 'live' && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <span className="text-red-500 font-medium">LIVE</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {filteredLectures.length === 0 && (
          <div className="text-center py-12">
            <VideoCameraOutlined className="text-6xl text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-500 mb-2">강의가 없습니다</h3>
            <p className="text-gray-400">검색 조건을 변경해보세요</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
} 
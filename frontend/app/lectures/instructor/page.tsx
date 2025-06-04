'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Row, Col, Typography, Table, message, Space, Modal } from 'antd';
import { 
  VideoCameraOutlined, 
  UserOutlined, 
  CalendarOutlined, 
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;

interface Lecture {
  id: number;
  title: string;
  description: string;
  status: 'scheduled' | 'live' | 'ended';
  participant_count: number;
  max_participants: number;
  scheduled_start: string;
  created_at: string;
  room_url?: string;
}

export default function InstructorDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyLectures = async () => {
      setLoading(true);
      // 강사의 강의 목록 더미 데이터
      const dummyLectures: Lecture[] = [
        {
          id: 1,
          title: "차량용 신호등 인식 AI 개발",
          description: "딥러닝을 활용한 실시간 신호등 인식 시스템 구현",
          status: 'live',
          participant_count: 24,
          max_participants: 50,
          scheduled_start: "2024-01-15T14:00:00Z",
          created_at: "2024-01-10T10:00:00Z",
          room_url: "/lectures/room/1"
        },
        {
          id: 2,
          title: "딥러닝 기초 이론",
          description: "신경망의 기본 원리와 구현 방법을 다룹니다",
          status: 'scheduled',
          participant_count: 15,
          max_participants: 30,
          scheduled_start: "2024-01-20T10:00:00Z",
          created_at: "2024-01-12T15:30:00Z"
        },
        {
          id: 3,
          title: "컴퓨터 비전 프로젝트",
          description: "OpenCV와 PyTorch를 활용한 실습 강의",
          status: 'ended',
          participant_count: 28,
          max_participants: 40,
          scheduled_start: "2024-01-10T16:00:00Z",
          created_at: "2024-01-05T09:00:00Z"
        }
      ];
      
      setTimeout(() => {
        setLectures(dummyLectures);
        setLoading(false);
      }, 1000);
    };

    fetchMyLectures();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'live':
        return <Badge status="processing" text="진행중" color="red" />;
      case 'scheduled':
        return <Badge status="default" text="예정됨" />;
      case 'ended':
        return <Badge status="success" text="종료됨" />;
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

  const handleStartLecture = (lectureId: number) => {
    message.success('강의실을 시작합니다...');
    router.push(`/lectures/room/${lectureId}?role=instructor`);
  };

  const handleEditLecture = (lectureId: number) => {
    router.push(`/lectures/instructor/edit/${lectureId}`);
  };

  const handleDeleteLecture = (lectureId: number) => {
    Modal.confirm({
      title: '강의 삭제',
      content: '정말로 이 강의를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk() {
        message.success('강의가 삭제되었습니다.');
        setLectures(prev => prev.filter(lecture => lecture.id !== lectureId));
      },
    });
  };

  const liveLectures = lectures.filter(l => l.status === 'live');
  const upcomingLectures = lectures.filter(l => l.status === 'scheduled');
  const endedLectures = lectures.filter(l => l.status === 'ended');

  const columns = [
    {
      title: '강의명',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Lecture) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500 line-clamp-1">{record.description}</div>
        </div>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusBadge(status),
    },
    {
      title: '참여자',
      key: 'participants',
      render: (record: Lecture) => (
        <span>{record.participant_count} / {record.max_participants}</span>
      ),
    },
    {
      title: '시작 시간',
      dataIndex: 'scheduled_start',
      key: 'scheduled_start',
      render: (date: string) => formatDate(date),
    },
    {
      title: '액션',
      key: 'actions',
      render: (record: Lecture) => (
        <Space>
          {record.status === 'live' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartLecture(record.id)}
            >
              입장
            </Button>
          )}
          {record.status === 'scheduled' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartLecture(record.id)}
            >
              시작
            </Button>
          )}
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditLecture(record.id)}
          />
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteLecture(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <MainLayout>
      <div>
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <Title level={2}>강의 관리</Title>
            <Text className="text-gray-600">내 강의를 관리하고 실시간으로 진행하세요</Text>
          </div>
          <Link href="/lectures/instructor/create">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              새 강의 만들기
            </Button>
          </Link>
        </div>

        {/* 통계 카드 */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} sm={8}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-red-500 mb-2">{liveLectures.length}</div>
              <div className="text-gray-600">진행중인 강의</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-blue-500 mb-2">{upcomingLectures.length}</div>
              <div className="text-gray-600">예정된 강의</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-gray-500 mb-2">{endedLectures.length}</div>
              <div className="text-gray-600">종료된 강의</div>
            </Card>
          </Col>
        </Row>

        {/* 라이브 강의 섹션 */}
        {liveLectures.length > 0 && (
          <Card className="mb-6" title="🔴 현재 진행중인 강의">
            <Row gutter={[16, 16]}>
              {liveLectures.map((lecture) => (
                <Col xs={24} sm={12} lg={8} key={lecture.id}>
                  <Card 
                    size="small"
                    className="border-red-200 bg-red-50"
                    actions={[
                      <Button
                        key="enter"
                        type="primary"
                        danger
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleStartLecture(lecture.id)}
                      >
                        강의실 입장
                      </Button>
                    ]}
                  >
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-800">{lecture.title}</h4>
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <UserOutlined />
                        <span>{lecture.participant_count}명 참여중</span>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* 전체 강의 목록 */}
        <Card title="전체 강의 목록">
          <Table
            columns={columns}
            dataSource={lectures}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `총 ${total}개의 강의`,
            }}
          />
        </Card>
      </div>
    </MainLayout>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge, Row, Col, Typography, Table, Tabs, message } from 'antd';
import { 
  PlayCircleOutlined, 
  CalendarOutlined, 
  ClockCircleOutlined,
  UserOutlined,
  HistoryOutlined,
  BookOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import MainLayout from '@/components/layout/MainLayout';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface MyLecture {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  status: 'attended' | 'missed' | 'upcoming';
  attendance_duration: number; // 참석 시간 (분)
  total_duration: number; // 전체 강의 시간 (분)
  scheduled_start: string;
  attended_at?: string;
  recorded_url?: string;
}

export default function MyLecturesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [lectures, setLectures] = useState<MyLecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMyLectures = async () => {
      setLoading(true);
      // 학생이 참여한 강의 기록 더미 데이터
      const dummyLectures: MyLecture[] = [
        {
          id: 1,
          title: "차량용 신호등 인식 AI 개발",
          description: "딥러닝을 활용한 실시간 신호등 인식 시스템 구현",
          instructor_name: "강경수 교수",
          status: 'attended',
          attendance_duration: 85,
          total_duration: 90,
          scheduled_start: "2024-01-15T14:00:00Z",
          attended_at: "2024-01-15T14:05:00Z",
          recorded_url: "/lectures/recordings/1"
        },
        {
          id: 2,
          title: "딥러닝 기초 이론",
          description: "신경망의 기본 원리와 구현 방법",
          instructor_name: "김진수 교수",
          status: 'upcoming',
          attendance_duration: 0,
          total_duration: 120,
          scheduled_start: "2024-01-20T10:00:00Z"
        },
        {
          id: 3,
          title: "컴퓨터 비전 프로젝트",
          description: "OpenCV와 PyTorch를 활용한 실습",
          instructor_name: "이소영 교수",
          status: 'missed',
          attendance_duration: 0,
          total_duration: 100,
          scheduled_start: "2024-01-10T16:00:00Z"
        },
        {
          id: 4,
          title: "자연어 처리 입문",
          description: "BERT와 GPT 모델 이해하기",
          instructor_name: "박민수 교수",
          status: 'attended',
          attendance_duration: 75,
          total_duration: 80,
          scheduled_start: "2024-01-12T13:00:00Z",
          attended_at: "2024-01-12T13:10:00Z",
          recorded_url: "/lectures/recordings/4"
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
      case 'attended':
        return <Badge status="success" text="참석함" />;
      case 'missed':
        return <Badge status="error" text="불참" />;
      case 'upcoming':
        return <Badge status="processing" text="예정됨" />;
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

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  };

  const getAttendanceRate = (attendance: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((attendance / total) * 100);
  };

  const handleWatchRecording = (lectureId: number) => {
    message.success('녹화 영상을 재생합니다...');
    // 실제로는 녹화 영상 페이지로 이동
    router.push(`/lectures/recordings/${lectureId}`);
  };

  const handleJoinUpcomingLecture = (lectureId: number) => {
    message.success('강의실에 입장합니다...');
    router.push(`/lectures/room/${lectureId}?role=student`);
  };

  const attendedLectures = lectures.filter(l => l.status === 'attended');
  const upcomingLectures = lectures.filter(l => l.status === 'upcoming');
  const missedLectures = lectures.filter(l => l.status === 'missed');

  const columns = [
    {
      title: '강의명',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: MyLecture) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.instructor_name}</div>
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
      title: '참석률',
      key: 'attendance',
      render: (record: MyLecture) => {
        if (record.status === 'upcoming') return '-';
        if (record.status === 'missed') return '0%';
        const rate = getAttendanceRate(record.attendance_duration, record.total_duration);
        return (
          <div className="flex items-center">
            <span className={rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600'}>
              {rate}%
            </span>
            <span className="text-gray-400 text-xs ml-1">
              ({formatDuration(record.attendance_duration)} / {formatDuration(record.total_duration)})
            </span>
          </div>
        );
      },
    },
    {
      title: '일시',
      dataIndex: 'scheduled_start',
      key: 'scheduled_start',
      render: (date: string) => formatDate(date),
    },
    {
      title: '액션',
      key: 'actions',
      render: (record: MyLecture) => (
        <>
          {record.status === 'attended' && record.recorded_url && (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleWatchRecording(record.id)}
            >
              다시보기
            </Button>
          )}
          {record.status === 'upcoming' && (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleJoinUpcomingLecture(record.id)}
            >
              입장
            </Button>
          )}
        </>
      ),
    },
  ];

  // 통계 계산
  const totalLectures = lectures.length;
  const attendedCount = attendedLectures.length;
  const attendanceRate = totalLectures > 0 ? Math.round((attendedCount / totalLectures) * 100) : 0;
  const totalStudyTime = attendedLectures.reduce((sum, lecture) => sum + lecture.attendance_duration, 0);

  return (
    <MainLayout>
      <div>
        {/* 헤더 */}
        <div className="mb-8">
          <Title level={2}>내 강의 기록</Title>
          <Text className="text-gray-600">참여한 강의와 학습 현황을 확인하세요</Text>
        </div>

        {/* 통계 카드 */}
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} sm={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-blue-500 mb-2">{totalLectures}</div>
              <div className="text-gray-600">총 강의 수</div>
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-green-500 mb-2">{attendedCount}</div>
              <div className="text-gray-600">참석한 강의</div>
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card className="text-center">
              <div className={`text-2xl font-bold mb-2 ${attendanceRate >= 80 ? 'text-green-500' : attendanceRate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                {attendanceRate}%
              </div>
              <div className="text-gray-600">출석률</div>
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-purple-500 mb-2">{formatDuration(totalStudyTime)}</div>
              <div className="text-gray-600">총 학습 시간</div>
            </Card>
          </Col>
        </Row>

        {/* 예정된 강의 (있는 경우) */}
        {upcomingLectures.length > 0 && (
          <Card className="mb-6" title="📅 다가오는 강의">
            <Row gutter={[16, 16]}>
              {upcomingLectures.map((lecture) => (
                <Col xs={24} sm={12} lg={8} key={lecture.id}>
                  <Card 
                    size="small"
                    className="border-blue-200 bg-blue-50"
                    actions={[
                      <Button
                        key="join"
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        onClick={() => handleJoinUpcomingLecture(lecture.id)}
                      >
                        강의실 입장
                      </Button>
                    ]}
                  >
                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-800">{lecture.title}</h4>
                      <div className="text-sm text-blue-600 space-y-1">
                        <div className="flex items-center gap-2">
                          <UserOutlined />
                          <span>{lecture.instructor_name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CalendarOutlined />
                          <span>{formatDate(lecture.scheduled_start)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ClockCircleOutlined />
                          <span>{formatDuration(lecture.total_duration)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}

        {/* 강의 목록 */}
        <Card>
          <Tabs defaultActiveKey="all">
            <TabPane tab={`전체 (${totalLectures})`} key="all">
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
            </TabPane>
            <TabPane tab={`참석함 (${attendedCount})`} key="attended">
              <Table
                columns={columns}
                dataSource={attendedLectures}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </TabPane>
            <TabPane tab={`불참 (${missedLectures.length})`} key="missed">
              <Table
                columns={columns}
                dataSource={missedLectures}
                rowKey="id"
                pagination={{ pageSize: 10 }}
              />
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </MainLayout>
  );
} 
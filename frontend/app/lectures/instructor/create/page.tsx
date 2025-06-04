'use client';

import { useState, useRef } from 'react';
import { Card, Form, Input, Button, DatePicker, message, Select, Switch, Typography, Space, Divider } from 'antd';
import { ArrowLeftOutlined, DesktopOutlined, VideoCameraOutlined, SettingOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

interface LectureForm {
  title: string;
  description: string;
  scheduled_start: Date;
  max_participants: number;
  default_language: string;
  enable_recording: boolean;
  enable_screen_share: boolean;
  enable_chat: boolean;
}

export default function CreateLecturePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const router = useRouter();

  const startScreenShare = async () => {
    try {
      // Screen Capture API 사용
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          mediaSource: 'screen',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      
      setScreenStream(stream);
      setIsScreenSharing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // 화면 공유 종료 감지
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
      
      message.success('화면 공유가 시작되었습니다.');
    } catch (error) {
      console.error('Screen share error:', error);
      message.error('화면 공유를 시작할 수 없습니다. 브라우저에서 권한을 허용해주세요.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      message.info('화면 공유가 종료되었습니다.');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    
    try {
      const lectureData = {
        ...values,
        instructor_id: 1, // 현재 사용자 ID
        screen_share_enabled: isScreenSharing,
        screen_stream_id: screenStream ? 'stream_' + Date.now() : null
      };
      
      console.log('Creating lecture with screen share:', lectureData);
      
      // 임시 지연
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      message.success('강의가 성공적으로 생성되었습니다!');
      
      // 강의 생성 후 바로 강의실로 이동할지 확인
      if (isScreenSharing) {
        const lectureId = Math.floor(Math.random() * 1000); // 임시 ID
        router.push(`/lectures/room/${lectureId}?role=instructor&autostart=true`);
      } else {
        router.push('/lectures/instructor');
      }
      
    } catch (error) {
      message.error('강의 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div>
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/lectures/instructor" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeftOutlined />
            <span>강의 관리로 돌아가기</span>
          </Link>
          <Title level={2}>새 실시간 강의 만들기</Title>
          <Text className="text-gray-600">학생들과 실시간으로 소통하며 화면을 공유해보세요</Text>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 강의 설정 폼 */}
          <div className="lg:col-span-2">
            <Card title="강의 기본 정보" className="shadow-lg border-0">
              <Form
                form={form}
                layout="vertical"
                onFinish={onFinish}
                initialValues={{
                  max_participants: 50,
                  default_language: 'ko',
                  enable_recording: false,
                  enable_screen_share: true,
                  enable_chat: true
                }}
              >
                <Form.Item
                  name="title"
                  label="강의 제목"
                  rules={[
                    { required: true, message: '강의 제목을 입력해주세요!' },
                    { min: 5, message: '제목은 최소 5자 이상이어야 합니다!' }
                  ]}
                >
                  <Input 
                    size="large" 
                    placeholder="예: 실시간 AI 프로그래밍 워크샵"
                    className="rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  name="description"
                  label="강의 설명"
                  rules={[
                    { required: true, message: '강의 설명을 입력해주세요!' },
                    { min: 10, message: '설명은 최소 10자 이상이어야 합니다!' }
                  ]}
                >
                  <TextArea 
                    rows={4} 
                    placeholder="강의 내용과 학습 목표를 자세히 설명해주세요..."
                    className="rounded-lg"
                  />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    name="scheduled_start"
                    label="강의 시작 시간"
                    rules={[{ required: true, message: '강의 시작 시간을 선택해주세요!' }]}
                  >
                    <DatePicker
                      showTime
                      size="large"
                      format="YYYY-MM-DD HH:mm"
                      placeholder="날짜와 시간 선택"
                      className="w-full rounded-lg"
                    />
                  </Form.Item>

                  <Form.Item
                    name="max_participants"
                    label="최대 참여자 수"
                  >
                    <Input 
                      type="number" 
                      size="large" 
                      min={1} 
                      max={1000}
                      className="rounded-lg"
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  name="default_language"
                  label="기본 언어"
                >
                  <Select size="large" className="w-full">
                    <Option value="ko">한국어</Option>
                    <Option value="en">English</Option>
                    <Option value="zh">中文</Option>
                    <Option value="ja">日本語</Option>
                  </Select>
                </Form.Item>

                <Divider>고급 옵션</Divider>

                <div className="space-y-4">
                  <Form.Item name="enable_recording" valuePropName="checked">
                    <div className="flex items-center justify-between">
                      <div>
                        <Text strong>강의 녹화</Text>
                        <div className="text-sm text-gray-500">강의를 자동으로 녹화하여 나중에 다시보기 가능</div>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item name="enable_screen_share" valuePropName="checked">
                    <div className="flex items-center justify-between">
                      <div>
                        <Text strong>화면 공유 활성화</Text>
                        <div className="text-sm text-gray-500">실시간으로 화면을 공유하여 강의 진행</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </Form.Item>

                  <Form.Item name="enable_chat" valuePropName="checked">
                    <div className="flex items-center justify-between">
                      <div>
                        <Text strong>실시간 채팅</Text>
                        <div className="text-sm text-gray-500">학생들과 실시간으로 질의응답</div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </Form.Item>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t">
                  <Link href="/lectures/instructor">
                    <Button size="large" className="px-8">
                      취소
                    </Button>
                  </Link>
                  <Button 
                    type="primary" 
                    size="large" 
                    htmlType="submit" 
                    loading={loading}
                    className="px-8"
                  >
                    강의 생성하기
                  </Button>
                </div>
              </Form>
            </Card>
          </div>

          {/* 화면 공유 미리보기 */}
          <div className="lg:col-span-1">
            <Card title="화면 공유 설정" className="shadow-lg border-0">
              <div className="space-y-4">
                <div className="text-center">
                  {!isScreenSharing ? (
                    <div className="bg-gray-100 p-8 rounded-lg">
                      <DesktopOutlined className="text-4xl text-gray-400 mb-4" />
                      <p className="text-gray-500 mb-4">화면 공유를 시작하여 강의 준비를 완료하세요</p>
                      <Button 
                        type="primary" 
                        icon={<DesktopOutlined />} 
                        onClick={startScreenShare}
                        size="large"
                      >
                        화면 공유 시작
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <p className="text-green-700 font-medium">화면 공유가 활성화되었습니다!</p>
                        <p className="text-sm text-green-600">학생들이 실시간으로 화면을 볼 수 있습니다</p>
                      </div>
                      
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        className="w-full rounded-lg border"
                        style={{ maxHeight: '200px' }}
                      />
                      
                      <Button 
                        danger 
                        onClick={stopScreenShare}
                        className="w-full"
                      >
                        화면 공유 중지
                      </Button>
                    </div>
                  )}
                </div>

                <Divider />

                <div className="space-y-3">
                  <h4 className="font-medium">💡 화면 공유 팁</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 전체 화면 또는 특정 앱 윈도우를 선택할 수 있습니다</li>
                    <li>• PPT 슬라이드쇼 모드를 사용하면 더 깔끔합니다</li>
                    <li>• 마이크 권한도 함께 허용하여 음성도 전달하세요</li>
                    <li>• 강의 중에도 화면 공유를 시작/중지할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* 추가 설정 */}
            <Card title="기술 요구사항" className="shadow-lg border-0 mt-6">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Chrome, Firefox, Safari 최신 버전</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>안정적인 인터넷 연결 (최소 5Mbps)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>마이크 및 화면 녹화 권한</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 
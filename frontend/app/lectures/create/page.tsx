'use client';

import { useState } from 'react';
import { Card, Button, Typography, Form, Input, Select, Switch, message, DatePicker } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { lectureService } from '@/lib/api/lectures';
import { LectureCreate } from '@/types/lecture';

const { Title, Text } = Typography;
const { Option } = Select;

export default function CreateLecturePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // API 호출을 위한 데이터 변환
      const lectureData: LectureCreate = {
        title: values.title,
        description: values.description,
        max_participants: values.maxParticipants,
        scheduled_start: values.scheduledStart ? values.scheduledStart.toISOString() : new Date().toISOString()
      };
      
      console.log('Creating lecture with data:', lectureData);
      
      // 실제 API 호출
      const createdLecture = await lectureService.createLecture(lectureData);
      
      message.success('강의가 성공적으로 생성되었습니다!');
      router.push('/lectures/new');
    } catch (error) {
      console.error('Failed to create lecture:', error);
      message.error('강의 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-6">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => router.back()}
            className="mb-4"
          >
            뒤로 가기
          </Button>
          <Title level={2} className="text-gray-900">
            새 강의 생성
          </Title>
          <Text className="text-gray-600">
            실시간 강의를 위한 기본 정보를 입력해주세요
          </Text>
        </div>

        {/* 강의 생성 폼 */}
        <Card className="shadow-lg">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              language: 'ko',
              allowRecording: true,
              maxParticipants: 100,
              scheduledStart: dayjs().add(1, 'hour'), // 기본값: 1시간 후
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <Form.Item
                  label="강의 제목"
                  name="title"
                  rules={[{ required: true, message: '강의 제목을 입력해주세요' }]}
                >
                  <Input placeholder="예: AI 딥러닝 기초 강의" size="large" />
                </Form.Item>
              </div>

              <div className="md:col-span-2">
                <Form.Item
                  label="강의 설명"
                  name="description"
                  rules={[{ required: true, message: '강의 설명을 입력해주세요' }]}
                >
                  <Input.TextArea 
                    placeholder="강의 내용과 목표를 간단히 설명해주세요"
                    rows={4}
                  />
                </Form.Item>
              </div>

              <Form.Item
                label="강의 시작 시간"
                name="scheduledStart"
                rules={[{ required: true, message: '강의 시작 시간을 선택해주세요' }]}
              >
                <DatePicker 
                  showTime 
                  size="large"
                  style={{ width: '100%' }}
                  placeholder="강의 시작 시간을 선택하세요"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>

              <Form.Item
                label="주 언어"
                name="language"
                rules={[{ required: true, message: '언어를 선택해주세요' }]}
              >
                <Select size="large">
                  <Option value="ko">한국어</Option>
                  <Option value="en">English</Option>
                  <Option value="ja">日本語</Option>
                  <Option value="zh">中文</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="최대 참여자 수"
                name="maxParticipants"
                rules={[{ required: true, message: '최대 참여자 수를 입력해주세요' }]}
              >
                <Select size="large">
                  <Option value={25}>25명</Option>
                  <Option value={50}>50명</Option>
                  <Option value={100}>100명</Option>
                  <Option value={200}>200명</Option>
                  <Option value={500}>500명</Option>
                </Select>
              </Form.Item>

              <div className="md:col-span-2">
                <div className="space-y-4">
                  <Form.Item
                    name="allowRecording"
                    valuePropName="checked"
                  >
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <Text className="font-medium">강의 녹화 허용</Text>
                        <div>
                          <Text className="text-gray-500 text-sm">
                            강의를 자동으로 녹화하여 나중에 다시 볼 수 있습니다
                          </Text>
                        </div>
                      </div>
                      <Switch />
                    </div>
                  </Form.Item>

                  <Form.Item
                    name="allowChat"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <Text className="font-medium">채팅 허용</Text>
                        <div>
                          <Text className="text-gray-500 text-sm">
                            참여자들이 실시간으로 채팅할 수 있습니다
                          </Text>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </Form.Item>

                  <Form.Item
                    name="allowSubtitles"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <Text className="font-medium">실시간 자막</Text>
                        <div>
                          <Text className="text-gray-500 text-sm">
                            AI를 통한 실시간 자막 생성 및 번역
                          </Text>
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </Form.Item>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
              <Button 
                size="large"
                onClick={() => router.back()}
              >
                취소
              </Button>
              <Button 
                type="primary" 
                size="large"
                icon={<PlusOutlined />}
                htmlType="submit"
                loading={loading}
              >
                강의 생성
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
} 
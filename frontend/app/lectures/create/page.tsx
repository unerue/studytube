'use client';

import { useState } from 'react';
import { Card, Form, Input, Button, DatePicker, Upload, message, Select } from 'antd';
import { UploadOutlined, FileOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { UploadProps } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

interface LectureForm {
  title: string;
  description: string;
  scheduled_start: Date;
  ppt_file?: File;
}

export default function CreateLecturePage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pptFile, setPptFile] = useState<File | null>(null);
  const router = useRouter();

  const uploadProps: UploadProps = {
    name: 'ppt',
    multiple: false,
    accept: '.ppt,.pptx,.pdf',
    beforeUpload: (file) => {
      const isValidType = file.type === 'application/vnd.ms-powerpoint' || 
                         file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                         file.type === 'application/pdf';
      if (!isValidType) {
        message.error('PPT 또는 PDF 파일만 업로드 가능합니다!');
        return false;
      }
      const isLt50M = file.size / 1024 / 1024 < 50;
      if (!isLt50M) {
        message.error('파일 크기는 50MB 이하여야 합니다!');
        return false;
      }
      setPptFile(file);
      return false; // 자동 업로드 방지
    },
    onRemove: () => {
      setPptFile(null);
    },
    fileList: pptFile ? [
      {
        uid: '1',
        name: pptFile.name,
        status: 'done',
      }
    ] : [],
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    
    try {
      // 실제로는 API 호출
      const lectureData = {
        ...values,
        ppt_file: pptFile,
        instructor_id: 1 // 현재 사용자 ID
      };
      
      console.log('Creating lecture:', lectureData);
      
      // 임시 지연
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      message.success('강의가 성공적으로 생성되었습니다!');
      router.push('/lectures');
      
    } catch (error) {
      message.error('강의 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/lectures" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4">
            <ArrowLeftOutlined />
            <span>강의 목록으로 돌아가기</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">새 강의 만들기</h1>
          <p className="text-gray-600">실시간 강의를 생성하고 학생들과 소통해보세요</p>
        </div>

        <Card className="shadow-lg border-0">
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="space-y-6"
          >
            {/* 기본 정보 */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">기본 정보</h2>
              
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
                  placeholder="예: 차량용 신호등 인식 AI 개발"
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
                  placeholder="강의 내용에 대해 자세히 설명해주세요..."
                  className="rounded-lg"
                />
              </Form.Item>
            </div>

            {/* 일정 설정 */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">일정 설정</h2>
              
              <Form.Item
                name="scheduled_start"
                label="강의 시작 시간"
                rules={[{ required: true, message: '강의 시작 시간을 선택해주세요!' }]}
              >
                <DatePicker
                  showTime
                  size="large"
                  format="YYYY-MM-DD HH:mm"
                  placeholder="날짜와 시간을 선택하세요"
                  className="w-full rounded-lg"
                />
              </Form.Item>
            </div>

            {/* PPT 파일 업로드 */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">강의 자료</h2>
              
              <Form.Item
                name="ppt_file"
                label="PPT 파일 (선택사항)"
                extra="PowerPoint(.ppt, .pptx) 또는 PDF 파일을 업로드하세요. 최대 50MB"
              >
                <Upload.Dragger {...uploadProps} className="rounded-lg">
                  <p className="ant-upload-drag-icon">
                    <FileOutlined className="text-4xl text-blue-500" />
                  </p>
                  <p className="ant-upload-text">
                    클릭하거나 파일을 여기로 드래그하세요
                  </p>
                  <p className="ant-upload-hint">
                    PPT, PPTX, PDF 파일만 지원됩니다
                  </p>
                </Upload.Dragger>
              </Form.Item>
            </div>

            {/* 고급 설정 */}
            <div className="pb-6">
              <h2 className="text-xl font-semibold mb-4">고급 설정</h2>
              
              <Form.Item
                name="default_language"
                label="기본 언어"
                initialValue="ko"
              >
                <Select size="large" className="w-full">
                  <Option value="ko">한국어</Option>
                  <Option value="en">English</Option>
                  <Option value="zh">中文</Option>
                  <Option value="ja">日本語</Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="max_participants"
                label="최대 참여자 수"
                initialValue={100}
              >
                <Input 
                  type="number" 
                  size="large" 
                  min={1} 
                  max={1000}
                  placeholder="100"
                  className="rounded-lg"
                />
              </Form.Item>
            </div>

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Link href="/lectures">
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

        {/* 도움말 */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">💡 강의 생성 팁</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>• 강의 제목은 구체적이고 명확하게 작성하세요</li>
            <li>• PPT 파일을 미리 업로드하면 강의 중 원활한 화면 공유가 가능합니다</li>
            <li>• 강의 시작 10분 전부터 학생들이 대기실에 입장할 수 있습니다</li>
            <li>• 실시간 번역 기능으로 다국적 학생들도 참여할 수 있습니다</li>
          </ul>
        </Card>
      </div>
    </div>
  );
} 
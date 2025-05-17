'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import MainLayout from '@/components/layout/MainLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Form, Input, Button, Card, Typography, Space, Divider, message, Spin } from 'antd';

const { Title, Text } = Typography;

export default function ProfilePage() {
  const [loading, setLoading] = useState(false);
  const [passwordForm] = Form.useForm();
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push('/login');
    }
  }, [router, isLoggedIn, authLoading]);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  const handlePasswordChange = async (values: any) => {
    try {
      setLoading(true);
      
      // API 호출 구현
      // const response = await fetch('http://localhost:8000/auth/change-password', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      //   },
      //   body: JSON.stringify({
      //     currentPassword: values.currentPassword,
      //     newPassword: values.newPassword,
      //   }),
      //   credentials: 'include'
      // });
      
      // if (!response.ok) {
      //   throw new Error('비밀번호 변경에 실패했습니다.');
      // }
      
      // 실제 API 연결 시 주석 제거 필요
      // 임시 딜레이
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      message.success('비밀번호가 성공적으로 변경되었습니다.');
      passwordForm.resetFields();
    } catch (err: any) {
      message.error(err.message || '비밀번호 변경 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto">
        <Title level={2} className="mb-6">회원 정보</Title>
        
        <Card className="mb-6">
          <div className="flex flex-col space-y-4">
            <div>
              <Text type="secondary">사용자명</Text>
              <p className="text-lg">{user?.username || '-'}</p>
            </div>
            <Divider />
            <div>
              <Text type="secondary">이메일</Text>
              <p className="text-lg">{user?.email || '-'}</p>
            </div>
          </div>
        </Card>
        
        <Card title="비밀번호 변경">
          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handlePasswordChange}
          >
            <Form.Item
              name="currentPassword"
              label="현재 비밀번호"
              rules={[{ required: true, message: '현재 비밀번호를 입력해주세요' }]}
            >
              <Input.Password />
            </Form.Item>
            
            <Form.Item
              name="newPassword"
              label="새 비밀번호"
              rules={[
                { required: true, message: '새 비밀번호를 입력해주세요' },
                { min: 8, message: '비밀번호는 8자 이상이어야 합니다' }
              ]}
            >
              <Input.Password />
            </Form.Item>
            
            <Form.Item
              name="confirmPassword"
              label="비밀번호 확인"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: '비밀번호 확인을 입력해주세요' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('비밀번호가 일치하지 않습니다'));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading}>
                비밀번호 변경
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </MainLayout>
  );
} 
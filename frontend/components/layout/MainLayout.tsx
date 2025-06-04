'use client';

import { useState } from 'react';
import { Layout, Menu, Button, Typography, Badge } from 'antd';
import {
  DashboardOutlined,
  ReadOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  VideoCameraOutlined,
  BookOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { logout, user } = useAuth();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  // 사용자 역할 확인 (임시로 localStorage에서 가져오거나 기본값 설정)
  const userRole = typeof window !== 'undefined' 
    ? localStorage.getItem('userRole') || 'student' 
    : 'student';

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/dashboard">대시보드</Link>,
    },
    {
      key: 'study',
      icon: <ReadOutlined />,
      label: <Link href="/study">학습하기</Link>,
    },
    {
      key: 'lectures',
      icon: <PlayCircleOutlined />,
      label: '실시간 강의',
      children: userRole === 'instructor' ? [
        {
          key: 'lectures-dashboard',
          icon: <BookOutlined />,
          label: <Link href="/lectures/instructor">강의 관리</Link>,
        },
        {
          key: 'lectures-create',
          icon: <VideoCameraOutlined />,
          label: <Link href="/lectures/instructor/create">강의 생성</Link>,
        },
        {
          key: 'lectures-live',
          icon: <PlayCircleOutlined />,
          label: <Link href="/lectures/instructor/live">라이브 강의</Link>,
        }
      ] : [
        {
          key: 'lectures-list',
          icon: <BookOutlined />,
          label: <Link href="/lectures/student">강의 목록</Link>,
        },
        {
          key: 'lectures-my',
          icon: <VideoCameraOutlined />,
          label: <Link href="/lectures/student/my">내 강의</Link>,
        }
      ]
    },
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link href="/profile">회원정보</Link>,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ];

  // 현재 경로에 따라 선택된 메뉴 항목 결정
  const selectedKey = pathname.split('/')[1] || 'dashboard';
  const openKeys = pathname.includes('/lectures') ? ['lectures'] : [];

  // 역할 변경 함수 (테스트용)
  const toggleUserRole = () => {
    const newRole = userRole === 'instructor' ? 'student' : 'instructor';
    localStorage.setItem('userRole', newRole);
    window.location.reload();
  };

  return (
    <Layout className="min-h-screen">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        className="border-r border-gray-200"
        width={250}
      >
        <div className="p-4">
          <Link href="/">
            <Title level={4} className="text-blue-600 m-0">
              StudyTube
            </Title>
          </Link>
          
          {/* 역할 표시 및 전환 (테스트용) */}
          <div className="mt-3 p-2 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Badge 
                status={userRole === 'instructor' ? 'success' : 'default'} 
                text={userRole === 'instructor' ? '강사' : '학생'}
              />
              <Button 
                size="small" 
                type="link" 
                onClick={toggleUserRole}
                className="p-0 h-auto"
              >
                전환
              </Button>
            </div>
          </div>
        </div>
        
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={openKeys}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header className="bg-white p-0 px-4 flex items-center justify-between border-b border-gray-200">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
          />
          <div className="flex items-center">
            <span className="mr-4">안녕하세요, {user?.username || '사용자'}님</span>
          </div>
        </Header>
        <Content className="m-6 p-6 bg-white rounded-lg">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
} 
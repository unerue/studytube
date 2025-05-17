'use client';

import { useState } from 'react';
import { Layout, Menu, Button, Typography } from 'antd';
import {
  DashboardOutlined,
  ReadOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
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
  const { logout } = useAuth();

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

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

  return (
    <Layout className="min-h-screen">
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        theme="light"
        className="border-r border-gray-200"
      >
        <div className="p-4">
          <Link href="/">
            <Title level={4} className="text-blue-600 m-0">
              StudyTube
            </Title>
          </Link>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
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
            <span className="mr-4">{/* 우측 헤더 콘텐츠 */}</span>
          </div>
        </Header>
        <Content className="m-6 p-6 bg-white rounded-lg">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
} 
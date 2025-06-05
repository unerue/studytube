'use client';

import { Button, Menu, Dropdown, Avatar, Select } from 'antd';
import type { MenuProps } from 'antd';
import { 
  UserOutlined, 
  LogoutOutlined, 
  DashboardOutlined,
  SettingOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { useLanguage } from '@/lib/context/LanguageContext';

const { Option } = Select;

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuth();
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: (
        <Link href="/profile">프로필</Link>
      ),
    },
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: (
        <Link href="/dashboard">대시보드</Link>
      ),
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: (
        <Link href="/profile">설정</Link>
      ),
    },
    {
      key: 'language',
      icon: <GlobalOutlined />,
      label: (
        <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
          <span>언어 설정</span>
          <Select
            value={language}
            onChange={setLanguage}
            size="small"
            style={{ width: 100, marginLeft: 8 }}
            onClick={(e) => e.stopPropagation()}
          >
            {supportedLanguages.map(lang => (
              <Option key={lang.code} value={lang.code}>
                <span className="mr-1">{lang.flag}</span>
                {lang.name}
              </Option>
            ))}
          </Select>
        </div>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '로그아웃',
      onClick: handleLogout,
    },
  ];

  return (
    <nav className="bg-white shadow-md border-b border-gray-200 px-4 py-2">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* 로고 */}
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
            <UserOutlined className="text-white text-sm" />
          </div>
          <span className="text-xl font-bold text-blue-700">StudyTube</span>
        </Link>

        {/* 사용자 메뉴 */}
        <div className="flex items-center space-x-4">
          {isLoggedIn ? (
            <Dropdown
              menu={{ items: userMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded-lg">
                <Avatar 
                  size="small" 
                  icon={<UserOutlined />} 
                  className="bg-blue-500"
                />
                <span className="text-gray-700 hidden sm:block">
                  {user?.username || user?.email}
                </span>
              </div>
            </Dropdown>
          ) : (
            <div className="flex space-x-2">
              <Link href="/login">
                <Button type="default">로그인</Button>
              </Link>
              <Link href="/register">
                <Button type="primary">회원가입</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
} 
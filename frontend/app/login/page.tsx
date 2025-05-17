'use client';
import Link from 'next/link';
import LoginForm from '../../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8 text-blue-700">StudyTube</h1>
      
      <LoginForm />
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          계정이 없으신가요?{' '}
          <Link href="/register" className="text-blue-500 hover:text-blue-700">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
} 
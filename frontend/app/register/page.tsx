'use client';
import Link from 'next/link';
import RegisterForm from '../../components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-blue-100 to-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8 text-blue-700">회원가입</h1>
      
      <RegisterForm />
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-blue-500 hover:text-blue-700">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
} 
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import LoginForm from '../../components/auth/LoginForm';

interface TestAccount {
  username: string;
  email: string;
  password: string;
  role: string;
}

export default function LoginPage() {
  const [testAccounts, setTestAccounts] = useState<TestAccount[]>([]);
  const [showTestAccounts, setShowTestAccounts] = useState(false);

  useEffect(() => {
    // 백엔드에서 테스트 계정 목록 가져오기
    const fetchTestAccounts = async () => {
      try {
        const response = await fetch('http://localhost:8000/test-accounts');
        if (response.ok) {
          const accounts = await response.json();
          setTestAccounts(accounts);
        }
      } catch (error) {
        console.error('테스트 계정 로드 실패:', error);
      }
    };

    fetchTestAccounts();
  }, []);

  const handleTestLogin = (email: string, password: string) => {
    // LoginForm의 입력 필드에 자동으로 입력하는 기능은 별도 구현이 필요
    // 여기서는 간단히 alert로 정보 표시
    alert(`테스트 계정 정보:\n이메일: ${email}\n비밀번호: ${password}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-blue-100 to-white flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8 text-blue-700">로그인</h1>
      
      <LoginForm />
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          계정이 없으신가요?{' '}
          <Link href="/register" className="text-blue-500 hover:text-blue-700">
            회원가입
          </Link>
        </p>
      </div>

      {/* 테스트 계정 섹션 */}
      <div className="mt-8 w-full max-w-md">
        <button
          onClick={() => setShowTestAccounts(!showTestAccounts)}
          className="w-full p-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          {showTestAccounts ? '테스트 계정 숨기기' : '🧪 테스트 계정 보기 (개발용)'}
        </button>
        
        {showTestAccounts && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-sm font-semibold text-yellow-800 mb-3">🔧 개발용 테스트 계정</h3>
            <div className="space-y-2">
              {testAccounts.map((account) => (
                <div key={account.email} className="flex justify-between items-center p-2 bg-white rounded border">
                  <div className="text-sm">
                    <div className="font-medium">{account.username}</div>
                    <div className="text-gray-600">{account.email}</div>
                    <div className="text-xs text-blue-600">
                      {account.role === 'instructor' ? '👨‍🏫 교수' : '👨‍🎓 학생'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleTestLogin(account.email, account.password)}
                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    정보 복사
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-gray-600">
              💡 계정 정보를 복사하여 위 로그인 폼에 입력하세요
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 
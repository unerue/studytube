'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { Alert, Spin } from "antd";

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [localLoading, setLocalLoading] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, error: authError, loading: authLoading } = useAuth();

  // 로그인 성공 후 리다이렉트할 URL 결정
  const getRedirectUrl = () => {
    const callbackUrl = searchParams.get('callbackUrl');
    const from = searchParams.get('from');
    
    // 보안상 내부 URL만 허용
    if (callbackUrl && callbackUrl.startsWith('/')) {
      return callbackUrl;
    }
    
    if (from && from.startsWith('/')) {
      return from;
    }
    
    return '/';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setLocalLoading(true);
    setLoginAttempted(true);

    // 입력값 검증
    if (!email) {
      setFormError("이메일을 입력해주세요.");
      setLocalLoading(false);
      return;
    }

    if (!password) {
      setFormError("비밀번호를 입력해주세요.");
      setLocalLoading(false);
      return;
    }

    try {
      await login(email, password);
      
      // 성공 콜백 또는 리다이렉트
      if (onSuccess) {
        onSuccess();
      } else {
        const redirectUrl = getRedirectUrl();
        console.log(`로그인 성공, 리다이렉트: ${redirectUrl}`);
        router.push(redirectUrl);
      }
    } catch (err: any) {
      console.error('로그인 실패:', err);
      setFormError(err.message || "로그인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLocalLoading(false);
    }
  };

  // 서버 연결 오류 또는 인증 오류 표시
  const displayError = formError || authError;
  const isLoading = localLoading || (authLoading && !loginAttempted);

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">로그인</h2>
      
      {displayError && (
        <Alert
          message="오류"
          description={displayError}
          type="error"
          showIcon
          closable
          className="mb-4"
        />
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            이메일
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="email"
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            비밀번호
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="password"
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full flex items-center justify-center"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spin size="small" className="mr-2" /> 로그인 중...
              </>
            ) : (
              "로그인"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
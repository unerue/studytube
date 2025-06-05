'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/AuthContext";
import { LanguageSelector } from "@/components/common/LanguageSelector";
import { useLanguage } from "@/lib/context/LanguageContext";

interface RegisterFormProps {
  onSuccess?: () => void;
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState<'student' | 'instructor'>('student');
  const [passwordError, setPasswordError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { register, error: authError } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    
    // 비밀번호 확인
    if (password !== passwordConfirm) {
      setPasswordError(t('auth.passwordMismatch') || "비밀번호가 일치하지 않습니다.");
      return;
    }
    
    setLoading(true);

    try {
      await register(username, email, password, role);
      
      // 성공 콜백 또는 리다이렉트
      if (onSuccess) {
        onSuccess();
      } else {
        router.push("/login");
      }
    } catch (err) {
      // 에러는 이미 AuthContext에서 처리됨
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center text-blue-700">
        {t('auth.register') || '회원가입'}
      </h2>
      
      {(authError || passwordError) && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {passwordError || authError}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        {/* 역할 선택 */}
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-3">
            가입 유형을 선택하세요
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRole('student')}
              className={`p-4 border-2 rounded-lg text-center transition-all ${
                role === 'student'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-2">👨‍🎓</div>
              <div className="font-semibold">학생</div>
              <div className="text-xs text-gray-600 mt-1">강의를 수강합니다</div>
            </button>
            <button
              type="button"
              onClick={() => setRole('instructor')}
              className={`p-4 border-2 rounded-lg text-center transition-all ${
                role === 'instructor'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="text-2xl mb-2">👨‍🏫</div>
              <div className="font-semibold">교수</div>
              <div className="text-xs text-gray-600 mt-1">강의를 개설합니다</div>
            </button>
          </div>
        </div>

        {/* 언어/국적 선택 */}
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t('auth.preferredLanguage') || '언어 선택'} / {t('auth.nationality') || '국적'}
          </label>
          <LanguageSelector 
            size="large" 
            className="w-full"
            showIcon={true}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('auth.languageDescription') || '선택한 언어로 StudyTube 인터페이스가 표시됩니다.'}
          </p>
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
            {t('auth.username') || '사용자명'}
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="username"
            type="text"
            placeholder={t('auth.username') || '사용자명'}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
            {t('auth.email') || '이메일'}
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="email"
            type="email"
            placeholder={t('auth.email') || '이메일'}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
            {t('auth.password') || '비밀번호'}
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="password"
            type="password"
            placeholder={t('auth.password') || '비밀번호'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="passwordConfirm">
            {t('auth.confirmPassword') || '비밀번호 확인'}
          </label>
          <input
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            id="passwordConfirm"
            type="password"
            placeholder={t('auth.confirmPassword') || '비밀번호 확인'}
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
          />
        </div>
        
        <div className="flex items-center justify-between">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? (t('common.loading') || "처리 중...") : (t('auth.register') || "회원가입")}
          </button>
        </div>
      </form>
    </div>
  );
} 
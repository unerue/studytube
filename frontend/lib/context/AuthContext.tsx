'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface User {
  id?: number;
  username?: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 토큰 기반 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 쿠키에서 토큰이 자동으로 전송됨
        const response = await fetch('http://localhost:8000/auth/me', {
          credentials: "include"  // 쿠키 포함
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsLoggedIn(true);
        } else {
          // 로컬 스토리지에서 시도
          const token = localStorage.getItem('access_token');
          
          if (token) {
            const tokenResponse = await fetch('http://localhost:8000/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (tokenResponse.ok) {
              const userData = await tokenResponse.json();
              setUser(userData);
              setIsLoggedIn(true);
            } else {
              localStorage.removeItem('access_token');
              setUser(null);
              setIsLoggedIn(false);
            }
          } else {
            setUser(null);
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.error('인증 확인 오류:', err);
        setIsLoggedIn(false);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // 로그인 함수
  const login = async (email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      // FormData 형식으로 변환 (OAuth2 spec)
      const formData = new URLSearchParams();
      formData.append("username", email); // OAuth2는 username 필드 사용
      formData.append("password", password);

      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        credentials: "include",  // 쿠키 포함
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "로그인 실패");
      }

      // localStorage에 저장 (선택적, 쿠키로도 가능)
      localStorage.setItem("access_token", data.access_token);
      setIsLoggedIn(true);
      
      // 사용자 정보 가져오기
      const userResponse = await fetch('http://localhost:8000/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        },
        credentials: "include",  // 쿠키 포함
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
      }
    } catch (err: any) {
      setError(err.message || "로그인 중 오류가 발생했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 함수
  const register = async (username: string, email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "회원가입 실패");
      }

      // 회원가입 성공 (자동 로그인은 하지 않음)
      return data;
    } catch (err: any) {
      setError(err.message || "회원가입 중 오류가 발생했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    setIsLoggedIn(false);
  };

  const value = {
    user,
    loading,
    isLoggedIn,
    login,
    register,
    logout,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 
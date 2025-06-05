'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface User {
  id?: number;
  username?: string;
  email?: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, role?: 'student' | 'instructor') => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  console.log('AuthProvider state:', { user, loading, isLoggedIn, isInitialized });

  // 토큰 기반 인증 상태 확인
  useEffect(() => {
    // 이미 초기화되었거나 초기화 중이면 실행하지 않음
    if (isInitialized) {
      console.log('AuthProvider: 이미 초기화됨, useEffect 스킵');
      return;
    }

    console.log('AuthProvider: 인증 상태 확인 시작');
    const checkAuth = async () => {
      try {
        // 로컬 스토리지에서 토큰 먼저 확인
        const token = localStorage.getItem('access_token');
        console.log('AuthProvider: 로컬 스토리지 토큰 확인:', token ? '토큰 있음' : '토큰 없음');
        
        if (token) {
          // 토큰이 있으면 Bearer 토큰으로 요청
          console.log('AuthProvider: Bearer 토큰으로 /auth/me 요청');
          const response = await fetch('http://localhost:8000/auth/me', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });
          
          console.log('AuthProvider: Bearer 토큰 응답 상태:', response.status);
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setIsLoggedIn(true);
            console.log('토큰으로 인증 성공:', userData);
          } else {
            // 토큰이 유효하지 않으면 제거하고 쿠키 확인
            localStorage.removeItem('access_token');
            console.log('토큰 무효, 쿠키 확인 중...');
            
            // 쿠키 인증 시도
            console.log('AuthProvider: 쿠키로 /auth/me 요청');
            const cookieResponse = await fetch('http://localhost:8000/auth/me', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            });
            
            console.log('AuthProvider: 쿠키 응답 상태:', cookieResponse.status);
            
            if (cookieResponse.ok) {
              const userData = await cookieResponse.json();
              setUser(userData);
              setIsLoggedIn(true);
              console.log('쿠키로 인증 성공:', userData);
            } else {
              console.log('인증 실패, 로그아웃 상태로 설정');
              setUser(null);
              setIsLoggedIn(false);
            }
          }
        } else {
          // 토큰이 없으면 쿠키만 확인
          console.log('토큰 없음, 쿠키 확인 중...');
          console.log('AuthProvider: 쿠키로 /auth/me 요청');
          const response = await fetch('http://localhost:8000/auth/me', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          console.log('AuthProvider: 쿠키 응답 상태:', response.status);

          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
            setIsLoggedIn(true);
            console.log('쿠키로 인증 성공:', userData);
          } else {
            console.log('인증 실패, 로그아웃 상태로 설정');
            setUser(null);
            setIsLoggedIn(false);
          }
        }
      } catch (err) {
        console.error('인증 확인 오류:', err);
        // 네트워크 오류 등의 경우에도 로그아웃 상태로 설정
        setUser(null);
        setIsLoggedIn(false);
        
        // 백엔드 서버가 실행되지 않은 경우에 대한 처리
        if (err instanceof TypeError && err.message.includes('fetch')) {
          console.warn('백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
          setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        }
      } finally {
        console.log('AuthProvider: 인증 확인 완료, 로딩 상태 해제');
        setLoading(false);
        setIsInitialized(true);
      }
    };

    checkAuth();
  }, [isInitialized]); // isInitialized 의존성 추가

  // 로그인 함수
  const login = async (email: string, password: string) => {
    console.log('AuthProvider: 로그인 시도:', email);
    setError(null);
    setLoading(true);

    try {
      // FormData 형식으로 변환 (OAuth2 spec)
      const formData = new URLSearchParams();
      formData.append("username", email); // OAuth2는 username 필드 사용
      formData.append("password", password);

      console.log('AuthProvider: 로그인 API 요청');
      const response = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
        credentials: "include",  // 쿠키 포함
      });

      const data = await response.json();
      console.log('AuthProvider: 로그인 응답:', response.status, data);

      if (!response.ok) {
        throw new Error(data.detail || "로그인 실패");
      }

      // 토큰 저장
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        console.log('AuthProvider: 액세스 토큰 저장됨');
        console.log('AuthProvider: 토큰 내용 확인:', data.access_token.substring(0, 20) + '...');
      } else {
        console.error('AuthProvider: 응답에 access_token이 없습니다!', data);
      }
      
      // 사용자 정보 가져오기
      console.log('AuthProvider: 사용자 정보 요청');
      const userResponse = await fetch('http://localhost:8000/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        },
        credentials: "include",
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData);
        setIsLoggedIn(true);
        console.log('로그인 성공:', userData);
        console.log('사용자 역할:', userData.role);
        
        // 토큰 재확인
        const storedToken = localStorage.getItem("access_token");
        console.log('저장된 토큰 확인:', storedToken ? '존재함' : '없음');
      } else {
        console.error('사용자 정보 요청 실패:', userResponse.status, userResponse.statusText);
        throw new Error('사용자 정보를 가져올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('AuthProvider: 로그인 에러:', err);
      setError(err.message || "로그인 중 오류가 발생했습니다.");
      setUser(null);
      setIsLoggedIn(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 함수
  const register = async (username: string, email: string, password: string, role: 'student' | 'instructor' = 'student') => {
    console.log('AuthProvider: 회원가입 시도:', { username, email, role });
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
          role,
        }),
      });

      const data = await response.json();
      console.log('AuthProvider: 회원가입 응답:', response.status, data);

      if (!response.ok) {
        throw new Error(data.detail || "회원가입 실패");
      }

      // 회원가입 성공 (자동 로그인은 하지 않음)
      return data;
    } catch (err: any) {
      console.error('AuthProvider: 회원가입 에러:', err);
      setError(err.message || "회원가입 중 오류가 발생했습니다.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 함수
  const logout = () => {
    console.log('AuthProvider: 로그아웃 실행');
    // 토큰 제거
    localStorage.removeItem('access_token');
    
    // 쿠키 제거 (백엔드 로그아웃 API 호출)
    fetch('http://localhost:8000/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(err => {
      console.error('로그아웃 API 호출 실패:', err);
    });
    
    // 쿠키 직접 제거 (클라이언트 사이드)
    document.cookie = 'access_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    
    setUser(null);
    setIsLoggedIn(false);
    setError(null);
    setIsInitialized(false); // 로그아웃 시 초기화 상태 리셋
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
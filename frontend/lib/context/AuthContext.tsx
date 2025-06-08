'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { API_BASE_URL, AUTH_ENDPOINTS, fetchWithTimeout } from '../api/config';

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
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
            const cookieResponse = await fetch(`${API_BASE_URL}/auth/me`, {
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
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
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
          setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.');
        }
      } finally {
        console.log('AuthProvider: 인증 확인 완료, 로딩 상태 해제');
        setLoading(false);
        setIsInitialized(true);
      }
    };

    // 3초 타임아웃 설정으로 무한 로딩 방지
    const timeoutId = setTimeout(() => {
      if (loading && !isInitialized) {
        console.log('AuthProvider: 인증 확인 타임아웃, 로딩 상태 해제');
        setLoading(false);
        setIsInitialized(true);
        setError('서버 응답 시간이 초과되었습니다. 나중에 다시 시도하세요.');
      }
    }, 3000);

    checkAuth();

    // 클린업 함수
    return () => clearTimeout(timeoutId);
  }, [isInitialized, loading]); // isInitialized와 loading 의존성 추가

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

      console.log('AuthProvider: 로그인 API 요청 시작');
      console.log('AuthProvider: 요청 URL:', AUTH_ENDPOINTS.LOGIN);
      
      // 모든 요청 헤더 명시적 설정
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      };
      
      console.log('AuthProvider: 요청 헤더:', headers);
      console.log('AuthProvider: 요청 바디(요약):', `username=${email}, password=[MASKED]`);

      const response = await fetch(AUTH_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: headers,
        body: formData,
        credentials: "include",  // 쿠키 포함
        mode: "cors",  // CORS 모드 명시적 설정
      });

      console.log('AuthProvider: 로그인 응답 상태:', response.status);
      console.log('AuthProvider: 응답 헤더:', Object.fromEntries([...response.headers.entries()]));

      if (!response.ok) {
        // 응답을 텍스트로 먼저 읽어보고 JSON 파싱 시도
        const textResponse = await response.text();
        console.error('AuthProvider: 로그인 실패 응답 본문:', textResponse);
        
        let errorDetail = "로그인 실패";
        
        try {
          const data = JSON.parse(textResponse);
          errorDetail = data.detail || errorDetail;
        } catch (e) {
          console.error('응답을 JSON으로 파싱할 수 없습니다:', textResponse);
        }
        
        throw new Error(errorDetail);
      }

      // 응답 본문 확인
      const textResponse = await response.text();
      console.log('AuthProvider: 응답 본문(텍스트):', textResponse);
      
      // JSON으로 다시 파싱
      const data = textResponse ? JSON.parse(textResponse) : {};
      console.log('AuthProvider: 로그인 응답 데이터:', data);

      // 토큰 저장
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        console.log('AuthProvider: 액세스 토큰 저장됨');
        console.log('AuthProvider: 토큰 내용 확인:', data.access_token.substring(0, 20) + '...');
      } else {
        console.error('AuthProvider: 응답에 access_token이 없습니다!', data);
        throw new Error('서버 응답에 액세스 토큰이 없습니다.');
      }
      
      // 사용자 정보 가져오기
      console.log('AuthProvider: 사용자 정보 요청');
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: "include",
      });
      
      console.log('AuthProvider: 사용자 정보 응답 상태:', userResponse.status);
      
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
        // 응답 본문 확인
        try {
          const errorText = await userResponse.text();
          console.error('사용자 정보 오류 응답:', errorText);
        } catch (e) {
          console.error('사용자 정보 오류 응답을 읽을 수 없습니다');
        }
        throw new Error('사용자 정보를 가져올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('AuthProvider: 로그인 에러:', err);
      setError(err.message || "로그인 중 오류가 발생했습니다.");
      setUser(null);
      setIsLoggedIn(false);
      // 로컬 스토리지에서 토큰 삭제
      localStorage.removeItem("access_token");
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
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          role,
        }),
      });

      if (!response.ok) {
        // 응답을 텍스트로 먼저 읽어보고 JSON 파싱 시도
        const textResponse = await response.text();
        let errorDetail = "회원가입 실패";
        
        try {
          const data = JSON.parse(textResponse);
          errorDetail = data.detail || errorDetail;
        } catch (e) {
          console.error('응답을 JSON으로 파싱할 수 없습니다:', textResponse);
        }
        
        throw new Error(errorDetail);
      }

      const data = await response.json();
      console.log('AuthProvider: 회원가입 응답:', response.status, data);

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
    // 로컬 스토리지에서 토큰 제거
    localStorage.removeItem("access_token");
    
    // 백엔드 로그아웃 호출 (쿠키 제거)
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).catch(err => {
      console.error("로그아웃 API 호출 실패:", err);
    });
    
    // 상태 초기화
    setUser(null);
    setIsLoggedIn(false);
    console.log('로그아웃 완료');
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, isLoggedIn, login, register, logout, error }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
} 
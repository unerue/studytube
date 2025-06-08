// API 관련 설정값들을 정의하는 파일

// API 기본 설정
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const DEFAULT_TIMEOUT = 8000; // 8초
console.log('API 기본 URL:', API_BASE_URL);

// 인증 관련 API 엔드포인트
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  ME: `${API_BASE_URL}/auth/me`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`
};

// 비디오 관련 API 엔드포인트
export const VIDEO_ENDPOINTS = {
  LIST: `${API_BASE_URL}/videos`,
  DETAIL: (id: number) => `${API_BASE_URL}/videos/${id}`,
  UPLOAD: `${API_BASE_URL}/videos/upload`,
  TRANSCRIPT: (id: number) => `${API_BASE_URL}/transcript/${id}`,
  STT: `${API_BASE_URL}/api/stt`,
  STT_FIXED: `${API_BASE_URL}/api/stt-fixed`,
  STT_EXAMPLE: `${API_BASE_URL}/api/stt/example`,
};

// 자막 관련 API 엔드포인트
export const TRANSCRIPT_ENDPOINTS = {
  GET_TRANSCRIPTS: (videoId: string) => `${API_BASE_URL}/transcripts/${videoId}/all`,
  GET_TRANSCRIPT_BY_LANGUAGE: (videoId: string, language: string) => `${API_BASE_URL}/transcripts/${videoId}/${language}`,
  GENERATE: (videoId: string) => `${API_BASE_URL}/transcripts/generate/${videoId}`,
  TRANSLATE: (transcriptId: string) => `${API_BASE_URL}/transcripts/translate/${transcriptId}`
};

// 강의 관련 API 엔드포인트
export const LECTURE_ENDPOINTS = {
  LIST: `${API_BASE_URL}/lectures`,
  DETAIL: (id: number) => `${API_BASE_URL}/lectures/${id}`,
  CREATE: `${API_BASE_URL}/lectures`,
  JOIN: (id: number) => `${API_BASE_URL}/lectures/${id}/join`,
  LEAVE: (id: number) => `${API_BASE_URL}/lectures/${id}/leave`,
  PARTICIPANTS: (id: number) => `${API_BASE_URL}/lectures/${id}/participants`,
};

// 오디오 관련 API 엔드포인트
export const AUDIO_ENDPOINTS = {
  GET_AUDIO: (videoId: string, language: string) => `${API_BASE_URL}/audio/${videoId}/${language}`
};

// 질문-답변 관련 API 엔드포인트
export const QA_ENDPOINTS = {
  ASK: `${API_BASE_URL}/qa/ask`,
  HISTORY: (videoId: string) => `${API_BASE_URL}/qa/history/${videoId}`
};

// API 요청 헤더 생성 함수
export const getAuthHeaders = () => {
  let token = '';
  
  // 클라이언트 측에서만 localStorage 접근
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('access_token') || '';
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// 기본 API 요청 옵션
export const DEFAULT_FETCH_OPTIONS = {
  credentials: 'include' as RequestCredentials
}; 

// 웹소켓 엔드포인트
export const WEBSOCKET_ENDPOINTS = {
  LECTURE: (id: number) => `ws://localhost:8000/ws/lecture/${id}`,
  CHAT: (id: number) => `ws://localhost:8000/ws/chat/${id}`,
  DEBUG: `ws://localhost:8000/ws/debug`,
};

/**
 * 타임아웃 기능이 있는 fetch 함수
 * @param url API 요청 URL
 * @param options fetch 옵션
 * @param timeout 타임아웃 (밀리초)
 * @returns Promise<Response>
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  // AbortController 생성
  const controller = new AbortController();
  const { signal } = controller;

  // 타임아웃 설정
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    // 기존 옵션에 signal 추가
    const response = await fetch(url, {
      ...options,
      signal,
      ...DEFAULT_FETCH_OPTIONS
    });

    // 응답 성공 시 타임아웃 해제
    clearTimeout(timeoutId);
    
    // HTTP 에러 체크
    if (!response.ok) {
      let errorMessage = `API 오류: ${response.status} ${response.statusText}`;
      
      try {
        // 서버에서 보낸 에러 메시지 확인
        const errorData = await response.json();
        if (errorData && errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (e) {
        // 응답이 JSON이 아니거나 파싱 실패 시 무시
        console.error('오류 응답 파싱 실패:', e);
      }
      
      throw new Error(errorMessage);
    }
    
    return response;
  } catch (error) {
    // 타임아웃 해제
    clearTimeout(timeoutId);
    
    // AbortError를 타임아웃 에러로 변환
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`요청 시간 초과 (${timeout}ms)`);
    }
    
    // 그 외 에러는 그대로 던짐
    throw error;
  }
}

/**
 * API 요청 함수 (JSON 형식)
 * @param url API 요청 URL
 * @param options fetch 옵션
 * @param timeout 타임아웃 (밀리초)
 * @returns Promise<T>
 */
export async function fetchJSON<T>(
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  }, timeout);
  
  return response.json();
}

/**
 * API 에러 핸들러
 * @param error 발생한 에러
 * @returns 사용자 친화적인 에러 메시지
 */
export function handleApiError(error: unknown): string {
  if (error instanceof Error) {
    // 기본 에러 메시지 사용
    return error.message;
  }
  
  // 알 수 없는 에러 타입
  return '알 수 없는 오류가 발생했습니다.';
}
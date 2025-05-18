// API 관련 설정값들을 정의하는 파일

// 백엔드 API 기본 URL
export const API_BASE_URL = 'http://localhost:8000';

// 인증 관련 API 엔드포인트
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  ME: `${API_BASE_URL}/auth/me`,
  CHANGE_PASSWORD: `${API_BASE_URL}/auth/change-password`
};

// 비디오 관련 API 엔드포인트
export const VIDEO_ENDPOINTS = {
  MY_VIDEOS: `${API_BASE_URL}/videos/my`,
  AVAILABLE_VIDEOS: `${API_BASE_URL}/videos/available`,
  VIDEO_DETAIL: (videoId: string) => `${API_BASE_URL}/videos/${videoId}`,
  PROCESS_VIDEO: (videoId: string) => `${API_BASE_URL}/videos/${videoId}/process`,
  VIDEO_STATUS: (videoId: string) => `${API_BASE_URL}/videos/${videoId}/status`
};

// 자막 관련 API 엔드포인트
export const TRANSCRIPT_ENDPOINTS = {
  GET_TRANSCRIPTS: (videoId: string) => `${API_BASE_URL}/transcripts/${videoId}/all`,
  GET_TRANSCRIPT_BY_LANGUAGE: (videoId: string, language: string) => `${API_BASE_URL}/transcripts/${videoId}/${language}`,
  GENERATE: (videoId: string) => `${API_BASE_URL}/transcripts/generate/${videoId}`,
  TRANSLATE: (transcriptId: string) => `${API_BASE_URL}/transcripts/translate/${transcriptId}`
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
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// 기본 API 요청 옵션
export const DEFAULT_FETCH_OPTIONS = {
  credentials: 'include' as RequestCredentials
}; 
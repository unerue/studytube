
프론트엔드 코드베이스 분석을 통해 백엔드 요구사항을 설계하겠습니다.

# 백엔드 개발 요구사항

## 1. 인증 시스템

### 엔드포인트
- `POST /auth/register`: 회원가입
  - 요청 본문: `username`, `email`, `password`
  - 응답: 사용자 정보 (비밀번호 제외)
  
- `POST /auth/login`: 로그인
  - 요청 본문: OAuth2 형식 (username: 이메일, password)
  - 응답: `{ access_token, token_type }`
  - 기능: JWT 토큰 생성 및 HTTP 쿠키 설정

- `GET /auth/me`: 현재 로그인 사용자 정보 조회
  - 헤더: Bearer 토큰 또는 쿠키로 인증
  - 응답: 사용자 정보 (id, username, email)

- `POST /auth/change-password`: 비밀번호 변경
  - 요청 본문: `currentPassword`, `newPassword`
  - 인증 필요

### 데이터 모델
- User:
  - id: 고유 식별자
  - username: 사용자명
  - email: 이메일
  - hashed_password: 해시된 비밀번호
  - created_at: 생성 시간

## 2. 비디오 관리 시스템

### 엔드포인트
- `GET /videos/my`: 사용자가 추가한 영상 목록
  - 인증 필요
  - 응답: 영상 목록 배열

- `GET /videos/available`: 학습 가능한 모든 영상 목록
  - 인증 필요
  - 응답: 영상 목록 배열

- `GET /videos/{id}`: 특정 영상 상세 정보
  - 인증 필요
  - 응답: 영상 상세 정보 (제목, URL, 썸네일, 설명, 요약, 자막 등)

- `POST /videos`: 새 영상 추가
  - 요청 본문: 영상 정보 (URL, 제목 등)
  - 인증 필요

### 데이터 모델
- Video:
  - id: 고유 식별자
  - title: 영상 제목
  - url: 영상 URL (유튜브 등)
  - thumbnail_url: 썸네일 이미지 URL
  - description: 영상 설명
  - summary: AI 생성 요약
  - created_at: 생성 시간
  - user_id: 소유자 ID (외래키)
  - duration: 재생 시간 (초 단위 또는 "00:00" 형식)
  - transcript: 자막 정보 (한국어, 영어)

## 3. 질문-답변 시스템

### 엔드포인트
- `POST /qa/ask`: 영상에 대한 질문 생성
  - 요청 본문: `video_id`, `question`
  - 인증 필요
  - 응답: 질문-답변 정보 (`id`, `answer` 포함)

- `GET /qa/history/{video_id}`: 특정 영상에 대한 질문-답변 기록
  - 인증 필요
  - 응답: 질문-답변 목록 배열

### 데이터 모델
- QA:
  - id: 고유 식별자
  - video_id: 관련 영상 ID (외래키)
  - user_id: 질문한 사용자 ID (외래키)
  - question: 질문 내용
  - answer: 답변 내용
  - created_at: 생성 시간

## 4. 자막 및 번역 시스템

### 엔드포인트
- `/transcript/generate`: 영상에서 자막 생성
  - 요청 본문: `video_id`
  - 응답: 생성된 자막 정보

- `/transcript/translate`: 자막 번역
  - 요청 본문: `video_id`, `source_language`, `target_language`
  - 응답: 번역된 자막 정보

### 데이터 모델
- Transcript:
  - id: 고유 식별자
  - video_id: 관련 영상 ID (외래키)
  - language: 언어 코드
  - content: 자막 내용
  - timestamps: 타임스탬프 정보 (옵션)

## 5. 추가 기술 요구사항

### 인증 및 보안
- JWT 기반 인증 시스템
- 비밀번호 해싱 (bcrypt 등)
- CORS 설정 (프론트엔드 도메인 허용)
- HTTP-only 쿠키 지원

### 데이터베이스
- 관계형 데이터베이스 (PostgreSQL, SQLite 또는 MySQL)
- ORM 사용 (SQLModel, SQLAlchemy 등)

### AI 및 자연어 처리
- 질문-답변 시스템을 위한 AI 모델 통합
- 영상 콘텐츠 기반 질문 응답 생성
- 자동 자막 생성 및 번역 기능

### 성능 및 확장성
- 비동기 API 처리 (FastAPI 권장)
- 대용량 데이터 처리를 위한 최적화
- 캐싱 시스템 구현 (Redis 등)

## 6. API 응답 형식

각 엔드포인트는 다음과 같은 일관된 응답 형식을 유지해야 합니다:

### 성공 응답
```json
{
  "status": "success",
  "data": {
    // 실제 데이터
  }
}
```

### 오류 응답
```json
{
  "status": "error",
  "message": "오류 메시지",
  "code": "오류_코드" // 선택 사항
}
```

이 요구사항을 기반으로 백엔드를 개발하면 프론트엔드와 원활하게 통합할 수 있습니다. FastAPI 또는 다른 Python 웹 프레임워크를 사용하여 구현하는 것을 권장합니다.

# StudyTube

## 프로젝트 개요
한국 거주 외국인 학생을 위한 AI 기반 유튜브 학습 도우미 SaaS

## 폴더 구조
```
studytube/
├── frontend/         # Next.js + Tailwind CSS (프론트엔드)
├── backend/          # FastAPI (백엔드, MVC)
├── db/               # SQLite 초기화/마이그레이션
├── shared/           # (선택) 공통 타입/유틸
├── docker/           # Dockerfile, docker-compose 등
├── .gitignore
├── README.md
└── package.json      # pnpm 워크스페이스
```

## 기술 스택
- 프론트엔드: Next.js, Tailwind CSS, pnpm
- 백엔드: FastAPI, uvicorn, MVC 패턴
- DB: SQLite
- AI: OpenAI GPT-4 API
- 외부 API: YouTube API
- 인증: OAuth or 패스워드 해싱
- 배포: Docker, docker-compose

## 사전 요구사항

### 공통 요구사항
- Git
- Docker 및 docker-compose (Docker로 실행하려는 경우에만 필요)

### 프론트엔드 요구사항
- Node.js (14.x 이상)
- pnpm 또는 npm

### 백엔드 요구사항
- Python (3.8 이상)
- pip

## 설치 방법

### 1. 코드 클론
```bash
git clone <repository-url>
cd studytube
```

### 2. 프론트엔드 설치
```bash
# pnpm 설치 (아직 없는 경우)
npm install -g pnpm

# frontend 폴더로 이동
cd frontend

# 의존성 설치
pnpm install
# 또는
npm install

# 상위 폴더로 돌아가기
cd ..
```

### 3. 백엔드 설치
```bash
# backend 폴더로 이동
cd backend

# 가상환경 생성 및 활성화 (권장)
# macOS/Linux
python -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 상위 폴더로 돌아가기
cd ..
```

## 로컬에서 실행하는 방법

### 1. 프론트엔드 실행
```bash
# 별도 터미널에서
cd frontend
pnpm dev
# 또는
npm run dev
```
프론트엔드 서버가 http://localhost:3000 에서 실행됩니다.

### 2. 백엔드 실행
```bash
# 또 다른 터미널에서
cd backend

# 가상환경 활성화 (설치 시 생성한 경우)
# macOS/Linux
source venv/bin/activate
# Windows
venv\Scripts\activate

# 서버 실행
uvicorn app.main:app --reload
```
백엔드 서버가 http://localhost:8000 에서 실행됩니다.

## Docker로 실행하는 방법 (선택)
```bash
# 프로젝트 루트 폴더에서
cd docker
docker-compose up
```
이렇게 하면 프론트엔드와 백엔드 모두 Docker 컨테이너로 실행됩니다.

## 테스트 방법

### 프론트엔드 테스트
1. 웹 브라우저에서 http://localhost:3000 접속
2. "StudyTube에 오신 것을 환영합니다!" 메시지가 표시되는지 확인

### 백엔드 테스트
1. 웹 브라우저에서 http://localhost:8000 접속
2. `{"message":"StudyTube 백엔드 서버 동작 중!"}` JSON 응답이 표시되는지 확인
3. API 문서 확인: http://localhost:8000/docs 접속

## 주요 파일 설명

### 프론트엔드
- `frontend/app/page.tsx`: 메인 페이지 컴포넌트
- `frontend/app/layout.tsx`: 기본 레이아웃 설정
- `frontend/styles/globals.css`: 전역 스타일 (Tailwind CSS)

### 백엔드
- `backend/app/main.py`: 백엔드 메인 진입점 (FastAPI)
- `backend/requirements.txt`: Python 의존성 목록

### 기타
- `docker/docker-compose.yml`: Docker 컨테이너 설정

---

**참고**: 현재 이 프로젝트는 초기 뼈대만 구성되어 있으며, 실제 기능(로그인, 영상 입력, AI 연동 등)은 아직 구현되지 않았습니다. 이 README는 개발 환경 설정 및 테스트를 위한 가이드입니다. 
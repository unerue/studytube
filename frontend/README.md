# StudyTube 프론트엔드

StudyTube는 유튜브 영상을 AI가 분석하여 효과적인 학습을 도와주는 서비스입니다.
이 프로젝트는 Next.js 14.2.1, TypeScript, Tailwind CSS를 사용하여 구현되었습니다.

## 특징

- 유튜브 영상 URL을 입력하여 분석
- 회원 가입 및 로그인 기능
- React Context API를 이용한 상태 관리
- 반응형 디자인 (Tailwind CSS 적용)

## 시작하기

### 개발 환경 설정

```
pnpm create next-app my-app --typescript --tailwind --eslint
```
교수: professor@studytube.com / test123
학생: student1@studytube.com / test123


1. 레포지토리 클론
   ```
   git clone https://github.com/your-username/studytube.git
   cd studytube
   ```

2. 의존성 설치
   ```
   npm install
   ```

3. 개발 서버 실행
   ```
   npm run dev
   ```
   이제 브라우저에서 http://localhost:3000 으로 접속할 수 있습니다.

### 프로덕션 빌드

프로덕션용 빌드를 생성하려면:

```
npm run build
npm start
```

### Docker 실행

Docker를 이용한 실행:

```
docker build -t studytube-frontend .
docker run -p 3000:3000 studytube-frontend
```

## 프로젝트 구조

- `app/`: Next.js 앱 라우터 기반 페이지 컴포넌트
- `components/`: 재사용 가능한 UI 컴포넌트
- `lib/context/`: React Context API 관련 파일
- `styles/`: 전역 스타일 시트
- `public/`: 정적 파일

## 주요 기술
- Next.js
- Tailwind CSS
- pnpm

## 폴더 구조 예시
```
frontend/
├── app/ (or pages/)
├── components/
├── hooks/
├── utils/
├── styles/
└── public/
``` 

실시간 번역: Meta의 SEAMLESSM4T 
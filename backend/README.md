# backend (백엔드)

## 설명
FastAPI와 SQLModel 기반, 비동기 웹 API를 구현한 StudyTube 백엔드 프로젝트입니다.

## 주요 기술
- FastAPI: 최신 비동기 웹 프레임워크
- SQLModel: SQLAlchemy와 Pydantic을 통합한 ORM
- AsyncPG: PostgreSQL 비동기 드라이버
- uvicorn: ASGI 서버

## 주요 기능
- 사용자 인증 (JWT 기반)
- YouTube 영상 분석 및 요약
- AI 기반 질의응답

## 폴더 구조 (MVC)
```
backend/
├── app/
│   ├── main.py          # 애플리케이션 진입점
│   ├── models/          # SQLModel 모델 (Model+Schema 통합)
│   ├── views/           # API 라우팅 (View)
│   ├── controllers/     # 비즈니스 로직 (Controller)
│   ├── services/        # 외부 API, 비즈니스 로직 서비스
│   └── db/              # 데이터베이스 설정
└── requirements.txt     # 의존성 파일
```

## 실행 방법
```bash
# 가상 환경 활성화
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
uvicorn src.main:app --reload
```

## API 문서
서버 실행 후 다음 URL에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc 
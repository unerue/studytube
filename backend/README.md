# backend (백엔드)

## 설명
FastAPI 기반, MVC 패턴을 적용한 StudyTube 백엔드 프로젝트입니다.

## 주요 기술
- FastAPI
- uvicorn
- SQLite
- OpenAI API, YouTube API

## 폴더 구조 예시 (MVC)
```
backend/
├── app/
│   ├── main.py
│   ├── models/        # 모델(Model)
│   ├── views/         # 뷰(View, FastAPI 라우터)
│   ├── controllers/   # 컨트롤러(비즈니스 로직)
│   ├── schemas/       # Pydantic 스키마
│   ├── services/      # 외부 API, AI 등
│   └── db/            # DB 초기화, 세션 등
└── requirements.txt
``` 
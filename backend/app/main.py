from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer

from .db.database import engine, get_db, Base
from .models import User, Video, QAPair  # 모델들을 임포트하여 테이블 생성
from .views import auth, videos, qa
from .services.auth import get_current_user

# DB 테이블 생성
Base.metadata.create_all(bind=engine)

# OAuth2 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

app = FastAPI(
    title="StudyTube API",
    description="유튜브 영상 학습 도우미 API",
    version="0.1.0"
)

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 실제 배포시에는 허용 도메인만 지정
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(qa.router)

@app.get("/")
def read_root():
    return {"message": "StudyTube 백엔드 서버 동작 중!"}

# 현재 사용자 정보 조회 API (테스트용)
@app.get("/users/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return current_user 
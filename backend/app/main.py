from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import sqlite3
import os
import pathlib
from sqlmodel import Session, select

from app.db.database import init_db, get_db, DATABASE_URL, engine
from app.views import auth, videos, qa, transcript, audio
from app.services.auth import get_current_user, get_password_hash
from app.controllers.video_controller import initialize_static_videos
from app.models.user import User
from app.models.video import Video
from app.services.youtube import extract_thumbnail_from_video

# OAuth2 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# 기본 사용자 정보
DEFAULT_USER = {
    "username": "unerue",
    "email": "unerue@me.com",
    "password": "dngpgp33"
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 기존 DB 파일 삭제 (있으면)
    db_file_path = pathlib.Path(DATABASE_URL.replace("sqlite:///", ""))
    if db_file_path.exists():
        try:
            os.remove(db_file_path)
            print(f"기존 데이터베이스 파일 {db_file_path} 삭제됨")
        except Exception as e:
            print(f"DB 파일 삭제 실패: {e}")
    
    # 애플리케이션 시작 시 DB 초기화
    init_db()
    print("데이터베이스 새로 초기화됨")
    
    # 기본 사용자 생성
    with Session(engine) as db:
        # 기본 사용자 추가
        hashed_password = get_password_hash(DEFAULT_USER["password"])
        default_user = User(
            username=DEFAULT_USER["username"],
            email=DEFAULT_USER["email"],
            hashed_password=hashed_password
        )
        db.add(default_user)
        db.commit()
        db.refresh(default_user)
        print(f"기본 사용자 생성됨: {DEFAULT_USER['username']}")
        
        # static 폴더의 영상을 DB에 등록
        static_folder = pathlib.Path("static")
        thumbnail_dir = static_folder / "thumbnails"
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        if static_folder.exists() and static_folder.is_dir():
            video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
            
            for file_path in static_folder.iterdir():
                if file_path.is_file() and file_path.suffix.lower() in video_extensions:
                    url = f"static/{file_path.name}"
                    
                    # 1. DB에 먼저 저장 (썸네일 없이)
                    db_video = Video(
                        url=url,
                        title=file_path.stem,  # 파일 이름을 제목으로 사용
                        thumbnail_url="",  # 일단 빈 값
                        description=f"{file_path.name} 영상입니다.",
                        transcript="",
                        summary="",
                        user_id=default_user.id,
                        is_public=True,  # 공개 비디오로 설정
                        duration="00:00"  # 기본 값
                    )
                    db.add(db_video)
                    db.commit()
                    db.refresh(db_video)
                    print(f"비디오 등록됨: {file_path.name} (id={db_video.id})")
                    # 2. 썸네일 생성 (video_id 기준)
                    thumbnail_path = thumbnail_dir / f"{db_video.id}.jpg"
                    if not thumbnail_path.exists():
                        try:
                            print(f"썸네일 생성: {file_path} -> {thumbnail_path}")
                            extract_thumbnail_from_video(str(file_path), str(thumbnail_path), time=5)
                            print(f"썸네일 생성 성공: {thumbnail_path}")
                            # 3. DB에 썸네일 경로 업데이트
                            db_video.thumbnail_url = f"static/thumbnails/{db_video.id}.jpg"
                            db.add(db_video)
                            db.commit()
                        except Exception as e:
                            print(f"썸네일 생성 실패: {e}")
    
    yield
    # 애플리케이션 종료 시 필요한 정리 작업

app = FastAPI(
    title="StudyTube API",
    description="유튜브 영상 학습 도우미 API",
    version="0.1.0",
    lifespan=lifespan
)

# 정적 파일 서빙 설정
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS 미들웨어 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 오리진 허용 (개발 환경에서만 사용, 프로덕션에서는 특정 도메인 지정)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(qa.router)
app.include_router(transcript.router)
app.include_router(audio.router)

@app.get("/")
def read_root():
    return {"message": "StudyTube 백엔드 서버 동작 중!"}

# 현재 사용자 정보 조회 API (테스트용)
@app.get("/users/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return current_user 
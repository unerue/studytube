from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import sqlite3
import os
import pathlib
import random
from datetime import datetime, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.db.database import init_db, get_db, DATABASE_URL, engine
from app.views import auth, videos, qa, transcript, audio, lectures, websocket
from app.services.auth import get_current_user, get_password_hash
from app.controllers.video_controller import initialize_static_videos
from app.models.user import User, UserRole
from app.models.video import Video
from app.models.lecture import Lecture, LectureStatus, LectureParticipant
from app.services.youtube import extract_thumbnail_from_video

# OAuth2 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# 테스트 계정들
TEST_ACCOUNTS = [
    {
        "username": "professor",
        "email": "professor@syu.ac.kr",
        "password": "1234",
        "role": UserRole.INSTRUCTOR
    },
    {
        "username": "student1",
        "email": "student1@syu.ac.kr", 
        "password": "1234",
        "role": UserRole.STUDENT
    },
    {
        "username": "student2",
        "email": "student2@syu.ac.kr",
        "password": "1234", 
        "role": UserRole.STUDENT
    },
    {
        "username": "student3",
        "email": "student3@syu.ac.kr",
        "password": "1234",
        "role": UserRole.STUDENT
    }
]

# 테스트 강의 데이터
TEST_LECTURES = [
    {
        "title": "차량용 신호등 인식 AI 개발",
        "description": "딥러닝을 활용한 실시간 신호등 인식 시스템 구현에 대해 알아봅니다. 컴퓨터 비전과 머신러닝 기법을 활용하여 자율주행차에 필요한 신호등 인식 기술을 개발합니다.",
        "max_participants": 50,
        "status": LectureStatus.LIVE,
        "scheduled_start": datetime.now() - timedelta(minutes=30)  # 30분 전 시작 (진행중)
    },
    {
        "title": "머신러닝 기초와 응용",
        "description": "머신러닝의 기본 개념부터 실제 응용 사례까지 다룹니다. 지도학습, 비지도학습, 강화학습의 원리와 실제 프로젝트 구현 방법을 학습합니다.",
        "max_participants": 40,
        "status": LectureStatus.SCHEDULED,
        "scheduled_start": datetime.now() + timedelta(hours=2)  # 2시간 후 시작 예정
    },
    {
        "title": "웹 개발 실습",
        "description": "React와 FastAPI를 활용한 풀스택 웹 개발 실습입니다. 현대적인 웹 개발 기술 스택을 활용하여 실제 서비스를 구현해봅니다.",
        "max_participants": 30,
        "status": LectureStatus.ENDED,
        "scheduled_start": datetime.now() - timedelta(days=1)  # 1일 전에 종료
    },
    {
        "title": "데이터 사이언스 입문",
        "description": "Python을 활용한 데이터 분석과 시각화 기법을 학습합니다. 판다스, 넘파이, 맷플롯립 등의 라이브러리를 활용한 실무 중심의 강의입니다.",
        "max_participants": 60,
        "status": LectureStatus.SCHEDULED,
        "scheduled_start": datetime.now() + timedelta(days=1, hours=3)  # 내일 오후 시작 예정
    },
    {
        "title": "클라우드 컴퓨팅과 DevOps",
        "description": "AWS를 활용한 클라우드 서비스 구축과 Docker, Kubernetes를 활용한 DevOps 실습을 진행합니다.",
        "max_participants": 35,
        "status": LectureStatus.LIVE,
        "scheduled_start": datetime.now() - timedelta(minutes=15)  # 15분 전 시작 (진행중)
    }
]

def create_test_data_sync():
    """동기 방식으로 테스트 데이터 생성"""
    from sqlmodel import Session, create_engine
    
    # 동기 엔진 생성
    sync_db_url = DATABASE_URL.replace("sqlite+aiosqlite://", "sqlite://")
    sync_engine = create_engine(sync_db_url)
    
    with Session(sync_engine) as session:
        instructor_user_id = None
        
        # 테스트 계정들 생성
        for account in TEST_ACCOUNTS:
            hashed_password = get_password_hash(account["password"])
            user = User(
                username=account["username"],
                email=account["email"],
                hashed_password=hashed_password,
                role=account["role"]
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            print(f"테스트 계정 생성됨: {account['username']} ({account['role']})")
            
            # 강사 계정 ID 저장
            if account["role"] == UserRole.INSTRUCTOR:
                instructor_user_id = user.id
        
        # 학생 계정들의 ID 조회
        result = session.exec(select(User.id).where(User.role == UserRole.STUDENT))
        student_ids = list(result.all())
        
        # 테스트 강의 데이터 생성
        if instructor_user_id and student_ids:
            for lecture_data in TEST_LECTURES:
                lecture = Lecture(
                    title=lecture_data["title"],
                    description=lecture_data["description"],
                    instructor_id=instructor_user_id,
                    max_participants=lecture_data["max_participants"],
                    status=lecture_data["status"],
                    scheduled_start=lecture_data["scheduled_start"]
                )
                session.add(lecture)
                session.commit()
                session.refresh(lecture)
                print(f"테스트 강의 생성됨: {lecture.title} ({lecture.status})")
                
                # 랜덤 참여자 추가
                num_participants = random.randint(1, min(3, len(student_ids)))
                selected_student_ids = random.sample(student_ids, num_participants)
                
                for student_id in selected_student_ids:
                    participant = LectureParticipant(
                        lecture_id=lecture.id,
                        student_id=student_id,
                        joined_at=datetime.now() - timedelta(minutes=random.randint(5, 30)),
                        is_active=True
                    )
                    session.add(participant)
                
                session.commit()
                print(f"강의 '{lecture.title}'에 {num_participants}명의 참여자 추가됨")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 기존 DB 파일 삭제 (있으면)
    db_file_path = pathlib.Path(DATABASE_URL.replace("sqlite+aiosqlite:///", ""))
    if db_file_path.exists():
        try:
            os.remove(db_file_path)
            print(f"기존 데이터베이스 파일 {db_file_path} 삭제됨")
        except Exception as e:
            print(f"DB 파일 삭제 실패: {e}")
    
    # 애플리케이션 시작 시 DB 초기화
    await init_db()
    print("데이터베이스 새로 초기화됨")
    
    # 테스트 데이터를 동기 방식으로 생성
    create_test_data_sync()
    
    # static 폴더의 영상을 DB에 등록 (비동기 방식)
    async with AsyncSession(engine) as db:
        static_folder = pathlib.Path("static")
        thumbnail_dir = static_folder / "thumbnails"
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        if static_folder.exists() and static_folder.is_dir():
            video_extensions = ['.mp4', '.avi', '.mov', '.mkv']
            
            # 첫 번째 사용자(교수)를 기본 사용자로 설정
            result = await db.exec(select(User).where(User.username == "professor"))
            default_user = result.first()
            if not default_user:
                print("기본 사용자를 찾을 수 없습니다.")
                return
            
            # ID를 별도 변수로 저장하여 lazy loading 문제 회피
            default_user_id = default_user.id
            
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
                        user_id=default_user_id,  # 별도 변수 사용
                        is_public=True,  # 공개 비디오로 설정
                        duration="00:00"  # 기본 값
                    )
                    db.add(db_video)
                    await db.commit()
                    await db.refresh(db_video)
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
                            await db.commit()
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
app.include_router(lectures.router)
app.include_router(websocket.router)

@app.get("/")
def read_root():
    return {"message": "StudyTube 백엔드 서버 동작 중!"}

@app.get("/test-accounts")
def get_test_accounts():
    """테스트 계정 목록 반환"""
    return [
        {
            "username": account["username"],
            "email": account["email"], 
            "password": account["password"],
            "role": account["role"]
        }
        for account in TEST_ACCOUNTS
    ]

# 현재 사용자 정보 조회 API (테스트용)
@app.get("/users/me")
async def read_users_me(current_user = Depends(get_current_user)):
    return current_user 
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
import logging
import logging.config

from src.db.database import init_db, get_db, DATABASE_URL, engine
from src.core.settings import settings
from src.views import auth, videos, qa, transcript, audio, lectures, websocket
from src.controllers import stt_controller, stt_controller_fixed
from src.services.auth import get_current_user, get_password_hash
from src.controllers.video_controller import initialize_static_videos
from src.models.user import User, UserRole
from src.models.video import Video
from src.models.lecture import Lecture, LectureStatus, LectureParticipant
from src.services.youtube import extract_thumbnail_from_video

# 로깅 설정
logging.config.dictConfig({
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'loggers': {
        '': {  # 루트 로거
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True
        },
        'src': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False
        },
    }
})

logger = logging.getLogger(__name__)

# OAuth2 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# 테스트 계정들
TEST_ACCOUNTS = [
    {
        "username": "professor",
        "email": "professor@syu.ac.kr",
        "password": "123456",
        "role": UserRole.INSTRUCTOR
    },
    {
        "username": "student1",
        "email": "student1@syu.ac.kr",
        "password": "123456",
        "role": UserRole.STUDENT
    },
    {
        "username": "student2",
        "email": "student2@syu.ac.kr",
        "password": "123456",
        "role": UserRole.STUDENT
    },
    {
        "username": "student3",
        "email": "student3@syu.ac.kr",
        "password": "123456",
        "role": UserRole.STUDENT
    }
]

# 테스트 강의 데이터
TEST_LECTURES = [
    {
        "title": "영어회화 기초",
        "description": "영어 회화의 기초를 배우는 강의입니다.",
        "max_participants": 30,
        "status": LectureStatus.SCHEDULED,
        "scheduled_start": datetime.now() + timedelta(days=1)  # 내일 시작
    },
    {
        "title": "인공지능 개론",
        "description": "인공지능의 기본 개념과 활용 방법을 배웁니다.",
        "max_participants": 20,
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
            # 이미 존재하는 이메일인지 확인
            existing_user = session.exec(select(User).where(User.email == account["email"])).first()
            
            if existing_user:
                logger.info(f"기존 계정 사용: {account['username']} ({account['role']})")
                # 강사 계정 ID 저장
                if account["role"] == UserRole.INSTRUCTOR:
                    instructor_user_id = existing_user.id
                continue
                
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
            logger.info(f"테스트 계정 생성됨: {account['username']} ({account['role']})")

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
                logger.info(f"테스트 강의 생성됨: {lecture.title} ({lecture.status})")

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
                logger.info(f"강의 '{lecture.title}'에 {num_participants}명의 참여자 추가됨")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("애플리케이션 시작 중...")
    
    # 기존 DB 파일 삭제 (있으면)
    db_path_str = DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("./", "")
    db_file_path = pathlib.Path(db_path_str)
    if db_file_path.exists():
        try:
            os.remove(db_file_path)
            logger.info(f"기존 데이터베이스 파일 {db_file_path} 삭제됨")
        except Exception as e:
            logger.error(f"DB 파일 삭제 실패: {e}")

    # 애플리케이션 시작 시 DB 초기화
    try:
        await init_db()
        logger.info("데이터베이스 새로 초기화됨")

        # 테스트 데이터를 동기 방식으로 생성
        create_test_data_sync()
        logger.info("테스트 데이터 생성 완료")

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
                    logger.warning("기본 사용자를 찾을 수 없습니다.")
                    yield
                    return

                # ID를 별도 변수로 저장하여 lazy loading 문제 회피
                default_user_id = default_user.id

                for file_path in static_folder.iterdir():
                    if file_path.is_file() and file_path.suffix.lower() in video_extensions:
                        url = f"static/{file_path.name}"

                        # URL로 이미 존재하는 비디오 확인
                        result = await db.exec(select(Video).where(Video.url == url))
                        existing_video = result.first()
                        
                        if existing_video:
                            logger.info(f"이미 등록된 비디오 스킵: {file_path.name} (id={existing_video.id})")
                            db_video = existing_video
                        else:
                            # 새 비디오 등록 (썸네일 없이)
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
                            logger.info(f"비디오 등록됨: {file_path.name} (id={db_video.id})")
                        # 2. 썸네일 생성 (video_id 기준)
                        thumbnail_path = thumbnail_dir / f"{db_video.id}.jpg"
                        if not thumbnail_path.exists():
                            try:
                                logger.info(f"썸네일 생성: {file_path} -> {thumbnail_path}")
                                extract_thumbnail_from_video(str(file_path), str(thumbnail_path), time=5)
                                logger.info(f"썸네일 생성 성공: {thumbnail_path}")
                                # 3. DB에 썸네일 경로 업데이트
                                db_video.thumbnail_url = f"static/thumbnails/{db_video.id}.jpg"
                                db.add(db_video)
                                await db.commit()
                            except Exception as e:
                                logger.error(f"썸네일 생성 실패: {e}")
                        elif not db_video.thumbnail_url:
                            # 썸네일이 이미 존재하지만 DB에 경로가 없는 경우 경로 업데이트
                            logger.info(f"기존 썸네일 발견, DB 경로 업데이트: {thumbnail_path}")
                            db_video.thumbnail_url = f"static/thumbnails/{db_video.id}.jpg"
                            db.add(db_video)
                            await db.commit()
    except Exception as e:
        logger.critical(f"애플리케이션 초기화 실패: {e}", exc_info=True)
        raise

    logger.info("애플리케이션 초기화 완료")
    yield

    # 애플리케이션 종료 시 필요한 정리 작업
    logger.info("애플리케이션 종료 중...")

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
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS 설정: {settings.cors_origins}")

# 라우터 등록
app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(qa.router)
app.include_router(transcript.router)
app.include_router(audio.router)
app.include_router(lectures.router)
app.include_router(websocket.router)

# STT 및 번역 라우터 추가
app.include_router(stt_controller.router, prefix="/api/stt", tags=["STT"])
app.include_router(stt_controller_fixed.router, prefix="/api/stt-fixed", tags=["STT-Fixed"])


@app.get("/")
def read_root():
    logger.debug("루트 경로 접근")
    return {"message": "StudyTube 백엔드 서버 동작 중!"}


@app.get("/test-accounts")
def get_test_accounts():
    """테스트 계정 목록 반환"""
    logger.debug("테스트 계정 목록 요청")
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
    logger.debug(f"현재 사용자 정보 요청: {current_user.username}")
    return current_user

from sqlmodel import Session, select
from fastapi import HTTPException, status
import os
import pathlib
from typing import List, Optional

from src.models.video import Video, VideoCreate, VideoRead, VideoReadDetailed
from src.models.user import User
from src.services.youtube import extract_video_id, get_video_info, get_video_transcript, extract_thumbnail_from_video
from src.services.ai import summarize_text

# YouTube API 키 (실제 프로젝트에서는 환경변수로 관리)
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "your-youtube-api-key")

# 영상 추가
async def add_video(db: Session, video_data: VideoCreate, user_id: int):
    # 유튜브 URL에서 영상 ID 추출
    video_id = extract_video_id(video_data.url)
    if not video_id:
        # static 폴더에 저장된 로컬 영상일 수 있음
        # 예: url이 static/xxx.mp4 형태
        if video_data.url.startswith('static/'):
            video_path = pathlib.Path(video_data.url)
            if not video_path.is_absolute():
                video_path = pathlib.Path('backend') / video_data.url
            # 썸네일 경로
            thumbnail_dir = pathlib.Path('backend/static/thumbnails')
            thumbnail_dir.mkdir(parents=True, exist_ok=True)
            thumbnail_path = thumbnail_dir / f"{video_path.stem}.jpg"
            try:
                extract_thumbnail_from_video(str(video_path), str(thumbnail_path), time=5)
                thumbnail_url = f"static/thumbnails/{video_path.stem}.jpg"
            except Exception as e:
                thumbnail_url = ""
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="유효하지 않은 YouTube URL 또는 지원하지 않는 영상 경로입니다."
            )
        # DB에 영상 저장
        db_video = Video(
            url=video_data.url,
            title=video_data.url,
            thumbnail_url=thumbnail_url,
            description="로컬 영상입니다.",
            duration="00:00",
            transcript="",
            summary="",
            user_id=user_id,
            is_public=False
        )
        db.add(db_video)
        db.commit()
        db.refresh(db_video)
        return db_video

    # 기존 영상 확인
    statement = select(Video).where(Video.url == video_data.url)
    existing_video = db.exec(statement).first()
    if existing_video:
        return existing_video

    # 유튜브 API에서 영상 정보 가져오기
    try:
        video_info = await get_video_info(video_id, YOUTUBE_API_KEY)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"YouTube API 오류: {str(e)}"
        )

    # 자막 가져오기
    try:
        transcript = await get_video_transcript(video_id)
    except Exception as e:
        transcript = "자막을 가져올 수 없습니다."

    # AI 요약 생성
    try:
        summary = await summarize_text(transcript)
    except Exception as e:
        summary = "요약을 생성할 수 없습니다."

    # DB에 영상 저장
    db_video = Video(
        url=video_data.url,
        title=video_info.get("title", "제목 없음"),
        thumbnail_url=video_info.get("thumbnail_url", ""),
        description=video_info.get("description", ""),
        duration=video_info.get("duration", "00:00"),
        transcript=transcript,
        summary=summary,
        user_id=user_id,
        is_public=False  # 기본적으로 비공개
    )

    db.add(db_video)
    db.commit()
    db.refresh(db_video)

    return db_video

# 사용자의 영상 목록 가져오기
async def get_user_videos(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    statement = select(Video).where(Video.user_id == user_id).offset(skip).limit(limit)
    # 동기적으로 쿼리 실행
    results = db.execute(statement)
    return results.scalars().all()

# 모든 공개 영상 목록 가져오기
async def get_available_videos(db: Session, skip: int = 0, limit: int = 100):
    try:
        statement = select(Video).where(Video.is_public == True).offset(skip).limit(limit)
        # 동기적으로 쿼리 실행
        results = db.execute(statement)
        return results.scalars().all()
    except Exception as e:
        # 디버깅용 예외 출력
        print(f"get_available_videos 오류: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"영상 목록 조회 중 오류 발생: {str(e)}"
        )

# 특정 영상 세부 정보 가져오기
async def get_video_detail(db: Session, video_id: int, user_id: int):
    statement = select(Video).where(Video.id == video_id)
    # 동기적으로 쿼리 실행
    results = db.execute(statement)
    video = results.scalars().first()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영상을 찾을 수 없습니다."
        )

    # 공개 영상이 아니고 본인 영상이 아닌 경우 권한 검사
    if not video.is_public and video.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 영상에 접근할 권한이 없습니다."
        )

    return video

# static 폴더의 영상 목록화
async def initialize_static_videos(db: Session, admin_user_id: int):
    # static 폴더 경로
    static_folder = pathlib.Path("static")

    # static 폴더가 존재하는지 확인
    if not static_folder.exists() or not static_folder.is_dir():
        return []

    videos = []

    # 지원하는 비디오 확장자
    video_extensions = ['.mp4', '.avi', '.mov', '.mkv']

    # static 폴더의 모든 파일을 확인
    for file_path in static_folder.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in video_extensions:
            url = f"static/{file_path.name}"
            statement = select(Video).where(Video.url == url)
            existing_video = db.exec(statement).first()
            if existing_video:
                videos.append(existing_video)
                continue
            # 썸네일 생성
            thumbnail_dir = pathlib.Path('static/thumbnails')
            thumbnail_dir.mkdir(parents=True, exist_ok=True)
            thumbnail_path = thumbnail_dir / f"{file_path.stem}.jpg"
            try:
                extract_thumbnail_from_video(str(file_path), str(thumbnail_path), time=5)
                thumbnail_url = f"static/thumbnails/{file_path.stem}.jpg"
            except Exception as e:
                thumbnail_url = ""
            # 새 비디오 생성
            db_video = Video(
                url=url,
                title=file_path.stem,  # 파일 이름을 제목으로 사용
                thumbnail_url=thumbnail_url,
                description=f"{file_path.name} 영상입니다.",
                transcript="",  # 자막 정보 (실제로는 자막 추출 로직 필요)
                summary="",  # 요약 정보 (실제로는 AI 요약 생성 필요)
                user_id=admin_user_id,
                is_public=True,  # 공개 비디오로 설정
                duration="00:00"  # 기본 duration 추가
            )
            db.add(db_video)
            db.commit()
            db.refresh(db_video)
            videos.append(db_video)

    return videos

# 영상 공개/비공개 설정 변경
async def update_video_visibility(db: Session, video_id: int, user_id: int, is_public: bool):
    statement = select(Video).where(Video.id == video_id)
    # 동기적으로 쿼리 실행
    results = db.execute(statement)
    video = results.scalars().first()

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영상을 찾을 수 없습니다."
        )

    # 본인 영상이 아닌 경우 권한 검사
    if video.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 영상을 수정할 권한이 없습니다."
        )

    video.is_public = is_public
    db.add(video)
    db.commit()
    db.refresh(video)

    return video

def update_video_processing_status(db: Session, video_id: int, is_processed: bool, error: str = None):
    """
    비디오의 AI 처리 상태를 업데이트합니다.

    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        is_processed: 처리 완료 여부
        error: 오류 메시지 (실패 시)
    """
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="비디오를 찾을 수 없습니다."
        )

    video.is_processed = is_processed
    video.processing_error = error

    db.add(video)
    db.commit()
    db.refresh(video)

    return video

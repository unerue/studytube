from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import os

from ..schemas.video import VideoCreate, VideoResponse
from ..models.video import Video
from ..models.user import User
from ..services.youtube import extract_video_id, get_video_info, get_video_transcript
from ..services.ai import summarize_text

# YouTube API 키 (실제 프로젝트에서는 환경변수로 관리)
YOUTUBE_API_KEY = "your-youtube-api-key"

# 영상 추가
async def add_video(db: Session, video_data: VideoCreate, user_id: int):
    # 유튜브 URL에서 영상 ID 추출
    video_id = extract_video_id(video_data.url)
    if not video_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 YouTube URL입니다."
        )
    
    # 기존 영상 확인
    existing_video = db.query(Video).filter(Video.url == video_data.url).first()
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
        transcript=transcript,
        summary=summary,
        user_id=user_id
    )
    
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    
    return db_video

# 사용자의 영상 목록 가져오기
def get_user_videos(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(Video).filter(Video.user_id == user_id).offset(skip).limit(limit).all()

# 특정 영상 세부 정보 가져오기
def get_video_detail(db: Session, video_id: int, user_id: int):
    video = db.query(Video).filter(Video.id == video_id).first()
    
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영상을 찾을 수 없습니다."
        )
    
    # 공개 영상이 아니고 본인 영상이 아닌 경우 권한 검사 (추후 구현)
    
    return video 
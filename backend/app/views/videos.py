from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from ..db.database import get_db
from ..schemas.video import VideoCreate, VideoResponse, VideoDetail
from ..controllers.video_controller import add_video, get_user_videos, get_video_detail
from ..services.auth import get_current_user

router = APIRouter(
    prefix="/videos",
    tags=["영상"],
    responses={401: {"description": "인증되지 않음"}}
)

# 영상 추가
@router.post("/", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def create_video(
    video_data: VideoCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await add_video(db, video_data, current_user.id)

# 내 영상 목록 조회
@router.get("/my", response_model=List[VideoResponse])
async def list_my_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_user_videos(db, current_user.id, skip, limit)

# 영상 상세 조회
@router.get("/{video_id}", response_model=VideoDetail)
async def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return get_video_detail(db, video_id, current_user.id) 
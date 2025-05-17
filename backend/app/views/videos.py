from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional, Dict
from sqlmodel import Session, select
from sqlalchemy.orm import joinedload

from app.db.database import get_db
from app.models.video import VideoCreate, VideoRead, VideoReadDetailed, Video
from app.controllers.video_controller import (
    add_video, get_user_videos, get_video_detail, 
    get_available_videos, initialize_static_videos,
    update_video_visibility, update_video_processing_status
)
from app.controllers.media_controller import process_video_complete
from app.services.auth import get_current_user
from app.services.tts_service import get_supported_languages
from app import schemas

router = APIRouter(
    prefix="/videos",
    tags=["영상"],
    responses={401: {"description": "인증되지 않음"}}
)

# 영상 추가
@router.post("/", response_model=VideoRead, status_code=status.HTTP_201_CREATED)
async def create_video(
    video_data: VideoCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await add_video(db, video_data, current_user.id)

# 내 영상 목록 조회
@router.get("/my", response_model=List[VideoRead])
async def list_my_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await get_user_videos(db, current_user.id, skip, limit)

# 학습 가능한 모든 영상 목록 조회 (인증 없이도 접근 가능)
@router.get("/available", response_model=List[VideoRead])
async def list_available_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    return await get_available_videos(db, skip, limit)

# static 폴더의 영상 초기화 및 목록화 (관리자 전용)
@router.post("/initialize-static", response_model=List[VideoRead])
async def initialize_static_video_list(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 실제 구현에서는 관리자 권한 확인 필요
    return await initialize_static_videos(db, current_user.id)

# 영상 공개/비공개 설정 변경
@router.patch("/{video_id}/visibility", response_model=VideoRead)
async def set_video_visibility(
    video_id: int,
    is_public: bool,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await update_video_visibility(db, video_id, current_user.id, is_public)

# 영상 상세 조회
@router.get("/{video_id}", response_model=VideoReadDetailed)
async def get_video(
    video_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await get_video_detail(db, video_id, current_user.id)

# 영상 AI 처리 시작
@router.post("/{video_id}/process", response_model=schemas.VideoProcessResponse)
async def process_video(
    video_id: int,
    target_language: Optional[str] = "ko",  # 기본 언어는 한국어
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 영상 존재 및 소유자 확인
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="비디오를 찾을 수 없습니다."
        )
    
    if video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 비디오의 소유자만 처리할 수 있습니다."
        )
    
    # 지원 언어 확인
    supported_langs = get_supported_languages()
    if target_language not in supported_langs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 언어입니다. 지원 언어: {', '.join(supported_langs.keys())}"
        )
    
    # 이미 처리 중이거나 완료된 경우 확인
    if video.is_processed:
        return {"status": "completed", "message": "이미 처리가 완료된 비디오입니다."}
    
    # 처리 상태 초기화
    video.processing_error = None
    db.add(video)
    db.commit()
    
    # 백그라운드에서 AI 처리 시작
    background_tasks.add_task(process_video_complete, db, video_id, target_language)
    
    return {"status": "processing", "message": f"비디오 처리가 시작되었습니다. 대상 언어: {supported_langs[target_language]}"}

# 영상 AI 처리 상태 확인
@router.get("/{video_id}/status", response_model=schemas.VideoProcessStatus)
async def get_video_status(
    video_id: int,
    language: Optional[str] = None,  # 특정 언어 상태만 확인하고 싶을 때
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 영상 존재 및 소유자 확인
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="비디오를 찾을 수 없습니다."
        )
    
    # 관계 로드를 위한 쿼리
    video_with_relations = db.exec(
        select(Video)
        .where(Video.id == video_id)
        .options(
            joinedload(Video.transcripts),
            joinedload(Video.audios)
        )
    ).first()
    
    # 특정 언어의 상태만 확인할 경우
    if language:
        return {
            "is_processed": video.is_processed,
            "error": video.processing_error,
            "has_transcript": any(t.is_processed and t.language == "ko" for t in video_with_relations.transcripts),
            "has_translation": any(t.is_processed and t.language == language for t in video_with_relations.transcripts),
            "has_tts": any(a.is_processed and a.language == language for a in video_with_relations.audios)
        }
    
    # 모든 언어 상태 확인
    # 처리된 언어 목록 구성
    processed_languages = set()
    for transcript in video_with_relations.transcripts:
        if transcript.is_processed and transcript.language != "ko":
            processed_languages.add(transcript.language)
    
    # 각 언어별 상태 구성
    language_statuses = {}
    for lang in processed_languages:
        language_statuses[lang] = {
            "has_transcript": True,
            "has_tts": any(a.is_processed and a.language == lang for a in video_with_relations.audios)
        }
    
    # 전체 상태 응답 구성
    return {
        "is_processed": video.is_processed,
        "error": video.processing_error,
        "has_transcript": any(t.is_processed and t.language == "ko" for t in video_with_relations.transcripts),
        "has_translation": any(t.is_processed and t.language != "ko" for t in video_with_relations.transcripts),
        "has_tts": any(a.is_processed for a in video_with_relations.audios),
        "languages": language_statuses
    }

# 사용 가능한 언어 목록 조회
@router.get("/languages", response_model=Dict[str, str])
async def list_supported_languages():
    """
    AI 처리에 지원되는 언어 목록을 반환합니다.
    """
    return get_supported_languages() 
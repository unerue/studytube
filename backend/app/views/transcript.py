from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlmodel import Session, select
from typing import List, Dict
from fastapi.responses import JSONResponse
import os
import json

from app.db.database import get_db
from app.models.video import Video
from app.models.transcript import Transcript
from app.controllers.media_controller import (
    process_video_transcript, 
    translate_video_transcript,
    generate_audio_from_transcript
)
from app.controllers.transcript_controller import get_video_transcripts
from app.services.auth import get_current_user
from app.services.tts_service import get_supported_languages
from app.utils.filesystem import get_transcript_path

router = APIRouter(
    prefix="/transcripts",
    tags=["자막"],
    responses={401: {"description": "인증되지 않음"}}
)

# 비디오의 자막 목록 조회
@router.get("/{video_id}/all")
async def get_transcripts(
    video_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    특정 비디오의 모든 자막을 조회합니다.
    """
    return await get_video_transcripts(db, video_id)

# 원본 자막 생성 요청
@router.post("/{video_id}/ko")
async def create_ko_transcript(
    video_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 비동기 작업으로 자막 생성
    background_tasks.add_task(process_video_transcript, db, video_id, "ko")
    
    return {"message": "자막 생성 작업이 시작되었습니다."}

# 자막 번역 요청
@router.post("/{video_id}/translate/{target_lang}")
async def translate_transcript(
    video_id: int,
    target_lang: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # 번역 지원 언어 확인
    supported_langs = get_supported_languages()
    if target_lang not in supported_langs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 언어입니다. 지원 언어: {', '.join(supported_langs.keys())}"
        )
    
    # 비동기 작업으로 자막 번역
    background_tasks.add_task(translate_video_transcript, db, video_id, "ko", target_lang)
    
    return {"message": f"{supported_langs[target_lang]}로 자막 번역 작업이 시작되었습니다."}

# 음성 합성 요청
@router.post("/{video_id}/tts/{language}")
async def generate_tts(
    video_id: int,
    language: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # TTS 지원 언어 확인
    supported_langs = get_supported_languages()
    if language not in supported_langs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 언어입니다. 지원 언어: {', '.join(supported_langs.keys())}"
        )
    
    # 비동기 작업으로 TTS 생성
    background_tasks.add_task(generate_audio_from_transcript, db, video_id, language)
    
    return {"message": f"{supported_langs[language]} 음성 생성 작업이 시작되었습니다."}

# 지원 언어 목록 조회
@router.get("/languages")
async def list_supported_languages():
    """
    지원하는 언어 목록을 반환합니다.
    """
    return get_supported_languages()

# 자막/음성 처리 원스톱 API (모든 처리를 한 번에 수행)
@router.post("/{video_id}/process/{target_lang}")
async def process_transcript_and_audio(
    video_id: int,
    target_lang: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    자막 추출, 번역, 음성 합성을 한 번에 처리합니다.
    
    1. 원본 자막 생성
    2. 대상 언어로 자막 번역
    3. 원본 및 번역 자막의 TTS 생성
    """
    # 지원 언어 확인
    supported_langs = get_supported_languages()
    if target_lang not in supported_langs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"지원하지 않는 언어입니다. 지원 언어: {', '.join(supported_langs.keys())}"
        )
    
    # 비디오 확인
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="비디오를 찾을 수 없습니다."
        )
    
    # 소유자 확인
    if video.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 비디오의 소유자만 처리할 수 있습니다."
        )
    
    # 비동기 작업 등록
    async def process_all():
        # 1. 원본 자막 생성
        ko_transcript = await process_video_transcript(db, video_id, "ko")
        
        # 2. 대상 언어로 자막 번역
        translated_transcript = await translate_video_transcript(db, video_id, "ko", target_lang)
        
        # 3. 원본 음성 생성 (추가적으로 원하는 경우)
        # await generate_audio_from_transcript(db, video_id, "ko")
        
        # 4. 번역 음성 생성
        await generate_audio_from_transcript(db, video_id, target_lang)
    
    background_tasks.add_task(process_all)
    
    return {
        "message": f"비디오 처리가 시작되었습니다. 원본 자막 추출 및 {supported_langs[target_lang]}로 번역/음성 변환이 진행됩니다."
    }

# 특정 언어의 자막 가져오기
@router.get("/{video_id}/{language}")
async def get_transcript_by_language(
    video_id: int,
    language: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    특정 비디오의 특정 언어 자막을 조회합니다.
    """
    # 데이터베이스에서 자막 조회
    statement = select(Transcript).where(
        Transcript.video_id == video_id,
        Transcript.language == language
    )
    transcript = db.exec(statement).first()
    
    # DB에 있고 처리 완료된 경우 반환
    if transcript and transcript.is_processed:
        return transcript
    
    # 파일 시스템에서 직접 확인
    transcript_path = get_transcript_path(video_id, language)
    if os.path.exists(transcript_path):
        try:
            with open(transcript_path, "r", encoding="utf-8") as f:
                transcript_data = json.load(f)
            
            return transcript_data
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"자막 파일 읽기 오류: {str(e)}"
            )
    
    # 자막이 없는 경우
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"비디오 {video_id}의 {language} 자막을 찾을 수 없습니다."
    ) 
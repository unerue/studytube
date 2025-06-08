from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import os

from src.db.database import get_db
from src.models.audio import Audio
from src.services.auth import get_current_user
from src.utils.filesystem import get_audio_path

router = APIRouter(
    prefix="/audio",
    tags=["오디오"],
    responses={401: {"description": "인증되지 않음"}}
)

@router.get("/{video_id}/{language}")
async def get_audio_file(
    video_id: int,
    language: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    특정 비디오의 오디오 파일을 스트리밍합니다.
    
    Args:
        video_id: 비디오 ID
        language: 언어 코드 (예: 'ko', 'en', 'ko')
    
    Returns:
        FileResponse: 오디오 파일
    """
    # 오디오 레코드 확인
    statement = select(Audio).where(
        Audio.video_id == video_id,
        Audio.language == language,
        Audio.is_processed == True
    )
    audio = db.exec(statement).first()
    
    if not audio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"요청한 오디오 파일을 찾을 수 없습니다. 비디오 {video_id}의 {language} 오디오가 아직 처리되지 않았습니다."
        )
    
    # 실제 파일 경로
    audio_path = get_audio_path(video_id, language)
    
    if not os.path.exists(audio_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"오디오 파일을 찾을 수 없습니다: {audio_path}"
        )
    
    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"audio_{video_id}_{language}.mp3"
    ) 
from .user import UserBase, UserCreate, UserResponse, UserLogin, Token, TokenData
from .video import VideoBase, VideoCreate, VideoResponse, VideoDetail
from .qa import QABase, QACreate, QAResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

# 비디오 처리 상태 응답 스키마
class VideoProcessResponse(BaseModel):
    status: str
    message: str

class LanguageStatus(BaseModel):
    has_transcript: bool
    has_tts: bool

class VideoProcessStatus(BaseModel):
    is_processed: bool
    error: Optional[str] = None
    has_transcript: bool
    has_translation: bool
    has_tts: bool
    languages: Optional[Dict[str, LanguageStatus]] = None 
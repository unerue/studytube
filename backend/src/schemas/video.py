from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime

class VideoBase(BaseModel):
    url: str  # 유튜브 URL

class VideoCreate(VideoBase):
    pass

class VideoResponse(VideoBase):
    id: int
    title: str
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    summary: Optional[str] = None
    user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class VideoDetail(VideoResponse):
    transcript: Optional[str] = None 
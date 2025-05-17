from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class AudioBase(SQLModel):
    video_id: int = Field(foreign_key="videos.id")
    language: str  # 언어 코드 (예: 'ko', 'en', 'ko')

class Audio(AudioBase, table=True):
    __tablename__ = "audios"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    file_path: str  # 오디오 파일 경로
    duration: Optional[float] = None  # 오디오 길이 (초)
    is_processed: bool = Field(default=False)  # 처리 완료 여부
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 관계 설정
    video: Optional["Video"] = Relationship(back_populates="audios")

class AudioCreate(AudioBase):
    file_path: str

class AudioRead(AudioBase):
    id: int
    file_path: str
    duration: Optional[float] = None
    is_processed: bool
    created_at: datetime 
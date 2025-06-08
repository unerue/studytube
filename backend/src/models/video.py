from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship


class VideoBase(SQLModel):
    url: str = Field(unique=True)
    title: Optional[str] = Field(default=None, index=True)
    thumbnail_url: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[str] = None  # 재생 시간 (초 단위 또는 "00:00" 형식)


class Video(VideoBase, table=True):
    __tablename__ = "videos"

    id: Optional[int] = Field(default=None, primary_key=True)
    transcript: Optional[str] = None
    summary: Optional[str] = None
    user_id: int = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_public: bool = Field(default=False)  # 공개 여부
    is_processed: bool = Field(default=False)  # AI 처리 완료 여부
    processing_error: Optional[str] = None  # 처리 중 발생한 오류
    
    # 관계 설정
    user: Optional["User"] = Relationship(back_populates="videos")
    qa_pairs: List["QAPair"] = Relationship(back_populates="video", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    transcripts: List["Transcript"] = Relationship(back_populates="video", sa_relationship_kwargs={"cascade": "all, delete-orphan"})
    audios: List["Audio"] = Relationship(back_populates="video", sa_relationship_kwargs={"cascade": "all, delete-orphan"})

class VideoCreate(SQLModel):
    url: str

class VideoRead(VideoBase):
    id: int
    user_id: int
    created_at: datetime
    summary: Optional[str] = None

class VideoReadDetailed(VideoRead):
    transcript: Optional[str] = None 
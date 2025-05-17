from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class TranscriptBase(SQLModel):
    video_id: int = Field(foreign_key="videos.id")
    language: str  # 언어 코드 (예: 'ko', 'en', 'ko')
    content: Optional[str] = None  # 자막 내용 (파일로 저장하므로 필수값이 아님)

class Transcript(TranscriptBase, table=True):
    __tablename__ = "transcripts"

    id: Optional[int] = Field(default=None, primary_key=True)
    timestamps: Optional[str] = None  # JSON 형식의 타임스탬프 정보
    file_path: Optional[str] = None  # 자막 파일 저장 경로
    is_processed: bool = Field(default=False)  # 처리 완료 여부
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 관계 설정
    video: Optional["Video"] = Relationship(back_populates="transcripts")

class TranscriptCreate(TranscriptBase):
    pass

class TranscriptRead(TranscriptBase):
    id: int
    timestamps: Optional[str] = None
    file_path: Optional[str] = None
    is_processed: bool
    created_at: datetime 
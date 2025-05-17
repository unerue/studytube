from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class QABase(SQLModel):
    question: str
    video_id: int = Field(foreign_key="videos.id")

class QAPair(QABase, table=True):
    __tablename__ = "qa_pairs"

    id: Optional[int] = Field(default=None, primary_key=True)
    answer: str
    user_id: int = Field(foreign_key="users.id")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # 관계 설정
    user: Optional["User"] = Relationship(back_populates="qa_pairs")
    video: Optional["Video"] = Relationship(back_populates="qa_pairs")

class QACreate(QABase):
    pass

class QARead(QABase):
    id: int
    answer: str
    user_id: int
    timestamp: datetime 
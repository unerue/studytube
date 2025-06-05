from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from enum import Enum

class LectureStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"
    CANCELLED = "cancelled"

class LectureBase(SQLModel):
    title: str = Field(index=True)
    description: Optional[str] = None
    scheduled_start: datetime
    max_participants: int = Field(default=50)
    default_language: str = Field(default="ko")
    enable_recording: bool = Field(default=False)
    enable_screen_share: bool = Field(default=True)
    enable_chat: bool = Field(default=True)

class Lecture(LectureBase, table=True):
    __tablename__ = "lectures"

    id: Optional[int] = Field(default=None, primary_key=True)
    instructor_id: int = Field(foreign_key="users.id")
    status: LectureStatus = Field(default=LectureStatus.SCHEDULED)
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 관계 설정
    instructor: "User" = Relationship(back_populates="lectures")
    participants: List["LectureParticipant"] = Relationship(back_populates="lecture")
    chat_messages: List["ChatMessage"] = Relationship(back_populates="lecture")

class LectureCreate(LectureBase):
    pass

class LectureRead(LectureBase):
    id: int
    instructor_id: int
    instructor_name: str
    status: LectureStatus
    created_at: datetime
    participant_count: int = 0

class LectureUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    status: Optional[LectureStatus] = None

class LectureParticipant(SQLModel, table=True):
    __tablename__ = "lecture_participants"

    id: Optional[int] = Field(default=None, primary_key=True)
    lecture_id: int = Field(foreign_key="lectures.id")
    student_id: int = Field(foreign_key="users.id")
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    is_active: bool = Field(default=True)
    
    # 관계 설정
    lecture: Lecture = Relationship(back_populates="participants")
    student: "User" = Relationship() 
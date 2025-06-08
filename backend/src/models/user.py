from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship
from pydantic import EmailStr
from enum import Enum

class UserRole(str, Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"

class UserBase(SQLModel):
    username: str = Field(index=True)
    email: str = Field(unique=True, index=True)
    role: UserRole = Field(default=UserRole.STUDENT)

class User(UserBase, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # 관계 설정 - 실제 모델은 나중에 임포트됨
    videos: List["Video"] = Relationship(back_populates="user")
    qa_pairs: List["QAPair"] = Relationship(back_populates="user")
    lectures: List["Lecture"] = Relationship(back_populates="instructor")
    chat_messages: List["ChatMessage"] = Relationship(back_populates="user")

class UserCreate(UserBase):
    password: str

class UserRead(UserBase):
    id: int
    created_at: datetime

class UserLogin(SQLModel):
    email: str
    password: str

class Token(SQLModel):
    access_token: str
    token_type: str

class TokenData(SQLModel):
    username: Optional[str] = None 
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..db.database import Base

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    url = Column(String, unique=True)
    thumbnail_url = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    transcript = Column(Text, nullable=True)  # 영상 자막 저장
    summary = Column(Text, nullable=True)     # AI 요약 저장
    
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # 관계 설정
    user = relationship("User", back_populates="videos")
    qa_pairs = relationship("QAPair", back_populates="video", cascade="all, delete-orphan") 
from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel, Relationship

class ChatMessageBase(SQLModel):
    message: str
    is_private: bool = Field(default=False)

class ChatMessage(ChatMessageBase, table=True):
    __tablename__ = "chat_messages"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    lecture_id: int = Field(foreign_key="lectures.id")
    user_id: int = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    lecture: "Lecture" = Relationship(back_populates="chat_messages")
    user: "User" = Relationship(back_populates="chat_messages") 
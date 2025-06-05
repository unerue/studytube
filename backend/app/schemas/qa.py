from pydantic import BaseModel
from datetime import datetime

class QABase(BaseModel):
    question: str
    video_id: int

class QACreate(QABase):
    pass

class QAResponse(QABase):
    id: int
    answer: str
    user_id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True 
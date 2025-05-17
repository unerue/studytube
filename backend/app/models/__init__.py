from app.models.user import User, UserBase, UserCreate, UserRead, UserLogin, Token, TokenData
from app.models.video import Video, VideoBase, VideoCreate, VideoRead, VideoReadDetailed
from app.models.qa_pair import QAPair, QABase, QACreate, QARead
from app.models.transcript import Transcript, TranscriptBase, TranscriptCreate, TranscriptRead
from app.models.audio import Audio, AudioBase, AudioCreate, AudioRead

# 모든 모델을 가져와서 DB 초기화 시 사용할 수 있도록 함 
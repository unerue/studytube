from src.models.user import User, UserBase, UserCreate, UserRead, UserLogin, Token, TokenData
from src.models.video import Video, VideoBase, VideoCreate, VideoRead, VideoReadDetailed
from src.models.qa_pair import QAPair, QABase, QACreate, QARead
from src.models.transcript import Transcript, TranscriptBase, TranscriptCreate, TranscriptRead
from src.models.audio import Audio, AudioBase, AudioCreate, AudioRead
from src.models.lecture import Lecture, LectureBase, LectureCreate, LectureRead, LectureUpdate, LectureParticipant
from src.models.chat import ChatMessage, ChatMessageBase

# 모든 모델을 가져와서 DB 초기화 시 사용할 수 있도록 함 

# 패키지 인식용 파일입니다. 
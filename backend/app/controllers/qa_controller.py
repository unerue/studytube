from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from ..schemas.qa import QACreate, QAResponse
from ..models.qa_pair import QAPair
from ..models.video import Video
from ..services.ai import answer_question

# 질문 등록 및 AI 답변 생성
async def create_qa(db: Session, qa_data: QACreate, user_id: int):
    # 영상 존재 확인
    video = db.query(Video).filter(Video.id == qa_data.video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="영상을 찾을 수 없습니다."
        )
    
    # AI 답변 생성
    try:
        # 영상 자막 또는 요약을 컨텍스트로 사용
        context = video.transcript or video.summary or "컨텍스트 없음"
        answer_text = await answer_question(context, qa_data.question)
    except Exception as e:
        answer_text = "답변을 생성할 수 없습니다."
    
    # DB에 질문-답변 저장
    db_qa = QAPair(
        question=qa_data.question,
        answer=answer_text,
        user_id=user_id,
        video_id=qa_data.video_id
    )
    
    db.add(db_qa)
    db.commit()
    db.refresh(db_qa)
    
    return db_qa

# 사용자의 질문-답변 목록 가져오기
def get_user_qa_pairs(db: Session, user_id: int, video_id: int = None, skip: int = 0, limit: int = 100):
    query = db.query(QAPair).filter(QAPair.user_id == user_id)
    
    if video_id:
        query = query.filter(QAPair.video_id == video_id)
    
    return query.order_by(QAPair.timestamp.desc()).offset(skip).limit(limit).all() 
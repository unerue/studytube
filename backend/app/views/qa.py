from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List, Optional

from app.db.database import get_db
from app.models.qa_pair import QACreate, QARead
from app.controllers.qa_controller import create_qa, get_user_qa_pairs, get_video_qa_pairs
from app.services.auth import get_current_user

router = APIRouter(
    prefix="/qa",
    tags=["질문-답변"],
    responses={401: {"description": "인증되지 않음"}}
)

# 질문 등록 및 AI 답변 생성
@router.post("/", response_model=QARead, status_code=status.HTTP_201_CREATED)
async def ask_question(
    qa_data: QACreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await create_qa(db, qa_data, current_user.id)

# 내 질문-답변 목록 조회
@router.get("/my", response_model=List[QARead])
async def list_my_qa(
    video_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await get_user_qa_pairs(db, current_user.id, video_id, skip, limit)

# 특정 영상에 대한 질문-답변 기록 조회
@router.get("/history/{video_id}", response_model=List[QARead])
async def get_video_qa_history(
    video_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    return await get_video_qa_pairs(db, video_id, skip, limit) 
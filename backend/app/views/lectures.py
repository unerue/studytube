from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from datetime import datetime

from app.db.database import get_db
from app.models.user import User
from app.models.lecture import (
    Lecture, LectureCreate, LectureRead, LectureUpdate, 
    LectureParticipant, LectureStatus
)
from app.services.auth import get_current_user

router = APIRouter(prefix="/lectures", tags=["lectures"])

@router.post("/", response_model=LectureRead)
async def create_lecture(
    lecture: LectureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 생성 (강사만 가능)"""
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="강사만 강의를 생성할 수 있습니다."
        )
    
    db_lecture = Lecture(
        **lecture.model_dump(),
        instructor_id=current_user.id
    )
    db.add(db_lecture)
    await db.commit()
    await db.refresh(db_lecture)
    
    return LectureRead(
        **db_lecture.model_dump(), 
        instructor_name=current_user.username,
        participant_count=0
    )

@router.get("/", response_model=List[LectureRead])
async def get_lectures(
    db: Session = Depends(get_db)
):
    """강의 목록 조회 (공개 API)"""
    # 모든 강의 목록 조회 (인증 없이도 접근 가능)
    lectures_result = await db.exec(select(Lecture))
    lectures = lectures_result.all()
    
    result = []
    for lecture in lectures:
        # 강사 정보 조회
        instructor = await db.get(User, lecture.instructor_id)
        instructor_name = instructor.username if instructor else "알 수 없음"
        
        # 참여자 수를 별도 쿼리로 조회 (lazy loading 회피)
        participant_count_result = await db.exec(
            select(LectureParticipant).where(
                LectureParticipant.lecture_id == lecture.id,
                LectureParticipant.is_active == True
            )
        )
        participant_count = len(participant_count_result.all())
        
        result.append(LectureRead(
            **lecture.model_dump(), 
            instructor_name=instructor_name,
            participant_count=participant_count
        ))
    
    return result

@router.get("/{lecture_id}", response_model=LectureRead)
async def get_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """특정 강의 조회"""
    lecture = await db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    # 강사 정보 조회
    instructor = await db.get(User, lecture.instructor_id)
    instructor_name = instructor.username if instructor else "알 수 없음"
    
    # 참여자 수를 별도 쿼리로 조회 (lazy loading 회피)
    participant_count_result = await db.exec(
        select(LectureParticipant).where(
            LectureParticipant.lecture_id == lecture.id,
            LectureParticipant.is_active == True
        )
    )
    participant_count = len(participant_count_result.all())
    
    return LectureRead(
        **lecture.model_dump(), 
        instructor_name=instructor_name,
        participant_count=participant_count
    )

@router.put("/{lecture_id}", response_model=LectureRead)
async def update_lecture(
    lecture_id: int,
    lecture_update: LectureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 수정 (강사만 가능)"""
    lecture = await db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    if lecture.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 개설한 강의만 수정할 수 있습니다."
        )
    
    for field, value in lecture_update.model_dump(exclude_unset=True).items():
        setattr(lecture, field, value)
    
    db.add(lecture)
    await db.commit()
    await db.refresh(lecture)
    
    # 참여자 수를 별도 쿼리로 조회 (lazy loading 회피)
    participant_count_result = await db.exec(
        select(LectureParticipant).where(
            LectureParticipant.lecture_id == lecture.id,
            LectureParticipant.is_active == True
        )
    )
    participant_count = len(participant_count_result.all())
    
    return LectureRead(
        **lecture.model_dump(), 
        instructor_name=current_user.username,
        participant_count=participant_count
    )

@router.post("/{lecture_id}/join")
async def join_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 참석"""
    lecture = await db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    # 이미 참석 중인지 확인
    existing_participant_result = await db.exec(
        select(LectureParticipant).where(
            LectureParticipant.lecture_id == lecture_id,
            LectureParticipant.student_id == current_user.id,
            LectureParticipant.is_active == True
        )
    )
    existing_participant = existing_participant_result.first()
    
    if existing_participant:
        # 이미 참석 중이면 성공 메시지 반환 (에러가 아닌 정상 처리)
        return {"message": "이미 참석 중인 강의입니다."}
    
    # 최대 참석자 수 확인 (강사는 제외)
    if current_user.id != lecture.instructor_id:
        active_participants_result = await db.exec(
            select(LectureParticipant).where(
                LectureParticipant.lecture_id == lecture_id,
                LectureParticipant.is_active == True
            )
        )
        active_participants = active_participants_result.all()
        
        if len(active_participants) >= lecture.max_participants:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="강의 정원이 초과되었습니다."
            )
    
    # 참석 등록
    participant = LectureParticipant(
        lecture_id=lecture_id,
        student_id=current_user.id,
        joined_at=datetime.utcnow()
    )
    db.add(participant)
    await db.commit()
    
    return {"message": "강의에 성공적으로 참석했습니다."}

@router.post("/{lecture_id}/leave")
async def leave_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 나가기"""
    participant_result = await db.exec(
        select(LectureParticipant).where(
            LectureParticipant.lecture_id == lecture_id,
            LectureParticipant.student_id == current_user.id,
            LectureParticipant.is_active == True
        )
    )
    participant = participant_result.first()
    
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="참석 중인 강의가 아닙니다."
        )
    
    participant.is_active = False
    participant.left_at = datetime.utcnow()
    db.add(participant)
    await db.commit()
    
    return {"message": "강의에서 나갔습니다."}

@router.post("/{lecture_id}/start")
async def start_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 시작 (강사만 가능)"""
    lecture = await db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    if lecture.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 개설한 강의만 시작할 수 있습니다."
        )
    
    lecture.status = LectureStatus.LIVE
    lecture.actual_start = datetime.utcnow()
    db.add(lecture)
    await db.commit()
    
    return {"message": "강의가 시작되었습니다."}

@router.post("/{lecture_id}/end")
async def end_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """강의 종료 (강사만 가능)"""
    lecture = await db.get(Lecture, lecture_id)
    if not lecture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="강의를 찾을 수 없습니다."
        )
    
    if lecture.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 개설한 강의만 종료할 수 있습니다."
        )
    
    lecture.status = LectureStatus.ENDED
    lecture.actual_end = datetime.utcnow()
    db.add(lecture)
    await db.commit()
    
    return {"message": "강의가 종료되었습니다."} 
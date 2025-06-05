from datetime import timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.models.user import User, UserCreate, UserLogin
from app.services.auth import (
    get_password_hash, authenticate_user, 
    create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
)

# 사용자 등록 (회원가입)
async def register_user(db: AsyncSession, user_data: UserCreate):
    # 이메일 중복 확인
    statement = select(User).where(User.email == user_data.email)
    result = await db.exec(statement)
    db_user_email = result.first()
    if db_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다."
        )
    
    # 사용자명 중복 확인
    statement = select(User).where(User.username == user_data.username)
    result = await db.exec(statement)
    db_user_username = result.first()
    if db_user_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 사용자명입니다."
        )
    
    # 비밀번호 해싱
    hashed_password = get_password_hash(user_data.password)
    
    # DB에 사용자 저장
    db_user = User(
        email=user_data.email,
        username=user_data.username,
        hashed_password=hashed_password
    )
    
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    return db_user

# 로그인
async def login_user(db: AsyncSession, user_data: UserLogin):
    # 사용자 인증
    user = await authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # JWT 토큰 생성
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"} 
from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from ..schemas.user import UserCreate, UserLogin, Token
from ..models.user import User
from ..services.auth import (
    get_password_hash, authenticate_user, 
    create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
)

# 사용자 등록 (회원가입)
def register_user(db: Session, user_data: UserCreate):
    # 이메일 중복 확인
    db_user_email = db.query(User).filter(User.email == user_data.email).first()
    if db_user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 이메일입니다."
        )
    
    # 사용자명 중복 확인
    db_user_username = db.query(User).filter(User.username == user_data.username).first()
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
    db.commit()
    db.refresh(db_user)
    
    return db_user

# 로그인
def login_user(db: Session, user_data: UserLogin):
    # 사용자 인증
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # JWT 토큰 생성
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"} 
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select

from app.db.database import get_db
from app.models.user import User, TokenData

# JWT 설정
SECRET_KEY = "your-secret-key"  # 실제 프로젝트에서는 환경변수로 관리
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24시간으로 설정

# OAuth2 설정
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# 비밀번호 해싱 설정
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


async def authenticate_user(db: AsyncSession, email: str, password: str):
    statement = select(User).where(User.email == email)
    result = await db.exec(statement)
    user = result.first()
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str):
    """JWT 토큰을 디코딩하여 payload 반환"""
    try:
        print(f"토큰 디코딩 시작: {token[:20]}...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"토큰 디코딩 성공: {payload}")
        return payload
    except JWTError as e:
        print(f"토큰 디코딩 실패: {type(e).__name__}: {e}")
        import traceback
        print(f"전체 스택 트레이스: {traceback.format_exc()}")
        return None


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="인증 정보가 유효하지 않습니다",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # 1. Authorization 헤더에서 토큰 확인
    if token is None:
        # 2. 쿠키에서 토큰 확인
        token = request.cookies.get("access_token")
    
    if token is None:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    statement = select(User).where(User.username == token_data.username)
    result = await db.exec(statement)
    user = result.first()
    if user is None:
        raise credentials_exception
    return user

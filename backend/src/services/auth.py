from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
import logging

from src.db.database import get_db
from src.models.user import User, TokenData

# 로거 설정
logger = logging.getLogger(__name__)

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
    logger.info(f"사용자 인증 시도: {email}")
    
    statement = select(User).where(User.email == email)
    result = await db.exec(statement)
    user = result.first()
    
    if not user:
        logger.warning(f"인증 실패: 사용자를 찾을 수 없음 - {email}")
        return False
        
    if not verify_password(password, user.hashed_password):
        logger.warning(f"인증 실패: 비밀번호 불일치 - {email}")
        return False
        
    logger.info(f"인증 성공: {email}, 사용자 ID: {user.id}")
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"액세스 토큰 생성: 사용자 {data.get('sub', '알 수 없음')}, 만료: {expire}")
    return encoded_jwt


def decode_token(token: str):
    """JWT 토큰을 디코딩하여 payload 반환"""
    try:
        logger.debug(f"토큰 디코딩 시작: {token[:20]}...")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        logger.debug(f"토큰 디코딩 성공: {payload}")
        return payload
    except JWTError as e:
        logger.error(f"토큰 디코딩 실패: {type(e).__name__}: {e}")
        import traceback
        logger.debug(f"전체 스택 트레이스: {traceback.format_exc()}")
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
        logger.debug(f"헤더에서 토큰을 찾을 수 없어 쿠키 확인: {'성공' if token else '실패'}")

    if token is None:
        logger.warning("인증 실패: 토큰이 없음 (헤더와 쿠키 모두)")
        raise credentials_exception

    try:
        # 토큰 정보 로깅 (앞부분만)
        token_preview = token[:20] + "..." if len(token) > 20 else token
        logger.debug(f"토큰 디코딩 시도: {token_preview}")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        
        if username is None:
            logger.warning("인증 실패: 토큰에 사용자 이름 없음")
            raise credentials_exception
            
        logger.debug(f"토큰 디코딩 성공: 사용자={username}, ID={user_id}")
        token_data = TokenData(username=username)
    except JWTError as e:
        logger.error(f"토큰 검증 실패: {type(e).__name__}: {e}")
        raise credentials_exception

    # 사용자 검색 - username으로 먼저 시도, 실패하면 user_id로 시도
    statement = select(User).where(User.username == token_data.username)
    result = await db.exec(statement)
    user = result.first()
    
    # username으로 찾지 못했고 user_id가 있으면 user_id로 시도
    if user is None and user_id is not None:
        logger.debug(f"사용자 이름으로 찾지 못함, ID로 시도: {user_id}")
        statement = select(User).where(User.id == user_id)
        result = await db.exec(statement)
        user = result.first()
    
    if user is None:
        logger.warning(f"인증 실패: 사용자를 찾을 수 없음 - {username}")
        raise credentials_exception
        
    logger.info(f"현재 사용자 검증 성공: {user.username}, ID: {user.id}, 역할: {user.role}")
    return user

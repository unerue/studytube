from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta
import logging
import json

from src.db.database import get_db
from src.models.user import UserCreate, UserRead, Token, UserLogin
from src.controllers.auth_controller import register_user, login_user
from src.services.auth import ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user
from src.core.settings import settings

# 로거 설정
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/auth",
    tags=["인증"],
    responses={401: {"description": "인증되지 않음"}}
)

# 회원가입
@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"회원가입 요청: {user_data.email}, 역할: {user_data.role}")
    try:
        user = await register_user(db, user_data)
        logger.info(f"회원가입 성공: {user.email}")
        return user
    except Exception as e:
        logger.error(f"회원가입 실패: {str(e)}")
        raise

# 로그인
@router.post("/login", response_model=Token)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"로그인 시도: {form_data.username}")
    
    # 요청 디버깅 정보
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"요청 클라이언트: {client_host}")
    logger.info(f"요청 메서드: {request.method}")
    logger.info(f"요청 URL: {request.url}")
    
    # 요청 헤더 로그
    headers_dict = dict(request.headers.items())
    logger.info(f"요청 헤더: {json.dumps(headers_dict, indent=2)}")
    
    # 폼 데이터 로그
    logger.info(f"폼 데이터: username={form_data.username}, password=[MASKED]")
    
    login_data = UserLogin(
        email=form_data.username,  # OAuth2 형식에서는 username으로 이메일을 받음
        password=form_data.password
    )
    
    try:
        token_data = await login_user(db, login_data)
        
        # CORS 헤더 추가
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        
        # 쿠키에 토큰 저장 (httpOnly, secure 설정)
        response.set_cookie(
            key="access_token",
            value=token_data["access_token"],
            httponly=True,  # JavaScript에서 접근 불가능
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 초 단위로 변환
            samesite="lax",  # CSRF 방어
            secure=False,  # 개발환경에서는 False, 프로덕션에서는 True
            path="/",  # 모든 경로에서 쿠키 접근 가능
        )
        
        logger.info(f"로그인 성공: {form_data.username}, 토큰 발급됨")
        logger.info(f"토큰 데이터: {token_data}")
        return token_data
    except Exception as e:
        logger.error(f"로그인 실패: {form_data.username}, 오류: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"로그인 실패: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# 사용자 정보 조회 API
@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    request: Request,
    current_user = Depends(get_current_user)
):
    # 요청 헤더 로그
    auth_header = request.headers.get("Authorization", "없음")
    has_cookie = "access_token" in request.cookies
    
    logger.info(f"사용자 정보 요청: ID={current_user.id}, 이름={current_user.username}, 역할={current_user.role}")
    logger.debug(f"인증 헤더: {auth_header[:20]}..., 쿠키 존재: {has_cookie}")
    
    return current_user

# 로그아웃 API
@router.post("/logout")
async def logout(response: Response, request: Request):
    # 요청 헤더 로그
    auth_header = request.headers.get("Authorization", "없음")
    has_cookie = "access_token" in request.cookies
    
    logger.info(f"로그아웃 요청, 쿠키 존재: {has_cookie}, 인증 헤더: {auth_header[:20] if len(auth_header) > 20 else auth_header}")
    
    # 쿠키에서 access_token 제거
    response.delete_cookie(
        key="access_token",
        samesite="lax",
        path="/",
    )
    
    return {"message": "로그아웃 성공"}

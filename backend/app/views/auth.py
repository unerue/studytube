from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta

from app.db.database import get_db
from app.models.user import UserCreate, UserRead, Token, UserLogin
from app.controllers.auth_controller import register_user, login_user
from app.services.auth import ACCESS_TOKEN_EXPIRE_MINUTES, get_current_user

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
    return await register_user(db, user_data)

# 로그인
@router.post("/login", response_model=Token)
async def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    login_data = UserLogin(
        email=form_data.username,  # OAuth2 형식에서는 username으로 이메일을 받음
        password=form_data.password
    )
    token_data = await login_user(db, login_data)
    
    # 쿠키에 토큰 저장 (httpOnly, secure 설정)
    response.set_cookie(
        key="access_token", 
        value=token_data["access_token"],
        httponly=True,  # JavaScript에서 접근 불가능
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 초 단위로 변환
        samesite="lax",  # CSRF 방어
        secure=False,  # 개발환경에서는 False, 프로덕션에서는 True
    )
    
    return token_data

# 사용자 정보 조회 API
@router.get("/me", response_model=UserRead)
async def get_current_user_info(
    current_user = Depends(get_current_user)
):
    return current_user

# 로그아웃 API
@router.post("/logout")
async def logout(response: Response):
    # 쿠키에서 access_token 제거
    response.delete_cookie(
        key="access_token",
        samesite="lax",
    )
    return {"message": "로그아웃 성공"} 
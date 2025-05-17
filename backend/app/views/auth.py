from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from ..db.database import get_db
from ..schemas.user import UserCreate, UserResponse, Token
from ..controllers.auth_controller import register_user, login_user

router = APIRouter(
    prefix="/auth",
    tags=["인증"],
    responses={401: {"description": "인증되지 않음"}}
)

# 회원가입
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db)
):
    return register_user(db, user_data)

# 로그인
@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user_data = {
        "email": form_data.username,  # OAuth2 형식에서는 username으로 이메일을 받음
        "password": form_data.password
    }
    return login_user(db, user_data) 
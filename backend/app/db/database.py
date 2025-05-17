from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# SQLite 연결 URL
SQLALCHEMY_DATABASE_URL = "sqlite:///./studytube.db"

# 엔진 생성
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 세션 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모델의 기본 클래스
Base = declarative_base()

# DB 종속성 주입 함수
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 
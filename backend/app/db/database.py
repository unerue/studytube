from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine

# SQLite 연결 URL (async 버전)
DATABASE_URL = "sqlite+aiosqlite:///./studytube.db"

# 비동기 엔진 생성
engine = create_async_engine(
    DATABASE_URL, 
    echo=True  # SQL 쿼리 로깅 (개발 시 유용)
)

# DB 종속성 주입 함수 (비동기)
async def get_db():
    async with AsyncSession(engine) as session:
        yield session

# 데이터베이스 초기화 함수 (비동기)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all) 
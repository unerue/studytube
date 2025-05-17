from sqlmodel import create_engine, Session, SQLModel

# SQLite 연결 URL
DATABASE_URL = "sqlite:///./studytube.db"

# 엔진 생성
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    echo=True  # SQL 쿼리 로깅 (개발 시 유용)
)

# DB 종속성 주입 함수
def get_db():
    with Session(engine) as session:
        yield session

# 데이터베이스 초기화 함수
def init_db():
    SQLModel.metadata.create_all(engine) 
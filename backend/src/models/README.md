# 모델 (Models)

이 폴더는 데이터베이스 모델(SQLAlchemy)을 정의합니다.

## 예시 모델 구조

```python
# user.py
from sqlalchemy import Column, Integer, String
from ..db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
```

## 모델 작성 가이드라인

1. 각 모델은 별도의 파일로 관리합니다.
2. 모델 클래스는 Base를 상속받아야 합니다.
3. SQLAlchemy 타입을 사용하여 필드를 정의합니다.
4. 필요에 따라 관계(relationship)를 정의합니다.

---
**참고**: 아직 실제 모델이 구현되지 않았으며, 이 문서는 참고용입니다. 
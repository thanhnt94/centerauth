from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.core.db import Base

class AuthCode(Base):
    __tablename__ = "auth_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True)
    client_id = Column(String(100))
    user_id = Column(Integer)
    redirect_uri = Column(String(500))
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    def is_expired(self):
        # Use naive datetime for comparison with SQLite
        return datetime.utcnow() > self.expires_at

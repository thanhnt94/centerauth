from sqlalchemy import Column, String, DateTime, Text
from datetime import datetime
from app.core.db import Base

class TTSCache(Base):
    __tablename__ = "tts_caches"
    
    prompt_hash = Column(String(64), primary_key=True, index=True)
    text = Column(Text, nullable=False)
    voice_name = Column(String(100), nullable=True)
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

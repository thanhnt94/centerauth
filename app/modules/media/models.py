from sqlalchemy import Column, Integer, String, DateTime, BigInteger
from datetime import datetime
from app.core.db import Base

class MediaAsset(Base):
    __tablename__ = "media_assets"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, index=True, nullable=False)
    original_url = Column(String(1000), nullable=True)
    provider = Column(String(50), index=True, nullable=False) # wikimedia, unsplash, pexels, pixabay, google
    search_query = Column(String(255), index=True, nullable=True)
    mime_type = Column(String(50), nullable=True)
    size_bytes = Column(BigInteger, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

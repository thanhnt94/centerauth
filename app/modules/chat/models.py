from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.db_aichat import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(String(50), primary_key=True, index=True) # UUID string format
    title = Column(String(255), default="New Chat")
    user_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan", order_by="Message.created_at")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50)) # "user", "model", "assistant"
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")

from app.core.db import Base as MainBase

class AICache(MainBase):
    __tablename__ = "ai_caches"
    
    prompt_hash = Column(String(64), primary_key=True, index=True)
    prompt = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    provider = Column(String(50), nullable=True)
    model = Column(String(100), nullable=True)
    linked_cards = Column(Text, nullable=True, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)

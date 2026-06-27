from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean
from datetime import datetime
from app.core.db import Base


class SystemSetting(Base):
    """
    Unified global settings and behavioral configurations for the CentralAuth Identity Hub.
    """
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(String(500), nullable=False)
    description = Column(String(500), nullable=True)
    category = Column(String(50), default="General", index=True)


class AuditLog(Base):
    """
    Security audit trails logging user activity and system events.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # e.g., "USER_LOGIN", "CLIENT_CREATED"
    details = Column(Text, nullable=True)  # JSON or descriptive text
    username = Column(String(100), nullable=True, index=True)  # Who initiated
    created_at = Column(DateTime, default=datetime.utcnow)


class AIFailoverModel(Base):
    """
    Priority ordered AI provider + key + model combinations for automatic failover pooling.
    """
    __tablename__ = "ai_failover_models"

    id = Column(Integer, primary_key=True, index=True)
    provider = Column(String(50), nullable=False)           # e.g., "google", "groq", "openai"
    key_id = Column(String(255), nullable=False)            # e.g., "system-google" or "custom-12345"
    key_label = Column(String(255), nullable=False)         # e.g., "My Custom Key", "System Fallback"
    model_id = Column(String(255), nullable=False)          # e.g., "gemini-2.0-flash", "llama-3.3-70b"
    priority = Column(Integer, default=0, index=True)       # Lower priority value is tried first
    is_enabled = Column(Boolean, default=True, index=True)


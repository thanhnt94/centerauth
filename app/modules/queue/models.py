import uuid
from sqlalchemy import Column, String, Text, DateTime, Integer
from datetime import datetime
from app.core.db import Base


class QueuedTask(Base):
    """
    Represents a queued AI prompt task submitted by a satellite site.
    Tasks are picked up by the background worker and processed sequentially
    with rate-limiting and provider failover support.
    """
    __tablename__ = "queued_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    satellite_source = Column(String(100), nullable=False, index=True)  # e.g. "vocaburn"
    prompt = Column(Text, nullable=False)
    
    # Provider configuration (optional — falls back to admin defaults)
    provider = Column(String(50), nullable=True)   # e.g. "google", "groq"
    model = Column(String(255), nullable=True)      # e.g. "gemini-2.0-flash"
    
    # Provider priority list for failover (JSON string, e.g. '["groq","google","cerebras"]')
    provider_priority = Column(Text, nullable=True)
    
    # Task lifecycle
    status = Column(String(20), default="pending", index=True)  # pending, processing, completed, failed
    result = Column(Text, nullable=True)       # Generated AI response
    error = Column(Text, nullable=True)        # Error details if failed
    attempts = Column(Integer, default=0)      # Number of processing attempts
    max_retries = Column(Integer, default=3)   # Max retry attempts
    
    # Callback configuration
    callback_url = Column(String(500), nullable=True)  # POST result back to satellite
    callback_status = Column(String(20), nullable=True)  # "sent", "failed", None
    
    # Metadata
    extra_data = Column(Text, nullable=True)   # Arbitrary JSON payload from satellite
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    @property
    def task_type(self) -> str:
        if self.extra_data:
            import json
            try:
                data = json.loads(self.extra_data)
                return data.get("task_type", "ai-explain")
            except Exception:
                pass
        return "ai-explain"


from sqlalchemy import Boolean

class UserTelegramConfig(Base):
    __tablename__ = "user_telegram_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, index=True)
    telegram_chat_id = Column(String(100), nullable=True, index=True)
    connect_token = Column(String(50), nullable=True, unique=True)
    reminder_time = Column(String(10), default="20:00") # Format: HH:MM
    is_active = Column(Boolean, default=True)
    streak_guard_enabled = Column(Boolean, default=True)
    weekly_summary_enabled = Column(Boolean, default=True)
    inactivity_alert_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

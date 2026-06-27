import uuid
from sqlalchemy import Column, String, Text, DateTime, Integer
from datetime import datetime
from app.core.db_aichat import Base


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

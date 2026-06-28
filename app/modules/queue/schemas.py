from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class TaskSubmitRequest(BaseModel):
    """Schema for submitting a new task to the queue."""
    satellite_source: str = Field(..., description="Source site identifier, e.g. 'vocaburn'")
    prompt: str = Field(..., description="The AI prompt to process")
    provider: Optional[str] = Field(None, description="Preferred AI provider (e.g. 'google', 'groq')")
    model: Optional[str] = Field(None, description="Preferred model ID")
    provider_priority: Optional[List[str]] = Field(
        None, description="Ordered list of providers to try (failover chain)"
    )
    callback_url: Optional[str] = Field(None, description="URL to POST results to when complete")
    extra_data: Optional[str] = Field(None, description="Arbitrary JSON payload from satellite")
    max_retries: int = Field(3, description="Max retry attempts on failure")


class TaskBatchSubmitRequest(BaseModel):
    """Schema for submitting multiple tasks at once."""
    tasks: List[TaskSubmitRequest]


class TaskResponse(BaseModel):
    """Schema for returning task details."""
    id: str
    satellite_source: str
    prompt: str
    provider: Optional[str] = None
    model: Optional[str] = None
    status: str
    result: Optional[str] = None
    error: Optional[str] = None
    attempts: int = 0
    callback_url: Optional[str] = None
    callback_status: Optional[str] = None
    extra_data: Optional[str] = None
    task_type: Optional[str] = None
    created_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """Paginated list of tasks."""
    total: int
    tasks: List[TaskResponse]


class QueueStatsResponse(BaseModel):
    """Queue statistics overview."""
    pending: int
    processing: int
    completed: int
    failed: int
    total: int

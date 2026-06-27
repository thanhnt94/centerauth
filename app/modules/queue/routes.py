import json
import uuid
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db_aichat import get_aichat_db as get_db
from app.core.config import settings
from app.modules.queue.models import QueuedTask
from app.modules.queue.schemas import (
    TaskSubmitRequest,
    TaskBatchSubmitRequest,
    TaskResponse,
    TaskListResponse,
    QueueStatsResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/queue", tags=["Queue"])


# -------------------------------------------------------------------
# Authentication dependency
# -------------------------------------------------------------------

async def verify_queue_token(x_queue_token: str = Header(...)):
    """
    Validates the pre-shared API secret sent by satellite sites.
    The token must match QUEUE_API_SECRET configured in .env.
    """
    expected = getattr(settings, "QUEUE_API_SECRET", "super-secret-token-123")
    if x_queue_token != expected:
        raise HTTPException(status_code=403, detail="Invalid queue token")
    return True


# -------------------------------------------------------------------
# Submit endpoints
# -------------------------------------------------------------------

@router.post("/submit", response_model=TaskResponse)
async def submit_task(
    body: TaskSubmitRequest,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Submit a single task to the queue."""
    task = QueuedTask(
        id=str(uuid.uuid4()),
        satellite_source=body.satellite_source,
        prompt=body.prompt,
        provider=body.provider,
        model=body.model,
        provider_priority=json.dumps(body.provider_priority) if body.provider_priority else None,
        callback_url=body.callback_url,
        extra_data=body.extra_data,
        max_retries=body.max_retries,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"[Queue] Task {task.id} submitted from '{task.satellite_source}'")
    return task


@router.post("/submit/batch", response_model=list[TaskResponse])
async def submit_batch(
    body: TaskBatchSubmitRequest,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Submit multiple tasks at once."""
    created_tasks = []
    for item in body.tasks:
        task = QueuedTask(
            id=str(uuid.uuid4()),
            satellite_source=item.satellite_source,
            prompt=item.prompt,
            provider=item.provider,
            model=item.model,
            provider_priority=json.dumps(item.provider_priority) if item.provider_priority else None,
            callback_url=item.callback_url,
            extra_data=item.extra_data,
            max_retries=item.max_retries,
            status="pending",
            created_at=datetime.utcnow(),
        )
        db.add(task)
        created_tasks.append(task)

    await db.commit()
    for t in created_tasks:
        await db.refresh(t)

    logger.info(f"[Queue] Batch submitted: {len(created_tasks)} tasks")
    return created_tasks


# -------------------------------------------------------------------
# Query endpoints
# -------------------------------------------------------------------

@router.get("/status/{task_id}", response_model=TaskResponse)
async def get_task_status(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Get the status and result of a specific task."""
    result = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/list", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status: pending, processing, completed, failed"),
    satellite_source: Optional[str] = Query(None, description="Filter by satellite source"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """List queued tasks with optional filters and pagination."""
    query = select(QueuedTask)
    count_query = select(func.count(QueuedTask.id))

    if status:
        query = query.where(QueuedTask.status == status)
        count_query = count_query.where(QueuedTask.status == status)
    if satellite_source:
        query = query.where(QueuedTask.satellite_source == satellite_source)
        count_query = count_query.where(QueuedTask.satellite_source == satellite_source)

    query = query.order_by(QueuedTask.created_at.desc()).offset(offset).limit(limit)

    total_result = await db.execute(count_query)
    total = total_result.scalar()

    tasks_result = await db.execute(query)
    tasks = tasks_result.scalars().all()

    return TaskListResponse(total=total, tasks=tasks)


@router.get("/stats", response_model=QueueStatsResponse)
async def get_queue_stats(
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Get aggregate queue statistics."""
    counts = {}
    for s in ["pending", "processing", "completed", "failed"]:
        result = await db.execute(
            select(func.count(QueuedTask.id)).where(QueuedTask.status == s)
        )
        counts[s] = result.scalar() or 0

    total = sum(counts.values())
    return QueueStatsResponse(
        pending=counts["pending"],
        processing=counts["processing"],
        completed=counts["completed"],
        failed=counts["failed"],
        total=total,
    )


# -------------------------------------------------------------------
# Management endpoints
# -------------------------------------------------------------------

@router.delete("/task/{task_id}")
async def cancel_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Cancel a pending task (removes it from the queue)."""
    result = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status not in ("pending", "failed"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel task with status '{task.status}'"
        )
    await db.delete(task)
    await db.commit()
    return {"message": f"Task {task_id} cancelled and removed"}


@router.post("/retry/{task_id}", response_model=TaskResponse)
async def retry_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Re-queue a failed task for another attempt."""
    result = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "failed":
        raise HTTPException(
            status_code=400,
            detail=f"Only failed tasks can be retried (current: '{task.status}')"
        )
    task.status = "pending"
    task.attempts = 0
    task.error = None
    task.result = None
    task.processed_at = None
    task.completed_at = None
    task.callback_status = None
    await db.commit()
    await db.refresh(task)
    return task

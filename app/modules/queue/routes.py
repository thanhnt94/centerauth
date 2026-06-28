import json
import uuid
import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
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
    """Delete a task from the queue."""
    result = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await db.delete(task)
    await db.commit()
    return {"message": f"Task {task_id} removed"}

@router.delete("/clear")
async def clear_queue(
    status: Optional[str] = Query(None, description="Clear only tasks with this status"),
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Clear tasks from the queue (all or filtered by status)."""
    from sqlalchemy import delete
    stmt = delete(QueuedTask)
    if status:
        stmt = stmt.where(QueuedTask.status == status)
    
    result = await db.execute(stmt)
    await db.commit()
    return {"message": "Queue cleared successfully", "deleted_count": result.rowcount}


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

@router.get("/settings")
async def get_queue_settings(
    db: AsyncSession = Depends(get_db), 
    _auth: bool = Depends(verify_queue_token)
):
    from app.modules.admin.models import SystemSetting
    
    # Query is_paused
    res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
    paused_setting = res_paused.scalar_one_or_none()
    is_paused = (paused_setting.value == "true") if paused_setting else False

    # Query rate_limit_delay
    res_delay = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay"))
    delay_setting = res_delay.scalar_one_or_none()
    rate_limit_delay = int(delay_setting.value) if delay_setting else 60

    return {
        "is_paused": is_paused,
        "rate_limit_delay": rate_limit_delay
    }

@router.post("/settings")
async def update_queue_settings(
    data: dict, 
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    from app.modules.admin.models import SystemSetting
    
    if "is_paused" in data:
        is_paused_str = "true" if data["is_paused"] else "false"
        res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
        paused_setting = res_paused.scalar_one_or_none()
        if paused_setting:
            paused_setting.value = is_paused_str
        else:
            db.add(SystemSetting(key="queue_is_paused", value=is_paused_str, description="Is background task queue paused", category="Queue"))
            
    if "rate_limit_delay" in data:
        try:
            delay_val = max(1, int(data["rate_limit_delay"]))
            res_delay = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay"))
            delay_setting = res_delay.scalar_one_or_none()
            if delay_setting:
                delay_setting.value = str(delay_val)
            else:
                db.add(SystemSetting(key="queue_rate_limit_delay", value=str(delay_val), description="Delay interval between queue tasks", category="Queue"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid rate_limit_delay")
            
    await db.commit()
    return await get_queue_settings(db, _auth)


# -------------------------------------------------------------------
# Synchronous generation (bypass queue, instant response)
# -------------------------------------------------------------------

@router.post("/generate-sync")
async def generate_sync(
    body: dict,
    _auth: bool = Depends(verify_queue_token),
):
    """
    Synchronous AI text generation endpoint.
    Satellites call this for immediate (non-queued) AI responses.
    The prompt is processed directly and the result is returned in the response body.
    """
    prompt = body.get("prompt", "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Missing prompt")

    from app.core.db import SessionLocal
    from app.modules.identity.models import User
    from app.modules.queue.worker import (
        _get_admin_provider_config, _generate_text_full
    )
    from app.modules.chat.providers import get_provider, PROVIDERS

    # Resolve admin users for provider credentials
    async with SessionLocal() as auth_db:
        admin_result = await auth_db.execute(
            select(User).where(User.is_admin == True).order_by(User.id.asc())
        )
        admins = admin_result.scalars().all()

    if not admins:
        raise HTTPException(status_code=500, detail="No admin user found for AI provider credentials.")

    # Resolve provider (same failover logic as queue worker)
    primary_admin = admins[0]
    admin_default = getattr(primary_admin, "active_provider", "google") or "google"
    candidates = [admin_default] + [p for p in PROVIDERS.keys() if p != admin_default]

    provider = None
    provider_name = None
    for pname in candidates:
        config = _get_admin_provider_config(admins, pname)
        if not config:
            continue
        try:
            provider = get_provider(pname, api_key=config["api_key"], model_id=config.get("model"))
            provider_name = pname
            break
        except Exception:
            continue

    if not provider:
        raise HTTPException(status_code=500, detail="All AI providers exhausted — no valid API key found.")

    try:
        response_text = await _generate_text_full(provider, prompt)

        # Check for inline error messages from providers
        if response_text.strip().startswith("[") and "Error" in response_text:
            raise Exception(response_text)

        return {
            "status": "completed",
            "result": response_text,
            "provider": provider_name,
        }
    except Exception as gen_err:
        logger.error(f"[GenerateSync] Generation failed: {gen_err}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(gen_err)[:500]}")

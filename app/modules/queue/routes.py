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
    task_type: Optional[str] = Query(None, description="Filter by task type: ai, tts"),
    provider: Optional[str] = Query(None, description="Filter by AI provider"),
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
    if provider:
        query = query.where(QueuedTask.provider == provider)
        count_query = count_query.where(QueuedTask.provider == provider)

    if task_type:
        from sqlalchemy import or_, not_
        if task_type.lower() == "tts":
            query = query.where(QueuedTask.extra_data.like('%"task_type": "tts"%') | QueuedTask.extra_data.like('%"task_type":"tts"%'))
            count_query = count_query.where(QueuedTask.extra_data.like('%"task_type": "tts"%') | QueuedTask.extra_data.like('%"task_type":"tts"%'))
        elif task_type.lower() == "image":
            query = query.where(QueuedTask.extra_data.like('%"task_type": "image"%') | QueuedTask.extra_data.like('%"task_type":"image"%'))
            count_query = count_query.where(QueuedTask.extra_data.like('%"task_type": "image"%') | QueuedTask.extra_data.like('%"task_type":"image"%'))
        elif task_type.lower() == "furigana":
            query = query.where(QueuedTask.extra_data.like('%"task_type": "furigana"%') | QueuedTask.extra_data.like('%"task_type":"furigana"%'))
            count_query = count_query.where(QueuedTask.extra_data.like('%"task_type": "furigana"%') | QueuedTask.extra_data.like('%"task_type":"furigana"%'))
        elif task_type.lower() == "ai":
            query = query.where(
                or_(
                    QueuedTask.extra_data.is_(None),
                    (
                        not_(QueuedTask.extra_data.like('%"task_type": "tts"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"tts"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type": "image"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"image"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type": "furigana"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"furigana"%'))
                    )
                )
            )
            count_query = count_query.where(
                or_(
                    QueuedTask.extra_data.is_(None),
                    (
                        not_(QueuedTask.extra_data.like('%"task_type": "tts"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"tts"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type": "image"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"image"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type": "furigana"%')) &
                        not_(QueuedTask.extra_data.like('%"task_type":"furigana"%'))
                    )
                )
            )

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
    target: str = Query("unrun", description="unrun (pending only), logs (completed/failed), all (all tasks)"),
    task_type: Optional[str] = Query(None, description="ai, tts"),
    satellite_source: Optional[str] = Query(None, description="vocaburn, quizmind, podlearn, etc."),
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token),
):
    """Clear tasks from the queue based on target and filters."""
    from sqlalchemy import delete, or_, not_
    stmt = delete(QueuedTask)
    
    # Target filter
    if target == "unrun":
        stmt = stmt.where(QueuedTask.status == "pending")
    elif target == "logs":
        stmt = stmt.where(QueuedTask.status.in_(["completed", "failed"]))
    elif target == "all":
        # Delete all tasks (no status filter)
        pass
        
    # Task type filter
    if task_type:
        if task_type.lower() == "tts":
            stmt = stmt.where(QueuedTask.extra_data.like('%"task_type": "tts"%') | QueuedTask.extra_data.like('%"task_type":"tts"%'))
        elif task_type.lower() == "ai":
            stmt = stmt.where(or_(QueuedTask.extra_data.is_(None), not_(QueuedTask.extra_data.like('%"task_type": "tts"%')) & not_(QueuedTask.extra_data.like('%"task_type":"tts"%'))))
            
    # Satellite source filter
    if satellite_source:
        stmt = stmt.where(QueuedTask.satellite_source == satellite_source)
        
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

    # Query rate_limit_delay_ai
    res_delay_ai = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_ai"))
    delay_setting_ai = res_delay_ai.scalar_one_or_none()
    rate_limit_delay_ai = int(delay_setting_ai.value) if delay_setting_ai else 60

    # Query rate_limit_delay_tts
    res_delay_tts = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_tts"))
    delay_setting_tts = res_delay_tts.scalar_one_or_none()
    rate_limit_delay_tts = int(delay_setting_tts.value) if delay_setting_tts else 5

    # Query rate_limit_delay_image
    res_delay_image = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_image"))
    delay_setting_image = res_delay_image.scalar_one_or_none()
    rate_limit_delay_image = int(delay_setting_image.value) if delay_setting_image else 5

    # Query socks5_proxy
    res_proxy = await db.execute(select(SystemSetting).where(SystemSetting.key == "socks5_proxy"))
    proxy_setting = res_proxy.scalar_one_or_none()
    socks5_proxy = proxy_setting.value if proxy_setting else ""

    return {
        "is_paused": is_paused,
        "rate_limit_delay_ai": rate_limit_delay_ai,
        "rate_limit_delay_tts": rate_limit_delay_tts,
        "rate_limit_delay_image": rate_limit_delay_image,
        "socks5_proxy": socks5_proxy
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
            
    if "rate_limit_delay_ai" in data:
        try:
            delay_val = max(1, int(data["rate_limit_delay_ai"]))
            res_delay = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_ai"))
            delay_setting = res_delay.scalar_one_or_none()
            if delay_setting:
                delay_setting.value = str(delay_val)
            else:
                db.add(SystemSetting(key="queue_rate_limit_delay_ai", value=str(delay_val), description="Delay interval between AI text tasks", category="Queue"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid rate_limit_delay_ai")

    if "rate_limit_delay_tts" in data:
        try:
            delay_val = max(1, int(data["rate_limit_delay_tts"]))
            res_delay = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_tts"))
            delay_setting = res_delay.scalar_one_or_none()
            if delay_setting:
                delay_setting.value = str(delay_val)
            else:
                db.add(SystemSetting(key="queue_rate_limit_delay_tts", value=str(delay_val), description="Delay interval between TTS tasks", category="Queue"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid rate_limit_delay_tts")

    if "rate_limit_delay_image" in data:
        try:
            delay_val = max(1, int(data["rate_limit_delay_image"]))
            res_delay = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_image"))
            delay_setting = res_delay.scalar_one_or_none()
            if delay_setting:
                delay_setting.value = str(delay_val)
            else:
                db.add(SystemSetting(key="queue_rate_limit_delay_image", value=str(delay_val), description="Delay interval between image tasks", category="Queue"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid rate_limit_delay_image")

    if "socks5_proxy" in data:
        proxy_val = data["socks5_proxy"].strip()
        res_proxy = await db.execute(select(SystemSetting).where(SystemSetting.key == "socks5_proxy"))
        proxy_setting = res_proxy.scalar_one_or_none()
        if proxy_setting:
            proxy_setting.value = proxy_val
        else:
            db.add(SystemSetting(key="socks5_proxy", value=proxy_val, description="SOCKS5 Proxy URL (e.g. socks5://user:pass@host:port)", category="Queue"))
            
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


# -------------------------------------------------------------------
# Centralized Telegram endpoints
# -------------------------------------------------------------------
import secrets
from app.modules.queue.models import UserTelegramConfig
from app.modules.admin.models import SystemSetting

@router.get("/telegram/config/{sso_user_id}")
async def get_telegram_config(
    sso_user_id: int,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Retrieve or create centralized Telegram configuration for a given SSO user ID."""
    res = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.user_id == sso_user_id))
    config = res.scalar_one_or_none()
    
    if not config:
        config = UserTelegramConfig(
            user_id=sso_user_id,
            connect_token=secrets.token_hex(6).upper()
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        
    username_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "telegram_bot_username"))
    username_setting = username_res.scalar_one_or_none()
    bot_username = username_setting.value.strip() if username_setting and username_setting.value else "VocaburnBot"
    
    import json
    settings_dict = {}
    if config.settings:
        try:
            settings_dict = json.loads(config.settings)
        except Exception:
            pass
            
    vocaburn_settings = settings_dict.setdefault("vocaburn", {})
    vocaburn_settings.setdefault("reminder_time", config.reminder_time)
    vocaburn_settings.setdefault("is_active", config.is_active)
    vocaburn_settings.setdefault("streak_guard_enabled", config.streak_guard_enabled)
    vocaburn_settings.setdefault("weekly_summary_enabled", config.weekly_summary_enabled)
    vocaburn_settings.setdefault("inactivity_alert_enabled", config.inactivity_alert_enabled)
    
    return {
        "is_linked": bool(config.telegram_chat_id),
        "telegram_chat_id": config.telegram_chat_id,
        "connect_token": config.connect_token,
        "reminder_time": config.reminder_time,
        "is_active": config.is_active,
        "streak_guard_enabled": config.streak_guard_enabled,
        "weekly_summary_enabled": config.weekly_summary_enabled,
        "inactivity_alert_enabled": config.inactivity_alert_enabled,
        "bot_username": bot_username,
        "settings": settings_dict
    }

@router.post("/telegram/config/{sso_user_id}")
async def update_telegram_config(
    sso_user_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Update centralized Telegram configuration or unlink for a given SSO user ID."""
    res = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.user_id == sso_user_id))
    config = res.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
        
    import json
    current_settings = {}
    if config.settings:
        try:
            current_settings = json.loads(config.settings)
        except Exception:
            pass
    vocaburn_settings = current_settings.setdefault("vocaburn", {})
    
    if "settings" in data:
        # Client updating using structured settings
        for site, site_settings in data["settings"].items():
            if site not in current_settings:
                current_settings[site] = {}
            current_settings[site].update(site_settings)
            
            # Sync back to legacy flat columns for Vocaburn backward compatibility
            if site == "vocaburn":
                if "reminder_time" in site_settings:
                    config.reminder_time = site_settings["reminder_time"]
                if "is_active" in site_settings:
                    config.is_active = site_settings["is_active"]
                if "streak_guard_enabled" in site_settings:
                    config.streak_guard_enabled = site_settings["streak_guard_enabled"]
                if "weekly_summary_enabled" in site_settings:
                    config.weekly_summary_enabled = site_settings["weekly_summary_enabled"]
                if "inactivity_alert_enabled" in site_settings:
                    config.inactivity_alert_enabled = site_settings["inactivity_alert_enabled"]
    else:
        # Legacy flat updates
        if "reminder_time" in data:
            config.reminder_time = data["reminder_time"]
            vocaburn_settings["reminder_time"] = data["reminder_time"]
        if "is_active" in data:
            config.is_active = data["is_active"]
            vocaburn_settings["is_active"] = data["is_active"]
        if "streak_guard_enabled" in data:
            config.streak_guard_enabled = data["streak_guard_enabled"]
            vocaburn_settings["streak_guard_enabled"] = data["streak_guard_enabled"]
        if "weekly_summary_enabled" in data:
            config.weekly_summary_enabled = data["weekly_summary_enabled"]
            vocaburn_settings["weekly_summary_enabled"] = data["weekly_summary_enabled"]
        if "inactivity_alert_enabled" in data:
            config.inactivity_alert_enabled = data["inactivity_alert_enabled"]
            vocaburn_settings["inactivity_alert_enabled"] = data["inactivity_alert_enabled"]
            
    config.settings = json.dumps(current_settings)
    
    if data.get("unlink") is True:
        config.telegram_chat_id = None
        config.connect_token = secrets.token_hex(6).upper() # reset token
        
    await db.commit()
    return {"status": "success"}

@router.post("/telegram/send-message")
async def send_telegram_message(
    data: dict,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Route message delivery through the centralized Telegram Bot and log the dispatch."""
    chat_id = data.get("chat_id")
    text = data.get("text")
    source = data.get("source", "vocaburn")
    message_type = data.get("message_type", "study_reminder")
    variables = data.get("variables") or {}
    
    if not chat_id:
        raise HTTPException(status_code=400, detail="Missing chat_id")
        
    # Resolve user_id from chat_id
    res_cfg = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.telegram_chat_id == str(chat_id)))
    config = res_cfg.scalar_one_or_none()
    user_id = config.user_id if config else None

    # Populate fallback variables
    if "username" not in variables and user_id:
        from app.modules.identity.models import User as UserDB
        u_res = await db.execute(select(UserDB).where(UserDB.id == user_id))
        u_obj = u_res.scalar_one_or_none()
        if u_obj:
            variables["username"] = u_obj.username

    # Only load and compile template if explicit text was not provided by satellite app
    if not text:
        from app.modules.queue.models import TelegramMessageTemplate
        tpl_res = await db.execute(
            select(TelegramMessageTemplate)
            .where(TelegramMessageTemplate.client_id == source, TelegramMessageTemplate.message_type == message_type)
        )
        template_obj = tpl_res.scalar_one_or_none()
        if template_obj and template_obj.template_text:
            text = template_obj.template_text
            for k, v in variables.items():
                text = text.replace(f"{{{k}}}", str(v))

    if not text:
        raise HTTPException(status_code=400, detail="Missing text or template could not compile")

        
    from app.modules.queue.telegram_bot import bot
    client_bot = bot
    if not client_bot:
        token_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "telegram_bot_token"))
        token_setting = token_res.scalar_one_or_none()
        token = token_setting.value.strip() if token_setting and token_setting.value else None
        
        if not token:
            logger.warning("[TelegramBot] Centralized Bot instance is not active/running and no Token configured.")
            raise HTTPException(status_code=503, detail="Telegram Bot is not configured on CentralAuth server.")
            
        from telegram import Bot
        client_bot = Bot(token=token)
        
    success = False
    error_str = None
    try:
        await client_bot.send_message(chat_id=chat_id, text=text, parse_mode="HTML")
        success = True
        return {"status": "success"}
    except Exception as e:
        error_str = str(e)
        logger.error(f"[TelegramBot] Centralized send failed: {e}")
        raise HTTPException(status_code=500, detail=error_str)
    finally:
        # Log to TelegramMessageLog
        if user_id is not None:
            from app.modules.queue.models import TelegramMessageLog
            log_entry = TelegramMessageLog(
                user_id=user_id,
                satellite_source=source,
                message_type=message_type,
                text=text,
                status="success" if success else "failed",
                error=error_str
            )
            db.add(log_entry)
            await db.commit()

@router.get("/telegram/configs")
async def get_all_telegram_configs(
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Retrieve all user Telegram configurations (used by satellite scheduler loops)."""
    import json
    res = await db.execute(select(UserTelegramConfig))
    configs = res.scalars().all()
    
    out = []
    for c in configs:
        settings_dict = {}
        if c.settings:
            try:
                settings_dict = json.loads(c.settings)
            except Exception:
                pass
        vocaburn_settings = settings_dict.setdefault("vocaburn", {})
        vocaburn_settings.setdefault("reminder_time", c.reminder_time)
        vocaburn_settings.setdefault("is_active", c.is_active)
        vocaburn_settings.setdefault("streak_guard_enabled", c.streak_guard_enabled)
        vocaburn_settings.setdefault("weekly_summary_enabled", c.weekly_summary_enabled)
        vocaburn_settings.setdefault("inactivity_alert_enabled", c.inactivity_alert_enabled)
        
        out.append({
            "user_id": c.user_id,
            "telegram_chat_id": c.telegram_chat_id,
            "reminder_time": c.reminder_time,
            "is_active": c.is_active,
            "streak_guard_enabled": c.streak_guard_enabled,
            "weekly_summary_enabled": c.weekly_summary_enabled,
            "inactivity_alert_enabled": c.inactivity_alert_enabled,
            "settings": settings_dict
        })
    return out

@router.get("/telegram/logs/{sso_user_id}")
async def get_user_telegram_logs_by_id(
    sso_user_id: int,
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Retrieve message logs for a specific SSO user ID."""
    from app.modules.queue.models import TelegramMessageLog
    res = await db.execute(
        select(TelegramMessageLog)
        .where(TelegramMessageLog.user_id == sso_user_id)
        .order_by(TelegramMessageLog.sent_at.desc())
        .limit(50)
    )
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "satellite_source": l.satellite_source,
            "message_type": l.message_type,
            "text": l.text,
            "status": l.status,
            "error": l.error,
            "sent_at": l.sent_at.isoformat()
        }
        for l in logs
    ]

@router.get("/telegram/logs")
async def get_all_telegram_logs(
    db: AsyncSession = Depends(get_db),
    _auth: bool = Depends(verify_queue_token)
):
    """Retrieve all Telegram message logs (for admin monitor)."""
    from app.modules.queue.models import TelegramMessageLog
    res = await db.execute(
        select(TelegramMessageLog)
        .order_by(TelegramMessageLog.sent_at.desc())
        .limit(100)
    )
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "user_id": l.user_id,
            "satellite_source": l.satellite_source,
            "message_type": l.message_type,
            "text": l.text,
            "status": l.status,
            "error": l.error,
            "sent_at": l.sent_at.isoformat()
        }
        for l in logs
    ]


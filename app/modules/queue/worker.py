import asyncio
import json
import logging
import httpx
import os
from datetime import datetime
from sqlalchemy import select, func

from app.core.db_aichat import SessionLocal
from app.core.db import SessionLocal as CentralAuthSessionLocal
from app.core.config import settings
from app.modules.queue.models import QueuedTask
from app.modules.chat.providers import get_provider, PROVIDERS

class QueueWorkerState:
    def __init__(self):
        self.is_paused = False
        self.rate_limit_delay = int(os.environ.get("QUEUE_RATE_LIMIT_DELAY", 60))

worker_state = QueueWorkerState()

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Provider key resolution helpers
# -------------------------------------------------------------------

def _get_admin_provider_config(admin_user, provider_name: str) -> dict:
    """
    Extract API key and model from the admin user record for a given provider.
    Returns {"api_key": ..., "model": ...} or empty dict if not configured.
    """
    key_col = f"{provider_name}_api_key"
    model_col = f"{provider_name}_model"
    api_key = getattr(admin_user, key_col, None) or ""
    model_id = getattr(admin_user, model_col, None) or ""
    if api_key:
        return {"api_key": api_key, "model": model_id}
    return {}


async def _resolve_provider(task: QueuedTask, admin_user) -> tuple:
    """
    Resolve which provider to use for a task, implementing failover logic.
    
    Priority order:
      1. task.provider_priority list (JSON array of provider names)
      2. task.provider (single preferred provider)
      3. admin_user.active_provider (system default)
    
    Returns (provider_instance, provider_name) or (None, None) if all fail.
    """
    candidates = []

    # 1. Build candidate list from priority chain
    if task.provider_priority:
        try:
            candidates = json.loads(task.provider_priority)
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. Append single preferred provider if not already in list
    if task.provider and task.provider not in candidates:
        candidates.append(task.provider)

    # 3. Append admin default if not already in list
    admin_default = getattr(admin_user, "active_provider", "google") or "google"
    if admin_default not in candidates:
        candidates.append(admin_default)

    # 4. Add all remaining configured providers as ultimate fallback
    for pname in PROVIDERS.keys():
        if pname not in candidates:
            candidates.append(pname)

    # Try each candidate
    for provider_name in candidates:
        config = _get_admin_provider_config(admin_user, provider_name)
        if not config:
            continue
        try:
            provider = get_provider(
                provider_name,
                api_key=config["api_key"],
                model_id=task.model or config.get("model")
            )
            return provider, provider_name
        except Exception as e:
            logger.warning(f"[QueueWorker] Failed to init provider '{provider_name}': {e}")
            continue

    return None, None


# -------------------------------------------------------------------
# Non-streaming text generation
# -------------------------------------------------------------------

async def _generate_text_full(provider, prompt: str) -> str:
    """
    Consume the streaming generator and collect the full text response.
    This is the bridge between the streaming-only provider interface
    and the queue worker's need for a complete response.
    """
    full_text = []
    async for chunk in provider.generate_text_stream(prompt, history=[]):
        full_text.append(chunk)
    return "".join(full_text)


# -------------------------------------------------------------------
# Callback delivery
# -------------------------------------------------------------------

async def _send_callback(task: QueuedTask):
    """POST the task result to the satellite's callback_url."""
    if not task.callback_url:
        return

    payload = {
        "task_id": task.id,
        "satellite_source": task.satellite_source,
        "status": task.status,
        "result": task.result,
        "error": task.error,
        "extra_data": task.extra_data,
        "processed_at": task.processed_at.isoformat() if task.processed_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                task.callback_url,
                json=payload,
                timeout=15.0,
                headers={"Content-Type": "application/json"}
            )
            if resp.status_code < 300:
                task.callback_status = "sent"
                logger.info(f"[QueueWorker] Callback sent for task {task.id} -> {resp.status_code}")
            else:
                task.callback_status = "failed"
                logger.warning(
                    f"[QueueWorker] Callback failed for task {task.id}: "
                    f"HTTP {resp.status_code} — {resp.text[:200]}"
                )
    except Exception as e:
        task.callback_status = "failed"
        logger.error(f"[QueueWorker] Callback exception for task {task.id}: {e}")


# -------------------------------------------------------------------
# Main worker loop
# -------------------------------------------------------------------

async def start_queue_worker():
    """
    Long-running background coroutine that picks pending tasks from the
    database, processes them through the AI provider chain, and delivers
    results via callbacks.
    """
    logger.info(f"[QueueWorker] Started — polling based on worker_state configuration")

    while True:
        if worker_state.is_paused:
            await asyncio.sleep(2)
            continue

        delay = worker_state.rate_limit_delay
        is_tts = False
        try:
            async with SessionLocal() as db:
                # --------------------------------------------------
                # 1. Fetch the oldest pending task
                # --------------------------------------------------
                stmt = (
                    select(QueuedTask)
                    .where(QueuedTask.status == "pending")
                    .order_by(QueuedTask.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                task = result.scalar_one_or_none()

                if not task:
                    # Nothing to do — sleep and retry
                    await asyncio.sleep(delay)
                    continue

                # --------------------------------------------------
                # 2. Mark as processing
                # --------------------------------------------------
                task.status = "processing"
                task.processed_at = datetime.utcnow()
                task.attempts += 1
                try:
                    await db.commit()
                except Exception as commit_err:
                    await db.rollback()
                    logger.warning(f"[QueueWorker] Failed to mark task {task.id} as processing (likely deleted): {commit_err}")
                    continue

                logger.info(
                    f"[QueueWorker] Processing task {task.id} "
                    f"(source={task.satellite_source}, attempt={task.attempts})"
                )

                # Check if this is a TTS task via extra_data JSON
                if task.extra_data:
                    try:
                        extra = json.loads(task.extra_data)
                        if extra.get("task_type") == "tts":
                            is_tts = True
                    except Exception:
                        pass

                if is_tts:
                    # TTS processing route
                    try:
                        from app.modules.tts.services import AudioGenerator
                        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                        upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
                        os.makedirs(upload_dir, exist_ok=True)
                        
                        filename = f"tts_{AudioGenerator.get_voice_hash(task.prompt)}.mp3"
                        physical_path = os.path.join(upload_dir, filename)
                        
                        success = await AudioGenerator.generate_tts(task.prompt, physical_path)
                        if not success:
                            raise Exception("Failed to synthesize TTS")
                            
                        task.status = "completed"
                        task.result = f"/static/uploads/tts/{filename}"
                        task.completed_at = datetime.utcnow()
                        logger.info(f"[QueueWorker] TTS Task {task.id} completed successfully.")
                    except Exception as tts_err:
                        logger.error(f"[QueueWorker] TTS generation failed for task {task.id}: {tts_err}")
                        if task.attempts < task.max_retries:
                            task.status = "pending"
                            task.error = f"Attempt {task.attempts} failed: {str(tts_err)[:500]}"
                        else:
                            task.status = "failed"
                            task.error = f"Max retries exceeded. Last error: {str(tts_err)[:500]}"
                            task.completed_at = datetime.utcnow()
                else:
                    # Normal Text Generation task
                    from app.modules.identity.models import User
                    async with CentralAuthSessionLocal() as auth_db:
                        admin_result = await auth_db.execute(
                            select(User).where(User.is_admin == True).limit(1)
                        )
                        admin_user = admin_result.scalar_one_or_none()

                    if not admin_user:
                        task.status = "failed"
                        task.error = "No admin user found — cannot resolve AI provider credentials."
                        task.completed_at = datetime.utcnow()
                        await db.commit()
                        await asyncio.sleep(delay)
                        continue

                    provider, provider_name = await _resolve_provider(task, admin_user)

                    if not provider:
                        task.status = "failed"
                        task.error = "All AI providers exhausted — no valid API key found."
                        task.completed_at = datetime.utcnow()
                        await db.commit()
                        await _send_callback(task)
                        await db.commit()
                        await asyncio.sleep(delay)
                        continue

                    try:
                        response_text = await _generate_text_full(provider, task.prompt)

                        # Check for inline error messages from providers
                        if response_text.strip().startswith("[") and "Error" in response_text:
                            raise Exception(response_text)

                        task.status = "completed"
                        task.result = response_text
                        task.provider = provider_name
                        task.completed_at = datetime.utcnow()
                        logger.info(
                            f"[QueueWorker] Task {task.id} completed "
                            f"(provider={provider_name}, chars={len(response_text)})"
                        )

                    except Exception as gen_err:
                        logger.error(f"[QueueWorker] Generation failed for task {task.id}: {gen_err}")

                        if task.attempts < task.max_retries:
                            task.status = "pending"  # Re-queue for retry
                            task.error = f"Attempt {task.attempts} failed: {str(gen_err)[:500]}"
                        else:
                            task.status = "failed"
                            task.error = f"Max retries exceeded. Last error: {str(gen_err)[:500]}"
                            task.completed_at = datetime.utcnow()

                # --------------------------------------------------
                # 5. Deliver callback & persist
                # --------------------------------------------------
                try:
                    await db.commit()
                except Exception as commit_err:
                    await db.rollback()
                    logger.warning(f"[QueueWorker] Failed to save finished task {task.id} (likely deleted): {commit_err}")
                    continue

                if task.status in ("completed", "failed") and task.callback_url:
                    await _send_callback(task)
                    try:
                        await db.commit()
                    except Exception as callback_commit_err:
                        await db.rollback()
                        logger.warning(f"[QueueWorker] Failed to save callback delivery status for task {task.id}: {callback_commit_err}")

        except Exception as loop_err:
            logger.error(f"[QueueWorker] Unexpected loop error: {loop_err}", exc_info=True)

        # Rate-limit sleep using configured delay interval
        await asyncio.sleep(delay)

import asyncio
import json
import logging
import httpx
import os
from datetime import datetime
from sqlalchemy import select, func

from app.core.db import SessionLocal
from app.core.config import settings
from app.modules.queue.models import QueuedTask
from app.modules.chat.providers import get_provider, PROVIDERS



logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Provider key resolution helpers
# -------------------------------------------------------------------

def _get_admin_provider_config(admins, provider_name: str) -> dict:
    """
    Extract API key and model from the active key configurations or fallback fields.
    Searches both custom keys inside api_keys_json and individual columns across all admins.
    """
    import json
    # 1. Search custom keys first
    for admin in admins:
        try:
            keys = json.loads(admin.api_keys_json or "[]")
            for k in keys:
                if k.get("provider") == provider_name and k.get("api_key"):
                    return {"api_key": k.get("api_key"), "model": k.get("model") or ""}
        except Exception:
            pass

    # 2. Fall back to individual columns on the admins
    key_col = f"{provider_name}_api_key"
    model_col = f"{provider_name}_model"
    for admin in admins:
        api_key = getattr(admin, key_col, None) or ""
        model_id = getattr(admin, model_col, None) or ""
        if api_key:
            return {"api_key": api_key, "model": model_id}
            
    return {}


async def _build_candidate_providers(task: QueuedTask, admins: list, db) -> list:
    """
    Build a list of candidate API configurations (provider, api_key, model_id) for a task.
    First tries to read from AIFailoverModel (failover pool).
    If empty, falls back to default provider resolution.
    """
    from app.modules.admin.models import AIFailoverModel
    candidates = []

    # 1. Try to load configured failover pool items
    try:
        stmt = select(AIFailoverModel).where(AIFailoverModel.is_enabled == True).order_by(AIFailoverModel.priority.asc())
        res = await db.execute(stmt)
        items = res.scalars().all()
        for item in items:
            api_key = ""
            for admin in admins:
                try:
                    keys = json.loads(admin.api_keys_json or "[]")
                    for k in keys:
                        if k.get("id") == item.key_id and k.get("api_key"):
                            api_key = k.get("api_key")
                            break
                    if api_key:
                        break
                except Exception:
                    pass
            # Fallback to column-based key if key_id matches provider name or no custom key found
            if not api_key:
                key_col = f"{item.provider}_api_key"
                for admin in admins:
                    val = getattr(admin, key_col, None)
                    if val:
                        api_key = val
                        break
            
            if api_key:
                candidates.append({
                    "provider_name": item.provider,
                    "api_key": api_key,
                    "model_id": task.model or item.model_id,
                    "label": f"{item.provider} ({item.key_label})"
                })
    except Exception as e:
        logger.error(f"[QueueWorker] Error loading failover pool from DB: {e}")

    # 2. Dynamic resolution fallback if DB failover pool is empty
    if not candidates:
        logger.info("[QueueWorker] No failover pool configured in DB. Falling back to dynamic resolution.")
        pnames = []
        if task.provider_priority:
            try:
                pnames = json.loads(task.provider_priority)
            except (json.JSONDecodeError, TypeError):
                pass
        if task.provider and task.provider not in pnames:
            pnames.append(task.provider)
        primary_admin = admins[0] if admins else None
        admin_default = getattr(primary_admin, "active_provider", "google") or "google" if primary_admin else "google"
        if admin_default not in pnames:
            pnames.append(admin_default)
        for pname in PROVIDERS.keys():
            if pname not in pnames:
                pnames.append(pname)
                
        for pname in pnames:
            config = _get_admin_provider_config(admins, pname)
            if config:
                candidates.append({
                    "provider_name": pname,
                    "api_key": config["api_key"],
                    "model_id": task.model or config.get("model") or "",
                    "label": pname
                })

    return candidates


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
    Main coordinator that launches both AI and TTS queue workers in parallel.
    """
    logger.info(f"[QueueWorker] Started coordinator — launching parallel AI and TTS worker tasks")

    # Reset any stuck 'processing' tasks back to 'pending' on worker startup/restart
    try:
        async with SessionLocal() as db:
            result = await db.execute(
                select(QueuedTask).where(QueuedTask.status == "processing")
            )
            stuck_tasks = result.scalars().all()
            if stuck_tasks:
                logger.info(f"[QueueWorker] Resetting {len(stuck_tasks)} stuck 'processing' tasks back to 'pending'.")
                for t in stuck_tasks:
                    t.status = "pending"
                await db.commit()
    except Exception as startup_err:
        logger.error(f"[QueueWorker] Failed to reset stuck 'processing' tasks on startup: {startup_err}")

    # Launch workers in parallel
    await asyncio.gather(
        start_ai_queue_worker(),
        start_tts_queue_worker(),
        start_image_queue_worker(),
        start_furigana_queue_worker()
    )


async def process_ai_task_helper(task_id: int):
    from sqlalchemy import select
    from app.modules.identity.models import User
    
    async with SessionLocal() as db:
        stmt = select(QueuedTask).where(QueuedTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return

        task_prompt = task.prompt
        task_attempts = task.attempts
        task_max_retries = task.max_retries

        import hashlib
        prompt_hash = hashlib.sha256(task_prompt.encode('utf-8')).hexdigest()

        # Check cache
        from app.modules.chat.models import AICache
        try:
            cache_res = await db.execute(select(AICache).where(AICache.prompt_hash == prompt_hash))
            cache_item = cache_res.scalar_one_or_none()
            if cache_item:
                logger.info(f"[QueueWorker-AI] Cache Hit for task {task_id}! Prompt Hash: {prompt_hash}")
                task.result = cache_item.response
                task.status = "completed"
                task.completed_at = datetime.utcnow()
                
                if task.callback_url and task.extra_data:
                    import json
                    try:
                        extra = json.loads(task.extra_data)
                        card_id = extra.get("card_id")
                        field = extra.get("field", "explanation")
                        if card_id:
                            # 1. Clean up this card link from other cache entries to maintain uniqueness
                            other_caches_stmt = select(AICache).where(AICache.prompt_hash != prompt_hash, AICache.linked_cards != None, AICache.linked_cards != '[]')
                            other_caches_res = await db.execute(other_caches_stmt)
                            for other in other_caches_res.scalars().all():
                                try:
                                    other_links = json.loads(other.linked_cards)
                                    updated_links = [
                                        ol for ol in other_links
                                        if not (ol.get("card_id") == card_id and ol.get("field") == field and ol.get("satellite_source") == task.satellite_source)
                                    ]
                                    if len(updated_links) != len(other_links):
                                        other.linked_cards = json.dumps(updated_links)
                                except Exception:
                                    pass
                                    
                            links = json.loads(cache_item.linked_cards or "[]")
                            new_link = {
                                "satellite_source": task.satellite_source,
                                "card_id": card_id,
                                "field": field,
                                "callback_url": task.callback_url
                            }
                            if not any(l.get("card_id") == card_id and l.get("field") == field and l.get("satellite_source") == task.satellite_source for l in links):
                                links.append(new_link)
                                cache_item.linked_cards = json.dumps(links)
                    except Exception as link_err:
                        logger.warning(f"[QueueWorker-AI] Failed to update linked_cards on cache hit: {link_err}")
                        
                await db.commit()
                if task.callback_url:
                    await _send_callback(task)
                    await db.commit()
                return
        except Exception as cache_chk_err:
            logger.warning(f"[QueueWorker-AI] Failed to check AI cache: {cache_chk_err}")

        admin_result = await db.execute(
            select(User).where(User.is_admin == True).order_by(User.id.asc())
        )
        admins = admin_result.scalars().all()

        if not admins:
            task.status = "failed"
            task.error = "No admin user found — cannot resolve AI provider credentials."
            task.completed_at = datetime.utcnow()
            await db.commit()
            return

        candidates = await _build_candidate_providers(task, admins, db)

        if not candidates:
            task.status = "failed"
            task.error = "No AI providers configured — no valid API key found."
            task.completed_at = datetime.utcnow()
            await db.commit()
            await _send_callback(task)
            await db.commit()
            return

        response_text = None
        success_provider_name = None
        errors_accumulated = []

        for candidate in candidates:
            pname = candidate["provider_name"]
            pkey = candidate["api_key"]
            pmodel = candidate["model_id"]
            plabel = candidate["label"]
            try:
                logger.info(f"[QueueWorker-AI] Trying provider '{plabel}' with model '{pmodel}' for task {task_id}")
                provider = get_provider(pname, api_key=pkey, model_id=pmodel)
                
                res_val = await _generate_text_full(provider, task_prompt)
                if res_val.strip().startswith("[") and "Error" in res_val:
                    raise Exception(res_val)

                response_text = res_val
                success_provider_name = pname
                logger.info(f"[QueueWorker-AI] Successfully generated text using provider '{plabel}' for task {task_id}")
                break
            except Exception as gen_err:
                err_msg = f"Provider '{plabel}' ({pmodel}) failed: {gen_err}"
                logger.error(f"[QueueWorker-AI] {err_msg}")
                errors_accumulated.append(err_msg)
                continue

        if response_text is not None:
            task.status = "completed"
            task.result = response_text
            task.provider = success_provider_name
            task.completed_at = datetime.utcnow()
            
            # Save to AI cache
            try:
                model_used = task.model or ""
                initial_links = []
                if task.callback_url and task.extra_data:
                    import json
                    try:
                        extra = json.loads(task.extra_data)
                        card_id = extra.get("card_id")
                        field = extra.get("field", "explanation")
                        if card_id:
                            # 1. Clean up this card link from other cache entries to maintain uniqueness
                            other_caches_stmt = select(AICache).where(AICache.prompt_hash != prompt_hash, AICache.linked_cards != None, AICache.linked_cards != '[]')
                            other_caches_res = await db.execute(other_caches_stmt)
                            for other in other_caches_res.scalars().all():
                                try:
                                    other_links = json.loads(other.linked_cards)
                                    updated_links = [
                                        ol for ol in other_links
                                        if not (ol.get("card_id") == card_id and ol.get("field") == field and ol.get("satellite_source") == task.satellite_source)
                                    ]
                                    if len(updated_links) != len(other_links):
                                        other.linked_cards = json.dumps(updated_links)
                                except Exception:
                                    pass
                                    
                            initial_links.append({
                                "satellite_source": task.satellite_source,
                                "card_id": card_id,
                                "field": field,
                                "callback_url": task.callback_url
                            })
                    except Exception:
                        pass
                
                # Check if cache item already exists to prevent duplicate key
                cache_stmt = select(AICache).where(AICache.prompt_hash == prompt_hash)
                cache_res = await db.execute(cache_stmt)
                existing_cache = cache_res.scalar_one_or_none()
                if existing_cache:
                    existing_cache.response = response_text
                    existing_cache.provider = success_provider_name
                    existing_cache.model = model_used
                    curr_links = json.loads(existing_cache.linked_cards or "[]")
                    for il in initial_links:
                        if not any(cl.get("card_id") == il["card_id"] and cl.get("field") == il["field"] and cl.get("satellite_source") == il["satellite_source"] for cl in curr_links):
                            curr_links.append(il)
                    existing_cache.linked_cards = json.dumps(curr_links)
                else:
                    new_cache = AICache(
                        prompt_hash=prompt_hash,
                        prompt=task_prompt,
                        response=response_text,
                        provider=success_provider_name,
                        model=model_used,
                        linked_cards=json.dumps(initial_links) if initial_links else "[]"
                    )
                    db.add(new_cache)
                await db.flush()
            except Exception as cache_write_err:
                logger.warning(f"[QueueWorker-AI] Failed to save generated text to AI cache: {cache_write_err}")
                await db.rollback()
                # Reload task and reset attributes if rollback affected session state
                task_res = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
                task = task_res.scalar_one()
                task.status = "completed"
                task.result = response_text
                task.provider = success_provider_name
                task.completed_at = datetime.utcnow()
        else:
            all_errors = " | ".join(errors_accumulated)
            logger.error(f"[QueueWorker-AI] All candidates failed for task {task_id}. Errors: {all_errors}")
            if task_attempts < task_max_retries:
                task.status = "pending"
                task.error = f"Attempt {task_attempts} failed. Errors: {all_errors[:500]}"
            else:
                task.status = "failed"
                task.error = f"Max retries exceeded. Errors: {all_errors[:500]}"
                task.completed_at = datetime.utcnow()

        await db.commit()

        if task.status in ("completed", "failed") and task.callback_url:
            await _send_callback(task)
            await db.commit()

async def start_ai_queue_worker():
    """Poller worker dedicated solely to processing AI text generation tasks."""
    logger.info("[QueueWorker] AI Text Generator Worker task started.")
    from sqlalchemy import or_, not_
    
    sem = asyncio.Semaphore(1)

    async def worker_job(task_id: int):
        async with sem:
            try:
                await process_ai_task_helper(task_id)
            except Exception as e:
                logger.error(f"[QueueWorker-AI] Error in worker_job for task {task_id}: {e}")

    while True:
        is_paused = False
        delay_ai = 60
        
        try:
            async with SessionLocal() as db:
                from app.modules.admin.models import SystemSetting
                
                # Check is_paused
                res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
                paused_setting = res_paused.scalar_one_or_none()
                is_paused = (paused_setting.value == "true") if paused_setting else False

                # Check rate_limit_delay_ai
                res_delay_ai = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_ai"))
                delay_setting_ai = res_delay_ai.scalar_one_or_none()
                delay_ai = int(delay_setting_ai.value) if delay_setting_ai else 60
        except Exception as db_err:
            logger.warning(f"[QueueWorker-AI] Failed to query system_settings: {db_err}")

        if is_paused:
            await asyncio.sleep(2)
            continue

        try:
            async with SessionLocal() as db:
                # Fetch oldest pending AI/Text tasks (extra_data is null OR task_type != tts/image)
                stmt = (
                    select(QueuedTask)
                    .where(
                        QueuedTask.status == "pending",
                        or_(
                            QueuedTask.extra_data.is_(None),
                            not_(QueuedTask.extra_data.like('%"task_type": "tts"%')) & not_(QueuedTask.extra_data.like('%"task_type":"tts"%')) &
                            not_(QueuedTask.extra_data.like('%"task_type": "image"%')) & not_(QueuedTask.extra_data.like('%"task_type":"image"%')) &
                            not_(QueuedTask.extra_data.like('%"task_type": "furigana"%')) & not_(QueuedTask.extra_data.like('%"task_type":"furigana"%'))
                        )
                    )
                    .order_by(QueuedTask.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                tasks = result.scalars().all()

                if not tasks:
                    await asyncio.sleep(2)
                    continue

                task_ids = []
                for task in tasks:
                    task.status = "processing"
                    task.processed_at = datetime.utcnow()
                    task.attempts += 1
                    task_ids.append(task.id)
                await db.commit()

                logger.info(f"[QueueWorker-AI] Dispatched {len(task_ids)} tasks for parallel processing: {task_ids}")
                for tid in task_ids:
                    asyncio.create_task(worker_job(tid))

        except Exception as loop_err:
            logger.error(f"[QueueWorker-AI] Unexpected loop error: {loop_err}", exc_info=True)

        await asyncio.sleep(delay_ai)


async def process_tts_task_helper(task_id: int):
    from sqlalchemy import select
    
    async with SessionLocal() as db:
        stmt = select(QueuedTask).where(QueuedTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return

        task_prompt = task.prompt
        task_attempts = task.attempts
        task_max_retries = task.max_retries

        try:
            from app.modules.tts.services import AudioGenerator
            from app.modules.tts.models import TTSCache
            
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
            os.makedirs(upload_dir, exist_ok=True)
            
            prompt_hash = AudioGenerator.get_voice_hash(task_prompt)
            filename = f"tts_{prompt_hash}.mp3"
            physical_path = os.path.join(upload_dir, filename)
            
            cache_res = await db.execute(select(TTSCache).where(TTSCache.prompt_hash == prompt_hash))
            cache_item = cache_res.scalar_one_or_none()
            
            if cache_item and os.path.exists(cache_item.file_path):
                logger.info(f"[QueueWorker-TTS] TTS cache hit in DB for task {task_id}")
                task.status = "completed"
                task.result = f"/static/uploads/tts/{filename}"
                task.completed_at = datetime.utcnow()
            else:
                success = await AudioGenerator.generate_tts(task_prompt, physical_path)
                if not success:
                    raise Exception("Failed to synthesize TTS")
                    
                try:
                    if not cache_item:
                        cache_item = TTSCache(
                            prompt_hash=prompt_hash,
                            text=task_prompt,
                            file_path=f"/static/uploads/tts/{filename}"
                        )
                        db.add(cache_item)
                    else:
                        cache_item.file_path = f"/static/uploads/tts/{filename}"
                    await db.flush()
                except Exception as cache_db_err:
                    await db.rollback()
                    logger.warning(f"[QueueWorker-TTS] TTS cache DB collision for task {task_id}: {cache_db_err}")
                    # reload task
                    task_res = await db.execute(select(QueuedTask).where(QueuedTask.id == task_id))
                    task = task_res.scalar_one()
                
                task.status = "completed"
                task.result = f"/static/uploads/tts/{filename}"
                task.completed_at = datetime.utcnow()
                logger.info(f"[QueueWorker-TTS] TTS Task {task_id} completed successfully.")
        except Exception as tts_err:
            logger.error(f"[QueueWorker-TTS] TTS generation failed: {tts_err}")
            if task_attempts < task_max_retries:
                task.status = "pending"
                task.error = f"Attempt {task_attempts} failed: {str(tts_err)[:500]}"
            else:
                task.status = "failed"
                task.error = f"Max retries exceeded. Last error: {str(tts_err)[:500]}"
                task.completed_at = datetime.utcnow()

        await db.commit()

        if task.status in ("completed", "failed") and task.callback_url:
            await _send_callback(task)
            await db.commit()

async def start_tts_queue_worker():
    """Poller worker dedicated solely to processing TTS voice generation tasks."""
    logger.info("[QueueWorker] TTS Audio Generator Worker task started.")
    from sqlalchemy import or_

    sem = asyncio.Semaphore(1)

    async def worker_job(task_id: int):
        async with sem:
            try:
                await process_tts_task_helper(task_id)
            except Exception as e:
                logger.error(f"[QueueWorker-TTS] Error in worker_job for task {task_id}: {e}")

    while True:
        is_paused = False
        delay_tts = 5
        
        try:
            async with SessionLocal() as db:
                from app.modules.admin.models import SystemSetting
                
                # Check is_paused
                res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
                paused_setting = res_paused.scalar_one_or_none()
                is_paused = (paused_setting.value == "true") if paused_setting else False

                # Check rate_limit_delay_tts
                res_delay_tts = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_tts"))
                delay_setting_tts = res_delay_tts.scalar_one_or_none()
                delay_tts = int(delay_setting_tts.value) if delay_setting_tts else 5
        except Exception as db_err:
            logger.warning(f"[QueueWorker-TTS] Failed to query system_settings: {db_err}")

        if is_paused:
            await asyncio.sleep(2)
            continue

        try:
            async with SessionLocal() as db:
                # Fetch oldest pending TTS tasks (extra_data has task_type == tts)
                stmt = (
                    select(QueuedTask)
                    .where(
                        QueuedTask.status == "pending",
                        or_(
                            QueuedTask.extra_data.like('%"task_type": "tts"%'),
                            QueuedTask.extra_data.like('%"task_type":"tts"%')
                        )
                    )
                    .order_by(QueuedTask.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                tasks = result.scalars().all()

                if not tasks:
                    await asyncio.sleep(2)
                    continue

                task_ids = []
                for task in tasks:
                    task.status = "processing"
                    task.processed_at = datetime.utcnow()
                    task.attempts += 1
                    task_ids.append(task.id)
                await db.commit()

                logger.info(f"[QueueWorker-TTS] Dispatched {len(task_ids)} tasks for parallel processing: {task_ids}")
                for tid in task_ids:
                    asyncio.create_task(worker_job(tid))

        except Exception as loop_err:
            logger.error(f"[QueueWorker-TTS] Unexpected loop error: {loop_err}", exc_info=True)

        await asyncio.sleep(delay_tts)


async def process_image_task_helper(task_id: int):
    from sqlalchemy import select
    from app.modules.media.services import MediaService
    
    async with SessionLocal() as db:
        stmt = select(QueuedTask).where(QueuedTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return

        task_prompt = task.prompt
        task_attempts = task.attempts
        task_max_retries = task.max_retries

        try:
            logger.info(f"[QueueWorker-Image] Processing task {task_id}")
            
            # Extract source_info from task
            source_info = None
            if task.extra_data:
                try:
                    extra = json.loads(task.extra_data)
                    deck_id = extra.get("deck_id")
                    card_id = extra.get("card_id")
                    source_info = f"{task.satellite_source or 'Vocaburn'}: Card #{card_id} (Deck #{deck_id})"
                except Exception:
                    pass
            if not source_info and task.satellite_source:
                source_info = f"{task.satellite_source}"

            # 1. Search for image using MediaService (auto provider priority)
            results = await MediaService.search_images(task_prompt, provider="auto", db=db)
            if not results:
                raise Exception(f"No image results found for prompt: {task_prompt}")
                
            download_res = None
            last_err = None
            # Try to download candidate images sequentially until one succeeds
            for idx, match in enumerate(results[:5]):
                try:
                    logger.info(f"[QueueWorker-Image] Attempting to download image #{idx+1} from {match['provider']}: {match['url']}")
                    download_res = await MediaService.download_image(
                        url=match["url"],
                        provider=match["provider"],
                        query=task_prompt,
                        db=db,
                        source_info=source_info
                    )
                    if download_res:
                        break
                except Exception as dl_err:
                    logger.warning(f"[QueueWorker-Image] Failed to download image #{idx+1} ({match['url']}): {dl_err}")
                    last_err = dl_err

            if not download_res:
                raise Exception(f"Failed to download any of the top 5 image search results. Last error: {last_err}")
            
            # Save results
            task.result = download_res["local_path"]
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            logger.info(f"[QueueWorker-Image] Image Task {task.id} completed successfully.")
        except Exception as img_err:
            logger.error(f"[QueueWorker-Image] Image generation failed: {img_err}")
            if task_attempts < task_max_retries:
                task.status = "pending"
                task.error = f"Attempt {task_attempts} failed: {str(img_err)[:500]}"
            else:
                task.status = "failed"
                task.error = f"Max retries exceeded. Last error: {str(img_err)[:500]}"
                task.completed_at = datetime.utcnow()

        await db.commit()

        if task.status in ("completed", "failed") and task.callback_url:
            await _send_callback(task)
            await db.commit()

async def start_image_queue_worker():
    """Poller worker dedicated solely to processing automatic image search & download tasks."""
    logger.info("[QueueWorker] Image Search & Download Worker task started.")
    from sqlalchemy import or_

    sem = asyncio.Semaphore(1)

    async def worker_job(task_id: int):
        async with sem:
            try:
                await process_image_task_helper(task_id)
            except Exception as e:
                logger.error(f"[QueueWorker-Image] Error in worker_job for task {task_id}: {e}")

    while True:
        is_paused = False
        delay_image = 5
        try:
            async with SessionLocal() as db:
                from app.modules.admin.models import SystemSetting
                # Check is_paused
                res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
                paused_setting = res_paused.scalar_one_or_none()
                is_paused = (paused_setting.value == "true") if paused_setting else False

                # Check rate_limit_delay_image
                res_delay_image = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_rate_limit_delay_image"))
                delay_setting_image = res_delay_image.scalar_one_or_none()
                delay_image = int(delay_setting_image.value) if delay_setting_image else 5
        except Exception as db_err:
            logger.warning(f"[QueueWorker-Image] Failed to query system_settings: {db_err}")

        if is_paused:
            await asyncio.sleep(2)
            continue

        try:
            async with SessionLocal() as db:
                # Fetch oldest pending Image tasks
                stmt = (
                    select(QueuedTask)
                    .where(
                        QueuedTask.status == "pending",
                        or_(
                            QueuedTask.extra_data.like('%"task_type": "image"%'),
                            QueuedTask.extra_data.like('%"task_type":"image"%')
                        )
                    )
                    .order_by(QueuedTask.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                tasks = result.scalars().all()

                if not tasks:
                    await asyncio.sleep(2)
                    continue

                task_ids = []
                for task in tasks:
                    task.status = "processing"
                    task.processed_at = datetime.utcnow()
                    task.attempts += 1
                    task_ids.append(task.id)
                await db.commit()

                logger.info(f"[QueueWorker-Image] Dispatched {len(task_ids)} tasks for parallel processing: {task_ids}")
                for tid in task_ids:
                    asyncio.create_task(worker_job(tid))

        except Exception as loop_err:
            logger.error(f"[QueueWorker-Image] Unexpected loop error: {loop_err}", exc_info=True)

        await asyncio.sleep(delay_image)

async def process_furigana_task_helper(task_id: int):
    async with SessionLocal() as db:
        stmt = select(QueuedTask).where(QueuedTask.id == task_id)
        result = await db.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            return
            
        task_prompt = task.prompt
        task_attempts = task.attempts
        task_max_retries = task.max_retries
        
        try:
            import pykakasi
            import re
            
            kks = pykakasi.kakasi()
            convert_result = kks.convert(task_prompt)
            parts = []
            kanji_pattern = re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]')
            
            for item in convert_result:
                orig = item['orig']
                hira = item['hira']
                if kanji_pattern.search(orig):
                    parts.append(f"{orig}[{hira}]")
                else:
                    parts.append(orig)
            
            furi_text = "".join(parts)
            
            task.status = "completed"
            task.result = furi_text
            task.completed_at = datetime.utcnow()
            logger.info(f"[QueueWorker-Furigana] Task {task_id} completed successfully.")
        except Exception as err:
            logger.error(f"[QueueWorker-Furigana] Furigana generation failed: {err}")
            if task_attempts < task_max_retries:
                task.status = "pending"
                task.error = f"Attempt {task_attempts} failed: {str(err)[:500]}"
            else:
                task.status = "failed"
                task.error = f"Max retries exceeded. Last error: {str(err)[:500]}"
                task.completed_at = datetime.utcnow()
                
        await db.commit()
        
        if task.status in ("completed", "failed") and task.callback_url:
            await _send_callback(task)
            await db.commit()

async def start_furigana_queue_worker():
    """Poller worker dedicated solely to processing offline Furigana generation tasks."""
    logger.info("[QueueWorker] Furigana Generator Worker task started.")
    from sqlalchemy import or_
    
    sem = asyncio.Semaphore(1)

    async def worker_job(task_id: int):
        async with sem:
            try:
                await process_furigana_task_helper(task_id)
            except Exception as e:
                logger.error(f"[QueueWorker-Furigana] Error in worker_job for task {task_id}: {e}")

    while True:
        is_paused = False
        try:
            async with SessionLocal() as db:
                from app.modules.admin.models import SystemSetting
                res_paused = await db.execute(select(SystemSetting).where(SystemSetting.key == "queue_is_paused"))
                paused_setting = res_paused.scalar_one_or_none()
                is_paused = (paused_setting.value == "true") if paused_setting else False
        except Exception as db_err:
            logger.warning(f"[QueueWorker-Furigana] Failed to query pause status: {db_err}")

        if is_paused:
            await asyncio.sleep(1)
            continue

        try:
            async with SessionLocal() as db:
                # Fetch oldest pending Furigana tasks
                stmt = (
                    select(QueuedTask)
                    .where(
                        QueuedTask.status == "pending",
                        or_(
                            QueuedTask.extra_data.like('%"task_type": "furigana"%'),
                            QueuedTask.extra_data.like('%"task_type":"furigana"%')
                        )
                    )
                    .order_by(QueuedTask.created_at.asc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                tasks = result.scalars().all()

                if not tasks:
                    await asyncio.sleep(1)
                    continue

                task_ids = []
                for task in tasks:
                    task.status = "processing"
                    task.processed_at = datetime.utcnow()
                    task.attempts += 1
                    task_ids.append(task.id)
                await db.commit()

                logger.info(f"[QueueWorker-Furigana] Dispatched {len(task_ids)} tasks: {task_ids}")
                for tid in task_ids:
                    asyncio.create_task(worker_job(tid))

        except Exception as loop_err:
            logger.error(f"[QueueWorker-Furigana] Unexpected loop error: {loop_err}", exc_info=True)

        await asyncio.sleep(0.5)

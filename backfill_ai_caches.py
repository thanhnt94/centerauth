import asyncio
import json
import hashlib
from datetime import datetime
from sqlalchemy import select
from app.core.db import SessionLocal
from app.modules.queue.models import QueuedTask
from app.modules.chat.models import AICache

async def main():
    print("[+] Connecting to database...")
    async with SessionLocal() as db:
        print("[+] Fetching completed queued tasks...")
        res = await db.execute(
            select(QueuedTask).filter(QueuedTask.status == 'completed')
        )
        tasks = res.scalars().all()
        print(f"[+] Found {len(tasks)} completed tasks in total.")
        
        backfilled_count = 0
        for task in tasks:
            # Determine task_type
            tt = "ai-explain"
            if task.extra_data:
                try:
                    data = json.loads(task.extra_data)
                    tt = data.get("task_type", "ai-explain")
                except Exception:
                    pass
            
            # If not AI text explanation, skip
            if tt != "ai-explain":
                continue
                
            if not task.prompt or not task.result:
                continue
                
            # Check if it looks like an image URL or TTS file path (safety check)
            res_str = task.result.strip()
            if res_str.startswith("http") or res_str.startswith("/") or res_str.endswith(".mp3") or res_str.endswith(".png") or res_str.endswith(".jpg"):
                continue
                
            # Generate hash
            prompt_hash = hashlib.sha256(task.prompt.strip().encode("utf-8")).hexdigest()
            
            # Check if already in AICache
            cache_check = await db.execute(
                select(AICache).filter(AICache.prompt_hash == prompt_hash)
            )
            existing = cache_check.scalars().first()
            
            if not existing:
                ai_cache = AICache(
                    prompt_hash=prompt_hash,
                    prompt=task.prompt.strip(),
                    response=task.result.strip(),
                    provider=task.provider or "unknown",
                    model=task.model or "unknown",
                    created_at=task.completed_at or task.created_at or datetime.utcnow()
                )
                db.add(ai_cache)
                backfilled_count += 1
                if backfilled_count % 100 == 0:
                    print(f"  Processed {backfilled_count} caches...")
                    
        if backfilled_count > 0:
            await db.commit()
            print(f"[+] Successfully backfilled {backfilled_count} completed tasks into ai_caches table!")
        else:
            print("[+] No new tasks needed backfilling.")

if __name__ == "__main__":
    asyncio.run(main())

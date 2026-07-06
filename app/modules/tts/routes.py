from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os
import json
import time
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.db import get_db
from app.modules.tts.models import TTSCache
from app.modules.tts.services import AudioGenerator

router = APIRouter(prefix="/api/tts", tags=["TTS"])

class TTSGenerateRequest(BaseModel):
    text: str
    lang: Optional[str] = None
    bypass_parsing: Optional[bool] = False

class TTSSettings(BaseModel):
    default_engine: str = "edge"
    google_api_key: Optional[str] = ""
    default_voices: Dict[str, Any] = {
        "vi": "vi-VN-HoaiMyNeural",
        "en": "en-US-AriaNeural",
        "ja": "ja-JP-NanamiNeural",
        "zh": "zh-CN-XiaoxiaoNeural",
        "ko": "ko-KR-SunHiNeural"
    }
    queue_worker_delay_seconds: int = 5
    queue_max_retries: int = 3

def get_settings_file_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(base_dir, "core", "tts_settings.json")

@router.post("/generate")
async def generate_tts_endpoint(data: TTSGenerateRequest, db: AsyncSession = Depends(get_db)):
    text = data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text content cannot be empty")
        
    lang = data.lang or "vi"
    bypass_parsing = bool(data.bypass_parsing)
    
    # Calculate a unique cache hash based on text, lang, and bypass_parsing
    import hashlib
    if lang == "vi" and not bypass_parsing:
        prompt_hash = AudioGenerator.get_voice_hash(text)
    else:
        hash_payload = f"{text}||{lang}||{bypass_parsing}"
        prompt_hash = hashlib.md5(hash_payload.encode('utf-8')).hexdigest()
    
    # Check cache table
    res = await db.execute(select(TTSCache).where(TTSCache.prompt_hash == prompt_hash))
    cache_item = res.scalar_one_or_none()
    
    # Setup paths
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"tts_{prompt_hash}.mp3"
    physical_path = os.path.join(upload_dir, filename)
    url = f"/static/uploads/tts/{filename}"
    
    # If in DB and exists on disk, reuse it immediately
    if cache_item and os.path.exists(physical_path):
        return {"url": url, "filename": filename, "cached": True}
        
    # Generate if not exists
    if not os.path.exists(physical_path):
        try:
            success = await AudioGenerator.generate_tts(text, physical_path, lang, bypass_parsing=bypass_parsing)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to synthesize TTS")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")
            
    # Add record to DB cache
    if not cache_item:
        try:
            cache_item = TTSCache(
                prompt_hash=prompt_hash,
                text=text,
                file_path=url,
                created_at=datetime.utcnow()
            )
            db.add(cache_item)
            await db.commit()
        except Exception as db_err:
            await db.rollback()
            # In case of concurrency insert clash, just ignore
            pass
            
    return {"url": url, "filename": filename, "cached": False}

class TTSHistoryItem(BaseModel):
    filename: str
    text: str
    size_bytes: int
    created_at: str
    url: str

class PaginatedTTSResponse(BaseModel):
    total: int
    history: List[TTSHistoryItem]
    page: int
    limit: int

@router.get("/history", response_model=PaginatedTTSResponse)
async def get_tts_history(
    page: int = 1,
    limit: int = 24,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func, or_
    
    # Base query
    stmt = select(TTSCache).order_by(TTSCache.created_at.desc())
    total_stmt = select(func.count()).select_from(TTSCache)
    
    if search:
        search_pattern = f"%{search.strip()}%"
        filter_cond = or_(
            TTSCache.text.like(search_pattern),
            TTSCache.file_path.like(search_pattern)
        )
        stmt = stmt.where(filter_cond)
        total_stmt = total_stmt.where(filter_cond)
        
    # Get total count
    count_res = await db.execute(total_stmt)
    total_count = count_res.scalar() or 0
    
    # Paginate
    stmt = stmt.offset((page - 1) * limit).limit(limit)
    res = await db.execute(stmt)
    items = res.scalars().all()
    
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    
    history = []
    for item in items:
        filename = os.path.basename(item.file_path)
        physical_path = os.path.join(upload_dir, filename)
        size_bytes = 0
        if os.path.exists(physical_path):
            size_bytes = os.path.getsize(physical_path)
            
        history.append({
            "filename": filename,
            "text": item.text or "",
            "size_bytes": size_bytes,
            "created_at": item.created_at.strftime('%Y-%m-%d %H:%M:%S') if item.created_at else "",
            "url": f"/static/uploads/tts/{filename}"
        })
        
    return {
        "total": total_count,
        "history": history,
        "page": page,
        "limit": limit
    }

@router.delete("/history/{filename}")
async def delete_tts_file(filename: str, db: AsyncSession = Depends(get_db)):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    
    # Security check to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    url = f"/static/uploads/tts/{filename}"
    await db.execute(delete(TTSCache).where(TTSCache.file_path == url))
    await db.commit()
    
    physical_path = os.path.join(upload_dir, filename)
    if os.path.exists(physical_path):
        try:
            os.remove(physical_path)
            return {"success": True, "message": "File deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
    else:
        return {"success": True, "message": "Metadata deleted, file was not on disk"}

@router.get("/settings")
async def get_tts_settings():
    path = get_settings_file_path()
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Return defaults if settings file doesn't exist or is corrupted
    return TTSSettings().dict()

@router.post("/settings")
async def save_tts_settings(settings: TTSSettings):
    path = get_settings_file_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(settings.dict(), f, indent=2, ensure_ascii=False)
        return {"success": True, "message": "TTS Settings saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save settings: {str(e)}")

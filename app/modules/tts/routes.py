from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import os
import json
import time

from app.modules.tts.services import AudioGenerator

router = APIRouter(prefix="/api/tts", tags=["TTS"])

class TTSGenerateRequest(BaseModel):
    text: str
    lang: Optional[str] = None

class TTSSettings(BaseModel):
    default_engine: str = "edge"
    default_voices: Dict[str, str] = {
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
async def generate_tts_endpoint(data: TTSGenerateRequest):
    text = data.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text content cannot be empty")
        
    # Setup paths
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"tts_{AudioGenerator.get_voice_hash(text)}.mp3"
    physical_path = os.path.join(upload_dir, filename)
    url = f"/static/uploads/tts/{filename}"
    
    # Generate if not exists
    if not os.path.exists(physical_path):
        try:
            success = await AudioGenerator.generate_tts(text, physical_path)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to synthesize TTS")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")
            
    return {"url": url, "filename": filename}

@router.get("/history")
async def get_tts_history():
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    if not os.path.exists(upload_dir):
        return []
        
    history = []
    for f in os.listdir(upload_dir):
        if f.endswith(".mp3"):
            path = os.path.join(upload_dir, f)
            stat = os.stat(path)
            history.append({
                "filename": f,
                "size_bytes": stat.st_size,
                "created_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(stat.st_mtime)),
                "url": f"/static/uploads/tts/{f}"
            })
    # Sort by created time descending
    history.sort(key=lambda x: x["created_at"], reverse=True)
    return history

@router.delete("/history/{filename}")
async def delete_tts_file(filename: str):
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    upload_dir = os.path.join(base_dir, "static", "uploads", "tts")
    
    # Security check to prevent directory traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    physical_path = os.path.join(upload_dir, filename)
    if os.path.exists(physical_path):
        try:
            os.remove(physical_path)
            return {"success": True, "message": "File deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
    else:
        raise HTTPException(status_code=404, detail="File not found")

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

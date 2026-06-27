from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from app.modules.tts.services import AudioGenerator

router = APIRouter(prefix="/api/tts", tags=["TTS"])

class TTSGenerateRequest(BaseModel):
    text: str
    lang: Optional[str] = None

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

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import List, Optional
import logging

from app.core.db import get_db
from app.modules.chat.utils import get_current_user
from app.modules.identity.models import User
from app.modules.media.services import MediaService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat/media", tags=["Media Management"])

class MediaSearchRequest(BaseModel):
    query: str
    provider: Optional[str] = "auto"
    limit: Optional[int] = 10

class MediaSearchResponse(BaseModel):
    title: str
    url: str
    thumbnail: str
    provider: str

class MediaDownloadRequest(BaseModel):
    url: str
    provider: str
    query: str

class MediaDownloadResponse(BaseModel):
    id: int
    filename: str
    local_path: str
    provider: str
    search_query: Optional[str]
    mime_type: Optional[str]
    size_bytes: Optional[int]

@router.post("/search", response_model=List[MediaSearchResponse])
async def search_media(
    body: MediaSearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search internet for images using requested provider (wikimedia, unsplash, pexels, pixabay, google).
    """
    if not body.query or not body.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        results = await MediaService.search_images(body.query.strip(), body.provider, db)
        return results[:body.limit]
    except Exception as e:
        logger.error(f"Failed to search media for query '{body.query}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/download", response_model=MediaDownloadResponse)
async def download_media(
    body: MediaDownloadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Download a selected internet image locally to the static folder, register it in DB and return the details.
    """
    if not body.url or not body.url.strip():
        raise HTTPException(status_code=400, detail="URL is required")
        
    try:
        result = await MediaService.download_image(body.url.strip(), body.provider, body.query, db)
        return result
    except Exception as e:
        logger.error(f"Failed to download media from URL '{body.url}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/library", response_model=List[MediaDownloadResponse])
async def get_library(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all saved media assets from the database.
    """
    from app.modules.media.models import MediaAsset
    try:
        result = await db.execute(select(MediaAsset).order_by(MediaAsset.created_at.desc()))
        assets = result.scalars().all()
        
        response_list = []
        for asset in assets:
            local_path = f"/static/uploads/media/{asset.filename}"
            response_list.append({
                "id": asset.id,
                "filename": asset.filename,
                "local_path": local_path,
                "provider": asset.provider,
                "search_query": asset.search_query,
                "mime_type": asset.mime_type,
                "size_bytes": asset.size_bytes
            })
        return response_list
    except Exception as e:
        logger.error(f"Failed to get media library: {e}")
        raise HTTPException(status_code=500, detail=str(e))

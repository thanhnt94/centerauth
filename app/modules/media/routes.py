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

class MediaSettingsUpdateRequest(BaseModel):
    media_provider_priority: str
    media_crop_ratio: str
    unsplash_access_key: Optional[str] = ""
    pexels_api_key: Optional[str] = ""
    pixabay_api_key: Optional[str] = ""
    google_cse_api_key: Optional[str] = ""
    google_cse_cx: Optional[str] = ""

@router.get("/settings")
async def get_media_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all media configs from SystemSetting.
    """
    from app.modules.admin.models import SystemSetting
    try:
        keys = [
            "media_provider_priority", "media_crop_ratio",
            "unsplash_access_key", "pexels_api_key", "pixabay_api_key",
            "google_cse_api_key", "google_cse_cx"
        ]
        result = await db.execute(select(SystemSetting).where(SystemSetting.key.in_(keys)))
        settings_rows = result.scalars().all()
        settings_dict = {s.key: s.value for s in settings_rows}
        
        # Defaults
        return {
            "media_provider_priority": settings_dict.get("media_provider_priority", "bing,wikimedia,unsplash,pexels,pixabay,google"),
            "media_crop_ratio": settings_dict.get("media_crop_ratio", "original"),
            "unsplash_access_key": settings_dict.get("unsplash_access_key", ""),
            "pexels_api_key": settings_dict.get("pexels_api_key", ""),
            "pixabay_api_key": settings_dict.get("pixabay_api_key", ""),
            "google_cse_api_key": settings_dict.get("google_cse_api_key", ""),
            "google_cse_cx": settings_dict.get("google_cse_cx", "")
        }
    except Exception as e:
        logger.error(f"Failed to load media settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/settings")
async def update_media_settings(
    body: MediaSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update media configs in SystemSetting.
    """
    from app.modules.admin.models import SystemSetting
    try:
        settings_dict = body.model_dump()
        for k, v in settings_dict.items():
            res = await db.execute(select(SystemSetting).where(SystemSetting.key == k))
            setting = res.scalar_one_or_none()
            if not setting:
                setting = SystemSetting(key=k, value=str(v or ""), category="Media")
                db.add(setting)
            else:
                setting.value = str(v or "")
        await db.commit()
        return {"status": "ok", "message": "Media configurations updated successfully."}
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to save media settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{asset_id}")
async def delete_media_asset(
    asset_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a media asset from both disk and database.
    """
    from app.modules.media.models import MediaAsset
    from app.core.config import settings
    import os
    try:
        res = await db.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
        asset = res.scalar_one_or_none()
        if not asset:
            raise HTTPException(status_code=404, detail="Media asset not found")
            
        # Delete file from disk
        filepath = os.path.join(settings.UPLOAD_FOLDER, "media", asset.filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as file_err:
                logger.error(f"Failed to delete media file {filepath}: {file_err}")
                
        # Delete from DB
        await db.delete(asset)
        await db.commit()
        return {"status": "ok", "message": "Media asset deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete media asset {asset_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import os
import re
import json
import httpx
import hashlib
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.admin.models import SystemSetting
from app.modules.media.models import MediaAsset
from app.core.config import settings

logger = logging.getLogger(__name__)

class MediaService:
    @staticmethod
    async def get_settings(db: AsyncSession) -> Dict[str, str]:
        """Fetch all system settings as a dictionary."""
        result = await db.execute(select(SystemSetting))
        return {s.key: s.value for s in result.scalars().all()}

    @classmethod
    async def search_images(cls, query: str, provider: str = "auto", db: Optional[AsyncSession] = None) -> List[Dict[str, Any]]:
        """
        Search internet for images using the requested provider or fallback to auto.
        """
        db_settings = {}
        if db:
            db_settings = await cls.get_settings(db)

        # Fallback to general settings or env keys
        unsplash_key = db_settings.get("unsplash_access_key") or getattr(settings, "UNSPLASH_ACCESS_KEY", "")
        pexels_key = db_settings.get("pexels_api_key") or getattr(settings, "PEXELS_API_KEY", "")
        pixabay_key = db_settings.get("pixabay_api_key") or getattr(settings, "PIXABAY_API_KEY", "")
        google_key = db_settings.get("google_cse_api_key") or getattr(settings, "GOOGLE_CSE_API_KEY", "")
        google_cx = db_settings.get("google_cse_cx") or getattr(settings, "GOOGLE_CSE_CX", "")

        # Provider priority order
        provider_priority_str = db_settings.get("media_provider_priority") or "bing,wikimedia,unsplash,pexels,pixabay,google"
        providers_list = [p.strip().lower() for p in provider_priority_str.split(",") if p.strip()]

        if provider != "auto":
            active_providers = [provider.lower()]
        else:
            active_providers = providers_list

        async with httpx.AsyncClient(timeout=10.0) as client:
            for p in active_providers:
                try:
                    if p == "bing":
                        results = await cls._search_bing(client, query)
                        if results:
                            return results
                    elif p == "wikimedia":
                        results = await cls._search_wikimedia(client, query)
                        if results:
                            return results
                    elif p == "unsplash" and unsplash_key:
                        results = await cls._search_unsplash(client, query, unsplash_key)
                        if results:
                            return results
                    elif p == "pexels" and pexels_key:
                        results = await cls._search_pexels(client, query, pexels_key)
                        if results:
                            return results
                    elif p == "pixabay" and pixabay_key:
                        results = await cls._search_pixabay(client, query, pixabay_key)
                        if results:
                            return results
                    elif p == "google" and google_key and google_cx:
                        results = await cls._search_google(client, query, google_key, google_cx)
                        if results:
                            return results
                except Exception as e:
                    logger.error(f"[MEDIA SEARCH] Provider {p} failed: {e}")
                    continue

        return []

    @staticmethod
    async def _search_wikimedia(client: httpx.AsyncClient, query: str) -> List[Dict[str, Any]]:
        url = 'https://commons.wikimedia.org/w/api.php'
        headers = {'User-Agent': 'MindStackMediaService/1.0 (contact@mindstack.com) Python-httpx'}
        params = {
            'action': 'query',
            'generator': 'search',
            'gsrsearch': query,
            'gsrnamespace': 6,
            'gsrlimit': 10,
            'prop': 'imageinfo',
            'iiprop': 'url',
            'format': 'json'
        }
        res = await client.get(url, params=params, headers=headers)
        if res.status_code != 200:
            return []
        
        data = res.json()
        pages = data.get('query', {}).get('pages', {})
        results = []
        for _, page in pages.items():
            imageinfo = page.get('imageinfo', [])
            if imageinfo:
                img_url = imageinfo[0].get('url')
                title = page.get('title', '').replace('File:', '')
                results.append({
                    'title': title,
                    'url': img_url,
                    'thumbnail': img_url,
                    'provider': 'wikimedia'
                })
        return results

    @staticmethod
    async def _search_unsplash(client: httpx.AsyncClient, query: str, access_key: str) -> List[Dict[str, Any]]:
        url = "https://api.unsplash.com/search/photos"
        headers = {"Authorization": f"Client-ID {access_key}"}
        params = {"query": query, "per_page": 10}
        res = await client.get(url, params=params, headers=headers)
        if res.status_code != 200:
            return []
        
        data = res.json()
        results = []
        for item in data.get("results", []):
            results.append({
                'title': item.get("description") or item.get("alt_description") or "Unsplash Photo",
                'url': item.get("urls", {}).get("regular"),
                'thumbnail': item.get("urls", {}).get("thumb"),
                'provider': 'unsplash'
            })
        return results

    @staticmethod
    async def _search_pexels(client: httpx.AsyncClient, query: str, api_key: str) -> List[Dict[str, Any]]:
        url = "https://api.pexels.com/v1/search"
        headers = {"Authorization": api_key}
        params = {"query": query, "per_page": 10}
        res = await client.get(url, params=params, headers=headers)
        if res.status_code != 200:
            return []
        
        data = res.json()
        results = []
        for item in data.get("photos", []):
            results.append({
                'title': item.get("alt") or "Pexels Photo",
                'url': item.get("src", {}).get("large"),
                'thumbnail': item.get("src", {}).get("tiny"),
                'provider': 'pexels'
            })
        return results

    @staticmethod
    async def _search_pixabay(client: httpx.AsyncClient, query: str, api_key: str) -> List[Dict[str, Any]]:
        url = "https://pixabay.com/api/"
        params = {"key": api_key, "q": query, "per_page": 10, "image_type": "all"}
        res = await client.get(url, params=params)
        if res.status_code != 200:
            return []
        
        data = res.json()
        results = []
        for item in data.get("hits", []):
            results.append({
                'title': item.get("tags") or "Pixabay Image",
                'url': item.get("largeImageURL"),
                'thumbnail': item.get("previewURL"),
                'provider': 'pixabay'
            })
        return results

    @staticmethod
    async def _search_google(client: httpx.AsyncClient, query: str, api_key: str, cx: str) -> List[Dict[str, Any]]:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {
            "key": api_key,
            "cx": cx,
            "q": query,
            "searchType": "image",
            "num": 10
        }
        res = await client.get(url, params=params)
        if res.status_code != 200:
            return []
        
        data = res.json()
        results = []
        for item in data.get("items", []):
            results.append({
                'title': item.get("title") or "Google Search Image",
                'url': item.get("link"),
                'thumbnail': item.get("image", {}).get("thumbnailLink"),
                'provider': 'google'
            })
        return results

    @classmethod
    async def download_image(cls, url: str, provider: str, query: str, db: AsyncSession) -> Dict[str, Any]:
        """
        Download the image locally to static/uploads/media/, register in DB and return the details.
        """
        # Ensure uploads folder exists
        upload_dir = os.path.join(settings.UPLOAD_FOLDER, "media")
        os.makedirs(upload_dir, exist_ok=True)

        async with httpx.AsyncClient(timeout=20.0) as client:
            headers = {'User-Agent': 'MindStackMediaService/1.0 (contact@mindstack.com) Python-httpx'}
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise Exception(f"Failed to download image from source URL: {url} (Status: {response.status_code})")
            
            content_bytes = response.content

        # Generate unique filename using md5 hash of bytes
        file_hash = hashlib.md5(content_bytes).hexdigest()
        
        # Detect extension
        content_type = response.headers.get("content-type", "image/jpeg")
        ext = "jpg"
        if "png" in content_type:
            ext = "png"
        elif "gif" in content_type:
            ext = "gif"
        
        filename = f"{file_hash}.{ext}"
        filepath = os.path.join(upload_dir, filename)

        # Save file to disk
        with open(filepath, "wb") as f:
            f.write(content_bytes)

        # Save to DB
        local_path = f"/static/uploads/media/{filename}"
        
        # Check if asset already exists in DB
        existing_res = await db.execute(select(MediaAsset).where(MediaAsset.filename == filename))
        asset = existing_res.scalar_one_or_none()
        if not asset:
            asset = MediaAsset(
                filename=filename,
                original_url=url,
                provider=provider,
                search_query=query,
                mime_type=content_type,
                size_bytes=len(content_bytes)
            )
            db.add(asset)
            await db.commit()
            await db.refresh(asset)

        return {
            "id": asset.id,
            "filename": asset.filename,
            "local_path": local_path,
            "provider": asset.provider,
            "search_query": asset.search_query,
            "mime_type": asset.mime_type,
            "size_bytes": asset.size_bytes
        }

    @staticmethod
    async def _search_bing(client: httpx.AsyncClient, query: str) -> List[Dict[str, Any]]:
        url = f'https://www.bing.com/images/search'
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
        res = await client.get(url, params={'q': query}, headers=headers)
        if res.status_code != 200:
            return []
            
        matches = re.findall(r'm="([^"]+)"', res.text)
        if not matches:
            matches = re.findall(r'm="({&quot;[^"]+})"', res.text)
            
        results = []
        for m in matches:
            m_json = m.replace('&quot;', '"').replace('&amp;', '&')
            try:
                data = json.loads(m_json)
                murl = data.get('murl')
                turl = data.get('turl')
                title = data.get('t', 'Bing Image')
                if murl:
                    results.append({
                        'title': title,
                        'url': murl,
                        'thumbnail': turl or murl,
                        'provider': 'bing'
                    })
            except Exception:
                continue
        return results

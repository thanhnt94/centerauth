import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .models import SSOConfig
from fastapi import HTTPException

class SSOService:
    @staticmethod
    async def get_config(db: AsyncSession) -> SSOConfig:
        result = await db.execute(select(SSOConfig))
        config = result.scalar_one_or_none()
        if not config:
            config = SSOConfig(is_enabled=False)
            db.add(config)
            await db.commit()
            await db.refresh(config)
        return config

    @staticmethod
    async def verify_sso_code(db: AsyncSession, code: str):
        config = await SSOService.get_config(db)
        if not config.is_enabled:
            raise HTTPException(status_code=400, detail="SSO is disabled locally")

        async with httpx.AsyncClient() as client:
            # Exchange code for token at CentralAuth
            res = await client.post(
                f"{config.server_url.rstrip('/')}/api/auth/token",
                json={
                    "code": code,
                    "client_id": config.client_id,
                    "client_secret": config.client_secret
                }
            )
            if res.status_code != 200:
                return None, "Token exchange failed"
            
            token_data = res.json()
            # Verify and get user info
            v_res = await client.get(
                f"{config.server_url.rstrip('/')}/api/auth/verify-token",
                headers={"Authorization": f"Bearer {token_data['access_token']}"}
            )
            if v_res.status_code != 200:
                return None, "Verification failed"
                
            return v_res.json().get("user"), None

import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.sso.models import AuthCode
from app.modules.clients.services.client_service import ClientService
from typing import Optional

import hmac

class OAuthService:
    @staticmethod
    async def create_auth_code(db: AsyncSession, client_id: str, user_id: str, redirect_uri: str) -> str:
        code = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        
        auth_code = AuthCode(
            code=code,
            client_id=client_id,
            user_id=user_id,
            redirect_uri=redirect_uri,
            expires_at=expires_at
        )
        
        db.add(auth_code)
        await db.commit()
        return code

    @staticmethod
    async def validate_auth_code(db: AsyncSession, code: str, client_id: str, client_secret: str) -> Optional[AuthCode]:
        # Verify client first with constant-time comparison
        client = await ClientService.get_client_by_id(db, client_id)
        if not client or not hmac.compare_digest(client.client_secret, client_secret):
            return None
            
        result = await db.execute(
            select(AuthCode).where(
                AuthCode.code == code,
                AuthCode.client_id == client_id
            )
        )
        auth_code = result.scalar_one_or_none()
        
        if not auth_code or auth_code.is_expired():
            return None
            
        # Delete code after single use to prevent replay attacks
        await db.delete(auth_code)
        await db.commit()
        
        return auth_code

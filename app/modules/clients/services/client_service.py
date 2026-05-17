from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.modules.clients.models import Client
from typing import List, Optional

class ClientService:
    @staticmethod
    async def get_client_by_id(db: AsyncSession, client_id: str) -> Optional[Client]:
        result = await db.execute(select(Client).where(Client.client_id == client_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_active_clients(db: AsyncSession) -> List[Client]:
        result = await db.execute(select(Client).where(Client.is_active == True))
        return result.scalars().all()

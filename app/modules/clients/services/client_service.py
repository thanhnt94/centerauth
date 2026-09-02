from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.modules.clients.models import Client
from typing import List, Optional

class ClientService:
    @staticmethod
    async def get_client_by_id(db: AsyncSession, client_id: str) -> Optional[Client]:
        result = await db.execute(select(Client).where(Client.client_id == client_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def list_active_clients(db: AsyncSession) -> List[Client]:
        result = await db.execute(
            select(Client)
            .where(and_(Client.is_active == True, Client.is_visible_on_portal == True))
            .order_by(Client.id.asc())
        )
        clients = result.scalars().all()
        seen_names = set()
        deduped: List[Client] = []
        for c in clients:
            if c.client_id == "timehack":  # Legacy duplicate entry
                continue
            norm_name = (c.name or "").strip().lower()
            if norm_name in seen_names:
                continue
            seen_names.add(norm_name)
            deduped.append(c)
        return deduped


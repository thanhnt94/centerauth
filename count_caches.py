import asyncio
from app.core.db import SessionLocal
from sqlalchemy import select
from app.modules.chat.models import AICache

async def main():
    async with SessionLocal() as db:
        res = await db.execute(select(AICache))
        print("COUNT IS:", len(res.scalars().all()))

if __name__ == "__main__":
    asyncio.run(main())

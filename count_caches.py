import asyncio
from app.core.db import SessionLocal
from sqlalchemy import text

async def main():
    async with SessionLocal() as db:
        # Check tables list
        res_tables = await db.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
        tables = [row[0] for row in res_tables.fetchall()]
        print("TABLES:", tables)
        
        # Check raw count
        try:
            res_count = await db.execute(text("SELECT count(*) FROM ai_caches;"))
            count = res_count.scalar()
            print("RAW COUNT IS:", count)
        except Exception as e:
            print("RAW QUERY ERROR:", e)

if __name__ == "__main__":
    asyncio.run(main())

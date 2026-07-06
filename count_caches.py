import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_db(path):
    print(f"\nChecking database: {path}")
    try:
        engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
        async with engine.begin() as conn:
            res_tables = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
            tables = [row[0] for row in res_tables.fetchall()]
            print("  TABLES:", tables)
            
            if "queued_tasks" in tables:
                res_tasks = await conn.execute(text("SELECT count(*) FROM queued_tasks WHERE status='completed';"))
                print("  Completed queue tasks:", res_tasks.scalar())
            
            if "ai_caches" in tables:
                res_caches = await conn.execute(text("SELECT count(*) FROM ai_caches;"))
                print("  AI Caches count:", res_caches.scalar())
    except Exception as e:
        print("  Error:", e)

async def main():
    await check_db("/var/www/CentralAuth/centralauth.db")
    await check_db("/var/www/Storage/database/CentralAuth.db")

if __name__ == "__main__":
    asyncio.run(main())

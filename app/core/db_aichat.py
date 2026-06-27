from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
from sqlalchemy import event

engine = create_async_engine(
    settings.AIC_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

# SQLite optimization: WAL Mode & performance pragmas
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA cache_size=-64000") # 64MB cache
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.close()

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

class Base(DeclarativeBase):
    pass

# FastAPI Dependency for AIChat DB
async def get_aichat_db():
    async with SessionLocal() as db:
        try:
            yield db
        finally:
            await db.close()

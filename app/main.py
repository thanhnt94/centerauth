import fastapi
from fastapi import FastAPI, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import os
import asyncio
from contextlib import asynccontextmanager

from app.core.db import engine, Base, get_db
from app.core.db_aichat import engine as aichat_engine, Base as AIChatBase
from app.modules.queue.worker import start_queue_worker
from app.modules.admin.models import SystemSetting, AuditLog, AIFailoverModel

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create tables on startup for CentralAuth DB
    from app.modules.queue.models import QueuedTask
    from app.modules.tts.models import TTSCache
    from app.modules.media.models import MediaAsset
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # SQLite dynamic column migration check for AI columns in CentralAuth DB
        from sqlalchemy import text
        try:
            res = await conn.execute(text("PRAGMA table_info(users)"))
            columns = [row[1] for row in res.fetchall()]
            ai_cols = [
                ("active_provider", "VARCHAR(50) DEFAULT 'google'"),
                ("google_api_key", "VARCHAR(500)"),
                ("google_model", "VARCHAR(255) DEFAULT 'gemini-2.0-flash'"),
                ("openai_api_key", "VARCHAR(500)"),
                ("openai_model", "VARCHAR(255) DEFAULT 'gpt-4o'"),
                ("anthropic_api_key", "VARCHAR(500)"),
                ("anthropic_model", "VARCHAR(255) DEFAULT 'claude-3-5-sonnet'"),
                ("groq_api_key", "VARCHAR(500)"),
                ("groq_model", "VARCHAR(255) DEFAULT 'llama-3.3-70b-versatile'"),
                ("cerebras_api_key", "VARCHAR(500)"),
                ("cerebras_model", "VARCHAR(255) DEFAULT 'llama3.1-8b'"),
                ("nvidia_api_key", "VARCHAR(500)"),
                ("nvidia_model", "VARCHAR(255) DEFAULT 'meta/llama-3.3-70b-instruct'"),
                ("sambanova_api_key", "VARCHAR(500)"),
                ("sambanova_model", "VARCHAR(255) DEFAULT 'Meta-Llama-3.3-70B-Instruct'"),
                ("mistral_api_key", "VARCHAR(500)"),
                ("mistral_model", "VARCHAR(255) DEFAULT 'mistral-large-latest'"),
                ("cloudflare_api_key", "VARCHAR(500)"),
                ("cloudflare_model", "VARCHAR(255) DEFAULT '@cf/meta/llama-3.3-70b-instruct-fp8-fast'"),
                ("github_models_api_key", "VARCHAR(500)"),
                ("github_models_model", "VARCHAR(255) DEFAULT 'gpt-4o'"),
                ("cohere_api_key", "VARCHAR(500)"),
                ("cohere_model", "VARCHAR(255) DEFAULT 'command-r-plus'"),
                ("huggingface_api_key", "VARCHAR(500)"),
                ("huggingface_model", "VARCHAR(255) DEFAULT 'meta-llama/Llama-3.3-70B-Instruct'"),
                ("fireworks_api_key", "VARCHAR(500)"),
                ("fireworks_model", "VARCHAR(255) DEFAULT 'accounts/fireworks/models/llama-v3p3-70b-instruct'"),
                ("api_keys_json", "VARCHAR(4000) DEFAULT '[]'"),
                ("active_key_id", "VARCHAR(255)")
            ]
            for col_name, col_type in ai_cols:
                if col_name not in columns:
                    await conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                    print(f"[MIGRATION] Added {col_name} column to users table.")
        except Exception as migration_error:
            print(f"[MIGRATION ERROR] Failed to migrate users table: {migration_error}")

        # SQLite dynamic column migration check for available_roles in clients table
        try:
            res_clients = await conn.execute(text("PRAGMA table_info(clients)"))
            client_columns = [row[1] for row in res_clients.fetchall()]
            if "available_roles" not in client_columns:
                await conn.execute(text("ALTER TABLE clients ADD COLUMN available_roles VARCHAR(500) DEFAULT 'user,admin'"))
                print("[MIGRATION] Added available_roles column to clients table.")
        except Exception as client_migration_error:
            print(f"[MIGRATION ERROR] Failed to migrate clients table: {client_migration_error}")
            
    # 2. Create tables for AIChat DB
    async with aichat_engine.begin() as conn:
        await conn.run_sync(AIChatBase.metadata.create_all)
        print("[AICHAT] Database tables initialized.")
    
    # 3. Initialize admin user and default settings if not exist
    from app.core.db import SessionLocal
    from app.modules.identity.services.user_service import UserService
    async with SessionLocal() as db:
        admin = await UserService.get_user_by_username(db, "admin")
        if not admin:
            from app.modules.identity.schemas import UserCreate
            await UserService.create_user(db, UserCreate(
                username="admin",
                password="admin",
                email="admin@mindstack.click",
                is_admin=True
            ))
            print("Default admin created: admin / admin")
            
        # Seed default settings if empty
        from app.modules.admin.models import SystemSetting
        from sqlalchemy import func
        count_res = await db.execute(select(func.count(SystemSetting.key)))
        count = count_res.scalar()
        if count == 0:
            defaults = [
                SystemSetting(key="SSO_ENABLED", value="true", description="Enable SSO central jump protocol", category="Security"),
                SystemSetting(key="REGISTRATION_ENABLED", value="true", description="Allow new user registrations", category="General"),
                SystemSetting(key="MAX_ACTIVE_SESSIONS", value="5", description="Max login sessions allowed per user", category="General")
            ]
            db.add_all(defaults)
            await db.commit()
            print("[SEED] Default system settings created.")

        # Ensure Telegram settings are seeded
        tg_settings = [
            ("telegram_bot_token", "", "Centralized Telegram Bot API Token", "Telegram"),
            ("telegram_bot_username", "VocaburnBot", "Centralized Telegram Bot Username", "Telegram"),
            ("telegram_reminders_enabled", "true", "Enable Telegram reminders globally", "Telegram")
        ]
        settings_added = False
        for tg_key, tg_val, tg_desc, tg_cat in tg_settings:
            key_res = await db.execute(select(SystemSetting).where(SystemSetting.key == tg_key))
            if not key_res.scalar_one_or_none():
                db.add(SystemSetting(key=tg_key, value=tg_val, description=tg_desc, category=tg_cat))
                settings_added = True
        if settings_added:
            await db.commit()
            print("[SEED] Telegram system settings initialized.")
            
    # 4. Start background queue worker and telegram bot (only in one worker process)
    is_main_worker = False
    lock_file = None
    try:
        import fcntl
        lock_file = open('/tmp/centralauth_worker.lock', 'w')
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        is_main_worker = True
    except (ImportError, IOError):
        import os
        if os.name == 'nt':
            is_main_worker = True
        else:
            is_main_worker = False

    worker_task = None
    bot_task = None
    
    if is_main_worker:
        worker_task = asyncio.create_task(start_queue_worker())
        print("[QUEUE] Background worker started.")
        
        from app.modules.queue.telegram_bot import start_telegram_bot
        bot_task = asyncio.create_task(start_telegram_bot())
        print("[TELEGRAM] Centralized Bot background task spawned.")
    else:
        print("[LIFESPAN] Background tasks skipped (another worker holds the lock).")
            
    yield

    # Cleanup: cancel worker on shutdown
    if worker_task:
        worker_task.cancel()
    if bot_task:
        bot_task.cancel()
    try:
        tasks = [t for t in [worker_task, bot_task] if t is not None]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    except Exception:
        pass
    
    from app.modules.queue.telegram_bot import stop_bot_app
    await stop_bot_app()
    if lock_file:
        try:
            lock_file.close()
        except Exception:
            pass
    print("[QUEUE/TELEGRAM] Background services stopped.")

app = FastAPI(
    title="CentralAuth Identity Hub",
    description="Unified Identity Provider for MindStack Ecosystem",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Helper for index path
DIST_INDEX = os.path.join(STATIC_DIR, "dist", "index.html")

# Templates for fallback or SSR views
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Import and include routers from modules
from app.modules.identity.routes import api as identity_api
from app.modules.sso.routes import api as sso_api
from app.modules.admin.routes import api as admin_api
from app.modules.chat.routes import router as chat_router
from app.modules.queue.routes import router as queue_router
from app.modules.tts.routes import router as tts_router
from app.modules.media.routes import router as media_router

# Register Routers
app.include_router(identity_api.router)
app.include_router(sso_api.router)
app.include_router(admin_api.router)
app.include_router(chat_router)
app.include_router(queue_router)
app.include_router(tts_router)
app.include_router(media_router)

# --- SPA Routing (React app for auth, portal, admin) ---
@app.get("/")
@app.get("/auth/login")
@app.get("/auth/register")
@app.get("/portal")
@app.get("/profile")
@app.get("/admin/{path:path}")
async def serve_spa(request: Request):
    if os.path.exists(DIST_INDEX):
        from fastapi.responses import FileResponse
        return FileResponse(DIST_INDEX)
    return {"message": "SPA not built. Please run 'npm run build' in central-auth-studio."}

# Aliases for SPA compatibility
@app.get("/api/profile/me")
async def profile_me_alias(request: Request, db: AsyncSession = Depends(get_db)):
    from app.modules.identity.routes.api import me
    return await me(request, db)

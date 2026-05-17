import fastapi
from fastapi import FastAPI, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
import os
from contextlib import asynccontextmanager

from app.core.db import engine, Base, get_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize admin user if not exists
    from app.core.db import SessionLocal
    from app.modules.identity.services.user_service import UserService
    async with SessionLocal() as db:
        admin = await UserService.get_user_by_username(db, "admin")
        if not admin:
            from app.modules.identity.schemas import UserCreate
            await UserService.create_user(db, UserCreate(
                username="admin",
                password="admin",
                email="admin@centralauth.com",
                is_admin=True
            ))
            print("Default admin created: admin / admin")
            
    yield

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


# Import and include routers from modules
from app.modules.identity.routes import api as identity_api
from app.modules.sso.routes import api as sso_api
from app.modules.admin.routes import api as admin_api

# Register Routers
app.include_router(identity_api.router)
app.include_router(sso_api.router)
app.include_router(admin_api.router)

# Aliases for SPA compatibility
@app.get("/api/profile/me")
async def profile_me_alias(request: Request, db: AsyncSession = Depends(get_db)):
    from app.modules.identity.routes.api import me
    return await me(request, db)

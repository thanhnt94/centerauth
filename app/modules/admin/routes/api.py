from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.modules.identity.services.user_service import UserService
from app.modules.clients.services.client_service import ClientService
from app.modules.identity.routes.api import me
from app.modules.clients.models import Client

router = APIRouter(prefix="/admin/api", tags=["Admin API"])

@router.post("/clients")
async def add_client(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    app_url = data.get("app_url", "").rstrip("/")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    name = data.get("name") or client_id
    
    if not all([app_url, client_id, client_secret]):
        raise HTTPException(status_code=400, detail="Missing app_url, client_id, or client_secret")
    
    # Standardized derivation
    redirect_uri = f"{app_url}/auth-center/callback"
    
    new_client = Client(
        name=name,
        client_id=client_id,
        client_secret=client_secret,
        app_url=app_url,
        redirect_uri=redirect_uri,
        is_active=True,
        is_visible_on_portal=True
    )
    
    db.add(new_client)
    await db.commit()
    await db.refresh(new_client)
    
    return {"success": True, "client": new_client.to_dict()}

@router.get("/clients")
async def get_clients(db: AsyncSession = Depends(get_db)):
    clients = await ClientService.list_active_clients(db)
    return [c.to_dict() for c in clients]

@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    users = await UserService.list_users(db)
    return [u.to_dict() for u in users]

@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    users = await UserService.list_users(db)
    clients = await ClientService.list_active_clients(db)
    return {
        "users_count": len(users),
        "clients_count": len(clients)
    }

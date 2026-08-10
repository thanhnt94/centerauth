from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.modules.sso.services.oauth_service import OAuthService
from app.modules.sso.services.jwt_service import JWTService
from app.modules.identity.services.user_service import UserService

router = APIRouter(prefix="/api/auth", tags=["SSO"])

@router.get("/health")
async def sso_health():
    return {"status": "ok", "service": "CentralAuth SSO"}

@router.post("/token")
async def exchange_token(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    code = data.get("code")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    
    auth_code = await OAuthService.validate_auth_code(db, code, client_id, client_secret)
    if not auth_code:
        raise HTTPException(status_code=400, detail="Invalid code or client credentials")
    
    user = await UserService.get_user_by_id(db, auth_code.user_id)
    token = JWTService.create_token({
        "sub": user.id,
        "username": user.username,
        "email": user.email,
        "client_id": client_id
    })
    
    return {
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": 3600
    }

import time

_TOKEN_VERIFY_CACHE = {}
_CACHE_TTL = 60

@router.get("/verify-token")
async def verify_token(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = auth_header.split(" ")[1]
    
    # Fast in-memory cache lookup
    now = time.time()
    cached = _TOKEN_VERIFY_CACHE.get(token)
    if cached:
        cache_ts, cache_val = cached
        if now - cache_ts < _CACHE_TTL:
            return cache_val

    payload = JWTService.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await UserService.get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Resolve client-specific role
    client_id_val = payload.get("client_id")
    client_role = "user"
    if client_id_val:
        from app.modules.clients.models import Client
        from app.modules.identity.models import UserClientRole
        from sqlalchemy import select
        
        client_res = await db.execute(select(Client).where(Client.client_id == client_id_val))
        client_obj = client_res.scalar_one_or_none()
        if client_obj:
            role_res = await db.execute(
                select(UserClientRole)
                .where(UserClientRole.user_id == user.id)
                .where(UserClientRole.client_id == client_obj.id)
            )
            role_obj = role_res.scalar_one_or_none()
            if role_obj:
                client_role = role_obj.role
            else:
                client_role = "admin" if user.is_admin else "user"
        else:
            client_role = "admin" if user.is_admin else "user"
    else:
        client_role = "admin" if user.is_admin else "user"
        
    res_dict = {
        "valid": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": client_role
        }
    }
    
    # Cache result
    _TOKEN_VERIFY_CACHE[token] = (now, res_dict)
    
    # Maintenance: cleanup expired keys if cache grows large (> 1000 items)
    if len(_TOKEN_VERIFY_CACHE) > 1000:
        expired = [k for k, (ts, _) in _TOKEN_VERIFY_CACHE.items() if now - ts >= _CACHE_TTL]
        for k in expired:
            _TOKEN_VERIFY_CACHE.pop(k, None)

    return res_dict

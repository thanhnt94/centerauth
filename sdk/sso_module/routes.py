from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from .service import SSOService
from fastapi.responses import RedirectResponse
from typing import Optional

router = APIRouter(tags=["SSO Integration"])

@router.get("/login")
async def sso_login_redirect(db: AsyncSession = Depends(get_db)):
    """Force redirect to CentralAuth if SSO is enabled."""
    config = await SSOService.get_config(db)
    if config.is_enabled:
        return RedirectResponse(url=f"{config.server_url}/auth/login?client_id={config.client_id}")
    return RedirectResponse(url="/login?sso=off")

@router.get("/config")
async def get_sso_config(db: AsyncSession = Depends(get_db)):
    """API for the sub-project's Admin Panel to show current settings."""
    return await SSOService.get_config(db)

@router.post("/config")
async def update_sso_config(data: dict, db: AsyncSession = Depends(get_db)):
    """API for the sub-project's Admin Panel to toggle SSO and update settings."""
    config = await SSOService.get_config(db)
    config.is_enabled = data.get("is_enabled", config.is_enabled)
    config.server_url = data.get("server_url", config.server_url)
    config.client_id = data.get("client_id", config.client_id)
    config.client_secret = data.get("client_secret", config.client_secret)
    await db.commit()
    return {"success": True, "config": config}

@router.get("/auth-center/callback")
async def sso_callback(request: Request, response: Response, code: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Standardized callback for CentralAuth."""
    if not code:
        return RedirectResponse(url="/login?error=Missing authorization code")
    
    user_data, error = await SSOService.verify_sso_code(db, code)
    if error:
        return RedirectResponse(url=f"/login?error={error}")
    
    # Standard logic: Set cookie and redirect to home
    from app.modules.auth.models import User
    from sqlalchemy import select
    
    # Sync or Find user
    sso_id = str(user_data.get("id"))
    result = await db.execute(select(User).where(User.sso_id == sso_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Check by email/username
        email = user_data.get("email")
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            user.sso_id = sso_id
        else:
            user = User(
                username=user_data.get("username"),
                email=email,
                full_name=user_data.get("username"),
                sso_id=sso_id,
                hashed_password=user_data.get("password_hash")
            )
            db.add(user)
    
    await db.commit()
    
    res = RedirectResponse(url="/", status_code=303)
    from .cookie_signer import sign_cookie
    # Fallback to client_secret as key for HMAC signing in SDK template
    signed_id = sign_cookie(str(user.id), config.client_secret)
    res.set_cookie(key="user_id", value=signed_id, httponly=True, path="/", samesite="lax", max_age=1800)
    return res

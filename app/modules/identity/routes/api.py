import fastapi
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.modules.identity.services.user_service import UserService
from app.modules.identity.schemas import UserCreate, UserRead, LoginRequest
from app.modules.sso.services.jwt_service import JWTService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.get("/profile/me")
async def profile_me(request: Request, db: AsyncSession = Depends(get_db)):
    return await me(request, db)

@router.post("/login")
async def login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    # Support both JSON and Form data for compatibility
    username = None
    password = None
    client_id = None
    
    content_type = request.headers.get("Content-Type", "")
    if "application/json" in content_type:
        data = await request.json()
        username = data.get("username") or data.get("login_id")
        password = data.get("password")
        client_id = data.get("client_id")
    else:
        form_data = await request.form()
        username = form_data.get("username") or form_data.get("login_id")
        password = form_data.get("password")
        client_id = form_data.get("client_id")

    # Fallback to query parameters if client_id is not in body
    if not client_id:
        client_id = request.query_params.get("client_id")

    user = await UserService.get_user_by_username(db, username)
    if not user or not user.check_password(password):
        return fastapi.responses.JSONResponse(
            content={"success": False, "message": "Invalid username or password"},
            status_code=401
        )
    
    # Create session token
    token = JWTService.create_token({"sub": user.id, "username": user.username})
    
    # If client_id is present, this is an SSO login flow
    # Set cookie first, then tell frontend to redirect to jump endpoint
    if client_id:
        res = fastapi.responses.JSONResponse(content={
            "success": True,
            "redirect": f"/api/auth/jump/{client_id}"
        })
    else:
        res = fastapi.responses.JSONResponse(content={
            "success": True,
            "redirect": "/portal"
        })
    
    res.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=60 * 60 * 24 * 7  # 1 week
    )
    
    return res


@router.get("/me")
async def me(request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        return fastapi.responses.JSONResponse(
            content={"error": "Unauthorized"},
            status_code=401
        )
    
    payload = JWTService.verify_token(token)
    if not payload:
        return fastapi.responses.JSONResponse(
            content={"error": "Invalid session"},
            status_code=401
        )
    
    user = await UserService.get_user_by_id(db, payload["sub"])
    if not user:
        return fastapi.responses.JSONResponse(
            content={"error": "User not found"},
            status_code=404
        )
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": "admin" if user.is_admin else "user",
        "avatar_initial": user.username[0].upper() if user.username else "?"
    }

@router.get("/portal-apps")
async def portal_apps(db: AsyncSession = Depends(get_db)):
    from app.modules.clients.services.client_service import ClientService
    apps = await ClientService.list_active_clients(db)
    return [a.to_dict() for a in apps]

@router.api_route("/logout", methods=["GET", "POST"])
async def logout(request: Request):
    return_to = request.query_params.get("return_to", "/")
    res = RedirectResponse(url=return_to, status_code=303)
    res.delete_cookie("session_token", path="/")
    return res

@router.get("/jump/{client_id}")
async def jump_login(client_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get("session_token")
    if not token:
        return RedirectResponse(url=f"/auth/login?client_id={client_id}")
    
    payload = JWTService.verify_token(token)
    if not payload:
        return RedirectResponse(url=f"/auth/login?client_id={client_id}")
    
    from app.modules.clients.services.client_service import ClientService
    client = await ClientService.get_client_by_id(db, client_id)
    if not client or not client.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive client")
    
    redirect_uri = ""
    if client.redirect_uri:
        redirect_uri = client.redirect_uri.split(',')[0].strip()
    elif client.app_url:
        redirect_uri = f"{client.app_url.rstrip('/')}/auth-center/callback"
    
    if not redirect_uri:
        raise HTTPException(status_code=400, detail="Client has no redirect_uri or app_url configured")
        
    from app.modules.sso.services.oauth_service import OAuthService
    auth_code_str = await OAuthService.create_auth_code(db, client_id, payload["sub"], redirect_uri)
    
    separator = "&" if "?" in redirect_uri else "?"
    return RedirectResponse(url=f"{redirect_uri}{separator}code={auth_code_str}")


from app.modules.queue.models import UserTelegramConfig
from app.modules.admin.models import SystemSetting
from sqlalchemy import select
import secrets

@router.get("/profile/telegram")
async def get_user_telegram_config(request: Request, db: AsyncSession = Depends(get_db)):
    """Retrieve or create Telegram configuration for the logged-in user."""
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    payload = JWTService.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    user_id = payload["sub"]
    
    res = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.user_id == user_id))
    config = res.scalar_one_or_none()
    
    if not config:
        config = UserTelegramConfig(
            user_id=user_id,
            connect_token=secrets.token_hex(6).upper()
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)
        
    username_res = await db.execute(select(SystemSetting).where(SystemSetting.key == "telegram_bot_username"))
    username_setting = username_res.scalar_one_or_none()
    bot_username = username_setting.value.strip() if username_setting and username_setting.value else "VocaburnBot"
    
    return {
        "is_linked": bool(config.telegram_chat_id),
        "connect_token": config.connect_token,
        "reminder_time": config.reminder_time,
        "is_active": config.is_active,
        "streak_guard_enabled": config.streak_guard_enabled,
        "weekly_summary_enabled": config.weekly_summary_enabled,
        "inactivity_alert_enabled": config.inactivity_alert_enabled,
        "bot_username": bot_username
    }

@router.post("/profile/telegram")
async def update_user_telegram_config(request: Request, data: dict, db: AsyncSession = Depends(get_db)):
    """Update Telegram configuration for the logged-in user."""
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")
    payload = JWTService.verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid session")
        
    user_id = payload["sub"]
    
    res = await db.execute(select(UserTelegramConfig).where(UserTelegramConfig.user_id == user_id))
    config = res.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
        
    if "reminder_time" in data:
        config.reminder_time = data["reminder_time"]
    if "is_active" in data:
        config.is_active = data["is_active"]
    if "streak_guard_enabled" in data:
        config.streak_guard_enabled = data["streak_guard_enabled"]
    if "weekly_summary_enabled" in data:
        config.weekly_summary_enabled = data["weekly_summary_enabled"]
    if "inactivity_alert_enabled" in data:
        config.inactivity_alert_enabled = data["inactivity_alert_enabled"]
    if data.get("unlink") is True:
        config.telegram_chat_id = None
        config.connect_token = secrets.token_hex(6).upper() # reset token
        
    await db.commit()
    return {"status": "success"}

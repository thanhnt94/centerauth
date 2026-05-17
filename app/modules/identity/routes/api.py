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
        return {"error": "Unauthorized"}, 401
    
    payload = JWTService.verify_token(token)
    if not payload:
        return {"error": "Invalid session"}, 401
    
    user = await UserService.get_user_by_id(db, payload["sub"])
    if not user:
        return {"error": "User not found"}, 404
    
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

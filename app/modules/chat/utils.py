from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.modules.sso.services.jwt_service import JWTService
from app.modules.identity.models import User
from app.modules.identity.services.user_service import UserService


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """
    Dependency to get the current authenticated user from CentralAuth.
    Checks Authorization header first (Bearer token), then falls back to session_token cookie.
    """
    token = None
    
    # 1. Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        
    # 2. Check session_token cookie
    if not token:
        token = request.cookies.get("session_token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided"
        )
        
    payload = JWTService.verify_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
        
    user = await UserService.get_user_by_id(db, payload["sub"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is inactive"
        )
        
    return user


async def get_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to enforce that the logged-in user is an admin."""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user

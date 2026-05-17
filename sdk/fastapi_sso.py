import httpx
from fastapi import Request, HTTPException, Response
from fastapi.responses import RedirectResponse
from typing import Optional, Dict, Any
import functools

class CentralAuthClient:
    def __init__(self, server_url: str, client_id: str, client_secret: str):
        self.server_url = server_url.rstrip('/')
        self.client_id = client_id
        self.client_secret = client_secret
        
    def get_login_url(self, redirect_uri: Optional[str] = None) -> str:
        """URL to redirect user for login."""
        url = f"{self.server_url}/auth/login?client_id={self.client_id}"
        if redirect_uri:
            url += f"&redirect_uri={redirect_uri}"
        return url

    async def verify_code(self, code: str) -> Dict[str, Any]:
        """Exchange code for access token and user info."""
        async with httpx.AsyncClient() as client:
            # 1. Exchange code for token
            token_res = await client.post(
                f"{self.server_url}/api/auth/token",
                json={
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret
                }
            )
            if token_res.status_code != 200:
                raise HTTPException(status_code=400, detail="SSO Token exchange failed")
            
            token_data = token_res.json()
            access_token = token_data.get("access_token")
            
            # 2. Verify token and get user data
            verify_res = await client.get(
                f"{self.server_url}/api/auth/verify-token",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if verify_res.status_code != 200:
                raise HTTPException(status_code=401, detail="SSO Verification failed")
                
            return verify_res.json().get("user")

def login_required(auth_client: CentralAuthClient):
    """Decorator to protect FastAPI routes."""
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            request: Request = kwargs.get("request")
            if not request:
                # Try to find request in args
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            if not request or not request.cookies.get("sso_token"):
                return RedirectResponse(url=auth_client.get_login_url())
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

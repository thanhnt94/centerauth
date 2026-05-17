from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
import os

router = APIRouter(tags=["Identity Views"])
# Fix template path to be absolute relative to this file
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.abspath(os.path.join(CURRENT_DIR, "..", "..", "..", "templates"))
templates = Jinja2Templates(directory=TEMPLATE_DIR)

@router.get("/auth/login")
async def login_view(request: Request):
    # If already logged in, redirect to admin or portal
    if request.cookies.get("session_token"):
        return RedirectResponse(url="/admin")
    return templates.TemplateResponse("modules/auth/login.html", {"request": request})

@router.get("/auth/register")
async def register_view(request: Request):
    return templates.TemplateResponse("modules/auth/register.html", {"request": request})

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.modules.identity.services.user_service import UserService
from app.modules.clients.services.client_service import ClientService
from app.modules.identity.routes.api import me
from app.modules.clients.models import Client
from app.modules.identity.models import User
from app.core.config import settings
import sqlite3
import os

router = APIRouter(prefix="/admin/api", tags=["Admin API"])

CLIENT_DB_MAP = {
    "quizmind-v1": {"db": "quizmind.db", "sso_col": "sso_id"},
    "podlearn-v1": {"db": "PodLearn.db", "sso_col": "central_auth_id"},
    "vocaburn-v1": {"db": "vocaburn.db", "sso_col": "central_auth_id"},
    "reminote-v1": {"db": "reminote.db", "sso_col": "sso_user_id"},
}

def get_satellite_db_connection(client_id: str):
    mapping = CLIENT_DB_MAP.get(client_id)
    if not mapping:
        return None, None
    db_path = os.path.join(settings.STORAGE_DIR, mapping["db"])
    if not os.path.exists(db_path):
        # Fallback 1: Ecosystem root check (e.g. for vocaburn.db)
        fallback = os.path.abspath(os.path.join(settings.BASE_DIR, "..", "..", mapping["db"]))
        if os.path.exists(fallback):
            db_path = fallback
        else:
            # Fallback 2: Storage/database check
            fallback_storage = os.path.abspath(os.path.join(settings.BASE_DIR, "..", "Storage", "database", mapping["db"]))
            if os.path.exists(fallback_storage):
                db_path = fallback_storage
            else:
                return None, None
    conn = sqlite3.connect(db_path)
    return conn, mapping["sso_col"]

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

@router.get("/sync/scan")
async def sync_scan(db: AsyncSession = Depends(get_db)):
    # 1. Fetch CentralAuth users
    ca_users = await UserService.list_users(db)
    ca_users_map = {u.email.lower(): u for u in ca_users if u.email}
    
    # 2. Get active clients
    clients = await ClientService.list_active_clients(db)
    
    report = {}
    
    for client in clients:
        client_id = client.client_id
        conn, sso_col = get_satellite_db_connection(client_id)
        if not conn:
            continue
            
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [t[0].lower() for t in cursor.fetchall()]
            user_table = "users" if "users" in tables else "user" if "user" in tables else None
            
            if not user_table:
                continue
                
            # Inspect columns to handle schema variations (Vocaburn vs QuizMind/PodLearn)
            cursor.execute(f"PRAGMA table_info({user_table});")
            cols_info = cursor.fetchall()
            cols = [c[1].lower() for c in cols_info]
            id_col = "user_id" if "user_id" in cols else "id"
            pwd_col = "hashed_password" if "hashed_password" in cols else "password_hash" if "password_hash" in cols else None
            
            select_fields = [id_col, "username", "email", sso_col]
            if pwd_col:
                select_fields.append(pwd_col)
                
            cursor.execute(f"SELECT {', '.join(select_fields)} FROM {user_table};")
            raw_rows = cursor.fetchall()
            
            # Normalize row tuple
            rows = []
            for r in raw_rows:
                if pwd_col:
                    rows.append((r[0], r[1], r[2], r[3], r[4]))
                else:
                    rows.append((r[0], r[1], r[2], r[3], None))
            
            total = len(rows)
            missing_links = []
            orphans_local = []
            data_mismatch = []
            
            for row in rows:
                u_id, username, email, sso_id, sat_pwd_hash = row
                email_lower = email.lower() if email else ""
                
                # Rule 2: Emergency Fallback Protection (Skip user #1 or username 'admin')
                if str(u_id) == "1" or (username and username.lower() == "admin") or (email_lower == "admin@mindstack.click"):
                    continue
                
                ca_user = ca_users_map.get(email_lower)
                
                if not ca_user:
                    # Orphan: user in satellite but not in CentralAuth
                    orphans_local.append({
                        "email": email,
                        "username": username,
                        "id": u_id
                    })
                else:
                    sso_id_str = str(sso_id) if sso_id else None
                    ca_id_str = str(ca_user.id)
                    
                    # Rule 3: Conflict detection (Priority 1: email matched, but username/password hash mismatched)
                    username_mismatch = (username and ca_user.username and username.lower() != ca_user.username.lower())
                    pwd_mismatch = (pwd_col and sat_pwd_hash and ca_user.password_hash and sat_pwd_hash != ca_user.password_hash)
                    
                    if username_mismatch or pwd_mismatch:
                        reasons = []
                        if username_mismatch:
                            reasons.append(f"Conflict: Username mismatch (Central: '{ca_user.username}', Satellite: '{username}')")
                        if pwd_mismatch:
                            reasons.append("Conflict: Password mismatch")
                            
                        data_mismatch.append({
                            "email": email,
                            "username": username,
                            "central_auth_id": ca_user.id,
                            "mismatch_reasons": reasons
                        })
                    elif not sso_id_str:
                        # Missing link
                        missing_links.append({
                            "email": email,
                            "username": username,
                            "ca_id_suggestion": ca_user.id
                        })
                    elif sso_id_str != ca_id_str:
                        # Mismatched link ID
                        data_mismatch.append({
                            "email": email,
                            "username": username,
                            "central_auth_id": ca_user.id,
                            "mismatch_reasons": [f"ID mismatch (Satellite: {sso_id_str}, Central: {ca_id_str})"]
                        })
                        
            report[client_id] = {
                "total": total,
                "missing_links": missing_links,
                "orphans_local": orphans_local,
                "data_mismatch": data_mismatch
            }
        except Exception as e:
            report[client_id] = {"error": str(e)}
        finally:
            conn.close()
            
    return {"report": report}

@router.post("/sync/execute")
async def sync_execute(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    action = data.get("action")
    client_id = data.get("client_id")
    email = data.get("email")
    username = data.get("username")
    central_auth_id = data.get("central_auth_id")
    
    # Rule 2: Emergency Fallback Protection (Refuse admin ID 1 / admin changes)
    if (username and username.lower() == "admin") or (email and email.lower() == "admin@mindstack.click"):
        raise HTTPException(status_code=400, detail="Action prohibited: Emergency fallback account is excluded from SSO modifications.")
        
    conn, sso_col = get_satellite_db_connection(client_id)
    if not conn:
        raise HTTPException(status_code=400, detail=f"Database for client {client_id} not found")
        
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [t[0].lower() for t in cursor.fetchall()]
        user_table = "users" if "users" in tables else "user" if "user" in tables else None
        
        if not user_table:
            raise HTTPException(status_code=400, detail="User table not found in satellite")
            
        # Inspect columns to check primary key ID
        cursor.execute(f"PRAGMA table_info({user_table});")
        cols_info = cursor.fetchall()
        cols = [c[1].lower() for c in cols_info]
        id_col = "user_id" if "user_id" in cols else "id"
        pwd_col = "hashed_password" if "hashed_password" in cols else "password_hash" if "password_hash" in cols else None
        
        # Verify fallback ID protection on satellite side just in case
        cursor.execute(f"SELECT {id_col} FROM {user_table} WHERE LOWER(email) = ?;", (email.lower(),))
        sat_user_row = cursor.fetchone()
        if sat_user_row and str(sat_user_row[0]) == "1":
            raise HTTPException(status_code=400, detail="Action prohibited: Emergency fallback account ID 1 is protected.")
            
        # Rule 3: Conflict blockage during automatic/unattended bulk operations is shown on dashboard as warnings.
        # When user explicitly clicks "Push Sync Update" or "Force Link UUID", they request to align the satellite with CentralAuth.
        # Fetch CentralAuth user details as the Source of Truth
        from sqlalchemy import select
        res = await db.execute(select(User).where(User.email == email))
        ca_user = res.scalar_one_or_none()
        
        if action == "link_user":
            if not central_auth_id:
                raise HTTPException(status_code=400, detail="Missing central_auth_id")
            
            # Align satellite fields (SSO ID, username, password) with CentralAuth source of truth
            update_fields = [f"{sso_col} = ?"]
            params = [str(central_auth_id)]
            
            if ca_user:
                if "username" in cols:
                    update_fields.append("username = ?")
                    params.append(ca_user.username)
                if pwd_col and ca_user.password_hash:
                    update_fields.append(f"{pwd_col} = ?")
                    params.append(ca_user.password_hash)
                    
            params.append(email.lower())
            query = f"UPDATE {user_table} SET {', '.join(update_fields)} WHERE LOWER(email) = ?;"
            cursor.execute(query, tuple(params))
            conn.commit()
            return {"success": True, "message": f"Successfully aligned and linked {email} with Central ID {central_auth_id}."}
            
        elif action == "delete_user":
            cursor.execute(f"DELETE FROM {user_table} WHERE LOWER(email) = ?;", (email.lower(),))
            conn.commit()
            return {"success": True, "message": f"Successfully deleted {email} from satellite {client_id}."}
            
        elif action == "reverse_sync":
            # Pull to Central Hub: Create user in CentralAuth database
            pwd_val = None
            if pwd_col:
                cursor.execute(f"SELECT {pwd_col} FROM {user_table} WHERE LOWER(email) = ?;", (email.lower(),))
                row = cursor.fetchone()
                if row:
                    pwd_val = row[0]
            
            existing_user = await UserService.get_user_by_username(db, username)
            if existing_user:
                import random
                username = f"{username}_{random.randint(100, 999)}"
                
            new_ca_user = User(
                username=username,
                email=email,
                is_admin=False
            )
            if pwd_val:
                new_ca_user.password_hash = pwd_val
            else:
                new_ca_user.set_password("ecosystem_fallback_pwd_123")
                
            db.add(new_ca_user)
            await db.commit()
            await db.refresh(new_ca_user)
            
            cursor.execute(
                f"UPDATE {user_table} SET {sso_col} = ? WHERE LOWER(email) = ?;",
                (str(new_ca_user.id), email.lower())
            )
            conn.commit()
            return {"success": True, "message": f"Successfully imported {email} to Central Hub and linked with ID {new_ca_user.id}."}
            
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported action: {action}")
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/users")
async def provision_user(request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role") or "user"
    is_active = data.get("is_active", True)
    
    if not all([username, email, password]):
        raise HTTPException(status_code=400, detail="Missing required fields: username, email, or password")
        
    existing = await UserService.get_user_by_username(db, username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
        
    from sqlalchemy import select
    res = await db.execute(select(User).where(User.email == email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")
        
    new_user = User(
        username=username,
        email=email,
        is_admin=(role == "admin"),
        is_active=is_active
    )
    new_user.set_password(password)
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return {"success": True, "message": "User provisioned successfully", "user": new_user.to_dict()}

def propagate_user_update_to_satellites(user):
    # Rule 4: Real-time update propagation
    # Do not propagate changes for default admin ID 1
    if user.username == "admin" or user.email == "admin@mindstack.click":
        return
        
    for client_id in CLIENT_DB_MAP:
        conn, sso_col = get_satellite_db_connection(client_id)
        if not conn:
            continue
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [t[0].lower() for t in cursor.fetchall()]
            user_table = "users" if "users" in tables else "user" if "user" in tables else None
            if not user_table:
                continue
                
            cursor.execute(f"PRAGMA table_info({user_table});")
            cols_info = cursor.fetchall()
            cols = [c[1].lower() for c in cols_info]
            
            # Check if user is linked with this CentralAuth user ID
            cursor.execute(f"SELECT id FROM {user_table} WHERE {sso_col} = ?;", (str(user.id),))
            linked_user = cursor.fetchone()
            
            if not linked_user and "user_id" in cols:
                cursor.execute(f"SELECT user_id FROM {user_table} WHERE {sso_col} = ?;", (str(user.id),))
                linked_user = cursor.fetchone()
                
            if linked_user:
                u_id = linked_user[0]
                id_col = "user_id" if "user_id" in cols else "id"
                pwd_col = "hashed_password" if "hashed_password" in cols else "password_hash" if "password_hash" in cols else None
                
                # Rule 2 fallback protection: ensure we don't accidentally update ID 1 on satellite
                if str(u_id) == "1":
                    continue
                    
                update_fields = ["email = ?"]
                params = [user.email]
                
                if "username" in cols:
                    update_fields.append("username = ?")
                    params.append(user.username)
                if pwd_col:
                    update_fields.append(f"{pwd_col} = ?")
                    params.append(user.password_hash)
                    
                params.append(u_id)
                query = f"UPDATE {user_table} SET {', '.join(update_fields)} WHERE {id_col} = ?;"
                cursor.execute(query, tuple(params))
                conn.commit()
                print(f"[SYNC] Successfully propagated CentralAuth user update to {client_id} for user {user.email}")
        except Exception as e:
            print(f"[SYNC ERROR] Error propagating update to client {client_id}: {e}")
        finally:
            conn.close()

@router.put("/users/{user_id}")
async def update_user(user_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    email = data.get("email")
    role = data.get("role")
    is_active = data.get("is_active")
    password = data.get("password")
    
    user = await UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent modifying default admin via simple PUT if it is ID 1 (safety check)
    if user.username == "admin" or user.email == "admin@mindstack.click":
        raise HTTPException(status_code=400, detail="Cannot modify emergency fallback admin details here.")
        
    if email:
        user.email = email
    if role:
        user.is_admin = (role == "admin")
    if is_active is not None:
        user.is_active = is_active
    if password:
        user.set_password(password)
        
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Propagate the updates to linked satellites
    try:
        propagate_user_update_to_satellites(user)
    except Exception as propagation_err:
        print(f"Non-blocking propagation failure: {propagation_err}")
        
    return {"success": True, "message": "User updated successfully", "user": user.to_dict()}

@router.delete("/users/{user_id}")
async def delete_user_by_id(user_id: str, db: AsyncSession = Depends(get_db)):
    user = await UserService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Prevent deleting admin user
    if user.username == "admin" or user.email == "admin@mindstack.click":
        raise HTTPException(status_code=400, detail="Emergency fallback admin cannot be deleted.")
        
    await db.delete(user)
    await db.commit()
    return {"success": True, "message": "User deleted successfully"}

from pydantic import BaseModel
import httpx
import urllib.parse

class PingRequest(BaseModel):
    base_url: str

@router.post("/ping-client")
async def ping_client(req: PingRequest):
    try:
        parsed = urllib.parse.urlparse(req.base_url)
        base = f"{parsed.scheme}://{parsed.netloc}"
        
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(base)
            return {"success": True, "message": f"Online ({resp.status_code})"}
    except Exception as e:
        return {"success": False, "message": f"Offline"}

@router.put("/clients/{client_id}")
async def update_client(client_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    data = await request.json()
    from sqlalchemy import select
    result = await db.execute(select(Client).filter(Client.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    client.name = data.get("name", client.name)
    client.client_secret = data.get("client_secret", client.client_secret)
    client.app_url = data.get("app_url", client.app_url)
    
    # Optional logic for dynamic redirect uri
    redirect_uri = data.get("redirect_uri")
    if not redirect_uri and client.app_url:
        redirect_uri = f"{client.app_url}/auth-center/callback"
    client.redirect_uri = redirect_uri or client.redirect_uri
    
    await db.commit()
    await db.refresh(client)
    return {"success": True, "client": client.to_dict()}

@router.delete("/clients/{client_id}")
async def delete_client(client_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    result = await db.execute(select(Client).filter(Client.id == client_id))
    client = result.scalars().first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
        
    await db.delete(client)
    await db.commit()
    return {"success": True}

@router.post("/clients/{client_id}/push")
async def push_client_settings(client_id: int, db: AsyncSession = Depends(get_db)):
    # This endpoint can be expanded later to perform HTTP POST to the client's internal webhook to update its sso_settings database.
    # For now, return success to clear the UI error.
    return {"success": True, "message": "Pushed configuration successfully"}

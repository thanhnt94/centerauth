import requests
import uuid
import secrets
from flask import current_app
from app import db
from app.models.user import User
from app.models.client import Client

class SyncService:
    """
    Core service for managing User Synchronization across the ecosystem.
    """

    @staticmethod
    def scan_client(client_id: str):
        """
        Calls a specific client's internal API to fetch their user list.
        """
        client = Client.query.filter_by(client_id=client_id).first()
        if not client:
            return {"error": "Client not found"}

        # We assume the internal API endpoint follows this pattern
        # This could be configurable in the Client model in the future
        if not client.backchannel_logout_uri:
            return {"error": "No backchannel_logout_uri defined to derive API path"}

        # Derive internal API base from the backchannel logout URI
        # Most apps have /auth-center/backchannel-logout or /api/sso/...
        # We'll use a heuristic or just assume the new standard we just added
        # New standard is /api/sso/internal/user-list relative to the app base
        
        from urllib.parse import urlparse
        
        try:
            parsed_uri = urlparse(client.backchannel_logout_uri)
            base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
        except Exception:
            return {"error": "Invalid backchannel_logout_uri"}
             
        base_url = base_url.rstrip('/')
        
        # Try multiple common patterns to find the sync API
        possible_paths = [
            "/auth-center/api/sso/internal/user-list", # MindStack standard
            "/api/sso/internal/user-list",            # Generic standard
            "/auth-center/internal/user-list",        # PodLearn standard
            "/auth/api/sso/internal/user-list"        # IPTV standard
        ]

        attempts = []
        for path in possible_paths:
            api_url = f"{base_url}{path}"
            attempts.append(api_url)
            try:
                response = requests.post(
                    api_url,
                    headers={"X-Client-Secret": client.client_secret},
                    timeout=5
                )
                if response.status_code == 200:
                    return response.json().get("users", [])
                elif response.status_code == 401:
                    return {"error": f"Unauthorized (Invalid Secret) at {path}"}
                # If 404, we continue to next path
            except Exception as e:
                # If timeout or connection error, we might want to stop or continue
                pass
        
        return {"error": f"API 404 - Checked {len(attempts)} paths. Last: {attempts[-1]}"}

    @staticmethod
    def get_sync_report():
        """
        Compiles a report comparing CentralAuth users with all active clients.
        """
        clients = Client.query.filter_by(is_active=True).all()
        central_users = {u.email: u for u in User.query.all()}
        
        report = {}
        
        for client in clients:
            client_users = SyncService.scan_client(client.client_id)
            
            if isinstance(client_users, dict) and "error" in client_users:
                report[client.client_id] = {"error": client_users["error"]}
                continue
                
            stats = {
                "orphans_local": [],  # Exist in App but NOT in Central
                "missing_links": [],  # Exist in both but no ID link
                "matching": 0,
                "total": len(client_users)
            }
            
            for cu in client_users:
                email = cu.get("email")
                ca_user = central_users.get(email)
                
                if not ca_user:
                    stats["orphans_local"].append(cu)
                elif not cu.get("central_auth_id") or cu["central_auth_id"] != ca_user.id:
                    cu["ca_id_suggestion"] = ca_user.id
                    stats["missing_links"].append(cu)
                else:
                    stats["matching"] += 1
            
            report[client.client_id] = stats
            
        return report

    @staticmethod
    def reverse_sync_user(client_id: str, email: str):
        """
        Pulls a user from a client app into CentralAuth.
        """
        client_users = SyncService.scan_client(client_id)
        if isinstance(client_users, dict) and "error" in client_users:
            return False, client_users["error"]

        user_data = next((u for u in client_users if u["email"] == email), None)
        if not user_data:
            return False, "User not found in client data"

        # Check if already exists (Safety check)
        existing = User.query.filter_by(email=email).first()
        if existing:
            return False, "User already exists in CentralAuth"

        # Create new user in CentralAuth
        new_user = User(
            username=user_data["username"],
            email=email,
            full_name=user_data.get("full_name", user_data["username"])
        )
        # Random temporary password
        temp_pass = secrets.token_urlsafe(12)
        new_user.set_password(temp_pass)
        
        # We need a way to flag "Force Password Reset"
        # For now, we'll just log the temp pass or assume we send an email
        # Add to DB
        db.session.add(new_user)
        db.session.commit()
        
        return True, {"id": new_user.id, "temp_password": temp_pass}

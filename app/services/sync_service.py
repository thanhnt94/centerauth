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
        # Use the Standardized Internal Sync API path for all applications
        sync_api_url = f"{base_url.rstrip('/')}/api/sso-internal/user-list"
        
        import sys
        sys.stderr.write(f"[SYNC] {client.client_id} -> {sync_api_url} (secret={client.client_secret})\n")
        sys.stderr.flush()
        
        try:
            response = requests.post(
                sync_api_url,
                headers={"X-Client-Secret": client.client_secret},
                timeout=5
            )
            sys.stderr.write(f"[SYNC] {client.client_id} <- status={response.status_code} body={response.text[:200]}\n")
            sys.stderr.flush()

            if response.status_code == 200:
                try:
                    return response.json().get("users", [])
                except Exception as json_err:
                    return {"error": f"JSON Parse Error: {str(json_err)} | Body: {response.text[:100]}"}
            elif response.status_code == 401:
                return {"error": f"Unauthorized (Invalid Secret) at {sync_api_url}"}
            else:
                return {"error": f"API returned status {response.status_code} | Body: {response.text[:100]}"}
        except Exception as e:
            return {"error": f"Connection error: {str(e)}"}

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
                elif not cu.get("central_auth_id") or str(cu["central_auth_id"]) != str(ca_user.id):
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

    @staticmethod
    def link_user(client_id: str, email: str, central_auth_id: int):
        """
        Sends a request to a satellite app to update a user's central_auth_id.
        This links the local user to their CentralAuth identity.
        """
        client = Client.query.filter_by(client_id=client_id).first()
        if not client:
            return False, "Client not found"

        from urllib.parse import urlparse
        try:
            parsed_uri = urlparse(client.backchannel_logout_uri)
            base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
        except Exception:
            return False, "Invalid backchannel_logout_uri"

        link_api_url = f"{base_url.rstrip('/')}/api/sso-internal/link-user"
        
        # Ensure central_auth_id is treated as a string for UUID comparison
        ca_id_str = str(central_auth_id)
        
        # Fetch user details from CentralAuth to sync profile
        ca_user = User.query.filter_by(id=ca_id_str).first()
        if not ca_user:
            return False, f"CentralAuth: No user found with ID '{ca_id_str}'"

        try:
            response = requests.post(
                link_api_url,
                headers={"X-Client-Secret": client.client_secret, "Content-Type": "application/json"},
                json={
                    "email": email, 
                    "central_auth_id": central_auth_id,
                    "username": ca_user.username,
                    "full_name": ca_user.full_name
                },
                timeout=5
            )
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, f"App returned {response.status_code}: {response.text[:100]}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

    @staticmethod
    def delete_remote_user(client_id: str, email: str):
        """Delete a user from a satellite app's database."""
        client = Client.query.filter_by(client_id=client_id).first()
        if not client:
            return False, "Client not found"

        from urllib.parse import urlparse
        try:
            parsed_uri = urlparse(client.backchannel_logout_uri)
            base_url = f"{parsed_uri.scheme}://{parsed_uri.netloc}"
        except Exception:
            return False, "Invalid backchannel_logout_uri"

        delete_api_url = f"{base_url.rstrip('/')}/api/sso-internal/delete-user"

        try:
            response = requests.post(
                delete_api_url,
                headers={"X-Client-Secret": client.client_secret, "Content-Type": "application/json"},
                json={"email": email},
                timeout=5
            )
            if response.status_code == 200:
                return True, response.json()
            else:
                return False, f"App returned {response.status_code}: {response.text[:100]}"
        except Exception as e:
            return False, f"Connection error: {str(e)}"

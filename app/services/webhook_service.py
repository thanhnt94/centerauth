import requests
import jwt
import time
from flask import current_app
from typing import Dict, Any

class WebhookService:
    """
    Handles asynchronous notifications specifically for Single Sign-Out events.
    """

    @staticmethod
    def send_logout_notification(logout_uri: str, user_id: str, client: Any) -> bool:
        """
        Sends a Back-channel Logout notification to a client's webhook.
        Includes a 'logout_token' (JWT) to ensure the request is from CentralAuth.
        """
        if not logout_uri or not client:
            return False

        # Use the specific client_secret for signing to ensure the client can verify it
        secret = client.client_secret
        
        # Identity token specifically for logout (OIDC-like)
        logout_payload = {
            "iss": current_app.config.get("SITE_NAME", "CentralAuth"),
            "sub": user_id,
            "aud": client.client_id,
            "iat": int(time.time()),
            "exp": int(time.time()) + 120, # Short TTL (2m)
            "events": {
                "http://schemas.openid.net/event/backchannel-logout": {}
            }
        }
        
        logout_token = jwt.encode(logout_payload, secret, algorithm='HS256')

        try:
            # Send the request with a reasonable timeout
            response = requests.post(
                logout_uri,
                json={"logout_token": logout_token},
                timeout=5
            )
            
            if response.status_code == 200:
                current_app.logger.info(f"Logout notification successful for {client.client_id}")
                return True
            else:
                current_app.logger.warning(f"Logout notification failed for {client.client_id}: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            current_app.logger.error(f"Error sending logout notification to {client.client_id}: {e}")
            return False

    @staticmethod
    def notify_all_active_sessions(user_id: str):
        """
        Finds all active client sessions for a user and triggers logouts.
        """
        from app.models.user_session import UserLoginSession
        from app.models.client import Client
        
        sessions = UserLoginSession.query.filter_by(user_id=user_id).all()
        
        for session in sessions:
            client = Client.query.filter_by(client_id=session.client_id).first()
            if client and client.backchannel_logout_uri:
                # Trigger the notification
                WebhookService.send_logout_notification(
                    client.backchannel_logout_uri,
                    user_id,
                    client
                )
            
            # Remove the local session tracking
            from app import db
            db.session.delete(session)
            
        from app import db
        db.session.commit()

import jwt
from datetime import datetime, timezone, timedelta
from flask import current_app
from typing import Dict, Any, Optional
import uuid

class JWTService:
    @staticmethod
    def generate_token_pair(user) -> Dict[str, str]:
        """
        Generate both an ACCESS token and a REFRESH token.
        Each token has a unique 'jti' (JWT ID) for revocation tracking.
        """
        secret = current_app.config['JWT_SECRET_KEY']
        
        # Access Token: Short-lived (Default 1 hour, should be 15-30m in prod)
        access_exp = datetime.now(timezone.utc) + timedelta(hours=current_app.config.get('JWT_EXPIRATION_HOURS', 1))
        access_jti = str(uuid.uuid4())
        access_payload = {
            'sub': user.id,
            'email': user.email,
            'username': user.username,
            'name': user.full_name,
            'is_admin': user.is_admin,
            'jti': access_jti,
            'type': 'access',
            'exp': access_exp
        }
        access_token = jwt.encode(access_payload, secret, algorithm='HS256')

        # Refresh Token: Long-lived (7 days)
        refresh_exp = datetime.now(timezone.utc) + timedelta(days=7)
        refresh_jti = str(uuid.uuid4())
        refresh_payload = {
            'sub': user.id,
            'jti': refresh_jti,
            'type': 'refresh',
            'exp': refresh_exp
        }
        refresh_token = jwt.encode(refresh_payload, secret, algorithm='HS256')

        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'expires_in': int(timedelta(hours=current_app.config.get('JWT_EXPIRATION_HOURS', 1)).total_seconds())
        }

    @staticmethod
    def decode_token(token: str, check_blacklist: bool = True) -> Optional[Dict[str, Any]]:
        """
        Decode and verify JWT.
        If 'check_blacklist' is True, it will verify that the JTI hasn't been revoked.
        """
        secret = current_app.config['JWT_SECRET_KEY']
        
        try:
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            
            # Check Blacklist
            if check_blacklist:
                from app.models.token_blacklist import TokenBlacklist
                if TokenBlacklist.is_blacklisted(payload.get('jti')):
                    raise ValueError("Token has been revoked")
            
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError:
            raise ValueError("Invalid token")

    @staticmethod
    def get_jti(token: str) -> Optional[str]:
        """Extract JTI without full verification if needed for logging."""
        try:
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload.get('jti')
        except:
            return None

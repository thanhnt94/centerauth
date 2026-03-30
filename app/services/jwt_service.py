import jwt
from datetime import datetime, timezone, timedelta
from flask import current_app
from typing import Dict, Any, Optional

class JWTService:
    @staticmethod
    def generate_token(user) -> str:
        """
        Generate a JWT token for the user.
        Payload includes 'sub' (user.id), 'email', 'name', and 'exp'.
        """
        secret = current_app.config['JWT_SECRET_KEY']
        expiration_hours = current_app.config['JWT_EXPIRATION_HOURS']
        
        # Calculate expiration time
        exp_time = datetime.now(timezone.utc) + timedelta(hours=expiration_hours)
        
        payload = {
            'sub': user.id,
            'email': user.email,
            'name': user.full_name,
            'exp': exp_time
        }
        
        # Generate and return the encoded token
        return jwt.encode(payload, secret, algorithm='HS256')

    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decode a JWT token and verify its signature and expiration.
        Returns the payload dict if valid, raises an exception if invalid.
        """
        secret = current_app.config['JWT_SECRET_KEY']
        
        try:
            # jwt.decode automatically verifies expiration time if 'exp' is present
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            return payload
        except jwt.ExpiredSignatureError:
            raise ValueError("Token has expired")
        except jwt.InvalidTokenError:
            raise ValueError("Invalid token")

from datetime import datetime, timezone, timedelta
import uuid
from app import db

class AuthCode(db.Model):
    """
    Temporary Authorization Codes for SSO handshakes.
    Short-lived (TTL ~2m) and self-destructing after use.
    """
    __tablename__ = 'auth_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(128), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    client_id = db.Column(db.String(50), nullable=False)
    redirect_uri = db.Column(db.Text, nullable=False)
    
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, 
                           default=lambda: datetime.now(timezone.utc) + timedelta(minutes=5))
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def is_valid(self):
        if self.used:
            return False
            
        expires = self.expires_at
        # Handle SQLite potentially returning naive datetime
        if expires and expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
            
        return expires > datetime.now(timezone.utc)

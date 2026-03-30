from datetime import datetime, timezone
import uuid
from app import db

class Client(db.Model):
    __tablename__ = 'clients'

    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.String(50), unique=True, index=True, nullable=False)
    client_secret = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    
    # Authorized redirect URIs (comma-separated)
    redirect_uri = db.Column(db.Text, nullable=False)
    
    # Webhook endpoint for Global Logout (Single Sign-Out)
    backchannel_logout_uri = db.Column(db.Text, nullable=True)
    
    # Portal Display Configuration
    app_icon = db.Column(db.String(50), default="fas fa-rocket") # FontAwesome class
    app_description = db.Column(db.String(255), nullable=True)
    app_color_theme = db.Column(db.String(50), default="indigo") # tailwind base color
    is_visible_on_portal = db.Column(db.Boolean, default=True, nullable=False)
    
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'name': self.name,
            'redirect_uri': self.redirect_uri,
            'backchannel_logout_uri': self.backchannel_logout_uri,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

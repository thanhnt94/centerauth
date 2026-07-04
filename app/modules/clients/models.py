from sqlalchemy import Column, Integer, String, Boolean, DateTime
from datetime import datetime
from app.core.db import Base

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100))
    client_id = Column(String(100), unique=True, index=True)
    client_secret = Column(String(255))
    redirect_uri = Column(String(500)) # Supports comma-separated list
    app_url = Column(String(255), nullable=True)
    app_icon = Column(String(100), default="fas fa-rocket")
    app_description = Column(String(500), nullable=True)
    app_color_theme = Column(String(50), default="indigo")
    is_active = Column(Boolean, default=True)
    is_visible_on_portal = Column(Boolean, default=True)
    available_roles = Column(String(500), nullable=True, default="user,admin")
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "redirect_uri": self.redirect_uri,
            "app_url": self.app_url,
            "app_icon": self.app_icon,
            "app_description": self.app_description,
            "app_color_theme": self.app_color_theme,
            "is_active": self.is_active,
            "is_visible_on_portal": self.is_visible_on_portal,
            "available_roles": self.available_roles
        }

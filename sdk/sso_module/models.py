from sqlalchemy import Column, String, Boolean, Integer
from app.core.db import Base

class SSOConfig(Base):
    """
    This model manages SSO settings locally via its own Admin Panel.
    """
    __tablename__ = "sso_settings"

    id = Column(Integer, primary_key=True, index=True)
    is_enabled = Column(Boolean, default=False)
    server_url = Column(String(255), nullable=True)
    client_id = Column(String(100), nullable=True)
    client_secret = Column(String(255), nullable=True)
    redirect_uri = Column(String(255), nullable=True)

    def to_dict(self):
        return {
            "is_enabled": self.is_enabled,
            "server_url": self.server_url,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri
        }

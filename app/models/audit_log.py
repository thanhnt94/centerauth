# -*- coding: utf-8 -*-
import uuid
from datetime import datetime, timezone
from app import db

class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event = db.Column(db.String(100), nullable=False)
    details = db.Column(db.Text, nullable=True)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    user = db.relationship("User", backref=db.backref("logs", lazy=True))

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "event": self.event,
            "details": self.details,
            "user_id": self.user_id,
            "username": self.user.username if self.user else "System",
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

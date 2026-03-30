# -*- coding: utf-8 -*-
from app import db

class SystemSetting(db.Model):
    __tablename__ = "system_settings"

    key = db.Column(db.String(50), primary_key=True)
    value = db.Column(db.Text, nullable=True)
    description = db.Column(db.String(255), nullable=True)
    category = db.Column(db.String(50), default="general")

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "category": self.category
        }

from datetime import datetime, timezone
from app import db

class TokenBlacklist(db.Model):
    """
    Stores revoked JWT IDs (jti).
    Used for instant token invalidation across the ecosystem.
    """
    __tablename__ = 'token_blacklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(36), unique=True, index=True, nullable=False)
    token_type = db.Column(db.String(10), nullable=False) # 'access' or 'refresh'
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    @staticmethod
    def is_blacklisted(jti):
        return db.session.query(TokenBlacklist.id).filter_by(jti=jti).first() is not None

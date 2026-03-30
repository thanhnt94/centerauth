from datetime import datetime, timezone
from app import db

class UserLoginSession(db.Model):
    """
    Tracks which user is logged into which client application.
    This is necessary for implementing Global Logout (Single Sign-Out).
    """
    __tablename__ = 'user_login_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    client_id = db.Column(db.String(50), nullable=False)
    
    # Track the specific JTI used for this session
    access_jti = db.Column(db.String(36), nullable=True)
    refresh_jti = db.Column(db.String(36), nullable=True)
    
    last_active = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    @staticmethod
    def register_session(user_id, client_id, access_jti=None, refresh_jti=None):
        session = UserLoginSession.query.filter_by(user_id=user_id, client_id=client_id).first()
        if not session:
            session = UserLoginSession(user_id=user_id, client_id=client_id)
            db.session.add(session)
        
        session.access_jti = access_jti
        session.refresh_jti = refresh_jti
        session.last_active = datetime.now(timezone.utc)
        db.session.commit()
        return session

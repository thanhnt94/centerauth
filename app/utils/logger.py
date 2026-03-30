# -*- coding: utf-8 -*-
from flask import request, session
from app.models.audit_log import AuditLog
from app import db

def log_event(event, details=None, user_id=None):
    """
    Helper to record a system audit log.
    If user_id is None, it tries to get it from the session.
    """
    if user_id is None:
        user_id = session.get("user_id")
        
    ip_address = request.remote_addr if request else None
    
    new_log = AuditLog(
        event=event,
        details=details,
        user_id=user_id,
        ip_address=ip_address
    )
    
    try:
        db.session.add(new_log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        # Fallback to app logger if DB fails
        from flask import current_app
        current_app.logger.error(f"Failed to log event {event}: {e}")

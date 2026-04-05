# -*- coding: utf-8 -*-
from flask import Flask, redirect, url_for, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)
    db.init_app(app)
    
    # Ensure upload directories exist
    import os
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Import models early for db.create_all()
    from app.models.user import User
    from app.models.client import Client
    from app.models.audit_log import AuditLog
    from app.models.settings import SystemSetting
    from app.models.auth_code import AuthCode
    from app.models.token_blacklist import TokenBlacklist
    from app.models.user_session import UserLoginSession

    # Ensure tables and default data
    with app.app_context():
        db.create_all()
        
        # 1. Seed Admin user if not exists
        admin_user = User.query.filter_by(username='admin').first()
        if not admin_user:
            admin_user = User(username='admin', email='admin@example.com', full_name='System Admin', is_admin=True)
            admin_user.set_password('admin')
            db.session.add(admin_user)
            db.session.commit()
        else:
            if not admin_user.is_admin:
                admin_user.is_admin = True
                db.session.commit()

        # 2. Seed System Settings
        default_settings = [
            {"key": "AVATAR_UPLOAD_PATH", "value": "/static/uploads/avatars/", "description": "Client-facing path for user avatars.", "category": "storage"},
            {"key": "SYSTEM_REGISTER_ENABLED", "value": "true", "description": "Whether to allow new user registrations.", "category": "auth"},
            {"key": "SITE_NAME", "value": "Mindstack Central Auth", "description": "Corporate name shown in emails and pages.", "category": "branding"}
        ]
        settings_created = False
        for ds in default_settings:
            if not SystemSetting.query.get(ds["key"]):
                new_setting = SystemSetting(**ds)
                db.session.add(new_setting)
                settings_created = True
        if settings_created:
            db.session.commit()

        # 3. Default Clients Seeding Disabled (As per user request for a cleaner DB)
        # You can add clients manually via the Admin Dashboard.
        pass

    # Register blueprints
    from app.routes.auth import auth_bp
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    
    from app.routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix="/admin")
    
    from app.routes.user import user_bp
    app.register_blueprint(user_bp, url_prefix="/user")

    from flask import session
    @app.route("/")
    def index():
        if "user_id" in session:
            user = User.query.get(session["user_id"])
            if user:
                apps = Client.query.filter(
                    Client.is_visible_on_portal.in_([True, 1]),
                    Client.is_active.in_([True, 1])
                ).all()
                return render_template("auth/success.html", user=user, apps=apps)
        return redirect(url_for("auth.login"))

    return app
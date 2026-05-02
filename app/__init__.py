# -*- coding: utf-8 -*-
from flask import Flask, redirect, url_for, render_template
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from config import Config

db = SQLAlchemy()

def apply_migrations(app):
    """
    Ecosystem Migration Engine v1.1
    Scans 'database_updates' folder and executes unapplied scripts.
    Works on both Local and VPS (Gunicorn).
    """
    import os
    from sqlalchemy import text
    
    # Path relative to the app root
    updates_dir = os.path.abspath(os.path.join(app.root_path, '..', 'database_updates'))
    if not os.path.exists(updates_dir):
        os.makedirs(updates_dir, exist_ok=True)
        return

    with app.app_context():
        # 1. Ensure version tracking table exists
        db.session.execute(text("""
            CREATE TABLE IF NOT EXISTS _schema_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version_name VARCHAR(255) UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.session.commit()

        # 2. Get list of applied migrations
        applied = [r[0] for r in db.session.execute(text("SELECT version_name FROM _schema_versions")).fetchall()]
        
        # 3. Scan for new migration files
        files = sorted([f for f in os.listdir(updates_dir) if f.endswith(('.sql', '.py'))])
        
        for filename in files:
            if filename not in applied:
                print(f" [MIGRATION] Applying {filename}...")
                file_path = os.path.join(updates_dir, filename)
                
                try:
                    if filename.endswith('.sql'):
                        with open(file_path, 'r', encoding='utf-8') as f:
                            sql = f.read()
                            # Split by semicolon and execute each to handle SQLite limitations
                            for statement in sql.split(';'):
                                if statement.strip():
                                    try:
                                        db.session.execute(text(statement))
                                    except Exception as sql_e:
                                        # Ignore "duplicate column" errors for idempotency
                                        if "duplicate column name" in str(sql_e).lower():
                                            continue
                                        raise sql_e
                    
                    elif filename.endswith('.py'):
                        import importlib.util
                        spec = importlib.util.spec_from_file_location("migration_module", file_path)
                        mod = importlib.util.module_from_spec(spec)
                        spec.loader.exec_module(mod)
                        if hasattr(mod, 'run'):
                            mod.run(app, db)

                    # Mark as applied
                    db.session.execute(text("INSERT INTO _schema_versions (version_name) VALUES (:v)"), {"v": filename})
                    db.session.commit()
                    print(f" [MIGRATION] Success: {filename}")
                    
                except Exception as e:
                    db.session.rollback()
                    print(f" [!] MIGRATION FAILED ({filename}): {e}")
                    break

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    CORS(app)
    db.init_app(app)
    
    # Run Migration Engine (Crucial for VPS/Gunicorn)
    apply_migrations(app)
    
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
    
    from app.routes.admin_api import admin_api_bp
    app.register_blueprint(admin_api_bp, url_prefix="/admin/api")

    from app.routes.admin import admin_bp
    app.register_blueprint(admin_bp, url_prefix="/admin")
    
    from app.routes.user import user_bp
    app.register_blueprint(user_bp, url_prefix="/user")

    from app.routes.profile_api import profile_api_bp
    app.register_blueprint(profile_api_bp, url_prefix="/api/profile")

    @app.route("/")
    @app.route("/auth/login")
    @app.route("/admin/clients")
    @app.route("/admin/users")
    @app.route("/admin/settings")
    @app.route("/admin/logs")
    @app.route("/admin/sync")
    def index():
        """Serves the Unified Portal (Vite SPA) or redirects to login."""
        from flask import session, redirect, url_for, request
        import os

        # Authentication Guard
        if "user_id" in session:
            if request.path == "/auth/login":
                # Redirect already logged-in users to the main portal if no SSO params
                if not request.args.get("client_id") and not request.args.get("return_to"):
                    return redirect("/")
        elif request.path != "/auth/login":
            # Redirect unauthenticated users to login path directly to avoid loop with API route
            return_to = request.args.get("return_to", "")
            return redirect(f"/auth/login?return_to={return_to}")
        
        # Serving Logic: Serve Vite Dist
        dist_path = os.path.join(app.root_path, 'static', 'dist', 'index.html')
        if os.path.exists(dist_path):
            from flask import send_from_directory
            return send_from_directory(os.path.join(app.root_path, 'static', 'dist'), 'index.html')
        
        return "Identity Node Frontend not found. Please run 'npm run build' in central-auth-studio.", 404

    return app
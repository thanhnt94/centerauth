# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, redirect, current_app, render_template, flash, url_for, session
from app import db
from app.models.user import User
from app.models.client import Client
from app.models.auth_code import AuthCode
from app.models.token_blacklist import TokenBlacklist
from app.models.user_session import UserLoginSession
from app.services.jwt_service import JWTService
from flask_cors import cross_origin
from urllib.parse import urlparse
from sqlalchemy import or_
from datetime import datetime, timezone

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@auth_bp.route("/discovery", methods=["GET"])
def discovery():
    """Returns the discovery configuration for clients."""
    base_url = request.host_url.rstrip("/")
    return jsonify({
        "issuer": current_app.config.get("SITE_NAME", "CentralAuth"),
        "authorization_endpoint": f"{base_url}/api/auth/login",
        "token_endpoint": f"{base_url}/api/auth/token",
        "refresh_endpoint": f"{base_url}/api/auth/refresh",
        "verify_endpoint": f"{base_url}/api/auth/verify-token",
        "discovery_version": "2.0"
    }), 200

@auth_bp.route("/validate-client", methods=["POST"])
@cross_origin()
def validate_client():
    """Client credential validation for internal system testing."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON data"}), 400
        
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")
    
    if not client_id or not client_secret:
        return jsonify({"error": "Missing client credentials"}), 400
        
    client = Client.query.filter_by(client_id=client_id, client_secret=client_secret).first()
    if not client:
        return jsonify({"success": False, "error": "Invalid Client ID or Secret"}), 401
        
    if not client.is_active:
        return jsonify({"success": False, "error": "Client is inactive"}), 403
        
    return jsonify({
        "success": True, 
        "message": "Kết nối thành công!",
        "client_name": client.name
    }), 200

@auth_bp.route("/verify-token", methods=["GET"])
def verify_token():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    token = auth_header.split(" ")[1]
    try:
        # JWTService.decode_token now checks the blacklist automatically
        payload = JWTService.decode_token(token, check_blacklist=True)
        
        if payload.get('type') != 'access':
            return jsonify({"error": "Invalid token type. Expected access_token"}), 403

        user_id = payload.get("sub")
        user = User.query.get(user_id)
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        return jsonify({
            "status": "success",
            "user": user.to_dict()
        }), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 401
    except Exception as e:
        return jsonify({"error": "An error occurred during verification"}), 500

@auth_bp.route("/login", methods=["POST", "GET"])
@cross_origin()
def login():
    return_to = request.args.get("return_to")
    client_id = request.args.get("client_id")
    
    # REQUIRE: client_id and strict redirect_uri validation
    client = None
    if client_id:
        client = Client.query.filter_by(client_id=client_id).first()
        if not client:
            return jsonify({"error": "Invalid client_id"}), 400
        
        if return_to:
            authorized_uris = [uri.strip() for uri in client.redirect_uri.split(',')]
            if return_to not in authorized_uris:
                return jsonify({"error": f"Unauthorized redirect_uri: {return_to}"}), 403

    if request.method == "GET":
        if "user_id" in session:
            user = User.query.get(session["user_id"])
            if user and user.is_active:
                if client and return_to:
                    # User is already logged in, so just generate a new code and go back to the app
                    auth_code = AuthCode(user_id=user.id, client_id=client_id, redirect_uri=return_to)
                    db.session.add(auth_code)
                    db.session.commit()
                    
                    separator = "&" if "?" in return_to else "?"
                    return redirect(f"{return_to}{separator}code={auth_code.code}")
                
                # If no client, they are just exploring the auth portal
                return redirect(url_for("index"))
        
        # Only show login if no valid session or user inactive
        return render_template("auth/login.html")

    # Handle Login Submission
    login_id = request.form.get("login_id") or (request.get_json().get("username") if request.is_json else None)
    password = request.form.get("password") or (request.get_json().get("password") if request.is_json else None)
    remember = request.form.get("remember") == "on"

    user = User.query.filter(or_(User.username == login_id, User.email == login_id)).first()
    if not user or not user.check_password(password) or not user.is_active:
        if request.is_json:
            return jsonify({"error": "Invalid credentials"}), 401
        flash("Tài khoản hoặc mật khẩu không chính xác.", "danger")
        return redirect(url_for("auth.login", return_to=return_to, client_id=client_id))

    # Authenticate Browser Session
    session.clear() # Clear any existing flash messages/old session
    session["user_id"] = user.id
    if remember:
        session.permanent = True

    if client and return_to:
        auth_code = AuthCode(user_id=user.id, client_id=client_id, redirect_uri=return_to)
        db.session.add(auth_code)
        db.session.commit()
        
        separator = "&" if "?" in return_to else "?"
        return redirect(f"{return_to}{separator}code={auth_code.code}")

    if request.is_json:
        tokens = JWTService.generate_token_pair(user)
        return jsonify({**tokens, "user": user.to_dict()}), 200

    # Redirect to index to ensure apps are loaded via the portal logic
    return redirect(url_for("index"))

@auth_bp.route("/token", methods=["POST"])
@cross_origin()
def token_exchange():
    """Exchange Authorization Code for JWT Access & Refresh tokens (Server-to-Server)."""
    data = request.get_json()
    code_str = data.get("code")
    client_id = data.get("client_id")
    client_secret = data.get("client_secret")

    if not all([code_str, client_id, client_secret]):
        return jsonify({"error": "Missing required fields"}), 400

    # 1. Verify Client
    client = Client.query.filter_by(client_id=client_id, client_secret=client_secret).first()
    if not client or not client.is_active:
        return jsonify({"error": "Invalid client credentials"}), 401

    # 2. Verify Code
    auth_code = AuthCode.query.filter_by(code=code_str, client_id=client_id).first()
    if not auth_code or not auth_code.is_valid():
        return jsonify({"error": "Invalid or expired authorization code"}), 400

    # 3. Mark code as used
    auth_code.used = True
    db.session.commit()

    # 4. Generate Tokens
    user = User.query.get(auth_code.user_id)
    tokens = JWTService.generate_token_pair(user)
    
    # 5. Register Session for Global Logout
    UserLoginSession.register_session(
        user_id=user.id, 
        client_id=client_id,
        access_jti=JWTService.get_jti(tokens['access_token']),
        refresh_jti=JWTService.get_jti(tokens['refresh_token'])
    )
    
    return jsonify(tokens), 200

@auth_bp.route("/refresh", methods=["POST"])
@cross_origin()
def refresh():
    """Use a Refresh Token to obtain a new Access Token (and rotate Refresh Token)."""
    data = request.get_json()
    refresh_token = data.get("refresh_token")
    
    if not refresh_token:
        return jsonify({"error": "Missing refresh_token"}), 400

    try:
        payload = JWTService.decode_token(refresh_token, check_blacklist=True)
        if payload.get('type') != 'refresh':
            return jsonify({"error": "Invalid token type"}), 403

        # Blacklist the old refresh token (Token Rotation)
        jti = payload.get('jti')
        exp = datetime.fromtimestamp(payload.get('exp'), tz=timezone.utc)
        blacklisted = TokenBlacklist(jti=jti, token_type='refresh', expires_at=exp)
        db.session.add(blacklisted)

        # Generate new pair
        user = User.query.get(payload.get('sub'))
        new_tokens = JWTService.generate_token_pair(user)
        db.session.commit()
        
        return jsonify(new_tokens), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 401

@auth_bp.route("/logout", methods=["POST", "GET"])
def logout():
    """
    Perform Global Logout (Single Sign-Out).
    Invalidates current session and notifies all connected child apps.
    """
    user_id = session.get("user_id")

    # 1. Blacklist token if provided in header (to invalidate immediate API access)
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            payload = JWTService.decode_token(token, check_blacklist=False)
            jti = payload.get('jti')
            exp = datetime.fromtimestamp(payload.get('exp'), tz=timezone.utc)
            
            from app import db
            if not TokenBlacklist.is_blacklisted(jti):
                revoked = TokenBlacklist(jti=jti, token_type=payload.get('type'), expires_at=exp)
                db.session.add(revoked)
                db.session.commit()
                
            # Use user_id from token if session is missing (API-based logout)
            if not user_id:
                user_id = payload.get('sub')
        except:
            pass

    # 2. Trigger Global Logout (Webhooks to all child apps)
    if user_id:
        from app.services.webhook_service import WebhookService
        from app.utils.logger import log_event
        
        user = User.query.get(user_id)
        if user:
            log_event("USER_LOGOUT_GLOBAL", f"Global Logout triggered for {user.username}.", user_id=user.id)
            # This handles both blacklisting tracked JTIs and calling webhooks
            WebhookService.notify_all_active_sessions(user_id)

    # 3. Clear CentralAuth browser session
    session.pop("user_id", None)
    
    if request.is_json:
        return jsonify({"message": "Global Logout successful"}), 200
        
    flash("Đã đăng xuất khỏi toàn bộ hệ thống.", "info")
    return redirect(url_for("auth.login"))
# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify, redirect, current_app, render_template, flash, url_for, session
from app import db
from app.models.user import User
from app.models.client import Client
from app.services.jwt_service import JWTService
from flask_cors import cross_origin
from urllib.parse import urlparse
from sqlalchemy import or_

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
        "login_endpoint": f"{base_url}/api/auth/login",
        "verify_endpoint": f"{base_url}/api/auth/verify-token",
        "health_endpoint": f"{base_url}/api/auth/health",
        "discovery_version": "1.0"
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
        payload = JWTService.decode_token(token)
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

@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON format"}), 400

        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        full_name = data.get("full_name")

        if not all([username, email, password, full_name]):
            return jsonify({"error": "Missing required fields"}), 400

        if User.query.filter(or_(User.username == username, User.email == email)).first():
            return jsonify({"error": "Username or Email already exists"}), 409

        new_user = User(username=username, email=email, full_name=full_name)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return jsonify({"message": "User registered successfully", "id": new_user.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@auth_bp.route("/login", methods=["POST", "GET"])
@cross_origin()
def login():
    return_to = request.args.get("return_to")
    
    if request.method == "GET":
        # Check if user is already logged in to CentralAuth via session
        if "user_id" in session:
            user = User.query.get(session["user_id"])
            if user and user.is_active:
                if return_to:
                    # Silent SSO: Automatically generate token and redirect back
                    token = JWTService.generate_token(user)
                    from app.utils.logger import log_event
                    log_event("USER_LOGIN_SILENT", f"User {user.username} logged into app via existing session.", user_id=user.id)
                    
                    separator = "&" if "?" in return_to else "?"
                    return redirect(f"{return_to}{separator}token={token}&user_id={user.id}")
                
                # If no return_to, just go to success portal
                return redirect(url_for("index"))
                
        return render_template("auth/login.html")

    # Handle both JSON (API) and Form (UI) data
    if request.is_json:
        data = request.get_json()
        login_id = data.get("username") or data.get("email")
        password = data.get("password")
    else:
        login_id = request.form.get("login_id")
        password = request.form.get("password")

    if not login_id or not password:
        if request.is_json:
            return jsonify({"error": "Missing credentials"}), 400
        flash("Vui lòng nhập tài khoản và mật khẩu.", "danger")
        return redirect(url_for("auth.login", return_to=return_to))

    user = User.query.filter(or_(User.username == login_id, User.email == login_id)).first()
    
    if not user or not user.check_password(password):
        from app.utils.logger import log_event
        log_event("FAILED_LOGIN", f"Login attempt failed for username: {login_id}")
        if request.is_json:
            return jsonify({"error": "Invalid credentials"}), 401
        flash("Tài khoản hoặc mật khẩu không chính xác.", "danger")
        return redirect(url_for("auth.login", return_to=return_to))

    if not user.is_active:
        if request.is_json:
            return jsonify({"error": "Account is disabled"}), 403
        flash("Tài khoản đã bị vô hiệu hóa.", "danger")
        return redirect(url_for("auth.login", return_to=return_to))

    token = JWTService.generate_token(user)

    from app.utils.logger import log_event
    log_event("USER_LOGIN", f"User {user.username} logged in successfully.", user_id=user.id)

    if return_to:
        separator = "&" if "?" in return_to else "?"
        redirect_url = f"{return_to}{separator}token={token}&user_id={user.id}"
        return redirect(redirect_url)

    # For browser-based form submission without return_to, show success page
    if not request.is_json:
        session["user_id"] = user.id
        return render_template("auth/success.html", user=user, token=token)

    return jsonify({"access_token": token, "user": user.to_dict()}), 200

@auth_bp.route("/logout")
def logout():
    session.pop("user_id", None)
    flash("Bạn đã đăng xuất thành công.", "info")
    return redirect(url_for("auth.login"))
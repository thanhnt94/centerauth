from flask import Blueprint, render_template, request, redirect, url_for, flash, session
from app.models.client import Client
from app.models.user import User
from app import db

admin_bp = Blueprint("admin", __name__)

@admin_bp.before_request
def restrict_admin_access():
    """Ensure that only the base 'admin' user can access these routes."""
    user_id = session.get("user_id")
    if not user_id:
        flash("Vui lòng đăng nhập để tiếp tục.", "danger")
        return redirect(url_for("auth.login"))
    user = User.query.get(session["user_id"])
    if not user or not user.is_admin:
        flash("Bạn không có quyền truy cập trang này.", "danger")
        return redirect(url_for("auth.login"))

@admin_bp.route("/")
def dashboard():
    clients = Client.query.order_by(Client.created_at.desc()).all()
    return render_template("admin/dashboard.html", clients=clients)

@admin_bp.route("/users")
def users():
    users_list = User.query.order_by(User.created_at.desc()).all()
    return render_template("admin/users.html", users=users_list)

@admin_bp.route("/users/edit/<id>", methods=["POST"])
def edit_user(id):
    user = User.query.get(id)
    if not user:
        flash("Người dùng không tồn tại.", "danger")
        return redirect(url_for("admin.users"))
        
    full_name = request.form.get("full_name")
    email = request.form.get("email")
    avatar_url = request.form.get("avatar_url")
    is_active = request.form.get("is_active") == "on"
    
    user.full_name = full_name
    user.email = email
    user.avatar_url = avatar_url
    user.is_active = is_active
    
    try:
        db.session.commit()
        from app.utils.logger import log_event
        log_event("USER_EDITED", f"Admin updated user {user.username} (id={user.id})")
        flash(f"Đã cập nhật người dùng {user.username} thành công!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Lỗi khi cập nhật người dùng: {str(e)}", "danger")
        
    return redirect(url_for("admin.users"))

@admin_bp.route("/logs")
def logs():
    from app.models.audit_log import AuditLog
    logs_list = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
    return render_template("admin/logs.html", logs=logs_list)

@admin_bp.route("/settings", methods=["GET", "POST"])
def settings():
    from app.models.settings import SystemSetting
    
    if request.method == "POST":
        for key, value in request.form.items():
            setting = SystemSetting.query.get(key)
            if setting:
                setting.value = value
        try:
            db.session.commit()
            from app.utils.logger import log_event
            log_event("SETTINGS_UPDATED", "System settings updated by admin.")
            flash("Đã cập nhật cài đặt hệ thống thành công!", "success")
        except Exception as e:
            db.session.rollback()
            flash(f"Lỗi khi cập nhật cài đặt: {str(e)}", "danger")
        return redirect(url_for("admin.settings"))

    settings_list = SystemSetting.query.all()
    # Group by category
    categories = {}
    for s in settings_list:
        cat = s.category or "Tổng quan"
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(s)
        
    return render_template("admin/settings.html", categories=categories)

@admin_bp.route("/clients/add", methods=["POST"])
def add_client():
    name = request.form.get("name")
    client_id = request.form.get("client_id")
    client_secret = request.form.get("client_secret")
    redirect_uri = request.form.get("redirect_uri")
    
    if not all([name, client_id, client_secret, redirect_uri]):
        flash("Vui lòng điền đầy đủ thông tin.", "danger")
        return redirect(url_for("admin.dashboard"))
        
    if Client.query.filter_by(client_id=client_id).first():
        flash("Client ID này đã tồn tại.", "danger")
        return redirect(url_for("admin.dashboard"))
        
    new_client = Client(
        name=name,
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        backchannel_logout_uri=request.form.get("backchannel_logout_uri"),
        app_icon=request.form.get("app_icon", "fas fa-rocket"),
        app_description=request.form.get("app_description"),
        app_color_theme=request.form.get("app_color_theme", "indigo"),
        is_visible_on_portal=request.form.get("is_visible_on_portal") == "on" if request.form.get("is_visible_on_portal") is not None else True,
        is_active=True # Default to active on creation
    )
    
    try:
        db.session.add(new_client)
        db.session.commit()
        from app.utils.logger import log_event
        log_event("CLIENT_ADDED", f"New client {name} (ID: {client_id}) added.")
        flash(f"Đã thêm client {name} thành công!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Lỗi khi lưu client: {str(e)}", "danger")
        
    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/clients/edit/<id>", methods=["POST"])
def edit_client(id):
    client = Client.query.get(id)
    if not client:
        flash("Client không tồn tại.", "danger")
        return redirect(url_for("admin.dashboard"))
        
    client.name = request.form.get("name")
    client.client_secret = request.form.get("client_secret")
    client.redirect_uri = request.form.get("redirect_uri")
    client.backchannel_logout_uri = request.form.get("backchannel_logout_uri")
    client.app_icon = request.form.get("app_icon")
    client.app_description = request.form.get("app_description")
    client.app_color_theme = request.form.get("app_color_theme")
    client.is_visible_on_portal = request.form.get("is_visible_on_portal") == "on"
    client.is_active = request.form.get("is_active") == "on"
    
    try:
        db.session.commit()
        from app.utils.logger import log_event
        log_event("CLIENT_EDITED", f"Admin updated client {client.name} (ID: {client.client_id})")
        flash(f"Đã cập nhật client {client.name} thành công!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Lỗi khi cập nhật client: {str(e)}", "danger")
        
    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/clients/delete/<id>", methods=["POST"])
def delete_client(id):
    client = Client.query.get(id)
    if not client:
        flash("Client không tồn tại.", "danger")
        return redirect(url_for("admin.dashboard"))
        
    try:
        db.session.delete(client)
        db.session.commit()
        from app.utils.logger import log_event
        log_event("CLIENT_DELETED", f"Admin deleted client {client.name} (ID: {client.client_id})")
        flash(f"Đã xóa client {client.name} thành công!", "success")
    except Exception as e:
        db.session.rollback()
        flash(f"Lỗi khi xóa client: {str(e)}", "danger")
        
    return redirect(url_for("admin.dashboard"))

@admin_bp.route("/api/client/ping/<id>")
def ping_client(id):
    """Check if the client application is reachable using standardized health checks."""
    client = Client.query.get(id)
    if not client:
        return {"status": "error", "message": "Client not found"}, 404
        
    import urllib.request
    from urllib.parse import urlparse
    import socket
    
    # Try to extract base URL from redirect_uri
    try:
        parsed = urlparse(client.redirect_uri)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # WE TRY TWO STRATEGIES:
        # 1. Standardized Health API (Fastest and more reliable)
        # 2. Base URL fallback (Legacy)
        
        health_url = f"{base_url}/api/health"
        
        def check_url(url, timeout=5.0):
            req = urllib.request.Request(url, headers={'User-Agent': 'CentralAuth-HealthCheck/2.0'})
            try:
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    # Status < 400 means success (200, 301, 302, etc. are followed and resolved)
                    if response.status < 400:
                        return True, f"Connected to {url}"
            except Exception as e:
                return False, str(e)
            return False, "Unknown Error"

        # Strategy 1: /api/health
        success, msg = check_url(health_url, timeout=3.0)
        if success:
            return {"status": "online", "message": f"Verified via {health_url}"}
            
        # Strategy 2: Base URL fallback
        success, msg = check_url(base_url, timeout=5.0)
        if success:
            return {"status": "online", "message": f"Verified via {base_url} (Redirect followed)"}
            
        return {"status": "offline", "message": msg}
            
    except Exception as e:
        return {"status": "offline", "message": str(e)}

# --- User Synchronization Routes ---

@admin_bp.route("/sync")
def sync_dashboard():
    """Renders the User Synchronization Dashboard."""
    return render_template("admin/sync_dashboard.html")

@admin_bp.route("/api/sync/scan")
def api_sync_scan():
    """Performs a full ecosystem user scan and returns the report as JSON."""
    from app.services.sync_service import SyncService
    try:
        report = SyncService.get_sync_report()
        return {"status": "success", "report": report}, 200
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@admin_bp.route("/api/sync/execute", methods=["POST"])
def api_sync_execute():
    """Executes a specific sync action (e.g., Reverse Sync)."""
    from app.services.sync_service import SyncService
    data = request.get_json()
    action = data.get("action")
    
    if action == "sync_admin":
        results = SyncService.sync_admin_to_all_clients()
        return {"status": "success", "results": results}, 200
    # Other actions require client_id
    client_id = data.get("client_id")
    email = data.get("email")
    username = data.get("username")
    
    if not action or not client_id:
        return {"status": "error", "message": "Missing required parameters"}, 400
        
    if action == "reverse_sync":
        success, result = SyncService.reverse_sync_user(client_id, email)
        if success:
            from app.utils.logger import log_event
            log_event("USER_SYNC_REVERSE", f"User {email} synced from {client_id} to CentralAuth.")
            return {"status": "success", "message": f"User {email} synced successfully", "data": result}, 200
        else:
            return {"status": "error", "message": result}, 500
    
    elif action == "link_user":
        ca_id = data.get("central_auth_id")
        import sys
        print(f"[LINK-DEBUG] Full data received: {data}", file=sys.stderr, flush=True)
        print(f"[LINK-DEBUG] ca_id = '{ca_id}' (type={type(ca_id).__name__})", file=sys.stderr, flush=True)
        if not ca_id:
            return {"status": "error", "message": "Missing central_auth_id"}, 400
        success, result = SyncService.link_user(client_id, email, ca_id)
        if success:
            from app.utils.logger import log_event
            log_event("USER_LINK", f"User {email} linked to CA ID {ca_id} in {client_id}.")
            return {"status": "success", "message": f"User {email} linked successfully"}, 200
        else:
            return {"status": "error", "message": result}, 500
            
    elif action == "delete_user":
        success, result = SyncService.delete_remote_user(client_id, email, username)
        if success:
            from app.utils.logger import log_event
            log_event("USER_DELETE_REMOTE", f"User {username or email} deleted from {client_id}.")
            return {"status": "success", "message": f"Đã xoá {username or email} khỏi {client_id}"}, 200
        else:
            return {"status": "error", "message": result}, 500

    return {"status": "error", "message": "Unsupported action"}, 400
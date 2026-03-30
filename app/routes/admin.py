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
        is_visible_on_portal=request.form.get("is_visible_on_portal") == "on"
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
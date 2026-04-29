from flask import Blueprint, jsonify, request, session
from app.models.client import Client
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.settings import SystemSetting
from app import db
from .admin import restrict_admin_access # Reuse the same restriction logic

admin_api_bp = Blueprint("admin_api", __name__)

@admin_api_bp.before_request
def check_admin():
    return restrict_admin_access()

@admin_api_bp.route("/clients", methods=["GET"])
def list_clients():
    clients = Client.query.order_by(Client.created_at.desc()).all()
    return jsonify([c.to_dict() for c in clients])

@admin_api_bp.route("/users", methods=["GET"])
def list_users():
    users_list = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users_list])

@admin_api_bp.route("/users/<id>", methods=["PUT"])
def update_user(id):
    user = User.query.get(id)
    if not user:
        return jsonify({"success": False, "message": "Người dùng không tồn tại"}), 404
        
    data = request.get_json()
    if 'full_name' in data: user.full_name = data['full_name']
    if 'email' in data: user.email = data['email']
    if 'role' in data: 
        user.role = data['role']
        user.is_admin = data['role'] == 'admin'
    if 'is_active' in data: user.is_active = data['is_active']
    
    try:
        db.session.commit()
        from app.utils.logger import log_event
        log_event("USER_EDITED", f"Admin updated user {user.username} via API (id={user.id})")
        return jsonify({"success": True, "message": "Cập nhật thành công!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@admin_api_bp.route("/logs", methods=["GET"])
def list_logs():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(100).all()
    # Use the model's to_dict() to ensure null-safety on deleted users
    result = []
    for l in logs:
        d = l.to_dict()
        # The frontend expects 'action' instead of 'event'
        d['action'] = d.pop('event', 'UNKNOWN')
        result.append(d)
    return jsonify(result)


@admin_api_bp.route("/settings", methods=["GET", "POST"])
def manage_settings():
    if request.method == "POST":
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400
            
        settings_updated = 0
        for key, value in data.items():
            setting = SystemSetting.query.get(key)
            if setting:
                setting.value = str(value)
                settings_updated += 1
                
        try:
            db.session.commit()
            from app.utils.logger import log_event
            log_event("SETTINGS_UPDATED", f"Admin updated {settings_updated} system settings via API.")
            return jsonify({"success": True, "message": "Cập nhật thành công!"})
        except Exception as e:
            db.session.rollback()
            return jsonify({"success": False, "message": str(e)}), 500

    settings_list = SystemSetting.query.all()
    return jsonify([{'key': s.key, 'value': s.value, 'description': s.description, 'category': s.category} for s in settings_list])
@admin_api_bp.route("/clients/<int:id>", methods=["PUT"])
def update_client(id):
    client = Client.query.get(id)
    if not client:
        return jsonify({"success": False, "message": "Client không tồn tại"}), 404
        
    data = request.get_json()
    if 'name' in data: client.name = data['name']
    if 'client_secret' in data: client.client_secret = data['client_secret']
    if 'redirect_uri' in data: client.redirect_uri = data['redirect_uri']
    if 'backchannel_logout_uri' in data: client.backchannel_logout_uri = data['backchannel_logout_uri']
    if 'app_icon' in data: client.app_icon = data['app_icon']
    if 'app_description' in data: client.app_description = data['app_description']
    if 'app_color_theme' in data: client.app_color_theme = data['app_color_theme']
    if 'is_visible_on_portal' in data: client.is_visible_on_portal = data['is_visible_on_portal']
    if 'is_active' in data: client.is_active = data['is_active']
    
    try:
        db.session.commit()
        from app.utils.logger import log_event
        log_event("CLIENT_EDITED", f"Admin updated client {client.name} via API (ID: {client.client_id})")
        return jsonify({"success": True, "message": "Cập nhật thành công!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@admin_api_bp.route("/clients/<int:id>", methods=["DELETE"])
def delete_client(id):
    client = Client.query.get(id)
    if not client:
        return jsonify({"success": False, "message": "Client không tồn tại"}), 404
        
    try:
        db.session.delete(client)
        db.session.commit()
        from app.utils.logger import log_event
        log_event("CLIENT_DELETED", f"Admin deleted client {client.name} via API (ID: {client.client_id})")
        return jsonify({"success": True, "message": "Xóa thành công!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@admin_api_bp.route("/clients/<int:id>/push", methods=["POST"])
def push_to_client(id):
    client = Client.query.get(id)
    if not client:
        return jsonify({"success": False, "message": "Client không tồn tại"}), 404
        
    # All our apps use the same convention: /api/admin/ecosystem-sync
    # We use the FIRST redirect URI as the base URL
    base_url = client.redirect_uri.split(',')[0].split('/auth-center/callback')[0].rstrip('/')
    sync_url = f"{base_url}/api/admin/ecosystem-sync"
    
    # Fetch all identities to sync
    all_users = User.query.filter_by(is_active=True).all()
    users_payload = [
        {
            "username": u.username,
            "email": u.email,
            "full_name": u.full_name,
            "role": "admin" if u.is_admin else "free"
        } for u in all_users
    ]

    payload = {
        "hub_secret": client.client_secret,
        "server_address": request.host_url.rstrip('/'),
        "client_id": client.client_id,
        "client_secret": client.client_secret,
        "users": users_payload
    }
    
    try:
        import requests
        r = requests.post(sync_url, json=payload, timeout=5)
        if r.ok:
            return jsonify({"success": True, "message": "Đồng bộ Hub -> Client thành công!"})
        else:
            return jsonify({"success": False, "message": f"Client từ chối đồng bộ: {r.text}"}), r.status_code
    except Exception as e:
        return jsonify({"success": False, "message": f"Không thể kết nối tới Client: {str(e)}"}), 500

@admin_api_bp.route("/ping-client", methods=["POST"])
def ping_client():
    """Verify if a remote client application is reachable and correctly configured."""
    data = request.get_json()
    base_url = data.get("base_url")
    if not base_url:
        return jsonify({"success": False, "message": "Missing base_url"}), 400
    
    import requests
    try:
        # Most Mindstack satellite apps have a health check endpoint
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            return jsonify({"success": True, "message": "Client is Online & Healthy"})
        return jsonify({"success": False, "message": f"Client returned status {response.status_code}"})
    except Exception as e:
        return jsonify({"success": False, "message": f"Connection Failed: {str(e)}"})

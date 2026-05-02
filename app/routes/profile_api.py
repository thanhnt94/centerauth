# -*- coding: utf-8 -*-
from flask import Blueprint, jsonify, request, session, current_app
from app.models.user import User
from app import db
import os
from werkzeug.utils import secure_filename

profile_api_bp = Blueprint("profile_api", __name__)

def allowed_file(filename):
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]

@profile_api_bp.route("/me", methods=["GET"])
def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    user = User.query.get(user_id)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    return jsonify(user.to_dict())

@profile_api_bp.route("/update", methods=["POST"])
def update_profile():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    user = User.query.get(user_id)
    data = request.get_json() or {}
    
    if 'full_name' in data: user.full_name = data['full_name']
    if 'email' in data: user.email = data['email']
    
    # Password Change
    if 'old_password' in data and 'new_password' in data:
        if not user.check_password(data['old_password']):
            return jsonify({"success": False, "message": "Mật khẩu cũ không chính xác"}), 400
        user.set_password(data['new_password'])
    
    try:
        db.session.commit()
        return jsonify({"success": True, "message": "Cập nhật thành công!"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@profile_api_bp.route("/avatar", methods=["POST"])
def upload_avatar():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    if "avatar" not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
        
    file = request.files["avatar"]
    user = User.query.get(user_id)
    
    if file and file.filename != "" and allowed_file(file.filename):
        ext = file.filename.rsplit(".", 1)[1].lower()
        filename = secure_filename(f"{user.id}_{os.urandom(4).hex()}.{ext}")
        file_path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
        
        file.save(file_path)
        user.avatar_url = f"/static/uploads/avatars/{filename}"
        db.session.commit()
        
        return jsonify({"success": True, "avatar_url": user.avatar_url})
    
    return jsonify({"success": False, "message": "Invalid file type"}), 400

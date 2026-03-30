# -*- coding: utf-8 -*-
from flask import Blueprint, render_template, request, redirect, url_for, flash, session, current_app
from app.models.user import User
from app import db
import os
from werkzeug.utils import secure_filename

user_bp = Blueprint("user", __name__)

def allowed_file(filename):
    return "." in filename and \
           filename.rsplit(".", 1)[1].lower() in current_app.config["ALLOWED_EXTENSIONS"]

@user_bp.route("/profile", methods=["GET", "POST"])
def profile():
    user_id = session.get("user_id")
    if not user_id:
        flash("Vui lòng đăng nhập để tiếp tục.", "danger")
        return redirect(url_for("auth.login"))
        
    user = User.query.get(user_id)
    if not user:
        flash("Người dùng không tồn tại.", "danger")
        session.pop("user_id", None)
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        full_name = request.form.get("full_name")
        email = request.form.get("email")
        old_password = request.form.get("old_password")
        new_password = request.form.get("new_password")
        confirm_password = request.form.get("confirm_password")
        
        # 1. Update basic info
        user.full_name = full_name
        user.email = email
        
        # 2. Update password if provided
        if old_password and new_password:
            if not user.check_password(old_password):
                flash("Mật khẩu cũ không chính xác.", "danger")
            elif new_password != confirm_password:
                flash("Mật khẩu mới không khớp.", "danger")
            else:
                user.set_password(new_password)
                flash("Đã đổi mật khẩu thành công!", "success")

        # 3. Handle Avatar Upload
        if "avatar" in request.files:
            file = request.files["avatar"]
            if file and file.filename != "" and allowed_file(file.filename):
                # Secure unique filename: [user_id].[ext]
                ext = file.filename.rsplit(".", 1)[1].lower()
                filename = secure_filename(f"{user.id}.{ext}")
                file_path = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
                
                # Save file
                file.save(file_path)
                
                # Update DB - relative path for UI
                user.avatar_url = f"/static/uploads/avatars/{filename}"
                from app.utils.logger import log_event
                log_event("AVATAR_UPLOAD", f"User uploaded new avatar: {filename}")
                flash("Đã cập nhật ảnh đại diện!", "success")

        try:
            db.session.commit()
            from app.utils.logger import log_event
            log_event("PROFILE_UPDATE", f"User updated their profile details.")
            flash("Đã cập nhật thông tin thành công!", "success")
        except Exception as e:
            db.session.rollback()
            flash(f"Lỗi khi lưu thông tin: {str(e)}", "danger")
            
        return redirect(url_for("user.profile"))

    return render_template("user/profile.html", user=user)

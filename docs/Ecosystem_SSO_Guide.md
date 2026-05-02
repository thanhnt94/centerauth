# 🔐 Hướng dẫn Tích hợp CentralAuth SSO (Mindstack Ecosystem)

Tài liệu này hướng dẫn cách kết nối một ứng dụng vệ tinh (Satellite App) vào hệ thống xác thực tập trung **CentralAuth** sử dụng giao thức chuẩn hóa của Mindstack.

---

## 🚀 1. Đăng ký Ứng dụng mới (CentralAuth Dashboard)

Để bắt đầu, bạn cần đăng ký ứng dụng của mình trên Portal của CentralAuth:

1. Truy cập **CentralAuth Portal** -> **Clients**.
2. Nhấn **Register New Client**.
3. Nhập các thông tin cơ bản:
   - **App Name**: Tên ứng dụng của bạn (ví dụ: `QuizMind`).
   - **App URL**: Địa chỉ chạy app của bạn (ví dụ: `https://quiz.mindstack.click`).
4. **Zero Config**: Hệ thống sẽ tự động điền các link `Redirect URIs` và `Backchannel Logout` theo chuẩn.
5. Nhấn **Save Changes**.
6. **Lưu lại**: Copy `Client ID` và `Client Secret` để dùng ở bước tiếp theo.

---

## 📦 2. Tích hợp vào Code (Satellite App)

Mọi ứng dụng trong hệ sinh thái đều sử dụng chung một file helper chuẩn là `ecosystem_sso.py`.

### Bước A: Copy Helper
Copy file `ecosystem_sso.py` vào thư mục `app/core/utils/` của dự án mới.

### Bước B: Khởi tạo trong `services/sso_service.py`
Tạo một service để quản lý logic SSO:

```python
from app.core.utils.ecosystem_sso import create_sso_blueprint

def setup_sso(app):
    # Lấy cấu hình từ Settings hoặc Env
    server_url = "https://auth.mindstack.click"
    client_id = "your-client-id"
    client_secret = "your-client-secret"

    # Callback khi user login thành công từ SSO
    def on_user_provision(user_data, tokens):
        # Logic: Tìm user trong DB local, nếu chưa có thì tạo mới (JIT Provisioning)
        # user_data chứa: id, username, email, full_name, role...
        return user_object

    # Callback điều hướng sau khi login thành công
    def on_login_success(user, tokens):
        # Logic: Lưu session/JWT local và redirect về Dashboard
        return redirect('/')

    # Khởi tạo Blueprint
    sso_bp, sso_auth = create_sso_blueprint(
        server_url, client_id, client_secret,
        on_user_provision, on_login_success
    )
    
    app.register_blueprint(sso_bp)
```

---

## 🛠️ 3. Các Endpoint chuẩn hóa

Khi tích hợp `ecosystem_sso`, app của bạn sẽ tự động có các route sau:

1.  **`/auth-center/login`**: Link để người dùng nhấn vào khi muốn login qua SSO.
2.  **`/auth-center/callback`**: Nơi nhận "Code" từ CentralAuth và đổi lấy thông tin User.
3.  **`/auth-center/webhook/backchannel-log`**: Nhận tín hiệu đăng xuất toàn cục (Global Logout).

---

## ⚡ 4. Tính năng Auto-Jump (Một chạm)

Khi người dùng đang ở CentralAuth Portal, họ có thể nhấn vào icon App của bạn để tự động đăng nhập.

- **Cơ chế**: CentralAuth sẽ gọi tới `/auth-center/login` của app vệ tinh kèm theo một mã token tạm thời.
- **Yêu cầu**: App vệ tinh phải để chế độ `visibility = public` trong cấu hình Client trên CentralAuth.

---

## 💡 Lưu ý quan trọng

1.  **HTTPS**: Trong môi trường Production, luôn đảm bảo cả CentralAuth và App vệ tinh đều chạy HTTPS.
2.  **Đồng bộ Role**: Role từ CentralAuth sẽ được gửi kèm trong `user_data`. Hãy map chúng tương ứng với hệ thống phân quyền local của app.
3.  **Username Collision**: Khi JIT Provisioning, nếu username đã tồn tại nhưng email khác nhau, hãy ưu tiên dùng Email làm định danh duy nhất.

---
*Tài liệu này thuộc hệ sinh thái Mindstack - Bảo mật & Tốc độ.*

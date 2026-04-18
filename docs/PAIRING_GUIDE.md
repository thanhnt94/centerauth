# ⚡ Mindstack Power Pairing Guide

Chào mừng bạn đến với hệ thống **Power Pairing**. Đây là phương thức chuẩn hóa để kết nối bất kỳ ứng dụng vệ tinh (Satellite App) nào vào hệ thống định danh trung tâm **Central Auth**.

---

## 1. Đăng ký Client mới
Trước khi bắt đầu code, bạn cần đăng ký ứng dụng của mình trong Central Auth Studio:
1. Truy cập **Admin Studio** -> **Clients**.
2. Nhấn **+ New Client**.
3. Điền thông tin:
   - **Name**: Tên ứng dụng (ví dụ: `PodLearn`).
   - **Redirect URI**: URL mà Central Auth sẽ gửi `code` về sau khi đăng nhập thành công (ví dụ: `http://localhost:5001/auth/callback`).
   - **Base URL**: URL gốc của ứng dụng để hệ thống kiểm tra trạng thái (ví dụ: `http://localhost:5001`).

Sau khi lưu, bạn sẽ nhận được **Client ID** và **Client Secret**. **Hãy giữ bí mật Client Secret!**

---

## 2. Sử dụng EcosystemAuth Helper (Python)

Cách nhanh nhất để tích hợp là sử dụng class `EcosystemAuth` đã được viết sẵn trong `app/utils/sso_helper.py`.

### Cấu hình
```python
from app.utils.sso_helper import EcosystemAuth

sso = EcosystemAuth(
    server_url="http://127.0.0.1:5000",
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET"
)
```

### Bước A: Chuyển hướng đăng nhập
Khi người dùng nhấn "Login with Central Auth", hãy chuyển hướng họ đến:
```python
@app.route('/login')
def login():
    # Central Auth sẽ trả về code tại callback_url này
    callback_url = "http://localhost:5001/auth/callback"
    return redirect(sso.get_login_url(callback_url))
```

### Bước B: Xử lý Callback
Tại ứng dụng của bạn, tạo route để nhận `code` và đổi lấy thông tin người dùng:
```python
@app.route('/auth/callback')
def callback():
    code = request.args.get('code')
    result = sso.handle_callback(code)

    if result['success']:
        user_info = result['user']
        # Dữ liệu bao gồm: user_info['username'], user_info['email'], v.v.
        # Ở đây bạn có thể tạo session local hoặc lưu vào DB của satellite app
        session['user'] = user_info
        return redirect('/')
    else:
        return f"Lỗi đăng nhập: {result['error']}"
```

---

## 3. Kiểm tra kết nối (Check Pair)
Sau khi cài đặt xong, bạn có thể quay lại **Central Auth Studio** và nhấn nút **Check Connection** (biểu tượng sóng) trên Client của bạn.
- Hệ thống sẽ gửi một request `GET /health` đến ứng dụng của bạn.
- Nếu app của bạn trả về `200 OK`, trạng thái sẽ hiển thị là **Online & Healthy**.

---

## 4. Bảo mật & Best Practices
- **Token Rotation**: Hệ thống tự động xoay vòng Refresh Token để bảo mật.
- **UUID Mapping**: Luôn sử dụng UUID từ Central Auth để định danh người dùng trong Satellite App thay vì dùng ID tăng tự động.
- **Global Logout**: Khi người dùng đăng xuất tại Central Auth, hệ thống sẽ gửi tín hiệu để đăng xuất họ ở tất cả các App vệ tinh khác.

---
*Mindstack Ecosystem - Secure. Seamless. Unified.*

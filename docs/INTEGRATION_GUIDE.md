# CentralAuth Ecosystem: Professional Integration Guide (Modular Architecture)

Tài liệu này hướng dẫn cách tích hợp CentralAuth vào các ứng dụng trong hệ sinh thái (MindStack, PodLearn, IPTV Manager) theo kiến trúc **Module hóa**.

## 1. Kiến trúc Hai Module (The Two-Module Pattern)

Để đảm bảo tính linh hoạt, mỗi ứng dụng nên chia hệ thống xác thực thành 2 phần riêng biệt:

-   **Module `auth`**: Quản lý đăng nhập/đăng ký bằng tài khoản nội bộ (Local Database).
-   **Module `auth_center`**: Quản lý toàn bộ việc "đối ngoại" với CentralAuth (SSO).

---

## 2. Cấu trúc Module `auth_center`

Đây là module bạn có thể "Copy-Paste" sang các dự án mới. Cấu trúc gợi ý:

```text
modules/auth_center/
├── services/
│   ├── central_auth_client.py  # SDK gốc giao tiếp API
│   └── sso_service.py          # Logic nghiệp vụ (Verify, Provisioning)
├── routes/
│   └── views.py                # Các endpoint /login, /callback
└── __init__.py                 # Khai báo Blueprint /auth-center
```

### A. SDK: `central_auth_client.py`
Đây là bộ khung xử lý HTTP. Nó không phụ thuộc vào Database của ứng dụng.

```python
import requests

class CentralAuthClient:
    def __init__(self, api_url, web_url=None):
        self.api_url = api_url.rstrip('/')
        self.web_url = (web_url or api_url).rstrip('/')

    def get_login_url(self, callback_url):
        connector = '&' if '?' in self.web_url else '?'
        return f"{self.web_url}/api/auth/login{connector}return_to={callback_url}"

    def verify_token(self, token):
        response = requests.get(
            f"{self.api_url}/api/auth/verify-token",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        return response.json().get('user') if response.status_code == 200 else None
```

### B. Logic đồng bộ: `sso_service.py`
Nơi bạn thực hiện **JIT Provisioning** (Tạo tài khoản "bóng" cục bộ khi người dùng đăng nhập từ SSO).

```python
def provision_user(user_payload):
    # 1. Tìm user theo central_auth_id hoặc email
    user = User.query.filter_by(central_auth_id=user_payload['id']).first()
    
    if not user:
        # 2. Tạo mới nếu chưa có
        user = User(
            username=user_payload['username'],
            email=user_payload['email'],
            central_auth_id=user_payload['id'],
            full_name=user_payload.get('full_name'),
            avatar_url=user_payload.get('avatar_url')
        )
        db.session.add(user)
    else:
        # 3. Cập nhật thông tin nếu đã có (Đồng bộ Profile)
        user.full_name = user_payload.get('full_name', user.full_name)
        user.avatar_url = user_payload.get('avatar_url', user.avatar_url)
        
    db.session.commit()
    return user
```

---

## 3. Luồng xác thực SSO (The Handshake)

### Bước 1: Khởi tạo đăng nhập
Thay vì dùng form login local, ứng dụng điều hướng người dùng sang CentralAuth:
`GET /auth-center/login` -> Redirect tới `http://central-auth.com/api/auth/login?return_to=http://myapp.com/auth-center/callback`

### Bước 2: Xử lý Callback
Sau khi đăng nhập thành công, CentralAuth gửi người dùng về kèm theo `token`:
`GET /auth-center/callback?token=ABC...`

Tại đây, `SSOService` sẽ:
1. Gửi token sang CentralAuth để kiểm tra tính hợp lệ.
2. Nhận về thông tin User (Payload).
3. Gọi `provision_user` để đăng nhập người dùng vào hệ thống cục bộ.

---

## 4. Đăng ký trên Admin Dashboard

Trước khi chạy, bạn phải đăng ký ứng dụng tại Dashboard của CentralAuth (`/admin/clients`):

> [!IMPORTANT]
> **Redirect URI** phải chính xác tuyệt đối. 
> Ví dụ: `http://127.0.0.1:5000/auth-center/callback`

---

## 5. Đồng bộ Avatar & Profile

- **Avatar**: `avatar_url` trả về từ CentralAuth có thể là đường dẫn tương đối. Hệ thống của bạn nên có logic tự động thêm Host của CentralAuth vào trước nếu cần.
- **Update Profile**: Luôn điều hướng người dùng sang trang thiết lập của CentralAuth để đổi Tên/Mật khẩu/Avatar nhằm đảm bảo tính nhất quán toàn hệ thống.

---
*Tài liệu này được cập nhật vào ngày 30/03/2026 cho phiên bản CentralAuth v2 (Modular).*

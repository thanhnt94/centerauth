# CentralAuth Ecosystem: Professional Integration Guide (V2)

Hệ thống CentralAuth sử dụng luồng **Authorization Code Flow** để đảm bảo an toàn cho việc xác thực giữa các ứng dụng trong hệ sinh thái Ecosystem.

## 1. Đăng ký Ứng dụng (Client Registration)

Trước khi tích hợp, bạn cần đăng ký ứng dụng trong trang Admin của CentralAuth:
- **Client ID**: Định danh duy nhất (ví dụ: `iptv-app`).
- **Client Secret**: Mã bí mật dùng để xác thực server-to-server.
- **Redirect URI**: URL mà CentralAuth sẽ chuyển hướng về sau khi login (phải khớp chính xác).
- **Backchannel Logout URI**: URL nhận thông báo đăng xuất từ CentralAuth.

---

## 2. Luồng Xác thực SSO (The SSO Handshake)

### Bước A: Chuyển hướng tới trang Login
Khi người dùng chưa đăng nhập, hãy chuyển hướng họ tới:
```
GET <CENTRAL_AUTH_URL>/api/auth/login?client_id=YOUR_ID&return_to=YOUR_CALLBACK
```

### Bước B: Nhận Authorization Code
CentralAuth sẽ chuyển hướng về callback của bạn với một mã `code` ngắn hạn:
```
GET YOUR_CALLBACK?code=AUTH_CODE_xyz
```

### Bước C: Đổi Code lấy Token (Server-to-Server)
Tại Backend của bạn, thực hiện request POST tới CentralAuth:
```python
# Ví dụ Python
response = requests.post(
    f"{CENTRAL_AUTH_URL}/api/auth/token",
    json={
        "code": "AUTH_CODE_xyz",
        "client_id": "YOUR_ID",
        "client_secret": "YOUR_SECRET"
    }
)
tokens = response.json()
# Kết quả: { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }
```

---

## 3. Quản lý Token & Làm mới (Refresh)

- **Access Token**: Gửi kèm trong Header `Authorization: Bearer <token>` mỗi khi gọi API.
- **Refresh Token**: Dùng để lấy Access Token mới khi cái cũ hết hạn.
- **Token Rotation**: Mỗi khi Refresh, bạn sẽ nhận được một cặp token mới hoàn toàn. Token cũ sẽ bị đưa vào danh sách đen.

---

## 4. Đăng xuất Toàn cầu (Single Sign-Out - SLO)

### Nhận thông báo Logout (Webhook)
CentralAuth sẽ gửi một yêu cầu POST tới `Backchannel Logout URI` của bạn khi người dùng đăng xuất khỏi hệ thống.

**Cấu trúc Request:**
- **Method**: `POST`
- **Body**: `{"logout_token": "JWT_TOKEN"}`

**Yêu cầu quan trọng:**
1.  **Xác thực Token**: Token được ký bằng `client_secret` của bạn. Bạn phải verify token này trước khi thực hiện logout cục bộ.
2.  **Bỏ chặn CSRF**: Vì đây là request server-to-server, bạn **PHẢI** cấu hình ngoại lệ (Exempt) CSRF cho endpoint này trong ứng dụng của mình.
    - *Flask*: Dùng decorator `@csrf.exempt`.
    - *Express*: Cấu hình middleware `csurf` để bỏ qua route này.

---

## 5. Cấu hình Môi trường (Best Practices)

> [!IMPORTANT]
> **KHÔNG** fix cứng địa chỉ IP `127.0.0.1` trong code. Hãy sử dụng biến môi trường:
> - `CENTRAL_AUTH_URL`: Địa chỉ gốc của hệ thống Auth.
> - `SSO_CLIENT_ID` / `SSO_CLIENT_SECRET`.

---
*Tài liệu này thuộc hệ sinh thái Ecosystem. Cập nhật: 2026-04-05*

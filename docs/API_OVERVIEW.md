# CentralAuth API Documentation (V2 - Official)

Hệ thống **CentralAuth** cung cấp các API endpoints để thực hiện xác thực tập trung theo giao thức OAuth2/OIDC. Toàn bộ các tương tác đều thông qua giao thức HTTPS (khuyên dùng) và JSON Web Tokens (JWT).

## Discovery (Tự cấu hình)

Các ứng dụng con nên sử dụng endpoint này để tự động lấy cấu hình các đầu cuối (endpoints) mà không cần cấu hình thủ công từng URL.

- **Endpoint**: `/api/auth/discovery`
- **Phương thức**: `GET`
- **Mô tả**: Trả về danh sách các URL cần thiết cho luồng đăng nhập, lấy token và xác thực.

---

## Luồng Xác thực (Authentication Flow)

### 1. Đăng nhập (UI Flow)
- **Endpoint**: `/api/auth/login`
- **Phương thức**: `GET`
- **Tham số bắt buộc**:
  - `client_id`: ID của ứng dụng con (đăng ký trong Admin).
  - `return_to`: URL sẽ chuyển hướng về sau khi đăng nhập thành công.
- **Mô tả**: Hiển thị trang đăng nhập. Nếu đăng nhập thành công, CentralAuth sẽ chuyển hướng về `return_to?code=AUTH_CODE`.

### 2. Đổi mã lấy Token (Server-to-Server)
- **Endpoint**: `/api/auth/token`
- **Phương thức**: `POST` (JSON body)
- **Dữ liệu gửi lên**:
  ```json
  {
    "code": "AUTH_CODE_TU_BUOC_1",
    "client_id": "CLIENT_ID_CUA_BAN",
    "client_secret": "CLIENT_SECRET_CUA_BAN"
  }
  ```
- **Phản hồi thành công (200 OK)**:
  ```json
  {
    "access_token": "jwt-access-token",
    "refresh_token": "jwt-refresh-token",
    "expires_in": 3600
  }
  ```

### 3. Làm mới Token (Refresh Token)
- **Endpoint**: `/api/auth/refresh`
- **Phương thức**: `POST`
- **Dữ liệu gửi lên**: `{"refresh_token": "..."}`
- **Phản hồi**: Trả về cặp token mới (Token Rotation).

---

## Xác thực & Quản lý (Resource Access)

### 1. Xác thực Token (Token Validation)
- **Endpoint**: `/api/auth/verify-token`
- **Header**: `Authorization: Bearer <access_token>`
- **Phương thức**: `GET`
- **Phản hồi thành công**: Thông tin `user` (profile).

### 2. Đăng xuất Toàn cầu (Global Logout/SLO)
- **Endpoint**: `/api/auth/logout`
- **Header**: `Authorization: Bearer <access_token>` (Hoặc qua Session browser)
- **Phương thức**: `POST` hoặc `GET`
- **Mô tả**: Hủy session tại CentralAuth, đưa JWT vào danh sách đen (Blacklist) và gửi Webhook tới toàn bộ các ứng dụng con mà người dùng đang đăng nhập.

---

## Các chức năng khác

### Health Check
- **Endpoint**: `/api/auth/health`
- **Phương thức**: `GET`
- **Phản hồi**: `{"status": "ok"}`

### Đăng ký người dùng
- **Endpoint**: `/api/auth/register` (Nếu được bật)
- **Phương thức**: `POST`
- **Dữ liệu**: `username`, `email`, `password`, `full_name`.

---
*Cập nhật lần cuối: 2026-04-05*

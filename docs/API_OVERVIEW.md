# Tài liệu API (API Overview)

Hệ thống **CentralAuth** cung cấp các API endpoints để thực hiện đăng ký, đăng nhập và xác thực người dùng.

## Xác thực (Authentication)

### 1. Đăng ký người dùng
- **Endpoint**: `/api/auth/register`
- **Phương thức**: `POST`
- **Dữ liệu gửi lên (JSON)**:
  ```json
  {
    "username": "your_username",
    "email": "user@example.com",
    "password": "your_password",
    "full_name": "Full Name"
  }
  ```
- **Phản hồi thành công (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "id": "uuid-of-user"
  }
  ```
- **Phản hồi lỗi (409 Conflict)**: Email hoặc Username đã tồn tại.

### 2. Đăng nhập
- **Endpoint**: `/api/auth/login`
- **Phương thức**: `POST` (hoặc `GET` để hiển thị trang login UI)
- **Tham số tùy chọn (Query String)**: `return_to` (URL để chuyển hướng quay lại sau đăng nhập).
- **Dữ liệu gửi lên (JSON cho API)**:
  ```json
  {
    "username": "your_username_or_email",
    "password": "your_password"
  }
  ```
- **Phản hồi thành công (200 OK)**:
  ```json
  {
    "access_token": "jwt-token-here",
    "user": {
      "id": "uuid",
      "username": "...",
      "email": "...",
      "full_name": "...",
      "avatar_url": "...",
      "is_active": true,
      "created_at": "..."
    }
  }
  ```
- **Chuyển hướng (nếu có `return_to`)**: Sau khi đăng nhập thành công, trình duyệt sẽ được chuyển hướng tới `return_to?token=...&user_id=...`.

### 3. Xác thực Token
- **Endpoint**: `/api/auth/verify-token`
- **Phương thức**: `GET`
- **Header bắt buộc**: `Authorization: Bearer <jwt-token>`
- **Phản hồi thành công (200 OK)**:
  ```json
  {
    "status": "success",
    "user": {
      "id": "uuid",
      "username": "...",
      "email": "...",
      "full_name": "...",
      "avatar_url": "...",
      "is_active": true,
      "created_at": "..."
    }
  }
  ```
- **Phản hồi lỗi (401 Unauthorized)**: Token hết hạn hoặc không hợp lệ.

## Các chức năng khác

### Health Check
- **Endpoint**: `/api/auth/health`
- **Phương thức**: `GET`
- **Mô tả**: Kiểm tra trạng thái hoạt động của hệ thống Auth.

### Quản trị Client (Admin)
- **Endpoint**: `/admin/`
- **Phương thức**: `GET`
- **Mô tả**: Trang dashboard quản trị danh sách các client ứng dụng (Giao diện HTML).
- **Tạo Client mới**: `/admin/clients/add` (`POST` qua Form).

# Tài liệu Cơ sở dữ liệu (Database)

Hệ thống **CentralAuth** sử dụng SQLite làm hệ quản trị cơ sở dữ liệu chính, được quản lý thông qua SQLAlchemy ORM trong Flask.

## Cấu hình
- **File Database**: `CentralAuth.db` (nằm trong thư mục `/Storage/database/`).
- **URI**: `sqlite:/// (ecosystem_root)/Storage/database/CentralAuth.db`
- **Tự động khởi tạo**: Hệ thống sẽ tự tạo thư mục và tệp database nếu chúng chưa tồn tại.
- **Admin Mặc định**: Nếu database mới tinh, một tài khoản `admin` với mật khẩu `admin` sẽ được tự động tạo.
  - Username: `admin`
  - Password: `admin`
  - Email: `admin@ecosystem.local`

## Mô hình dữ liệu (Models)

### 1. User (Người dùng)
Lưu trữ thông tin tài khoản người dùng duy nhất trong toàn bộ hệ sinh thái.

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `String(36)` | PK, UUID | Định danh duy nhất (UUID v4) |
| `username` | `String(80)` | Unique, Indexed, Not Null | Tên đăng nhập |
| `email` | `String(255)` | Unique, Indexed, Not Null | Địa chỉ email |
| `password_hash` | `String(255)` | Not Null | Mật khẩu đã được hash (Werkzeug) |
| `full_name` | `String(255)` | Not Null | Họ và tên hiển thị |
| `avatar_url` | `String(255)` | Nullable | Đường dẫn ảnh đại diện |
| `is_active` | `Boolean` | Default: True | Trạng thái tài khoản |
| `created_at` | `DateTime` | Timezone=True | Thời điểm tạo tài khoản |

### 2. Client (Ứng dụng kết nối)
Quản lý các ứng dụng bên thứ ba hoặc thành phần trong hệ sinh thái được phép sử dụng dịch vụ xác thực này.

| Trường | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `id` | `Integer` | PK, Auto-increment | ID nội bộ |
| `client_id` | `String(50)` | Unique, Indexed, Not Null | Định danh ứng dụng (Public ID) |
| `client_secret` | `String(255)` | Not Null | Mã bảo mật ứng dụng |
| `name` | `String(255)` | Not Null | Tên hiển thị của ứng dụng |
| `redirect_uri` | `Text` | Not Null | Các URI chuyển hướng hợp lệ (ngăn chặn SSRF) |
| `is_active` | `Boolean` | Default: True | Trạng thái ứng dụng |
| `created_at` | `DateTime` | Timezone=True | Thời điểm đăng ký client |

## Bảo mật & Xác thực

### Hashing Mật khẩu
Mật khẩu được lưu trữ dưới dạng hash sử dụng `werkzeug.security`. Không lưu mật khẩu thuần túy (plain-text).

### JSON Web Tokens (JWT)
Khi người dùng đăng nhập thành công, hệ thống sẽ tạo một JWT.
- **Thuật toán**: HS256
- **Payload**:
  - `sub`: `user.id` (ID của người dùng)
  - `email`: Email người dùng
  - `name`: Tên đầy đủ
  - `exp`: Thời điểm hết hạn (mặc định 24 giờ)

### Validation
Hệ thống kiểm tra `redirect_uri` của Client trước khi thực hiện chuyển hướng sau đăng nhập, đảm bảo an toàn cho luồng SSO.

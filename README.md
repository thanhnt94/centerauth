# CentralAuth System

Hệ thống xác thực tập trung (SSO) dành cho hệ sinh thái **Ecosystem**. Hệ thống này cung cấp khả năng đăng ký, đăng nhập và xác thực người dùng cho các ứng dụng vệ tinh bằng JSON Web Tokens (JWT).

## Mục tiêu
- Cung cấp một nơi duy nhất để quản lý tài khoản người dùng.
- Cho phép người dùng chuyển đổi giữa các ứng dụng trong hệ sinh thái (MindStack, PodLearn, IPTV) mà không cần đăng nhập lại nhiều lần.
- Đảm bảo an mật khẩu thông qua hashing.

## Thành phần chính
- **Backend**: Flask (Python)
- **Database**: SQLite (SQLAlchemy ORM)
- **Authentication**: JWT (JSON Web Tokens)
- **Client Management**: Quản lý các ứng dụng được phép kết nối.

## Cấu trúc thư mục
- `app/models/`: Chứa các model cơ sở dữ liệu (`User`, `Client`).
- `app/routes/`: Các API endpoints cho xác thực (`auth.py`) và quản trị (`admin.py`).
- `app/services/`: Logic nghiệp vụ (ví dụ: `jwt_service.py`).
- `app/templates/`: Giao diện web cho admin và trang login.

## Tài liệu chi tiết
- [Cơ sở dữ liệu & Models](docs/DATABASE.md)
- [Hướng dẫn API](docs/API_OVERVIEW.md)

## Cài đặt & Chạy
1. Cài đặt dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Cấu hình môi trường trong file `.env` (xem `.env.example`).
3. Chạy ứng dụng:
   ```bash
   python run.py
   ```

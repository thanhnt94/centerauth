# 🛡️ Central Auth: Enterprise Identity Launchpad

**Central Auth** là hệ thống quản lý định danh và xác thực tập trung (Identity Provider - IdP) được thiết kế hiện đại, cao cấp dành cho toàn bộ hệ sinh thái Mindstack. Hệ thống cung cấp cơ chế Single Sign-On (SSO) mạnh mẽ, giúp kết nối và đồng bộ hóa người dùng giữa các ứng dụng vệ tinh (Satellite Apps) một cách tức thì.

---

## 🚀 Công nghệ sử dụng

Hệ thống được xây dựng trên nền tảng công nghệ hiện đại, ưu tiên hiệu suất và trải nghiệm người dùng cao cấp:

### Backend (Core Engine)
- **Framework**: Python Flask (Modular Monolith Architecture).
- **Database**: SQLite / PostgreSQL (SQLAlchemy ORM).
- **Security**: JWT (JSON Web Tokens) với cơ chế Token Rotation và Blacklist.
- **SSO Protocol**: OAuth 2.1 (Simplified Flow) tối ưu cho môi trường Ecosystem nội bộ.

### Frontend (Admin Studio & Auth SPA)
- **Framework**: React + Vite (Single Page Application).
- **Styling**: Tailwind CSS v3 (Custom Dark Theme & Glassmorphism).
- **Animations**: Framer Motion (Smooth Micro-interactions).
- **Icons**: Lucide React.
- **Asset Pipeline**: Cấu hình Vite tối ưu để render file tĩnh trực tiếp vào Flask Static.

---

## ✨ Chức năng chính

1. **Launchpad Portal**: Trang chủ tập trung hiển thị tất cả các ứng dụng mà người dùng có quyền truy cập.
2. **Power Pairing**: Hệ thống kết nối "mì ăn liền" giúp các ứng dụng mới tham gia vào hệ sinh thái chỉ trong vài phút.
3. **Connectivity Audit (Zap Check ⚡)**: Tính năng kiểm tra trạng thái hoạt động (Online/Offline) của các ứng dụng vệ tinh ngay trên Dashboard.
4. **Identity Management**: Quản lý tập trung thông tin người dùng, UUID đồng nhất trên toàn hệ thống.
5. **Global Logout**: Đăng xuất một nơi, tự động hủy phiên làm việc ở tất cả các ứng dụng liên kết (Single Sign-Out).
6. **Premium Admin Studio**: Giao diện quản trị hiện đại theo phong cách Glassmorphism với bộ lọc và thống kê thời gian thực.

---

## 🛠️ Hướng dẫn cài đặt

### 1. Cài đặt môi trường Backend
```bash
# Di chuyển vào thư mục gốc CentralAuth
pip install -r requirements.txt

# Cấu hình file .env (Sử dụng các giá trị Client ID/Secret tại đây)
# Chạy server
python run_centralauth.py
```

### 2. Cài đặt và Biên dịch Frontend (Studio)
```bash
cd central-auth-studio
npm install

# Biên dịch frontend sang thư mục static của Flask
npm run build
```

---

## 🔗 Hướng dẫn tích hợp (Pairing Guide)

Hệ thống cung cấp helper `EcosystemAuth` giúp bạn tích hợp ứng dụng mới cực kỳ nhanh gọn.

### Các bước nhanh:
1. Truy cập **Admin Studio** -> **Clients** -> **Register New Client**.
2. Copy **Client ID** và **Client Secret** được cấp.
3. Sử dụng helper `app/utils/sso_helper.py` trong ứng dụng của bạn.

> [!TIP]
> Để xem hướng dẫn code chi tiết (của Flask/FastAPI), hãy tham khảo file: **[PAIRING_GUIDE.md](docs/PAIRING_GUIDE.md)**.

---
*Mindstack Ecosystem - Secure. Seamless. Unified.*

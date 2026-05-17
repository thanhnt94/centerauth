# 🔐 CentralAuth SSO Integration Guide

> **Version 2.0** — Cập nhật ngày 15/05/2026
> Hướng dẫn tích hợp Single Sign-On cho các ứng dụng vệ tinh trong hệ sinh thái MindStack.

---

## 📐 Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│                    CentralAuth (Port 5000)                      │
│                                                                 │
│  /               → Landing Page tĩnh (Jinja2 template)         │
│  /auth/login     → Trang đăng nhập (React SPA)                 │
│  /portal         → App Launcher (React SPA, cần đăng nhập)     │
│  /admin/*        → Quản trị hệ thống (React SPA, admin only)   │
│                                                                 │
│  API:                                                           │
│  POST /api/auth/login      → Xác thực & cấp session_token      │
│  GET  /api/auth/me         → Thông tin user hiện tại            │
│  GET  /api/auth/jump/:id   → Tạo auth code → redirect về app   │
│  GET  /api/auth/logout     → Xóa session, hỗ trợ ?return_to    │
│  POST /api/auth/token      → Đổi auth code lấy access_token    │
│  GET  /api/auth/verify-token → Xác thực token, trả user data   │
└──────────────┬──────────────────────────────────────────────────┘
               │
               │  OAuth2-like Authorization Code Flow
               │
┌──────────────▼──────────────────────────────────────────────────┐
│              App vệ tinh (VD: QuizMind, Port 5080)              │
│                                                                 │
│  /login              → Forced SSO redirect (hoặc backdoor)      │
│  /auth-center/callback?code=xxx  → Đổi code, tạo session local │
│  /logout             → Xóa cookie local + logout CentralAuth   │
│                                                                 │
│  API:                                                           │
│  GET  /api/sso/config    → Xem cấu hình SSO hiện tại           │
│  POST /api/sso/config    → Cập nhật cấu hình SSO               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Backend (cả 2)** | FastAPI + SQLAlchemy Async + SQLite (WAL mode) |
| **CentralAuth Frontend** | React + TypeScript + Vite + TailwindCSS |
| **CentralAuth Landing Page** | Jinja2 Template (HTML/CSS tĩnh, dễ custom) |
| **App vệ tinh Frontend** | Jinja2 Templates (SSR) |
| **Mã hóa mật khẩu** | Werkzeug (scrypt/PBKDF2) — **thống nhất toàn hệ thống** |
| **Session CentralAuth** | JWT (PyJWT), cookie `session_token`, httponly |
| **Session App vệ tinh** | Cookie `user_id`, httponly |
| **Giao tiếp giữa các app** | httpx (async HTTP client) |
| **Cấu hình SSO** | Database-driven (`SSOConfig` model), không dùng `.env` |

---

## 🔄 Luồng đăng nhập (Login Flow)

```
User truy cập QuizMind
        │
        ▼
   GET /login
        │
        ├── Đã đăng nhập (có cookie user_id)? → Redirect /
        │
        ├── SSO bật + không có ?backdoor + không có ?error?
        │       │
        │       ▼
        │   Redirect → CentralAuth /api/auth/jump/quizmind-v1
        │       │
        │       ├── Đã đăng nhập CA? → Tạo auth code → Redirect về
        │       │       QuizMind /auth-center/callback?code=xxx
        │       │
        │       └── Chưa đăng nhập CA? → Redirect /auth/login?client_id=quizmind-v1
        │               │
        │               ▼
        │           User nhập username/password tại CentralAuth
        │               │
        │               ▼
        │           POST /api/auth/login (kèm client_id)
        │               │
        │               ▼
        │           Trả về { redirect: "/api/auth/jump/quizmind-v1" }
        │               │
        │               ▼
        │           Tạo auth code → Redirect về QuizMind callback
        │
        ▼
   GET /auth-center/callback?code=xxx
        │
        ▼
   QuizMind gọi CentralAuth API:
     1. POST /api/auth/token    (đổi code → access_token)
     2. GET  /api/auth/verify-token (lấy user data + password_hash)
        │
        ▼
   Sync user vào DB local (tạo mới hoặc liên kết sso_id)
        │
        ▼
   Set cookie user_id → Redirect / → Dashboard
```

---

## 🔄 Luồng đăng xuất (Logout Flow)

```
User nhấn Logout tại QuizMind
        │
        ▼
   GET /logout
        │
        ▼
   Xóa cookie user_id (local)
        │
        ▼
   SSO bật? → Redirect CentralAuth /api/auth/logout
        │
        ▼
   CentralAuth xóa cookie session_token
        │
        ▼
   Redirect về Landing Page (/)
        │
        ▼
   User thấy trang chủ CentralAuth — có thể chọn đăng nhập lại
```

---

## 📦 Tích hợp cho App vệ tinh mới

### Bước 1: Copy SSO Module

Copy thư mục `CentralAuth/sdk/sso_module/` vào `your-app/app/modules/sso_module/`:

```
your-app/
├── app/
│   ├── core/
│   │   └── db.py          ← phải export: Base, get_db, SessionLocal, engine
│   ├── modules/
│   │   ├── auth/
│   │   │   └── models.py  ← User model cần có trường sso_id
│   │   └── sso_module/    ← COPY VÀO ĐÂY
│   │       ├── __init__.py
│   │       ├── models.py  ← SSOConfig model
│   │       ├── routes.py  ← Callback + Config API
│   │       └── service.py ← Token exchange logic
│   └── main.py
```

### Bước 2: Sửa import path

Trong `sso_module/models.py`, đảm bảo import đúng:
```python
from app.core.db import Base  # Không phải app.core.database
```

### Bước 3: Thêm trường `sso_id` vào User model

```python
class User(Base):
    __tablename__ = "users"
    # ... các trường hiện có ...
    sso_id = Column(String(255), unique=True, index=True, nullable=True)
```

### Bước 4: Seed cấu hình SSO trong `init_db.py`

```python
from app.modules.sso_module.models import SSOConfig

# Trong hàm init_db():
result = await db.execute(select(SSOConfig))
if not result.scalar_one_or_none():
    sso_cfg = SSOConfig(
        is_enabled=True,
        server_url="http://localhost:5000",
        client_id="your-app-id",         # Phải khớp với CentralAuth
        client_secret="your-app-secret"   # Phải khớp với CentralAuth
    )
    db.add(sso_cfg)
    await db.commit()
```

### Bước 5: Đăng ký router trong `main.py`

```python
from app.modules.sso_module.routes import router as sso_api_router

app.include_router(sso_api_router)  # Không có prefix!
```

### Bước 6: Cài đặt Forced SSO + Backdoor trong route `/login`

```python
@app.get("/login")
async def login_page(request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Đã đăng nhập? → Về trang chủ
    current_user = await AuthService.get_current_user(request, db)
    if current_user:
        return RedirectResponse(url="/")

    # 2. Kiểm tra SSO
    from app.modules.sso_module.service import SSOService
    sso_config = await SSOService.get_config(db)
    
    error = request.query_params.get("error")
    is_backdoor = request.query_params.get("backdoor")
    
    # 3. SSO bật + không lỗi + không backdoor → Redirect CentralAuth
    if sso_config.is_enabled and not error and not is_backdoor:
        return RedirectResponse(
            url=f"{sso_config.server_url}/api/auth/jump/{sso_config.client_id}"
        )

    # 4. Hiện form login nội bộ (backdoor / SSO tắt / fallback lỗi)
    context = {"request": request, "error": error}
    return templates.TemplateResponse("auth/login.html", context)
```

> ⚠️ **QUAN TRỌNG**: Không tạo route `/login` trong `sso_module/routes.py`!
> Route `/login` chỉ được khai báo trong `main.py` để tránh xung đột.

### Bước 7: Cài đặt Logout liên hệ thống

```python
@app.get("/logout")
async def logout(request: Request, db: AsyncSession = Depends(get_db)):
    from app.modules.sso_module.service import SSOService
    sso_config = await SSOService.get_config(db)
    
    if sso_config.is_enabled:
        # Xóa cookie local + logout CentralAuth → về Landing Page
        ca_logout_url = f"{sso_config.server_url}/api/auth/logout"
        response = RedirectResponse(url=ca_logout_url, status_code=303)
    else:
        response = RedirectResponse(url="/login", status_code=303)
    
    response.delete_cookie("user_id", path="/")
    return response
```

### Bước 8: Đăng ký app tại CentralAuth

Dùng Admin Panel hoặc API:

```bash
curl -X POST http://localhost:5000/admin/api/clients \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your App Name",
    "client_id": "your-app-id",
    "client_secret": "your-app-secret",
    "app_url": "http://localhost:YOUR_PORT"
  }'
```

CentralAuth tự động tạo `redirect_uri` = `{app_url}/auth-center/callback`.

> ⚠️ **`client_secret` phải khớp giữa CentralAuth và app vệ tinh!**
> Đây là lỗi phổ biến nhất khi tích hợp.

---

## 🚪 Admin Backdoor

Backdoor chỉ dành cho **quản trị viên** khi CentralAuth gặp sự cố:

1. Navigate to: `http://your-app-url/login?backdoor=1`
2. Enter your local admin credentials.

## 🛡️ Chính sách bảo mật Backdoor (Security Policy)

Khi SSO được bật, lối vào Backdoor được thắt chặt bảo mật:
- **Chỉ dành cho Quản trị viên (Admin):** Chỉ những tài khoản có `role = 'admin'` trong database local mới có thể đăng nhập qua đường này.
- **User thường:** Nếu cố tình vào link backdoor và đăng nhập bằng tài khoản thường, hệ thống sẽ từ chối và yêu cầu đăng nhập qua SSO. Điều này ngăn chặn việc user lách luật để không dùng SSO.

## 💡 Mẹo sử dụng: Tránh xung đột Session

Vì hệ thống có 2 loại session (Local app và CentralAuth), để tránh việc ghi đè cookie và gây nhầm lẫn khi vừa làm Admin vừa làm User:
1. **Sử dụng hàng ngày:** Dùng trình duyệt bình thường cho mọi hoạt động SSO.
2. **Quản trị/Sửa lỗi (Backdoor):** Luôn sử dụng **Tab ẩn danh (Incognito)** khi vào backdoor.
   - Giúp giữ 2 phiên đăng nhập độc lập (1 cái là User SSO, 1 cái là Admin Backdoor).
   - Không bị hiện tượng "đá session" khi chuyển đổi giữa các tab.

---

## 📋 Checklist tích hợp

- [ ] Copy `sso_module/` vào `app/modules/`
- [ ] Sửa import path → `app.core.db`
- [ ] Thêm `sso_id` vào User model
- [ ] Seed `SSOConfig` trong `init_db.py`
- [ ] Đăng ký `sso_api_router` (không prefix)
- [ ] Cài route `/login` với Forced SSO + Backdoor (kèm check Admin-only)
- [ ] Cài route `/logout` với CentralAuth logout
- [ ] Đăng ký client tại CentralAuth (client_id + client_secret **khớp**)
- [ ] Đảm bảo mã hóa mật khẩu dùng **Werkzeug** (không SHA256)
- [ ] Test luồng: Login → Callback → Dashboard → Logout → Landing Page

---

## 🗂️ Cấu trúc CentralAuth

```
CentralAuth/
├── app/
│   ├── core/
│   │   ├── db.py              ← SQLAlchemy Async engine + session
│   │   └── config.py          ← Settings (DATABASE_URL, etc.)
│   ├── modules/
│   │   ├── identity/          ← User model, auth routes, user service
│   │   ├── sso/               ← AuthCode model, JWT service, OAuth service
│   │   ├── clients/           ← Client model (app vệ tinh), client service
│   │   └── admin/             ← Admin API routes
│   ├── static/dist/           ← React SPA build output
│   ├── templates/
│   │   └── landing.html       ← Landing page tĩnh (tùy chỉnh tại đây)
│   └── main.py                ← FastAPI app, routing, lifespan
├── central-auth-studio/       ← React SPA source (Vite + TypeScript)
├── sdk/
│   └── sso_module/            ← Template SSO module cho app vệ tinh
└── run_centralauth.py         ← Entry point (uvicorn, port 5000)
```

---

## 📡 API Reference

### CentralAuth API

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `POST` | `/api/auth/login` | Đăng nhập, trả JWT cookie + redirect |
| `GET` | `/api/auth/me` | Lấy thông tin user từ session |
| `GET` | `/api/auth/jump/{client_id}` | Tạo auth code, redirect về app |
| `GET/POST` | `/api/auth/logout?return_to=` | Xóa session, redirect |
| `POST` | `/api/auth/token` | Đổi auth code → access_token |
| `GET` | `/api/auth/verify-token` | Xác thực token, trả user data |
| `GET` | `/api/auth/portal-apps` | Danh sách app đang hoạt động |
| `GET` | `/api/auth/health` | Health check |

### App vệ tinh API (SSO Module)

| Method | Endpoint | Mô tả |
|--------|----------|--------|
| `GET` | `/auth-center/callback?code=` | Nhận auth code từ CentralAuth |
| `GET` | `/api/sso/config` | Xem cấu hình SSO |
| `POST` | `/api/sso/config` | Cập nhật cấu hình SSO |

---

## 🏷️ Danh sách App đã tích hợp

| App | client_id | Port | Trạng thái |
|-----|-----------|------|------------|
| QuizMind | `quizmind-v1` | 5080 | ✅ Hoàn tất |
| Vocaburn | `vocaburn-v1` | 5060 | ⏳ Chưa tích hợp |
| PodLearn | `podlearn-v1` | — | ⏳ Chưa tích hợp |

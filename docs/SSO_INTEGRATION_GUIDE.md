# 🔐 CentralAuth SSO Integration Guide

> **Version 3.0** — Cập nhật ngày 19/05/2026
> Hướng dẫn tích hợp Single Sign-On thế hệ mới dựa trên Client-Side React SPA cho các ứng dụng vệ tinh trong hệ sinh thái MindStack.

---

## 📐 Kiến trúc tổng quan

Trong kiến trúc Hybrid SPA thế hệ mới, luồng điều hướng SSO được thực hiện hoàn toàn ở phía Client (Frontend React) thay vì redirect ở phía Server. Cách tiếp cận này giúp bảo toàn trải nghiệm mượt mà của SPA và tương thích tuyệt đối với các ứng dụng Mobile / Web App hiện đại.

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
               │  OAuth2-like Authorization Code Flow (Client-Driven)
               │
┌──────────────▼──────────────────────────────────────────────────┐
│              App vệ tinh (VD: QuizMind, Port 5080)              │
│                                                                 │
│  /login              → Client-side Auto SSO redirect (hoặc backdoor) │
│  /auth-center/callback?code=xxx  → Đổi code, tạo session local │
│  /logout             → POST API → xóa cookie local + CA logout │
│                                                                 │
│  API:                                                           │
│  GET  /api/auth/config   → Lấy cấu hình SSO phục vụ auto-redirect│
│  POST /api/admin/sso     → Cập nhật & đồng bộ cấu hình SSO     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Backend (cả 2)** | FastAPI + SQLAlchemy Async + SQLite (WAL mode) |
| **CentralAuth Frontend** | React + TypeScript + Vite + TailwindCSS |
| **App vệ tinh Frontend** | React + TypeScript + Vite + TailwindCSS (hoặc Next.js) |
| **Mã hóa mật khẩu** | Werkzeug (scrypt/PBKDF2) — **thống nhất toàn hệ thống** |
| **Session CentralAuth** | JWT (PyJWT), cookie `session_token`, httponly |
| **Session App vệ tinh** | Cookie `access_token` hoặc `user_id`, httponly |
| **Cấu hình SSO** | Dual-Store DB-driven (`SystemConfig` & `SSOConfig`), tự động đồng bộ |

---

## 🔄 Luồng đăng nhập (Client-Side Auto-Redirect Flow)

```
User truy cập QuizMind/RemiNote /login
        │
        ▼
   React Component LoginPage mount
        │
        ├── Gọi API GET /api/auth/config
        │
        ├── SSO bật + không có ?backdoor=1 (hoặc ?fallback=1) + không lỗi?
        │       │
        │       ▼
        │   Thiết lập window.location.href = config.jump_url
        │       │ (Redirect tức thời sang CentralAuth mà không cần click nút)
        │       │
        │       ├── Đã đăng nhập CA? → Tạo auth code → Redirect về
        │       │       App callback (/auth-center/callback?code=xxx)
        │       │
        │       └── Chưa đăng nhập CA? → Redirect về trang đăng nhập của CentralAuth
        │
        ▼
    (Nếu có ?backdoor=1 hoặc SSO tắt)
   Hiển thị Form đăng nhập nội bộ (Local Login)
        │
        ▼
   Post thông tin đăng nhập lên /api/auth/login kèm: is_backdoor = true
```

---

## 🔄 Luồng đăng xuất (Global SSO Logout Flow)

Để đảm bảo an toàn, khi người dùng đăng xuất tại bất kỳ hệ thống vệ tinh nào, hệ thống phải thực hiện **Đăng xuất toàn cầu (Global Signout)** ở cả app vệ tinh lẫn CentralAuth:

```
User nhấn Logout tại App vệ tinh
        │
        ▼
   Client gửi request POST lên /api/auth/logout
        │
        ▼
   Backend xóa cookie access_token (local)
        │
        ├── Nếu SSO bật:
        │   Trả về JSON: { "status": "success", "redirect_url": "http://localhost:5000/auth/logout?client_id=your-client-id" }
        │
        └── Nếu SSO tắt:
            Trả về JSON: { "status": "success", "message": "Logged out" }
        │
        ▼
   Client (React) nhận phản hồi:
     - Nếu có redirect_url: Thiết lập window.location.href = redirect_url
     - Nếu không: Chuyển hướng client-side về trang /login
```

---

## 📦 Tích hợp cho App vệ tinh mới (Ví dụ: RemiNote)

### Bước 1: Copy SSO Module (Backend SDK)

Copy thư mục `CentralAuth/sdk/sso_module/` vào thư mục module của app bạn. Đảm bảo cấu trúc import tương thích với SQLAlchemy Async của hệ thống.

---

### Bước 2: Khai báo trường `is_backdoor` trong Schema Đăng nhập

Trong file Pydantic Schema đăng nhập của bạn (ví dụ: `app/schemas/user.py`), bổ sung trường `is_backdoor` để cho phép phân tách luồng đăng nhập nội bộ:

```python
class UserLogin(BaseModel):
    username: str
    password: str
    is_backdoor: bool | None = False  # Bắt buộc để nhận diện đăng nhập backdoor
```

---

### Bước 3: Cài đặt chặn đăng nhập local khi bật SSO

Trong API đăng nhập local (ví dụ: `/api/auth/login` hoặc `/login`), kiểm tra trạng thái SSO từ database. Nếu SSO đang hoạt động và người dùng **không sử dụng backdoor** hoặc **không phải là quản trị viên**, hãy chặn đăng nhập cục bộ để bảo mật:

```python
@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Kiểm tra SSO
    config = await get_sso_config(db)
    sso_enabled = config.get("ENABLE_SSO", "true").lower() == "true"
    
    # Nếu SSO đang bật và không sử dụng backdoor/bypass
    if sso_enabled and not data.is_backdoor:
        if not user.is_admin:  # Chỉ cho phép tài khoản Admin thực hiện backdoor
            raise HTTPException(
                status_code=403,
                detail="Security Alert: SSO is active. Local login bypass is strictly restricted to Administrators only."
            )
            
    # Tiến hành xác thực mật khẩu như bình thường...
```

---

### Bước 4: Khai báo API `/api/auth/config` phục vụ Frontend

Tạo một endpoint công khai để phía React client truy vấn cấu hình SSO:

```python
@router.get("/config")
async def get_auth_config(db: AsyncSession = Depends(get_db)):
    """Public authentication configuration for client auto-redirect."""
    config = await get_sso_config(db)
    sso_enabled = config.get("ENABLE_SSO", "true").lower() == "true"
    server_url = config.get("CENTRAL_AUTH_URL", "http://localhost:5000").rstrip('/')
    client_id = config.get("CENTRAL_AUTH_CLIENT_ID", "your-app-v1")
    
    base_url = "http://127.0.0.1:5070"  # Địa chỉ của App vệ tinh
    redirect_uri = f"{base_url}/auth-center/callback"
    jump_url = (
        f"{server_url}/api/auth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
    ) if sso_enabled else None

    return {
        "auth_provider": "central" if sso_enabled else "local",
        "sso_enabled": sso_enabled,
        "jump_url": jump_url
    }
```

---

### Bước 5: Cài đặt API Đăng xuất Đa hệ thống (Logout Redirect)

Sửa đổi hàm logout backend của bạn để tự động trả về đường dẫn logout của CentralAuth khi SSO đang được kích hoạt:

```python
@router.post("/logout")
async def logout(response: Response, db: AsyncSession = Depends(get_db)):
    """Clear auth cookie and return SSO redirect URL if active."""
    response.delete_cookie("access_token")  # Hoặc xóa session cookie local của bạn
    
    config = await get_sso_config(db)
    sso_enabled = config.get("ENABLE_SSO", "true").lower() == "true"
    if sso_enabled:
        server_url = config.get("CENTRAL_AUTH_URL", "http://localhost:5000").rstrip('/')
        client_id = config.get("CENTRAL_AUTH_CLIENT_ID", "your-app-v1")
        return {
            "status": "success",
            "redirect_url": f"{server_url}/auth/logout?client_id={client_id}"
        }
        
    return {"status": "success", "message": "Logged out"}
```

---

### Bước 6: Cài đặt luồng Auto-Redirect và Backdoor phía React Frontend

Trong file lưu trữ State của bạn (ví dụ: Zustand store `useAuthStore.ts`), tích hợp luồng xử lý:

```typescript
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  authConfig: null,

  login: async (username, password, is_backdoor = false) => {
    const { data } = await api.post('/api/auth/login', { username, password, is_backdoor })
    set({ user: data.user })
  },

  logout: async () => {
    try {
      const { data } = await api.post('/api/auth/logout')
      set({ user: null })
      if (data && data.redirect_url) {
        window.location.href = data.redirect_url // Redirect đăng xuất toàn cầu
      } else {
        window.location.href = '/login'
      }
    } catch {
      set({ user: null })
      window.location.href = '/login'
    }
  },

  fetchAuthConfig: async () => {
    const { data } = await api.get('/api/auth/config')
    set({ authConfig: data })
  }
}))
```

Trong component trang đăng nhập (`LoginPage.tsx`), áp dụng luồng tự động chuyển hướng:

```typescript
export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { login, authConfig, fetchAuthConfig } = useAuthStore()
  const isBackdoor = searchParams.get('backdoor') === '1' || searchParams.get('fallback') === '1'

  // 1. Tải cấu hình SSO lúc mount
  useEffect(() => {
    fetchAuthConfig()
  }, [fetchAuthConfig])

  // 2. Tự động chuyển hướng nếu SSO bật và KHÔNG vào qua đường backdoor
  useEffect(() => {
    if (authConfig && authConfig.sso_enabled && !isBackdoor && authConfig.jump_url) {
      window.location.href = authConfig.jump_url
    }
  }, [authConfig, isBackdoor])

  // 3. Form Đăng nhập nội bộ (chỉ hiển thị khi có ?backdoor=1 hoặc khi SSO tắt)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(username, password, isBackdoor)
  }
}
```

---

### Bước 7: Đăng ký ứng dụng cực kỳ đơn giản tại CentralAuth

Giờ đây việc đăng ký tích hợp ứng dụng tại CentralAuth đã được đơn giản hóa hoàn toàn. Bạn **không cần** phải nhập thủ công các trường phức tạp như *Redirect URIs* hay *Backchannel Logout URI*. Khi tạo Client mới tại màn hình Quản trị CentralAuth, bạn chỉ cần nhập duy nhất:

1. **App Name**: Tên hiển thị của ứng dụng.
2. **Client ID**: Định danh duy nhất (ví dụ: `reminote-v1`).
3. **App URL**: Địa chỉ URL chạy thực tế của ứng dụng (ví dụ: `http://localhost:5070` ở local hoặc `https://reminote.mindstack.click` ở production).
4. **Client Secret**: Mã khóa bí mật.

Hệ thống CentralAuth sẽ **tự động tính toán chuẩn hóa** các endpoint callback và webhook tương ứng dựa trên `App URL` bạn đã khai báo để thực hiện đồng bộ session và logout một cách liền mạch!

---

## 🚪 Admin Backdoor & Security Policies

* **Đường dẫn Backdoor:** `http://your-app-url/login?backdoor=1` (hoặc `?fallback=1`)
* **Chính sách bảo mật Backdoor:**
  * **Chỉ tài khoản Admin:** Chỉ các tài khoản có flag `is_admin = True` hoặc `role = 'admin'` mới được phép đăng nhập thông qua Form local khi SSO đang hoạt động.
  * **Chặn User thường:** Nếu người dùng thông thường cố gắng sử dụng form backdoor để né tránh việc ghi nhận SSO, backend sẽ ngay lập tức trả về lỗi từ chối truy cập `403 Forbidden`.
* **Tránh xung đột phiên đăng nhập:** Khi kiểm tra hệ thống và vừa làm Admin local, vừa làm User thường trên SSO, hãy luôn mở link Backdoor bằng **Tab ẩn danh (Incognito Mode)** để tránh việc ghi đè Cookie giữa hai phiên đăng nhập độc lập.

---

## 📋 Checklist tích hợp nhanh cho nhà phát triển

- [ ] Đồng bộ hóa database: Bổ sung trường liên kết SSO của User.
- [ ] Backend: Thêm trường `is_backdoor` vào schema `/login` và áp dụng logic chặn user thường nếu SSO bật.
- [ ] Backend: Tạo API GET `/api/auth/config` trả về đúng cấu trúc.
- [ ] Backend: Cập nhật POST `/api/auth/logout` trả về `redirect_url` của CentralAuth.
- [ ] Frontend: Gọi `fetchAuthConfig` khi render màn hình Đăng nhập.
- [ ] Frontend: Tự động thiết lập `window.location.href = config.jump_url` nếu SSO bật và không có backdoor.
- [ ] Đăng ký Client trên CentralAuth (Chỉ cần điền App URL, các URI callback được tính toán tự động).
- [ ] Kiểm nghiệm: Bật SSO -> Tự động chuyển hướng. Tắt SSO -> Form đăng nhập cục bộ hiện ngay lập tức. Đăng xuất -> Đăng xuất sạch sẽ cả 2 hệ thống.

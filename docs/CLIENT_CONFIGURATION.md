# Hướng dẫn Cấu hình Kết nối CentralAuth (SSO V2)

Tài liệu này giải thích chi tiết cách khai báo các thông số cấu hình trong trang Quản trị của ứng dụng con để kết nối với hệ thống xác thực tập trung.

## 1. Auth Center API URL
- **Giá trị mẫu**: `http://127.0.0.1:5001`
- **Mô tả**: Đây là địa chỉ "nội bộ" mà ứng dụng của bạn sẽ gọi sang CentralAuth từ phía Server (Back-end).
- **Mục đích**: 
    - Kiểm tra trạng thái hệ thống (Health Check).
    - Xác thực Token người dùng gửi lên.
    - **Quan trọng (V2)**: Dùng để gọi API đổi mã `auth_code` lấy Access Token.
- **Lưu ý**: URL này không nhất thiết phải công khai ra internet nếu cả 2 server nằm trong cùng mạng nội bộ.

## 2. Auth Center Web URL
- **Giá trị mẫu**: `http://127.0.0.1:5001`
- **Mô tả**: Đây là địa chỉ trang web của CentralAuth mà người dùng nhìn thấy trên trình duyệt.
- **Mục đích**: Điều hướng người dùng đến trang đăng nhập tập trung khi họ chưa có phiên làm việc.
- **Lưu ý**: Phải là URL mà người dùng có thể truy cập được từ trình duyệt của họ.

## 3. Client ID
- **Giá trị mẫu**: `mindstack-v3`
- **Mô tả**: Mã định danh duy nhất của ứng dụng đã đăng ký tại CentralAuth Admin.
- **Mục đích**: Để CentralAuth biết yêu cầu đăng nhập đến từ ứng dụng nào, từ đó áp dụng đúng các quy tắc bảo mật (Redirect URI) và giao diện riêng của ứng dụng đó.

## 4. Client Secret
- **Giá trị mẫu**: `********` (Ví dụ: `mindstack-secret-key-123`)
- **Mô tả**: "Mật mã" riêng giữa ứng dụng của bạn và CentralAuth.
- **Mục đích (V2)**: **Bắt buộc** phải có để đổi lấy JWT Token. Nếu không có Secret, kẻ xấu có thể đánh cắp `auth_code` trên URL để giả mạo người dùng.
- **Cảnh báo**: Tuyệt đối không để lộ mã này ở phía Client (Javascript/HTML). Nó chỉ được phép tồn tại trong cấu hình Server.

---

## Bảng tra cứu nhanh

| Thông số | Phía sử dụng | Tầm quan trọng |
| :--- | :--- | :--- |
| **API URL** | Server-to-Server | Rất cao (Để verify token) |
| **Web URL** | Browser (Client) | Cao (Để login) |
| **Client ID** | Public | Trung bình |
| **Client Secret** | **Secret (Server only)** | **Tối mật** |

> [!TIP]
> Sau khi điền đầy đủ các thông số, hãy nhấn nút **"Kiểm tra kết nối"**. Ứng dụng sẽ thực hiện một lệnh gọi ẩn đến API URL để xác nhận các thông số ID và Secret là chính xác trước khi lưu.

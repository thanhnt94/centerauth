# CentralAuth Troubleshooting Guide

Tài liệu này tổng hợp các lỗi phổ biến khi tích hợp hệ thống CentralAuth và cách khắc phục.

## 1. Lỗi "Connection Refused" (127.0.0.1)

> [!WARNING]
> **Triệu chứng**: Khi chạy trên VPS, ứng dụng con không thể gọi tới CentralAuth hoặc ngược lại.

- **Nguyên nhân**: Bạn đang sử dụng địa chỉ `127.0.0.1` hoặc `localhost` trong cấu hình. Các ứng dụng chạy trên các container hoặc server khác nhau không thể gọi nhau qua localhost.
- **Khắc phục**: 
  - Thay đổi toàn bộ URL trong file `.env` thành tên miền thật hoặc IP nội bộ của server.
  - Kiểm tra lại cột `backchannel_logout_uri` trong bảng `clients` của database CentralAuth. Chạy script `fix_webhooks_vps.py` nếu cần để cập nhật hàng loạt.

## 2. Lỗi "403 Forbidden" khi nhận Logout Webhook

- **Triệu chứng**: CentralAuth gửi thông báo đăng xuất nhưng ứng dụng con trả về lỗi 403.
- **Nguyên nhân**: Cơ chế bảo vệ **CSRF** của ứng dụng con chặn các yêu cầu POST từ server ngoài.
- **Khắc phục**: Cấu hình ngoại lệ CSRF cho route nhận webhook.
  - Với Flask-WTF:
    ```python
    @auth_bp.route('/sso/logout-webhook', methods=['POST'])
    @csrf.exempt # QUAN TRỌNG
    def sso_logout_webhook():
        ...
    ```

## 3. Lỗi "Invalid Token Signature" hoặc "Token Expired"

- **Triệu chứng**: `verify-token` thất bại dù token mới lấy.
- **Nguyên nhân**:
  - **Lệch giờ (Clock Skew)**: Thời gian giữa server CentralAuth và Client không khớp nhau. Hãy đảm bảo cả hai đều đồng bộ qua NTP.
  - **Secret không khớp**: `client_secret` dùng để giải mã không khớp với secret đã đăng ký.
- **Khắc phục**: Đồng bộ thời gian hệ thống và kiểm tra lại `client_secret`.

## 4. Lỗi "Double Login Flash Message"

- **Triệu chứng**: Người dùng thấy thông báo "Bạn đã đăng nhập" lặp lại nhiều lần.
- **Nguyên nhân**: CentralAuth phát hiện session cũ nhưng vẫn thực hiện các bước redirect dư thừa kèm flash message.
- **Khắc phục**: CentralAuth sẽ tự động bỏ qua trang login nếu session hợp lệ và chuyển hướng thẳng tới `return_to` kèm `code` mới.

---
*Đội ngũ phát triển Ecosystem*

# Hướng dẫn Cấu hình Supabase Storage cho Ảnh Sản phẩm

Project của bạn hiện dùng kiến trúc lai (hybrid) rất phổ biến:

| Dịch vụ | Dùng để làm gì |
|---|---|
| **Firebase Firestore** | Lưu toàn bộ dữ liệu: sản phẩm, đơn hàng, users, cài đặt |
| **Supabase Storage** | Chỉ lưu ảnh sản phẩm và icon thanh toán |

Hai dịch vụ này hoàn toàn độc lập, không ảnh hưởng nhau và đều có gói miễn phí rất rộng rãi.

---

## Bước 1: Tạo tài khoản và Project Supabase

1.  Truy cập [supabase.com](https://supabase.com) và đăng ký tài khoản miễn phí (có thể dùng GitHub để đăng nhập nhanh).
2.  Nhấn **"New project"**.
3.  Điền tên project (ví dụ: `shop-images`), chọn mật khẩu database và chọn region gần Việt Nam nhất (Singapore).
4.  Nhấn **"Create new project"** và đợi khoảng 1-2 phút để Supabase khởi tạo.

---

## Bước 2: Lấy API Keys

1.  Trong Supabase Dashboard, vào **Settings** (biểu tượng bánh răng ở thanh bên trái) > **API**.
2.  Tìm và copy 2 giá trị sau:
    -   **Project URL** → Đây là `VITE_SUPABASE_URL` (dạng `https://xxxxxxxx.supabase.co`)
    -   **anon public** (trong mục "Project API keys") → Đây là `VITE_SUPABASE_ANON_KEY`

---

## Bước 3: Tạo Storage Bucket

1.  Trong thanh bên trái, nhấn vào **Storage** (biểu tượng thùng chứa).
2.  Nhấn **"New bucket"**.
3.  Đặt tên bucket là: `shop-images` (phải đúng tên này, vì code đã cấu hình sẵn).
4.  **Quan trọng:** Bật công tắc **"Public bucket"** để ảnh có thể xem công khai mà không cần đăng nhập.
5.  Nhấn **"Save"**.

---

## Bước 4: Cấu hình Storage Policy (Cho phép Upload)

Đây là bước bắt buộc để code của bạn có thể upload ảnh lên.

1.  Trong trang **Storage**, nhấn vào bucket `shop-images` vừa tạo.
2.  Nhấn vào tab **"Policies"** ở phía trên.
3.  Nhấn **"New policy"** > chọn **"For full customization"**.
4.  Điền thông tin policy như sau:

    | Trường | Giá trị |
    |---|---|
    | **Policy name** | `Allow public upload and view` |
    | **Allowed operations** | Tick vào: `SELECT`, `INSERT` |
    | **Target roles** | Chọn: `anon`, `authenticated` |
    | **USING expression** | `true` |
    | **WITH CHECK expression** | `true` |

5.  Nhấn **"Review"** rồi **"Save policy"**.

---

## Bước 5: Thêm vào file `.env.local` (máy bạn) và Vercel

**Trên máy của bạn**, mở file `.env.local` và thêm 2 dòng:

```dotenv
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Trên Vercel Dashboard**, vào **Settings > Environment Variables** của project và thêm 2 biến tương tự.

---

## Kiểm tra hoạt động

Sau khi cấu hình xong, thử vào trang Admin Dashboard của web, thêm hoặc sửa một sản phẩm và upload ảnh. Nếu thành công, ảnh sẽ xuất hiện ngay lập tức và URL ảnh sẽ có dạng:

```
https://xxxxxxxxxxxxxxxx.supabase.co/storage/v1/object/public/shop-images/products/...
```

---

## Lưu ý quan trọng

Vì bạn đang dùng Supabase của một project khác (không cùng web), điều đó **hoàn toàn bình thường và được hỗ trợ**. Supabase Storage là một dịch vụ lưu trữ file độc lập, bạn có thể dùng nó từ bất kỳ ứng dụng nào chỉ cần có URL và API key đúng.

# Hướng dẫn Deploy Web Shop lên Vercel

Chào bạn, tôi đã kiểm tra và tối ưu code của bạn để sẵn sàng deploy lên Vercel. Project của bạn đã được cấu hình để Vercel có thể tự động nhận diện và build một cách chính xác.

File `vercel.json` đã được cập nhật để tối ưu tốc độ tải trang và bảo mật.

---

## I. Điều kiện cần có

1.  **Tài khoản Vercel:** Đăng ký miễn phí tại [vercel.com](https://vercel.com) (nên dùng tài khoản GitHub để đăng nhập).
2.  **Code đã được đưa lên GitHub:** Bạn cần làm theo hướng dẫn `HUONG_DAN_GITHUB.md` mà tôi đã gửi trước đó để đưa toàn bộ code lên một repository trên GitHub.

---

## II. Các bước Deploy lên Vercel

### Bước 1: Import Project từ GitHub

1.  Đăng nhập vào Vercel Dashboard của bạn.
2.  Nhấn vào nút **"Add New..."** và chọn **"Project"**.
3.  Trong mục **"Import Git Repository"**, tìm và chọn repository GitHub của project shop mà bạn đã tạo ở bước trước. Nhấn **"Import"**.

### Bước 2: Cấu hình Project

Vercel rất thông minh và sẽ tự động nhận diện project của bạn là một project **Vite**. Các thiết lập mặc định gần như đã đúng. Bạn chỉ cần kiểm tra lại:

-   **Framework Preset:** Vercel sẽ tự chọn là `Vite`. **Hãy để nguyên như vậy.**
-   **Build and Output Settings:** Mở mục này ra và kiểm tra:
    -   **Build Command:** `npm run build` (Vercel sẽ tự điền).
    -   **Output Directory:** `dist` (Vercel sẽ tự điền).
    -   **Install Command:** `npm install` (Vercel sẽ tự điền).

> **Quan trọng:** Nhờ có file `vercel.json` tôi đã cấu hình, bạn không cần phải thay đổi bất kỳ thiết lập nào ở đây. Vercel sẽ tự động đọc file đó và áp dụng các cài đặt chính xác.

### Bước 3: Thêm Environment Variables (Biến Môi Trường)

Đây là bước **quan trọng nhất** để website của bạn sau khi deploy có thể kết nối tới Firebase và gửi thông báo.

1.  Trong trang cấu hình project, mở mục **"Environment Variables"**.
2.  Bạn cần copy toàn bộ nội dung từ file `.env.local` ở máy của bạn và thêm từng dòng vào Vercel.

    -   **Name:** Là tên của biến (ví dụ: `VITE_FIREBASE_API_KEY`).
    -   **Value:** Là giá trị của biến (ví dụ: `AIzaSy...`).

    Bạn cần thêm tất cả các biến sau:

    | Name                                | Value                                    |
    | ----------------------------------- | ---------------------------------------- |
    | `VITE_FIREBASE_API_KEY`             | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_FIREBASE_AUTH_DOMAIN`         | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_FIREBASE_PROJECT_ID`          | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_FIREBASE_STORAGE_BUCKET`      | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_FIREBASE_MESSAGING_SENDER_ID` | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_FIREBASE_APP_ID`              | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_TELEGRAM_BOT_TOKEN`           | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_TELEGRAM_CHAT_ID`             | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_EMAILJS_SERVICE_ID`           | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_EMAILJS_TEMPLATE_ID`          | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_EMAILJS_PUBLIC_KEY`           | *Dán giá trị từ file .env.local của bạn* |
    | `VITE_NOTIFY_EMAILS`                | *Dán giá trị từ file .env.local của bạn* |

3.  Sau khi thêm đủ 12 biến, hãy kiểm tra lại một lần nữa cho chắc chắn.

### Bước 4: Deploy

Nhấn nút **"Deploy"**.

Vercel sẽ bắt đầu quá trình build và deploy project của bạn. Quá trình này mất khoảng 1-2 phút. Sau khi hoàn tất, Vercel sẽ cung cấp cho bạn một đường link вида `your-project-name.vercel.app`.

Trang web của bạn đã hoạt động!

---

## III. Quản lý và Cập nhật

-   **Tự động Deploy:** Mỗi khi bạn `git push` một thay đổi mới lên nhánh `main` của repository trên GitHub, Vercel sẽ **tự động build và deploy lại** phiên bản mới nhất cho bạn. Bạn không cần phải làm gì thêm.
-   **Custom Domain:** Bạn có thể dễ dàng thêm tên miền riêng của mình (ví dụ: `shopcuaban.com`) trong phần **Settings > Domains** của project trên Vercel.

Chúc bạn thành công!

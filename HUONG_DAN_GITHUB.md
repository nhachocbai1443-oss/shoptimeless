# Hướng dẫn chi tiết: Đưa Project lên GitHub và Cấu hình Thông báo

Chào bạn, tôi đã phân tích, sửa lỗi và thêm các tính năng mới cho project của bạn. Dưới đây là hướng dẫn chi tiết để bạn có thể chạy project đã sửa và đưa nó lên GitHub một cách an toàn.

## I. Tổng quan các thay đổi

1.  **Sửa lỗi Firebase:** Đã khắc phục 3 lỗi chính khiến việc thêm/sửa sản phẩm không hoạt động, bao gồm:
    *   **Lỗi Query:** Sửa lỗi query phức hợp của Firestore mà không cần bạn phải tạo index thủ công trên Firebase Console.
    *   **Lỗi Dữ liệu `undefined`:** Đảm bảo tất cả dữ liệu gửi lên Firestore đều hợp lệ, không chứa giá trị `undefined` gây lỗi.
    *   **Lỗi Bảo mật:** Chuyển toàn bộ API keys và thông tin nhạy cảm ra khỏi code và đưa vào file môi trường `.env.local` để bảo mật.
2.  **Tích hợp Thông báo:** Thêm tính năng tự động gửi thông báo đến Telegram và nhiều địa chỉ email mỗi khi có đơn hàng mới.
3.  **Tạo file `.gitignore`:** Thêm file `.gitignore` chuẩn để đảm bảo các file nhạy cảm (như `.env.local` chứa API keys) và các thư mục không cần thiết (như `node_modules`) sẽ **KHÔNG** bị đưa lên GitHub.

---

## II. Hướng dẫn Cấu hình và Chạy Project

### Bước 1: Cài đặt Dependencies

Mở terminal trong thư mục project (`shop-project`) và chạy lệnh sau:

```bash
npm install
```

### Bước 2: Tạo và Cấu hình file `.env.local`

Đây là bước **quan trọng nhất** để project có thể kết nối đến Firebase và các dịch vụ thông báo.

1.  Tạo một file mới trong thư mục gốc của project và đặt tên là `.env.local`.
2.  Copy toàn bộ nội dung từ file `.env.example` (tôi đã tạo sẵn) và dán vào file `.env.local` của bạn.
3.  Điền đầy đủ các giá trị cho các biến môi trường. Xem hướng dẫn chi tiết bên dưới.

#### **A. Cấu hình Firebase**

Lấy các thông tin này từ **Firebase Console** > **Project Settings** (biểu tượng bánh răng) > **Your apps** > chọn web app của bạn.

```dotenv
VITE_FIREBASE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxxxx
VITE_FIREBASE_APP_ID=1:xxxxxxxxxxxx:web:xxxxxxxxxxxxxxxxxxxxxx
```

#### **B. Cấu hình Telegram Bot**

Để nhận thông báo qua Telegram:

1.  Mở Telegram, tìm **@BotFather** và bắt đầu chat.
2.  Gõ lệnh `/newbot` và làm theo hướng dẫn để tạo bot mới. BotFather sẽ cung cấp cho bạn một **TOKEN**.
3.  Tìm bot bạn vừa tạo và gửi một tin nhắn bất kỳ.
4.  Truy cập URL sau (thay `<TOKEN>` bằng token của bạn): `https://api.telegram.org/bot<TOKEN>/getUpdates`
5.  Trong kết quả JSON, tìm `"chat": {"id": YOUR_CHAT_ID}`. Đó chính là Chat ID của bạn.

```dotenv
VITE_TELEGRAM_BOT_TOKEN=xxxxxxxxxx:xxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_TELEGRAM_CHAT_ID=xxxxxxxxxx
```

#### **C. Cấu hình Email (dùng EmailJS)**

EmailJS là dịch vụ miễn phí cho phép gửi email từ JavaScript mà không cần server.

1.  Đăng ký tài khoản miễn phí tại [https://www.emailjs.com](https://www.emailjs.com).
2.  **Add New Service:** Chọn Gmail và kết nối với tài khoản Gmail bạn muốn dùng để gửi thông báo.
3.  **Create New Template:** Tạo một mẫu email. Bạn có thể dùng các biến tôi đã thiết lập sẵn trong code (ví dụ: `{{product_name}}`, `{{full_name}}`, `{{total_price}}`).
4.  Vào **Account** > **API Keys** để lấy **Public Key**.
5.  Service ID và Template ID có thể tìm thấy trong trang quản lý của EmailJS.

```dotenv
VITE_EMAILJS_SERVICE_ID=service_xxxxxxxx
VITE_EMAILJS_TEMPLATE_ID=template_xxxxxxxx
VITE_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxxx

# Điền các email bạn muốn nhận thông báo, cách nhau bằng dấu phẩy
VITE_NOTIFY_EMAILS=email1@gmail.com,email2@outlook.com
```

### Bước 3: Chạy Project

Sau khi đã cấu hình xong, chạy lệnh:

```bash
npm run dev
```

Mở trình duyệt và truy cập vào địa chỉ được cung cấp (thường là `http://localhost:5173`).

---

## III. Hướng dẫn Đưa Project lên GitHub

Thực hiện các bước sau để chia sẻ code của bạn lên GitHub một cách an toàn.

### Bước 1: Cài đặt Git

Nếu bạn chưa có Git, hãy tải và cài đặt từ [git-scm.com](https://git-scm.com/).

### Bước 2: Khởi tạo Git Repository

Mở terminal trong thư mục `shop-project` và chạy các lệnh sau:

```bash
# Khởi tạo một kho chứa Git mới
git init

# Thêm tất cả các file vào staging area (trừ những file trong .gitignore)
git add .

# Tạo commit đầu tiên
git commit -m "Initial commit: Setup project with Firebase and notification features"
```

### Bước 3: Tạo Repository trên GitHub

1.  Truy cập [GitHub](https://github.com) và đăng nhập.
2.  Nhấn vào dấu `+` ở góc trên bên phải và chọn **New repository**.
3.  Đặt tên cho repository (ví dụ: `my-shop-project`).
4.  Chọn **Private** nếu bạn không muốn người khác xem code.
5.  **KHÔNG** tick vào các ô "Add a README file", "Add .gitignore", "Choose a license".
6.  Nhấn **Create repository**.

### Bước 4: Kết nối và Đẩy Code lên GitHub

GitHub sẽ cung cấp cho bạn một vài dòng lệnh. Hãy copy và chạy các lệnh trong mục `…or push an existing repository from the command line`:

```bash
# Thay URL bằng URL của repository bạn vừa tạo
git remote add origin https://github.com/your-username/your-repository-name.git

# Đổi tên nhánh chính thành main (tiêu chuẩn mới)
git branch -M main

# Đẩy code từ máy bạn lên GitHub
git push -u origin main
```

Bây giờ, toàn bộ code của bạn đã được lưu trữ an toàn trên GitHub. File `.env.local` chứa API keys đã được `.gitignore` bỏ qua và sẽ không xuất hiện trên repository của bạn.

Chúc bạn thành công! Nếu có bất kỳ câu hỏi nào khác, đừng ngần ngại hỏi nhé.

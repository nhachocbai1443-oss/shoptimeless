/**
 * notifications.ts
 * Xử lý gửi thông báo khi có đơn hàng mới:
 * - Telegram Bot: Gửi tin nhắn tới chat của bạn
 * - Email (qua EmailJS hoặc Formspree): Gửi email thông báo
 *
 * Cách cấu hình:
 * 1. Tạo file .env.local và điền các biến sau:
 *    VITE_TELEGRAM_BOT_TOKEN=your_bot_token
 *    VITE_TELEGRAM_CHAT_ID=your_chat_id
 *    VITE_EMAILJS_SERVICE_ID=your_service_id
 *    VITE_EMAILJS_TEMPLATE_ID=your_template_id
 *    VITE_EMAILJS_PUBLIC_KEY=your_public_key
 *    VITE_NOTIFY_EMAILS=email1@gmail.com,email2@gmail.com
 */

export interface OrderNotificationData {
  orderId: string;
  productName: string;
  variantForm: string;
  quantity: number;
  totalPrice: number;
  fullName: string;
  contact: string;
  email: string;
  notes: string;
  paymentMethod: string;
  accountInfo?: string | null;
  // Thêm thông tin chuyển khoản
  paymentDetails?: {
    accountName: string;
    bankName: string;
    accountNo: string;
    transferContent: string;
  };
}

// ============================================================
// TELEGRAM NOTIFICATION
// Hướng dẫn lấy Bot Token và Chat ID:
// 1. Nhắn tin @BotFather trên Telegram, gõ /newbot để tạo bot
// 2. BotFather sẽ cho bạn TOKEN
// 3. Nhắn tin bot của bạn, sau đó truy cập:
//    https://api.telegram.org/bot<TOKEN>/getUpdates
//    để lấy chat_id
// ============================================================
export const sendTelegramNotification = async (order: OrderNotificationData): Promise<void> => {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('Telegram chưa được cấu hình. Thêm VITE_TELEGRAM_BOT_TOKEN và VITE_TELEGRAM_CHAT_ID vào .env.local');
    return;
  }

  const message = `
🛍️ *ĐƠN HÀNG MỚI - STUDYTIMELESS*
━━━━━━━━━━━━━━━━━━━━
📦 *Sản phẩm:* ${order.productName}
🔖 *Hình thức:* ${order.variantForm}
📊 *Số lượng:* ${order.quantity}
💰 *Tổng tiền:* ${order.totalPrice.toLocaleString('vi-VN')}đ
━━━━━━━━━━━━━━━━━━━━
👤 *Khách hàng:* ${order.fullName}
📞 *Liên hệ:* ${order.contact}
📧 *Email:* ${order.email}
💳 *Thanh toán:* ${order.paymentMethod}
${order.accountInfo ? `🔑 *Tài khoản:* ${order.accountInfo}` : ''}
${order.notes ? `📝 *Ghi chú:* ${order.notes}` : ''}
${order.paymentDetails ? `
━━━━━━━━━━━━━━━━━━━━
💸 *THÔNG TIN CHUYỂN KHOẢN*
🏦 *Ngân hàng:* ${order.paymentDetails.bankName}
👤 *Chủ TK:* ${order.paymentDetails.accountName}
🔢 *Số TK:* ${order.paymentDetails.accountNo}
📝 *Nội dung:* ${order.paymentDetails.transferContent}
` : ''}
━━━━━━━━━━━━━━━━━━━━
🆔 *Mã đơn:* \`${order.orderId}\`
🕐 *Thời gian:* ${new Date().toLocaleString('vi-VN')}
  `.trim();

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
    } else {
      console.log('Telegram notification sent successfully!');
    }
  } catch (err) {
    console.error('Failed to send Telegram notification:', err);
  }
};

// ============================================================
// EMAIL NOTIFICATION (dùng EmailJS - miễn phí, không cần backend)
// Hướng dẫn:
// 1. Đăng ký tại https://www.emailjs.com/ (miễn phí 200 email/tháng)
// 2. Tạo Email Service (kết nối Gmail của bạn)
// 3. Tạo Email Template với các biến: {{to_email}}, {{order_id}}, v.v.
// 4. Lấy Service ID, Template ID, Public Key từ dashboard
// ============================================================
export const sendEmailNotification = async (order: OrderNotificationData): Promise<void> => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const notifyEmails = import.meta.env.VITE_NOTIFY_EMAILS; // "email1@gmail.com,email2@gmail.com"

  if (!serviceId || !templateId || !publicKey) {
    console.warn('EmailJS chưa được cấu hình. Thêm VITE_EMAILJS_* vào .env.local');
    return;
  }

  const emailList = notifyEmails ? notifyEmails.split(',').map((e: string) => e.trim()) : [];
  if (emailList.length === 0) {
    console.warn('Chưa có email nhận thông báo. Thêm VITE_NOTIFY_EMAILS vào .env.local');
    return;
  }

  const templateParams = {
    order_id: order.orderId,
    product_name: order.productName,
    variant_form: order.variantForm,
    quantity: order.quantity,
    total_price: `${order.totalPrice.toLocaleString('vi-VN')}đ`,
    full_name: order.fullName,
    contact: order.contact,
    customer_email: order.email,
    payment_method: order.paymentMethod,
    account_info: order.accountInfo || 'N/A',
    notes: order.notes || 'Không có',
    order_time: new Date().toLocaleString('vi-VN'),
    // Thêm thông tin chuyển khoản
    bank_name: order.paymentDetails?.bankName || 'N/A',
    account_name: order.paymentDetails?.accountName || 'N/A',
    account_no: order.paymentDetails?.accountNo || 'N/A',
    transfer_content: order.paymentDetails?.transferContent || 'N/A',
  };

  // Gửi email tới từng địa chỉ trong danh sách
  for (const toEmail of emailList) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            ...templateParams,
            to_email: toEmail
          }
        })
      });

      if (response.ok) {
        console.log(`Email notification sent to ${toEmail}`);
      } else {
        console.error(`Failed to send email to ${toEmail}:`, await response.text());
      }
    } catch (err) {
      console.error(`Error sending email to ${toEmail}:`, err);
    }
  }
};

// ============================================================
// HÀM TỔNG HỢP: Gửi tất cả thông báo cùng lúc
// ============================================================
export const sendAllNotifications = async (order: OrderNotificationData): Promise<void> => {
  // Chạy song song để nhanh hơn
  await Promise.allSettled([
    sendTelegramNotification(order),
    sendEmailNotification(order)
  ]);
};

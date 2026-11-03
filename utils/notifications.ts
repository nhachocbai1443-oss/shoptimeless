/**
 * notifications.ts
 * Xử lý gửi thông báo khi có đơn hàng mới:
 * - Telegram Bot: Gửi tin nhắn tới chat của bạn
 * - Email (qua EmailJS): Gửi email thông báo
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
  // Shop phát sinh đơn: null = shop chính, có slug = shop phụ.
  // shopLabel hiện trong tin Telegram để trong luồng chung vẫn
  // biết đơn này của shop nào (ví dụ "Shop chính" hoặc
  // "Shop phụ: timelesslien").
  shopSlug?: string | null;
  shopLabel?: string;
  // ⭐ THÊM THÔNG TIN CHUYỂN KHOẢN
  paymentDetails?: {
    accountName: string;
    bankName: string;
    accountNo: string;
    transferContent: string;
  };
}

// ============================================================
// TELEGRAM NOTIFICATION
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
${order.shopLabel ? `🏪 *Shop:* ${order.shopLabel}` : ''}
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
// EMAIL NOTIFICATION (dùng EmailJS)
// ============================================================
export const sendEmailNotification = async (
  order: OrderNotificationData,
  // Gmail riêng của shop phụ phát sinh đơn (nếu có). Gmail này
  // chỉ nhận đơn của RIÊNG shop đó, vì CheckoutPage chỉ truyền
  // vào đây Gmail của đúng shop phát sinh đơn, không truyền
  // Gmail của shop khác. Gmail của admin chính (trong .env)
  // vẫn nhận tất cả các đơn như cũ, không bị cắt.
  extraEmails: string[] = []
): Promise<void> => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const notifyEmails = import.meta.env.VITE_NOTIFY_EMAILS;

  if (!serviceId || !templateId || !publicKey) {
    console.warn('EmailJS chưa được cấu hình. Thêm VITE_EMAILJS_* vào .env.local');
    return;
  }

  const emailList: string[] = notifyEmails ? notifyEmails.split(',').map((e: string) => e.trim()).filter(Boolean) : [];
  // Gộp Gmail riêng của shop phụ vào, bỏ trùng với Gmail chính
  // (so sánh không phân biệt hoa/thường) để khỏi gửi 2 lần.
  for (const e of extraEmails) {
    const trimmed = (e || '').trim();
    if (trimmed && !emailList.some((x: string) => x.toLowerCase() === trimmed.toLowerCase())) {
      emailList.push(trimmed);
    }
  }
  if (emailList.length === 0) {
    console.warn('Chưa có email nhận thông báo. Thêm VITE_NOTIFY_EMAILS vào .env.local');
    return;
  }

  // ⭐ THÊM CÁC BIẾN CHUYỂN KHOẢN
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
    // ⭐ THÔNG TIN CHUYỂN KHOẢN
    bank_name: order.paymentDetails?.bankName || 'N/A',
    account_name: order.paymentDetails?.accountName || 'N/A',
    account_no: order.paymentDetails?.accountNo || 'N/A',
    transfer_content: order.paymentDetails?.transferContent || 'N/A',
  };

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
// EMAIL GIAO HÀNG CHO KHÁCH (admin bấm gửi tay ở tab Đơn hàng)
// ============================================================
// Khác với email thông báo cho admin ở trên, email này gửi cho
// KHÁCH (địa chỉ khách nhập lúc đặt đơn) và chỉ gửi khi admin
// nhập nội dung giao hàng rồi bấm gửi — không tự gửi lúc đặt đơn.
// Vì vậy nó cần 1 template EmailJS RIÊNG cho khách (không dùng
// chung template thông báo cho admin, vì nội dung khác hẳn).
// - DÙNG 2 TÀI KHOẢN ĐƯỢC KHÔNG? Được: email giao hàng có thể
//   dùng tài khoản EmailJS khác với email báo đơn cho admin.
//   Tài khoản cũ hết lượt tạo template nhưng template cũ vẫn
//   gửi được, nên cứ để báo đơn cho admin ở tài khoản cũ, còn
//   giao hàng dùng tài khoản mới. Muốn vậy thì đặt thêm 2 biến:
//   VITE_EMAILJS_DELIVERY_SERVICE_ID và
//   VITE_EMAILJS_DELIVERY_PUBLIC_KEY (của tài khoản mới). Nếu
//   không đặt 2 biến này thì hàm tự dùng chung Service ID +
//   Public Key của báo đơn cho admin (tức là 1 tài khoản cho cả
//   2 loại email) — lúc đó template giao hàng bắt buộc phải nằm
//   cùng tài khoản với Service Key đó, không thì EmailJS báo
//   "template ID not found".
// - Biến môi trường cho template giao hàng:
//   VITE_EMAILJS_DELIVERY_TEMPLATE_ID (ID template giao hàng,
//   thuộc cùng tài khoản với Service ID dùng để gửi nó).
// - Trong EmailJS, tạo template mới, đặt ô "To Email" là
//   {{to_email}} để email đi đúng tới khách của từng đơn.
// - Tiêu đề template gợi ý (dán nguyên vào ô Subject):
//   🎉 Đơn hàng #{{order_id}} đã được xử lý thành công!
// - Nội dung template gợi ý (dán vào ô Content, thứ tự đúng
//   như bạn dặn: lời chúc mừng + nội dung giao hàng ở TRÊN,
//   thông tin đơn hàng ở DƯỚI):
//   Xin chào {{full_name}},
//   Đơn hàng #{{order_id}} của Quý khách đã được xử lý thành công!
//   🎁 NỘI DUNG GIAO HÀNG:
//   {{delivery_info}}
//   ─────────────────
//   THÔNG TIN ĐƠN HÀNG:
//   Sản phẩm: {{product_name}} ({{variant_form}} x {{quantity}})
//   Tổng tiền: {{total_price}}
//   Thanh toán: {{payment_method}}
//   Shop: {{shop_name}}
//   (Các biến {{...}} ở trên chính là template_params dưới đây.)
export interface DeliveryEmailData {
  orderId: string;
  productName: string;
  variantForm: string;
  quantity: number;
  totalPrice: number;
  fullName: string;
  customerEmail: string;
  paymentMethod: string;
  shopName: string;
  orderTime?: any;
}

export const sendDeliveryEmail = async (
  order: DeliveryEmailData,
  deliveryInfo: string
): Promise<void> => {
  // Ưu tiên Service Key RIÊNG cho giao hàng (tài khoản mới);
  // không có thì dùng chung Service Key của báo đơn cho admin.
  const serviceId = import.meta.env.VITE_EMAILJS_DELIVERY_SERVICE_ID || import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_DELIVERY_PUBLIC_KEY || import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  const templateId = import.meta.env.VITE_EMAILJS_DELIVERY_TEMPLATE_ID;

  if (!serviceId || !publicKey) {
    throw new Error('Chưa cấu hình EmailJS (thiếu Service ID hoặc Public Key).');
  }
  if (!templateId) {
    throw new Error('Chưa cấu hình template giao hàng: thêm VITE_EMAILJS_DELIVERY_TEMPLATE_ID vào Vercel rồi deploy lại.');
  }
  if (!order.customerEmail?.trim()) {
    throw new Error('Đơn này không có email của khách nên không gửi được.');
  }
  if (!deliveryInfo.trim()) {
    throw new Error('Chưa nhập nội dung giao hàng (tài khoản / mật khẩu).');
  }

  let orderTime = '';
  try {
    if (order.orderTime?.toDate) orderTime = order.orderTime.toDate().toLocaleString('vi-VN');
    else {
      const d = new Date(order.orderTime);
      orderTime = isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN');
    }
  } catch {
    orderTime = '';
  }

  const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: {
        to_email: order.customerEmail.trim(),
        order_id: order.orderId,
        product_name: order.productName,
        variant_form: order.variantForm,
        quantity: order.quantity,
        total_price: `${order.totalPrice.toLocaleString('vi-VN')}đ`,
        full_name: order.fullName,
        customer_email: order.customerEmail,
        payment_method: order.paymentMethod,
        delivery_info: deliveryInfo.trim(),
        shop_name: order.shopName,
        order_time: orderTime,
      }
    })
  });

  if (!response.ok) {
    throw new Error(`EmailJS báo lỗi: ${await response.text()}`);
  }
};

// ============================================================
// HÀM TỔNG HỢP: Gửi tất cả thông báo cùng lúc
// routing:
// - sendTelegram: true = gửi lên luồng Telegram chung (mặc định
//   khi không truyền routing, giữ đúng hành vi cũ). Shop chính
//   luôn truyền true. Shop phụ chỉ truyền true khi admin chính
//   đã bật telegram_enabled cho shop đó, mặc định là false.
//   Lưu ý: công tắc này chỉ quyết định bot CÓ GỬI đơn này lên
//   luồng chung hay không; ai đang ở trong nhóm Telegram chung
//   thì vẫn thấy mọi tin đã gửi lên đó, nên tắt công tắc rồi
//   mà chưa mời phụ đó ra khỏi nhóm thì họ vẫn thấy tin mới.
// - extraEmails: Gmail riêng của shop phụ phát sinh đơn.
// ============================================================
export const sendAllNotifications = async (
  order: OrderNotificationData,
  routing: { sendTelegram?: boolean; extraEmails?: string[] } = {}
): Promise<void> => {
  const sendTelegram = routing.sendTelegram !== false;
  await Promise.allSettled([
    sendTelegram ? sendTelegramNotification(order) : Promise.resolve(),
    sendEmailNotification(order, routing.extraEmails || [])
  ]);
};

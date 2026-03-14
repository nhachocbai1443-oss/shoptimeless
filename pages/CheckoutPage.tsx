// Chỉ cần sửa hàm handleCompleteOrder() trong file CheckoutPage.tsx
// Tìm dòng này (khoảng dòng 104-156):

const handleCompleteOrder = async () => {
  setIsSubmitting(true);
  try {
    const accountInfo = isUpgrade 
      ? (formData.noAccount ? 'Cấp tài khoản mới' : `User: ${formData.account}, Pass: ${formData.password}`) 
      : null;

    const orderData = {
      product_id: product.id,
      product_name: product.name,
      variant_form: currentForm,
      quantity: quantity,
      total_price: totalPrice,
      full_name: formData.fullName,
      contact: formData.contact,
      email: formData.email,
      notes: formData.notes,
      payment_method: selectedMethod?.name || formData.paymentMethod,
      account_info: accountInfo,
      status: 'pending',
      created_at: serverTimestamp()
    };

    // Lưu đơn hàng vào Firestore
    const docRef = await addDoc(collection(db, 'orders'), orderData);

    // ===== PHẦN CẦN SỬA =====
    // Gửi thông báo Telegram và Email (chạy nền, không chặn UI)
    const transferContent = `KTK${Math.floor(10000 + Math.random() * 90000)}`;
    
    sendAllNotifications({
      orderId: docRef.id,
      productName: product.name,
      variantForm: currentForm,
      quantity: quantity,
      totalPrice: totalPrice,
      fullName: formData.fullName,
      contact: formData.contact,
      email: formData.email,
      notes: formData.notes,
      paymentMethod: selectedMethod?.name || formData.paymentMethod,
      accountInfo: accountInfo,
      // ⭐ THÊM THÔNG TIN CHUYỂN KHOẢN
      paymentDetails: selectedMethod ? {
        accountName: selectedMethod.account_name,
        bankName: selectedMethod.bank_name,
        accountNo: selectedMethod.account_no,
        transferContent: transferContent
      } : undefined
    }).catch(err => console.error('Notification error (non-blocking):', err));

    setShowSuccessPopup(true);
  } catch (err: any) {
    console.error('Error saving order:', err);
    if (err.code === 'permission-denied') {
      alert('Lỗi: Không có quyền ghi dữ liệu! Kiểm tra Firestore Security Rules.');
    } else {
      alert(`Lỗi khi lưu đơn hàng: ${err.message || 'Vui lòng thử lại sau.'}`);
    }
  } finally {
    setIsSubmitting(false);
  }
};

// ===== HƯỚNG DẪN =====
// 1. Tìm hàm handleCompleteOrder() trong file CheckoutPage.tsx (khoảng dòng 104)
// 2. Thay thế phần gọi sendAllNotifications() bằng code trên
// 3. Lưu file và test

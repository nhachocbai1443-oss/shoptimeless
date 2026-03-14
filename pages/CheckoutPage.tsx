import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Product, ProductVariant, PaymentMethod, User } from '../types';
import { db } from '../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { sendAllNotifications } from '../utils/notifications';

interface Props {
  user: User | null;
}

const CheckoutPage: React.FC<Props> = ({ user }) => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    contact: '',
    email: '',
    notes: '',
    paymentMethod: '',
    account: '',
    password: '',
    noAccount: false
  });

  const isCTV = user?.role === 'ctv';

  useEffect(() => {
    const fetchData = async () => {
      if (!productId) return;
      setLoading(true);
      try {
        // Fetch Product
        const pDocRef = doc(db, 'products', productId);
        const pDocSnap = await getDoc(pDocRef);
        
        if (!pDocSnap.exists()) {
          setProduct(null);
        } else {
          setProduct({ id: pDocSnap.id, ...pDocSnap.data() } as any);
        }

        // Fetch Settings
        const sDocRef = doc(db, 'app_settings', '1');
        const sDocSnap = await getDoc(sDocRef);
        if (sDocSnap.exists()) {
          const sData = sDocSnap.data();
          if (sData.payment_methods) {
            setPaymentMethods(sData.payment_methods);
            if (sData.payment_methods.length > 0) {
              setFormData(prev => ({ ...prev, paymentMethod: sData.payment_methods[0].id }));
            }
          }
        }
      } catch (err) {
        console.error('Error fetching checkout data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Không tìm thấy sản phẩm!</h2>
        <Link to="/" className="text-primary font-bold hover:underline">Quay lại trang chủ</Link>
      </div>
    );
  }

  const currentForm = selectedVariant ? selectedVariant.form : product.form;
  const unitPrice = selectedVariant 
    ? (isCTV ? selectedVariant.price_ctv : selectedVariant.price_public)
    : (isCTV ? product.price_ctv : product.price_public);
  
  const totalPrice = unitPrice * quantity;
  const isUpgrade = currentForm.toLowerCase().includes('chính chủ');
  const selectedMethod = paymentMethods.find(m => m.id === formData.paymentMethod) || paymentMethods[0];

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

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

      // Gửi thông báo Telegram và Email (chạy nền, không chặn UI)
      const qrData = generateVietQR();
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
        // Thêm thông tin chuyển khoản
        paymentDetails: selectedMethod ? {
          accountName: selectedMethod.account_name,
          bankName: selectedMethod.bank_name,
          accountNo: selectedMethod.account_no,
          transferContent: `KTK${Math.floor(10000 + Math.random() * 90000)}`
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

  const generateVietQR = () => {
    if (!selectedMethod) return { url: '', content: '' };

    // Nếu admin đã upload ảnh QR tùy chỉnh (VD: QR MoMo, ZaloPay chụp từ app), dùng luôn
    if (selectedMethod.custom_qr_url) {
      return {
        url: selectedMethod.custom_qr_url,
        content: ''
      };
    }

    // Nếu không có ảnh QR tùy chỉnh, tạo tự động qua VietQR như cũ
    const amount = totalPrice;
    const addInfo = `KTK${Math.floor(10000 + Math.random() * 90000)}`;
    const accountNo = selectedMethod.account_no;
    const bankId = selectedMethod.bank_name.toLowerCase();
    
    return {
      url: `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${encodeURIComponent(selectedMethod.account_name)}`,
      content: addInfo
    };
  };

  const qrData = generateVietQR();

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 animate-fade-in">
      {/* SUCCESS POPUP */}
      {showSuccessPopup && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
          <div className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-md p-10 flex flex-col items-center gap-6 animate-fade-in">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center text-5xl">
              🎉
            </div>
            <h3 className="text-2xl font-cute font-bold text-gray-800 text-center">Đặt hàng thành công!</h3>
            <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100 w-full text-center space-y-3">
              <p className="text-blue-700 font-bold text-base">📦 Tài khoản sẽ được giao trong vòng 24h</p>
              <p className="text-blue-600 text-sm leading-relaxed">
                Chúng tôi sẽ liên hệ và giao tài khoản qua số <span className="font-bold">Zalo</span> mà bạn đã cung cấp.
              </p>
              <p className="text-gray-500 text-xs">
                Nếu sau 24h chưa nhận được, vui lòng liên hệ lại với chúng tôi.
              </p>
            </div>
            <button
              onClick={() => { setShowSuccessPopup(false); navigate('/'); }}
              className="w-full bg-primary hover:bg-pink-600 text-white py-4 rounded-3xl font-bold shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95 text-lg"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-600 font-bold hover:text-primary hover:border-primary transition-all group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">⬅️</span> Quay lại
          </button>
          <h2 className="text-3xl font-cute font-bold text-gray-800">Thanh toán đơn hàng</h2>
          <div className="w-24"></div> {/* Spacer */}
        </div>

        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
          {/* Left Side: Form / Payment */}
          <div className="flex-1 p-8 md:p-12 border-r border-gray-50">
            {step === 1 ? (
              <div className="space-y-8">
                <div>
                  <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Thông tin khách hàng</h3>
                  <p className="text-gray-400 text-sm">Vui lòng điền đầy đủ để chúng tôi hỗ trợ bạn tốt nhất</p>
                </div>

                <form onSubmit={handleNext} className="space-y-6">
                  {/* Variant Selection */}
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 ml-1">Chọn hình thức sử dụng:</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Default Option */}
                      <button
                        type="button"
                        onClick={() => setSelectedVariant(null)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${!selectedVariant ? 'border-primary bg-pink-50/30' : 'border-gray-50 hover:border-pink-100'}`}
                      >
                        <div className="text-sm font-bold text-gray-800">{product.form}</div>
                        <div className="text-xs text-primary font-bold">{(isCTV ? product.price_ctv : product.price_public).toLocaleString('vi-VN')}đ</div>
                      </button>
                      {/* Variants */}
                      {product.variants?.map((v, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedVariant(v)}
                          className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedVariant === v ? 'border-primary bg-pink-50/30' : 'border-gray-50 hover:border-pink-100'}`}
                        >
                          <div className="text-sm font-bold text-gray-800">{v.form}</div>
                          <div className="text-xs text-primary font-bold">{(isCTV ? v.price_ctv : v.price_public).toLocaleString('vi-VN')}đ</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Họ và tên *</label>
                      <input 
                        required
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                        placeholder="Nhập họ tên của bạn"
                        className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700 ml-1">Số Zalo/Telegram *</label>
                      <input 
                        required
                        type="text"
                        value={formData.contact}
                        onChange={(e) => setFormData({...formData, contact: e.target.value})}
                        placeholder="Nhập số điện thoại liên hệ"
                        className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 ml-1">Địa chỉ email *</label>
                    <input 
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="Nhập email để nhận thông tin tài khoản"
                      className="w-full px-5 py-3 rounded-2xl border-2 border-gray-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all font-medium"
                    />
                  </div>

                  {isUpgrade && (
                    <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-50 space-y-4 animate-slide-up">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                          <span>🔐</span> Thông tin tài khoản cần nâng cấp
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox"
                            checked={formData.noAccount}
                            onChange={(e) => setFormData({...formData, noAccount: e.target.checked})}
                            className="w-4 h-4 accent-primary"
                          />
                          <span className="text-[10px] font-bold text-gray-500 group-hover:text-primary transition-colors">Tôi không có tài khoản, hãy cấp tài khoản riêng tư cho tôi?</span>
                        </label>
                      </div>
                      
                      {!formData.noAccount && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">Tài khoản (Email/User)</label>
                            <input 
                              required={!formData.noAccount}
                              type="text"
                              value={formData.account}
                              onChange={(e) => setFormData({...formData, account: e.target.value})}
                              placeholder="Nhập email hoặc username"
                              className="w-full px-4 py-2.5 rounded-xl border border-blue-100 focus:border-primary focus:outline-none text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-gray-400 uppercase ml-1">Mật khẩu</label>
                            <input 
                              required={!formData.noAccount}
                              type="password"
                              value={formData.password}
                              onChange={(e) => setFormData({...formData, password: e.target.value})}
                              placeholder="Nhập mật khẩu"
                              className="w-full px-4 py-2.5 rounded-xl border border-blue-100 focus:border-primary focus:outline-none text-sm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 ml-1">Phương thức thanh toán</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {paymentMethods.map((method) => (
                        <label 
                          key={method.id}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.paymentMethod === method.id ? 'border-primary bg-pink-50/30' : 'border-gray-50 hover:border-pink-100'}`}
                        >
                          <input 
                            type="radio"
                            name="paymentMethod"
                            value={method.id}
                            checked={formData.paymentMethod === method.id}
                            onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                            className="w-5 h-5 accent-primary"
                          />
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-gray-100 p-1">
                            {method.icon_url ? (
                              <img src={method.icon_url} alt={method.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-xl">💳</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-bold text-gray-800">{method.name}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-primary hover:bg-pink-600 text-white py-5 rounded-3xl font-bold shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95 text-xl"
                  >
                    Tiếp tục thanh toán
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 text-green-600 rounded-full text-4xl mb-4">
                    ✅
                  </div>
                  <h3 className="text-3xl font-cute font-bold text-gray-800">Thông tin chuyển khoản</h3>
                  <p className="text-gray-400">Vui lòng quét mã QR hoặc chuyển khoản thủ công</p>
                </div>

                <div className="bg-gray-50 rounded-[40px] p-8 border border-gray-100">
                  <div className="flex flex-col lg:flex-row gap-10 items-center">
                    <div className="w-full lg:w-1/2 flex flex-col items-center gap-6">
                      <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center w-full max-w-[320px]">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6 text-center leading-relaxed">
                          Bước 1: Mở ứng dụng Ngân hàng/Ví<br/>
                          Bước 2: Chọn quét mã QR bên dưới
                        </div>
                        <img 
                          src={qrData.url} 
                          alt="QR Thanh toán" 
                          className="w-full aspect-square object-contain"
                        />
                      </div>
                    </div>

                    <div className="w-full lg:w-1/2 space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                            <span className="text-sm text-gray-500 font-bold">Chủ tài khoản:</span>
                            <span className="text-sm font-black text-gray-800 uppercase">{selectedMethod?.account_name}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                            <span className="text-sm text-gray-500 font-bold">Ngân hàng:</span>
                            <span className="text-sm font-black text-primary uppercase">{selectedMethod?.bank_name}</span>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                            <span className="text-sm text-gray-500 font-bold">Số tài khoản:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-gray-800">{selectedMethod?.account_no}</span>
                              <button type="button" className="text-xs bg-gray-100 p-2 rounded-xl hover:bg-gray-200 transition-all" onClick={() => navigator.clipboard.writeText(selectedMethod?.account_no || '')}>📋</button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                            <span className="text-sm text-gray-500 font-bold">Số tiền:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-black text-red-500">{totalPrice.toLocaleString('vi-VN')}đ</span>
                              <button type="button" className="text-xs bg-gray-100 p-2 rounded-xl hover:bg-gray-200 transition-all" onClick={() => navigator.clipboard.writeText(totalPrice.toString())}>📋</button>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-3 border-b border-gray-200/50">
                            <span className="text-sm text-gray-500 font-bold">Nội dung:</span>
                            {qrData.content ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100 tracking-widest">{qrData.content}</span>
                                <button type="button" className="text-xs bg-gray-100 p-2 rounded-xl hover:bg-gray-200 transition-all" onClick={() => navigator.clipboard.writeText(qrData.content)}>📋</button>
                              </div>
                            ) : (
                              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-100">Điền tên / số Zalo của bạn</span>
                            )}
                          </div>
                        </div>
                      </div>


                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setStep(1)}
                    className="flex-1 px-8 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-all border-2 border-transparent"
                  >
                    Quay lại sửa thông tin
                  </button>
                  <button 
                    onClick={handleCompleteOrder}
                    disabled={isSubmitting}
                    className="flex-[2] bg-green-500 hover:bg-green-600 text-white py-4 rounded-2xl font-bold shadow-xl shadow-green-200 transition-all transform hover:-translate-y-1 active:scale-95 text-xl disabled:bg-gray-300"
                  >
                    {isSubmitting ? '🚀 Đang xử lý...' : 'Tôi Đã Thanh Toán'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Order Summary */}
          <div className="w-full md:w-[380px] bg-gray-50/50 p-8 md:p-12 flex flex-col">
            <h4 className="text-xl font-cute font-bold text-gray-800 mb-8">Tóm tắt đơn hàng</h4>
            
            <div className="flex-1 space-y-8">
              <div className="flex gap-5">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md shrink-0">
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="space-y-1">
                  <div className="text-base font-bold text-gray-800 line-clamp-2">{product.name}</div>
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">{product.category}</div>
                </div>
              </div>

              <div className="space-y-4 py-6 border-y border-gray-200/50">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Hình thức:</span>
                  <span className="font-bold text-blue-500">{currentForm}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Thời hạn:</span>
                  <span className="font-bold text-purple-500">{product.package}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Số lượng:</span>
                  <div className="flex items-center gap-4">
                    <button 
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 flex items-center justify-center bg-white border-2 border-gray-100 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-all font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-gray-800 w-4 text-center">{quantity}</span>
                    <button 
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center bg-white border-2 border-gray-100 rounded-xl text-gray-500 hover:text-primary hover:border-primary transition-all font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tạm tính:</span>
                  <span className="font-bold text-gray-800">{totalPrice.toLocaleString('vi-VN')}đ</span>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-lg font-bold text-gray-800">Tổng cộng:</span>
                  <span className="text-3xl font-cute font-bold text-primary">{totalPrice.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex items-start gap-4 text-xs text-gray-400 font-medium leading-relaxed">
                <span className="text-2xl">🛡️</span>
                <div>
                  <p className="text-gray-600 font-bold mb-1">Bảo mật & An toàn</p>
                  Thông tin của bạn được mã hóa và bảo mật tuyệt đối 100%.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';
import LoginForm from '../components/LoginForm';
import { RESERVED_SLUGS } from '../utils/shop';

interface Props {
  onLogin: (user: User) => void;
  // User hiện tại (nếu đã đăng nhập sẵn mà gõ thẳng /login).
  // Trước đây App chặn trường hợp này bằng <Navigate to="/" />
  // ở route, và chính lệnh đó đã ghi đè lệnh về shop phụ sau
  // khi đăng nhập xong. Giờ chặn đó bỏ, Login tự xử lý ở đây.
  user?: User | null;
}

const Login: React.FC<Props> = ({ onLogin, user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Shop mà người này bấm Đăng nhập từ đó (nút Đăng nhập ở header
  // gửi kèm theo). Chỉ dùng khi nó là mã shop hợp lệ, không phải
  // route hệ thống (admin, login, checkout, ...).
  const returnShop = (location.state as any)?.returnShop;
  const validReturnShop =
    typeof returnShop === 'string' &&
    returnShop.length > 0 &&
    !RESERVED_SLUGS.includes(returnShop) &&
    returnShop !== 'product'
      ? returnShop
      : null;

  // Luật đích đến dùng chung cho cả 2 đường: đăng nhập xong và
  // đã đăng nhập sẵn mà vào lại /login.
  const destinationFor = (u: User): string => {
    if (u.role === 'admin') {
      return '/admin';
    }
    if (u.role === 'subadmin' && u.shop_slug) {
      // Admin phụ đăng nhập ở đâu cũng về trang quản lý của shop
      // mình, không vào trang admin chính.
      return `/${u.shop_slug}/admin`;
    }
    if (u.role === 'ctv' && u.shop_slug) {
      // CTV của shop phụ đăng nhập ở đâu cũng về link shop của
      // mình để xem giá CTV của shop đó, không về trang chủ chính
      // và không vào trang quản lý. CTV chính (không gắn mã shop)
      // thì rơi xuống nhánh returnShop bên dưới như cũ.
      return `/${u.shop_slug}`;
    }
    if (validReturnShop) {
      // CTV và khách đăng nhập từ shop phụ thì về lại link shop
      // đó (ví dụ /#/abc) để mua hàng với giá của shop đó, không
      // về trang chủ chính và không vào trang quản lý.
      return `/${validReturnShop}`;
    }
    return '/';
  };

  // Đã đăng nhập sẵn mà vào /login thì đi thẳng tới đích, khỏi
  // hiện lại form đăng nhập.
  useEffect(() => {
    if (user) {
      navigate(destinationFor(user), { replace: true });
    }
    // Chỉ chạy khi user đổi từ chưa có thành đã có; returnShop
    // lấy từ state của lần vào trang này, không cần theo dõi thêm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleLoginSuccess = (loggedInUser: User) => {
    onLogin(loggedInUser);
    navigate(destinationFor(loggedInUser));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
      <button
        onClick={() => navigate(validReturnShop ? `/${validReturnShop}` : '/')}
        className="absolute top-4 left-4 flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-bold"
      >
        <span>⬅️</span> Quay lại trang chủ
      </button>
      <div className="w-full max-w-md">
        <LoginForm onLogin={handleLoginSuccess} />
      </div>
    </div>
  );
};

export default Login;

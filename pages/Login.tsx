import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';
import LoginForm from '../components/LoginForm';
import { RESERVED_SLUGS } from '../utils/shop';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
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

  const handleLoginSuccess = (user: User) => {
    onLogin(user);
    if (user.role === 'admin') {
      navigate('/admin');
    } else if (user.role === 'subadmin' && user.shop_slug) {
      // Admin phụ đăng nhập ở đâu cũng về trang quản lý của shop
      // mình, không vào trang admin chính.
      navigate(`/${user.shop_slug}/admin`);
    } else if (validReturnShop) {
      // CTV và khách đăng nhập từ shop phụ thì về lại link shop
      // đó (ví dụ /#/abc) để mua hàng với giá của shop đó, không
      // về trang chủ chính và không vào trang quản lý.
      navigate(`/${validReturnShop}`);
    } else {
      navigate('/');
    }
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

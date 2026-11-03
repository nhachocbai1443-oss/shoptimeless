import React from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../types';
import LoginForm from '../components/LoginForm';

interface Props {
  onLogin: (user: User) => void;
}

const Login: React.FC<Props> = ({ onLogin }) => {
  const navigate = useNavigate();

  const handleLoginSuccess = (user: User) => {
    onLogin(user);
    if (user.role === 'admin') {
      navigate('/admin');
    } else if (user.role === 'subadmin' && user.shop_slug) {
      // Admin phụ đăng nhập ở đâu cũng về trang quản lý của shop
      // mình, không vào trang admin chính.
      navigate(`/${user.shop_slug}/admin`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] relative">
      <button 
        onClick={() => navigate('/')}
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

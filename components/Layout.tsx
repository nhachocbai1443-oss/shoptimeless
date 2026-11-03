import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from '../types';
import { RESERVED_SLUGS, getShopSettings, DEFAULT_CONTACT_LINKS, ContactLinks } from '../utils/shop';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  // Trang checkout là route chung (/#/checkout/:id) nên không đọc
  // được mã shop từ đường link; App truyền mã shop của sản phẩm
  // đang checkout vào đây để nút liên hệ hiện đúng của shop đó.
  checkoutShopSlug?: string | null;
}

const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, checkoutShopSlug }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Nút liên hệ nổi: ban đầu hiện link mặc định của web, rồi tải
  // link thật theo shop đang xem (xem useEffect dưới).
  const [contactLinks, setContactLinks] = useState<ContactLinks>(DEFAULT_CONTACT_LINKS);

  useEffect(() => {
    const loadContactLinks = async () => {
      try {
        // Xác định shop đang xem từ đường link: /{slug},
        // /{slug}/admin, /{slug}/admin/product/... đều là shop
        // phụ; các route hệ thống (admin, login, checkout, ...)
        // thì không phải shop. Trang checkout dùng mã shop mà
        // App truyền vào (vì route checkout không chứa mã shop).
        const firstSegment = location.pathname.replace(/^\//, '').split('/')[0] || '';
        let shopSlug: string | null = null;
        if (firstSegment === 'checkout' && checkoutShopSlug) {
          shopSlug = checkoutShopSlug;
        } else if (firstSegment && !RESERVED_SLUGS.includes(firstSegment) && firstSegment !== 'product') {
          shopSlug = firstSegment;
        }
        let links: ContactLinks | undefined;
        if (shopSlug) {
          const shopSettings = await getShopSettings(shopSlug);
          if (shopSettings?.contact_links) links = shopSettings.contact_links;
        }
        if (!links) {
          const mainSnap = await getDoc(doc(db, 'app_settings', '1'));
          if (mainSnap.exists() && mainSnap.data().contact_links) {
            links = mainSnap.data().contact_links;
          }
        }
        if (links) {
          setContactLinks({
            messenger: links.messenger || '',
            zalo: links.zalo || '',
            telegram: links.telegram || '',
          });
        }
      } catch (err) {
        console.error('Error loading contact links:', err);
      }
    };
    loadContactLinks();
  }, [location.pathname, checkoutShopSlug]);

  return (
    <div className="min-h-screen flex flex-col items-center relative">
      {/* Header */}
      <header className="w-full max-w-7xl px-4 py-3 flex justify-between items-center z-10 shrink-0">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-4xl hover:animate-bounce transition-transform">🛍️</span>
          <h1 className="text-3xl font-cute font-bold text-primary drop-shadow-sm hidden sm:block">
            Studytimeless
          </h1>
          <h1 className="text-3xl font-cute font-bold text-primary drop-shadow-sm sm:hidden">
            Shop
          </h1>
        </div>
        
        {/* Right: User Info & Login */}
        <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-500 font-medium">Xin chào,</span>
                  <span className="text-sm font-bold text-primary">{user.username}</span>
                </div>
                {user.role === 'admin' && (
                  <Link
                    to="/admin"
                    className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-4 py-2 rounded-2xl text-sm font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    ⚙️ Quản lý
                  </Link>
                )}
                {user.role === 'subadmin' && user.shop_slug && (
                  <Link
                    to={`/${user.shop_slug}/admin`}
                    className="bg-pink-100 hover:bg-pink-200 text-pink-700 px-4 py-2 rounded-2xl text-sm font-bold transition flex items-center gap-1 shadow-sm"
                  >
                    ⚙️ Quản lý shop
                  </Link>
                )}
                <button 
                  onClick={onLogout}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-2xl text-sm font-bold transition shadow-sm flex items-center gap-1"
                >
                  🚪 Thoát
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-end gap-1">
                <Link 
                  to="/login" 
                  className="bg-primary hover:bg-pink-700 text-white px-6 py-2.5 rounded-2xl text-sm font-bold transition shadow-md flex items-center gap-2"
                >
                  🔑 Đăng nhập
                </Link>
                <span className="text-[10px] text-gray-400 font-medium italic">Chỉ Dành cho Admin</span>
              </div>
            )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl px-4 pb-10 flex-1 flex flex-col">
        {children}
      </main>

      {/* Floating Contact Icons — link lấy từ cài đặt của shop
          đang xem (shop chính hoặc shop phụ), để trống 1 link
          trong cài đặt thì nút đó không hiện nữa. */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-4 animate-fade-in">
        {contactLinks.messenger && (
          <a
            href={contactLinks.messenger}
            target="_blank"
            rel="noreferrer"
            className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform border-2 border-white"
            title="Messenger"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/be/Facebook_Messenger_logo_2020.svg" alt="Messenger" className="w-8 h-8" />
          </a>
        )}
        {contactLinks.zalo && (
          <a
            href={contactLinks.zalo}
            target="_blank"
            rel="noreferrer"
            className="w-14 h-14 bg-blue-500 rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform border-2 border-white"
            title="Zalo"
          >
            <img src="https://upload.wikimedia.org/wikipedia/commons/9/91/Icon_of_Zalo.svg" alt="Zalo" className="w-8 h-8" />
          </a>
        )}
        {contactLinks.telegram && (
          <a
            href={contactLinks.telegram}
            target="_blank"
            rel="noreferrer"
            className="w-14 h-14 bg-[#229ED9] rounded-full shadow-lg flex items-center justify-center text-white text-2xl hover:scale-110 transition-transform border-2 border-white"
            title="Telegram"
          >
           <img src="https://upload.wikimedia.org/wikipedia/commons/5/5a/Telegram_2019_simple_logo.svg" alt="Telegram" className="w-8 h-8" />
          </a>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full py-6 text-center text-gray-400 text-xs font-medium">
        © {new Date().getFullYear()} Studytimeless Premium Shop • Designed with 💖
      </footer>
    </div>
  );
};

export default Layout;

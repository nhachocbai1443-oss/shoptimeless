import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CheckoutPage from './pages/CheckoutPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductNotesPage from './pages/ProductNotesPage';
import ShopPage from './pages/ShopPage';
import { User } from './types';

const SESSION_KEY = 'studytimeless_user';

// Trang quản lý của shop phụ: chỉ admin phụ sở hữu đúng mã shop
// đó mới vào được, còn lại đẩy về trang shop đó (dạng khách).
function ShopAdminPage({ user }: { user: User | null }) {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  if (!shopSlug) return <Navigate to="/" />;
  if (!user || user.role !== 'subadmin' || user.shop_slug !== shopSlug) {
    return <Navigate to={`/${shopSlug}`} />;
  }
  return <AdminDashboard user={user} shopSlug={shopSlug} />;
}

function ShopProductFormPage({ user }: { user: User | null }) {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  if (!shopSlug) return <Navigate to="/" />;
  if (!user || user.role !== 'subadmin' || user.shop_slug !== shopSlug) {
    return <Navigate to={`/${shopSlug}`} />;
  }
  return <ProductFormPage user={user} shopSlug={shopSlug} />;
}

// Chặn web chính trên domain lạ (user chốt 04/11: domain mới gắn
// thêm chỉ mở shop phụ, không mở web chính). Web chính chỉ mở
// được trên domain chính (cả www và apex) + localhost để chạy
// thử ở máy mình. Mọi domain khác (domain mới gắn thêm, link
// vercel.app...) đều bị chặn web chính: trang chủ chính (/) và
// trang quản trị chính (/admin...) chỉ hiện thông báo bên dưới,
// KHÔNG redirect để khỏi lặp điều hướng (ví dụ /admin mà
// redirect về / thì / lại redirect về /admin). Các link shop phụ,
// trang quản lý shop phụ, trang đăng nhập, checkout và trang ghi
// chú sản phẩm thì vẫn mở bình thường vì shop phụ cần chúng để
// bán hàng (ghi chú sản phẩm là nội dung theo từng sản phẩm, nút
// "Xem thêm" ở bảng shop phụ cũng mở nó).
const MAIN_HOSTS = ['www.shoptimeless.io.vn', 'shoptimeless.io.vn'];
function isMainHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return MAIN_HOSTS.includes(host) || host === 'localhost' || host === '127.0.0.1';
}

function BlockedMainPage() {
  return (
    <div className="text-center py-32">
      <div className="text-6xl mb-6">🔒</div>
      <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Không mở được trang này trên domain này</h3>
      <p className="text-gray-400 max-w-md mx-auto">
        Domain này chỉ dùng cho các shop phụ. Bạn vui lòng mở đúng link shop phụ bạn nhận được,
        hoặc đăng nhập để vào shop của mình.
      </p>
      <Link
        to="/login"
        className="mt-6 inline-block bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-md"
      >
        Đăng nhập
      </Link>
    </div>
  );
}

// Lưới an toàn: trước đây 1 trang con crash (ví dụ shop phụ gặp
// sản phẩm thiếu field) là cả web trắng tinh, không header, không
// báo lỗi gì. Giờ crash thì chỉ phần nội dung hiện thông báo và
// nút tải lại, header vẫn còn, người dùng biết lỗi ở đâu.
class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: any) {
    return { hasError: true, message: err?.message || 'Lỗi không xác định.' };
  }
  componentDidCatch(err: any) {
    console.error('Page error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
          <div className="text-6xl mb-6">⚠️</div>
          <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Trang này gặp lỗi</h3>
          <p className="text-gray-400">{this.state.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-md"
          >
            🔄 Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Vì sao trang admin "để lâu rồi vào lại thì bấm Sửa không được,
 * thoát ra đăng nhập lại mới được":
 *
 * 1. Web này đăng nhập chỉ bằng username, lưu vào localStorage, KHÔNG
 *    đăng nhập Firebase Auth thật. Vì vậy auth.currentUser luôn là null
 *    và không có ID token nào để Firebase SDK tự làm mới sau ~1 giờ.
 *    Đoạn code cũ ghi chú "Firebase tự refresh" là không đúng với app này.
 * 2. Code cũ chỉ kiểm tra lại session khi `visibilitychange`, mà không
 *    chạy khi quay lại bằng nút Back, khi focus cửa sổ, hay khi tab được
 *    khôi phục từ bộ nhớ đệm của trình duyệt (bfcache). Lúc đó trang vẫn
 *    render từ dữ liệu cũ trong bộ nhớ, nhưng state admin / kết nối
 *    Firestore đã lệch, nên bấm Sửa không đi tiếp được.
 * 3. Khi kiểm tra lại mà Firestore trả lỗi (mạng chập chờn,
 *    permission-denied do token cũ), code cũ giữ nguyên session cũ và
 *    không làm gì thêm, nên lần bấm tiếp theo vẫn lỗi y hệt.
 *
 * Cách fix trong file này (chỉ sửa App.tsx, không sửa giao diện,
 * không sửa ProductTable, không đổi luồng đăng nhập):
 *
 * - Tạo một phiên Firebase Auth ẩn (anonymous) và để SDK tự làm mới
 *   token của nó. Phiên này KHÔNG thay thế đăng nhập username: cổng
 *   admin vẫn chỉ mở khi user trong localStorage có role === 'admin'.
 *   Nếu trong Firebase Console chưa bật Anonymous thì bước này lỗi
 *   im lặng và web vẫn chạy như cũ, chỉ không có token để tự làm mới.
 * - Mỗi lần quay lại trang (mở trang, hiện tab, focus cửa sổ, khôi phục
 *   từ bfcache) đều đối chiếu lại username đã lưu với bảng `users`
 *   trong Firestore và sửa lại state + localStorage cho khớp, KHÔNG
 *   cần đăng xuất / đăng nhập lại.
 * - Lỗi thoáng qua (mất mạng, permission) KHÔNG được đăng xuất user,
 *   chỉ giữ nguyên session đang có để lần sau tự sửa lại.
 */
function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved) as User;
      // Session hỏng (không có username) thì bỏ, tránh crash cả trang.
      if (!parsed || typeof parsed.username !== 'string' || !parsed.username) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  });

  // Chặn chạy trùng nhiều lần khi focus + visibilitychange bắn cùng lúc.
  const refreshInFlight = useRef<Promise<User | null> | null>(null);
  // Nếu Firebase chưa bật Anonymous thì chỉ cảnh báo 1 lần, không spam.
  const anonymousFailed = useRef(false);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  // Đảm bảo có một phiên Firebase Auth thật để SDK tự làm mới token.
  // Trả về true nếu đã có phiên hoặc vừa tạo được, false nếu không
  // (ví dụ chưa bật Anonymous trong Firebase Console).
  const ensureFirebaseSession = useCallback(async (): Promise<boolean> => {
    try {
      if (auth.currentUser) return true;
      if (anonymousFailed.current) return false;
      await signInAnonymously(auth);
      return true;
    } catch (err) {
      anonymousFailed.current = true;
      console.warn(
        'Firebase anonymous sign-in không dùng được (có thể chưa bật ' +
          'Anonymous trong Firebase Console > Authentication). ' +
          'Web vẫn chạy bằng session username như cũ.',
        err
      );
      return false;
    }
  }, []);

  // Đối chiếu session username đã lưu với DB, sửa lại state + localStorage.
  // - User không còn trong DB -> đăng xuất thật (đây là trường hợp duy
  //   nhất được phép đăng xuất tự động).
  // - Lỗi mạng / permission -> giữ nguyên session, không đăng xuất,
  //   để lần quay lại sau tự sửa.
  const refreshSession = useCallback(async (): Promise<User | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = (async (): Promise<User | null> => {
      let saved: User | null = null;
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        saved = JSON.parse(raw) as User;
        if (!saved || typeof saved.username !== 'string' || !saved.username) {
          return null;
        }
      } catch {
        return null;
      }

      // Có token Firebase thật trước rồi mới query, để query không phải
      // chạy bằng kết nối cũ đã hết hạn sau thời gian dài không vào.
      await ensureFirebaseSession();

      try {
        const q = query(
          collection(db, 'users'),
          where('username', '==', saved.username)
        );
        const snap = await getDocs(q);
        if (snap.empty) {
          // User đã bị xóa khỏi DB -> đăng xuất là đúng.
          handleLogout();
          return null;
        }
        const data = snap.docs[0].data();
        // DB thắng nếu có đủ field; field nào DB thiếu thì giữ lại giá
        // trị đã lưu, tránh ghi đè session tốt bằng document thiếu role.
        const freshUser: User = {
          ...saved,
          ...data,
          id: snap.docs[0].id,
          username: (data.username as string) || saved.username,
          role: (data.role as User['role']) || saved.role,
        } as User;
        setUser(freshUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(freshUser));
        return freshUser;
      } catch (err) {
        // Lỗi thoáng qua: giữ nguyên session, tuyệt đối không logout.
        console.warn('Session refresh skipped:', err);
        return saved;
      }
    })();

    refreshInFlight.current = run;
    try {
      return await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, [ensureFirebaseSession, handleLogout]);

  // Lắng nghe Firebase Auth: nếu phiên ẩn bị mất thì tạo lại im lặng,
  // không động vào session username (không đăng xuất user).
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser && localStorage.getItem(SESSION_KEY)) {
        await ensureFirebaseSession();
      }
    });
    return () => unsubscribe();
  }, [ensureFirebaseSession]);

  // Làm mới session mỗi lần quay lại trang, bằng mọi đường quay lại:
  // mở trang lần đầu, hiện tab, focus cửa sổ, khôi phục từ bfcache.
  // Code cũ chỉ có visibilitychange nên bỏ sót các đường còn lại.
  useEffect(() => {
    refreshSession();

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshSession();
      }
    };
    const handleFocus = () => {
      refreshSession();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      // Tab khôi phục từ bfcache: React state + kết nối Firestore có
      // thể đã cũ, nên đối chiếu lại session ngay.
      if (event.persisted) {
        refreshSession();
      }
    };
    // Tab khác đăng nhập / đăng xuất thì tab này đồng bộ theo, khỏi
    // rơi vào trạng thái 1 tab đã thoát mà 1 tab vẫn tưởng còn admin.
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_KEY) return;
      if (!event.newValue) {
        setUser(null);
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as User;
        if (parsed && parsed.username) setUser(parsed);
      } catch {
        // Giá trị hỏng thì để lần refresh sau xử lý, không crash trang.
      }
    };

    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('storage', handleStorage);
    return () => {
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshSession]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newUser));
    // Tạo luôn phiên Firebase ẩn ngay sau khi đăng nhập, để các lần
    // lưu sản phẩm sau đó không phải chạy bằng kết nối không token.
    ensureFirebaseSession();
  };

  // Mã shop của sản phẩm đang checkout (để Layout hiện nút liên
  // hệ đúng của shop đó, vì route checkout không chứa mã shop).
  const [checkoutShopSlug, setCheckoutShopSlug] = useState<string | null>(null);

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout} checkoutShopSlug={checkoutShopSlug}>
        <PageErrorBoundary>
        <Routes>
          {/* Mở link gốc mà đang đăng nhập sẵn admin thì tự chuyển
              thẳng sang trang Quản lý, khỏi phải bấm Quản lý hay
              đăng xuất đăng nhập lại. Admin phụ thì về trang quản
              lý của shop mình. Khách và CTV vẫn vào trang chủ bình
              thường (có nút Mua ngay) như cũ.
              Ngoại lệ trên domain lạ: web chính bị chặn nên link
              gốc không mở trang chủ chính nữa — admin phụ thì vẫn
              về trang quản lý của shop mình (đó là web phụ, không
              phải web chính), còn lại hiện thông báo chặn. */}
          <Route
            path="/"
            element={
              !isMainHost()
                ? (user && user.role === 'subadmin' && user.shop_slug
                    ? <Navigate to={`/${user.shop_slug}/admin`} replace />
                    : <BlockedMainPage />)
                : user && user.role === 'admin'
                  ? <Navigate to="/admin" replace />
                  : user && user.role === 'subadmin' && user.shop_slug
                    ? <Navigate to={`/${user.shop_slug}/admin`} replace />
                    : <Home user={user} />
            }
          />

          {/* Shop phụ: /#/mã-link là trang sản phẩm riêng của shop
              đó, /#/mã-link/admin là trang quản lý của shop đó.
              Route động này đặt sau các route tĩnh (/admin, /login,
              /checkout/...) nên không nuốt mất các route đó. */}
          <Route path="/:shopSlug" element={<ShopPage user={user} />} />
          <Route path="/:shopSlug/admin" element={<ShopAdminPage user={user} />} />
          <Route path="/:shopSlug/admin/product/:productId" element={<ShopProductFormPage user={user} />} />

          {/* Trang đăng nhập KHÔNG được chặn kiểu "đã đăng nhập
              thì đẩy về /" ở đây nữa. Lần trước chính cái chặn này
              gây lỗi: CTV đăng nhập từ shop phụ, Login vừa điều
              hướng về link shop phụ thì App render lại, thấy user
              đã có là đẩy tiếp về '/', và '/' với CTV lại là trang
              chủ chính — nên cứ bấm đăng nhập ở link shop phụ là
              lại về link gốc. Việc "đã đăng nhập mà vào /login thì
              đi đâu" giờ do chính Login.tsx xử lý (xem useEffect
              ở đó), với cùng luật đích đến, không còn 2 lệnh điều
              hướng giành nhau nữa. */}
          <Route
            path="/login"
            element={<Login onLogin={handleLogin} user={user} />}
          />

          {/* Trang quản trị chính: trên domain lạ thì chặn hẳn
              (hiện thông báo), kể cả khi đã đăng nhập admin chính
              — vì web chính chỉ mở trên domain chính. */}
          <Route
            path="/admin"
            element={
              !isMainHost()
                ? <BlockedMainPage />
                : user && user.role === 'admin'
                  ? <AdminDashboard user={user} />
                  : <Navigate to="/" />
            }
          />

          <Route
            path="/admin/product/:productId"
            element={
              !isMainHost()
                ? <BlockedMainPage />
                : user && user.role === 'admin'
                  ? <ProductFormPage user={user} />
                  : <Navigate to="/" />
            }
          />

          <Route path="/checkout/:productId" element={<CheckoutPage user={user} onProductShopSlug={setCheckoutShopSlug} />} />

          {/* Trang ghi chú sản phẩm KHÔNG chặn trên domain lạ: nó
              là nội dung theo từng sản phẩm, bảng shop phụ cũng
              dùng nó (nút "Xem thêm" ở cột ghi chú). */}
          <Route path="/product-notes/:productId" element={<ProductNotesPage />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </PageErrorBoundary>
      </Layout>
    </HashRouter>
  );
}

export default App;

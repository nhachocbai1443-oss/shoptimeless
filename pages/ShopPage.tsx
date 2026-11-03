import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { Product, User, Category } from '../types';
import ProductTable from '../components/ProductTable';
import { RESERVED_SLUGS } from '../utils/shop';

interface Props {
  user: User | null;
}

const DEFAULT_CATEGORY_INFO: Record<string, { icon: string; desc: string; color: string }> = {
  'Học Tập – Công việc – Đồ họa': { icon: '🎓', desc: 'Học tập / làm việc hiệu quả hơn với các tài khoản bản quyền.', color: 'from-blue-500 to-indigo-600' },
  'CÔNG CỤ': { icon: '🛠️', desc: 'Các công cụ hỗ trợ đắc lực cho mọi nhu cầu.', color: 'from-orange-400 to-red-500' },
  'TÀI KHOẢN AI': { icon: '🤖', desc: 'Các công cụ AI mạnh mẽ nhất hiện nay với giá ưu đãi ...', color: 'from-emerald-400 to-teal-600' },
  'GIẢI TRÍ NGHE NHẠC': { icon: '🎵', desc: 'Giải trí thả ga, không lo về giá...', color: 'from-purple-500 to-pink-600' },
};

// Trang sản phẩm riêng của 1 shop phụ, dạng khách.
// Link: /#/mã-link. Trang này KHÔNG hiện username của admin phụ,
// chỉ hiện tên shop, vì đăng nhập chỉ cần username.
const ShopPage: React.FC<Props> = ({ user }) => {
  const { shopSlug } = useParams<{ shopSlug: string }>();
  const [shop, setShop] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryInfo, setCategoryInfo] = useState<Record<string, { icon: string; desc: string; color: string }>>(DEFAULT_CATEGORY_INFO);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  const isOwner = user?.role === 'subadmin' && user.shop_slug === shopSlug;

  useEffect(() => {
    const load = async () => {
      if (!shopSlug || RESERVED_SLUGS.includes(shopSlug)) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const userSnap = await getDocs(
          query(collection(db, 'users'), where('shop_slug', '==', shopSlug), where('role', '==', 'subadmin'))
        );
        if (userSnap.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const owner = { id: userSnap.docs[0].id, ...userSnap.docs[0].data() } as User;
        setShop(owner);

        const prodSnap = await getDocs(collection(db, 'products'));
        const all = prodSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[];
        const mine = all
          .filter((p) => p.shop_slug === shopSlug)
          // Sản phẩm đang ẩn thì khách không thấy, chỉ admin phụ
          // chủ shop mới thấy để kiểm tra.
          .filter((p) => isOwner || !p.is_hidden)
          // Chuẩn hóa giá: sản phẩm nào thiếu giá thì về 0 thay
          // vì để undefined làm crash trang. Không ghi gì về
          // Firestore hay localStorage ở đây, chỉ chuẩn hóa lúc
          // hiển thị để admin phụ vào sửa giá sau được.
          .map((p) => ({
            ...p,
            price_public: Number((p as any).price_public) || 0,
            price_ctv: Number((p as any).price_ctv) || 0,
            variants: (p.variants || []).map((v: any) => ({
              ...v,
              price_public: Number(v.price_public) || 0,
              price_ctv: Number(v.price_ctv) || 0,
            })),
          }))
          .sort((a, b) => {
            if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
            return b.is_hot ? 1 : -1;
          });
        setProducts(mine);

        const settingsSnap = await getDoc(doc(db, 'app_settings', '1'));
        if (settingsSnap.exists() && settingsSnap.data().categories?.length > 0) {
          const cats: Category[] = settingsSnap.data().categories;
          const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order);
          const infoMap: Record<string, { icon: string; desc: string; color: string }> = {};
          const orderArr: string[] = [];
          sorted.forEach((cat) => {
            infoMap[cat.name] = { icon: cat.icon, desc: cat.desc, color: cat.color };
            orderArr.push(cat.name);
          });
          setCategoryInfo(infoMap);
          setCategoryOrder(orderArr);
        }
      } catch (err: any) {
        console.error('Error loading shop:', err);
        // Trước đây lỗi tải (mạng, quyền Firestore, thiếu index)
        // không đặt cờ notFound, lại thêm chỗ render dùng trực
        // tiếp p.name/p.category nên 1 sản phẩm thiếu field là cả
        // trang crash trắng. Giờ lỗi nào cũng hiện thành thông báo
        // rõ ràng, không bao giờ để trang trắng.
        setLoadError(err?.message || 'Không tải được shop.');
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [shopSlug, isOwner]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
        <p className="text-gray-400 font-cute text-2xl">Đang tải shop...</p>
      </div>
    );
  }

  if (notFound || !shop) {
    return (
      <div className="text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
        <div className="text-6xl mb-6">🏜️</div>
        <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Không mở được shop mang mã “{shopSlug}”</h3>
        <p className="text-gray-400">
          {loadError
            ? `Lỗi tải shop: ${loadError} — thử tải lại trang, hoặc kiểm tra lại link shop.`
            : 'Kiểm tra lại link shop bạn nhận được nhé.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 mr-4 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-md"
        >
          🔄 Tải lại trang
        </button>
        <Link to="/" className="mt-6 inline-block text-primary font-bold hover:underline">
          Về trang chủ chính
        </Link>
      </div>
    );
  }

  const q = searchQuery.toLowerCase().trim();
  const filtered = products.filter((p) => {
    if (!q) return true;
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.notes || '').toLowerCase().includes(q)
    );
  });
  const grouped = filtered.reduce((acc, product) => {
    const cat = product.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="w-full flex flex-col items-center animate-fade-in">
      <div className="w-full max-w-6xl px-4 pt-6 pb-4 flex flex-col md:flex-row md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-cute font-bold text-gray-900">🏪 {shop.shop_name || 'Shop'}</h2>
          <p className="text-gray-400 text-sm font-medium">Trang sản phẩm riêng của shop này. Giá ở đây là giá riêng của shop, không chung với shop chính.</p>
        </div>
        <div className="md:ml-auto flex gap-2">
          {isOwner && (
            <Link
              to={`/${shopSlug}/admin`}
              className="bg-primary hover:bg-pink-600 text-white px-5 py-2.5 rounded-2xl text-sm font-bold shadow-md"
            >
              ⚙️ Quản lý shop
            </Link>
          )}
          {/* Không thêm nút Đăng nhập ở đây nữa: header chung của
              web đã có sẵn 1 nút Đăng nhập góc trên bên phải rồi,
              thêm nữa thành 2 nút trùng nhau. Admin phụ bấm nút
              trên header là vào trang đăng nhập, đăng nhập xong
              vẫn tự về trang quản lý của shop mình như cũ. */}
        </div>
      </div>

      <div className="w-full max-w-6xl px-4 pb-4">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Tìm sản phẩm trong shop này..."
          className="w-full px-6 py-3 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none font-medium shadow-sm"
        />
      </div>

      <div className="w-full max-w-6xl px-4 space-y-20 pb-20">
        {filtered.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="text-6xl mb-6">🏜️</div>
            <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Shop này chưa có sản phẩm nào</h3>
            <p className="text-gray-400">Thử tìm kiếm với từ khóa khác xem sao nhé!</p>
          </div>
        ) : (
          sortedCategories.map((category) => {
            const catProducts = grouped[category];
            const info = categoryInfo[category];
            return (
              <div key={category} className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r ${info?.color || 'from-gray-400 to-gray-600'} text-white text-xs font-bold uppercase tracking-wider shadow-sm`}>
                      {info?.icon || '📦'} {category}
                    </div>
                    <h2 className="text-2xl font-cute font-bold text-gray-900">{category}</h2>
                    <p className="text-gray-400 text-sm font-medium">{info?.desc || 'Danh sách sản phẩm'}</p>
                  </div>
                  <div className="text-gray-300 font-mono text-sm hidden md:block">{catProducts.length} items</div>
                </div>
                <ProductTable products={catProducts} user={user} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ShopPage;

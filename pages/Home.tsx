import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Product, User, Category } from '../types';
import ProductTable from '../components/ProductTable';

interface Props {
  user: User | null;
}

// Danh mục mặc định (fallback khi Firestore chưa có dữ liệu)
const DEFAULT_CATEGORY_INFO: Record<string, { icon: string, desc: string, color: string }> = {
  'Học Tập – Công việc – Đồ họa': { icon: '🎓', desc: 'Học tập / làm việc hiệu quả hơn với các tài khoản bản quyền.', color: 'from-blue-500 to-indigo-600' },
  'CÔNG CỤ': { icon: '🛠️', desc: 'Các công cụ hỗ trợ đắc lực cho mọi nhu cầu.', color: 'from-orange-400 to-red-500' },
  'TÀI KHOẢN AI': { icon: '🤖', desc: 'Các công cụ AI mạnh mẽ nhất hiện nay với giá ưu đãi ...', color: 'from-emerald-400 to-teal-600' },
  'GIẢI TRÍ NGHE NHẠC': { icon: '🎵', desc: 'Giải trí thả ga, không lo về giá...', color: 'from-purple-500 to-pink-600' }
};

const INITIAL_SHOW = 6;   // Số sản phẩm hiển thị ban đầu mỗi danh mục
const LOAD_MORE_STEP = 5; // Số sản phẩm thêm mỗi lần nhấn Xem thêm

const Home: React.FC<Props> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [ctvContent, setCtvContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Danh mục động từ Firestore
  const [categoryInfo, setCategoryInfo] = useState<Record<string, { icon: string, desc: string, color: string }>>(DEFAULT_CATEGORY_INFO);
  // Thứ tự danh mục (để sắp xếp đúng)
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // State lưu số sản phẩm đang hiển thị cho mỗi danh mục
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const fetchProducts = async () => {
    try {
      const q = query(
        collection(db, 'products'),
        orderBy('sort_order', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const sorted = data.sort((a: any, b: any) => {
        if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
        return b.is_hot ? 1 : -1;
      });
      setProducts(sorted || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      try {
        const fallbackSnap = await getDocs(collection(db, 'products'));
        const fallbackData = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        setProducts(fallbackData || []);
      } catch (fallbackErr) {
        console.error('Fallback fetch also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'app_settings', '1');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();

        // Load nội dung CTV
        if (user?.role === 'ctv') {
          setCtvContent(data.ctv_page_content || '');
        }

        // Load danh mục động
        if (data.categories && data.categories.length > 0) {
          const cats: Category[] = data.categories;
          const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order);
          const infoMap: Record<string, { icon: string, desc: string, color: string }> = {};
          const orderArr: string[] = [];
          sorted.forEach(cat => {
            infoMap[cat.name] = { icon: cat.icon, desc: cat.desc, color: cat.color };
            orderArr.push(cat.name);
          });
          setCategoryInfo(infoMap);
          setCategoryOrder(orderArr);
        }
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSettings();
  }, [user]);

  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };

  const filteredProducts = products.filter(p => {
    // Sản phẩm đang ẩn thì khách và CTV không thấy ở trang chủ;
    // chỉ admin (đang xem để kiểm tra) mới thấy.
    if (user?.role !== 'admin' && p.is_hidden) return false;
    const q = removeAccents(searchQuery.toLowerCase().trim());
    if (!q) return true;
    const name = removeAccents((p.name || '').toLowerCase());
    const category = removeAccents((p.category || '').toLowerCase());
    const notes = removeAccents((p.notes || '').toLowerCase());
    const form = removeAccents((p.form || '').toLowerCase());
    const pkg = removeAccents((p.package || '').toLowerCase());
    return name.includes(q) || category.includes(q) || notes.includes(q) || form.includes(q) || pkg.includes(q);
  });

  // Nhóm sản phẩm theo danh mục
  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const cat = product.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Sắp xếp danh mục theo thứ tự từ Firestore, danh mục không có trong settings thì để cuối
  const sortedCategories = Object.keys(groupedProducts).sort((a, b) => {
    const idxA = categoryOrder.indexOf(a);
    const idxB = categoryOrder.indexOf(b);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  // Hàm lấy số sản phẩm hiển thị cho một danh mục
  const getVisibleCount = (category: string) => visibleCounts[category] ?? INITIAL_SHOW;

  // Hàm tăng thêm LOAD_MORE_STEP sản phẩm cho một danh mục
  const handleLoadMore = (category: string) => {
    setVisibleCounts(prev => ({
      ...prev,
      [category]: (prev[category] ?? INITIAL_SHOW) + LOAD_MORE_STEP
    }));
  };

  return (
    <div className="w-full flex flex-col items-center py-6 animate-fade-in bg-[#fafafa] min-h-screen">
      {/* Compact Header Section */}
      <div className="w-full max-w-6xl px-4 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-primary/20">
            ✨
          </div>
          <div>
            <h1 className="text-2xl font-cute font-bold text-gray-900 leading-none">
              Studytimeless <span className="text-primary">Shop</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
              Premium Marketplace
            </p>
          </div>
        </div>

        {/* Integrated Search Bar */}
        <div className="w-full max-w-sm relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <span className="text-lg group-focus-within:scale-110 transition-transform">🔍</span>
          </div>
          <input
            type="text"
            placeholder="Tìm sản phẩm nhanh..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/5 focus:outline-none transition-all text-sm font-medium placeholder:text-gray-300"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-primary transition-colors"
            >
              <span className="text-lg">✕</span>
            </button>
          )}
        </div>
      </div>

      {/* CTV Notification Area */}
      {user?.role === 'ctv' && (
        <div className="w-full max-w-6xl px-4 mb-10 flex flex-col gap-3">
          <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm w-fit">
            <span className="text-base">🌟</span>
            <span>Chế độ: <span className="uppercase">Cộng tác viên</span></span>
          </div>
          {ctvContent && (
            <div className="bg-white border border-green-100 p-4 rounded-2xl text-left shadow-sm relative overflow-hidden max-w-2xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-green-600">📢</span>
                <h4 className="font-cute font-bold text-green-600 text-sm">Thông báo CTV</h4>
              </div>
              <div className="text-gray-600 text-xs whitespace-pre-wrap font-medium leading-relaxed">
                {ctvContent}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Table Section */}
      <div className="w-full max-w-6xl px-4 space-y-20 pb-20">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-gray-400 font-cute text-2xl">Đang tải bảng giá...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[40px] border-2 border-dashed border-gray-100">
            <div className="text-6xl mb-6">🏜️</div>
            <h3 className="text-2xl font-cute font-bold text-gray-800 mb-2">Không tìm thấy sản phẩm</h3>
            <p className="text-gray-400">Thử tìm kiếm với từ khóa khác xem sao nhé!</p>
            <button 
              onClick={() => setSearchQuery('')}
              className="mt-6 text-primary font-bold hover:underline"
            >
              Xem tất cả sản phẩm
            </button>
          </div>
        ) : (
          sortedCategories.map((category) => {
            const catProducts = groupedProducts[category];
            const info = categoryInfo[category];
            const visibleCount = getVisibleCount(category);
            const displayedProducts = catProducts.slice(0, visibleCount);
            const remaining = catProducts.length - visibleCount;
            const hasMore = remaining > 0;

            return (
              <div key={category} className="space-y-8">
                {/* Category Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div className="space-y-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r ${info?.color || 'from-gray-400 to-gray-600'} text-white text-xs font-bold uppercase tracking-wider shadow-sm`}>
                      {info?.icon || '📦'} {category}
                    </div>
                    <h2 className="text-2xl font-cute font-bold text-gray-900">
                      {category}
                    </h2>
                    <p className="text-gray-400 text-sm font-medium">
                      {info?.desc || 'Danh sách sản phẩm'}
                    </p>
                  </div>
                  <div className="text-gray-300 font-mono text-sm hidden md:block">
                    {catProducts.length} items
                  </div>
                </div>

                {/* Product Table (chỉ hiện displayedProducts) */}
                <ProductTable products={displayedProducts} user={user} />

                {/* Nút Xem thêm */}
                {hasMore && (
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <button
                      onClick={() => handleLoadMore(category)}
                      className="group flex items-center gap-3 bg-white hover:bg-primary border-2 border-primary text-primary hover:text-white px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:scale-95"
                    >
                      <span className="text-base group-hover:rotate-180 transition-transform duration-300">⬇️</span>
                      Xem thêm {Math.min(remaining, LOAD_MORE_STEP)} sản phẩm
                      <span className="bg-primary/10 group-hover:bg-white/20 text-primary group-hover:text-white text-xs font-black px-2 py-0.5 rounded-full transition-colors">
                        còn {remaining}
                      </span>
                    </button>
                    <p className="text-xs text-gray-300">
                      Đang hiển thị {displayedProducts.length} / {catProducts.length} sản phẩm
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Contact Section */}
      <div className="mt-16 bg-white/80 backdrop-blur-sm border border-pink-100 p-8 rounded-[40px] shadow-xl max-w-xl w-full mx-4 text-center">
        <h3 className="text-2xl font-cute font-bold text-primary mb-4">Liên hệ hỗ trợ 💖</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <a 
            href="https://zalo.me/0528173022" 
            target="_blank" 
            rel="noreferrer"
            className="flex items-center gap-3 bg-blue-50 text-blue-600 px-6 py-3 rounded-2xl hover:bg-blue-100 transition-all font-bold border border-blue-100 shadow-sm"
          >
            <span className="text-2xl">💬</span>
            Zalo: 0528.173.022
          </a>
          <div className="text-gray-400 font-medium hidden sm:block">|</div>
          <div className="flex items-center gap-3 text-pink-500 font-bold">
            <span className="text-2xl">👑</span>
            Admin: Thúy Mai
          </div>
        </div>
        <p className="mt-6 text-xs text-gray-400 italic">
          * Vui lòng liên hệ Zalo để được hỗ trợ nhanh nhất sau khi mua hàng.
        </p>
      </div>
    </div>
  );
};

export default Home;

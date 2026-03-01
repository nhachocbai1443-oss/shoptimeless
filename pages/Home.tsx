import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Product, User } from '../types';
import ProductTable from '../components/ProductTable';

interface Props {
  user: User | null;
}

const Home: React.FC<Props> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [ctvContent, setCtvContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProducts = async () => {
    try {
      // FIX: Dùng orderBy đơn để tránh lỗi "requires a composite index" trên Firestore
      // Firestore yêu cầu tạo index thủ công khi dùng 2 orderBy cùng lúc
      // => Sắp xếp is_hot ở client-side thay vì Firestore
      const q = query(
        collection(db, 'products'),
        orderBy('sort_order', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      // Sắp xếp: is_hot lên đầu, sau đó theo sort_order
      const sorted = data.sort((a: any, b: any) => {
        if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
        return b.is_hot ? 1 : -1;
      });
      setProducts(sorted || []);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      // Fallback: nếu field sort_order chưa tồn tại thì lấy tất cả không cần orderBy
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

  const fetchCtvSettings = async () => {
    if (user?.role === 'ctv') {
      try {
        const docRef = doc(db, 'app_settings', '1');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCtvContent(docSnap.data().ctv_page_content || '');
        }
      } catch (err) {
        console.error('Error fetching CTV settings:', err);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCtvSettings();
  }, [user]);

  const CATEGORY_INFO: Record<string, { icon: string, desc: string, color: string }> = {
    'Học Tập – Công việc – Đồ họa': { icon: '🎓', desc: 'Học tập / làm việc hiệu quả hơn với các tài khoản bản quyền.', color: 'from-blue-500 to-indigo-600' },
    'CÔNG CỤ': { icon: '🛠️', desc: 'Các công cụ hỗ trợ đắc lực cho mọi nhu cầu.', color: 'from-orange-400 to-red-500' },
    'TÀI KHOẢN AI': { icon: '🤖', desc: 'Các công cụ AI mạnh mẽ nhất hiện nay với giá ưu đãi ...', color: 'from-emerald-400 to-teal-600' },
    'GIẢI TRÍ NGHE NHẠC': { icon: '🎵', desc: 'Giải trí thả ga, không lo về giá...', color: 'from-purple-500 to-pink-600' }
  };

  const removeAccents = (str: string) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  };

  const filteredProducts = products.filter(p => {
    const query = removeAccents(searchQuery.toLowerCase().trim());
    if (!query) return true;
    
    const name = removeAccents((p.name || '').toLowerCase());
    const category = removeAccents((p.category || '').toLowerCase());
    const notes = removeAccents((p.notes || '').toLowerCase());
    const form = removeAccents((p.form || '').toLowerCase());
    const pkg = removeAccents((p.package || '').toLowerCase());
    
    return (
      name.includes(query) ||
      category.includes(query) ||
      notes.includes(query) ||
      form.includes(query) ||
      pkg.includes(query)
    );
  });

  const groupedProducts = filteredProducts.reduce((acc, product) => {
    const cat = product.category || 'Khác';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

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
          Object.entries(groupedProducts).map(([category, catProducts]) => (
            <div key={category} className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-gradient-to-r ${CATEGORY_INFO[category]?.color || 'from-gray-400 to-gray-600'} text-white text-xs font-bold uppercase tracking-wider shadow-sm`}>
                    {CATEGORY_INFO[category]?.icon || '📦'} {category}
                  </div>
                  <h2 className="text-2xl font-cute font-bold text-gray-900">
                    {category}
                  </h2>
                  <p className="text-gray-400 text-sm font-medium">
                    {CATEGORY_INFO[category]?.desc || 'Danh sách sản phẩm'}
                  </p>
                </div>
                <div className="text-gray-300 font-mono text-sm hidden md:block">
                  {catProducts.length} items
                </div>
              </div>
              <ProductTable products={catProducts} user={user} />
            </div>
          ))
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

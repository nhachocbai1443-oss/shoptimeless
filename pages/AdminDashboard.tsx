import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, where } from 'firebase/firestore';
import { uploadImageToSupabase } from '../supabase';
import { Product, User, UserRole, Order, Category } from '../types';
import ProductTable from '../components/ProductTable';

interface Props {
  user: User;
}

// Danh mục mặc định (dùng khi Firestore chưa có dữ liệu)
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Học Tập – Công việc – Đồ họa', icon: '🎓', desc: 'Học tập / làm việc hiệu quả hơn với các tài khoản bản quyền.', color: 'from-blue-500 to-indigo-600', sort_order: 1 },
  { id: '2', name: 'CÔNG CỤ', icon: '🛠️', desc: 'Các công cụ hỗ trợ đắc lực cho mọi nhu cầu.', color: 'from-orange-400 to-red-500', sort_order: 2 },
  { id: '3', name: 'TÀI KHOẢN AI', icon: '🤖', desc: 'Các công cụ AI mạnh mẽ nhất hiện nay với giá ưu đãi ...', color: 'from-emerald-400 to-teal-600', sort_order: 3 },
  { id: '4', name: 'GIẢI TRÍ NGHE NHẠC', icon: '🎵', desc: 'Giải trí thả ga, không lo về giá...', color: 'from-purple-500 to-pink-600', sort_order: 4 },
];

const GRADIENT_OPTIONS = [
  { label: 'Xanh dương – Tím', value: 'from-blue-500 to-indigo-600' },
  { label: 'Cam – Đỏ', value: 'from-orange-400 to-red-500' },
  { label: 'Xanh lá – Ngọc', value: 'from-emerald-400 to-teal-600' },
  { label: 'Tím – Hồng', value: 'from-purple-500 to-pink-600' },
  { label: 'Hồng – Đỏ', value: 'from-pink-400 to-rose-500' },
  { label: 'Vàng – Cam', value: 'from-yellow-400 to-orange-500' },
  { label: 'Xanh lam – Xanh lá', value: 'from-cyan-400 to-green-500' },
  { label: 'Xám – Đen', value: 'from-gray-400 to-gray-600' },
];

const AdminDashboard: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'products' | 'ctvs' | 'settings' | 'orders'>('products');
  
  // Products State
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // CTVs State
  const [ctvs, setCtvs] = useState<User[]>([]);
  const [loadingCtvs, setLoadingCtvs] = useState(false);
  const [newCtvName, setNewCtvName] = useState('');

  // Settings State
  const [ctvPageContent, setCtvPageContent] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState<number | null>(null);
  const [uploadingQR, setUploadingQR] = useState<number | null>(null);

  // Categories State (trong Settings)
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState<Partial<Category>>({
    name: '', icon: '📦', desc: '', color: 'from-blue-500 to-indigo-600', sort_order: 99
  });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<Category>>({});

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate]);

  // --- FETCH DATA ---
  const fetchProducts = async () => {
    setLoadingProducts(true);
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
        console.error('Fallback fetch failed:', fallbackErr);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchCtvs = async () => {
    setLoadingCtvs(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const allUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      const ctvList = allUsers
        .filter((u: any) => u.role === 'ctv')
        .sort((a: any, b: any) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
      setCtvs(ctvList || []);
    } catch (err) {
      console.error('Error fetching CTVs:', err);
    } finally {
      setLoadingCtvs(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const docRef = doc(db, 'app_settings', '1');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCtvPageContent(data.ctv_page_content || '');
        setPaymentMethods(data.payment_methods || [
          { 
            id: 'acb', 
            name: 'Thanh toán ACB', 
            icon_url: 'https://upload.wikimedia.org/wikipedia/commons/2/25/Logo_ACB.svg', 
            desc: 'Chuyển khoản đến ACB nhận ngay lập tức',
            account_name: 'Nguyễn Thế Mạnh',
            account_no: '8694451',
            bank_name: 'ACB'
          },
          { 
            id: 'momo', 
            name: 'Ví MoMo', 
            icon_url: 'https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png', 
            desc: 'Thanh toán qua ví điện tử MoMo',
            account_name: 'Nguyễn Thế Mạnh',
            account_no: '0528173022',
            bank_name: 'MoMo'
          }
        ]);
        // Load categories từ Firestore, nếu chưa có thì dùng mặc định
        setCategories(data.categories || DEFAULT_CATEGORIES);
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setOrders(data || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'ctvs') fetchCtvs();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'orders') fetchOrders();
  }, [activeTab]);

  // --- PRODUCT ACTIONS ---
  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
      fetchProducts();
    } catch (err) {
      alert('Lỗi khi xóa sản phẩm!');
    }
  };

  // --- CTV ACTIONS ---
  const handleAddCtv = async () => {
    if (!newCtvName.trim()) return;
    try {
      const cleanName = newCtvName.trim();
      const q = query(collection(db, 'users'), where('username', '==', cleanName));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), { role: 'ctv' });
      } else {
        await addDoc(collection(db, 'users'), { 
          username: cleanName, 
          role: 'ctv',
          created_at: new Date().toISOString()
        });
      }
      setNewCtvName('');
      fetchCtvs();
      alert(`Đã thêm CTV: ${cleanName}`);
    } catch (err) {
      alert('Lỗi khi thêm CTV!');
    }
  };

  const handleRemoveCtv = async (id: string) => {
    if (!window.confirm('Gỡ quyền CTV của người này?')) return;
    try {
      await updateDoc(doc(db, 'users', id), { role: 'user' });
      fetchCtvs();
    } catch (err) {
      alert('Lỗi khi gỡ quyền CTV!');
    }
  };

  // --- SETTINGS ACTIONS ---
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'app_settings', '1'), { 
        ctv_page_content: ctvPageContent,
        payment_methods: paymentMethods,
        categories: categories
      }, { merge: true });
      alert('Đã lưu cài đặt!');
    } catch (err) {
      console.error('Save settings error:', err);
      alert('Lỗi khi lưu cài đặt!');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setUploadingIcon(index);
    try {
      const file = e.target.files[0];
      const publicUrl = await uploadImageToSupabase(file, 'icons');
      updatePaymentMethod(index, 'icon_url', publicUrl);
    } catch (err: any) {
      console.error('Error uploading icon to Supabase:', err);
      alert(err.message || 'Lỗi khi tải icon lên Supabase Storage!');
    } finally {
      setUploadingIcon(null);
    }
  };

  const handleUploadCustomQR = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingQR(index);
    try {
      const file = e.target.files[0];
      const publicUrl = await uploadImageToSupabase(file, 'qr');
      updatePaymentMethod(index, 'custom_qr_url', publicUrl);
    } catch (err: any) {
      console.error('Error uploading custom QR to Supabase:', err);
      alert(err.message || 'Lỗi khi tải ảnh QR lên Supabase Storage!');
    } finally {
      setUploadingQR(null);
    }
  };

  const addPaymentMethod = () => {
    setPaymentMethods([...paymentMethods, { 
      id: Date.now().toString(), 
      name: '', 
      icon_url: '', 
      desc: '',
      account_name: '',
      account_no: '',
      bank_name: ''
    }]);
  };

  const removePaymentMethod = (index: number) => {
    const newMethods = [...paymentMethods];
    newMethods.splice(index, 1);
    setPaymentMethods(newMethods);
  };

  const updatePaymentMethod = (index: number, field: string, value: string) => {
    const newMethods = [...paymentMethods];
    newMethods[index] = { ...newMethods[index], [field]: value };
    setPaymentMethods(newMethods);
  };

  const handleUpdateOrderStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
      fetchOrders();
    } catch (err) {
      alert('Lỗi khi cập nhật trạng thái đơn hàng!');
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa đơn hàng này?')) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
      fetchOrders();
    } catch (err) {
      alert('Lỗi khi xóa đơn hàng!');
    }
  };

  // --- CATEGORY ACTIONS ---
  const handleAddCategory = () => {
    if (!newCategory.name?.trim()) {
      alert('Vui lòng nhập tên danh mục!');
      return;
    }
    const cat: Category = {
      id: Date.now().toString(),
      name: newCategory.name.trim(),
      icon: newCategory.icon || '📦',
      desc: newCategory.desc || '',
      color: newCategory.color || 'from-blue-500 to-indigo-600',
      sort_order: newCategory.sort_order || categories.length + 1,
    };
    setCategories(prev => [...prev, cat].sort((a, b) => a.sort_order - b.sort_order));
    setNewCategory({ name: '', icon: '📦', desc: '', color: 'from-blue-500 to-indigo-600', sort_order: 99 });
  };

  const handleDeleteCategory = (id: string) => {
    if (!window.confirm('Xóa danh mục này? Sản phẩm thuộc danh mục này sẽ không bị xóa.')) return;
    setCategories(prev => prev.filter(c => c.id !== id));
  };

  const handleStartEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategory({ ...cat });
  };

  const handleSaveEditCategory = () => {
    if (!editingCategory.name?.trim()) {
      alert('Tên danh mục không được để trống!');
      return;
    }
    setCategories(prev =>
      prev.map(c => c.id === editingCategoryId ? { ...c, ...editingCategory, name: editingCategory.name!.trim() } as Category : c)
        .sort((a, b) => a.sort_order - b.sort_order)
    );
    setEditingCategoryId(null);
    setEditingCategory({});
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditingCategory({});
  };

  return (
    <div className="w-full flex flex-col items-center py-6 animate-fade-in">
      <div className="w-full max-w-6xl px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h2 className="text-4xl font-cute font-bold text-gray-800 flex items-center gap-3">
            👑 Quản trị hệ thống
          </h2>
          
          <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-2xl border border-pink-100 shadow-sm">
            <button 
              onClick={() => setActiveTab('orders')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
            >
              🛒 Đơn hàng
            </button>
            <button 
              onClick={() => setActiveTab('products')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'products' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
            >
              📦 Sản phẩm
            </button>
            <button 
              onClick={() => setActiveTab('ctvs')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ctvs' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
            >
              👥 CTV
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
            >
              ⚙️ Cài đặt
            </button>
          </div>
        </div>

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-pink-100 shadow-xl overflow-x-auto">
              <h3 className="text-2xl font-cute font-bold text-primary mb-6">Danh sách đơn hàng 🛒</h3>
              {loadingOrders ? (
                <div className="text-center py-10">Đang tải đơn hàng...</div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-500 font-cute text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-bold">Ngày đặt</th>
                      <th className="px-4 py-3 font-bold">Khách hàng</th>
                      <th className="px-4 py-3 font-bold">Sản phẩm</th>
                      <th className="px-4 py-3 font-bold">Số tiền</th>
                      <th className="px-4 py-3 font-bold">Thanh toán</th>
                      <th className="px-4 py-3 font-bold">Tài khoản</th>
                      <th className="px-4 py-3 font-bold">Trạng thái</th>
                      <th className="px-4 py-3 font-bold text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400 italic">Chưa có đơn hàng nào...</td>
                      </tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors">
                          <td className="px-4 py-4 text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleString('vi-VN')}
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-gray-800">{order.full_name}</div>
                            <div className="text-xs text-gray-400">{order.contact}</div>
                            <div className="text-xs text-gray-400">{order.email}</div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-primary">{order.product_name}</div>
                            <div className="text-xs text-gray-500">{order.variant_form} x{order.quantity}</div>
                          </td>
                          <td className="px-4 py-4 font-bold text-red-500">
                            {order.total_price.toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-4 py-4 text-xs">
                            {order.payment_method}
                          </td>
                          <td className="px-4 py-4 text-xs max-w-[150px] truncate" title={order.account_info || ''}>
                            {order.account_info || 'N/A'}
                          </td>
                          <td className="px-4 py-4">
                            <select 
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border focus:outline-none ${
                                order.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                                order.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-yellow-50 text-yellow-600 border-yellow-100'
                              }`}
                            >
                              <option value="pending">Chờ xử lý</option>
                              <option value="completed">Hoàn tất</option>
                              <option value="cancelled">Đã hủy</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button 
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Xóa đơn hàng"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button 
                onClick={() => navigate('/admin/product/new')}
                className="bg-secondary hover:bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all transform hover:-translate-y-1 flex items-center gap-2"
              >
                ➕ Thêm sản phẩm mới
              </button>
            </div>
            
            {loadingProducts ? (
              <div className="text-center py-20 text-gray-400">Đang tải sản phẩm...</div>
            ) : (
              <ProductTable 
                products={products} 
                user={user} 
                onEdit={(p) => navigate(`/admin/product/${p.id}`)}
                onDelete={handleDeleteProduct}
                showCategory={true}
                showSortOrder={true}
              />
            )}
          </div>
        )}

        {/* CTVS TAB */}
        {activeTab === 'ctvs' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[32px] border border-pink-100 shadow-xl flex flex-col md:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Thêm Cộng tác viên mới</label>
                <input 
                  type="text"
                  value={newCtvName}
                  onChange={(e) => setNewCtvName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCtv()}
                  placeholder="Nhập username CTV..."
                  className="w-full px-6 py-3 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all font-medium"
                />
              </div>
              <button 
                onClick={handleAddCtv}
                className="bg-primary hover:bg-pink-600 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg transition-all h-[52px] whitespace-nowrap"
              >
                + Thêm CTV
              </button>
            </div>

            {/* Ghi chú về giá riêng cho ctvtime */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
              <span className="text-amber-500 text-lg mt-0.5">💡</span>
              <div>
                <p className="text-sm font-bold text-amber-700">Giá đặc biệt cho CTV <span className="font-black text-amber-800">ctvtime</span></p>
                <p className="text-xs text-amber-600 mt-0.5">
                  CTV có username <strong>ctvtime</strong> sẽ thấy <strong>giá riêng (price_ctvtime)</strong> khi được thiết lập trong từng sản phẩm. Các CTV còn lại thấy giá CTV chung (price_ctv).
                  Để thiết lập giá riêng, vào <strong>Sản phẩm → Sửa sản phẩm</strong>.
                </p>
              </div>
            </div>

            <div className="bg-white/50 backdrop-blur-sm rounded-3xl border border-pink-100 shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-primary text-white font-cute text-lg">
                  <tr>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4">Loại giá</th>
                    <th className="px-6 py-4">Ngày tham gia</th>
                    <th className="px-6 py-4 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="font-body">
                  {loadingCtvs ? (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400">Đang tải...</td></tr>
                  ) : ctvs.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400 italic">Chưa có CTV nào...</td></tr>
                  ) : (
                    ctvs.map(ctv => (
                      <tr key={ctv.id} className="border-b border-pink-50 hover:bg-pink-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-700">{ctv.username}</td>
                        <td className="px-6 py-4">
                          {ctv.username === 'ctvtime' ? (
                            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-bold">
                              ⭐ Giá riêng (ctvtime)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full text-xs font-bold">
                              👥 Giá CTV chung
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {ctv.created_at ? new Date(ctv.created_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => handleRemoveCtv(ctv.id)}
                            className="text-red-400 hover:text-red-600 font-bold text-xs border border-red-100 px-4 py-1.5 rounded-xl hover:bg-red-50 transition-all"
                          >
                            Gỡ quyền CTV
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-8">

            {/* ===== QUẢN LÝ DANH MỤC ===== */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-pink-100 shadow-xl">
              <h3 className="text-2xl font-cute font-bold text-primary mb-2">Quản lý danh mục 🗂️</h3>
              <p className="text-xs text-gray-400 mb-6">Thêm, sửa, xóa danh mục sản phẩm. Nhớ nhấn <strong>Lưu tất cả cài đặt</strong> ở cuối trang để áp dụng.</p>

              {/* Danh sách danh mục hiện có */}
              <div className="space-y-3 mb-6">
                {categories.length === 0 && (
                  <p className="text-center text-gray-400 italic text-sm py-4">Chưa có danh mục nào.</p>
                )}
                {categories.map((cat) => (
                  <div key={cat.id} className="rounded-2xl border border-pink-50 bg-white/60 overflow-hidden">
                    {editingCategoryId === cat.id ? (
                      /* --- EDIT MODE --- */
                      <div className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tên danh mục</label>
                            <input
                              type="text"
                              value={editingCategory.name || ''}
                              onChange={(e) => setEditingCategory(p => ({ ...p, name: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm font-bold"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Icon (emoji)</label>
                            <input
                              type="text"
                              value={editingCategory.icon || ''}
                              onChange={(e) => setEditingCategory(p => ({ ...p, icon: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                              placeholder="VD: 🎓"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mô tả ngắn</label>
                            <input
                              type="text"
                              value={editingCategory.desc || ''}
                              onChange={(e) => setEditingCategory(p => ({ ...p, desc: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                              placeholder="Mô tả ngắn về danh mục..."
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Màu gradient</label>
                            <select
                              value={editingCategory.color || ''}
                              onChange={(e) => setEditingCategory(p => ({ ...p, color: e.target.value }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm bg-white"
                            >
                              {GRADIENT_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Thứ tự hiển thị</label>
                            <input
                              type="number"
                              value={editingCategory.sort_order ?? ''}
                              onChange={(e) => setEditingCategory(p => ({ ...p, sort_order: Number(e.target.value) }))}
                              className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={handleCancelEditCategory}
                            className="px-5 py-2 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all"
                          >
                            Hủy
                          </button>
                          <button
                            onClick={handleSaveEditCategory}
                            className="px-5 py-2 rounded-xl text-sm font-bold bg-primary text-white hover:bg-pink-600 transition-all shadow-md"
                          >
                            ✅ Lưu thay đổi
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* --- VIEW MODE --- */
                      <div className="flex items-center gap-4 px-5 py-4">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center text-white text-xl shadow-sm shrink-0`}>
                          {cat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{cat.name}</p>
                          <p className="text-xs text-gray-400 truncate">{cat.desc || 'Chưa có mô tả'}</p>
                        </div>
                        <span className="text-[10px] text-gray-300 font-mono hidden md:block">#{cat.sort_order}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleStartEditCategory(cat)}
                            className="w-8 h-8 flex items-center justify-center bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors border border-yellow-100 text-sm"
                            title="Sửa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors border border-red-100 text-sm"
                            title="Xóa"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Form thêm danh mục mới */}
              <div className="border-t-2 border-pink-50 pt-6">
                <p className="text-sm font-bold text-gray-600 mb-4">➕ Thêm danh mục mới</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tên danh mục *</label>
                    <input
                      type="text"
                      value={newCategory.name || ''}
                      onChange={(e) => setNewCategory(p => ({ ...p, name: e.target.value }))}
                      placeholder="VD: PHẦN MỀM"
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Icon (emoji)</label>
                    <input
                      type="text"
                      value={newCategory.icon || ''}
                      onChange={(e) => setNewCategory(p => ({ ...p, icon: e.target.value }))}
                      placeholder="VD: 💻"
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Mô tả ngắn</label>
                    <input
                      type="text"
                      value={newCategory.desc || ''}
                      onChange={(e) => setNewCategory(p => ({ ...p, desc: e.target.value }))}
                      placeholder="Mô tả ngắn về danh mục..."
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Màu gradient</label>
                    <select
                      value={newCategory.color || ''}
                      onChange={(e) => setNewCategory(p => ({ ...p, color: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm bg-white"
                    >
                      {GRADIENT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Thứ tự hiển thị</label>
                    <input
                      type="number"
                      value={newCategory.sort_order ?? ''}
                      onChange={(e) => setNewCategory(p => ({ ...p, sort_order: Number(e.target.value) }))}
                      placeholder="VD: 5"
                      className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddCategory}
                  className="bg-secondary hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-md"
                >
                  ➕ Thêm danh mục
                </button>
              </div>
            </div>

            {/* CTV Content */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-pink-100 shadow-xl">
              <h3 className="text-2xl font-cute font-bold text-primary mb-6">Cài đặt trang Cộng tác viên 📝</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">Nội dung hiển thị cho CTV</label>
                  <textarea 
                    value={ctvPageContent}
                    onChange={(e) => setCtvPageContent(e.target.value)}
                    rows={6}
                    placeholder="Nhập thông báo, hướng dẫn hoặc nội dung dành riêng cho CTV..."
                    className="w-full px-6 py-4 rounded-3xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="bg-white/80 backdrop-blur-sm p-8 rounded-[40px] border border-pink-100 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-cute font-bold text-primary">Phương thức thanh toán & Chuyển khoản 💳</h3>
                <button 
                  onClick={addPaymentMethod}
                  className="bg-pink-50 text-primary px-4 py-2 rounded-xl text-xs font-bold hover:bg-pink-100 transition-all border border-pink-100"
                >
                  + Thêm phương thức
                </button>
              </div>
              
              <div className="space-y-6">
                {paymentMethods.map((method, idx) => (
                  <div key={idx} className="p-8 rounded-[32px] border-2 border-pink-50 space-y-6 relative group bg-white/50">
                    <button 
                      onClick={() => removePaymentMethod(idx)}
                      className="absolute top-6 right-6 text-gray-300 hover:text-red-500 transition-colors p-2"
                      title="Xóa phương thức"
                    >
                      🗑️
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      {/* Icon Upload */}
                      <div className="md:col-span-3 flex flex-col items-center gap-3">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ảnh Icon</label>
                        <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-pink-100 flex items-center justify-center overflow-hidden bg-white group-hover:border-primary transition-colors">
                          {method.icon_url ? (
                            <img src={method.icon_url} alt="Icon" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-2xl text-gray-300">🖼️</span>
                          )}
                          {uploadingIcon === idx && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => handleUploadIcon(e, idx)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 text-center">Nhấn để tải ảnh</p>
                      </div>

                      {/* Basic Info */}
                      <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tên phương thức</label>
                          <input 
                            type="text"
                            value={method.name}
                            onChange={(e) => updatePaymentMethod(idx, 'name', e.target.value)}
                            placeholder="VD: Thanh toán ACB"
                            className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm font-bold"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Mô tả ngắn</label>
                          <input 
                            type="text"
                            value={method.desc}
                            onChange={(e) => updatePaymentMethod(idx, 'desc', e.target.value)}
                            placeholder="VD: Chuyển khoản nhận ngay"
                            className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bank Details */}
                    <div className="pt-6 border-t border-pink-50 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Chủ tài khoản</label>
                        <input 
                          type="text"
                          value={method.account_name}
                          onChange={(e) => updatePaymentMethod(idx, 'account_name', e.target.value)}
                          placeholder="VD: NGUYEN THE MANH"
                          className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Số tài khoản / SĐT</label>
                        <input 
                          type="text"
                          value={method.account_no}
                          onChange={(e) => updatePaymentMethod(idx, 'account_no', e.target.value)}
                          placeholder="VD: 8694451"
                          className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Ngân hàng (Mã VietQR)</label>
                        <input 
                          type="text"
                          value={method.bank_name}
                          onChange={(e) => updatePaymentMethod(idx, 'bank_name', e.target.value)}
                          placeholder="VD: ACB, MoMo, ZaloPay"
                          className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Custom QR Upload */}
                    <div className="pt-5 border-t border-pink-50">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-3 ml-1">
                        Ảnh QR Tùy Chỉnh — dùng cho MoMo, ZaloPay (nếu để trống sẽ tự tạo QR qua VietQR)
                      </label>
                      <div className="flex items-center gap-5">
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-pink-200 bg-pink-50/30 flex items-center justify-center overflow-hidden shrink-0">
                          {method.custom_qr_url ? (
                            <img src={method.custom_qr_url} alt="Custom QR" className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-[10px] text-gray-400 font-bold text-center px-1">Chưa có QR</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="relative cursor-pointer inline-flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-primary text-xs font-bold px-4 py-2.5 rounded-xl transition-all border border-pink-200">
                            {uploadingQR === idx ? (
                              <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> Đang tải...</>
                            ) : (
                              <>📷 Upload ảnh QR từ app</>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleUploadCustomQR(e, idx)}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={uploadingQR === idx}
                            />
                          </label>
                          {method.custom_qr_url && (
                            <button
                              type="button"
                              onClick={() => updatePaymentMethod(idx, 'custom_qr_url', '')}
                              className="text-xs text-red-400 hover:text-red-600 font-bold px-4 py-2 rounded-xl border border-red-100 hover:bg-red-50 transition-all"
                            >
                              🗑 Xóa QR tùy chỉnh
                            </button>
                          )}
                          <p className="text-[10px] text-gray-400 leading-relaxed max-w-[200px]">
                            Chụp màn hình QR nhận tiền từ app MoMo / ZaloPay rồi upload lên đây.
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center pb-10">
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="bg-primary hover:bg-pink-600 text-white px-16 py-4 rounded-3xl font-bold shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:scale-95 disabled:bg-gray-300 text-lg"
              >
                {savingSettings ? '🚀 Đang lưu cài đặt...' : '💾 Lưu tất cả cài đặt'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

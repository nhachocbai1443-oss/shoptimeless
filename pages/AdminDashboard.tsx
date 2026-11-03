import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, where, writeBatch } from 'firebase/firestore';
import { uploadImageToSupabase } from '../supabase';
import { Product, User, UserRole, Order, Category } from '../types';
import ProductTable from '../components/ProductTable';
import {
  RESERVED_SLUGS,
  normalizeSlug,
  isValidSlug,
  shopLink,
  productsOfShop,
  copyMainProductsToShop,
  fanOutNewMainProduct,
  getShopSettings,
  DEFAULT_CONTACT_LINKS,
} from '../utils/shop';

interface Props {
  user: User;
  // Không truyền = shop của admin chính. Truyền mã shop = trang
  // quản lý của shop phụ đó (chỉ admin phụ sở hữu shop đó vào được).
  shopSlug?: string;
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

const AdminDashboard: React.FC<Props> = ({ user, shopSlug }) => {
  const navigate = useNavigate();
  const isSubShop = !!shopSlug;
  const adminHomePath = isSubShop ? `/${shopSlug}/admin` : '/admin';
  const productFormPath = (id: string) =>
    isSubShop ? `/${shopSlug}/admin/product/${id}` : `/admin/product/${id}`;
  const [activeTab, setActiveTab] = useState<'products' | 'ctvs' | 'settings' | 'orders' | 'subadmins'>('products');

  // Admin phụ (chỉ admin chính mới thấy tab này)
  const [subadmins, setSubadmins] = useState<User[]>([]);
  const [loadingSubadmins, setLoadingSubadmins] = useState(false);
  const [newSubUsername, setNewSubUsername] = useState('');
  const [newSubShopName, setNewSubShopName] = useState('');
  const [newSubSlug, setNewSubSlug] = useState('');
  const [editingSub, setEditingSub] = useState<Record<string, { shop_name: string; shop_slug: string; notify_email: string; telegram_enabled: boolean }>>({});
  
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
  const [contactLinks, setContactLinks] = useState<{ messenger: string; zalo: string; telegram: string }>({
    messenger: DEFAULT_CONTACT_LINKS.messenger || '',
    zalo: DEFAULT_CONTACT_LINKS.zalo || '',
    telegram: DEFAULT_CONTACT_LINKS.telegram || '',
  });
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
    if (isSubShop) {
      // Trang quản lý shop phụ: chỉ admin phụ sở hữu đúng shop đó
      // mới vào được, admin chính và shop phụ khác đều bị đẩy về
      // trang shop đó (dạng khách).
      if (user.role !== 'subadmin' || user.shop_slug !== shopSlug) {
        navigate(`/${shopSlug}`);
      }
    } else if (user.role !== 'admin') {
      navigate('/');
    }
  }, [user, navigate, isSubShop, shopSlug]);

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
      // Lọc theo shop: shop chính chỉ thấy sản phẩm không gắn mã
      // shop, shop phụ chỉ thấy sản phẩm gắn đúng mã shop của mình.
      // Nhờ vậy admin phụ không bao giờ chạm được vào sản phẩm
      // của admin chính hay của shop phụ khác từ trang này.
      setProducts(productsOfShop(sorted || [], shopSlug));
    } catch (err: any) {
      console.error('Error fetching products:', err);
      try {
        const fallbackSnap = await getDocs(collection(db, 'products'));
        const fallbackData = fallbackSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        setProducts(productsOfShop(fallbackData || [], shopSlug));
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
      // Tải cài đặt của shop chính trước làm nền, rồi shop phụ
      // (nếu có cài đặt riêng) sẽ ghi đè từng mục đã lưu riêng.
      // Cách này xử lý đúng cả trường hợp shop phụ đã lưu riêng
      // từ trước (ví dụ chỉ lưu phương thức thanh toán, chưa lưu
      // link liên hệ): mục nào chưa lưu riêng thì vẫn dùng của
      // chính, không bị rơi về link mặc định.
      const docRef = doc(db, 'app_settings', '1');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCtvPageContent(data.ctv_page_content || '');
        if (data.contact_links) {
          setContactLinks({
            messenger: data.contact_links.messenger || '',
            zalo: data.contact_links.zalo || '',
            telegram: data.contact_links.telegram || '',
          });
        }
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
      // Shop phụ: ghi đè từng mục đã lưu riêng lên trên nền
      // của shop chính vừa tải (xem ghi chú ở đầu hàm).
      if (isSubShop && shopSlug) {
        const shopSettings = await getShopSettings(shopSlug);
        if (shopSettings) {
          if (shopSettings.payment_methods) setPaymentMethods(shopSettings.payment_methods);
          if (shopSettings.categories) setCategories(shopSettings.categories);
          if (shopSettings.contact_links) {
            setContactLinks({
              messenger: shopSettings.contact_links.messenger || '',
              zalo: shopSettings.contact_links.zalo || '',
              telegram: shopSettings.contact_links.telegram || '',
            });
          }
        }
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
      // Đơn hàng cũng lọc theo shop như sản phẩm.
      setOrders(
        shopSlug
          ? (data || []).filter((o: any) => o.shop_slug === shopSlug)
          : (data || []).filter((o: any) => !o.shop_slug)
      );
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'products') {
      fetchProducts();
      // Load categories để phân nhóm sản phẩm trong tab admin
      if (categories.length === 0) fetchSettings();
    }
    if (activeTab === 'ctvs') fetchCtvs();
    if (activeTab === 'settings') fetchSettings();
    if (activeTab === 'orders') fetchOrders();
    if (activeTab === 'subadmins') fetchSubadmins();
  }, [activeTab]);

  // --- SUBADMIN ACTIONS (chỉ admin chính) ---
  const fetchSubadmins = async () => {
    setLoadingSubadmins(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'subadmin'));
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as User[];
      setSubadmins(list);
      // Tải luôn cài đặt thông báo riêng của từng shop (Gmail
      // nhận đơn + công tắc Telegram chung) để hiện sẵn trong
      // bảng. Shop chưa đặt thì Gmail trống, Telegram tắt.
      const editMap: Record<string, { shop_name: string; shop_slug: string; notify_email: string; telegram_enabled: boolean }> = {};
      await Promise.all(list.map(async (u) => {
        let notify_email = '';
        let telegram_enabled = false;
        if (u.shop_slug) {
          try {
            const s = await getShopSettings(u.shop_slug);
            if (s?.notify_email) notify_email = s.notify_email;
            telegram_enabled = s?.telegram_enabled === true;
          } catch {}
        }
        editMap[u.id] = { shop_name: u.shop_name || '', shop_slug: u.shop_slug || '', notify_email, telegram_enabled };
      }));
      setEditingSub(editMap);
    } catch (err) {
      console.error('Error fetching subadmins:', err);
    } finally {
      setLoadingSubadmins(false);
    }
  };

  const handleAddSubadmin = async () => {
    const username = newSubUsername.trim();
    const shopName = newSubShopName.trim();
    const slug = normalizeSlug(newSubSlug);
    if (!username || !shopName || !slug) {
      alert('Nhập đủ: username admin phụ, tên shop và mã link.');
      return;
    }
    if (!isValidSlug(slug)) {
      alert(`Mã link không hợp lệ. Chỉ dùng chữ thường, số và gạch ngang, không trùng từ cấm (${RESERVED_SLUGS.join(', ')}).`);
      return;
    }
    if (slug === username.toLowerCase()) {
      alert('Không nên đặt mã link trùng username, vì đăng nhập chỉ cần username nên lộ link là lộ tài khoản. Đặt mã khác với username nhé.');
      return;
    }
    try {
      const nameSnap = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
      if (!nameSnap.empty) {
        alert('Username này đã có người dùng rồi, đổi username khác.');
        return;
      }
      const slugSnap = await getDocs(query(collection(db, 'users'), where('shop_slug', '==', slug)));
      if (!slugSnap.empty) {
        alert('Mã link này đã có shop khác dùng rồi, đổi mã khác.');
        return;
      }
      await addDoc(collection(db, 'users'), {
        username,
        role: 'subadmin',
        shop_slug: slug,
        shop_name: shopName,
        created_by: user.id,
        created_at: new Date().toISOString(),
      });
      // Sao chép toàn bộ sản phẩm chính sang shop phụ mới, ngay
      // lúc tạo. Sau đó 2 bên tách riêng, trừ khi admin chính
      // thêm MỚI sản phẩm (xem fanOutNewMainProduct).
      const copied = await copyMainProductsToShop(slug);
      alert(`Đã tạo admin phụ: ${username}\nShop: ${shopName}\nLink: ${shopLink(slug)}\nĐã sao chép ${copied} sản phẩm từ shop chính sang shop phụ.`);
      setNewSubUsername('');
      setNewSubShopName('');
      setNewSubSlug('');
      fetchSubadmins();
    } catch (err: any) {
      console.error('Error adding subadmin:', err);
      alert(`Lỗi khi tạo admin phụ: ${err.message || ''}`);
    }
  };

  const handleSaveSubadmin = async (sub: User) => {
    const edit = editingSub[sub.id];
    if (!edit) return;
    const shopName = edit.shop_name.trim();
    const newSlug = normalizeSlug(edit.shop_slug);
    const oldSlug = sub.shop_slug || '';
    if (!shopName || !newSlug) {
      alert('Tên shop và mã link không được để trống.');
      return;
    }
    if (!isValidSlug(newSlug)) {
      alert('Mã link không hợp lệ.');
      return;
    }
    if (newSlug !== oldSlug) {
      const slugSnap = await getDocs(query(collection(db, 'users'), where('shop_slug', '==', newSlug)));
      if (!slugSnap.empty) {
        alert('Mã link này đã có shop khác dùng rồi, đổi mã khác.');
        return;
      }
      if (!window.confirm(`Đổi mã link từ "${oldSlug}" sang "${newSlug}"? Link cũ sẽ hết hiệu lực, bạn phải gửi link mới cho admin phụ.`)) return;
    }
    try {
      await updateDoc(doc(db, 'users', sub.id), { shop_name: shopName, shop_slug: newSlug });
      if (newSlug !== oldSlug) {
        // Đổi mã link thì đổi luôn mã shop trên toàn bộ sản phẩm
        // của shop đó, không thì shop sẽ trống sản phẩm.
        const prodSnap = await getDocs(query(collection(db, 'products'), where('shop_slug', '==', oldSlug)));
        const batch = writeBatch(db);
        prodSnap.docs.forEach((d) => batch.update(doc(db, 'products', d.id), { shop_slug: newSlug }));
        await batch.commit();
        // Đổi mã link thì dời luôn cài đặt riêng của shop (nếu
        // đã có) sang mã mới, không thì cài đặt riêng bị mất.
        const oldSettings = await getShopSettings(oldSlug);
        if (oldSettings) {
          await setDoc(doc(db, 'shop_settings', newSlug), oldSettings, { merge: true });
          await deleteDoc(doc(db, 'shop_settings', oldSlug));
        }
      }
      // Lưu cài đặt thông báo riêng của shop này (dùng merge
      // nên không xóa phương thức thanh toán, danh mục hay link
      // liên hệ đã lưu riêng trước đó). Chỉ admin chính bấm nút
      // Lưu ở tab này mới ghi được 2 mục này; admin phụ không
      // thấy tab Admin phụ, và nút Lưu ở tab Cài đặt của shop
      // phụ cũng chỉ merge 3 mục kia nên không xóa được 2 mục này.
      await setDoc(doc(db, 'shop_settings', newSlug), {
        notify_email: (edit.notify_email || '').trim(),
        telegram_enabled: !!edit.telegram_enabled,
      }, { merge: true });
      alert('Đã lưu shop phụ.');
      fetchSubadmins();
    } catch (err: any) {
      console.error('Error saving subadmin:', err);
      alert(`Lỗi khi lưu shop phụ: ${err.message || ''}`);
    }
  };

  const handleDeleteSubadmin = async (sub: User) => {
    if (!window.confirm(`Xóa admin phụ "${sub.username}" và toàn bộ sản phẩm của shop "${sub.shop_name || sub.shop_slug}"? Hành động này không khôi phục được.`)) return;
    try {
      const prodSnap = await getDocs(query(collection(db, 'products'), where('shop_slug', '==', sub.shop_slug)));
      const batch = writeBatch(db);
      prodSnap.docs.forEach((d) => batch.delete(doc(db, 'products', d.id)));
      await batch.commit();
      await deleteDoc(doc(db, 'users', sub.id));
      // Xóa luôn cài đặt riêng của shop đó (nếu đã có), tránh
      // để lại cài đặt mồ côi cho 1 shop không còn tồn tại.
      if (sub.shop_slug) {
        try { await deleteDoc(doc(db, 'shop_settings', sub.shop_slug)); } catch {}
      }
      alert('Đã xóa admin phụ và sản phẩm của shop đó.');
      fetchSubadmins();
    } catch (err: any) {
      console.error('Error deleting subadmin:', err);
      alert(`Lỗi khi xóa admin phụ: ${err.message || ''}`);
    }
  };

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

  // Nhân bản: tạo 1 sản phẩm mới giống hệt bản gốc (kể cả ảnh, giá,
  // biến thể, ghi chú), tên thêm "(Bản sao)", xếp ngay sau bản gốc
  // trong cùng danh mục. Dùng writeBatch để việc dời các sản phẩm
  // phía sau xuống 1 bậc và việc tạo bản sao thành công cùng lúc,
  // tránh dở dang (tạo xong mà thứ tự chưa dời, hoặc ngược lại).
  const handleDuplicateProduct = async (product: Product) => {
    try {
      const categoryKey = product.category || 'Khác';
      const originalOrder = product.sort_order || 0;
      const batch = writeBatch(db);
      products
        .filter((p) => (p.category || 'Khác') === categoryKey)
        .forEach((p) => {
          if ((p.sort_order || 0) > originalOrder) {
            batch.update(doc(db, 'products', p.id), {
              sort_order: (p.sort_order || 0) + 1,
            });
          }
        });
      const { id, ...rest } = product as any;
      const duplicateData = {
        ...rest,
        name: product.name.endsWith('(Bản sao)')
          ? product.name
          : `${product.name} (Bản sao)`,
        sort_order: originalOrder + 1,
        created_at: new Date().toISOString(),
      };
      const newDocRef = doc(collection(db, 'products'));
      batch.set(newDocRef, duplicateData);
      await batch.commit();
      // Nhân bản ở shop chính cũng là 1 sản phẩm mới của shop
      // chính, nên cũng sao chép sang các shop phụ như khi thêm
      // mới. Nhân bản ở shop phụ thì không sao chép đi đâu cả.
      // Truyền luôn id vừa tạo để bản sao ghi copied_from, sau
      // này chính sửa giá CTV mới truyền sang được.
      if (!isSubShop) {
        await fanOutNewMainProduct({ ...duplicateData, id: newDocRef.id });
      }
      alert(`Đã nhân bản: ${product.name} (Bản sao)`);
      fetchProducts();
    } catch (err) {
      console.error('Error duplicating product:', err);
      alert('Lỗi khi nhân bản sản phẩm!');
    }
  };

  // Gạt ẩn/hiện 1 sản phẩm: chỉ đổi cờ is_hidden, không xóa sản
  // phẩm, không đổi ảnh/giá/ghi chú. Ẩn rồi thì khách không thấy
  // ở trang chủ và không checkout được bằng link trực tiếp nữa,
  // nhưng admin vẫn thấy (mờ hơn + badge "Đang ẩn") để gạt hiện lại.
  // Cập nhật giao diện ngay, ghi lỗi thì trả lại trạng thái cũ.
  const handleToggleHidden = async (product: Product) => {
    const nextHidden = !product.is_hidden;
    const previousProducts = products;
    setProducts(
      products.map((p) =>
        p.id === product.id ? { ...p, is_hidden: nextHidden } : p
      )
    );
    try {
      await updateDoc(doc(db, 'products', product.id), {
        is_hidden: nextHidden,
      });
    } catch (err) {
      console.error('Error toggling product visibility:', err);
      alert('Lỗi khi đổi trạng thái ẩn/hiện!');
      setProducts(previousProducts);
    }
  };

  // Lưu thứ tự kéo-thả: orderedIds là thứ tự mới trong 1 danh mục.
  // Gán lại sort_order = 1, 2, 3... theo đúng thứ tự đó, cập nhật
  // giao diện ngay rồi mới ghi Firestore; ghi lỗi thì trả lại thứ
  // tự cũ và báo để bạn kéo lại, tránh bảng hiển thị 1 đằng, DB 1 nẻo.
  const handleReorderProducts = async (category: string, orderedIds: string[]) => {
    const previousProducts = products;
    const updatedProducts = products.map((p) => {
      const newIndex = orderedIds.indexOf(p.id);
      if ((p.category || 'Khác') === category && newIndex >= 0) {
        return { ...p, sort_order: newIndex + 1 };
      }
      return p;
    });
    setProducts(updatedProducts);
    try {
      const batch = writeBatch(db);
      orderedIds.forEach((productId, index) => {
        batch.update(doc(db, 'products', productId), { sort_order: index + 1 });
      });
      await batch.commit();
    } catch (err) {
      console.error('Error saving product order:', err);
      alert('Lỗi khi lưu thứ tự! Đã trả lại thứ tự cũ, bạn kéo lại giúp mình.');
      setProducts(previousProducts);
      fetchProducts();
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
      if (isSubShop && shopSlug) {
        // Lưu cài đặt RIÊNG của shop phụ, không động tới
        // app_settings của shop chính. Không lưu nội dung CTV
        // (đó là cài đặt riêng của shop chính).
        await setDoc(doc(db, 'shop_settings', shopSlug), {
          payment_methods: paymentMethods,
          categories: categories,
          contact_links: contactLinks,
        }, { merge: true });
        alert('Đã lưu cài đặt riêng của shop! Từ giờ shop này dùng phương thức thanh toán, danh mục và link liên hệ riêng, không ảnh hưởng shop chính.');
      } else {
        await setDoc(doc(db, 'app_settings', '1'), {
          ctv_page_content: ctvPageContent,
          payment_methods: paymentMethods,
          categories: categories,
          contact_links: contactLinks,
        }, { merge: true });
        alert('Đã lưu cài đặt!');
      }
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
            {isSubShop ? `🏪 Quản lý shop ${user.shop_name || shopSlug}` : '👑 Quản trị hệ thống'}
          </h2>
          
          <div className="flex bg-white/90 backdrop-blur-sm p-1 rounded-2xl border border-slate-200 shadow-sm">
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
            {/* Shop phụ cũng có tab Cài đặt riêng (phương thức
                thanh toán + danh mục của shop mình), nhưng không
                có tab CTV và tab Admin phụ. */}
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
            >
              ⚙️ Cài đặt
            </button>
            {!isSubShop && (
              <>
                <button
                  onClick={() => setActiveTab('ctvs')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'ctvs' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
                >
                  👥 CTV
                </button>
                <button
                  onClick={() => setActiveTab('subadmins')}
                  className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'subadmins' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-pink-50'}`}
                >
                  🏪 Admin phụ
                </button>
              </>
            )}
          </div>
        </div>

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)] overflow-x-auto">
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
                onClick={() => navigate(productFormPath('new'))}
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
                forceAdminView={isSubShop}
                onEdit={(p) => navigate(productFormPath(p.id))}
                onDuplicate={handleDuplicateProduct}
                onToggleHidden={handleToggleHidden}
                onReorder={handleReorderProducts}
                onDelete={handleDeleteProduct}
                showCategory={true}
                showSortOrder={true}
                groupByCategory={true}
                categories={categories}
              />
            )}
          </div>
        )}

        {/* SUBADMINS TAB — chỉ admin chính */}
        {activeTab === 'subadmins' && !isSubShop && (
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)] space-y-4">
              <h3 className="text-2xl font-cute font-bold text-primary">Tạo admin phụ 🏪</h3>
              <p className="text-sm text-gray-500">
                Tạo xong là shop phụ có ngay đầy đủ sản phẩm và giá giống shop chính lúc đó.
                Sau đó 2 bên tách riêng, trừ khi bạn thêm MỚI sản phẩm ở shop chính thì sản phẩm mới đó tự sao chép sang các shop phụ.
                Mã link do bạn tự đặt, sửa được, không nên trùng username.
                Thông báo đơn hàng: shop phụ mới tạo mặc định KHÔNG gửi Gmail riêng và TẮT Telegram chung — bạn nhập Gmail và bật Telegram cho từng shop ở bảng dưới rồi bấm Lưu, đơn của shop đó mới đi đúng luồng đó.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                <input
                  value={newSubUsername}
                  onChange={(e) => setNewSubUsername(e.target.value)}
                  placeholder="Username admin phụ..."
                  className="px-4 py-3 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none font-medium"
                />
                <input
                  value={newSubShopName}
                  onChange={(e) => setNewSubShopName(e.target.value)}
                  placeholder="Tên shop..."
                  className="px-4 py-3 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none font-medium"
                />
                <input
                  value={newSubSlug}
                  onChange={(e) => setNewSubSlug(e.target.value)}
                  placeholder="Mã link, ví dụ: shop-a"
                  className="px-4 py-3 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none font-medium"
                />
              </div>
              <button
                onClick={handleAddSubadmin}
                className="bg-primary hover:bg-pink-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all"
              >
                + Tạo admin phụ và sao chép sản phẩm
              </button>
            </div>

            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)] overflow-x-auto">
              <h3 className="text-2xl font-cute font-bold text-primary mb-6">Danh sách admin phụ</h3>
              {loadingSubadmins ? (
                <div className="text-center py-10 text-gray-400">Đang tải...</div>
              ) : subadmins.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">Chưa có admin phụ nào...</div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-500 font-cute text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 font-bold">Username</th>
                      <th className="px-4 py-3 font-bold">Tên shop</th>
                      <th className="px-4 py-3 font-bold">Mã link / Link shop</th>
                      <th className="px-4 py-3 font-bold">Gmail nhận đơn của shop này</th>
                      <th className="px-4 py-3 font-bold text-center">Telegram chung</th>
                      <th className="px-4 py-3 font-bold text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {subadmins.map((sub) => {
                      const edit = editingSub[sub.id] || { shop_name: sub.shop_name || '', shop_slug: sub.shop_slug || '', notify_email: '', telegram_enabled: false };
                      return (
                        <tr key={sub.id} className="border-t border-gray-50">
                          <td className="px-4 py-4 font-bold text-gray-800">{sub.username}</td>
                          <td className="px-4 py-4">
                            <input
                              value={edit.shop_name}
                              onChange={(e) => setEditingSub((prev) => ({ ...prev, [sub.id]: { ...edit, shop_name: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none w-full"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <input
                              value={edit.shop_slug}
                              onChange={(e) => setEditingSub((prev) => ({ ...prev, [sub.id]: { ...edit, shop_slug: e.target.value } }))}
                              className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none w-full font-mono"
                            />
                            <div className="text-xs text-gray-400 mt-1 break-all">{sub.shop_slug ? shopLink(sub.shop_slug) : ''}</div>
                            <button
                              onClick={() => {
                                const slug = sub.shop_slug;
                                if (slug) {
                                  navigator.clipboard?.writeText(shopLink(slug)).then(
                                    () => alert('Đã sao chép link shop.'),
                                    () => alert(shopLink(slug))
                                  );
                                }
                              }}
                              className="text-xs text-primary font-bold hover:underline mt-1"
                            >
                              📋 Sao chép link
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <input
                              type="email"
                              value={edit.notify_email}
                              onChange={(e) => setEditingSub((prev) => ({ ...prev, [sub.id]: { ...edit, notify_email: e.target.value } }))}
                              placeholder="Gmail nhận đơn shop này..."
                              className="px-3 py-2 rounded-xl border border-gray-200 focus:outline-none w-full"
                            />
                            <div className="text-xs text-gray-400 mt-1">Chỉ nhận đơn của riêng shop này. Để trống = không gửi Gmail cho phụ.</div>
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <label className="inline-flex flex-col items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!edit.telegram_enabled}
                                onChange={(e) => setEditingSub((prev) => ({ ...prev, [sub.id]: { ...edit, telegram_enabled: e.target.checked } }))}
                                className="w-5 h-5 accent-pink-600"
                              />
                              <span className="text-xs font-bold text-gray-600">{edit.telegram_enabled ? 'Đang bật' : 'Đang tắt'}</span>
                            </label>
                            <div className="text-xs text-gray-400 mt-1 normal-case font-normal">Bật = đơn shop này gửi lên luồng Telegram chung (1 bot + 1 chat của bạn). Đơn shop chính luôn gửi lên đó.</div>
                          </td>
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleSaveSubadmin(sub)}
                              className="bg-green-50 text-green-600 px-3 py-2 rounded-xl font-bold text-xs mr-2"
                            >
                              💾 Lưu
                            </button>
                            <button
                              onClick={() => handleDeleteSubadmin(sub)}
                              className="bg-red-50 text-red-600 px-3 py-2 rounded-xl font-bold text-xs"
                            >
                              🗑️ Xóa shop
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* CTVS TAB */}
        {activeTab === 'ctvs' && (
          <div className="space-y-6">
            <div className="bg-white/90 backdrop-blur-sm p-6 rounded-[32px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)] flex flex-col md:flex-row items-end gap-4">
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

            <div className="bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)] overflow-hidden">
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

            {isSubShop && (
              <div className="bg-pink-50 border border-pink-100 p-5 rounded-[24px] text-sm text-gray-600 leading-relaxed">
                <strong className="text-primary">Cài đặt riêng của shop {user.shop_name || shopSlug}:</strong> phương
                thức thanh toán, danh mục và link liên hệ ở đây chỉ áp dụng cho shop này, không ảnh hưởng shop chính.
                Lần đầu chưa lưu thì shop đang dùng cài đặt của shop chính, bạn sửa rồi bấm
                <strong> Lưu tất cả cài đặt</strong> ở cuối trang 1 lần là từ đó tách riêng hẳn.
              </div>
            )}

            {/* ===== QUẢN LÝ DANH MỤC ===== */}
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)]">
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

            {/* CTV Content — chỉ shop chính, shop phụ không có */}
            {!isSubShop && (
              <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)]">
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
            )}

            {/* Payment Methods */}
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)]">
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

            {/* Link liên hệ nổi — cụm nút tròn góc phải dưới
                (Messenger / Zalo / Telegram). Shop chính sửa ở đây
                thì đổi link ở trang chủ chính, shop phụ sửa ở đây
                thì chỉ đổi link ở shop của mình. Để trống 1 ô là
                nút đó không hiện nữa. */}
            <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[40px] border border-slate-200 shadow-[0_24px_50px_-24px_rgba(15,23,42,0.28)]">
              <h3 className="text-2xl font-cute font-bold text-primary mb-2">Link liên hệ nổi 💬</h3>
              <p className="text-xs text-gray-400 mb-6">Cụm nút tròn ở góc phải dưới mọi trang của shop. Dán đủ đường link (bắt đầu bằng https://). Nhớ nhấn <strong>Lưu tất cả cài đặt</strong> ở cuối trang để áp dụng.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Messenger</label>
                  <input
                    type="text"
                    value={contactLinks.messenger}
                    onChange={(e) => setContactLinks((p) => ({ ...p, messenger: e.target.value.trim() }))}
                    placeholder="VD: https://www.facebook.com/messages/t/..."
                    className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Zalo</label>
                  <input
                    type="text"
                    value={contactLinks.zalo}
                    onChange={(e) => setContactLinks((p) => ({ ...p, zalo: e.target.value.trim() }))}
                    placeholder="VD: https://zalo.me/0123456789"
                    className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Telegram</label>
                  <input
                    type="text"
                    value={contactLinks.telegram}
                    onChange={(e) => setContactLinks((p) => ({ ...p, telegram: e.target.value.trim() }))}
                    placeholder="VD: https://t.me/username"
                    className="w-full px-4 py-2.5 rounded-xl border border-pink-100 focus:border-primary focus:outline-none text-sm"
                  />
                </div>
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

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import { collection, doc, getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { uploadImageToSupabase } from '../supabase';
import { Product, User, Category } from '../types';

interface Props {
  user: User;
}

// Danh mục mặc định (fallback khi Firestore chưa có dữ liệu)
const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Học Tập – Công việc – Đồ họa', icon: '🎓', desc: '', color: 'from-blue-500 to-indigo-600', sort_order: 1 },
  { id: '2', name: 'CÔNG CỤ', icon: '🛠️', desc: '', color: 'from-orange-400 to-red-500', sort_order: 2 },
  { id: '3', name: 'TÀI KHOẢN AI', icon: '🤖', desc: '', color: 'from-emerald-400 to-teal-600', sort_order: 3 },
  { id: '4', name: 'GIẢI TRÍ NGHE NHẠC', icon: '🎵', desc: '', color: 'from-purple-500 to-pink-600', sort_order: 4 },
];

const ProductFormPage: React.FC<Props> = ({ user }) => {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const isEdit = productId && productId !== 'new';

  const [uploading, setUploading] = useState(false);
  const [uploadingNote, setUploadingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isDragOver, setIsDragOver] = useState(false);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const [form, setForm] = useState<Partial<Product>>({
    category: DEFAULT_CATEGORIES[0].name,
    name: '',
    image_url: '',
    form: '',
    package: '',
    price_public: 0,
    price_ctv: 0,
    price_ctvtime: undefined,
    discount_percent: 0,
    sort_order: 0,
    is_hot: false,
    in_stock: true,
    notes: '',
    variants: []
  });

  // Load danh mục từ Firestore
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const docRef = doc(db, 'app_settings', '1');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().categories && docSnap.data().categories.length > 0) {
          const cats: Category[] = docSnap.data().categories;
          const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order);
          setCategories(sorted);
          if (!isEdit) {
            setForm(prev => ({ ...prev, category: sorted[0]?.name || DEFAULT_CATEGORIES[0].name }));
          }
        }
      } catch (err) {
        console.error('Error loading categories:', err);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (user.role !== 'admin') {
      navigate('/');
      return;
    }
    if (isEdit) {
      setLoading(true);
      getDoc(doc(db, 'products', productId!))
        .then(snap => {
          if (snap.exists()) {
            setForm({ id: snap.id, ...snap.data() } as any);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }
  }, [productId]);

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    try {
      const file = e.target.files[0];
      const publicUrl = await uploadImageToSupabase(file, 'products');
      setForm(prev => ({ ...prev, image_url: publicUrl }));
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải ảnh lên!');
    } finally {
      setUploading(false);
    }
  };

  // Chèn text vào vị trí con trỏ trong textarea ghi chú
  const insertTextAtCursor = useCallback((text: string) => {
    const textarea = notesRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    setForm(prev => ({ ...prev, notes: newValue }));
    // Đặt lại vị trí con trỏ sau khi chèn
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + text.length;
      textarea.selectionEnd = start + text.length;
    }, 0);
  }, []);

  // Upload ảnh cho ghi chú và chèn markdown
  const uploadNoteImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploadingNote(true);
    try {
      const publicUrl = await uploadImageToSupabase(file, 'products');
      insertTextAtCursor(`\n![ảnh](${publicUrl})\n`);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải ảnh lên!');
    } finally {
      setUploadingNote(false);
    }
  }, [insertTextAtCursor]);

  // Xử lý paste ảnh vào textarea
  const handleNotesPaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) await uploadNoteImage(file);
        return;
      }
    }
  }, [uploadNoteImage]);

  // Xử lý kéo thả ảnh vào textarea
  const handleNotesDrop = useCallback(async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith('image/')) {
        await uploadNoteImage(files[i]);
      }
    }
  }, [uploadNoteImage]);

  // Xử lý upload ảnh qua nút chèn ảnh
  const handleNoteImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    for (let i = 0; i < e.target.files.length; i++) {
      await uploadNoteImage(e.target.files[i]);
    }
    e.target.value = '';
  };

  const addVariant = () => {
    setForm(prev => ({
      ...prev,
      variants: [...(prev.variants || []), { form: '', price_public: 0, price_ctv: 0, price_ctvtime: undefined }]
    }));
  };

  const removeVariant = (index: number) => {
    const v = [...(form.variants || [])];
    v.splice(index, 1);
    setForm(prev => ({ ...prev, variants: v }));
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const v = [...(form.variants || [])];
    v[index] = { ...v[index], [field]: value };
    setForm(prev => ({ ...prev, variants: v }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) { alert('Vui lòng nhập tên sản phẩm!'); return; }
    setSaving(true);
    try {
      const { id, ...productData } = form as any;
      if (!productData.variants || !Array.isArray(productData.variants)) productData.variants = [];
      productData.variants = productData.variants.filter((v: any) => v.form && v.form.trim() !== '');
      productData.variants = productData.variants.map((v: any) => {
        const cleaned: any = {
          form: v.form,
          price_public: Number(v.price_public) || 0,
          price_ctv: Number(v.price_ctv) || 0,
        };
        if (v.price_ctvtime !== undefined && v.price_ctvtime !== null && v.price_ctvtime !== '' && Number(v.price_ctvtime) > 0) {
          cleaned.price_ctvtime = Number(v.price_ctvtime);
        }
        return cleaned;
      });
      productData.price_public = Number(productData.price_public) || 0;
      productData.price_ctv = Number(productData.price_ctv) || 0;
      if (productData.price_ctvtime !== undefined && productData.price_ctvtime !== null && productData.price_ctvtime !== '' && Number(productData.price_ctvtime) > 0) {
        productData.price_ctvtime = Number(productData.price_ctvtime);
      } else {
        delete productData.price_ctvtime;
      }
      productData.discount_percent = Number(productData.discount_percent) || 0;
      productData.sort_order = Number(productData.sort_order) || 0;
      productData.is_hot = Boolean(productData.is_hot);
      productData.in_stock = productData.in_stock !== undefined ? Boolean(productData.in_stock) : true;
      productData.notes = productData.notes || '';
      productData.image_url = productData.image_url || '';
      productData.form = productData.form || '';
      productData.package = productData.package || '';
      productData.category = productData.category || categories[0]?.name || DEFAULT_CATEGORIES[0].name;

      if (isEdit) {
        await updateDoc(doc(db, 'products', productId!), productData);
        alert('Đã cập nhật sản phẩm thành công!');
      } else {
        await addDoc(collection(db, 'products'), { ...productData, created_at: new Date().toISOString() });
        alert('Đã thêm sản phẩm mới thành công!');
      }
      navigate('/admin');
    } catch (err: any) {
      if (err.code === 'permission-denied') {
        alert('Lỗi: Không có quyền ghi dữ liệu! Kiểm tra Firestore Security Rules.');
      } else {
        alert(`Lỗi khi lưu sản phẩm: ${err.message || JSON.stringify(err)}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-600 font-bold hover:text-primary hover:border-primary transition-all group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">⬅️</span> Quay lại
          </button>
          <h2 className="text-2xl font-cute font-bold text-gray-800">
            {isEdit ? '✏️ Sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-[40px] shadow-xl border border-gray-100 p-8 space-y-6">

          {/* Danh mục */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Danh mục</label>
            <select
              required
              value={form.category || ''}
              onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all bg-white"
            >
              <option value="">-- Chọn danh mục --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* Tên sản phẩm */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tên sản phẩm</label>
            <input
              required
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
            />
          </div>

          {/* Ảnh sản phẩm */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Ảnh sản phẩm</label>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-pink-200 flex items-center justify-center overflow-hidden bg-pink-50 shrink-0">
                {form.image_url ? (
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-pink-300">🖼️</span>
                )}
              </div>
              <div className="flex-1 w-full space-y-2">
                <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all border-2 ${uploading ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-pink-100 text-primary hover:bg-pink-50'}`}>
                  {uploading ? '⏳ Đang tải...' : '📤 Tải ảnh lên'}
                  <input type="file" accept="image/*" onChange={handleUploadImage} disabled={uploading} className="hidden" />
                </label>
                <input
                  type="text"
                  value={form.image_url || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="Hoặc dán link ảnh vào đây..."
                  className="w-full px-4 py-2 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Hình thức + Gói */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Hình thức</label>
              <input
                required
                type="text"
                value={form.form || ''}
                onChange={(e) => setForm(prev => ({ ...prev, form: e.target.value }))}
                placeholder="Gia hạn / Tạo mới"
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Gói</label>
              <input
                required
                type="text"
                value={form.package || ''}
                onChange={(e) => setForm(prev => ({ ...prev, package: e.target.value }))}
                placeholder="1 Tháng / 1 Năm"
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
          </div>

          {/* Giá Public + Giá CTV chung */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Giá Public (đ)</label>
              <input
                required
                type="number"
                value={form.price_public ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm(prev => ({ ...prev, price_public: e.target.value === '' ? 0 : Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Giá CTV chung (đ)</label>
              <input
                required
                type="number"
                value={form.price_ctv ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm(prev => ({ ...prev, price_ctv: e.target.value === '' ? 0 : Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
          </div>

          {/* Giá riêng cho CTV ctvtime */}
          <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-500">⭐</span>
              <label className="block text-sm font-bold text-amber-700">
                Giá riêng cho CTV <span className="font-black">ctvtime</span> (đ) — Tùy chọn
              </label>
            </div>
            <p className="text-xs text-amber-600 mb-2">
              Nếu để trống hoặc nhập 0, CTV ctvtime sẽ thấy giá CTV chung ở trên.
            </p>
            <input
              type="number"
              min="0"
              value={form.price_ctvtime ?? ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setForm(prev => ({
                ...prev,
                price_ctvtime: e.target.value === '' ? undefined : Number(e.target.value)
              }))}
              placeholder="Nhập giá riêng cho ctvtime (để trống = dùng giá CTV chung)"
              className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-100 transition-all bg-white"
            />
          </div>

          {/* Giảm giá + Thứ tự */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Giảm giá (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.discount_percent ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm(prev => ({ ...prev, discount_percent: e.target.value === '' ? 0 : Number(e.target.value) }))}
                placeholder="Ví dụ: 20"
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Thứ tự ưu tiên</label>
              <input
                type="number"
                value={form.sort_order ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setForm(prev => ({ ...prev, sort_order: e.target.value === '' ? 0 : Number(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all"
              />
            </div>
          </div>

          {/* Is Hot + In Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-pink-50/50 p-4 rounded-2xl border-2 border-pink-50">
              <input
                type="checkbox"
                id="is_hot"
                checked={form.is_hot || false}
                onChange={(e) => setForm(prev => ({ ...prev, is_hot: e.target.checked }))}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
              <label htmlFor="is_hot" className="text-sm font-bold text-gray-700 cursor-pointer">
                🔥 Đánh dấu là sản phẩm HOT (Đưa lên đầu danh sách)
              </label>
            </div>
            <div className="flex items-center gap-3 bg-green-50/50 p-4 rounded-2xl border-2 border-green-50">
              <input
                type="checkbox"
                id="in_stock"
                checked={form.in_stock !== false}
                onChange={(e) => setForm(prev => ({ ...prev, in_stock: e.target.checked }))}
                className="w-5 h-5 accent-green-500 cursor-pointer"
              />
              <label htmlFor="in_stock" className="text-sm font-bold text-gray-700 cursor-pointer">
                ✅ Còn hàng (bỏ chọn = Hết hàng)
              </label>
            </div>
          </div>

          {/* Ghi chú - hỗ trợ dán ảnh */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-700">
                Ghi chú
                <span className="ml-2 text-xs font-normal text-gray-400">(hỗ trợ Markdown, dán ảnh Ctrl+V hoặc kéo thả)</span>
              </label>
              <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${uploadingNote ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'}`}>
                {uploadingNote ? (
                  <><div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div> Đang tải...</>
                ) : (
                  <>🖼️ Chèn ảnh</>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleNoteImageUpload}
                  disabled={uploadingNote}
                  className="hidden"
                />
              </label>
            </div>

            <div
              className={`relative rounded-xl border-2 transition-all ${isDragOver ? 'border-blue-400 bg-blue-50' : 'border-pink-50'}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
            >
              {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-xl z-10 pointer-events-none">
                  <div className="text-blue-500 font-bold text-sm flex flex-col items-center gap-2">
                    <span className="text-3xl">🖼️</span>
                    Thả ảnh vào đây để chèn
                  </div>
                </div>
              )}
              <textarea
                ref={notesRef}
                value={form.notes || ''}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                onPaste={handleNotesPaste}
                onDrop={handleNotesDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                className="w-full px-4 py-3 rounded-xl focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all bg-transparent resize-y"
                rows={8}
                placeholder="Nhập ghi chú, mô tả sản phẩm...&#10;&#10;Hỗ trợ:&#10;• Ctrl+V để dán ảnh từ clipboard&#10;• Kéo thả ảnh vào đây&#10;• Nút 🖼️ Chèn ảnh ở trên&#10;• **in đậm**, # Tiêu đề, > trích dẫn"
              />
            </div>

            {uploadingNote && (
              <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                Đang upload ảnh lên server...
              </p>
            )}
          </div>

          {/* Variants */}
          <div className="border-t-2 border-pink-50 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-cute font-bold text-lg text-primary">💎 Các hình thức khác (Tùy chọn)</h4>
              <button
                type="button"
                onClick={addVariant}
                className="text-xs bg-secondary text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-600 transition-all"
              >
                + Thêm hình thức
              </button>
            </div>
            <div className="space-y-4">
              {(form.variants || []).map((variant, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 relative group">
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                  {/* Hàng 1: Hình thức + Giá Public + Giá CTV chung */}
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Hình thức</label>
                      <input
                        type="text"
                        value={variant.form}
                        onChange={(e) => updateVariant(index, 'form', e.target.value)}
                        placeholder="Ví dụ: Acc Cấp"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Giá Public</label>
                      <input
                        type="number"
                        value={variant.price_public ?? ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateVariant(index, 'price_public', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Giá CTV chung</label>
                      <input
                        type="number"
                        value={variant.price_ctv ?? ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateVariant(index, 'price_ctv', e.target.value === '' ? 0 : Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-primary focus:outline-none text-sm"
                      />
                    </div>
                  </div>
                  {/* Hàng 2: Giá riêng ctvtime */}
                  <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                    <label className="block text-[10px] font-bold text-amber-600 uppercase mb-1">
                      ⭐ Giá riêng ctvtime (để trống = dùng giá CTV chung)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={variant.price_ctvtime ?? ''}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateVariant(index, 'price_ctvtime', e.target.value === '' ? undefined : Number(e.target.value))}
                      placeholder="Để trống nếu không có giá riêng"
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 focus:border-amber-400 focus:outline-none text-sm bg-white"
                    />
                  </div>
                </div>
              ))}
              {(form.variants || []).length === 0 && (
                <p className="text-center text-gray-400 text-xs italic py-4">Chưa có hình thức bổ sung nào.</p>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t-2 border-pink-50">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all border-2 border-transparent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || uploading || uploadingNote}
              className="bg-primary hover:bg-pink-600 text-white px-10 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all disabled:bg-gray-300 flex items-center gap-2"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang lưu...</>
              ) : (
                isEdit ? '✅ Cập nhật sản phẩm' : '➕ Thêm sản phẩm'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormPage;

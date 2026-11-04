import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, User, Category } from '../types';

interface ProductTableProps {
  products: Product[];
  user: User | null;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (product: Product) => void;
  onToggleHidden?: (product: Product) => void;
  onReorder?: (category: string, orderedIds: string[]) => void;
  showCategory?: boolean;
  showSortOrder?: boolean;
  groupByCategory?: boolean;
  categories?: Category[];
  // Trang quản lý của shop phụ: user là subadmin nhưng vẫn phải
  // hiện cột Thao tác, kéo-thả, nhân bản như trang admin chính.
  forceAdminView?: boolean;
}

const ProductTable: React.FC<ProductTableProps> = ({
  products,
  user,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleHidden,
  onReorder,
  showCategory = false,
  showSortOrder = false,
  groupByCategory = false,
  categories = [],
  forceAdminView = false,
}) => {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || forceAdminView;
  const isCTV = user?.role === 'ctv';
  // ctvtime là CTV đặc biệt CỦA CHÍNH (không gắn mã shop) nên
  // mới được thấy giá riêng ctvtime. CTV phụ (có mã shop) thì
  // không bao giờ rơi vào nhánh ctvtime, dù username có trùng.
  const isCtvtime = isCTV && !user?.shop_slug && user?.username === 'ctvtime';
  // CTV của shop phụ: chỉ thấy giá CTV riêng của shop phụ
  // (price_ctv_sub), không thấy giá CTV chung của chính. CTV
  // chính (không gắn mã shop) thì ngược lại, chỉ thấy giá CTV
  // chung của chính. Hai luồng giá này tách riêng hoàn toàn.
  const isSubCtv = isCTV && !!user?.shop_slug;
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<Record<string, number>>({});

  // Kéo-thả chỉ bật ở bảng quản trị (nhóm theo danh mục + có onReorder).
  // Trang khách không truyền onReorder nên không bị ảnh hưởng gì.
  const dragEnabled = isAdmin && groupByCategory && !!onReorder;
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragInsert, setDragInsert] = useState<'before' | 'after' | null>(null);
  const [dragPreviewPos, setDragPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const [previewCategory, setPreviewCategory] = useState<string | null>(null);
  const [previewIds, setPreviewIds] = useState<string[] | null>(null);
  // Bản ref của previewIds để lúc thả tay không bị đọc state cũ
  // (closure của handler gắn lúc bắt đầu kéo).
  const previewIdsRef = useRef<string[] | null>(null);
  // Thứ tự gốc của danh mục đang kéo, chụp lại lúc bắt đầu kéo để
  // tính thứ tự xem trước và để so sánh khi thả (không đổi thì khỏi lưu).
  const dragBaseRef = useRef<{ category: string; ids: string[] } | null>(null);

  // Thứ tự gốc trong 1 danh mục ở bảng quản trị: chỉ theo sort_order,
  // KHÔNG đẩy HOT lên đầu như trước, để thứ tự bạn kéo là thứ tự thật
  // hiển thị trong bảng và được lưu xuống Firestore. Trang khách vẫn
  // giữ luật HOT lên đầu riêng (xem Home.tsx), không đổi ở đây.
  const baseOrderForCategory = (categoryName: string): Product[] => {
    const inCategory = products.filter(
      (p) => (p.category || 'Khác') === categoryName
    );
    return [...inCategory].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
  };

  const endDrag = () => {
    const base = dragBaseRef.current;
    const finalIds = previewIdsRef.current;
    // Chỉ lưu khi thứ tự xem trước khác thứ tự gốc.
    if (
      base &&
      finalIds &&
      finalIds.join(',') !== base.ids.join(',')
    ) {
      onReorder?.(base.category, finalIds);
    }
    dragBaseRef.current = null;
    previewIdsRef.current = null;
    setDragId(null);
    setDragOverId(null);
    setDragInsert(null);
    setDragPreviewPos(null);
    setPreviewCategory(null);
    setPreviewIds(null);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  // Kéo bằng Pointer Events (chuột + cảm ứng đều chạy), chỉ bắt đầu
  // từ tay cầm ⋮⋮ ở cột STT nên bấm Sửa/Xóa/Nhân bản và cuộn trang
  // ở các chỗ khác vẫn bình thường.
  const handleDragStart = (
    e: React.PointerEvent,
    product: Product,
    categoryName: string
  ) => {
    if (!dragEnabled) return;
    // Chuột thì chỉ nhận nút trái; cảm ứng thì nhận mọi pointer.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const base = baseOrderForCategory(categoryName);
    dragBaseRef.current = {
      category: categoryName,
      ids: base.map((p) => p.id),
    };
    setDragId(product.id);
    setPreviewCategory(categoryName);
    setDragPreviewPos({ x: e.clientX, y: e.clientY });
    previewIdsRef.current = base.map((p) => p.id);
    setPreviewIds(previewIdsRef.current);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const handleMove = (ev: PointerEvent) => {
      const baseRef = dragBaseRef.current;
      if (!baseRef) return;
      setDragPreviewPos({ x: ev.clientX, y: ev.clientY });
      // Kéo tới gần mép trên/dưới màn hình thì tự cuộn trang theo,
      // để kéo được tới sản phẩm ở xa mà không phải thả tay giữa chừng.
      if (ev.clientY < 90) {
        window.scrollBy(0, -10);
      } else if (ev.clientY > window.innerHeight - 90) {
        window.scrollBy(0, 10);
      }
      // Tìm hàng đang ở dưới con trỏ (chuột hoặc ngón tay).
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const row = el?.closest?.('tr[data-product-id]') as HTMLElement | null;
      if (!row) return;
      const targetId = row.dataset.productId;
      const targetCategory = row.dataset.category;
      if (!targetId || targetCategory !== baseRef.category) return;
      if (targetId === product.id) {
        setDragOverId(targetId);
        setDragInsert(null);
        return;
      }
      setDragOverId(targetId);
      const current = previewIdsRef.current || baseRef.ids;
      if (!current.includes(targetId)) return;
      const withoutDragged = current.filter((id) => id !== product.id);
      let targetIndex = withoutDragged.indexOf(targetId);
      // Con trỏ ở nửa dưới của hàng đích thì chèn sau hàng đó,
      // nửa trên thì chèn trước hàng đó. Lưu vị trí này để vẽ
      // vạch hồng chèn vào đúng chỗ, nhìn là biết sẽ thả vào đâu.
      const rect = row.getBoundingClientRect();
      const insertAfter = ev.clientY > rect.top + rect.height / 2;
      setDragInsert(insertAfter ? 'after' : 'before');
      if (insertAfter) {
        targetIndex += 1;
      }
      withoutDragged.splice(targetIndex, 0, product.id);
      // Tránh setState liên tục khi thứ tự không đổi.
      if (withoutDragged.join(',') === current.join(',')) return;
      previewIdsRef.current = withoutDragged;
      setPreviewIds(withoutDragged);
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      // endDrag đọc previewIds từ state nên phải chờ 1 nhịp render
      // sau lần setPreviewIds cuối cùng; dùng setTimeout 0 để tránh
      // lưu thứ tự của lần di chuyển chưa kịp cập nhật.
      setTimeout(() => endDrag(), 0);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  const handleBuyNow = (product: Product) => {
    navigate(`/checkout/${product.id}`);
  };

  const handleViewNotes = (product: Product) => {
    navigate(`/product-notes/${product.id}`);
  };

  // Giá hiển thị: trước đây getPrice trả thẳng price_public /
  // price_ctv, nên chỉ cần 1 sản phẩm thiếu giá (undefined) là
  // price.toLocaleString() crash cả trang shop. Giờ thiếu giá nào
  // thì rơi về giá còn lại, cuối cùng là 0, không bao giờ trả
  // undefined. Không lưu gì thêm vào localStorage, chỉ sửa cách
  // hiển thị, dữ liệu sản phẩm vẫn nằm ở Firestore như cũ.
  // Hai luồng giá CTV (từ 04/11): CTV chính thấy giá CTV chung
  // của chính (price_ctv, có giá riêng ctvtime thì ưu tiên),
  // CTV phụ chỉ thấy giá CTV riêng của shop phụ (price_ctv_sub,
  // chưa có thì rơi về giá Public — không rơi về giá CTV của
  // chính để 2 luồng không lộ sang nhau).
  const getPrice = (
    price_public: number,
    price_ctv: number,
    price_ctvtime?: number,
    price_ctv_sub?: number
  ): number => {
    const pub = Number(price_public) || 0;
    const ctv = Number(price_ctv) || 0;
    const ctvtime = Number(price_ctvtime) || 0;
    const ctvSub = Number(price_ctv_sub) || 0;
    if (isCtvtime) {
      return ctvtime > 0 ? ctvtime : ctv > 0 ? ctv : pub;
    }
    if (isSubCtv) {
      return ctvSub > 0 ? ctvSub : pub;
    }
    if (isCTV) {
      return ctv > 0 ? ctv : pub;
    }
    return pub;
  };

  const renderProductRow = (
    product: Product,
    showNotes: boolean,
    categoryName?: string
  ) => {
    const inStock = product.in_stock !== false;
    const rowCategory = categoryName || product.category || 'Khác';
    const isDragging = dragId === product.id;
    const isDragOver = dragOverId === product.id && !isDragging;

    return (
      <tr
        key={product.id}
        data-product-id={product.id}
        data-category={rowCategory}
        className="border-t border-slate-100 hover:bg-indigo-50/60 transition-all duration-150"
        style={{
          // Hàng đang kéo: nổi lên, mờ nhẹ, nền hồng nhạt.
          // Hàng đích: vạch hồng dày ở đúng mép sẽ chèn vào
          // (trên nếu chèn trước, dưới nếu chèn sau).
          boxShadow: isDragging
            ? '0 10px 24px rgba(219, 39, 119, 0.18)'
            : isDragOver && dragInsert === 'before'
              ? 'inset 0 3px 0 0 #db2777'
              : isDragOver
                ? 'inset 0 -3px 0 0 #db2777'
                : '0 1px 6px 0 rgba(0,0,0,0.06)',
          opacity: isDragging ? 0.55 : 1,
          backgroundColor: isDragging
            ? '#fdf2f8'
            : isDragOver
              ? '#fff1f2'
              : undefined,
        }}
      >
        {showSortOrder && (
          <td className="px-3 py-4 text-center">
            {dragEnabled ? (
              <span className="inline-flex flex-col items-center gap-1">
                <span
                  onPointerDown={(e) => handleDragStart(e, product, rowCategory)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-pink-50 text-primary border border-pink-100 hover:bg-pink-100 hover:scale-105 active:scale-95 active:cursor-grabbing cursor-grab select-none leading-none text-base shadow-sm transition-all"
                  style={{ touchAction: 'none' }}
                  title="Nhấn giữ để kéo đổi thứ tự"
                >
                  ⋮⋮
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {product.sort_order || 0}
                </span>
              </span>
            ) : (
              <span className="text-xs font-bold text-gray-400">
                {product.sort_order || 0}
              </span>
            )}
          </td>
        )}
        <td className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md group shrink-0">
              <img 
                src={product.image_url || 'https://picsum.photos/seed/premium/200/200'} 
                alt={product.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              {product.is_hot && (
                <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-bl-lg shadow-sm uppercase z-10">
                  HOT 🔥
                </div>
              )}
              {product.discount_percent && product.discount_percent > 0 && (
                <div className="absolute top-0 left-0 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-br-lg shadow-sm uppercase z-10">
                  -{product.discount_percent}%
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-gray-800 text-base leading-tight">{product.name}</span>
              {inStock ? (
                <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                  Còn hàng
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                  Hết hàng
                </span>
              )}
            </div>
          </div>
        </td>
        {showCategory && !groupByCategory && (
          <td className="px-6 py-4">
            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">
              {product.category}
            </span>
          </td>
        )}
        <td className="px-6 py-4">
          {product.variants && product.variants.length > 0 ? (
            <select 
              value={selectedVariantIndices[product.id] ?? -1}
              onChange={(e) => setSelectedVariantIndices({ ...selectedVariantIndices, [product.id]: Number(e.target.value) })}
              className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg border border-blue-100 focus:outline-none cursor-pointer"
            >
              <option value={-1}>{product.form}</option>
              {product.variants.map((v, idx) => (
                <option key={idx} value={idx}>{v.form}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              {product.form}
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className="text-xs font-bold text-purple-500 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
            {product.package}
          </span>
        </td>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="text-xl font-cute font-bold text-gray-900">
              {(() => {
                const variantIdx = selectedVariantIndices[product.id] ?? -1;
                let price: number;
                if (variantIdx === -1) {
                  price = getPrice(product.price_public, product.price_ctv, product.price_ctvtime, product.price_ctv_sub);
                } else {
                  const v = product.variants![variantIdx];
                  // Biến thể chưa có giá CTV phụ riêng thì dùng
                  // giá CTV phụ chung của sản phẩm (admin phụ chỉ
                  // đặt 1 giá CTV chung cho cả sản phẩm, không đặt
                  // riêng từng biến thể), cuối cùng mới về Public.
                  price = getPrice(v.price_public, v.price_ctv, v.price_ctvtime, v.price_ctv_sub ?? product.price_ctv_sub);
                }
                return (Number(price) || 0).toLocaleString('vi-VN');
              })()}đ
            </span>
            {isCTV && (
              <span className="text-[9px] text-green-500 font-black uppercase tracking-tighter">Ưu đãi CTV</span>
            )}
          </div>
        </td>
        {/* CỘT GHI CHÚ - chỉ render khi showNotes = true */}
        {showNotes && (
          <td className="px-4 py-4 max-w-[220px]">
            {product.notes ? (
              <button
                onClick={() => handleViewNotes(product)}
                className="text-sm text-gray-700 hover:text-primary transition-colors text-left font-medium cursor-pointer bg-gray-50 hover:bg-gray-100 p-3 rounded-lg w-full"
                title="Nhấn để xem đầy đủ"
              >
                <span className="block overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {product.notes}
                </span>
                <span className="text-xs text-primary font-bold mt-1 block">Xem thêm →</span>
              </button>
            ) : null}
          </td>
        )}
        {/* CỘT NÚT MUA NGAY — chỉ khách mới có. Admin không mua nên
            bỏ hẳn cột này ở bảng admin, khỏi đội bảng rộng ra rồi
            đẩy nút Xóa ra ngoài khung như trước. */}
        {!isAdmin && (
          <td className="px-6 py-4">
            <button
              onClick={() => handleBuyNow(product)}
              disabled={!inStock}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 w-fit whitespace-nowrap ${
                inStock
                  ? 'bg-primary hover:bg-pink-600 text-white shadow-md shadow-primary/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {inStock ? <><span>🛒</span> Mua ngay</> : <><span>⏳</span> Hết hàng</>}
            </button>
          </td>
        )}
        {isAdmin && (
          <td className="px-3 py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 flex-nowrap">
              <button
                onClick={() => onEdit?.(product)}
                className="w-8 h-8 shrink-0 flex items-center justify-center bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors border border-yellow-100"
                title="Sửa"
              >
                ✏️
              </button>
              {onToggleHidden && (
                <button
                  type="button"
                  onClick={() => onToggleHidden(product)}
                  className={`w-14 h-7 rounded-full transition-all duration-200 relative shrink-0 shadow-inner hover:scale-105 active:scale-95 ${
                    product.is_hidden
                      ? 'bg-gray-200'
                      : 'bg-gradient-to-r from-green-400 to-emerald-500 shadow-green-200'
                  }`}
                  title={product.is_hidden ? 'Đang ẩn — bấm để hiện lại' : 'Đang hiện — bấm để ẩn'}
                  aria-label={product.is_hidden ? 'Hiện sản phẩm' : 'Ẩn sản phẩm'}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center transition-transform duration-200 ${
                      product.is_hidden ? 'translate-x-0' : 'translate-x-7'
                    }`}
                  >
                    {product.is_hidden ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 2L10 10M10 2L2 10" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6.5L4.5 9L10 3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={() => onDuplicate(product)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors border border-blue-100"
                  title="Nhân bản (tạo bản sao ngay sau sản phẩm này, giữ nguyên ảnh)"
                >
                  📋
                </button>
              )}
              <button
                onClick={() => onDelete?.(product.id)}
                className="w-8 h-8 shrink-0 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
                title="Xóa"
              >
                🗑️
              </button>
            </div>
          </td>
        )}
      </tr>
    );
  };

  const renderTableHeader = (showNotes: boolean, hideCategory = false) => (
    <thead>
      <tr className="bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50 text-gray-700 font-cute text-sm uppercase tracking-wider">
        {showSortOrder && <th className="px-3 py-4 font-bold text-center">STT</th>}
        <th className="px-6 py-4 font-bold">Sản phẩm</th>
        {showCategory && !hideCategory && <th className="px-6 py-4 font-bold">Danh mục</th>}
        <th className="px-6 py-4 font-bold">Hình thức</th>
        <th className="px-6 py-4 font-bold">Gói</th>
        <th className="px-6 py-4 font-bold">Giá</th>
        {showNotes && <th className="px-6 py-4 font-bold">Ghi chú</th>}
        {!isAdmin && <th className="px-6 py-4 font-bold">Hành động</th>}
        {isAdmin && <th className="px-3 py-4 text-center font-bold">Thao tác</th>}
      </tr>
    </thead>
  );

  if (groupByCategory && isAdmin) {
    const grouped = products.reduce((acc, product) => {
      const cat = product.category || 'Khác';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    const categoryNames = categories.map(c => c.name);
    const sortedCategoryKeys = Object.keys(grouped).sort((a, b) => {
      const idxA = categoryNames.indexOf(a);
      const idxB = categoryNames.indexOf(b);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    if (products.length === 0) {
      return (
        <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.30)] px-6 py-12 text-center text-gray-400 italic">
          Chưa có sản phẩm nào được đăng...
        </div>
      );
    }

    return (
      <div className="w-full space-y-8">
        {dragEnabled && (
          <p className="text-xs text-gray-500 bg-white/70 border border-pink-100 rounded-2xl px-4 py-3">
            💡 <strong>Nhấn giữ ⋮⋮ ở cột STT rồi kéo lên/xuống</strong> để đổi thứ tự
            trong cùng danh mục, thả tay là tự lưu. Nút 📋 là nhân bản sản phẩm.
          </p>
        )}
        {sortedCategoryKeys.map((categoryName) => {
          const catProducts = grouped[categoryName];
          // Ở bảng quản trị có kéo-thả thì xếp đúng theo sort_order để
          // thứ tự kéo là thứ tự thật; không có kéo-thả thì giữ luật
          // cũ (HOT lên đầu rồi mới tới sort_order).
          const sortedCatProducts = [...catProducts].sort((a: any, b: any) => {
            if (onReorder) return (a.sort_order || 0) - (b.sort_order || 0);
            if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
            return b.is_hot ? 1 : -1;
          });

          // Khi đang kéo, hiển thị thứ tự xem trước thay vì thứ tự gốc.
          const displayedCatProducts =
            dragEnabled && previewCategory === categoryName && previewIds
              ? previewIds
                  .map((id) => sortedCatProducts.find((p) => p.id === id))
                  .filter((p): p is Product => !!p)
              : sortedCatProducts;

          // Chỉ hiện cột ghi chú nếu ít nhất 1 sản phẩm trong nhóm có ghi chú
          const hasNotes = sortedCatProducts.some(p => p.notes && p.notes.trim() !== '');

          const catInfo = categories.find(c => c.name === categoryName);
          const catColor = catInfo?.color || 'from-gray-400 to-gray-600';
          const catIcon = catInfo?.icon || '📦';
          const catDesc = catInfo?.desc || '';

          return (
            <div key={categoryName} className="w-full">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${catColor} flex items-center justify-center text-white text-lg shadow-sm shrink-0`}>
                  {catIcon}
                </div>
                <div>
                  <h3 className="font-cute font-bold text-gray-800 text-lg leading-tight">{categoryName}</h3>
                  {catDesc && (
                    <p className="text-xs text-gray-400">{catDesc}</p>
                  )}
                </div>
                <span className="ml-auto text-xs text-gray-300 font-mono">{catProducts.length} sản phẩm</span>
              </div>

              <div className="w-full overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.30)]">
                <table className="w-full text-left border-collapse">
                  {renderTableHeader(hasNotes, true)}
                  <tbody className="font-body">
                    {displayedCatProducts.map((product) => renderProductRow(product, hasNotes, categoryName))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        {/* Thẻ nổi đi theo con trỏ khi đang kéo: nhìn là biết mình
            đang cầm sản phẩm nào, thay vì chỉ thấy hàng cũ mờ đi. */}
        {dragEnabled && dragId && dragPreviewPos && (() => {
          const dragged = products.find((p) => p.id === dragId);
          if (!dragged) return null;
          return (
            <div
              className="fixed z-[300] pointer-events-none flex items-center gap-2 bg-white border border-pink-200 rounded-2xl shadow-xl shadow-pink-200 px-3 py-2 max-w-[280px]"
              style={{ left: dragPreviewPos.x + 16, top: dragPreviewPos.y + 16 }}
            >
              {dragged.image_url && (
                <img
                  src={dragged.image_url}
                  alt=""
                  className="w-8 h-8 rounded-lg object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-xs font-bold text-gray-800 leading-tight">
                {dragged.name}
              </span>
            </div>
          );
        })()}
      </div>
    );
  }

  // Khách (không phải admin) không bao giờ thấy sản phẩm đang ẩn,
  // kể cả khi component này được dùng ở trang khác ngoài Home.
  // Admin vẫn thấy đủ để gạt hiện lại.
  const customerProducts = isAdmin
    ? products
    : products.filter((p) => !p.is_hidden);

  // Chỉ hiện cột ghi chú nếu ít nhất 1 sản phẩm có ghi chú
  const hasNotes = customerProducts.some(p => p.notes && p.notes.trim() !== '');

  return (
    <div className="w-full overflow-x-auto bg-white rounded-3xl border border-slate-200 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.30)]">
      <table className="w-full text-left border-collapse">
        {renderTableHeader(hasNotes)}
        <tbody className="font-body">
          {customerProducts.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? (showCategory ? 8 : 7) : (showCategory ? 8 : 7)} className="px-6 py-12 text-center text-gray-400 italic">
                Chưa có sản phẩm nào được đăng...
              </td>
            </tr>
          ) : (
            customerProducts.map((product) => renderProductRow(product, hasNotes))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;

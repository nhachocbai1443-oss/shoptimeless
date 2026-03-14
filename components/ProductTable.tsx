import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, User, Category } from '../types';

interface ProductTableProps {
  products: Product[];
  user: User | null;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  showCategory?: boolean;
  showSortOrder?: boolean;
  groupByCategory?: boolean;
  categories?: Category[];
}

const ProductTable: React.FC<ProductTableProps> = ({ 
  products, 
  user, 
  onEdit, 
  onDelete, 
  showCategory = false,
  showSortOrder = false,
  groupByCategory = false,
  categories = [],
}) => {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isCTV = user?.role === 'ctv';
  const isCtvtime = isCTV && user?.username === 'ctvtime';
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<Record<string, number>>({});
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);

  const handleBuyNow = (product: Product) => {
    navigate(`/checkout/${product.id}`);
  };

  const handleOpenNotesModal = (product: Product) => {
    setSelectedProductForModal(product);
    setShowNotesModal(true);
  };

  const handleCloseNotesModal = () => {
    setShowNotesModal(false);
    setSelectedProductForModal(null);
  };

  const getPrice = (
    price_public: number,
    price_ctv: number,
    price_ctvtime?: number
  ): number => {
    if (isCtvtime) {
      return (price_ctvtime && price_ctvtime > 0) ? price_ctvtime : price_ctv;
    }
    if (isCTV) {
      return price_ctv;
    }
    return price_public;
  };

  const renderProductRow = (product: Product, rankInCategory?: number) => {
    const inStock = product.in_stock !== false;

    return (
      <tr
        key={product.id}
        className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors"
        style={{
          boxShadow: '0 1px 6px 0 rgba(0,0,0,0.06)',
        }}
      >
        {showSortOrder && (
          <td className="px-6 py-4 text-center">
            <span className="text-xs font-bold text-gray-400">
              {product.sort_order || 0}
            </span>
          </td>
        )}
        <td className="px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-gray-100 bg-white shadow-sm group shrink-0">
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
                  price = getPrice(product.price_public, product.price_ctv, product.price_ctvtime);
                } else {
                  const v = product.variants![variantIdx];
                  price = getPrice(v.price_public, v.price_ctv, v.price_ctvtime);
                }
                return price.toLocaleString('vi-VN');
              })()}đ
            </span>
            {isCTV && (
              <span className="text-[9px] text-green-500 font-black uppercase tracking-tighter">Ưu đãi CTV</span>
            )}
          </div>
        </td>
        {/* CỘT GHI CHÚ - RIÊNG BIỆT */}
        <td className="px-6 py-4 min-w-[300px]">
          <button
            onClick={() => handleOpenNotesModal(product)}
            className="text-sm text-gray-700 hover:text-primary transition-colors leading-relaxed line-clamp-3 text-left font-medium hover:underline cursor-pointer bg-gray-50 hover:bg-gray-100 p-3 rounded-lg w-full text-justify"
            title={product.notes}
          >
            {product.notes}
          </button>
        </td>
        {/* CỘT NÚT MUA NGAY - RIÊNG BIỆT */}
        <td className="px-6 py-4">
          {!isAdmin && (
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
          )}
        </td>
        {isAdmin && (
          <td className="px-6 py-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={() => onEdit?.(product)}
                className="w-9 h-9 flex items-center justify-center bg-yellow-50 text-yellow-600 rounded-xl hover:bg-yellow-100 transition-colors border border-yellow-100"
                title="Sửa"
              >
                ✏️
              </button>
              <button 
                onClick={() => onDelete?.(product.id)}
                className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
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

  // MODAL CHÚ THÍCH SẢN PHẨM
  const renderNotesModal = () => {
    if (!showNotesModal || !selectedProductForModal) return null;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={handleCloseNotesModal}
        ></div>
        
        <div className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-8 flex flex-col gap-6 animate-slide-up">
          <button
            onClick={handleCloseNotesModal}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors text-gray-600 font-bold text-xl z-10"
          >
            ✕
          </button>

          <div className="pr-12">
            <h2 className="text-3xl font-cute font-bold text-gray-900 mb-2">
              {selectedProductForModal.name}
            </h2>
            <p className="text-sm text-gray-500">Thông tin chi tiết về sản phẩm</p>
          </div>

          {selectedProductForModal.image_url && (
            <div className="w-full rounded-2xl overflow-hidden border border-gray-100 bg-gray-50">
              <img
                src={selectedProductForModal.image_url}
                alt={selectedProductForModal.name}
                className="w-full h-auto object-cover max-h-[350px]"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">📋</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Hình thức</h3>
                <p className="text-gray-900 font-bold text-lg break-words">{selectedProductForModal.form}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">📦</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Gói</h3>
                <p className="text-gray-900 font-bold text-lg break-words">{selectedProductForModal.package}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">🏷️</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Danh mục</h3>
                <p className="text-gray-900 font-bold text-lg break-words">{selectedProductForModal.category}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">💰</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Giá</h3>
                <div className="space-y-2">
                  <p className="text-gray-900 font-bold text-xl">
                    {selectedProductForModal.price_public.toLocaleString('vi-VN')}đ
                    <span className="text-xs text-gray-500 ml-2">(Giá công khai)</span>
                  </p>
                  <p className="text-gray-900 font-bold text-xl">
                    {selectedProductForModal.price_ctv.toLocaleString('vi-VN')}đ
                    <span className="text-xs text-green-600 ml-2">(Giá CTV)</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">📊</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Tình trạng</h3>
                <p className={`font-bold text-lg ${selectedProductForModal.in_stock !== false ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedProductForModal.in_stock !== false ? '✅ Còn hàng' : '❌ Hết hàng'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <div className="text-3xl shrink-0">📝</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-2">Chú thích / Mô tả</h3>
                <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-base break-words font-medium">
                  {selectedProductForModal.notes}
                </p>
              </div>
            </div>

            {selectedProductForModal.variants && selectedProductForModal.variants.length > 0 && (
              <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
                <div className="text-3xl shrink-0">🔄</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wider mb-3">Các lựa chọn khác</h3>
                  <div className="space-y-3">
                    {selectedProductForModal.variants.map((variant, idx) => (
                      <div key={idx} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <p className="font-bold text-gray-900 mb-2 break-words text-lg">{variant.form}</p>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>Giá công khai: <span className="font-bold text-gray-900 text-base">{variant.price_public.toLocaleString('vi-VN')}đ</span></p>
                          <p>Giá CTV: <span className="font-bold text-green-600 text-base">{variant.price_ctv.toLocaleString('vi-VN')}đ</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCloseNotesModal}
            className="w-full bg-primary hover:bg-pink-600 text-white py-3 rounded-2xl font-bold transition-all shadow-md shadow-primary/20 mt-4 text-lg"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  };

  const renderTableHeader = (hideCategory = false) => (
    <thead>
      <tr className="bg-gray-50/50 text-gray-500 font-cute text-sm uppercase tracking-wider">
        {showSortOrder && <th className="px-6 py-4 font-bold text-center">STT</th>}
        <th className="px-6 py-4 font-bold">Sản phẩm</th>
        {showCategory && !hideCategory && <th className="px-6 py-4 font-bold">Danh mục</th>}
        <th className="px-6 py-4 font-bold">Hình thức</th>
        <th className="px-6 py-4 font-bold">Gói</th>
        <th className="px-6 py-4 font-bold">Giá</th>
        <th className="px-6 py-4 font-bold">Ghi chú</th>
        <th className="px-6 py-4 font-bold">Hành động</th>
        {isAdmin && <th className="px-6 py-4 text-center font-bold">Thao tác</th>}
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
        <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm px-6 py-12 text-center text-gray-400 italic">
          Chưa có sản phẩm nào được đăng...
        </div>
      );
    }

    return (
      <>
        <div className="w-full space-y-8">
          {sortedCategoryKeys.map((categoryName) => {
            const catProducts = grouped[categoryName];
            const sortedCatProducts = [...catProducts].sort((a: any, b: any) => {
              if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
              return b.is_hot ? 1 : -1;
            });

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

                <div className="w-full overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    {renderTableHeader(true)}
                    <tbody className="font-body">
                      {sortedCatProducts.map((product) => renderProductRow(product))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
        {renderNotesModal()}
      </>
    );
  }

  return (
    <>
      <div className="w-full overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
        <table className="w-full text-left border-collapse">
          {renderTableHeader()}
          <tbody className="font-body">
            {products.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? (showCategory ? 9 : 8) : (showCategory ? 8 : 7)} className="px-6 py-12 text-center text-gray-400 italic">
                  Chưa có sản phẩm nào được đăng...
                </td>
              </tr>
            ) : (
              products.map((product) => renderProductRow(product))
            )}
          </tbody>
        </table>
      </div>
      {renderNotesModal()}
    </>
  );
};

export default ProductTable;

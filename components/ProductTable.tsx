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
  // Chế độ phân nhóm theo danh mục (dùng cho trang admin)
  groupByCategory?: boolean;
  // Danh sách danh mục (để lấy icon, màu, thứ tự)
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
  // Kiểm tra có phải CTV đặc biệt ctvtime không
  const isCtvtime = isCTV && user?.username === 'ctvtime';
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<Record<string, number>>({});

  const handleBuyNow = (product: Product) => {
    navigate(`/checkout/${product.id}`);
  };

  // Hàm lấy giá phù hợp theo loại user
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

  // ---- RENDER MỘT HÀNG SẢN PHẨM ----
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
              {/* Badge tình trạng hàng */}
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
        <td className="px-6 py-4">
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 leading-relaxed max-w-[180px] line-clamp-2" title={product.notes}>
              {product.notes}
            </p>
            {!isAdmin && (
              <button 
                onClick={() => handleBuyNow(product)}
                disabled={!inStock}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 w-fit ${
                  inStock
                    ? 'bg-primary hover:bg-pink-600 text-white shadow-md shadow-primary/20'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {inStock ? <><span>🛒</span> Mua ngay</> : <><span>⏳</span> Hết hàng</>}
              </button>
            )}
          </div>
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
        {!isAdmin && <td className="px-6 py-4"></td>}
      </tr>
    );
  };

  // ---- RENDER HEADER TABLE ----
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
        {isAdmin && <th className="px-6 py-4 text-center font-bold">Thao tác</th>}
        {!isAdmin && <th className="px-6 py-4"></th>}
      </tr>
    </thead>
  );

  // ---- CHẾ ĐỘ PHÂN NHÓM THEO DANH MỤC (dùng cho admin) ----
  if (groupByCategory && isAdmin) {
    // Nhóm sản phẩm theo danh mục
    const grouped = products.reduce((acc, product) => {
      const cat = product.category || 'Khác';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    // Sắp xếp danh mục theo thứ tự từ categories prop
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
      <div className="w-full space-y-8">
        {sortedCategoryKeys.map((categoryName) => {
          const catProducts = grouped[categoryName];
          // Sắp xếp sản phẩm trong danh mục: is_hot lên đầu, sau đó theo sort_order
          const sortedCatProducts = [...catProducts].sort((a: any, b: any) => {
            if (b.is_hot === a.is_hot) return (a.sort_order || 0) - (b.sort_order || 0);
            return b.is_hot ? 1 : -1;
          });

          // Lấy thông tin danh mục (icon, màu)
          const catInfo = categories.find(c => c.name === categoryName);
          const catColor = catInfo?.color || 'from-gray-400 to-gray-600';
          const catIcon = catInfo?.icon || '📦';
          const catDesc = catInfo?.desc || '';

          return (
            <div key={categoryName} className="w-full">
              {/* Header danh mục */}
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

              {/* Bảng sản phẩm trong danh mục */}
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
    );
  }

  // ---- CHẾ ĐỘ BÌNH THƯỜNG (không phân nhóm) ----
  return (
    <div className="w-full overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
      <table className="w-full text-left border-collapse">
        {renderTableHeader()}
        <tbody className="font-body">
          {products.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? (showCategory ? 8 : 7) : (showCategory ? 7 : 6)} className="px-6 py-12 text-center text-gray-400 italic">
                Chưa có sản phẩm nào được đăng...
              </td>
            </tr>
          ) : (
            products.map((product) => renderProductRow(product))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, User } from '../types';

interface ProductTableProps {
  products: Product[];
  user: User | null;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  showCategory?: boolean;
  showSortOrder?: boolean;
}

const ProductTable: React.FC<ProductTableProps> = ({ 
  products, 
  user, 
  onEdit, 
  onDelete, 
  showCategory = false,
  showSortOrder = false
}) => {
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const isCTV = user?.role === 'ctv';
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<Record<string, number>>({});

  const handleBuyNow = (product: Product) => {
    navigate(`/checkout/${product.id}`);
  };

  return (
    <div className="w-full overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50/50 text-gray-500 font-cute text-sm uppercase tracking-wider">
            {showSortOrder && <th className="px-6 py-4 font-bold text-center">STT</th>}
            <th className="px-6 py-4 font-bold">Sản phẩm</th>
            {showCategory && <th className="px-6 py-4 font-bold">Danh mục</th>}
            <th className="px-6 py-4 font-bold">Hình thức</th>
            <th className="px-6 py-4 font-bold">Gói</th>
            <th className="px-6 py-4 font-bold">Giá</th>
            <th className="px-6 py-4 font-bold">Ghi chú</th>
            {isAdmin && <th className="px-6 py-4 text-center font-bold">Thao tác</th>}
            {!isAdmin && <th className="px-6 py-4"></th>}
          </tr>
        </thead>
        <tbody className="font-body">
          {products.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? (showCategory ? 8 : 7) : (showCategory ? 7 : 6)} className="px-6 py-12 text-center text-gray-400 italic">
                Chưa có sản phẩm nào được đăng...
              </td>
            </tr>
          ) : (
            products.map((product) => (
              <tr key={product.id} className="border-t border-gray-50 hover:bg-gray-50/30 transition-colors">
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
                    <span className="font-bold text-gray-800 text-base">{product.name}</span>
                  </div>
                </td>
                {showCategory && (
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
                        const price = variantIdx === -1 
                          ? (isCTV ? product.price_ctv : product.price_public)
                          : (isCTV ? product.variants![variantIdx].price_ctv : product.variants![variantIdx].price_public);
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
                        className="bg-primary hover:bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/20 flex items-center justify-center gap-2 w-fit"
                      >
                        <span>🛒</span> Mua ngay
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;

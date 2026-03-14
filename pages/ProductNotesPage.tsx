import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ProductNotesPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      setLoading(true);
      try {
        const pDocRef = doc(db, 'products', productId);
        const pDocSnap = await getDoc(pDocRef);
        
        if (!pDocSnap.exists()) {
          setProduct(null);
        } else {
          setProduct({ id: pDocSnap.id, ...pDocSnap.data() } as any);
        }
      } catch (err) {
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Không tìm thấy sản phẩm!</h2>
        <button 
          onClick={() => navigate(-1)}
          className="text-primary font-bold hover:underline"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between mb-8">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-600 font-bold hover:text-primary hover:border-primary transition-all group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">⬅️</span> Quay lại
          </button>
          <h2 className="text-3xl font-cute font-bold text-gray-800">Thông tin sản phẩm</h2>
          <div className="w-24"></div>
        </div>

        {/* Product Info Card */}
        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 p-12 space-y-8">
          {/* Product Header */}
          <div className="flex items-start gap-6 pb-8 border-b border-gray-100">
            {product.image_url && (
              <div className="w-32 h-32 rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 shrink-0">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-cute font-bold text-gray-900 mb-3">
                {product.name}
              </h1>
              <div className="flex items-center gap-3">
                {product.in_stock !== false ? (
                  <span className="inline-flex items-center gap-2 bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-full text-sm font-bold">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                    Còn hàng
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 bg-red-50 text-red-500 border border-red-200 px-4 py-2 rounded-full text-sm font-bold">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                    Hết hàng
                  </span>
                )}
                {product.is_hot && (
                  <span className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-full text-sm font-bold">
                    🔥 HOT
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ghi Chú / Mô Tả - PHẦN CHÍNH */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl">📝</div>
              <h3 className="font-bold text-gray-800 text-xl uppercase tracking-wider">Ghi Chú / Mô Tả</h3>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-3xl p-8 ml-16">
              <p className="text-gray-900 leading-relaxed whitespace-pre-wrap text-lg font-medium break-words">
                {product.notes}
              </p>
            </div>
          </div>

          {/* Back Button at Bottom */}
          <div className="border-t border-gray-100 pt-8 flex gap-4">
            <button
              onClick={() => navigate(-1)}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 py-4 rounded-3xl font-bold transition-all text-lg"
            >
              ⬅️ Quay lại
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductNotesPage;

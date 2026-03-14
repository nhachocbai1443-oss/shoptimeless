import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

// ===== SIMPLE MARKDOWN RENDERER (không cần thư viện ngoài) =====
const renderMarkdown = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  const parseInline = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Regex: ảnh ![alt](url), bold **text**, italic *text*, link [text](url)
    const regex = /!\[([^\]]*)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
    let last = 0;
    let match;
    while ((match = regex.exec(str)) !== null) {
      if (match.index > last) {
        parts.push(str.slice(last, match.index));
      }
      if (match[0].startsWith('![')) {
        // Ảnh
        parts.push(
          <img
            key={match.index}
            src={match[2]}
            alt={match[1] || 'ảnh'}
            className="max-w-full rounded-xl my-3 shadow-sm border border-gray-100"
            referrerPolicy="no-referrer"
          />
        );
      } else if (match[0].startsWith('**')) {
        // Bold
        parts.push(<strong key={match.index} className="font-bold">{match[3]}</strong>);
      } else if (match[0].startsWith('*')) {
        // Italic
        parts.push(<em key={match.index}>{match[4]}</em>);
      } else if (match[0].startsWith('[')) {
        // Link
        parts.push(
          <a key={match.index} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">
            {match[5]}
          </a>
        );
      }
      last = match.index + match[0].length;
    }
    if (last < str.length) {
      parts.push(str.slice(last));
    }
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Dòng trống
    if (line.trim() === '') {
      result.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // Heading ### H3
    if (line.startsWith('### ')) {
      result.push(
        <h3 key={i} className="text-lg font-bold text-gray-800 mt-4 mb-1">
          {parseInline(line.slice(4))}
        </h3>
      );
      i++;
      continue;
    }

    // Heading ## H2
    if (line.startsWith('## ')) {
      result.push(
        <h2 key={i} className="text-xl font-bold text-gray-900 mt-5 mb-2">
          {parseInline(line.slice(3))}
        </h2>
      );
      i++;
      continue;
    }

    // Heading # H1
    if (line.startsWith('# ')) {
      result.push(
        <h1 key={i} className="text-2xl font-bold text-gray-900 mt-6 mb-3">
          {parseInline(line.slice(2))}
        </h1>
      );
      i++;
      continue;
    }

    // Blockquote >
    if (line.startsWith('> ')) {
      result.push(
        <blockquote key={i} className="border-l-4 border-blue-300 bg-blue-50 pl-4 py-2 my-2 rounded-r-lg text-gray-700 italic">
          {parseInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Dòng kẻ ngang ---
    if (line.trim() === '---' || line.trim() === '***') {
      result.push(<hr key={i} className="my-4 border-gray-200" />);
      i++;
      continue;
    }

    // List item - hoặc *
    if (line.match(/^[-*] /)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listItems.push(
          <li key={i} className="flex items-start gap-2">
            <span className="text-primary mt-1 shrink-0">•</span>
            <span>{parseInline(lines[i].slice(2))}</span>
          </li>
        );
        i++;
      }
      result.push(
        <ul key={`ul-${i}`} className="space-y-1 my-2 ml-1">
          {listItems}
        </ul>
      );
      continue;
    }

    // Ảnh standalone ![alt](url) trên một dòng riêng
    if (line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)) {
      const imgMatch = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)!;
      result.push(
        <div key={i} className="my-3">
          <img
            src={imgMatch[2]}
            alt={imgMatch[1] || 'ảnh'}
            className="max-w-full rounded-xl shadow-sm border border-gray-100"
            referrerPolicy="no-referrer"
          />
        </div>
      );
      i++;
      continue;
    }

    // Đoạn văn thường
    result.push(
      <p key={i} className="text-gray-800 leading-relaxed">
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return result;
};

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
        <div className="bg-white rounded-[40px] shadow-xl border border-gray-100 p-8 md:p-12 space-y-8">
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
              <h1 className="text-3xl font-cute font-bold text-gray-900 mb-3">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
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

          {/* Ghi Chú / Mô Tả - render Markdown */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📝</div>
              <h3 className="font-bold text-gray-800 text-xl uppercase tracking-wider">Ghi Chú / Mô Tả</h3>
            </div>
            <div className="prose prose-sm max-w-none ml-0 md:ml-12 space-y-1">
              {product.notes
                ? renderMarkdown(product.notes)
                : <p className="text-gray-400 italic">Không có ghi chú.</p>
              }
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

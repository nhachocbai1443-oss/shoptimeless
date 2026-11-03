export type UserRole = 'admin' | 'ctv' | 'user' | 'subadmin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
  // Admin phụ (subadmin): mã link shop riêng, tên shop, id của
  // admin chính đã tạo ra tài khoản này. Admin chính không có
  // 3 field này. Mã link KHÔNG nên trùng username.
  shop_slug?: string | null;
  shop_name?: string | null;
  created_by?: string | null;
}

export interface ProductVariant {
  form: string;
  price_public: number;
  price_ctv: number;
  price_ctvtime?: number; // Giá riêng cho CTV ctvtime (nếu không có thì dùng price_ctv)
}

export interface Product {
  id: string;
  name: string;
  image_url: string;
  form: string; // Hình thức mặc định
  package: string; // Gói
  price_public: number; // Giá mặc định
  price_ctv: number; // Giá CTV chung
  price_ctvtime?: number; // Giá riêng cho CTV ctvtime (nếu không có thì dùng price_ctv)
  variants?: ProductVariant[]; // Các lựa chọn hình thức khác
  discount_percent?: number; // Phần trăm giảm giá
  is_hot?: boolean; // Sản phẩm hot
  sort_order?: number; // Thứ tự sắp xếp
  in_stock?: boolean; // Tình trạng còn hàng (mặc định true nếu không có)
  is_hidden?: boolean; // true = ẩn khỏi trang khách (admin vẫn thấy và vẫn sửa được)
  notes: string;
  category: string;
  created_at?: string;
  // Mã shop sở hữu sản phẩm. Không có / null = shop của admin
  // chính. Có mã = sản phẩm của riêng shop phụ đó, sửa/xóa ở
  // shop đó không động tới shop chính hay shop phụ khác.
  shop_slug?: string | null;
}

export interface AppState {
  currentUser: User | null;
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon_url: string;
  desc: string;
  account_name: string;
  account_no: string;
  bank_name: string; // e.g., 'ACB', 'MoMo', 'ZaloPay'
  custom_qr_url?: string; // Ảnh QR tùy chỉnh (dùng cho MoMo, ZaloPay thay vì VietQR tự động)
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  desc: string;
  color: string;
  sort_order: number;
}

export interface AppSettings {
  id: number;
  ctv_page_content: string;
  payment_methods: PaymentMethod[];
  categories?: Category[];
}

export interface Order {
  id: string;
  product_id: string;
  product_name: string;
  variant_form: string;
  quantity: number;
  total_price: number;
  full_name: string;
  contact: string;
  email: string;
  notes: string;
  payment_method: string;
  account_info?: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  // Mã shop mà đơn này mua từ đó. Không có / null = shop chính.
  // Dùng để admin phụ chỉ thấy đơn của shop mình.
  shop_slug?: string | null;
}

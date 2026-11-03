import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc } from 'firebase/firestore';
import { Product, User, Category } from '../types';

// ---------------------------------------------------------------------------
// Shop phụ (subadmin) — luật đã chốt với bạn:
// - Mã link do admin chính tự đặt, sửa được, KHÔNG dùng mã ngẫu nhiên.
// - Lúc tạo admin phụ: sao chép toàn bộ sản phẩm của admin chính sang
//   shop phụ (mỗi sản phẩm thành 1 document mới, mã shop = slug mới).
// - Sau lúc tạo thì tách riêng hoàn toàn: admin phụ sửa/xóa/thêm chỉ
//   ảnh hưởng shop của mình, không động tới shop chính hay shop khác.
// - Ngoại lệ duy nhất: admin chính THÊM MỚI sản phẩm (không phải sửa
//   hay xóa sản phẩm cũ) thì sản phẩm mới đó tự sao chép sang tất cả
//   các shop phụ đã có. Admin chính sửa/xóa sản phẩm cũ thì KHÔNG
//   ghi đè hay xóa bản sao đã nằm ở shop phụ.
// - Cách ly này là ở mức giao diện + lọc dữ liệu theo mã shop, giống
//   hệ thống hiện tại (không phải Firestore Rules khóa cứng).
// ---------------------------------------------------------------------------

export const RESERVED_SLUGS = [
  'admin',
  'login',
  'checkout',
  'product-notes',
  's',
  'shop',
  'api',
  'assets',
];

// Chuẩn hóa mã link: chữ thường, khoảng trắng/gạch dưới thành gạch
// ngang, bỏ ký tự lạ, bỏ gạch ngang thừa ở đầu/cuối.
export const normalizeSlug = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const isValidSlug = (slug: string): boolean =>
  /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && !RESERVED_SLUGS.includes(slug);

// Link shop phụ. Web dùng HashRouter nên link có dạng /#/slug.
export const shopLink = (slug: string): string =>
  `${window.location.origin}/#/${slug}`;

export const isMainProduct = (p: Product): boolean => !p.shop_slug;

export const productsOfShop = (all: Product[], slug: string | null | undefined): Product[] =>
  slug ? all.filter((p) => p.shop_slug === slug) : all.filter((p) => !p.shop_slug);

// Bản sao của 1 sản phẩm để ghi sang shop khác: bỏ id cũ, ghi mã
// shop mới, tạo ngày mới. Giá, ảnh, biến thể, ghi chú giữ nguyên.
export const copyProductForShop = (p: Product, slug: string): any => {
  const { id, ...rest } = p as any;
  return {
    ...rest,
    shop_slug: slug,
    created_at: new Date().toISOString(),
  };
};

export const fetchSubAdmins = async (): Promise<User[]> => {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'subadmin')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as User[];
};

export const fetchMainProducts = async (): Promise<Product[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Product[]).filter(
    (p) => !p.shop_slug
  );
};

// Sao chép toàn bộ sản phẩm chính sang 1 shop phụ mới. Trả về số
// sản phẩm đã sao chép được.
export const copyMainProductsToShop = async (slug: string): Promise<number> => {
  const mains = await fetchMainProducts();
  let copied = 0;
  for (const p of mains) {
    try {
      await addDoc(collection(db, 'products'), copyProductForShop(p, slug));
      copied += 1;
    } catch (err) {
      console.error('Copy product to shop failed:', p.id, err);
    }
  }
  return copied;
};

// Cài đặt riêng của shop phụ: phương thức thanh toán + danh mục.
// Lưu ở collection 'shop_settings', document id = mã shop.
// - Chưa có document này thì shop phụ dùng cài đặt của shop chính
//   (để shop mới vẫn bán được ngay, không cần cài đặt lại).
// - Admin phụ bấm Lưu ở tab Cài đặt của shop mình 1 lần là tạo
//   document riêng, từ đó sửa gì cũng không ảnh hưởng shop chính,
//   và shop chính sửa sau cũng không ảnh hưởng shop phụ này nữa.
export interface ShopSettings {
  payment_methods?: any[];
  categories?: Category[];
}

export const getShopSettings = async (slug: string): Promise<ShopSettings | null> => {
  try {
    const snap = await getDoc(doc(db, 'shop_settings', slug));
    if (!snap.exists()) return null;
    return snap.data() as ShopSettings;
  } catch (err) {
    console.error('Error loading shop settings:', err);
    return null;
  }
};

// Admin chính thêm MỚI sản phẩm: sao chép sản phẩm đó sang tất cả
// các shop phụ đã có. Chỉ chạy khi tạo mới ở shop chính, không chạy
// khi sửa sản phẩm cũ, không chạy khi admin phụ thêm sản phẩm.
// Lỗi sao chép 1 shop thì không làm hỏng việc tạo sản phẩm chính.
export const fanOutNewMainProduct = async (productData: any): Promise<void> => {
  try {
    const subs = await fetchSubAdmins();
    const { id, created_at, shop_slug, ...rest } = productData;
    for (const sub of subs) {
      if (!sub.shop_slug) continue;
      try {
        await addDoc(collection(db, 'products'), {
          ...rest,
          shop_slug: sub.shop_slug,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Fan-out new product to shop failed:', sub.shop_slug, err);
      }
    }
  } catch (err) {
    console.error('Fan-out new product failed:', err);
  }
};

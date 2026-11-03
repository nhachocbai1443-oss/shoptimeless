import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc, doc, getDoc, writeBatch, deleteField } from 'firebase/firestore';
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
// shop mới, tạo ngày mới, và ghi copied_from = id sản phẩm gốc.
// copied_from là sợi dây để sau này chính sửa giá CTV thì tìm
// đúng bản sao của sản phẩm đó mà truyền giá CTV sang, không cần
// đoán theo tên. Giá, ảnh, biến thể, ghi chú giữ nguyên.
export const copyProductForShop = (p: Product, slug: string): any => {
  const { id, ...rest } = p as any;
  return {
    ...rest,
    shop_slug: slug,
    copied_from: id,
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
// Link liên hệ nổi (cụm nút tròn góc phải dưới): Messenger,
// Zalo, Telegram. Mỗi shop có 1 bộ riêng: shop chính lưu trong
// app_settings, shop phụ lưu trong shop_settings của shop đó.
// Để trống 1 link là nút đó không hiện nữa.
export interface ContactLinks {
  messenger?: string;
  zalo?: string;
  telegram?: string;
}

// Link mặc định hiện tại của web (đang hardcode trong Layout):
// cài đặt chưa có link nào thì dùng bộ này, để web không mất nút.
export const DEFAULT_CONTACT_LINKS: ContactLinks = {
  messenger: 'https://www.facebook.com/messages/t/971626916025287',
  zalo: 'https://zalo.me/0528173022',
  telegram: 'https://t.me/thienduong1443',
};

export interface ShopSettings {
  payment_methods?: any[];
  categories?: Category[];
  contact_links?: ContactLinks;
  // Lưu ý: cài đặt thông báo đơn (notify_email, telegram_enabled)
  // KHÔNG nằm ở đây mà nằm trên document users của admin phụ
  // (xem types.ts). Bản trước từng lưu 2 mục này ở shop_settings
  // thì nút Lưu bị Firestore chặn "Missing or insufficient
  // permissions", trong khi ghi users chạy được, nên đã dời sang
  // users để khỏi cần sửa Rules.
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

// Cài đặt thông báo đơn của 1 shop phụ, đọc từ document users
// của admin phụ sở hữu shop đó (không phải shop_settings — xem
// lý do ở types.ts). Không tìm thấy phụ thì trả null, tức là
// Gmail trống + Telegram tắt, đơn vẫn gửi về admin chính như cũ.
export const getSubadminNotifySettings = async (
  slug: string
): Promise<{ notify_email: string; telegram_enabled: boolean } | null> => {
  try {
    const snap = await getDocs(
      query(collection(db, 'users'), where('shop_slug', '==', slug), where('role', '==', 'subadmin'))
    );
    if (snap.empty) return null;
    const data: any = snap.docs[0].data();
    return {
      notify_email: (data.notify_email || '').trim(),
      telegram_enabled: data.telegram_enabled === true,
    };
  } catch (err) {
    console.error('Error loading subadmin notification settings:', err);
    return null;
  }
};

// Admin chính thêm MỚI sản phẩm: sao chép sản phẩm đó sang tất cả
// các shop phụ đã có. Chỉ chạy khi tạo mới ở shop chính, không chạy
// khi sửa sản phẩm cũ, không chạy khi admin phụ thêm sản phẩm.
// Lỗi sao chép 1 shop thì không làm hỏng việc tạo sản phẩm chính.
// Bản sao cũng ghi copied_from = id sản phẩm chính vừa tạo (nếu
// bên gọi đã truyền id vào), để sau này truyền giá CTV được.
export const fanOutNewMainProduct = async (productData: any): Promise<void> => {
  try {
    const subs = await fetchSubAdmins();
    const { id, created_at, shop_slug, ...rest } = productData;
    for (const sub of subs) {
      if (!sub.shop_slug) continue;
      try {
        const copy: any = {
          ...rest,
          shop_slug: sub.shop_slug,
          created_at: new Date().toISOString(),
        };
        if (id) copy.copied_from = id;
        await addDoc(collection(db, 'products'), copy);
      } catch (err) {
        console.error('Fan-out new product to shop failed:', sub.shop_slug, err);
      }
    }
  } catch (err) {
    console.error('Fan-out new product failed:', err);
  }
};

// Giá CTV ở shop phụ phải LUÔN theo giá CTV của chính. Vì admin
// phụ không được sửa giá CTV, nên mỗi lần chính sửa sản phẩm là
// giá CTV (chung + riêng ctvtime, cả ở biến thể) tự truyền sang
// các bản sao ở shop phụ. Chỉ truyền đúng giá CTV, KHÔNG truyền
// giá Public, tên, ảnh, danh mục hay thứ tự — những thứ đó ở shop
// phụ vẫn tách riêng như cũ.
// Tìm bản sao bằng 2 cách, theo thứ tự:
//  1. copied_from == id sản phẩm chính (bản sao mới, đã có dây
//     nối từ lúc sao chép).
//  2. Bản sao cũ chưa có copied_from: khớp tên + danh mục LÚC
//     CHƯA SỬA (tên/danh mục trước khi chính sửa lần này), vì
//     bản sao giữ nguyên tên/danh mục lúc sao chép. Khớp được
//     thì ghi luôn copied_from vào bản sao đó, lần sau khỏi đoán.
// Bản sao mà admin phụ đã đổi tên trước đây thì cách 2 không khớp
// được — đó là giới hạn duy nhất, các bản sao còn lại đều khớp.
// Hàm này không bao giờ ném lỗi ra ngoài (best-effort): truyền
// hỏng thì sản phẩm chính vẫn đã lưu xong, không làm hỏng việc lưu.
export const propagateCtvPriceToSubShops = async (original: {
  id: string;
  name: string;
  category: string;
  price_ctv: number;
  price_ctvtime?: number;
  variants: any[];
}): Promise<void> => {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const batch = writeBatch(db);
    let count = 0;
    snap.docs.forEach((d) => {
      const data: any = d.data();
      if (!data.shop_slug) return;
      const isLinked = data.copied_from === original.id;
      const isLegacy =
        !data.copied_from &&
        data.name === original.name &&
        (data.category || 'Khác') === (original.category || 'Khác');
      if (!isLinked && !isLegacy) return;

      const update: any = {
        price_ctv: Number(original.price_ctv) || 0,
      };
      if (original.price_ctvtime !== undefined && original.price_ctvtime !== null && Number(original.price_ctvtime) > 0) {
        update.price_ctvtime = Number(original.price_ctvtime);
      } else {
        update.price_ctvtime = deleteField();
      }
      // Biến thể: chỉ đổi giá CTV của biến thể khớp tên hình thức,
      // giữ nguyên giá Public và hình thức của bản sao. Biến thể
      // mới ở chính (chưa có ở bản sao) và biến thể riêng của phụ
      // thì không động tới.
      if (Array.isArray(data.variants)) {
        update.variants = data.variants.map((v: any) => {
          const mainVariant = (original.variants || []).find((mv: any) => mv.form === v.form);
          if (!mainVariant) return v;
          const cleaned: any = {
            ...v,
            price_ctv: Number(mainVariant.price_ctv) || 0,
          };
          if (mainVariant.price_ctvtime !== undefined && mainVariant.price_ctvtime !== null && Number(mainVariant.price_ctvtime) > 0) {
            cleaned.price_ctvtime = Number(mainVariant.price_ctvtime);
          } else {
            delete cleaned.price_ctvtime;
          }
          return cleaned;
        });
      }
      if (isLegacy) update.copied_from = original.id;
      batch.update(doc(db, 'products', d.id), update);
      count += 1;
    });
    if (count > 0) await batch.commit();
  } catch (err) {
    console.error('Propagate CTV price to sub shops failed:', err);
  }
};

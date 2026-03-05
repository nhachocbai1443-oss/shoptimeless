/**
 * supabase.ts
 * Chỉ dùng Supabase Storage để lưu trữ ảnh.
 * Toàn bộ database vẫn dùng Firebase Firestore.
 *
 * Cách lấy thông tin cấu hình:
 * 1. Đăng nhập Supabase Dashboard: https://supabase.com/dashboard
 * 2. Chọn project của bạn (hoặc tạo project mới miễn phí)
 * 3. Vào Settings > API
 *    - "Project URL"  → VITE_SUPABASE_URL
 *    - "anon public"  → VITE_SUPABASE_ANON_KEY
 * 4. Tạo Storage Bucket:
 *    - Vào Storage > New bucket
 *    - Đặt tên: "shop-images"
 *    - Tick "Public bucket" để ảnh có thể xem công khai
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Tên bucket bạn tạo trong Supabase Storage
const BUCKET_NAME = 'shop-images';

/**
 * Upload một file ảnh lên Supabase Storage và trả về public URL.
 * @param file - File ảnh cần upload
 * @param folder - Thư mục con trong bucket (ví dụ: "products", "icons")
 * @returns Public URL của ảnh đã upload
 */
export const uploadImageToSupabase = async (
  file: File,
  folder: 'products' | 'icons' | 'qr' = 'products'
): Promise<string> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase chưa được cấu hình!\n\n' +
      'Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào file .env.local\n' +
      'Xem hướng dẫn trong file HUONG_DAN_SUPABASE.md'
    );
  }

  // Tạo tên file duy nhất để tránh trùng lặp
  const fileExt = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

  // Gọi Supabase Storage REST API để upload
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${fileName}`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type,
      'x-upsert': 'true', // Cho phép ghi đè nếu trùng tên
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    let errorMsg = `Upload thất bại (${uploadResponse.status})`;

    if (uploadResponse.status === 400) {
      errorMsg = 'Lỗi: Bucket "shop-images" chưa tồn tại hoặc chưa được đặt là Public.\nVào Supabase > Storage > tạo bucket "shop-images" và bật Public.';
    } else if (uploadResponse.status === 401) {
      errorMsg = 'Lỗi: SUPABASE_ANON_KEY không hợp lệ. Kiểm tra lại trong .env.local.';
    } else if (uploadResponse.status === 403) {
      errorMsg = 'Lỗi: Không có quyền upload.\nVào Supabase > Storage > Policies và thêm policy cho phép INSERT.';
    }

    console.error('Supabase upload error:', errorText);
    throw new Error(errorMsg);
  }

  // Trả về public URL của ảnh
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${fileName}`;
  return publicUrl;
};

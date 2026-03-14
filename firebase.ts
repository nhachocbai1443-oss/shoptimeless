import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

/**
 * Firebase chỉ dùng cho:
 * - Firestore (database sản phẩm, đơn hàng, users, settings)
 * - Auth (đăng nhập admin/CTV)
 *
 * Ảnh sản phẩm được lưu trên Supabase Storage (xem supabase.ts)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCm-3u7ON9oCayaDgELx2pwyW66ghaYGsw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "shopstudytimeless.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "shopstudytimeless",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "shopstudytimeless.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1051669121862",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1051669121862:web:06bb4db05b8c0bd9bcf347",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Đặt persistence cho Firebase Auth thành LOCAL (lưu vào localStorage)
// để token không bị mất khi tab bị ẩn hoặc sau thời gian dài không hoạt động.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Firebase Auth persistence error:", err);
});

// Bật Firestore offline persistence (IndexedDB) để cache dữ liệu cục bộ
// và tránh lỗi "Failed to get document" khi mạng chậm hoặc token đang refresh.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Nhiều tab đang mở cùng lúc — chỉ một tab được dùng persistence
    console.warn("Firestore persistence: multiple tabs open.");
  } else if (err.code === "unimplemented") {
    // Trình duyệt không hỗ trợ
    console.warn("Firestore persistence: not supported in this browser.");
  }
});

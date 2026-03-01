import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

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

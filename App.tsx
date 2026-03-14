import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import CheckoutPage from './pages/CheckoutPage';
import ProductFormPage from './pages/ProductFormPage';
import ProductNotesPage from './pages/ProductNotesPage';
import { User } from './types';

function App() {
  // Simple auth state persistence using localStorage
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('studytimeless_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Lắng nghe Firebase Auth token thay đổi/hết hạn
  // Khi token hết hạn, Firebase tự refresh silently nếu còn session hợp lệ.
  // Nếu Firestore trả về permission-denied do token cũ, ta reload lại user từ DB.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Dự án này dùng custom username auth (không dùng Firebase Auth email/password)
      // nên firebaseUser thường là null. Ta chỉ cần đảm bảo Firestore token được làm mới.
      // Không làm gì thêm ở đây — chỉ đăng ký listener để Firebase SDK tự refresh token.
    });
    return () => unsubscribe();
  }, []);

  // Khi tab được focus lại sau thời gian dài, kiểm tra và làm mới session
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const saved = localStorage.getItem('studytimeless_user');
        if (!saved) return;

        try {
          const savedUser: User = JSON.parse(saved);
          // Kiểm tra user vẫn còn tồn tại trong DB bằng cách query nhẹ
          const q = query(
            collection(db, 'users'),
            where('username', '==', savedUser.username)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const freshDoc = snap.docs[0];
            const freshUser: User = { id: freshDoc.id, ...freshDoc.data() } as User;
            // Cập nhật lại state và localStorage với dữ liệu mới nhất
            setUser(freshUser);
            localStorage.setItem('studytimeless_user', JSON.stringify(freshUser));
          } else {
            // User không còn tồn tại → đăng xuất
            handleLogout();
          }
        } catch (err) {
          // Nếu lỗi mạng hoặc permission → giữ nguyên session hiện tại, không logout
          console.warn('Session refresh skipped:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('studytimeless_user', JSON.stringify(newUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('studytimeless_user');
  };

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          
          <Route 
            path="/login" 
            element={
              user 
                ? <Navigate to="/" replace />
                : <Login onLogin={handleLogin} />
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              user && user.role === 'admin'
                ? <AdminDashboard user={user} /> 
                : <Navigate to="/" />
            } 
          />

          <Route 
            path="/admin/product/:productId" 
            element={
              user && user.role === 'admin'
                ? <ProductFormPage user={user} /> 
                : <Navigate to="/" />
            } 
          />

          <Route path="/checkout/:productId" element={<CheckoutPage user={user} />} />

          <Route path="/product-notes/:productId" element={<ProductNotesPage />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;

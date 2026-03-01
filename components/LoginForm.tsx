import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from 'firebase/firestore';
import { User } from '../types';

interface Props {
  onLogin: (user: User) => void;
}

const LoginForm: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError('');
    const cleanUsername = username.trim();

    try {
      // 1. Check if it's the default admin
      if (cleanUsername.toLowerCase() === 'dinhtom') {
        const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
        const querySnapshot = await getDocs(q);
        
        let adminUser: any = null;

        if (querySnapshot.empty) {
          // Create admin if not exists
          const docRef = await addDoc(collection(db, 'users'), { 
            username: cleanUsername, 
            role: 'admin',
            created_at: new Date().toISOString()
          });
          adminUser = { id: docRef.id, username: cleanUsername, role: 'admin' };
        } else {
          const userDoc = querySnapshot.docs[0];
          adminUser = { id: userDoc.id, ...userDoc.data() };
          if (adminUser.role !== 'admin') {
            await updateDoc(doc(db, 'users', userDoc.id), { role: 'admin' });
            adminUser.role = 'admin';
          }
        }

        onLogin(adminUser as User);
        return;
      }

      // 2. Check if it's a CTV
      const q = query(collection(db, 'users'), where('username', '==', cleanUsername));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Tên đăng nhập không tồn tại hoặc bạn không có quyền truy cập!');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const existingUser = { id: userDoc.id, ...userDoc.data() };
      onLogin(existingUser as User);

    } catch (error) {
      console.error('Login error:', error);
      setError('Không thể kết nối đến máy chủ. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md p-8 rounded-[40px] shadow-2xl w-full max-w-md border border-pink-100">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
          <span className="text-4xl">🔐</span>
        </div>
        <h2 className="text-3xl font-cute font-bold text-gray-800">Đăng nhập</h2>
        <p className="text-gray-500 text-sm mt-2 font-medium">Hệ thống dành cho Admin & CTV</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label className="block text-gray-700 font-bold mb-2 ml-1 text-sm">Tên đăng nhập</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nhập username của bạn..."
            className="w-full px-6 py-4 rounded-2xl border-2 border-pink-50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-pink-100 transition-all text-lg font-medium shadow-sm"
          />
          {error && <p className="text-xs text-red-500 mt-2 ml-1 font-bold">❌ {error}</p>}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-bold text-white text-lg shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 ${
            loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary hover:bg-pink-600 shadow-pink-200'
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🍥</span> Đang xác thực...
            </span>
          ) : 'Đăng nhập ngay 🚀'}
        </button>
      </form>
      
      <div className="mt-8 pt-6 border-t border-pink-50 text-center">
        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
          Studytimeless Premium Shop
        </p>
      </div>
    </div>
  );
};

export default LoginForm;
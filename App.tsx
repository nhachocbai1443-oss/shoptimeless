import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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

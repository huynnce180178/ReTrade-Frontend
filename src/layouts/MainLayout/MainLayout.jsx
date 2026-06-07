import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
// TwoFactor removed
import '../../styles/MainLayout.css';

export default function MainLayout() {
  const { user, setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  

  return (
    <div className="main-layout-wrapper">
      <Header />
      {/* 2FA removed */}
      <main className="main-layout-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

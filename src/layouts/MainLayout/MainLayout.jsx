import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import AssistantChatWidget from '../../components/AssistantChatWidget/AssistantChatWidget';
// TwoFactor removed
import '../../styles/MainLayout.css';

export default function MainLayout() {
  const location = useLocation();
  const hideAssistantWidget =
    location.pathname === '/assistant-chat' ||
    location.pathname.startsWith('/chat') ||
    location.pathname.startsWith('/seller-dashboard/messages');
  

  return (
    <div className="main-layout-wrapper">
      <Header />
      {/* 2FA removed */}
      <main className="main-layout-content">
        <Outlet />
      </main>
      {!hideAssistantWidget && <AssistantChatWidget />}
      <Footer />
    </div>
  );
}

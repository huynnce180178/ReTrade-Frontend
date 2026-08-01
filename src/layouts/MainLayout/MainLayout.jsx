import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../../components/Header/Header';
import Footer from '../../components/Footer/Footer';
import AssistantChatWidget from '../../components/AssistantChatWidget/AssistantChatWidget';
import ChangePasswordAfterRecoveryModal from '../../components/ChangePasswordAfterRecoveryModal/ChangePasswordAfterRecoveryModal';
import { useAuth } from '../../context/AuthContext';
import '../../styles/MainLayout.css';

export default function MainLayout() {
  const { user, clearMustChangePassword } = useAuth();
  const [modalDismissed, setModalDismissed] = React.useState(false);
  const location = useLocation();
  const hideAssistantWidget =
    location.pathname === '/assistant-chat' ||
    location.pathname.startsWith('/chat') ||
    location.pathname.startsWith('/seller-dashboard/messages');

  return (
    <div className="main-layout-wrapper">
      <Header />
      <main className="main-layout-content">
        <Outlet />
      </main>
      {!hideAssistantWidget && <AssistantChatWidget />}
      <Footer />

      {user?.mustChangePassword && !modalDismissed && (
        <ChangePasswordAfterRecoveryModal
          isOpen={true}
          onClose={() => setModalDismissed(true)}
          onSuccess={() => {
            clearMustChangePassword();
            setModalDismissed(true);
          }}
        />
      )}
    </div>
  );
}



import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { forceLogout } from '../../utils/authUtils';
import './RoleUpdateModal.css';

export default function RoleUpdateModal() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const handleRoleUpdated = () => {
      setIsOpen(true);
      setCountdown(5);
    };

    window.addEventListener('retrade:role_updated_logout', handleRoleUpdated);
    return () => window.removeEventListener('retrade:role_updated_logout', handleRoleUpdated);
  }, []);

  useEffect(() => {
    let timer;
    if (isOpen && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isOpen && countdown <= 0) {
      forceLogout();
    }
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  return (
    <div className="role-modal-overlay">
      <div className="role-modal-card">
        <div className="role-modal-icon-wrap">
          <span className="material-symbols-outlined role-modal-icon">admin_panel_settings</span>
        </div>
        <h3 className="role-modal-title">{t('role_modal.role_updated_modal_title')}</h3>
        <p className="role-modal-desc">
          {t('role_modal.role_updated_modal_desc', { seconds: countdown })}
        </p>
        <div className="role-modal-countdown-badge">
          <span className="role-modal-timer-num">{countdown}</span>
        </div>
        <button
          type="button"
          className="role-modal-btn"
          onClick={() => forceLogout()}
        >
          {t('role_modal.login_again_now_btn', { seconds: countdown })}
        </button>
      </div>
    </div>
  );
}

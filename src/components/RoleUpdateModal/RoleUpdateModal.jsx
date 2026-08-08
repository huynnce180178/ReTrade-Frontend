import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { forceLogout } from '../../utils/authUtils';
import './RoleUpdateModal.css';

export default function RoleUpdateModal() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isBan, setIsBan] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const handleRoleUpdated = (e) => {
      const msg = typeof e.detail?.message === 'string' ? e.detail.message : '';
      const isBanMsg = msg.includes('BAN_REASON:') || msg.toLowerCase().includes('banned');

      if (isBanMsg) {
        setIsBan(true);
        const extracted = msg.includes('BAN_REASON:')
          ? msg.split('BAN_REASON:')[1]
          : msg;
        setBanReason(extracted || 'Violation of ReTrade Terms of Service');
        setCountdown(10);
      } else {
        setIsBan(false);
        setBanReason('');
        setCountdown(5);
      }
      setIsOpen(true);
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
      <div className={`role-modal-card ${isBan ? 'is-ban-card' : ''}`}>
        <div className={`role-modal-icon-wrap ${isBan ? 'is-ban-icon' : ''}`}>
          <span className="material-symbols-outlined role-modal-icon">
            {isBan ? 'block' : 'admin_panel_settings'}
          </span>
        </div>
        <h3 className="role-modal-title">
          {isBan ? t('role_modal.ban_modal_title') : t('role_modal.role_updated_modal_title')}
        </h3>
        <p className="role-modal-desc">
          {isBan
            ? t('role_modal.ban_modal_desc', { seconds: countdown })
            : t('role_modal.role_updated_modal_desc', { seconds: countdown })}
        </p>

        {isBan && banReason && (
          <div className="role-modal-reason-box">
            <strong>{t('role_modal.ban_reason_label')}</strong>
            <p>{banReason}</p>
          </div>
        )}

        <div className={`role-modal-countdown-badge ${isBan ? 'is-ban-badge' : ''}`}>
          <span className="role-modal-timer-num">{countdown}</span>
        </div>
        <button
          type="button"
          className={`role-modal-btn ${isBan ? 'is-ban-btn' : ''}`}
          onClick={() => forceLogout()}
        >
          {isBan
            ? t('role_modal.understand_btn', { seconds: countdown })
            : t('role_modal.login_again_now_btn', { seconds: countdown })}
        </button>
      </div>
    </div>
  );
}

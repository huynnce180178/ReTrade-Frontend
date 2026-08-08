import React, { useState } from 'react';
import accountService from '../../services/accountService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { forceLogout } from '../../utils/authUtils';
import './ChangePasswordAfterRecoveryModal.css';

export default function ChangePasswordAfterRecoveryModal({ isOpen, onClose, onSuccess }) {
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [closed, setClosed] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || closed) return null;

  const handleClose = () => {
    setClosed(true);
    onClose?.();
  };

  const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>_\-]/;

  const checks = {
    length: newPassword.length >= 8 && newPassword.length <= 50,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: SPECIAL_CHAR_REGEX.test(newPassword),
    match: newPassword !== '' && confirmPassword !== '' && newPassword === confirmPassword,
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanOld = oldPassword.trim();
    const cleanNew = newPassword.trim();
    if (!cleanOld || !cleanNew || !confirmPassword) {
      showToast(t('change_password_recovery.fill_all_fields_err'), 'error');
      return;
    }
    if (cleanOld === cleanNew) {
      showToast(t('change_password_recovery.same_password_err'), 'error');
      return;
    }
    if (!isPasswordValid) {
      showToast(t('change_password_recovery.satisfy_req_err'), 'error');
      return;
    }

    setLoading(true);
    window.__isSelfChangingPassword = true;
    sessionStorage.setItem('retrade_self_changing_pwd', 'true');
    try {
      await accountService.changePassword(cleanOld, cleanNew);
      showToast(t('change_password_recovery.success_msg'), 'success');
      setClosed(true);
      setTimeout(() => {
        forceLogout();
      }, 500);
    } catch (err) {
      window.__isSelfChangingPassword = false;
      sessionStorage.removeItem('retrade_self_changing_pwd');
      const serverMsg = err?.response?.data?.message || err?.response?.data;
      showToast(serverMsg || t('change_password_recovery.failed_msg'), 'error');
    } finally {
      setLoading(false);
    }
  };




  const requirements = [
    { key: 'length', label: t('change_password_recovery.req_length') },
    { key: 'upper', label: t('change_password_recovery.req_upper') },
    { key: 'lower', label: t('change_password_recovery.req_lower') },
    { key: 'number', label: t('change_password_recovery.req_number') },
    { key: 'special', label: t('change_password_recovery.req_special') },
    { key: 'match', label: t('change_password_recovery.req_match') },
  ];

  return (
    <div className="recovery-modal-overlay">
      <div className="recovery-modal-card">
        <h3>{t('change_password_recovery.title')}</h3>
        <p className="recovery-modal-subtitle">{t('change_password_recovery.subtitle')}</p>

        <form onSubmit={handleSubmit} className="recovery-modal-form">
          <div className="recovery-form-group">
            <label>{t('change_password_recovery.old_password_label')}</label>
            <div className="recovery-input-wrap">
              <input
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="recovery-pass-toggle"
                onClick={() => setShowOldPassword(!showOldPassword)}
              >
                <span className="material-symbols-outlined">
                  {showOldPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="recovery-form-group">
            <label>{t('change_password_recovery.new_password_label')}</label>
            <div className="recovery-input-wrap">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="recovery-pass-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                <span className="material-symbols-outlined">
                  {showNewPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="recovery-form-group">
            <label>{t('change_password_recovery.confirm_password_label')}</label>
            <div className="recovery-input-wrap">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
              />
              <button
                type="button"
                className="recovery-pass-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <span className="material-symbols-outlined">
                  {showConfirmPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          {/* Checklist */}
          <div className="recovery-checklist-card">
            <h4>{t('change_password_recovery.req_title')}</h4>
            <ul className="recovery-checklist-list">
              {requirements.map(({ key, label }) => (
                <li key={key} className={checks[key] ? 'valid' : 'invalid'}>
                  <span className="material-symbols-outlined">
                    {checks[key] ? 'check_circle' : 'circle'}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="recovery-modal-actions">
            <button type="submit" className="recovery-btn-primary" disabled={loading || !isPasswordValid}>
              {loading ? t('change_password_recovery.saving_btn') : t('change_password_recovery.save_btn')}
            </button>
            <button type="button" className="recovery-btn-secondary" onClick={handleClose} disabled={loading}>
              {t('change_password_recovery.cancel_btn')}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

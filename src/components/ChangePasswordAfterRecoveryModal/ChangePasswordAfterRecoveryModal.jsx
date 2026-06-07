import React, { useState } from 'react';
import accountService from '../../services/accountService';
import { useToast } from '../../context/ToastContext';
import './ChangePasswordAfterRecoveryModal.css';

export default function ChangePasswordAfterRecoveryModal({ isOpen, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword)
  };

  const isPasswordValid = Object.values(checks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('Please fill in all fields.', 'error');
      return;
    }
    if (!isPasswordValid) {
      showToast('Please satisfy all password requirements.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      await accountService.changePassword(oldPassword, newPassword);
      showToast('Password updated successfully. Redirecting...', 'success');
      onSuccess();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to change password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="recovery-modal-overlay">
      <div className="recovery-modal-card">
        <h3>Change Password</h3>
        <p className="recovery-modal-subtitle">Please enter your temporary password and set a new secure password.</p>

        <form onSubmit={handleSubmit} className="recovery-modal-form">
          <div className="recovery-form-group">
            <label>Temporary (Old) Password</label>
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
            <label>New Password</label>
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
            <label>Confirm New Password</label>
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
            <h4>Password Requirements</h4>
            <ul className="recovery-checklist-list">
              <li className={checks.length ? 'valid' : 'invalid'}>
                <span className="material-symbols-outlined">
                  {checks.length ? 'check_circle' : 'circle'}
                </span>
                <span>8+ characters</span>
              </li>
              <li className={checks.upper ? 'valid' : 'invalid'}>
                <span className="material-symbols-outlined">
                  {checks.upper ? 'check_circle' : 'circle'}
                </span>
                <span>One uppercase letter</span>
              </li>
              <li className={checks.lower ? 'valid' : 'invalid'}>
                <span className="material-symbols-outlined">
                  {checks.lower ? 'check_circle' : 'circle'}
                </span>
                <span>One lowercase letter</span>
              </li>
              <li className={checks.number ? 'valid' : 'invalid'}>
                <span className="material-symbols-outlined">
                  {checks.number ? 'check_circle' : 'circle'}
                </span>
                <span>One number</span>
              </li>
              <li className={checks.special ? 'valid' : 'invalid'}>
                <span className="material-symbols-outlined">
                  {checks.special ? 'check_circle' : 'circle'}
                </span>
                <span>One special character</span>
              </li>
            </ul>
          </div>

          <div className="recovery-modal-actions">
            <button type="submit" className="recovery-btn-primary" disabled={loading || !isPasswordValid}>
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button type="button" className="recovery-btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import accountService from '../../../services/accountService';

import '../../../styles/ResetPassword.css';

export default function ResetPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast('Please enter your email address.', 'error');
      return;
    }

    setLoading(true);
    try {
      await accountService.passwordRecovery(email);
      setSent(true);
      showToast('A new password has been sent to your email.', 'success');
    } catch (err) {
      const errorMsg = err.response?.data || err.response?.data?.message || 'Email not found in the system.';
      showToast(typeof errorMsg === 'string' ? errorMsg : 'Email not found in the system.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="rp-page">
      <main className="rp-main">
        <div className="rp-card-wrapper">

          {!sent ? (
            /* ========== Email Entry ========== */
            <div className="rp-glass-card rp-animate-in" key="email-step">
              <div className="rp-icon-wrap">
                <span className="material-symbols-outlined rp-icon">mail</span>
              </div>

              <h1 className="rp-title">Password Recovery</h1>
              <p className="rp-subtitle">
                Enter your registered email. We'll generate a new secure password and send it directly to your inbox.
              </p>

              <form className="rp-form" onSubmit={handleSubmit}>
                <div className="rp-floating-group">
                  <input
                    type="email"
                    id="rp-email"
                    className="rp-input"
                    placeholder=" "
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="email"
                  />
                  <label htmlFor="rp-email" className="rp-float-label">Email Address</label>
                  <div className="rp-input-line"></div>
                </div>

                <button type="submit" className="rp-btn-primary" disabled={loading}>
                  {loading ? (
                    <span className="rp-spinner"></span>
                  ) : (
                    'Send New Password'
                  )}
                </button>
              </form>

              <div className="rp-info-strip">
                <span className="material-symbols-outlined rp-info-icon">info</span>
                <span>A random secure password will be generated and sent to your email. You can change it later in account settings.</span>
              </div>

              <div className="rp-footer-link">
                <Link to="/login" className="rp-back-link">
                  <span className="material-symbols-outlined rp-back-icon">arrow_back</span>
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            /* ========== Success ========== */
            <div className="rp-glass-card rp-animate-in" key="success-step">
              <div className="rp-icon-wrap rp-icon-wrap--success">
                <span className="material-symbols-outlined rp-icon rp-icon--success">check_circle</span>
              </div>

              <h1 className="rp-title">Check Your Inbox</h1>
              <p className="rp-subtitle">
                A new password has been sent to <strong>{email}</strong>. Follow the steps below to regain access.
              </p>

              <div className="rp-steps">
                <div className="rp-step-item">
                  <div className="rp-step-num">1</div>
                  <div className="rp-step-content">
                    <strong>Open your email</strong>
                    <span>Find the message with your new password</span>
                  </div>
                </div>
                <div className="rp-step-item">
                  <div className="rp-step-num">2</div>
                  <div className="rp-step-content">
                    <strong>Sign in</strong>
                    <span>Use the new password to log in</span>
                  </div>
                </div>
                <div className="rp-step-item">
                  <div className="rp-step-num">3</div>
                  <div className="rp-step-content">
                    <strong>Secure your account</strong>
                    <span>Change the password in your settings</span>
                  </div>
                </div>
              </div>

              <button type="button" className="rp-btn-primary" onClick={handleBackToLogin}>
                Return to Login
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

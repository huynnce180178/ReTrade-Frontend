import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import accountService from '../../../services/accountService';
import '../../../styles/ForgotPassword.css';

const INITIAL_OTP = ['', '', '', '', '', ''];
const SPECIAL_CHAR_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

function getErrorMsg(err, fallback) {
  const msg = err.response?.data;
  return typeof msg === 'string' ? msg : fallback;
}

export default function ForgotPassword() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(INITIAL_OTP);
  const [countdown, setCountdown] = useState(0);
  const [resending, setResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (step === 'otp') setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return showToast('Please enter your email address.', 'error');

    setLoading(true);
    try {
      await accountService.forgotPassword(email);
      showToast('A verification code has been sent to your email.', 'success');
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      showToast(getErrorMsg(err, 'Email not found in the system.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1].focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) inputRefs.current[index - 1].focus();
    if (e.key === 'Enter') handleOtpSubmit(e);
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    if (!digits.length) return;
    const next = [...INITIAL_OTP];
    digits.forEach((d, i) => { next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(digits.length, 5)].focus();
  };

  const handleResendOtp = async () => {
    setResending(true);
    try {
      await accountService.forgotPassword(email);
      showToast('A new verification code has been sent.', 'success');
      setCountdown(60);
      setOtp([...INITIAL_OTP]);
    } catch {
      showToast('Failed to resend code. Please try again.', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleOtpSubmit = (e) => {
    e.preventDefault();
    if (otp.join('').length !== 6) return showToast('Please enter all 6 digits of the OTP.', 'error');
    setStep('newPassword');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim() || !confirmPassword.trim()) return showToast('Please fill in both password fields.', 'error');
    if (newPassword.length < 8) return showToast('Password must be at least 8 characters long.', 'error');
    if (!/[A-Z]/.test(newPassword)) return showToast('Password must contain at least one uppercase letter.', 'error');
    if (!SPECIAL_CHAR_REGEX.test(newPassword)) return showToast('Password must contain at least one special character.', 'error');
    if (newPassword !== confirmPassword) return showToast('Passwords do not match.', 'error');

    setLoading(true);
    try {
      await accountService.resetPassword({ email, otp: otp.join(''), newPassword });
      showToast('Password reset successfully! Please log in with your new password.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(getErrorMsg(err, 'Password reset failed.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const checks = {
    length: newPassword.length >= 8,
    upper: /[A-Z]/.test(newPassword),
    special: SPECIAL_CHAR_REGEX.test(newPassword),
    match: newPassword !== '' && confirmPassword !== '' && newPassword === confirmPassword,
  };

  const renderPasswordField = (label, id, value, setValue, show, toggleShow) => (
    <div className="fp-field-group">
      <label className="fp-field-label">{label}</label>
      <div className="fp-field-input-wrap">
        <input
          type={show ? 'text' : 'password'}
          id={id}
          className="fp-field-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          disabled={loading}
        />
        <button type="button" className="fp-toggle-vis" onClick={toggleShow}>
          <span className="material-symbols-outlined">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  );

  const requirements = [
    { key: 'length', label: 'At least 8 characters' },
    { key: 'upper', label: 'One uppercase letter' },
    { key: 'special', label: 'One special character' },
    { key: 'match', label: 'Passwords must match' },
  ];

  return (
    <div className="fp-page">
      <main className="fp-main">
        <div className="fp-card-wrapper">

          {step === 'email' && (
            <div className="fp-glass-card fp-animate-in" key="email">
              <div className="fp-icon-wrap">
                <span className="material-symbols-outlined fp-icon">lock_reset</span>
              </div>
              <h1 className="fp-title">Reset Your Password</h1>
              <p className="fp-subtitle">Enter your registered email address and we'll send you a secure verification code.</p>

              <form className="fp-form" onSubmit={handleEmailSubmit}>
                <div className="fp-floating-group">
                  <input type="email" id="fp-email" className="fp-input" placeholder=" " value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} autoComplete="email" />
                  <label htmlFor="fp-email" className="fp-float-label">Email Address</label>
                  <div className="fp-input-line" />
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? <span className="fp-spinner" /> : 'Send Reset Code'}
                </button>
              </form>

              <div className="fp-footer-link">
                <Link to="/login" className="fp-back-link">
                  <span className="material-symbols-outlined fp-back-icon">arrow_back</span>
                  Back to Login
                </Link>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="fp-glass-card fp-animate-in" key="otp">
              <div className="fp-icon-wrap fp-icon-wrap--otp">
                <span className="material-symbols-outlined fp-icon">mark_email_read</span>
              </div>
              <h1 className="fp-title">Verify Your Identity</h1>
              <p className="fp-subtitle">We've sent a 6-digit verification code to <strong>{email}</strong>. Enter it below.</p>

              <form className="fp-form" onSubmit={handleOtpSubmit}>
                <div className="fp-otp-row">
                  {otp.map((digit, i) => (
                    <input key={i} ref={el => (inputRefs.current[i] = el)} type="text" className="fp-otp-input" maxLength="1" value={digit} onChange={e => handleOtpChange(i, e.target.value)} onKeyDown={e => handleOtpKeyDown(i, e)} onPaste={handleOtpPaste} required disabled={loading} />
                  ))}
                </div>
                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? <span className="fp-spinner" /> : 'Verify Code'}
                </button>
              </form>

              <div className="fp-resend-area">
                <span>Didn't receive the code?</span>
                <button type="button" className="fp-resend-btn" onClick={handleResendOtp} disabled={countdown > 0 || resending || loading}>
                  {resending ? 'Sending...' : countdown > 0 ? `Resend in ${countdown}s` : 'Click to resend'}
                </button>
              </div>

              <div className="fp-footer-link">
                <button type="button" className="fp-back-link" onClick={() => { setStep('email'); setOtp([...INITIAL_OTP]); }}>
                  <span className="material-symbols-outlined fp-back-icon">arrow_back</span>
                  Change email address
                </button>
              </div>
            </div>
          )}

          {step === 'newPassword' && (
            <div className="fp-glass-card fp-glass-card--wide fp-animate-in" key="password">
              <div className="fp-header-center">
                <h1 className="fp-title">Establish New Password</h1>
                <p className="fp-subtitle">Your new password must be different from previously used passwords to ensure account security.</p>
              </div>

              <form className="fp-form" onSubmit={handleResetPassword}>
                {renderPasswordField('New Password', 'fp-new-password', newPassword, setNewPassword, showPassword, () => setShowPassword(v => !v))}
                {renderPasswordField('Confirm New Password', 'fp-confirm-password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword(v => !v))}

                <div className="fp-req-box">
                  <p className="fp-req-title">Security Requirements</p>
                  <ul className="fp-req-list">
                    {requirements.map(({ key, label }) => (
                      <li key={key} className={`fp-req-item ${checks[key] ? 'fp-req-valid' : ''}`}>
                        <span className="material-symbols-outlined fp-req-icon">check_circle</span>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>

                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? <span className="fp-spinner" /> : 'Reset Password'}
                </button>
              </form>

              <div className="fp-footer-link">
                <Link to="/login" className="fp-back-link">
                  <span className="material-symbols-outlined fp-back-icon">arrow_back</span>
                  Return to Login
                </Link>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

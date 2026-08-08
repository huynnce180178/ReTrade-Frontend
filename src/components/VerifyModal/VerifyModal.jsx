import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import accountService from '../../services/accountService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

import './Verify.css';

export default function VerifyModal({ isOpen, onClose, email }) {
  const { t } = useLanguage();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const [otpStatus, setOtpStatus] = useState({ checking: false, valid: null, message: '' });
  
  const { showToast } = useToast();
  const navigate = useNavigate();
  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setOtpStatus({ checking: false, valid: null, message: '' });
      setResendCount(0);
      setCountdown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const code = otp.join('');
    if (code.length !== 6) {
      setOtpStatus({ checking: false, valid: null, message: '' });
      return;
    }

    setOtpStatus({ checking: true, valid: null, message: '' });
    const timer = setTimeout(async () => {
      try {
        const verifyResult = await accountService.verify({ email, otp: code });
        const verified = verifyResult === true || verifyResult?.verified === true;
        if (verified) {
          setOtpStatus({ checking: false, valid: true, message: '' });
          onClose();
          navigate('/login', { replace: true });
        } else {
          setOtpStatus({
            checking: false,
            valid: false,
            message: t('validation.otp_invalid') || '✕ Mã OTP không hợp lệ hoặc đã hết hạn.'
          });
        }
      } catch (err) {
        setOtpStatus({
          checking: false,
          valid: false,
          message: err.response?.data?.message || t('validation.otp_invalid') || '✕ Mã OTP không hợp lệ hoặc đã hết hạn.'
        });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [otp, email, navigate, onClose, t]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      const nextFocus = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocus].focus();
    }
  };

  const handleResend = async () => {
    if (resendCount >= 3) {
      showToast(t('auth.otp_resend_limit'), 'error');
      return;
    }
    setResending(true);
    try {
      await accountService.resendOtp(email);
      const nextCount = resendCount + 1;
      setResendCount(nextCount);
      showToast(t('auth.unverified_login_prompt', { email }), 'info');
      setCountdown(60);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || t('common.error_occurred');
      showToast(errorMsg, 'error');
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      showToast(t('validation.required'), 'error');
      return;
    }

    setLoading(true);
    try {
      const verifyResult = await accountService.verify({ email, otp: code });
      const verified = verifyResult === true || verifyResult?.verified === true;
      if (!verified) {
        throw new Error(verifyResult?.message || 'Invalid or expired OTP.');
      }

      onClose();
      navigate('/login', { replace: true });
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || t('common.error_occurred');
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="verify-modal-overlay">
      <div className="verify-modal-card">
        
        <button className="verify-close-btn" onClick={onClose} disabled={loading} aria-label={t('common.close')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>

        <div className="verify-icon-wrapper">
          <span className="material-symbols-outlined">mark_email_read</span>
        </div>

        <h1 className="verify-title">{t('common.confirm')}</h1>
        <p className="verify-desc">
          <span>{email || 'your email'}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="otp-container">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                className={`otp-input ${otpStatus.valid === true ? 'otp-input-valid' : otpStatus.valid === false ? 'otp-input-error' : ''}`}
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                required
                disabled={loading}
              />
            ))}
          </div>

          {otpStatus.message && (
            <div className={`mt-2 mb-2 text-xs font-medium text-center ${otpStatus.valid ? 'text-emerald-600' : 'text-red-500'}`}>
              {otpStatus.message}
            </div>
          )}

          <button type="submit" className="verify-submit-btn" disabled={loading}>
            {loading ? (
              <span className="btn-spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
            ) : (
              t('common.confirm')
            )}
          </button>
        </form>

        <div className="verify-footer-text">
          <button 
            type="button" 
            className="verify-resend-btn"
            onClick={handleResend}
            disabled={countdown > 0 || resending || loading}
          >
            {resending ? t('common.submitting') : countdown > 0 ? `${countdown}s` : t('common.reset')}
          </button>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useAuth } from '../../../context/AuthContext';
import accountService from '../../../services/accountService';

import '../../../styles/ResetPassword.css';

export default function ResetPassword() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (user && !user.mustChangePassword) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast(t('forgot_password_page.enter_email_err'), 'error');
      return;
    }

    setLoading(true);
    try {
      await accountService.passwordRecovery(email.trim());
      setSent(true);
      showToast(t('forgot_password_page.code_sent'), 'success');
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data;
      showToast(typeof errorMsg === 'string' ? errorMsg : t('forgot_password_page.email_not_found'), 'error');
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

              <h1 className="rp-title">{t('reset_password_page.recovery_title')}</h1>
              <p className="rp-subtitle">
                {t('reset_password_page.recovery_subtitle')}
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
                  <label htmlFor="rp-email" className="rp-float-label">{t('forgot_password_page.email_label')}</label>
                  <div className="rp-input-line"></div>
                </div>

                <button type="submit" className="rp-btn-primary" disabled={loading}>
                  {loading ? (
                    <span className="rp-spinner"></span>
                  ) : (
                    t('reset_password_page.send_new_password_btn')
                  )}
                </button>
              </form>

              <div className="rp-info-strip">
                <span className="material-symbols-outlined rp-info-icon">info</span>
                <span>{t('reset_password_page.recovery_info_notice')}</span>
              </div>

              <div className="rp-footer-link">
                <Link to="/login" className="rp-back-link">
                  <span className="material-symbols-outlined rp-back-icon">arrow_back</span>
                  {t('forgot_password_page.back_to_login')}
                </Link>
              </div>
            </div>
          ) : (
            /* ========== Success ========== */
            <div className="rp-glass-card rp-animate-in" key="success-step">
              <div className="rp-icon-wrap rp-icon-wrap--success">
                <span className="material-symbols-outlined rp-icon rp-icon--success">check_circle</span>
              </div>

              <h1 className="rp-title">{t('reset_password_page.check_inbox_title')}</h1>
              <p className="rp-subtitle">
                {t('reset_password_page.check_inbox_subtitle', { email })}
              </p>

              <div className="rp-steps">
                <div className="rp-step-item">
                  <div className="rp-step-num">1</div>
                  <div className="rp-step-content">
                    <strong>{t('reset_password_page.recovery_step1_title')}</strong>
                    <span>{t('reset_password_page.recovery_step1_desc')}</span>
                  </div>
                </div>
                <div className="rp-step-item">
                  <div className="rp-step-num">2</div>
                  <div className="rp-step-content">
                    <strong>{t('reset_password_page.recovery_step2_title')}</strong>
                    <span>{t('reset_password_page.recovery_step2_desc')}</span>
                  </div>
                </div>
                <div className="rp-step-item">
                  <div className="rp-step-num">3</div>
                  <div className="rp-step-content">
                    <strong>{t('reset_password_page.recovery_step3_title')}</strong>
                    <span>{t('reset_password_page.recovery_step3_desc')}</span>
                  </div>
                </div>
              </div>

              <button type="button" className="rp-btn-primary" onClick={handleBackToLogin}>
                {t('forgot_password_page.return_to_login')}
              </button>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

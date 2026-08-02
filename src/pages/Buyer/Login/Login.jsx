import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import bgLogin from '../../../assets/background-login.png';
import ChangePasswordAfterRecoveryModal from '../../../components/ChangePasswordAfterRecoveryModal/ChangePasswordAfterRecoveryModal';

import '../../../styles/Login.css';

export default function Login() {
  const { user, login, googleLogin } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showFirstChangeModal, setShowFirstChangeModal] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      showToast(t('validation.required'), 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await login(username, password);
      if (result.success) {
        if (result.mustChangePassword) {
          showToast(t('auth.change_pw_title'), 'info');
          setShowFirstChangeModal(true);
        } else {
          showToast(t('toast.login_success'), 'success');
          navigate('/');
        }
      } else {
        showToast(result.error || t('common.error_occurred'), 'error');
      }
    } catch (err) {
      showToast(t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await googleLogin(tokenResponse.access_token);
        if (result.success) {
          if (result.mustChangePassword) {
            showToast(t('auth.change_pw_title'), 'info');
            setShowFirstChangeModal(true);
          } else {
            showToast(t('toast.login_success'), 'success');
            navigate('/');
          }
        } else {
          showToast(result.error || t('common.error_occurred'), 'error');
        }
      } catch {
        showToast(t('common.error_occurred'), 'error');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (errorResponse) => {
      if (errorResponse?.error === 'access_denied') {
        showToast(language === 'vi' ? 'Bạn đã từ chối quyền Google Profile.' : 'You denied Google profile permission.', 'warning');
        return;
      }
      showToast(t('common.error_occurred'), 'error');
    },
    onNonOAuthError: () => {
      showToast(language === 'vi' ? 'Đăng nhập Google đã bị đóng hoặc bị chặn.' : 'Google sign-in was closed or blocked.', 'warning');
    },
    flow: 'implicit',
    // Explicit profile scopes keep behavior aligned with common production OAuth setups.
    scope: 'openid email profile https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    prompt: 'consent select_account',
    include_granted_scopes: false,
  });

  return (
    <div className="login-page-premium">
      <section className="login-section">
        <div className="login-split-card">

          {/* Left Side: Visual Storytelling */}
          <div className="login-left-side">
            <img
              src={bgLogin}
              alt="Sustainable Luxury Close-up"
            />
            <div className="hero-gradient">
              <h2>
                {t('home.hero_title_1')}<br />
                {t('home.hero_title_2')}
              </h2>
              <p>{t('home.hero_subtitle')}</p>
            </div>
          </div>

          {/* Right Side: Login Form */}
          <div className="login-right-side">
            <div className="login-form-container">

              <div className="login-header-text">
                <h1>{t('auth.login_title')}</h1>
                <p>{t('auth.login_subtitle')}</p>
              </div>

              <>
                  {/* Google Sign In */}
                  <button
                    type="button"
                    className="google-btn-premium"
                    onClick={() => handleGoogleLogin()}
                    disabled={loading || googleLoading}
                  >
                    {googleLoading ? (
                      <span className="btn-spinner btn-spinner-dark" style={{ width: '20px', height: '20px' }}></span>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" width="20" height="20">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                        </svg>
                        <span>{t('auth.google_login')}</span>
                      </>
                    )}
                  </button>

                  <div className="login-divider">
                    <div className="login-divider-line"></div>
                    <span>{t('auth.or_continue_with')}</span>
                    <div className="login-divider-line"></div>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="login-form-premium">

                    <div className="form-group-premium">
                      <label htmlFor="username">{t('auth.username_or_email')}</label>
                      <input
                        type="text"
                        id="username"
                        className="input-line"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        disabled={loading || googleLoading}
                      />
                    </div>

                    <div className="form-group-premium">
                      <label htmlFor="password">{t('auth.password')}</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        className="input-line"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading || googleLoading}
                      />
                      <button
                        type="button"
                        className="password-toggle-premium"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={loading || googleLoading}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                            <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                            <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                            <line x1="2" y1="2" x2="22" y2="22" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className="login-form-footer" style={{ justifyContent: 'flex-start' }}>
                      <label className="remember-me">
                        <input type="checkbox" />
                        <span>{t('auth.remember_me')}</span>
                      </label>
                    </div>

                    <button type="submit" className="submit-btn-premium" disabled={loading || googleLoading}>
                      {loading ? (
                        <span className="btn-spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                      ) : (
                        <>
                          {t('auth.login_button')}
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        </>
                      )}
                    </button>

                  </form>

                  <div className="register-prompt">
                    <p>
                      {t('auth.no_account')}
                      <Link to="/register" className="register-link-premium"> {t('auth.register_now')}</Link>
                    </p>
                  </div>

                  <div className="password-recovery-links">
                    <Link to="/forgot-password" className="forgot-link-premium">{t('auth.forgot_password')}</Link>
                    <span className="link-separator"></span>
                    <Link to="/reset-password" className="forgot-link-premium">{t('auth.reset_title')}</Link>
                  </div>
                </>

            </div>
          </div>

        </div>
      </section>

      <ChangePasswordAfterRecoveryModal
        isOpen={showFirstChangeModal}
        onClose={() => setShowFirstChangeModal(false)}
        onSuccess={() => {
          setShowFirstChangeModal(false);
          navigate('/');
        }}
      />
    </div>
  );
}

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import '../../../styles/Register.css';
import VerifyModal from '../../../components/VerifyModal/VerifyModal';
import TermsModal from '../../../components/TermsModal/TermsModal';
import bgRegister from '../../../assets/background-register.png';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  
  const [showTerms, setShowTerms] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    roleId: 2,
    agreed: false
  });

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e) => {
    const { id, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      try {
        const result = await googleLogin(tokenResponse.access_token);
        if (result.success) {
          showToast('Signed up with Google!', 'success');
          navigate('/');
        } else {
          showToast(result.error || 'Google sign-up failed.', 'error');
        }
      } catch {
        showToast('Google sign-up failed. Please try again.', 'error');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      showToast('Google sign-up was cancelled or failed.', 'error');
    },
    flow: 'implicit',
    scope: 'openid email profile',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.username.trim() || !formData.email.trim() || !formData.password.trim() || !formData.confirmPassword.trim()) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }
    
    if (!formData.agreed) {
      showToast('You must agree to the Terms of Membership.', 'error');
      return;
    }

    const password = formData.password;
    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showToast('Password must contain at least one uppercase letter.', 'error');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      showToast('Password must contain at least one special character.', 'error');
      return;
    }
    if (password !== formData.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        roleId: Number(formData.roleId),
      });

      if (result.success) {
        showToast('Registration successful!', 'success');
        setRegisteredEmail(formData.email);
        setShowVerifyModal(true);
      } else {
        const rawError = result.error || '';
        const lowerError = rawError.toLowerCase();
        let friendlyMsg;
        if (lowerError.includes('username') && (lowerError.includes('taken') || lowerError.includes('exist') || lowerError.includes('already') || lowerError.includes('duplicate'))) {
          friendlyMsg = 'Username already taken. Please choose a different one.';
        } else if (lowerError.includes('email') && (lowerError.includes('taken') || lowerError.includes('exist') || lowerError.includes('already') || lowerError.includes('duplicate'))) {
          friendlyMsg = 'Email address is already registered. Please use a different email or log in.';
        } else if (rawError) {
          friendlyMsg = rawError;
        } else {
          friendlyMsg = 'Registration failed. Username or email might already be taken.';
        }
        showToast(friendlyMsg, 'error');
      }
    } catch (err) {
      showToast('Failed to connect to registration service. Try again later.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page-premium">
      <div className="register-container">
        <div className="register-grid">
          
          {/* Left Content: Brand Narrative */}
          <div className="register-left-col">
            <span className="brand-subtitle">Join ReTrade</span>
            <h1 className="brand-title">Experience the Future of <br/><span style={{fontStyle: 'italic', fontWeight: '400'}}>Smart Trading.</span></h1>
            <p className="brand-desc">
              Create your account to buy, sell, and auction quality pre-owned goods securely. Connect with a trusted community of verified users.
            </p>
            
            <div className="brand-image-wrapper">
              <img src={bgRegister} alt="ReTrade Platform" />
              <div className="brand-image-overlay">
                <div className="brand-quote-box">
                  <p className="brand-quote">"Redefining value through secure and smart second-hand commerce."</p>
                  <p className="brand-est">EST. 2024 — Trusted Marketplace</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Content: Registration Form */}
          <div className="register-right-col">
            <div className="register-form-header">
              <h2>Create Your Account</h2>
              <p>Join a trusted community for secure and smart trading.</p>
            </div>

            <button 
              type="button" 
              className="google-btn-register"
              onClick={() => handleGoogleLogin()}
              disabled={loading || googleLoading}
            >
              {googleLoading ? (
                <span className="btn-spinner btn-spinner-dark" style={{ width: '20px', height: '20px' }}></span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" width="20" height="20">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.83z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.83c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            <div className="register-divider">
              <div className="register-divider-line"></div>
              <span>or register via email</span>
              <div className="register-divider-line"></div>
            </div>

            <form onSubmit={handleSubmit}>
              
              <div className="form-grid">
                <div className="input-wrapper-register">
                  <label htmlFor="firstName">First Name</label>
                  <input type="text" id="firstName" className="input-register" value={formData.firstName} onChange={handleChange} disabled={loading} />
                </div>
                <div className="input-wrapper-register">
                  <label htmlFor="lastName">Last Name</label>
                  <input type="text" id="lastName" className="input-register" value={formData.lastName} onChange={handleChange} disabled={loading} />
                </div>
                <div className="input-wrapper-register form-group-full">
                  <label htmlFor="email">Email Address *</label>
                  <input type="email" id="email" className="input-register" value={formData.email} onChange={handleChange} required disabled={loading} />
                </div>

                <div className="input-wrapper-register form-group-full">
                  <label htmlFor="username">Username *</label>
                  <input type="text" id="username" className="input-register" value={formData.username} onChange={handleChange} required disabled={loading} />
                </div>

                <div className="input-wrapper-register">
                  <label htmlFor="password">Password *</label>
                  <div className="password-input-container">
                    <input type={showPassword ? 'text' : 'password'} id="password" className="input-register" value={formData.password} onChange={handleChange} required disabled={loading} />
                    <button type="button" className="password-toggle-register" onClick={() => setShowPassword(!showPassword)} disabled={loading}>
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="input-wrapper-register">
                  <label htmlFor="confirmPassword">Confirm Password *</label>
                  <div className="password-input-container">
                    <input type={showConfirmPassword ? 'text' : 'password'} id="confirmPassword" className="input-register" value={formData.confirmPassword} onChange={handleChange} required disabled={loading} />
                    <button type="button" className="password-toggle-register" onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={loading}>
                      {showConfirmPassword ? (
                         <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="terms-container">
                <input type="checkbox" id="agreed" checked={formData.agreed} onChange={handleChange} disabled={loading} />
                <label htmlFor="agreed">
                  I acknowledge that I have read and agree to the <span onClick={() => setShowTerms(true)} style={{cursor: 'pointer', color: '#02241b', textDecoration: 'underline', fontWeight: '700'}}>Terms of Membership</span>.
                </label>
              </div>

              <button type="submit" className="submit-btn-register" disabled={loading || googleLoading}>
                {loading ? (
                  <span className="btn-spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
                ) : (
                  <>
                    <span>Establish Account</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                  </>
                )}
              </button>

            </form>

            <div className="login-prompt">
              <p>
                Already part of our community? 
                <Link to="/login" className="login-link-register">Login here</Link>
              </p>
            </div>

          </div>

        </div>
      </div>

      <VerifyModal 
        isOpen={showVerifyModal} 
        onClose={() => setShowVerifyModal(false)} 
        email={registeredEmail}
      />
      <TermsModal 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
      />
    </div>
  );
}

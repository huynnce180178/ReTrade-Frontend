import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import '../../../styles/MyAccount.css';
import accountService from '../../../services/accountService';
import { useToast } from '../../../context/ToastContext';

export default function MyAccount() {
  const { user, loading, setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const fileInputRef = React.useRef();

  const [username, setUsername] = useState(user?.username || '');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading account details...</p>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="profile-unauth-page animate-fade-in">
        <div className="unauth-card glass-panel text-center">
          <span className="unauth-icon">🔒</span>
          <h2>Access Denied</h2>
          <p>Please log in to view and manage your account details.</p>
          <div className="unauth-actions">
            <Link to="/login" className="btn btn-primary">Sign In</Link>
            <Link to="/" className="btn btn-secondary">Go to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return user.username.slice(0, 2).toUpperCase();
  };




    const handleChooseImage = () => {
      fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        showToast('Uploading image...', 'info');
        const res = await accountService.uploadAvatar(file);
        if (res?.avatarUrl) {
          setUser((u) => {
            const updated = { ...u, avatarUrl: res.avatarUrl };
            localStorage.setItem('user', JSON.stringify(updated));
            return updated;
          });
          showToast('Profile image updated.', 'success');
        } else {
          showToast('Upload succeeded but no url returned.', 'warning');
        }
      } catch (err) {
        showToast(err?.response?.data || 'Failed to upload image.', 'error');
      }
    };

  const getDisplayName = () => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.username;
  };



  const handleSaveChanges = async (e) => {
    e.preventDefault();
    try {
      showToast('Saving changes...', 'info');
      const updatedProfile = await accountService.updateProfile({
        username,
        firstName,
        lastName,
        email,
        phone
      });
      if (updatedProfile) {
        setUser((u) => {
          const updated = { ...u, ...updatedProfile };
          localStorage.setItem('user', JSON.stringify(updated));
          return updated;
        });
        showToast('Profile updated successfully.', 'success');
      }
    } catch (err) {
      showToast(err?.response?.data || 'Failed to update profile.', 'error');
    }
  };

  const handleCancel = () => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  };

  return (
    <div className="profile-page-wrapper container animate-fade-in">
      <div className="profile-grid">
        <AccountSidebar />

        <main className="ma-main">
          <div className="ma-grid">
            
            {/* Left Column */}
            <div className="ma-col-left">
              
              {/* Page Header Card */}
              <div className="ma-card ma-header-card">
                <div className="ma-header-info">
                  <div className="ma-header-icon">
                    <span className="material-symbols-outlined">person_search</span>
                  </div>
                  <div>
                    <h1 className="ma-headline">Personal Information</h1>
                    <p className="ma-subtitle">Manage your account details and profile settings</p>
                  </div>
                </div>
              </div>

              {/* Personal Information Form Card */}
              <div className="ma-card ma-info-card">
                <h4 className="ma-card-title">Basic Details</h4>
                <form className="ma-form" onSubmit={handleSaveChanges}>
                  <div className="ma-form-grid">
                    <div className="ma-form-group">
                      <label className="ma-label">Username</label>
                      <input type="text" className="ma-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Email Address</label>
                      <input type="email" className="ma-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">First Name</label>
                      <input type="text" className="ma-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Last Name</label>
                      <input type="text" className="ma-input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Phone Number</label>
                      <input type="tel" className="ma-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>
                  </div>

                  <div className="ma-form-actions">
                    <button type="submit" className="ma-btn-primary">Save Changes</button>
                    <button type="button" className="ma-btn-secondary" onClick={handleCancel}>Cancel</button>
                  </div>
                </form>
              </div>

            </div>

            {/* Right Column */}
            <div className="ma-col-right">
              
              {/* Profile Photo Card */}
              <div className="ma-card">
                <h4 className="ma-card-title" style={{ marginBottom: '24px' }}>Profile Photo</h4>
                <div className="ma-profile-photo-section" style={{ flexDirection: 'column', gap: '24px', alignItems: 'flex-start', marginBottom: 0 }}>
                  <div className="ma-photo-wrapper">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Profile" className="ma-photo-img" />
                    ) : (
                      <div className="ma-photo-placeholder">{getInitials()}</div>
                    )}
                  </div>
                    <div className="ma-photo-text">
                    <p className="ma-subtitle-small">Accepted formats: JPG, PNG (Max 5MB)</p>
                    <button type="button" className="ma-link-btn" onClick={handleChooseImage}>Update Image</button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  </div>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="ma-privacy-card" style={{ flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="material-symbols-outlined ma-privacy-icon fill-1">verified_user</span>
                  <h4 className="ma-privacy-title" style={{ margin: 0 }}>Privacy & Security</h4>
                </div>
                <p className="ma-privacy-text" style={{ fontSize: '14px' }}>
                  RETRADE uses end-to-end encryption to protect your personal information. We never share your sensitive data with third parties without your explicit consent.
                </p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


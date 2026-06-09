import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import '../../../styles/MyAccount.css';
import accountService from '../../../services/accountService';
import profileService from '../../../services/profileService';
import { useToast } from '../../../context/ToastContext';
import { forceLogout } from '../../../utils/authUtils';

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
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [street, setStreet] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const loadProfileDetail = async () => {
      setProfileLoading(true);
      try {
        const profile = await profileService.getMyProfile();
        const address = profile?.defaultAddress || null;

        setDefaultAddress(address);
        setUsername(profile?.username || '');
        setFirstName(profile?.firstName || '');
        setLastName(profile?.lastName || '');
        setEmail(profile?.email || '');
        setPhone(profile?.phone || '');
        setStreet(address?.street || '');
        setProvinceId(address?.provinceId ?? '');
        setDistrictId(address?.districtId ?? '');
        setWardCode(address?.wardCode || '');
        setReceiverName(address?.receiverName || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim());
        setReceiverPhone(address?.receiverPhone || profile?.phone || '');
      } catch (err) {
        showToast(err?.response?.data || 'Failed to load profile details.', 'error');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfileDetail();
  }, [user, showToast]);

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
      const addressPayload = street || receiverName || receiverPhone || provinceId || districtId || wardCode
        ? {
            addressId: defaultAddress?.addressId,
            receiverName: receiverName || `${firstName} ${lastName}`.trim(),
            receiverPhone: receiverPhone || phone,
            street,
            provinceId: provinceId === '' ? null : Number(provinceId),
            districtId: districtId === '' ? null : Number(districtId),
            wardCode,
            isDefault: true,
            status: defaultAddress?.status || 'Active',
          }
        : null;

      const updatedProfile = await profileService.updateMyProfile({
        username,
        firstName,
        lastName,
        email,
        phone,
        address: addressPayload,
      });
      if (updatedProfile) {
        setDefaultAddress(updatedProfile.defaultAddress || null);
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
      setStreet(defaultAddress?.street || '');
      setProvinceId(defaultAddress?.provinceId ?? '');
      setDistrictId(defaultAddress?.districtId ?? '');
      setWardCode(defaultAddress?.wardCode || '');
      setReceiverName(defaultAddress?.receiverName || '');
      setReceiverPhone(defaultAddress?.receiverPhone || '');
    }
  };

  const handleDeactivateAccount = async () => {
    try {
      setDeactivateLoading(true);
      await accountService.deactivateMe();
      showToast('Your account has been deactivated.', 'success');
      setShowDeactivateModal(false);
      forceLogout();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to deactivate account.', 'error');
    } finally {
      setDeactivateLoading(false);
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
                {profileLoading && <p className="ma-inline-note">Loading latest profile data...</p>}
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

                  <div className="ma-section-divider">
                    <h4 className="ma-card-title">Default Address</h4>
                    <p className="ma-subtitle-small">This address is created when missing and updated when already available.</p>
                  </div>

                  <div className="ma-form-grid">
                    <div className="ma-form-group">
                      <label className="ma-label">Receiver Name</label>
                      <input type="text" className="ma-input" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Receiver Phone</label>
                      <input type="tel" className="ma-input" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
                    </div>
                    <div className="ma-form-group ma-form-group-wide">
                      <label className="ma-label">Street Address</label>
                      <input type="text" className="ma-input" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="House number, street, building" />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Province ID</label>
                      <input type="number" className="ma-input" value={provinceId} onChange={(e) => setProvinceId(e.target.value)} />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">District ID</label>
                      <input type="number" className="ma-input" value={districtId} onChange={(e) => setDistrictId(e.target.value)} />
                    </div>
                    <div className="ma-form-group">
                      <label className="ma-label">Ward Code</label>
                      <input type="text" className="ma-input" value={wardCode} onChange={(e) => setWardCode(e.target.value)} />
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

              <div className="ma-danger-card" style={{ flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="material-symbols-outlined ma-danger-icon">cancel</span>
                  <h4 className="ma-danger-title" style={{ margin: 0 }}>Deactivate Account</h4>
                </div>
                <p className="ma-danger-text" style={{ fontSize: '14px' }}>
                  If you no longer want to use ReTrade, you can deactivate your account. You will be logged out immediately and receive a confirmation email.
                </p>
                <button type="button" className="ma-danger-btn" onClick={() => setShowDeactivateModal(true)}>
                  Deactivate Account
                </button>
              </div>

            </div>
          </div>
        </main>
      </div>

      {showDeactivateModal && (
        <div className="ma-deactivate-overlay" onClick={() => !deactivateLoading && setShowDeactivateModal(false)}>
          <div className="ma-deactivate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ma-deactivate-header">
              <div>
                <p className="ma-deactivate-kicker">Inactive User</p>
                <h3>Deactivate your account?</h3>
              </div>
              <button type="button" className="ma-deactivate-close" onClick={() => setShowDeactivateModal(false)} disabled={deactivateLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="ma-deactivate-body">
              <p>
                Your account will be set to <strong>Inactive</strong>, you will be logged out immediately, and you will receive a confirmation email.
              </p>
              <div className="ma-deactivate-note">
                You can ask support by replying to the email if you have any questions.
              </div>
            </div>

            <div className="ma-deactivate-footer">
              <button type="button" className="ma-btn-secondary" onClick={() => setShowDeactivateModal(false)} disabled={deactivateLoading}>
                Cancel
              </button>
              <button type="button" className="ma-danger-btn" onClick={handleDeactivateAccount} disabled={deactivateLoading}>
                {deactivateLoading ? 'Processing...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


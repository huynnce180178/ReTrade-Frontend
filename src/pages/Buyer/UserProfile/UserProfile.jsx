import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import profileService from '../../../services/profileService';
import '../../../styles/ProfileView.css';

const formatDate = (date) => {
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(date));
};

const getDisplayName = (profile) => {
  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
  return fullName || profile?.username || 'ReTrade Member';
};

const getInitials = (profile) => {
  const name = getDisplayName(profile);
  return name.slice(0, 2).toUpperCase();
};

const formatAddress = (address) => {
  if (!address) return 'No default address yet';
  const parts = [address.street, address.wardCode, address.districtId && `District ${address.districtId}`, address.provinceId && `Province ${address.provinceId}`].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No default address yet';
};

const isValidAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed === 'Avatar' ||
    trimmed === 'Profile' ||
    trimmed === 'null' ||
    trimmed === 'undefined' ||
    trimmed === '[object Object]'
  ) {
    return false;
  }
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  );
};

export default function UserProfile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [profile?.avatarUrl]);

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await profileService.getUserProfile(userId);
        setProfile(data);
      } catch (err) {
        setError(err?.response?.data || 'User profile not found.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="profile-view-state">
        <span className="btn-spinner"></span>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-view-state">
        <span className="material-symbols-outlined profile-view-state-icon">person_off</span>
        <h2>{error}</h2>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  const isOwnProfile = Boolean(
    user && profile && (
      user.userId === profile.userId ||
      user.accountId === profile.accountId
    )
  );
  const roleLabel = (profile.roles || []).join(' / ') || 'Buyer';
  const addressCount = profile.addresses?.length || 0;

  return (
    <div className="buyer-member-page container animate-fade-in">
      <section className="buyer-member-header">
        <div className="buyer-member-avatar">
          {isValidAvatarUrl(profile?.avatarUrl) && !avatarError ? (
            <img src={profile.avatarUrl} alt={getDisplayName(profile)} onError={() => setAvatarError(true)} />
          ) : (
            getInitials(profile)
          )}
          <span className="buyer-member-check">
            <span className="material-symbols-outlined">check</span>
          </span>
        </div>

        <div className="buyer-member-main">
          <span className="buyer-member-eyebrow">{isOwnProfile ? 'My ReTrade Profile' : 'Member Profile'}</span>
          <h1>{getDisplayName(profile)}</h1>
          <div className="buyer-member-meta">
            <span><span className="material-symbols-outlined">alternate_email</span>@{profile.username}</span>
            <span><span className="material-symbols-outlined">calendar_month</span>Joined {formatDate(profile.createdAt)}</span>
            <span><span className="material-symbols-outlined">verified_user</span>{roleLabel}</span>
          </div>

          {isOwnProfile ? (
            <div className="buyer-member-actions">
              <Link to="/profile" className="buyer-member-primary">
                <span className="material-symbols-outlined">edit</span>
                Edit Profile
              </Link>
              <Link to="/address-book" className="buyer-member-secondary">
                <span className="material-symbols-outlined">location_on</span>
                Address Book
              </Link>
              <Link to="/purchase-history" className="buyer-member-secondary">
                <span className="material-symbols-outlined">receipt_long</span>
                Purchases
              </Link>
            </div>
          ) : (
            <div className="buyer-member-actions">
              <button type="button" className="buyer-member-primary">
                <span className="material-symbols-outlined">mail</span>
                Message
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="buyer-member-stats">
        <div>
          <strong>{profile.status || 'Active'}</strong>
          <span>Status</span>
        </div>
        <div>
          <strong>{addressCount}</strong>
          <span>{isOwnProfile ? 'Saved Addresses' : 'Address Records'}</span>
        </div>
        <div>
          <strong>{formatDate(profile.updatedAt)}</strong>
          <span>Last Updated</span>
        </div>
      </section>

      <section className="buyer-member-content">
        <article className="buyer-member-card buyer-member-about">
          <span className="profile-view-kicker">{isOwnProfile ? 'Private Overview' : 'About Member'}</span>
          <h2>{isOwnProfile ? 'Account Snapshot' : 'ReTrade Community Member'}</h2>
          <p>
            {isOwnProfile
              ? 'Manage your profile details, delivery information, and ReTrade activity from one place.'
              : `${getDisplayName(profile)} is part of the ReTrade second-hand trading community.`}
          </p>
          <div className="buyer-member-tags">
            <span><span className="material-symbols-outlined">eco</span> Circular trading</span>
            <span><span className="material-symbols-outlined">shield</span> Verified account</span>
            {isOwnProfile && <span><span className="material-symbols-outlined">home</span>{formatAddress(profile.defaultAddress)}</span>}
          </div>
        </article>

        <article className="buyer-member-card">
          <h2>{isOwnProfile ? 'Personal Details' : 'Public Details'}</h2>
          <dl className="buyer-member-detail-list">
            <div>
              <dt>Member ID</dt>
              <dd>{profile.userId}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{roleLabel}</dd>
            </div>
            {isOwnProfile && (
              <>
                <div>
                  <dt>Email</dt>
                  <dd>{profile.email || 'Not available'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{profile.phone || 'Not available'}</dd>
                </div>
              </>
            )}
          </dl>
        </article>
      </section>

      <section className="buyer-member-activity">
        <div className="buyer-member-activity-header">
          <h2>{isOwnProfile ? 'Your Buyer Activity' : 'Member Activity'}</h2>
          {isOwnProfile && <Link to="/purchase-history">View purchase history</Link>}
        </div>
        <div className="buyer-member-empty">
          <span className="material-symbols-outlined">shopping_bag</span>
          <p>{isOwnProfile ? 'Your buyer activity will appear here.' : 'Public buyer activity is not available yet.'}</p>
        </div>
      </section>
    </div>
  );
}

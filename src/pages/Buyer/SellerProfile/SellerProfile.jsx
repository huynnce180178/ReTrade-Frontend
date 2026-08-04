import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import profileService from '../../../services/profileService';
import reviewService from '../../../services/reviewService';
import { createSellerHubConnection } from '../../../services/sellerRealtimeService';
import wishlistService from '../../../services/wishlistService';
import chatService from '../../../services/chatService';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/ProfileView.css';
import './SellerProfileReviews.css';

const getDisplayName = (seller) => {
  const fullName = `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim();
  return fullName || seller?.username || 'ReTrade Seller';
};

const getInitials = (seller) => {
  const name = getDisplayName(seller);
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const formatAddress = (address, t) => {
  if (!address) return t('seller_profile.no_default_address');
  const parts = [
    address.street ?? address.streetAddress,
    address.wardCode,
    address.districtId && `${t('seller_profile.district')} ${address.districtId}`,
    address.provinceId && `${t('seller_profile.province')} ${address.provinceId}`,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : t('seller_profile.no_default_address');
};

const hasRole = (user, roleName) => {
  return (user?.roles || []).some((role) => String(role).trim().toLowerCase() === roleName.toLowerCase());
};

const isProductUnavailable = (product) => (
  product?.status === 'SoldOut' ||
  product?.status === 'Sold' ||
  product?.status === 'Inactive' ||
  Number(product?.stockQuantity ?? 0) <= 0
);

function formatReviewDate(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function getReviewInitials(name) {
  const cleanName = String(name || 'Buyer').replace(/\*/g, '').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return (parts[0] || 'B').slice(0, 2).toUpperCase();
}

export default function SellerProfile() {
  const { sellerId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const followRequestInFlightRef = React.useRef(false);
  const [activeTab, setActiveTab] = useState('items');
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);
  const [productStatus, setProductStatus] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [togglingId, setTogglingId] = useState(null);
  const [sellerReviews, setSellerReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalItems, setReviewTotalItems] = useState(0);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [activeReviewSummary, setActiveReviewSummary] = useState(null);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (!user) return;
      try {
        const data = await wishlistService.getWishlist();
        const ids = new Set((data.items ?? []).map(i => i.productId));
        setWishlistIds(ids);
      } catch {
        // Silent catch for initial load
      }
    };
    fetchWishlist();
  }, [user]);

  const handleWishlistToggle = async (product) => {
    const productId = product?.productId;
    if (!productId) return;
    if (!user) {
      showToast(t('seller_profile.login_required_chat'), 'error');
      return;
    }
    const isAdded = wishlistIds.has(productId);
    if (!isAdded && isProductUnavailable(product)) {
      showToast(t('product.out_of_stock'), 'warning');
      return;
    }
    setTogglingId(productId);
    try {
      if (isAdded) {
        const data = await wishlistService.getWishlist();
        const item = (data.items ?? []).find(i => i.productId === productId);
        if (item) {
          await wishlistService.removeItem(item.wishlistItemId);
        }
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
        showToast(t('toast.deleted_success'), 'success');
      } else {
        await wishlistService.addToWishlist(productId);
        setWishlistIds((prev) => new Set(prev).add(productId));
        showToast(t('toast.saved_success'), 'success');
      }
    } catch (err) {
      showToast(err?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    let connection = null;

    const fetchSellerData = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await profileService.getSellerProfile(sellerId);
        setSeller(data);
      } catch (err) {
        setError(typeof err.response?.data === 'string' ? err.response.data : (err.response?.data?.message || t('common.error_occurred')));
      } finally {
        setLoading(false);
      }
    };

    if (sellerId) {
      fetchSellerData();
      connection = createSellerHubConnection(sellerId, (payload) => {
        setSeller((current) => {
          if (!current) return current;

          const followerId = payload?.followerId ?? payload?.FollowerId;
          const isFollowing = payload?.isFollowing ?? payload?.IsFollowing;
          const followersCount = payload?.followersCount ?? payload?.FollowersCount;
          const nextFollowersCount = Number.isFinite(Number(followersCount))
            ? Number(followersCount)
            : current.followersCount;
          const isOwnFollowEvent = Boolean(followerId && user && followerId === user.userId);

          return {
            ...current,
            followersCount: Math.max(0, nextFollowersCount),
            isFollowing: isOwnFollowEvent && typeof isFollowing === 'boolean'
              ? isFollowing
              : current.isFollowing,
          };
        });
      });
    }

    return () => {
      if (connection) {
        connection.stop().catch(() => {});
      }
    };
  }, [sellerId, user, t]);

  useEffect(() => {
    const fetchSellerProducts = async () => {
      if (!sellerId) return;
      setProductsLoading(true);
      try {
        const queryStatus = productStatus !== '' ? productStatus : (activeTab === 'auction' ? 'Ready' : undefined);
        const res = await productService.getSellerProducts(sellerId, {
          page: productPage,
          pageSize: 8,
          status: queryStatus,
        });
        setSellerProducts(res.items || []);
        setProductsTotal(res.totalItems || 0);
        setTotalPages(res.totalPages || 1);
      } catch {
        setSellerProducts([]);
        setProductsTotal(0);
        setTotalPages(1);
      } finally {
        setProductsLoading(false);
      }
    };

    fetchSellerProducts();
  }, [sellerId, productPage, productStatus, activeTab]);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!sellerId || activeTab !== 'reviews') return;
      setReviewsLoading(true);
      try {
        let res;
        try {
          res = await reviewService.getPublicSellerReviews(sellerId, {
            page: reviewPage,
            pageSize: 5,
          });
        } catch {
          res = await reviewService.getSellerReviews(sellerId, {
            page: reviewPage,
            pageSize: 5,
          });
        }

        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const cleanItems = items.filter((review) => {
          const isApprovedReport = Boolean(
            review.isReportApproved ||
            review.IsReportApproved ||
            review.isRemoved ||
            review.IsRemoved ||
            ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(review.latestReportStatus?.toLowerCase()) ||
            ['hidden', 'removed', 'deleted'].includes(review.status?.toLowerCase())
          );
          return !isApprovedReport;
        });

        setSellerReviews(cleanItems);
        setReviewTotalItems(cleanItems.length);
        setReviewTotalPages(Math.max(1, Math.ceil(cleanItems.length / 5)));
      } catch {
        setSellerReviews([]);
        setReviewTotalItems(0);
        setReviewTotalPages(1);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
  }, [sellerId, activeTab, reviewPage]);

  useEffect(() => {
    const fetchActiveReviewSummary = async () => {
      if (!sellerId) return;
      try {
        let res;
        try {
          res = await reviewService.getPublicSellerReviews(sellerId, { pageSize: 1000 });
        } catch {
          res = await reviewService.getSellerReviews(sellerId, { pageSize: 1000 });
        }

        const items = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
        const activeItems = items.filter((review) => {
          const normStatus = (review?.latestReportStatus || '').toLowerCase();
          const isApproved = Boolean(
            review?.isReportApproved ||
            review?.IsReportApproved ||
            review?.isRemoved ||
            review?.IsRemoved ||
            ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(normStatus) ||
            ['hidden', 'removed', 'deleted'].includes(review?.status?.toLowerCase())
          );
          return !isApproved;
        });

        const activeCount = activeItems.length;
        const totalRating = activeItems.reduce((acc, r) => acc + (Number(r.rating) || 0), 0);
        const avgRating = activeCount > 0 ? totalRating / activeCount : 0;

        const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        activeItems.forEach((r) => {
          const star = Math.round(Number(r.rating || 0));
          if (starCounts[star] !== undefined) {
            starCounts[star] += 1;
          }
        });

        const statsArray = [5, 4, 3, 2, 1].map((star) => ({
          rating: star,
          count: starCounts[star],
          percentage: activeCount > 0 ? Math.round((starCounts[star] / activeCount) * 100) : 0,
        }));

        setActiveReviewSummary({
          reviewCount: activeCount,
          averageRating: avgRating,
          ratingStats: statsArray,
        });
      } catch {
        // quiet fail
      }
    };

    fetchActiveReviewSummary();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="profile-view-page container">
        <div className="profile-view-card skeleton-box">
          <div className="skeleton-avatar"></div>
          <div className="skeleton-line" style={{ width: '40%' }}></div>
          <div className="skeleton-line" style={{ width: '60%' }}></div>
        </div>
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="profile-view-page container">
        <div className="profile-view-card error-card">
          <h2>{t('common.error')}</h2>
          <p>{error || t('seller_dashboard.load_error')}</p>
          <button type="button" className="profile-view-btn outline" onClick={() => navigate(-1)}>
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const handleFollowToggle = async () => {
    if (!user) {
      showToast(t('seller_profile.login_required_chat'), 'warning');
      navigate('/login');
      return;
    }

    if (followRequestInFlightRef.current || followLoading || !seller?.sellerId) return;

    const previousSeller = seller;
    const nextIsFollowing = !previousSeller.isFollowing;

    followRequestInFlightRef.current = true;
    setFollowLoading(true);

    try {
      const result = previousSeller.isFollowing
        ? await profileService.unfollowSeller(previousSeller.sellerId)
        : await profileService.followSeller(previousSeller.sellerId);

      setSeller((current) => ({
        ...current,
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
      }));
      showToast(nextIsFollowing ? t('seller_profile.follow_success') : t('seller_profile.unfollow_success'), 'success');
    } catch (err) {
      setSeller(previousSeller);
      showToast(err?.response?.data || t('seller_profile.follow_error'), 'error');
    } finally {
      followRequestInFlightRef.current = false;
      setFollowLoading(false);
    }
  };

  const handleMessageSeller = async () => {
    if (!user) {
      showToast(t('seller_profile.login_required_chat'), 'warning');
      navigate('/login');
      return;
    }

    if (!seller?.sellerId || isOwnSellerPage) {
      showToast(t('seller_profile.cannot_chat_self'), 'warning');
      return;
    }

    try {
      const room = await chatService.getOrCreateSellerRoom(seller.sellerId);
      if (room?.roomId) {
        navigate(`/chat/${room.roomId}`);
      }
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.error_occurred');
      showToast(String(msg), 'error');
    }
  };

  const isOwnSellerPage = Boolean(
    seller.isOwnSeller ||
    (user && seller && (
      user.userId === seller.sellerId ||
      user.accountId === seller.accountId
    ))
  );
  const canFollowSeller = Boolean(user && seller.isSeller && !isOwnSellerPage && !hasRole(user, 'Admin'));
  const displayReviewCount = activeReviewSummary ? activeReviewSummary.reviewCount : Number(seller.reviewCount || 0);
  const displayAverageRating = activeReviewSummary ? activeReviewSummary.averageRating : Number(seller.averageRating || 0);
  const displayRatingStats = activeReviewSummary ? activeReviewSummary.ratingStats : (seller.ratingStats || []);

  const ratingValue = displayReviewCount && displayAverageRating ? displayAverageRating.toFixed(1) : '-';
  const ratingText = displayReviewCount && displayAverageRating ? `${ratingValue} / 5` : t('seller_profile.no_rating_yet');
  const reviewText = `${displayReviewCount} ${t('seller_profile.reviews_suffix')}`;
  const visibleProductCount = productsTotal || seller.productCount || 0;
  const memberSince = seller.createdAt ? new Date(seller.createdAt).getFullYear() : t('seller_profile.new_seller');
  const locationText = formatAddress(seller.defaultAddress, t);
  const isBuyerViewingSeller = !isOwnSellerPage;

  const handleTabChange = (key, options = {}) => {
    if (key === 'reviews') {
      setReviewPage(1);
    }
    setActiveTab(key);

    if (options.resetProducts) {
      setProductPage(1);
      setProductStatus(key === 'auction' ? 'Ready' : '');
    }
  };

  const renderBuyerShopContent = () => {
    if (activeTab === 'reviews') {
      return (
        <SellerRatingPanel
          seller={{ ...seller, averageRating: displayAverageRating, ratingStats: displayRatingStats }}
          ratingText={ratingText}
          reviewText={reviewText}
          reviews={sellerReviews}
          loadingReviews={reviewsLoading}
          reviewPage={reviewPage}
          setReviewPage={setReviewPage}
          reviewTotalPages={reviewTotalPages}
          reviewTotalItems={reviewTotalItems}
        />
      );
    }

    if (activeTab === 'auction') {
      return (
        <SellerProductGrid
          products={sellerProducts}
          loading={productsLoading}
          total={visibleProductCount}
          compact
          hideStatusTabs
          productStatus="Ready"
          setProductStatus={(s) => { setProductStatus(s); setProductPage(1); }}
          productPage={productPage}
          setProductPage={setProductPage}
          totalPages={totalPages}
          wishlistIds={wishlistIds}
          togglingId={togglingId}
          onWishlistToggle={handleWishlistToggle}
        />
      );
    }

    return <SellerProductGrid products={sellerProducts} loading={productsLoading} total={visibleProductCount} productStatus={productStatus} setProductStatus={(s) => { setProductStatus(s); setProductPage(1); }} productPage={productPage} setProductPage={setProductPage} totalPages={totalPages} wishlistIds={wishlistIds} togglingId={togglingId} onWishlistToggle={handleWishlistToggle} />;
  };

  const renderTabContent = () => {
    if (activeTab === 'items') {
      return <SellerProductGrid products={sellerProducts} loading={productsLoading} total={visibleProductCount} compact productStatus={productStatus} setProductStatus={(s) => { setProductStatus(s); setProductPage(1); }} productPage={productPage} setProductPage={setProductPage} totalPages={totalPages} wishlistIds={wishlistIds} togglingId={togglingId} onWishlistToggle={handleWishlistToggle} />;
    }

    if (activeTab === 'reviews') {
      return (
        <SellerRatingPanel
          seller={{ ...seller, averageRating: displayAverageRating, ratingStats: displayRatingStats }}
          ratingText={ratingText}
          reviewText={reviewText}
          compact
          reviews={sellerReviews}
          loadingReviews={reviewsLoading}
          reviewPage={reviewPage}
          setReviewPage={setReviewPage}
          reviewTotalPages={reviewTotalPages}
          reviewTotalItems={reviewTotalItems}
        />
      );
    }

    if (activeTab === 'contact') {
      return (
        <div className="seller-tab-panel profile-view-grid seller-tab-grid">
          <article className="profile-view-card">
            <h2>{t('seller_profile.contact')}</h2>
            <div className="profile-view-list">
              <div>
                <span>Email</span>
                <strong>{seller.email || t('common.not_available')}</strong>
              </div>
              <div>
                <span>{t('seller_profile.phone')}</span>
                <strong>{seller.phone || t('common.not_available')}</strong>
              </div>
              <div>
                <span>{t('seller_profile.location')}</span>
                <strong>{locationText}</strong>
              </div>
            </div>
          </article>
          <article className="profile-view-card">
            <h2>{t('seller_profile.seller_reference')}</h2>
            <div className="profile-view-list">
              <div>
                <span>{t('seller_profile.seller_code')}</span>
                <strong>{seller.sellerId}</strong>
              </div>
              <div>
                <span>{t('seller_profile.account_code')}</span>
                <strong>{seller.accountId || t('common.not_available')}</strong>
              </div>
            </div>
          </article>
        </div>
      );
    }

    return (
      <div className="seller-tab-panel profile-view-grid seller-tab-grid">
        <article className="profile-view-card seller-about-card">
          <h2>{t('seller_profile.about_shop')}</h2>
          <p>
            {t('seller_profile.about_shop_desc', { name: seller.username || 'Seller', year: memberSince })}
          </p>
          <div className="seller-trust-row">
            <span><span className="material-symbols-outlined">verified</span> {t('seller_profile.verified_profile')}</span>
            <span><span className="material-symbols-outlined">eco</span> {t('seller_profile.retrade_seller')}</span>
          </div>
        </article>
        <article className="profile-view-card">
          <h2>{t('seller_profile.shop_snapshot')}</h2>
          <div className="profile-view-list">
            <div>
              <span>{t('seller_profile.followers')}</span>
              <strong>{seller.followersCount}</strong>
            </div>
            <div>
              <span>{t('seller_profile.following')}</span>
              <strong>{seller.followingCount}</strong>
            </div>
            <div>
              <span>{t('seller_profile.relationship')}</span>
              <strong>{isOwnSellerPage ? t('seller_profile.your_shop') : seller.isFollowing ? t('seller_profile.following') : t('seller_profile.not_following')}</strong>
            </div>
          </div>
        </article>
      </div>
    );
  };

  if (isBuyerViewingSeller) {
    return (
      <div className="buyer-shop-page container animate-fade-in">
        <section className="buyer-shop-header">
          <div className="buyer-shop-identity">
            <div className="buyer-shop-avatar">
              {seller.avatarUrl ? <img src={seller.avatarUrl} alt={getDisplayName(seller)} /> : getInitials(seller)}
              <span className="buyer-shop-verified">
                <span className="material-symbols-outlined">check</span>
              </span>
            </div>

            <div className="buyer-shop-title">
              <h1>{getDisplayName(seller)}</h1>
              <div className="buyer-shop-meta">
                <span><span className="material-symbols-outlined">location_on</span>{locationText}</span>
                <span><span className="material-symbols-outlined">star</span>{ratingText}</span>
              </div>
              <div className="buyer-shop-actions">
                {canFollowSeller && (
                  <button className={`buyer-follow-btn ${seller.isFollowing ? 'following' : ''}`} onClick={handleFollowToggle} disabled={followLoading}>
                    <span className="material-symbols-outlined">{seller.isFollowing ? 'person_remove' : 'person_add'}</span>
                    {followLoading ? t('seller_profile.updating') : seller.isFollowing ? t('seller_profile.unfollow') : t('seller_profile.follow')}
                  </button>
                )}
                <button className="buyer-message-btn" type="button" onClick={handleMessageSeller}>
                  <span className="material-symbols-outlined">mail</span>
                  {t('seller_profile.message')}
                </button>
              </div>
            </div>
          </div>

          <div className="buyer-shop-kpis">
            <div>
              <strong>{seller.followersCount}</strong>
              <span>{t('seller_profile.followers')}</span>
            </div>
            <div>
              <strong>{ratingValue}</strong>
              <span>{t('seller_profile.rating')}</span>
            </div>
            <div>
              <strong>{displayReviewCount}</strong>
              <span>{t('seller_profile.reviews_count')}</span>
            </div>
          </div>
        </section>

        <section className="buyer-shop-tabs">
          {[
            ['items', t('seller_profile.listings')],
            ['auction', t('seller_profile.live_auctions')],
            ['reviews', t('seller_profile.reviews_count')],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`buyer-shop-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => handleTabChange(key, { resetProducts: true })}
            >
              {label}
            </button>
          ))}
        </section>

        {renderBuyerShopContent()}
      </div>
    );
  }

  return (
    <div className="profile-view-page seller-shop-page container animate-fade-in">
      <section className="seller-shop-hero">
        <div className="seller-shop-cover" aria-hidden="true"></div>
        <div className="seller-shop-profile">
          <div className="seller-shop-avatar">
            {seller.avatarUrl ? <img src={seller.avatarUrl} alt={getDisplayName(seller)} /> : getInitials(seller)}
            <span className="seller-verified-dot">
              <span className="material-symbols-outlined">check</span>
            </span>
          </div>
          <div className="seller-shop-heading">
            <span className="seller-badge">{isOwnSellerPage ? t('seller_profile.your_seller_profile') : seller.isSeller ? t('seller_profile.trusted_seller') : t('seller_profile.member_profile')}</span>
            <h1>{getDisplayName(seller)}</h1>
            <div className="seller-shop-meta">
              <span><span className="material-symbols-outlined">location_on</span>{locationText}</span>
              <span><span className="material-symbols-outlined">star</span>{ratingText}</span>
            </div>
            <p className="seller-hero-desc">
              {t('seller_profile.about_shop_desc', { name: seller.username || 'Seller', year: memberSince })}
            </p>
          </div>
        </div>
        <div className="seller-shop-right">
          <div className="seller-shop-actions">
            {canFollowSeller && (
              <button className={`profile-follow-btn ${seller.isFollowing ? 'following' : ''}`} onClick={handleFollowToggle} disabled={followLoading}>
                <span className="material-symbols-outlined">{seller.isFollowing ? 'person_remove' : 'person_add'}</span>
                {followLoading ? t('seller_profile.updating') : seller.isFollowing ? t('seller_profile.unfollow') : t('seller_profile.follow')}
              </button>
            )}
            {!isOwnSellerPage && (
              <button className="seller-message-btn" type="button" onClick={handleMessageSeller}>
                <span className="material-symbols-outlined">mail</span>
                {t('seller_profile.message')}
              </button>
            )}
            {isOwnSellerPage && (
              <Link to="/profile" className="seller-message-btn owner-action">
                <span className="material-symbols-outlined">manage_accounts</span>
                {t('seller_profile.edit_profile')}
              </Link>
            )}
          </div>

          <div className="seller-hero-stats">
            <div className="seller-hero-stat">
              <strong>{visibleProductCount}</strong>
              <span>{t('seller_profile.listings')}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{seller.followersCount}</strong>
              <span>{t('seller_profile.followers')}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{seller.followingCount}</strong>
              <span>{t('seller_profile.following')}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{ratingValue}</strong>
              <span>{t('seller_profile.rating')}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{displayReviewCount}</strong>
              <span>{t('seller_profile.reviews_count')}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="seller-shop-tabs">
        <div className="seller-tab-list" role="tablist" aria-label="Seller sections">
          {[
            ['items', t('seller_profile.listings')],
            ['reviews', t('seller_profile.reviews_count')],
            ['contact', t('seller_profile.contact')],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`seller-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => handleTabChange(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {renderTabContent()}
      </section>
    </div>
  );
}

function SellerProductGrid({ products, loading, total, compact = false, hideStatusTabs = false, productStatus, setProductStatus, productPage, setProductPage, totalPages, wishlistIds, togglingId, onWishlistToggle }) {
  const { t } = useLanguage();
  const statusTabs = [
    { key: '', label: t('common.all') },
    { key: 'Accepted', label: t('my_products.tab_approved') },
    { key: 'Ready', label: t('my_products.tab_auction_ready') },
    { key: 'Sold', label: t('seller_dashboard.status_sold') },
  ];

  return (
    <div className={`seller-products-section ${compact ? 'compact' : ''}`}>
      {!hideStatusTabs && (
        <div className="seller-product-status-tabs">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`seller-status-tab ${productStatus === tab.key ? 'active' : ''}`}
              onClick={() => setProductStatus(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="seller-profile-products">
          {[...Array(6)].map((_, index) => (
            <div className="seller-profile-product-card skeleton" key={index}>
              <span></span>
              <div></div>
            </div>
          ))}
        </div>
      ) : !products.length ? (
        <div className="buyer-shop-empty">
          <span className="material-symbols-outlined">inventory_2</span>
          <h2>{total ? `${total} listings` : t('seller_profile.no_products')}</h2>
          <p>{t('seller_profile.no_products_desc')}</p>
        </div>
      ) : (
        <>
          <div className="seller-profile-products">
            {products.map((product) => (
              <SellerProductCard key={product.productId} product={product} wishlistIds={wishlistIds} togglingId={togglingId} onWishlistToggle={onWishlistToggle} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="seller-products-pagination">
              <button
                type="button"
                disabled={productPage <= 1}
                onClick={() => setProductPage(productPage - 1)}
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  type="button"
                  className={productPage === i + 1 ? 'active' : ''}
                  onClick={() => setProductPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={productPage >= totalPages}
                onClick={() => setProductPage(productPage + 1)}
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SellerProductCard({ product, wishlistIds, togglingId, onWishlistToggle }) {
  const { t, formatCurrency } = useLanguage();
  const isWishlist = wishlistIds?.has(product.productId) ?? false;
  const isOutOfStock = isProductUnavailable(product);

  return (
    <div className={`seller-profile-product-card-wrapper ${isOutOfStock ? 'out-of-stock' : ''}`}>
      <Link to={`/product/${product.productId}`} className="seller-profile-product-card">
        <div className="seller-profile-product-media">
          {product.mainImageUrl ? (
            <img src={product.mainImageUrl} alt={product.name || 'Seller product'} loading="lazy" />
          ) : (
            <span className="material-symbols-outlined">inventory_2</span>
          )}
          {product.condition ? <em>{product.condition}</em> : null}
          {isOutOfStock ? <strong className="seller-product-soldout-label">{t('product.out_of_stock')}</strong> : null}
        </div>

        <div className="seller-profile-product-body">
          <span>{product.categoryName || t('common.none')}</span>
          <strong>{product.name || t('nav.product')}</strong>
          <div>
            <b>{product.price != null ? formatCurrency(product.price) : t('nav.auction')}</b>
            <small className={isOutOfStock ? 'seller-product-stock-badge out-of-stock' : ''}>
              {isOutOfStock ? t('product.out_of_stock') : t('seller_dashboard.stock_count', { count: product.stockQuantity ?? 0 })}
            </small>
          </div>
        </div>
      </Link>

      <div className="seller-product-quick-actions">
        <button
          type="button"
          className={`quick-action-btn wishlist-btn ${isWishlist ? 'active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onWishlistToggle(product);
          }}
          disabled={togglingId === product.productId || (!isWishlist && isOutOfStock)}
          title={isOutOfStock && !isWishlist ? t('product.out_of_stock') : t('product.add_to_wishlist')}
        >
          <span className="material-symbols-outlined">
            {isWishlist ? 'favorite' : 'favorite'}
          </span>
        </button>
      </div>
    </div>
  );
}

function SellerRatingPanel({
  seller,
  ratingText,
  reviewText,
  compact = false,
  reviews = [],
  loadingReviews = false,
  reviewPage = 1,
  setReviewPage = () => {},
  reviewTotalPages = 1,
  reviewTotalItems = 0,
}) {
  const { t } = useLanguage();
  const [selectedReview, setSelectedReview] = useState(null);
  const stats = seller.ratingStats?.length
    ? seller.ratingStats
    : [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0, percentage: 0 }));
  const firstReview = reviewTotalItems === 0 ? 0 : (reviewPage - 1) * 5 + 1;
  const lastReview = Math.min(reviewPage * 5, reviewTotalItems);
  const openReviewPreview = (review) => setSelectedReview(review);
  const closeReviewPreview = () => setSelectedReview(null);

  return (
    <div className={`seller-public-reviews ${compact ? 'compact' : ''}`}>
      <div className={`seller-rating-panel ${compact ? 'compact' : ''}`}>
        <section className="seller-rating-overview">
          <span className="material-symbols-outlined">star</span>
          <h2>{ratingText}</h2>
          <StarMeter value={seller.averageRating || 0} />
          <p>{reviewText}</p>
        </section>

        <section className="seller-rating-bars">
          {stats.map((stat) => (
            <div className="seller-rating-row" key={stat.rating}>
              <span>{stat.rating}</span>
              <span className="material-symbols-outlined">star</span>
              <div>
                <i style={{ width: `${Math.min(100, Math.max(0, stat.percentage || 0))}%` }}></i>
              </div>
              <strong>{stat.count}</strong>
            </div>
          ))}
        </section>
      </div>

      <section className="seller-public-review-list">
        <div className="seller-public-review-head">
          <h2>{t('product.reviews')}</h2>
          <span>{`${firstReview}-${lastReview} / ${reviewTotalItems}`}</span>
        </div>

        {loadingReviews ? (
          <div className="seller-public-review-loading">
            <span className="btn-spinner"></span>
            <p>{t('common.loading')}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="seller-public-review-empty">
            <span className="material-symbols-outlined">rate_review</span>
            <h2>{t('product.no_reviews')}</h2>
            <p>{t('seller_profile.no_products_desc')}</p>
          </div>
        ) : (
          <>
            <div className="seller-public-review-items">
              {reviews.map((review) => {
                const isApprovedReport = Boolean(
                  review.isReportApproved ||
                  review.IsReportApproved ||
                  review.isRemoved ||
                  review.IsRemoved ||
                  ['accepted', 'approved', 'resolved', 'accept review', 'accept buyer', 'accept seller'].includes(review.latestReportStatus?.toLowerCase()) ||
                  ['hidden', 'removed', 'deleted'].includes(review.status?.toLowerCase())
                );
                if (isApprovedReport) return null;

                return (
                  <article
                    className="seller-public-review-card"
                    key={review.reviewId}
                    role="button"
                    tabIndex={0}
                    onClick={() => openReviewPreview(review)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openReviewPreview(review);
                      }
                    }}
                  >
                  <div className="seller-public-review-avatar">
                    {getReviewInitials(review.reviewerName)}
                  </div>
                  <div>
                    <div className="seller-public-review-top">
                      <div>
                        <strong>{review.reviewerName || 'Buyer'}</strong>
                        <span>{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <StarMeter value={review.rating || 0} />
                    </div>
                    <p>{review.comment || ''}</p>
                    <div className="seller-public-review-product">
                      <span className="seller-public-review-product-img">
                        {review.productImageUrl ? (
                          <img src={review.productImageUrl} alt={review.productName || 'Reviewed product'} loading="lazy" />
                        ) : (
                          <span className="material-symbols-outlined">inventory_2</span>
                        )}
                      </span>
                      <span className="seller-public-review-product-name">{review.productName || 'Reviewed product'}</span>
                      {review.orderCode ? <em>{review.orderCode}</em> : null}
                    </div>
                  </div>
                </article>
              );
            })}
            </div>

            {reviewTotalPages > 1 && (
              <div className="seller-public-review-pagination">
                <button
                  type="button"
                  disabled={reviewPage <= 1}
                  onClick={() => setReviewPage((page) => Math.max(1, page - 1))}
                >
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
                {Array.from({ length: reviewTotalPages }).map((_, index) => (
                  <button
                    key={index + 1}
                    type="button"
                    className={reviewPage === index + 1 ? 'active' : ''}
                    onClick={() => setReviewPage(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={reviewPage >= reviewTotalPages}
                  onClick={() => setReviewPage((page) => Math.min(reviewTotalPages, page + 1))}
                >
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {selectedReview && (
        <div className="seller-public-review-modal-backdrop" role="presentation" onMouseDown={closeReviewPreview}>
          <section
            className="seller-public-review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-public-review-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button type="button" className="seller-public-review-modal-close" onClick={closeReviewPreview} aria-label={t('common.close')}>
              <span className="material-symbols-outlined">close</span>
            </button>

            <div className="seller-public-review-modal-media">
              {selectedReview.productImageUrl ? (
                <img src={selectedReview.productImageUrl} alt={selectedReview.productName || 'Reviewed product'} />
              ) : (
                <span className="material-symbols-outlined">inventory_2</span>
              )}
            </div>

            <div className="seller-public-review-modal-body">
              <span className="seller-public-review-modal-eyebrow">{t('nav.product')}</span>
              <h2 id="seller-public-review-modal-title">{selectedReview.productName || 'Reviewed product'}</h2>
              <div className="seller-public-review-modal-meta">
                <strong>{selectedReview.reviewerName || 'Buyer'}</strong>
                <span>{formatReviewDate(selectedReview.createdAt)}</span>
                {selectedReview.orderCode ? <span>{selectedReview.orderCode}</span> : null}
              </div>
              <StarMeter value={selectedReview.rating || 0} />
              <p>{selectedReview.comment || ''}</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StarMeter({ value }) {
  const rounded = Math.round(Number(value || 0));

  return (
    <div className="seller-star-meter" aria-label={`${value || 0} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={`material-symbols-outlined ${star <= rounded ? 'filled' : ''}`}>star</span>
      ))}
    </div>
  );
}

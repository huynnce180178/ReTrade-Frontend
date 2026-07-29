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
const currencyFormatter = new Intl.NumberFormat('vi-VN');

const formatAddress = (address, language) => {
  if (!address) return language === 'vi' ? 'Chưa có địa chỉ mặc định' : 'No default address yet';
  const parts = [address.street, address.wardCode, address.districtId && `Quận ${address.districtId}`, address.provinceId && `Tỉnh/TP ${address.provinceId}`].filter(Boolean);
  return parts.length ? parts.join(', ') : (language === 'vi' ? 'Chưa có địa chỉ mặc định' : 'No default address yet');
};

const hasRole = (user, roleName) => {
  return (user?.roles || []).some((role) => String(role).trim().toLowerCase() === roleName.toLowerCase());
};

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
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language, formatCurrency, formatDate } = useLanguage();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
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

  const handleWishlistToggle = async (productId, sellerId) => {
    if (!user) {
      showToast('Please sign in to use the wishlist.', 'error');
      return;
    }
    if (sellerId === user.userId || sellerId === user.accountId) {
      showToast('You cannot add your own product to your wishlist.', 'error');
      return;
    }
    setTogglingId(productId);
    const isAdded = wishlistIds.has(productId);
    try {
      if (isAdded) {
        const data = await wishlistService.getWishlist();
        const item = (data.items ?? []).find(i => i.productId === productId);
        if (item) {
          await wishlistService.removeItem(item.wishlistItemId);
          setWishlistIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
          showToast('Removed from wishlist.', 'success');
        }
      } else {
        await wishlistService.addToWishlist(productId);
        setWishlistIds(prev => new Set([...prev, productId]));
        showToast('Added to wishlist!', 'success');
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Something went wrong.';
      showToast(msg, 'error');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    if (authLoading) return;

    const loadSeller = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await profileService.getSellerInformation(sellerId);
        setSeller(data);
      } catch (err) {
        setError(err?.response?.data || 'Seller not found.');
      } finally {
        setLoading(false);
      }
    };

    loadSeller();
  }, [sellerId, authLoading, user?.accountId]);

  useEffect(() => {
    const resolvedSellerId = seller?.sellerId;
    if (!resolvedSellerId) return undefined;

    const connection = createSellerHubConnection();
    let cancelled = false;

    const startConnection = async () => {
      try {
        connection.on('SellerFollowChanged', (result) => {
          if (!result || result.sellerId !== resolvedSellerId) return;

          setSeller((current) => {
            if (!current) return current;
            const isCurrentUserFollowEvent = result.followerId && result.followerId === user?.userId;
            const nextSeller = {
              ...current,
              followersCount: result.followersCount,
            };
            if (isCurrentUserFollowEvent) {
              nextSeller.isFollowing = result.isFollowing;
            }
            return nextSeller;
          });
        });

        await connection.start();
        if (!cancelled) {
          await connection.invoke('JoinSellerGroup', resolvedSellerId);
        }
      } catch (err) {
        console.error('Failed to connect seller realtime hub:', err);
      }
    };

    startConnection();

    return () => {
      cancelled = true;
      connection.off('SellerFollowChanged');
      connection.stop().catch(() => {});
    };
  }, [seller?.sellerId, user?.userId]);

  useEffect(() => {
    const resolvedSellerId = seller?.sellerId;
    if (!resolvedSellerId) return undefined;

    let cancelled = false;

    const loadSellerProducts = async () => {
      setProductsLoading(true);
      try {
        const params = {
          SellerId: resolvedSellerId,
          Page: productPage,
          PageSize: 6,
          SortBy: 'newest',
        };
        if (productStatus) params.Status = productStatus;
        const data = await productService.getAll(params);

        if (!cancelled) {
          setSellerProducts(data?.items || []);
          setProductsTotal(Number(data?.totalItems || 0));
          setTotalPages(Number(data?.totalPages || 1));
        }
      } catch (err) {
        if (!cancelled) {
          setSellerProducts([]);
          setProductsTotal(0);
          setTotalPages(1);
          showToast(err?.response?.data || 'Failed to load seller products.', 'error');
        }
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };

    loadSellerProducts();

    return () => {
      cancelled = true;
    };
  }, [seller?.sellerId, productStatus, productPage, showToast]);

  useEffect(() => {
    const resolvedSellerId = seller?.sellerId;
    if (!resolvedSellerId || activeTab !== 'reviews') return undefined;

    let cancelled = false;

    const loadSellerReviews = async () => {
      setReviewsLoading(true);
      try {
        const data = await reviewService.getPublicSellerReviews(resolvedSellerId, {
          Page: reviewPage,
          PageSize: 5,
          SortBy: 'newest',
        });

        if (!cancelled) {
          setSellerReviews(data?.items || []);
          setReviewTotalItems(Number(data?.totalItems || 0));
          setReviewTotalPages(Math.max(1, Number(data?.totalPages || 1)));
        }
      } catch (err) {
        if (!cancelled) {
          setSellerReviews([]);
          setReviewTotalItems(0);
          setReviewTotalPages(1);
          showToast(err?.response?.data || 'Failed to load seller reviews.', 'error');
        }
      } finally {
        if (!cancelled) setReviewsLoading(false);
      }
    };

    loadSellerReviews();

    return () => {
      cancelled = true;
    };
  }, [activeTab, reviewPage, seller?.sellerId, showToast]);

  const handleFollowToggle = async () => {
    if (!seller || followLoading || !canFollowSeller) return;

    const previousSeller = seller;
    const nextIsFollowing = !seller.isFollowing;
    const nextFollowersCount = Math.max(0, (seller.followersCount || 0) + (nextIsFollowing ? 1 : -1));

    setSeller((current) => ({
      ...current,
      isFollowing: nextIsFollowing,
      followersCount: nextFollowersCount,
    }));
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
      showToast(language === 'vi' ? (nextIsFollowing ? 'Theo dõi người bán thành công!' : 'Đã bỏ theo dõi người bán!') : (result.message || 'Seller follow status updated.'), 'success');
    } catch (err) {
      setSeller(previousSeller);
      showToast(err?.response?.data || (language === 'vi' ? 'Không thể cập nhật trạng thái theo dõi.' : 'Failed to update follow status.'), 'error');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleMessageSeller = async () => {
    if (!user) {
      showToast(language === 'vi' ? 'Vui lòng đăng nhập để nhắn tin với người bán.' : 'Please sign in to message this seller.', 'warning');
      navigate('/login');
      return;
    }

    if (!seller?.sellerId || isOwnSellerPage) {
      showToast(language === 'vi' ? 'Bạn không thể tự nhắn tin cho hồ sơ của mình.' : 'You cannot message your own seller profile.', 'warning');
      return;
    }

    try {
      const room = await chatService.getOrCreateSellerRoom(seller.sellerId);
      if (room?.roomId) {
        navigate(`/chat/${room.roomId}`);
      }
    } catch (err) {
      const msg = err.response?.data || err.message || 'Failed to open chat.';
      showToast(String(msg), 'error');
    }
  };

  if (loading) {
    return (
      <div className="profile-view-state">
        <span className="btn-spinner"></span>
        <p>Loading seller...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-view-state">
        <span className="material-symbols-outlined profile-view-state-icon">storefront</span>
        <h2>{error}</h2>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    );
  }

  const isOwnSellerPage = Boolean(
    seller.isOwnSeller ||
    (user && seller && (
      user.userId === seller.sellerId ||
      user.accountId === seller.accountId
    ))
  );
  const canFollowSeller = Boolean(user && seller.isSeller && !isOwnSellerPage && !hasRole(user, 'Admin'));
  const reviewCount = Number(seller.reviewCount || 0);
  const ratingValue = reviewCount && seller.averageRating ? seller.averageRating.toFixed(1) : '-';
  const ratingText = reviewCount && seller.averageRating ? `${ratingValue} / 5` : (language === 'vi' ? 'Chưa có đánh giá' : 'No rating yet');
  const reviewText = `${reviewCount} ${language === 'vi' ? 'đánh giá' : (reviewCount === 1 ? 'review' : 'reviews')}`;
  const visibleProductCount = productsTotal || seller.productCount || 0;
  const memberSince = seller.createdAt ? new Date(seller.createdAt).getFullYear() : (language === 'vi' ? 'Người bán mới' : 'New seller');
  const locationText = formatAddress(seller.defaultAddress, language);
  const isBuyerViewingSeller = !isOwnSellerPage;

  const renderBuyerShopContent = () => {
    if (activeTab === 'reviews') {
      return (
        <SellerRatingPanel
          seller={seller}
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
        <div className="buyer-shop-empty">
          <span className="material-symbols-outlined">gavel</span>
          <h2>{language === 'vi' ? 'Đấu giá trực tiếp' : 'Live Auctions'}</h2>
          <p>{language === 'vi' ? 'Các phiên đấu giá từ người bán này sẽ hiển thị ở đây khi có sản phẩm đấu giá.' : 'Active auctions from this seller will appear here when auction listings are connected.'}</p>
        </div>
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
          seller={seller}
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
            <h2>{language === 'vi' ? 'Liên hệ' : 'Contact'}</h2>
            <div className="profile-view-list">
              <div>
                <span>Email</span>
                <strong>{seller.email || (language === 'vi' ? 'Chưa cập nhật' : 'Not available')}</strong>
              </div>
              <div>
                <span>{language === 'vi' ? 'Số điện thoại' : 'Phone'}</span>
                <strong>{seller.phone || (language === 'vi' ? 'Chưa cập nhật' : 'Not available')}</strong>
              </div>
              <div>
                <span>{language === 'vi' ? 'Địa chỉ' : 'Location'}</span>
                <strong>{locationText}</strong>
              </div>
            </div>
          </article>
          <article className="profile-view-card">
            <h2>{language === 'vi' ? 'Mã định danh' : 'Seller Reference'}</h2>
            <div className="profile-view-list">
              <div>
                <span>Mã người bán</span>
                <strong>{seller.sellerId}</strong>
              </div>
              <div>
                <span>Mã tài khoản</span>
                <strong>{seller.accountId || (language === 'vi' ? 'Chưa cập nhật' : 'Not available')}</strong>
              </div>
            </div>
          </article>
        </div>
      );
    }

    return (
      <div className="seller-tab-panel profile-view-grid seller-tab-grid">
        <article className="profile-view-card seller-about-card">
          <h2>{language === 'vi' ? 'Giới thiệu Cửa hàng' : 'About Shop'}</h2>
          <p>
            {seller.username || 'This seller'} {language === 'vi' ? `đã tham gia ReTrade từ năm ${memberSince}, cung cấp các sản phẩm đã qua sử dụng chất lượng.` : `has been part of ReTrade since ${memberSince}, offering curated second-hand listings with a focus on trustworthy trading.`}
          </p>
          <div className="seller-trust-row">
            <span><span className="material-symbols-outlined">verified</span> {language === 'vi' ? 'Hồ sơ đã xác minh' : 'Verified profile'}</span>
            <span><span className="material-symbols-outlined">eco</span> {language === 'vi' ? 'Người bán ReTrade' : 'ReTrade seller'}</span>
          </div>
        </article>
        <article className="profile-view-card">
          <h2>{language === 'vi' ? 'Tổng quan Cửa hàng' : 'Shop Snapshot'}</h2>
          <div className="profile-view-list">
            <div>
              <span>{language === 'vi' ? 'Người theo dõi' : 'Followers'}</span>
              <strong>{seller.followersCount}</strong>
            </div>
            <div>
              <span>{language === 'vi' ? 'Đang theo dõi' : 'Following'}</span>
              <strong>{seller.followingCount}</strong>
            </div>
            <div>
              <span>{language === 'vi' ? 'Mối quan hệ' : 'Relationship'}</span>
              <strong>{isOwnSellerPage ? (language === 'vi' ? 'Cửa hàng của bạn' : 'Your shop') : seller.isFollowing ? (language === 'vi' ? 'Đang theo dõi' : 'Following') : (language === 'vi' ? 'Chưa theo dõi' : 'Not following')}</strong>
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
                    {followLoading ? (language === 'vi' ? 'Đang cập nhật...' : 'Updating...') : seller.isFollowing ? (language === 'vi' ? 'Bỏ theo dõi' : 'Unfollow') : (language === 'vi' ? 'Theo dõi' : 'Follow')}
                  </button>
                )}
                <button className="buyer-message-btn" type="button" onClick={handleMessageSeller}>
                  <span className="material-symbols-outlined">mail</span>
                  {language === 'vi' ? 'Nhắn tin' : 'Message'}
                </button>
              </div>
            </div>
          </div>

          <div className="buyer-shop-kpis">
            <div>
              <strong>{seller.followersCount}</strong>
              <span>{language === 'vi' ? 'Người theo dõi' : 'Followers'}</span>
            </div>
            <div>
              <strong>{ratingValue}</strong>
              <span>{language === 'vi' ? 'Đánh giá' : 'Rating'}</span>
            </div>
            <div>
              <strong>{reviewCount}</strong>
              <span>{language === 'vi' ? 'Lượt đánh giá' : 'Reviews'}</span>
            </div>
          </div>
        </section>

        <section className="buyer-shop-tabs">
          {[
            ['items', language === 'vi' ? 'Sản phẩm' : 'Product'],
            ['auction', language === 'vi' ? 'Đấu giá trực tiếp' : 'Live Auctions'],
            ['reviews', language === 'vi' ? 'Đánh giá' : 'Reviews'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`buyer-shop-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
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
            <span className="seller-badge">{isOwnSellerPage ? (language === 'vi' ? 'Hồ sơ người bán của bạn' : 'Your Seller Profile') : seller.isSeller ? (language === 'vi' ? 'Người bán uy tín' : 'Trusted Seller') : (language === 'vi' ? 'Hồ sơ thành viên' : 'Member Profile')}</span>
            <h1>{getDisplayName(seller)}</h1>
            <div className="seller-shop-meta">
              <span><span className="material-symbols-outlined">location_on</span>{locationText}</span>
              <span><span className="material-symbols-outlined">star</span>{ratingText}</span>
            </div>
            <p className="seller-hero-desc">
              {seller.username || 'This seller'} {language === 'vi' ? `đã tham gia ReTrade từ năm ${memberSince}, cung cấp các sản phẩm đã qua sử dụng chất lượng.` : `has been part of ReTrade since ${memberSince}, offering curated second-hand listings with a focus on trustworthy trading.`}
            </p>
          </div>
        </div>
        <div className="seller-shop-right">
          <div className="seller-shop-actions">
            {canFollowSeller && (
              <button className={`profile-follow-btn ${seller.isFollowing ? 'following' : ''}`} onClick={handleFollowToggle} disabled={followLoading}>
                <span className="material-symbols-outlined">{seller.isFollowing ? 'person_remove' : 'person_add'}</span>
                {followLoading ? (language === 'vi' ? 'Đang cập nhật...' : 'Updating...') : seller.isFollowing ? (language === 'vi' ? 'Bỏ theo dõi' : 'Unfollow') : (language === 'vi' ? 'Theo dõi' : 'Follow')}
              </button>
            )}
            {!isOwnSellerPage && (
              <button className="seller-message-btn" type="button" onClick={handleMessageSeller}>
                <span className="material-symbols-outlined">mail</span>
                {language === 'vi' ? 'Nhắn tin' : 'Message'}
              </button>
            )}
            {isOwnSellerPage && (
              <Link to="/profile" className="seller-message-btn owner-action">
                <span className="material-symbols-outlined">manage_accounts</span>
                {language === 'vi' ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}
              </Link>
            )}
          </div>

          <div className="seller-hero-stats">
            <div className="seller-hero-stat">
              <strong>{visibleProductCount}</strong>
              <span>{language === 'vi' ? 'Sản phẩm' : 'Listings'}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{seller.followersCount}</strong>
              <span>{language === 'vi' ? 'Người theo dõi' : 'Followers'}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{seller.followingCount}</strong>
              <span>{language === 'vi' ? 'Đang theo dõi' : 'Following'}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{ratingValue}</strong>
              <span>{language === 'vi' ? 'Đánh giá' : 'Rating'}</span>
            </div>
            <div className="seller-hero-stat">
              <strong>{reviewCount}</strong>
              <span>{language === 'vi' ? 'Lượt đánh giá' : 'Reviews'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="seller-shop-tabs">
        <div className="seller-tab-list" role="tablist" aria-label="Seller sections">
          {[
            ['items', language === 'vi' ? 'Sản phẩm' : 'Product'],
            ['reviews', language === 'vi' ? 'Đánh giá' : 'Reviews'],
            ['contact', language === 'vi' ? 'Liên hệ' : 'Contact'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`seller-tab ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
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

function SellerProductGrid({ products, loading, total, compact = false, productStatus, setProductStatus, productPage, setProductPage, totalPages, wishlistIds, togglingId, onWishlistToggle }) {
  const { language } = useLanguage();
  const statusTabs = [
    { key: '', label: language === 'vi' ? 'Tất cả' : 'All' },
    { key: 'Accepted', label: language === 'vi' ? 'Đang bán' : 'For Sale' },
    { key: 'Ready', label: language === 'vi' ? 'Đấu giá' : 'Auction' },
    { key: 'Sold', label: language === 'vi' ? 'Đã bán' : 'Sold' },
  ];

  return (
    <div className={`seller-products-section ${compact ? 'compact' : ''}`}>
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
          <h2>{total ? `${total} listings` : 'No products found'}</h2>
          <p>No products match the selected filter.</p>
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
  const { language, formatCurrency } = useLanguage();
  const isWishlist = wishlistIds?.has(product.productId) ?? false;
  const isAuction = product.price == null;

  return (
    <div className="seller-profile-product-card-wrapper">
      <Link to={`/product/${product.productId}`} className="seller-profile-product-card">
        <div className="seller-profile-product-media">
          {product.mainImageUrl ? (
            <img src={product.mainImageUrl} alt={product.name || 'Seller product'} loading="lazy" />
          ) : (
            <span className="material-symbols-outlined">inventory_2</span>
          )}
          {product.condition ? <em>{product.condition}</em> : null}
        </div>

        <div className="seller-profile-product-body">
          <span>{product.categoryName || (language === 'vi' ? 'Chưa phân loại' : 'Uncategorized')}</span>
          <strong>{product.name || (language === 'vi' ? 'Sản phẩm' : 'Untitled product')}</strong>
          <div>
            <b>{product.price != null ? formatCurrency(product.price) : (language === 'vi' ? 'Đấu giá' : 'Auction')}</b>
            <small>{product.stockQuantity ?? 0} {language === 'vi' ? 'có sẵn' : 'left'}</small>
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
            onWishlistToggle(product.productId, product.sellerId);
          }}
          disabled={togglingId === product.productId}
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
  const { language } = useLanguage();
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
          <h2>{language === 'vi' ? 'Đánh giá từ người mua' : 'Buyer Reviews'}</h2>
          <span>{language === 'vi' ? `Hiển thị ${firstReview}-${lastReview} trong ${reviewTotalItems}` : `${firstReview}-${lastReview} of ${reviewTotalItems}`}</span>
        </div>

        {loadingReviews ? (
          <div className="seller-public-review-loading">
            <span className="btn-spinner"></span>
            <p>{language === 'vi' ? 'Đang tải đánh giá...' : 'Loading reviews...'}</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="seller-public-review-empty">
            <span className="material-symbols-outlined">rate_review</span>
            <h2>{language === 'vi' ? 'Chưa có đánh giá nào' : 'No reviews yet'}</h2>
            <p>{language === 'vi' ? 'Người bán này chưa nhận được đánh giá nào từ các đơn hàng đã hoàn tất.' : 'This seller has not received any completed-order reviews.'}</p>
          </div>
        ) : (
          <>
            <div className="seller-public-review-items">
              {reviews.map((review) => (
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
                        <strong>{review.reviewerName || 'Anonymous buyer'}</strong>
                        <span>{formatReviewDate(review.createdAt)}</span>
                      </div>
                      <StarMeter value={review.rating || 0} />
                    </div>
                    <p>{review.comment || 'No written comment.'}</p>
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
              ))}
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
            <button type="button" className="seller-public-review-modal-close" onClick={closeReviewPreview} aria-label="Close review preview">
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
              <span className="seller-public-review-modal-eyebrow">Reviewed Product</span>
              <h2 id="seller-public-review-modal-title">{selectedReview.productName || 'Reviewed product'}</h2>
              <div className="seller-public-review-modal-meta">
                <strong>{selectedReview.reviewerName || 'Buyer'}</strong>
                <span>{formatReviewDate(selectedReview.createdAt)}</span>
                {selectedReview.orderCode ? <span>{selectedReview.orderCode}</span> : null}
              </div>
              <StarMeter value={selectedReview.rating || 0} />
              <p>{selectedReview.comment || 'No written comment.'}</p>
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

function formatPrice(value) {
  return `${currencyFormatter.format(Number(value || 0))} VND`;
}

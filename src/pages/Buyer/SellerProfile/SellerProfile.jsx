import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import productService from '../../../services/productService';
import profileService from '../../../services/profileService';
import { createSellerHubConnection } from '../../../services/sellerRealtimeService';
import '../../../styles/ProfileView.css';

const getDisplayName = (seller) => {
  const fullName = `${seller?.firstName || ''} ${seller?.lastName || ''}`.trim();
  return fullName || seller?.username || 'ReTrade Seller';
};

const getInitials = (seller) => getDisplayName(seller).slice(0, 2).toUpperCase();
const currencyFormatter = new Intl.NumberFormat('vi-VN');

const formatAddress = (address) => {
  if (!address) return 'No default address yet';
  const parts = [address.street, address.wardCode, address.districtId && `District ${address.districtId}`, address.provinceId && `Province ${address.provinceId}`].filter(Boolean);
  return parts.length ? parts.join(', ') : 'No default address yet';
};

const hasRole = (user, roleName) => {
  return (user?.roles || []).some((role) => String(role).trim().toLowerCase() === roleName.toLowerCase());
};

export default function SellerProfile() {
  const { sellerId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [followLoading, setFollowLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('about');
  const [sellerProducts, setSellerProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsTotal, setProductsTotal] = useState(0);

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
        const data = await productService.getAll({
          SellerId: resolvedSellerId,
          Page: 1,
          PageSize: 12,
          SortBy: 'newest',
        });

        if (!cancelled) {
          setSellerProducts(data?.items || []);
          setProductsTotal(Number(data?.totalItems || 0));
        }
      } catch (err) {
        if (!cancelled) {
          setSellerProducts([]);
          setProductsTotal(0);
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
  }, [seller?.sellerId, showToast]);

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
      showToast(result.message || 'Seller follow status updated.', 'success');
    } catch (err) {
      setSeller(previousSeller);
      showToast(err?.response?.data || 'Failed to update follow status.', 'error');
    } finally {
      setFollowLoading(false);
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
  const ratingText = reviewCount && seller.averageRating ? `${ratingValue} / 5` : 'No rating yet';
  const reviewText = `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`;
  const visibleProductCount = productsTotal || seller.productCount || 0;
  const memberSince = seller.createdAt ? new Date(seller.createdAt).getFullYear() : 'New seller';
  const locationText = formatAddress(seller.defaultAddress);
  const isBuyerViewingSeller = hasRole(user, 'Buyer') && seller.isSeller;

  const renderBuyerShopContent = () => {
    if (activeTab === 'reviews') {
      return <SellerRatingPanel seller={seller} ratingText={ratingText} reviewText={reviewText} />;
    }

    if (activeTab === 'auction') {
      return (
        <div className="buyer-shop-empty">
          <span className="material-symbols-outlined">gavel</span>
          <h2>Live Auctions</h2>
          <p>Active auctions from this seller will appear here when auction listings are connected.</p>
        </div>
      );
    }

    return <SellerProductGrid products={sellerProducts} loading={productsLoading} total={visibleProductCount} />;
  };

  const renderTabContent = () => {
    if (activeTab === 'items') {
      return <SellerProductGrid products={sellerProducts} loading={productsLoading} total={visibleProductCount} compact />;
    }

    if (activeTab === 'reviews') {
      return <SellerRatingPanel seller={seller} ratingText={ratingText} reviewText={reviewText} compact />;
    }

    if (activeTab === 'contact') {
      return (
        <div className="seller-tab-panel profile-view-grid seller-tab-grid">
          <article className="profile-view-card">
            <h2>Contact</h2>
            <div className="profile-view-list">
              <div>
                <span>Email</span>
                <strong>{seller.email || 'Not available'}</strong>
              </div>
              <div>
                <span>Phone</span>
                <strong>{seller.phone || 'Not available'}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{locationText}</strong>
              </div>
            </div>
          </article>
          <article className="profile-view-card">
            <h2>Seller Reference</h2>
            <div className="profile-view-list">
              <div>
                <span>Seller ID</span>
                <strong>{seller.sellerId}</strong>
              </div>
              <div>
                <span>Account ID</span>
                <strong>{seller.accountId || 'Not available'}</strong>
              </div>
            </div>
          </article>
        </div>
      );
    }

    return (
      <div className="seller-tab-panel profile-view-grid seller-tab-grid">
        <article className="profile-view-card seller-about-card">
          <span className="profile-view-kicker">About Shop</span>
          <h2>{getDisplayName(seller)}</h2>
          <p>
            {seller.username || 'This seller'} has been part of ReTrade since {memberSince}, offering curated second-hand listings with a focus on trustworthy trading.
          </p>
          <div className="seller-trust-row">
            <span><span className="material-symbols-outlined">verified</span> Verified profile</span>
            <span><span className="material-symbols-outlined">eco</span> ReTrade seller</span>
          </div>
        </article>
        <article className="profile-view-card">
          <h2>Shop Snapshot</h2>
          <div className="profile-view-list">
            <div>
              <span>Followers</span>
              <strong>{seller.followersCount}</strong>
            </div>
            <div>
              <span>Following</span>
              <strong>{seller.followingCount}</strong>
            </div>
            <div>
              <span>Relationship</span>
              <strong>{isOwnSellerPage ? 'Your shop' : seller.isFollowing ? 'Following' : 'Not following'}</strong>
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
                    {followLoading ? 'Updating...' : seller.isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                )}
                <button className="buyer-message-btn" type="button">
                  <span className="material-symbols-outlined">mail</span>
                  Message
                </button>
              </div>
            </div>
          </div>

          <div className="buyer-shop-kpis">
            <div>
              <strong>{visibleProductCount}</strong>
              <span>Listings</span>
            </div>
            <div>
              <strong>{seller.followersCount}</strong>
              <span>Followers</span>
            </div>
            <div>
              <strong>{ratingValue}</strong>
              <span>Rating</span>
            </div>
            <div>
              <strong>{reviewCount}</strong>
              <span>Reviews</span>
            </div>
          </div>
        </section>

        <section className="buyer-shop-tabs">
          {[
            ['about', 'All'],
            ['items', 'Product'],
            ['auction', 'Live Auctions'],
            ['reviews', 'Reviews'],
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
            <span className="seller-badge">{isOwnSellerPage ? 'Your Seller Profile' : seller.isSeller ? 'Trusted Seller' : 'Member Profile'}</span>
            <h1>{getDisplayName(seller)}</h1>
            <div className="seller-shop-meta">
              <span><span className="material-symbols-outlined">location_on</span>{locationText}</span>
              <span><span className="material-symbols-outlined">star</span>{ratingText}</span>
            </div>
          </div>
        </div>

        <div className="seller-shop-actions">
          {canFollowSeller && (
            <button className={`profile-follow-btn ${seller.isFollowing ? 'following' : ''}`} onClick={handleFollowToggle} disabled={followLoading}>
              <span className="material-symbols-outlined">{seller.isFollowing ? 'person_remove' : 'person_add'}</span>
              {followLoading ? 'Updating...' : seller.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          {!isOwnSellerPage && (
            <button className="seller-message-btn" type="button">
              <span className="material-symbols-outlined">mail</span>
              Message
            </button>
          )}
          {isOwnSellerPage && (
            <Link to="/profile" className="seller-message-btn owner-action">
              <span className="material-symbols-outlined">manage_accounts</span>
              Edit Profile
            </Link>
          )}
        </div>
      </section>

      <section className="seller-shop-stats">
        <div className="seller-shop-stat">
          <span>{visibleProductCount}</span>
          <p>Active Listings</p>
        </div>
        <div className="seller-shop-stat">
          <span>{seller.followersCount}</span>
          <p>Followers</p>
        </div>
        <div className="seller-shop-stat">
          <span>{seller.followingCount}</span>
          <p>Following</p>
        </div>
        <div className="seller-shop-stat">
          <span>{ratingValue}</span>
          <p>Average Rating</p>
        </div>
        <div className="seller-shop-stat">
          <span>{reviewCount}</span>
          <p>Reviews</p>
        </div>
      </section>

      <section className="seller-shop-tabs">
        <div className="seller-tab-list" role="tablist" aria-label="Seller sections">
          {[
            ['about', 'About Shop'],
            ['items', 'Active Items'],
            ['reviews', 'Reviews'],
            ['contact', 'Contact'],
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

function SellerProductGrid({ products, loading, total, compact = false }) {
  if (loading) {
    return (
      <div className={`seller-profile-products ${compact ? 'compact' : ''}`}>
        {[...Array(4)].map((_, index) => (
          <div className="seller-profile-product-card skeleton" key={index}>
            <span></span>
            <div></div>
          </div>
        ))}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="buyer-shop-empty">
        <span className="material-symbols-outlined">inventory_2</span>
        <h2>{total ? `${total} listings` : 'No active products yet'}</h2>
        <p>This seller has no visible product cards right now.</p>
      </div>
    );
  }

  return (
    <div className={`seller-profile-products ${compact ? 'compact' : ''}`}>
      {products.map((product) => (
        <SellerProductCard key={product.productId} product={product} />
      ))}
    </div>
  );
}

function SellerProductCard({ product }) {
  return (
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
        <span>{product.categoryName || 'Uncategorized'}</span>
        <strong>{product.name || 'Untitled product'}</strong>
        <div>
          <b>{product.price != null ? formatPrice(product.price) : 'Auction'}</b>
          <small>{product.stockQuantity ?? 0} left</small>
        </div>
      </div>
    </Link>
  );
}

function SellerRatingPanel({ seller, ratingText, reviewText, compact = false }) {
  const stats = seller.ratingStats?.length
    ? seller.ratingStats
    : [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0, percentage: 0 }));

  return (
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

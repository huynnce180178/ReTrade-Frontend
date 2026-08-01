import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import wishlistService from '../../../services/wishlistService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/Wishlist.css';

const isWishlistItemUnavailable = (item) => (
  item?.status === 'SoldOut' ||
  item?.status === 'Sold' ||
  item?.status === 'Inactive' ||
  (item?.stockQuantity != null && Number(item.stockQuantity) <= 0)
);

export default function Wishlist() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t, formatCurrency } = useLanguage();
  const navigate = useNavigate();

  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set());

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    try {
      const data = await wishlistService.getWishlist();
      setWishlist(data);
      setSelectedItems(new Set());
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.error_occurred');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (user) fetchWishlist();
    else setLoading(false);
  }, [user, fetchWishlist]);

  const handleRemove = async (wishlistItemId) => {
    setRemoving(wishlistItemId);
    try {
      await wishlistService.removeItem(wishlistItemId);
      setWishlist(prev => ({
        ...prev,
        items: prev.items.filter(i => i.wishlistItemId !== wishlistItemId),
      }));
      setSelectedItems(prev => {
        const next = new Set(prev);
        next.delete(wishlistItemId);
        return next;
      });
      showToast(t('product.remove_from_wishlist'), 'success');
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.error_occurred');
      showToast(msg, 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const activeItemIds = wishlist?.items
        ?.filter(i => !isWishlistItemUnavailable(i))
        ?.map(i => i.wishlistItemId) || [];
      setSelectedItems(new Set(activeItemIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (wishlistItemId, checked) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(wishlistItemId);
      } else {
        next.delete(wishlistItemId);
      }
      return next;
    });
  };

  const handleRemoveSelected = async () => {
    if (selectedItems.size === 0) return;
    setLoading(true);
    try {
      await Promise.all(
        Array.from(selectedItems).map(id => wishlistService.removeItem(id))
      );
      setWishlist(prev => ({
        ...prev,
        items: prev.items.filter(i => !selectedItems.has(i.wishlistItemId)),
      }));
      setSelectedItems(new Set());
      showToast(t('toast.deleted_success'), 'success');
    } catch (err) {
      const msg = err.response?.data || err.message || t('common.error_occurred');
      showToast(msg, 'error');
      fetchWishlist();
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="wl-empty-state animate-fade-in">
        <span className="material-symbols-outlined wl-empty-icon-symbol" style={{ fontSize: '64px', color: 'var(--text-muted)', marginBottom: '16px' }}>lock</span>
        <h2 className="wl-empty-title">{t('auth.login_title')}</h2>
        <p className="wl-empty-desc">{t('auth.login_subtitle')}</p>
        <Link to="/login" className="btn btn-primary">{t('auth.login_button')}</Link>
      </div>
    );
  }

  if (loading && !wishlist) {
    return (
      <div className="wl-loading animate-fade-in">
        <div className="wl-spinner" />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  const items = wishlist?.items ?? [];
  const selectableItems = items.filter(i => !isWishlistItemUnavailable(i));
  const isAllSelected = selectableItems.length > 0 && selectedItems.size === selectableItems.length;

  const selectedProducts = items.filter(i => selectedItems.has(i.wishlistItemId));
  const subtotal = selectedProducts.reduce((sum, item) => sum + (item.price || 0), 0);

  const groups = items.reduce((acc, item) => {
    const seller = item.sellerName || 'ReTrade Seller';
    if (!acc[seller]) acc[seller] = [];
    acc[seller].push(item);
    return acc;
  }, {});

  return (
    <main className="wl-main-container animate-fade-in">
      <header className="wl-page-header">
        <h1 className="wl-page-title">{t('nav.wishlist')}</h1>
        <p className="wl-page-desc">
          {t('home.favorites_subtitle')}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="wl-empty-state">
          <span className="material-symbols-outlined wl-empty-icon-symbol" style={{ fontSize: '64px', color: 'var(--text-muted)', marginBottom: '16px' }}>favorite_border</span>
          <h2 className="wl-empty-title">{t('common.no_data')}</h2>
          <p className="wl-empty-desc">{t('home.latest_subtitle_user')}</p>
          <Link to="/product" className="btn btn-primary">{t('home.browse_all')}</Link>
        </div>
      ) : (
        <>
          <div className="wl-bulk-actions">
            <label className="wl-checkbox-label">
              <input
                type="checkbox"
                className="wl-checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                disabled={selectableItems.length === 0}
              />
              <span className="wl-bulk-text">
                {t('common.all')} ({selectedItems.size}/{selectableItems.length})
              </span>
            </label>
            {selectedItems.size > 0 && (
              <button className="wl-delete-selected-btn" onClick={handleRemoveSelected}>
                <span className="material-symbols-outlined">delete</span>
                {t('common.delete')} ({selectedItems.size})
              </button>
            )}
          </div>

          <div className="wl-layout-grid">
            <div className="wl-content-area">
              {Object.entries(groups).map(([sellerName, groupItems]) => (
                <div key={sellerName} className="wl-seller-group">
                  <div className="wl-seller-header">
                    <div className="wl-seller-avatar-fallback">
                      {sellerName.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="wl-seller-title">{sellerName}</span>
                  </div>

                  <div className="wl-items-stack">
                    {groupItems.map(item => {
                      const isSoldOut = isWishlistItemUnavailable(item);
                      const isChecked = selectedItems.has(item.wishlistItemId);

                      return (
                        <div
                          key={item.wishlistItemId}
                          className={`wl-item-card glass-card ${isSoldOut ? 'item-unavailable' : ''}`}
                        >
                          <div className="wl-item-checkbox-wrapper">
                            <input
                              type="checkbox"
                              className="wl-checkbox"
                              checked={isChecked}
                              disabled={isSoldOut}
                              onChange={(e) => handleSelectItem(item.wishlistItemId, e.target.checked)}
                            />
                          </div>

                          <div className="wl-item-img-container">
                            {item.mainImageUrl ? (
                              <img
                                src={item.mainImageUrl}
                                alt={item.productName}
                                className="wl-item-img"
                              />
                            ) : (
                              <div className="wl-item-placeholder">🛍️</div>
                            )}
                          </div>

                          <div className="wl-item-details">
                            <div className="wl-item-header">
                              <div>
                                <h3 className="wl-item-name">{item.productName || '—'}</h3>
                                <p className="wl-item-category">
                                  {item.condition || 'Good'} • {item.status || 'Active'}
                                </p>
                              </div>
                              <div className="wl-item-price-tag">
                                {item.price != null
                                  ? formatCurrency(item.price)
                                  : t('nav.auction')}
                              </div>
                            </div>

                            <div className="wl-item-actions-row">
                              <div className="wl-item-meta-info">
                                {isSoldOut ? (
                                  <span className="wl-status-pill sold-out">SOLD OUT</span>
                                ) : (
                                  <span className="wl-status-pill in-stock">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    IN STOCK
                                  </span>
                                )}
                              </div>
                              <button
                                className="wl-item-delete-btn"
                                onClick={() => handleRemove(item.wishlistItemId)}
                                disabled={removing === item.wishlistItemId}
                                title={t('product.remove_from_wishlist')}
                              >
                                {removing === item.wishlistItemId ? (
                                  <span className="wl-spinner-sm" />
                                ) : (
                                  <span className="material-symbols-outlined">delete</span>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <aside className="wl-sidebar">
              <div className="wl-summary-card glass-card">
                <h2 className="wl-summary-title">{t('checkout.order_summary')}</h2>
                <div className="wl-summary-lines">
                  <div className="wl-summary-line">
                    <span>{t('checkout.subtotal')}</span>
                    <strong className="wl-summary-price">
                      {formatCurrency(subtotal)}
                    </strong>
                  </div>
                  <div className="wl-summary-line">
                    <span>{t('checkout.shipping_fee')}</span>
                    <span className="wl-summary-badge-text">{t('checkout.shipping_address')}</span>
                  </div>
                </div>

                <div className="wl-summary-footer">
                  <div className="wl-summary-total-row">
                    <span>{t('checkout.total_payment')}</span>
                    <strong className="wl-total-price">
                      {formatCurrency(subtotal)}
                    </strong>
                  </div>
                  <button
                    className="wl-checkout-btn"
                    disabled={selectedItems.size !== 1}
                    onClick={() => {
                      const firstSelected = items.find(i => selectedItems.has(i.wishlistItemId));
                      if (firstSelected && !isWishlistItemUnavailable(firstSelected)) {
                        navigate(`/checkout/${firstSelected.productId}`, { state: { product: firstSelected } });
                      }
                    }}
                  >
                    {t('product.buy_now')}
                  </button>
                  {selectedItems.size > 1 && (
                    <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '8px', textAlign: 'center', fontWeight: '500' }}>
                      ⚠️ {t('common.warning')}
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

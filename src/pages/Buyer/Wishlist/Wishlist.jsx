import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import wishlistService from '../../../services/wishlistService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import '../../../styles/Wishlist.css';

export default function Wishlist() {
  const { user } = useAuth();
  const { showToast } = useToast();
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
      setSelectedItems(new Set()); // Reset selections
    } catch (err) {
      const msg = err.response?.data || err.message || 'Failed to load wishlist.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      showToast('Item removed from wishlist.', 'success');
    } catch (err) {
      const msg = err.response?.data || err.message || 'Failed to remove item.';
      showToast(msg, 'error');
    } finally {
      setRemoving(null);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const activeItemIds = wishlist?.items
        ?.filter(i => i.status !== 'SoldOut' && i.status !== 'Inactive')
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
      // Loop sequence or promise.all to delete selected
      await Promise.all(
        Array.from(selectedItems).map(id => wishlistService.removeItem(id))
      );
      setWishlist(prev => ({
        ...prev,
        items: prev.items.filter(i => !selectedItems.has(i.wishlistItemId)),
      }));
      setSelectedItems(new Set());
      showToast('Selected items removed.', 'success');
    } catch (err) {
      const msg = err.response?.data || err.message || 'Failed to remove selected items.';
      showToast(msg, 'error');
      fetchWishlist(); // reload in case of partial success
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="wl-empty-state animate-fade-in">
        <span className="wl-empty-icon">🔐</span>
        <h2 className="wl-empty-title">Sign in to view your Wishlist</h2>
        <p className="wl-empty-desc">Save items you love and come back to them anytime.</p>
        <Link to="/login" className="btn btn-primary">Sign In</Link>
      </div>
    );
  }

  if (loading && !wishlist) {
    return (
      <div className="wl-loading animate-fade-in">
        <div className="wl-spinner" />
        <p>Loading your wishlist…</p>
      </div>
    );
  }

  const items = wishlist?.items ?? [];
  const selectableItems = items.filter(i => i.status !== 'SoldOut' && i.status !== 'Inactive');
  const isAllSelected = selectableItems.length > 0 && selectedItems.size === selectableItems.length;

  // Calculate order summary
  const selectedProducts = items.filter(i => selectedItems.has(i.wishlistItemId));
  const subtotal = selectedProducts.reduce((sum, item) => sum + (item.price || 0), 0);

  // Group items by Seller (or "Curated by...")
  const groups = items.reduce((acc, item) => {
    const seller = item.sellerName || 'Heritage Luxury';
    if (!acc[seller]) acc[seller] = [];
    acc[seller].push(item);
    return acc;
  }, {});

  return (
    <main className="wl-main-container animate-fade-in">
      {/* Page Title */}
      <header className="wl-page-header">
        <h1 className="wl-page-title">Your Curated Wishlist</h1>
        <p className="wl-page-desc">
          A selection of circular luxury items saved for your consideration. Review, adjust quantities, or transition your favorites to your bag.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="wl-empty-state">
          <span className="wl-empty-icon">💛</span>
          <h2 className="wl-empty-title">Your wishlist is empty</h2>
          <p className="wl-empty-desc">Browse products and tap the heart icon to save items you love.</p>
          <Link to="/product" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <>
          {/* Bulk Actions */}
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
                Select All ({selectableItems.length} active items)
              </span>
            </label>
            {selectedItems.size > 0 && (
              <button className="wl-bulk-delete" onClick={handleRemoveSelected}>
                <span className="material-symbols-outlined">delete</span>
                <span>Remove Selected ({selectedItems.size})</span>
              </button>
            )}
          </div>

          <div className="wl-layout-grid">
            {/* Wishlist Content (Grouped by Seller) */}
            <div className="wl-content-area">
              {Object.entries(groups).map(([sellerName, groupItems]) => (
                <div key={sellerName} className="wl-seller-group">
                  <div className="wl-seller-header">
                    {sellerName === 'Heritage Luxury' || sellerName === 'HL' ? (
                      <div className="wl-seller-avatar-fallback">HL</div>
                    ) : (
                      <div className="wl-seller-avatar-fallback">
                        {sellerName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="wl-seller-title">CURATED BY {sellerName}</span>
                  </div>

                  <div className="wl-items-stack">
                    {groupItems.map(item => {
                      const isSoldOut = item.status === 'SoldOut' || item.status === 'Inactive';
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
                                  {item.condition || 'PREMIUM GRADE A'} • {item.status || 'Active'}
                                </p>
                              </div>
                              <div className="wl-item-price-tag">
                                {item.price != null
                                  ? `${Number(item.price).toLocaleString('vi-VN')} VND`
                                  : 'Auction'}
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
                                title="Remove from wishlist"
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

            {/* Sidebar Summary */}
            <aside className="wl-sidebar">
              <div className="wl-summary-card glass-card">
                <h2 className="wl-summary-title">Order Summary</h2>
                <div className="wl-summary-lines">
                  <div className="wl-summary-line">
                    <span>Product Subtotal</span>
                    <strong className="wl-summary-price">
                      {subtotal.toLocaleString('vi-VN')} VND
                    </strong>
                  </div>
                  <div className="wl-summary-line">
                    <span>Estimated Shipping</span>
                    <span className="wl-summary-badge-text">Calculated at checkout</span>
                  </div>
                  <div className="wl-summary-line">
                    <span>Authentication Fee</span>
                    <span className="wl-summary-badge-text">Included</span>
                  </div>
                </div>

                <div className="wl-summary-footer">
                  <div className="wl-summary-total-row">
                    <span>Total Amount</span>
                    <strong className="wl-total-price">
                      {subtotal.toLocaleString('vi-VN')} VND
                    </strong>
                  </div>
                  <button
                    className="wl-checkout-btn"
                    disabled={selectedItems.size === 0}
                    onClick={() => {
                      const firstSelected = items.find(i => selectedItems.has(i.wishlistItemId));
                      if (firstSelected) {
                        navigate('/checkout', { state: { product: firstSelected } });
                      }
                    }}
                  >
                    Proceed to Checkout
                  </button>
                </div>

                <div className="wl-auth-protocol-box">
                  <span className="material-symbols-outlined">verified_user</span>
                  <p>
                    Every item is verified by our experts through the{' '}
                    <strong>RETRADE Authentication Protocol</strong>.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}

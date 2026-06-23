import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { formatAuctionDateTime, parseAuctionDateTime } from '../../../utils/auctionTime';
import './Auction.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

function formatMoney(value) {
  if (value == null) return '-';
  return moneyFormatter.format(Number(value || 0));
}

function formatDateTime(value) {
  return formatAuctionDateTime(value);
}

function getProgress(auction) {
  const start = parseAuctionDateTime(auction?.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction?.endTime)?.getTime() || 0;
  const now = Date.now();
  if (!start || !end || end <= start) return 0;
  if (now <= start) return 0;
  if (now >= end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function getMinimumNextBid(auction) {
  if (!auction) return 0;
  if (!auction.bidCount) return Number(auction.startingPrice || 0);
  return Number(auction.currentPrice || 0) + Number(auction.minIncrement || 0);
}

export default function AuctionDetail() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [deposit, setDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const loadAuction = async () => {
      try {
        setLoading(true);
        const data = await auctionService.getById(auctionId);
        setAuction(data);
        setActiveImage(data?.images?.find(i => i.isMain)?.imageUrl || data?.images?.[0]?.imageUrl || data?.productImageUrl || '');
        try {
          const myDeposit = await auctionService.getMyDeposit(auctionId);
          setDeposit(myDeposit);
        } catch {
          setDeposit(null);
        }
      } catch (error) {
        showToast(error?.response?.data || 'Failed to load auction detail.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadAuction();
  }, [auctionId, authLoading, user, showToast]);

  useEffect(() => {
    if (authLoading || !user || !auctionId) return undefined;

    const connection = createAuctionHubConnection();
    let disposed = false;

    const joinGroups = async () => {
      if (disposed || connection.state !== 'Connected') return;
      await Promise.all([
        connection.invoke('JoinAuctionGroup', auctionId),
        connection.invoke('JoinMyAuctionDepositGroup', auctionId),
      ]);
    };

    const handleAuctionUpdated = (payload) => {
      const nextAuction = payload?.auction || payload?.Auction;
      if (!nextAuction || nextAuction.auctionId !== auctionId) return;
      setAuction(nextAuction);
      setActiveImage((current) => current || nextAuction?.images?.find(i => i.isMain)?.imageUrl || nextAuction?.images?.[0]?.imageUrl || nextAuction?.productImageUrl || '');
    };

    const handleDepositChanged = (payload) => {
      const nextDeposit = payload?.deposit || payload?.Deposit;
      if (!nextDeposit || nextDeposit.auctionId !== auctionId) return;
      setDeposit(nextDeposit);
      if (nextDeposit.status === 'Paid') {
        showToast('Auction deposit confirmed. You can place bids now.', 'success');
      }
    };

    connection.on('AuctionUpdated', handleAuctionUpdated);
    connection.on('AuctionDepositChanged', handleDepositChanged);
    connection.onreconnected(() => {
      joinGroups().catch(() => {});
    });

    connection.start()
      .then(joinGroups)
      .catch(() => {});

    return () => {
      disposed = true;
      connection.off('AuctionUpdated', handleAuctionUpdated);
      connection.off('AuctionDepositChanged', handleDepositChanged);
      connection.stop().catch(() => {});
    };
  }, [auctionId, authLoading, user, showToast]);

  const specRows = useMemo(() => {
    if (!auction) return [];
    return [
      ['Condition', auction.condition],
      ['Stock', auction.stockQuantity],
      ['Weight', auction.weightGram ? `${auction.weightGram} g` : null],
      ['Size', auction.lengthCm && auction.widthCm && auction.heightCm ? `${auction.lengthCm} x ${auction.widthCm} x ${auction.heightCm} cm` : null],
      ...(auction.attributes || []).map(attr => [attr.attributeName, attr.unit ? `${attr.value} ${attr.unit}` : attr.value]),
    ].filter(([, value]) => value != null && value !== '');
  }, [auction]);

  const minimumNextBid = getMinimumNextBid(auction);
  const isOwner = Boolean(user && auction && (auction.sellerId === user.userId || auction.sellerId === user.id));
  const isOngoing = auction?.status === 'Ongoing';
  const paidDeposit = deposit?.status === 'Paid' && deposit?.policyAccepted;
  const maxBidAmount = Number(deposit?.maxBidAmount || deposit?.depositAmount || 0);
  const canBid = Boolean(user && auction && isOngoing && !isOwner && paidDeposit);
  const canDeposit = Boolean(user && auction && !isOwner && !['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid', 'Cancelled'].includes(auction.status));

  const refreshAuction = async () => {
    const data = await auctionService.getById(auctionId);
    setAuction(data);
    const myDeposit = await auctionService.getMyDeposit(auctionId);
    setDeposit(myDeposit);
  };

  const handleDepositSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(depositAmount);
    if (amount < 20000) {
      showToast('Deposit must be at least 20,000 VND.', 'warning');
      return;
    }
    if (!policyAccepted) {
      showToast('Please accept the auction policy before paying deposit.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const result = await auctionService.createDepositPaymentUrl(auctionId, {
        depositAmount: amount,
        policyAccepted,
      });
      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        showToast('Payment URL not returned.', 'error');
      }
    } catch (error) {
      showToast(error?.response?.data || 'Failed to create deposit payment.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(bidAmount);
    if (!canBid) {
      showToast('A paid deposit is required before bidding.', 'warning');
      return;
    }
    if (amount < minimumNextBid) {
      showToast(`Bid must be at least ${formatMoney(minimumNextBid)}.`, 'warning');
      return;
    }
    if (amount > maxBidAmount) {
      showToast('Bid cannot exceed your deposit amount.', 'warning');
      return;
    }
    if (auction.buyNowPrice && amount > Number(auction.buyNowPrice)) {
      showToast('Bid cannot be greater than the buy now price.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const result = await auctionService.placeBid(auctionId, { bidAmount: amount });
      setAuction(result?.auction || auction);
      setBidAmount('');
      if (result?.auctionEnded) {
        showToast(result.message || 'Auction ended and order was created.', 'success');
      } else {
        showToast('Bid placed successfully.', 'success');
      }
      await refreshAuction();
    } catch (error) {
      showToast(error?.response?.data || 'Failed to place bid.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="auction-page container animate-fade-in">
        <section className="auction-auth-panel">
          <span className="material-symbols-outlined">lock</span>
          <h1>Auction Detail</h1>
          <p>Please sign in to view auction details.</p>
          <Link to="/login" className="auction-auth-link">Sign In</Link>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auction-page container auction-detail-loading">
        <span className="btn-spinner"></span>
        <p>Loading auction detail...</p>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="auction-page container animate-fade-in">
        <div className="auction-empty">
          <span className="material-symbols-outlined">error</span>
          <h3>Auction not found</h3>
          <button onClick={() => navigate('/auction')}>Back to Auctions</button>
        </div>
      </div>
    );
  }

  const progress = getProgress(auction);

  return (
    <div className="auction-page auction-detail-page container animate-fade-in">
      <div className="auction-detail-breadcrumb">
        <Link to="/auction">Auctions</Link>
        <span>/</span>
        <strong>{auction.productName}</strong>
      </div>

      <section className="auction-detail-layout">
        <div className="auction-detail-gallery">
          <div className="auction-detail-main-image">
            {activeImage ? (
              <img src={activeImage} alt={auction.productName || 'Auction product'} />
            ) : (
              <span className="material-symbols-outlined">inventory_2</span>
            )}
            <em className={`auction-card-status ${String(auction.status || '').toLowerCase()}`}>{auction.status}</em>
          </div>
          {(auction.images || []).length > 1 && (
            <div className="auction-detail-thumbs">
              {auction.images.map((image) => (
                <button key={image.imageId || image.imageUrl} className={activeImage === image.imageUrl ? 'active' : ''} onClick={() => setActiveImage(image.imageUrl)}>
                  <img src={image.imageUrl} alt={image.altText || auction.productName} />
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="auction-detail-side">
          <section className="auction-detail-action-card">
            <div className="auction-detail-action-head">
              <div>
                <span>Minimum Next Bid</span>
                <strong>{formatMoney(minimumNextBid)}</strong>
              </div>
              <div>
                <span>Your Deposit</span>
                <strong>{deposit?.status === 'Paid' ? formatMoney(deposit.depositAmount) : '-'}</strong>
              </div>
            </div>

            {isOwner ? (
              <div className="auction-detail-notice">You cannot bid on your own auction.</div>
            ) : !paidDeposit ? (
              <form className="auction-deposit-form" onSubmit={handleDepositSubmit}>
                <label>
                  <span>Deposit Amount</span>
                  <input
                    type="number"
                    min="20000"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder="Min 20000"
                    disabled={!canDeposit || actionLoading}
                  />
                </label>
                <label className="auction-policy-check">
                  <input
                    type="checkbox"
                    checked={policyAccepted}
                    onChange={(event) => setPolicyAccepted(event.target.checked)}
                    disabled={!canDeposit || actionLoading}
                  />
                  <span>I accept the auction policy and deposit terms.</span>
                </label>
                <button type="submit" disabled={!canDeposit || actionLoading}>
                  {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">payments</span>}
                  Pay Deposit
                </button>
              </form>
            ) : (
              <form className="auction-bid-form" onSubmit={handleBidSubmit}>
                <label>
                  <span>Bid Amount</span>
                  <input
                    type="number"
                    min={minimumNextBid}
                    max={auction.buyNowPrice || maxBidAmount}
                    value={bidAmount}
                    onChange={(event) => setBidAmount(event.target.value)}
                    placeholder={`Max ${formatMoney(maxBidAmount)}`}
                    disabled={!canBid || actionLoading}
                  />
                </label>
                {auction.buyNowPrice && (
                  <p className="auction-buynow-hint">Bid exactly {formatMoney(auction.buyNowPrice)} to buy now and end the auction.</p>
                )}
                <button type="submit" disabled={!canBid || actionLoading}>
                  {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">gavel</span>}
                  Place Bid
                </button>
              </form>
            )}
          </section>

          <div className="auction-detail-info">
            <span className="auction-detail-category">{auction.categoryName || 'Uncategorized'}</span>
            <h1>{auction.productName}</h1>
            <p>{auction.productDescription || 'No product description provided.'}</p>

            <div className="auction-detail-bidbox">
              <div>
                <span>Current Highest Bid</span>
                <strong>{formatMoney(auction.currentPrice)}</strong>
              </div>
              <div>
                <span>Starting Price</span>
                <strong>{formatMoney(auction.startingPrice)}</strong>
              </div>
              <div>
                <span>Step</span>
                <strong>{formatMoney(auction.minIncrement)}</strong>
              </div>
              <div>
                <span>Bids</span>
                <strong>{auction.bidCount || 0}</strong>
              </div>
            </div>

            <div className="auction-detail-progress">
              <div>
                <span>Progress</span>
                <strong>{progress}%</strong>
              </div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="auction-detail-timeline">
              <div>
                <span>Start Time</span>
                <strong>{formatDateTime(auction.startTime)}</strong>
              </div>
              <div>
                <span>End Time</span>
                <strong>{formatDateTime(auction.endTime)}</strong>
              </div>
            </div>

            <div className="auction-detail-seller">
              <span className="material-symbols-outlined">storefront</span>
              <div>
                <small>Seller</small>
                <strong>{auction.sellerName || 'Unknown seller'}</strong>
                <p>{auction.sellerId}</p>
              </div>
              {auction.sellerId && <Link to={`/sellers/${auction.sellerId}`}>View Seller</Link>}
            </div>
          </div>
        </aside>
      </section>

      <section className="auction-detail-lower">
        <article className="auction-detail-card">
          <h2>Product Details</h2>
          {specRows.length === 0 ? (
            <p>No additional specifications.</p>
          ) : (
            <dl>
              {specRows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </article>

        <article className="auction-detail-card">
          <h2>Recent Bids</h2>
          {(auction.recentBids || []).length === 0 ? (
            <p>No bids have been placed yet.</p>
          ) : (
            <div className="auction-bid-history">
              {auction.recentBids.map((bid) => (
                <div key={bid.bidId}>
                  <span>{bid.bidderName || bid.userId || 'Bidder'}</span>
                  <strong>{formatMoney(bid.bidAmount)}</strong>
                  <small>{formatDateTime(bid.createdAt)}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

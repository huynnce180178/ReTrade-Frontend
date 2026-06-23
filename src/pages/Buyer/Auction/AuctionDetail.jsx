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

function formatDuration(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (num) => String(num).padStart(2, '0');

  if (days > 0) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
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

  const [showRules, setShowRules] = useState(() => {
    return !localStorage.getItem('retrade_seen_rules');
  });

  const handleCloseRules = () => {
    localStorage.setItem('retrade_seen_rules', 'true');
    setShowRules(false);
  };

  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!auction) return;

    const calculateTimeLeft = () => {
      const now = Date.now();
      const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
      const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;

      if (auction.status === 'Upcoming' && start > now) {
        const diff = start - now;
        setTimeLeft(`Starts in: ${formatDuration(diff)}`);
      } else if (auction.status === 'Ongoing' && end > now) {
        const diff = end - now;
        setTimeLeft(`Ends in: ${formatDuration(diff)}`);
      } else {
        setTimeLeft('Auction Ended');
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [auction]);

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
  const isEnded = ['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid'].includes(auction?.status);
  const isWinner = Boolean(user && auction && auction.winnerId && (auction.winnerId === user.userId || auction.winnerId === user.id));

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
      showToast('Bid cannot exceed your bidding limit (deposit - 20,000 VND).', 'warning');
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
              <div>
                <span>Bidding Limit</span>
                <strong>{deposit?.status === 'Paid' ? formatMoney(maxBidAmount) : '-'}</strong>
              </div>
            </div>

             {isEnded ? (
              <div className={`auction-detail-status-card ${isWinner ? 'winner-card' : 'ended-card'}`}>
                <span className="material-symbols-outlined">
                  {isWinner ? 'emoji_events' : 'info'}
                </span>
                {isWinner ? (
                  <div>
                    <h3>You Won!</h3>
                    <p>Congratulations, you won this auction with a bid of <strong>{formatMoney(auction.currentPrice)}</strong>.</p>
                    <Link to="/purchase-history" className="btn-view-order">View in Purchase History</Link>
                  </div>
                ) : paidDeposit ? (
                  <div>
                    <h3>Auction Ended</h3>
                    <p>Winner: <strong>{auction.winnerName || 'Anonymous'}</strong>.</p>
                    <small className="refund-notice">Your deposit balance (excluding the 20,000 VND participation fee) will be manually refunded by the administrator.</small>
                  </div>
                ) : auction.winnerId ? (
                  <div>
                    <h3>Auction Ended</h3>
                    <p>Winner: <strong>{auction.winnerName || 'Anonymous'}</strong>.</p>
                  </div>
                ) : (
                  <div>
                    <h3>Auction Ended</h3>
                    <p>This auction ended with no bids placed.</p>
                  </div>
                )}
              </div>
            ) : isOwner ? (
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
              {auction.buyNowPrice && (
                <div className="auction-detail-buynow-item">
                  <span>Buy Now Price</span>
                  <strong>{formatMoney(auction.buyNowPrice)}</strong>
                </div>
              )}
            </div>

            <div className="auction-detail-progress">
              <div>
                <span>Time Left</span>
                <strong>{timeLeft}</strong>
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

      {showRules && (
        <div className="auction-rules-overlay" role="dialog" aria-modal="true">
          <div className="auction-rules-card animate-fade-in">
            <header className="auction-rules-popup-header">
              <span className="material-symbols-outlined">gavel</span>
              <h2>Auction Rules & Guidelines</h2>
            </header>
            
            <div className="auction-rules-content">
              <div className="rules-section">
                <h3>1. Free to Watch</h3>
                <p>Viewing ongoing auctions is completely free. No deposit or registration fees are required.</p>
              </div>

              <div className="rules-section">
                <h3>2. Participation & Entry Fee</h3>
                <p>To place bids, a mandatory deposit is required. A non-refundable entry fee of <strong>20,000 VND</strong> is charged immediately upon joining the auction.</p>
              </div>

              <div className="rules-section">
                <h3>3. Bidding Limit</h3>
                <p>Your maximum allowable bid is calculated as: <br />
                <strong>Bidding Limit = Total Deposit - 20,000 VND</strong>.</p>
              </div>

              <div className="rules-section">
                <h3>4. Refund Policies</h3>
                <ul>
                  <li><strong>If you win:</strong> The winning bid amount will be deducted from your deposit. The remaining balance (Deposit - Win Amount - 20,000 VND) will be manually refunded by the administrator.</li>
                  <li><strong>If you lose:</strong> The remaining deposit (Deposit - 20,000 VND fee) will be manually refunded by the administrator.</li>
                </ul>
              </div>
            </div>

            <footer className="auction-rules-footer">
              <button type="button" onClick={handleCloseRules} className="btn-rules-agree">
                I Understand & Agree
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

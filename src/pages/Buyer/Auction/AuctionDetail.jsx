import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { formatAuctionDateTime, parseAuctionDateTime } from '../../../utils/auctionTime';
import './Auction.css';
import './AuctionDetail.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const AUCTION_ENTRY_FEE = 20000;

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

const ENDED_AUCTION_STATUSES = ['Ended', 'EndedByBuyNow', 'EndedByTime', 'EndedNoBid'];

function getEffectiveAuctionStatus(auction, now = Date.now()) {
  if (!auction) return '';
  if ([...ENDED_AUCTION_STATUSES, 'Cancelled'].includes(auction.status)) return auction.status;

  const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
  const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;

  if (end && end <= now) return 'Ended';
  if (start && start > now) return 'Upcoming';
  return 'Ongoing';
}

function isEndedAuctionStatus(status) {
  return ENDED_AUCTION_STATUSES.includes(status);
}

function getUserId(user) {
  return user?.userId || user?.id || '';
}

function isAuctionWinner(auction, user) {
  const userId = getUserId(user);
  return Boolean(userId && auction?.winnerId && auction.winnerId === userId);
}

function getApiErrorMessage(error) {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || data?.title || '';
}

function translateBidError(message) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('greater than 0')) return 'Bid amount must be greater than 0.';
  if (normalized.includes('auction not found')) return 'Auction not found.';
  if (normalized.includes('own auction')) return 'You cannot bid on your own auction.';
  if (normalized.includes('active auctions')) return 'Bids can only be placed on active auctions.';
  if (normalized.includes('paid deposit') || normalized.includes('accepted policy')) return 'A paid deposit and accepted policy are required before bidding.';
  if (normalized.includes('bidding limit')) return 'Bid amount cannot exceed your bidding limit.';
  if (normalized.includes('current bid')) return 'Bid amount must be greater than the current bid.';
  if (normalized.includes('at least')) return 'Bid amount does not meet the minimum required amount.';
  if (normalized.includes('buy now price')) return 'Bid amount cannot be greater than the buy now price.';

  return message || 'Failed to place bid. Please try again.';
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
  const [showAuctionEndNotice, setShowAuctionEndNotice] = useState(false);
  const previousAuctionStatusRef = useRef(null);
  const shownEndNoticeRef = useRef(new Set());

  const [showRules, setShowRules] = useState(() => {
    return !localStorage.getItem('retrade_seen_rules');
  });

  const handleCloseRules = () => {
    localStorage.setItem('retrade_seen_rules', 'true');
    setShowRules(false);
  };

  const [timeLeft, setTimeLeft] = useState('');

  const getEndNoticeKey = useCallback((nextAuction) => {
    const currentUserId = getUserId(user) || 'guest';
    return `retrade_auction_end_notice_dismissed_v2_${nextAuction?.auctionId}_${currentUserId}`;
  }, [user]);

  const triggerAuctionEndNotice = useCallback((nextAuction) => {
    if (!nextAuction?.auctionId) return;
    if (!isEndedAuctionStatus(getEffectiveAuctionStatus(nextAuction))) return;

    const noticeKey = getEndNoticeKey(nextAuction);
    if (sessionStorage.getItem(noticeKey)) return;
    if (shownEndNoticeRef.current.has(noticeKey)) return;

    shownEndNoticeRef.current.add(noticeKey);
    setShowAuctionEndNotice(true);
  }, [getEndNoticeKey]);

  const closeAuctionEndNotice = () => {
    if (auction?.auctionId) {
      sessionStorage.setItem(getEndNoticeKey(auction), 'true');
    }
    setShowAuctionEndNotice(false);
  };

  useEffect(() => {
    if (!auction) return;

    const calculateTimeLeft = () => {
      const now = Date.now();
      const start = parseAuctionDateTime(auction.startTime)?.getTime() || 0;
      const end = parseAuctionDateTime(auction.endTime)?.getTime() || 0;

      const effectiveStatus = getEffectiveAuctionStatus(auction, now);

      if (effectiveStatus === 'Upcoming' && start > now) {
        const diff = start - now;
        setTimeLeft(`Starts in: ${formatDuration(diff)}`);
      } else if (effectiveStatus === 'Ongoing' && end > now) {
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
          setPolicyAccepted(Boolean(myDeposit?.policyAccepted));
        } catch {
          setDeposit(null);
          setPolicyAccepted(false);
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
      const eventType = payload?.eventType || payload?.EventType || '';
      if (!nextAuction || nextAuction.auctionId !== auctionId) return;
      setAuction((currentAuction) => {
        const wasEnded = isEndedAuctionStatus(getEffectiveAuctionStatus(currentAuction));
        const nowEnded = isEndedAuctionStatus(getEffectiveAuctionStatus(nextAuction));
        if ((!wasEnded && nowEnded) || String(eventType).startsWith('AuctionEnded')) {
          triggerAuctionEndNotice(nextAuction);
        }
        return nextAuction;
      });
      setActiveImage((current) => current || nextAuction?.images?.find(i => i.isMain)?.imageUrl || nextAuction?.images?.[0]?.imageUrl || nextAuction?.productImageUrl || '');
    };

    const handleDepositChanged = (payload) => {
      const nextDeposit = payload?.deposit || payload?.Deposit;
      const eventType = payload?.eventType || payload?.EventType || '';
      if (!nextDeposit || nextDeposit.auctionId !== auctionId) return;
      setDeposit(nextDeposit);
      setPolicyAccepted(Boolean(nextDeposit.policyAccepted));
      if (eventType === 'DepositPaid') {
        showToast('Auction deposit confirmed. You can place bids now.', 'success');
      } else if (eventType === 'DepositToppedUp') {
        showToast('Auction deposit added successfully.', 'success');
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
  }, [auctionId, authLoading, user, showToast, triggerAuctionEndNotice]);

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

  const effectiveStatus = getEffectiveAuctionStatus(auction);
  const minimumNextBid = getMinimumNextBid(auction);
  const isOwner = Boolean(user && auction && (auction.sellerId === user.userId || auction.sellerId === user.id));
  const isOngoing = effectiveStatus === 'Ongoing';
  const paidDeposit = deposit?.status === 'Paid' && deposit?.policyAccepted;
  const availableDepositAmount = Number(deposit?.depositAmount || 0);
  const totalDepositAmount = Number(deposit?.totalDepositAmount ?? availableDepositAmount);
  const heldBidAmount = Number(deposit?.heldBidAmount || 0);
  const fallbackMaxBidAmount = Math.max(0, availableDepositAmount - AUCTION_ENTRY_FEE);
  const maxBidAmount = Number(deposit?.maxBidAmount ?? fallbackMaxBidAmount);
  const buyNowAmount = Number(auction?.buyNowPrice || 0);
  const additionalDepositNeededForBuyNow = Math.max(0, buyNowAmount - maxBidAmount);
  const additionalDepositNeededForNextBid = Math.max(0, minimumNextBid - maxBidAmount);
  const highestAllowedBid = buyNowAmount ? Math.min(maxBidAmount, buyNowAmount) : maxBidAmount;
  const enteredBidAmount = Number(bidAmount || 0);
  const bidExceedsLimit = Boolean(bidAmount && enteredBidAmount > highestAllowedBid);
  const canBid = Boolean(user && auction && isOngoing && !isOwner && paidDeposit);
  const canDeposit = Boolean(user && auction && !isOwner && ![...ENDED_AUCTION_STATUSES, 'Cancelled'].includes(effectiveStatus));
  const isEnded = isEndedAuctionStatus(effectiveStatus);
  const isWinner = isAuctionWinner(auction, user);

  useEffect(() => {
    if (!auction || !user) return;

    const previousStatus = previousAuctionStatusRef.current;
    const currentStatus = getEffectiveAuctionStatus(auction);
    const nowEnded = isEndedAuctionStatus(currentStatus);
    const wasEnded = isEndedAuctionStatus(previousStatus);
    const isFirstStatusCheck = previousStatus == null;

    if (nowEnded && (!wasEnded || (isFirstStatusCheck && isAuctionWinner(auction, user)))) {
      triggerAuctionEndNotice(auction);
    }

    previousAuctionStatusRef.current = currentStatus;
  }, [auction, user, timeLeft, triggerAuctionEndNotice]);

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
    if (!paidDeposit && !policyAccepted) {
      showToast('Please accept the auction policy before paying deposit.', 'warning');
      return;
    }

    try {
      setActionLoading(true);
      const result = await auctionService.createDepositPaymentUrl(auctionId, {
        depositAmount: amount,
        policyAccepted: paidDeposit ? true : policyAccepted,
      });
      if (result?.paymentUrl) {
        window.location.href = result.paymentUrl;
      } else {
        showToast('Payment URL not returned.', 'error');
      }
    } catch (error) {
      showToast(getApiErrorMessage(error) || 'Failed to create deposit payment.', 'error');
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
    const isBuyNowBid = Boolean(auction.buyNowPrice && amount === Number(auction.buyNowPrice));
    if (!isBuyNowBid && amount < minimumNextBid) {
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
      if (result?.deposit) {
        setDeposit(result.deposit);
      }
      setBidAmount('');
      if (result?.auctionEnded) {
        showToast('Bid matched the buy now price. Auction ended.', 'success');
        triggerAuctionEndNotice(result?.auction || auction);
      } else {
        showToast('Bid placed successfully.', 'success');
      }
      await refreshAuction();
    } catch (error) {
      showToast(translateBidError(getApiErrorMessage(error)), 'error');
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
            <em className={`auction-card-status ${String(effectiveStatus || '').toLowerCase()}`}>{effectiveStatus}</em>
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
                <strong>{deposit?.status === 'Paid' ? formatMoney(totalDepositAmount) : '-'}</strong>
              </div>
              <div className={paidDeposit && maxBidAmount <= 0 ? 'auction-limit-empty' : ''}>
                <span>Bidding Limit</span>
                <strong>{deposit?.status === 'Paid' ? formatMoney(maxBidAmount) : '-'}</strong>
              </div>
            </div>
            {paidDeposit && heldBidAmount > 0 && (
              <p className="auction-limit-note">
                You already bid {formatMoney(heldBidAmount)}. Remaining bidding limit: {formatMoney(maxBidAmount)}.
              </p>
            )}

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
              <form className="auction-deposit-form" onSubmit={handleDepositSubmit} noValidate>
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
              <>
                <form className="auction-bid-form" onSubmit={handleBidSubmit} noValidate>
                  <label>
                    <span>Bid Amount</span>
                    <input
                      type="number"
                      min={minimumNextBid}
                      max={highestAllowedBid}
                      value={bidAmount}
                      onChange={(event) => setBidAmount(event.target.value)}
                      placeholder={`Max ${formatMoney(highestAllowedBid)}`}
                      disabled={!canBid || actionLoading}
                    />
                  </label>
                  {auction.buyNowPrice && (
                    <p className="auction-buynow-hint">
                      Bid exactly {formatMoney(auction.buyNowPrice)} to buy now and end the auction.
                      {buyNowAmount > maxBidAmount ? ` Add ${formatMoney(additionalDepositNeededForBuyNow)} more deposit to reach the buy now limit.` : ' Your bidding limit covers buy now.'}
                    </p>
                  )}
                  {paidDeposit && additionalDepositNeededForNextBid > 0 && (
                    <p className="auction-bid-limit-warning">
                      Add {formatMoney(additionalDepositNeededForNextBid)} more deposit to reach the next bid.
                    </p>
                  )}
                  {bidExceedsLimit && (
                    <p className="auction-bid-limit-warning">
                      Current maximum bid: {formatMoney(highestAllowedBid)}.
                    </p>
                  )}
                  <button type="submit" disabled={!canBid || actionLoading}>
                    {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">gavel</span>}
                    Place Bid
                  </button>
                </form>

                <form className="auction-deposit-form auction-topup-form" onSubmit={handleDepositSubmit} noValidate>
                  <label>
                    <span>Add More Deposit</span>
                    <input
                      type="number"
                      min="20000"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      placeholder="Min 20000"
                      disabled={!canDeposit || actionLoading}
                    />
                  </label>
                  <p className="auction-topup-note">
                    The 20,000 VND participation fee is only deducted on your first successful deposit. Any extra deposit is added directly to your bidding limit.
                  </p>
                  <button type="submit" disabled={!canDeposit || actionLoading}>
                    {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">account_balance_wallet</span>}
                    Add Deposit
                  </button>
                </form>
              </>
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

      {showAuctionEndNotice && (
        <div className="auction-celebration-overlay" role="dialog" aria-modal="true">
          <div className="auction-firework firework-one"></div>
          <div className="auction-firework firework-two"></div>
          <div className="auction-firework firework-three"></div>
          <section className="auction-celebration-card">
            <span className="material-symbols-outlined">{isWinner ? 'emoji_events' : 'verified'}</span>
            <h2>{isWinner ? 'Congratulations!' : 'Auction Ended'}</h2>
            {isWinner ? (
              <p>You won <strong>{auction.productName}</strong> with a bid of {formatMoney(auction.currentPrice)}.</p>
            ) : auction.winnerId ? (
              <p><strong>{auction.productName}</strong> ended at {formatMoney(auction.currentPrice)}. Winner: <strong>{auction.winnerName || 'Anonymous'}</strong>.</p>
            ) : Number(auction.bidCount || 0) > 0 ? (
              <p><strong>{auction.productName}</strong> has ended. Final results are being confirmed.</p>
            ) : (
              <p><strong>{auction.productName}</strong> has ended with no winning bid.</p>
            )}
            <div className="auction-celebration-actions">
              {isWinner && (
                <Link to="/purchase-history" className="btn-view-order" onClick={closeAuctionEndNotice}>
                  View Order
                </Link>
              )}
              <button type="button" onClick={closeAuctionEndNotice}>
                Keep Browsing
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

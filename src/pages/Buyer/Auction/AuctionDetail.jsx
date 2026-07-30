import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
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

function translateBidError(message, t) {
  const normalized = String(message || '').toLowerCase();

  if (normalized.includes('greater than 0')) return t('auction.err_greater_than_zero');
  if (normalized.includes('auction not found')) return t('auction.err_not_found');
  if (normalized.includes('own auction')) return t('auction.err_own_auction');
  if (normalized.includes('active auctions')) return t('auction.err_active_only');
  if (normalized.includes('paid deposit') || normalized.includes('accepted policy')) return t('auction.err_deposit_required');
  if (normalized.includes('bidding limit')) return t('auction.err_limit_exceeded');
  if (normalized.includes('current bid')) return t('auction.err_must_be_higher');
  if (normalized.includes('at least')) return t('auction.err_min_step');
  if (normalized.includes('buy now price')) return t('auction.err_buy_now_exceeded');

  return message || t('auction.err_default');
}

export default function AuctionDetail() {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t } = useLanguage();
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
        const duration = formatDuration(diff);
        setTimeLeft(t('auction.starts_in', { duration }));
      } else if (effectiveStatus === 'Ongoing' && end > now) {
        const diff = end - now;
        const duration = formatDuration(diff);
        setTimeLeft(t('auction.ends_in', { duration }));
      } else {
        setTimeLeft(t('auction.status_ended'));
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [auction, t]);

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
      showToast(translateBidError(getApiErrorMessage(error), t), 'error');
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
  const isLeadingBidder = Boolean(
    user &&
    auction?.recentBids &&
    auction.recentBids.length > 0 &&
    (auction.recentBids[0]?.userId === user.userId || auction.recentBids[0]?.userId === user.id)
  );

  const translatedStatusLabel = effectiveStatus === 'Upcoming'
    ? t('auction.status_upcoming')
    : (effectiveStatus === 'Ongoing'
      ? t('auction.status_active')
      : t('auction.status_ended'));

  return (
    <div className="auction-page auction-detail-page container animate-fade-in">
      <div className="auction-detail-breadcrumb">
        <Link to="/auction">{t('auction.auctions_breadcrumb')}</Link>
        <span>/</span>
        <strong>{auction.productName}</strong>
      </div>

      <section className="auction-detail-layout">
        <div className="auction-detail-gallery">
          <div className="auction-detail-main-image">
            {activeImage ? (
              <img src={activeImage} alt={auction.productName || t('nav.product')} />
            ) : (
              <span className="material-symbols-outlined">inventory_2</span>
            )}
            <em className={`auction-card-status ${isEnded ? 'ended' : String(effectiveStatus || '').toLowerCase()}`}>
              {translatedStatusLabel}
            </em>
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
                <span>{t('auction.min_next_bid')}</span>
                <strong>{formatMoney(minimumNextBid)}</strong>
              </div>
              <div>
                <span>{t('auction.your_deposit')}</span>
                <strong>{deposit?.status === 'Paid' ? formatMoney(totalDepositAmount) : '-'}</strong>
              </div>
              <div className={paidDeposit && maxBidAmount <= 0 ? 'auction-limit-empty' : ''}>
                <span>{t('auction.bidding_limit')}</span>
                <strong>{deposit?.status === 'Paid' ? formatMoney(maxBidAmount) : '-'}</strong>
              </div>
            </div>
            {paidDeposit && heldBidAmount > 0 && (
              <p className="auction-limit-note">
                {isVi
                  ? `Bạn đã ra giá ${formatMoney(heldBidAmount)}. Hạn mức ra giá còn lại: ${formatMoney(maxBidAmount)}.`
                  : `You already bid ${formatMoney(heldBidAmount)}. Remaining bidding limit: ${formatMoney(maxBidAmount)}.`}
              </p>
            )}

             {isEnded ? (
              <div className={`auction-detail-status-card ${isWinner ? 'winner-card' : 'ended-card'}`}>
                <span className="material-symbols-outlined">
                  {isWinner ? 'emoji_events' : 'info'}
                </span>
                {isWinner ? (
                  <div>
                    <h3>{isVi ? '🏆 Bạn Đã Thắng Phiên Đấu Giá!' : 'You Won!'}</h3>
                    <p>{isVi ? `Chúc mừng! Bạn đã thắng phiên đấu giá này với mức giá ${formatMoney(auction.currentPrice)}.` : `Congratulations, you won this auction with a bid of ${formatMoney(auction.currentPrice)}.`}</p>
                    <Link to="/purchase-history" className="btn-view-order">{isVi ? 'Xem Trong Lịch Sử Mua Hàng' : 'View in Purchase History'}</Link>
                  </div>
                ) : paidDeposit ? (
                  <div>
                    <h3>{isVi ? 'Phiên Đấu Giá Đã Kết Thúc' : 'Auction Ended'}</h3>
                    <p>{isVi ? 'Người thắng cuộc:' : 'Winner:'} <strong>{auction.winnerName || (isVi ? 'Ẩn danh' : 'Anonymous')}</strong>.</p>
                    <small className="refund-notice">{isVi ? 'Số tiền đặt cọc của bạn (trừ phí tham gia 20.000 VNĐ) sẽ được quản trị viên hoàn trả lại.' : 'Your deposit balance (excluding the 20,000 VND participation fee) will be manually refunded by the administrator.'}</small>
                  </div>
                ) : auction.winnerId ? (
                  <div>
                    <h3>{isVi ? 'Phiên Đấu Giá Đã Kết Thúc' : 'Auction Ended'}</h3>
                    <p>{isVi ? 'Người thắng cuộc:' : 'Winner:'} <strong>{auction.winnerName || (isVi ? 'Ẩn danh' : 'Anonymous')}</strong>.</p>
                  </div>
                ) : (
                  <div>
                    <h3>{isVi ? 'Phiên Đấu Giá Đã Kết Thúc' : 'Auction Ended'}</h3>
                    <p>{isVi ? 'Phiên đấu giá này đã kết thúc mà không có lượt ra giá nào.' : 'This auction ended with no bids placed.'}</p>
                  </div>
                )}
              </div>
            ) : isOwner ? (
              <div className="auction-detail-notice">{isVi ? 'Bạn không thể ra giá cho sản phẩm đấu giá của chính mình.' : 'You cannot bid on your own auction.'}</div>
            ) : !paidDeposit ? (
              <form className="auction-deposit-form" onSubmit={handleDepositSubmit} noValidate>
                <label>
                  <span>{t('auction.deposit_amount')}</span>
                  <input
                    type="number"
                    min="20000"
                    value={depositAmount}
                    onChange={(event) => setDepositAmount(event.target.value)}
                    placeholder={isVi ? 'Tối thiểu 20.000' : 'Min 20000'}
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
                  <span>{t('auction.deposit_terms_accept')}</span>
                </label>
                <button type="submit" disabled={!canDeposit || actionLoading}>
                  {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">payments</span>}
                  {t('auction.pay_deposit')}
                </button>
              </form>
            ) : (
              <>
                <form className="auction-bid-form" onSubmit={handleBidSubmit} noValidate>
                  <label>
                    <span>{t('auction.enter_bid_amount')}</span>
                    <input
                      type="number"
                      min={minimumNextBid}
                      max={highestAllowedBid}
                      value={bidAmount}
                      onChange={(event) => setBidAmount(event.target.value)}
                      placeholder={isVi ? `Tối đa ${formatMoney(highestAllowedBid)}` : `Max ${formatMoney(highestAllowedBid)}`}
                      disabled={!canBid || actionLoading}
                    />
                  </label>
                  {auction.buyNowPrice && (
                    <p className="auction-buynow-hint">
                      {isVi
                        ? `Ra giá đúng ${formatMoney(auction.buyNowPrice)} để mua ngay và kết thúc phiên đấu giá.`
                        : `Bid exactly ${formatMoney(auction.buyNowPrice)} to buy now and end the auction.`}
                      {buyNowAmount > maxBidAmount
                        ? (isVi ? ` Nạp thêm ${formatMoney(additionalDepositNeededForBuyNow)} cọc để đạt hạn mức mua ngay.` : ` Add ${formatMoney(additionalDepositNeededForBuyNow)} more deposit to reach the buy now limit.`)
                        : (isVi ? ' Hạn mức ra giá của bạn đủ để mua ngay.' : ' Your bidding limit covers buy now.')}
                    </p>
                  )}
                  {paidDeposit && additionalDepositNeededForNextBid > 0 && (
                    <p className="auction-bid-limit-warning">
                      {isVi
                        ? `Nạp thêm ${formatMoney(additionalDepositNeededForNextBid)} cọc để đủ ra giá tiếp theo.`
                        : `Add ${formatMoney(additionalDepositNeededForNextBid)} more deposit to reach the next bid.`}
                    </p>
                  )}
                  {bidExceedsLimit && (
                    <p className="auction-bid-limit-warning">
                      {isVi
                        ? `Hạn mức ra giá tối đa hiện tại: ${formatMoney(highestAllowedBid)}.`
                        : `Current maximum bid: ${formatMoney(highestAllowedBid)}.`}
                    </p>
                  )}
                  <button type="submit" disabled={!canBid || actionLoading}>
                    {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">gavel</span>}
                    {t('auction.place_bid')}
                  </button>
                </form>

                <form className="auction-deposit-form auction-topup-form" onSubmit={handleDepositSubmit} noValidate>
                  <label>
                    <span>{t('auction.add_more_deposit')}</span>
                    <input
                      type="number"
                      min="20000"
                      value={depositAmount}
                      onChange={(event) => setDepositAmount(event.target.value)}
                      placeholder={isVi ? 'Tối thiểu 20.000' : 'Min 20000'}
                      disabled={!canDeposit || actionLoading}
                    />
                  </label>
                  <p className="auction-topup-note">
                    {t('auction.topup_note')}
                  </p>
                  <button type="submit" disabled={!canDeposit || actionLoading}>
                    {actionLoading ? <span className="btn-spinner"></span> : <span className="material-symbols-outlined">add_card</span>}
                    {t('auction.top_up_deposit')}
                  </button>
                </form>
              </>
            )}
          </section>

          <div className="auction-detail-info">
            <span className="auction-detail-category">{auction.categoryName || t('common.none')}</span>
            <h1>{auction.productName}</h1>
            <p>{auction.productDescription || t('common.no_data')}</p>

            <div className="auction-detail-bidbox">
              <div>
                <span>{t('auction.current_highest_bid')}</span>
                <strong key={auction.currentPrice} className="price-flash-up">{formatMoney(auction.currentPrice)}</strong>
                {isLeadingBidder && (
                  <span className="leading-bidder-badge">
                    {t('auction.you_are_leading')}
                  </span>
                )}
              </div>
              <div>
                <span>{t('auction.starting_price')}</span>
                <strong>{formatMoney(auction.startingPrice)}</strong>
              </div>
              <div>
                <span>{t('auction.min_step')}</span>
                <strong>{formatMoney(auction.minIncrement)}</strong>
              </div>
              <div>
                <span>{t('auction.bid_count')}</span>
                <strong>{auction.bidCount || 0}</strong>
              </div>
              {auction.buyNowPrice && (
                <div className="auction-detail-buynow-item">
                  <span>{t('auction.buy_now_price')}</span>
                  <strong>{formatMoney(auction.buyNowPrice)}</strong>
                </div>
              )}
            </div>

            <div className="auction-detail-progress">
              <div>
                <span>{t('auction.time_remaining')}</span>
                <strong>{timeLeft}</strong>
              </div>
              <i><b style={{ width: `${progress}%` }} /></i>
            </div>

            <div className="auction-detail-timeline">
              <div>
                <span>{t('auction.start_time')}</span>
                <strong>{formatDateTime(auction.startTime)}</strong>
              </div>
              <div>
                <span>{t('auction.end_time')}</span>
                <strong>{formatDateTime(auction.endTime)}</strong>
              </div>
            </div>

            <div className="auction-detail-seller">
              <span className="material-symbols-outlined">storefront</span>
              <div>
                <small>{t('auction.seller')}</small>
                <strong>{auction.sellerName || t('auction.unknown_seller')}</strong>
                <p>{auction.sellerId}</p>
              </div>
              {auction.sellerId && <Link to={`/sellers/${auction.sellerId}`}>{t('auction.view_seller')}</Link>}
            </div>
          </div>
        </aside>
      </section>

      <section className="auction-detail-lower">
        <article className="auction-detail-card">
          <h2>{t('auction.product_details')}</h2>
          {specRows.length === 0 ? (
            <p>{t('auction.no_specs')}</p>
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
          <h2>{t('auction.recent_bids')}</h2>
          {(auction.recentBids || []).length === 0 ? (
            <p>{t('auction.no_bids_yet')}</p>
          ) : (
            <div className="auction-bid-history">
              {auction.recentBids.map((bid) => (
                <div key={bid.bidId}>
                  <span>{bid.bidderName || bid.userId || t('auction.bidder')}</span>
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
              <h2>{isVi ? 'Quy Định & Hướng Dẫn Đấu Giá' : 'Auction Rules & Guidelines'}</h2>
            </header>
            
            <div className="auction-rules-content">
              <div className="rules-section">
                <h3>{isVi ? '1. Phù Hợp Cho Mọi Người' : '1. Free to Watch'}</h3>
                <p>{isVi ? 'Xem các phiên đấu giá hoàn toàn miễn phí. Không yêu cầu phí đăng ký hay đặt cọc để theo dõi.' : 'Viewing ongoing auctions is completely free. No deposit or registration fees are required.'}</p>
              </div>

              <div className="rules-section">
                <h3>{isVi ? '2. Phí Tham Gia & Đặt Cọc' : '2. Participation & Entry Fee'}</h3>
                <p>{isVi ? 'Để ra giá, bạn cần nạp tiền đặt cọc. Phí tham gia 20.000 VNĐ (không hoàn lại) sẽ được khấu trừ khi bạn tham gia phiên.' : 'To place bids, a mandatory deposit is required. A non-refundable entry fee of 20,000 VND is charged immediately upon joining the auction.'}</p>
              </div>

              <div className="rules-section">
                <h3>{isVi ? '3. Hạn Mức Ra Giá' : '3. Bidding Limit'}</h3>
                <p>{isVi ? 'Hạn mức ra giá tối đa được tính theo công thức:' : 'Your maximum allowable bid is calculated as:'} <br />
                <strong>{isVi ? 'Hạn Mức Ra Giá = Tổng Tiền Cọc - 20.000 VNĐ' : 'Bidding Limit = Total Deposit - 20,000 VND'}</strong>.</p>
              </div>

              <div className="rules-section">
                <h3>{isVi ? '4. Chính Sách Hoàn Cọc' : '4. Refund Policies'}</h3>
                <ul>
                  <li><strong>{isVi ? 'Nếu bạn thắng:' : 'If you win:'}</strong> {isVi ? 'Số tiền trúng đấu giá sẽ trừ vào khoản cọc. Số dư còn lại sẽ được quản trị viên hoàn trả.' : 'The winning bid amount will be deducted from your deposit. The remaining balance (Deposit - Win Amount - 20,000 VND) will be manually refunded by the administrator.'}</li>
                  <li><strong>{isVi ? 'Nếu bạn không thắng:' : 'If you lose:'}</strong> {isVi ? 'Khoản tiền cọc còn lại (sau khi trừ 20.000 VNĐ phí tham gia) sẽ được hoàn trả đầy đủ.' : 'The remaining deposit (Deposit - 20,000 VND fee) will be manually refunded by the administrator.'}</li>
                </ul>
              </div>
            </div>

            <footer className="auction-rules-footer">
              <button type="button" onClick={handleCloseRules} className="btn-rules-agree">
                {isVi ? 'Tôi Đã Hiểu & Đồng Ý' : 'I Understand & Agree'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {showAuctionEndNotice && (
        <div className="auction-end-banner" role="status">
          <span className="material-symbols-outlined">{isWinner ? 'emoji_events' : 'info'}</span>
          <span>
            {isWinner
              ? (isVi ? `🏆 Bạn đã thắng phiên đấu giá với giá ${formatMoney(auction.currentPrice)}.` : `🏆 You won this auction at ${formatMoney(auction.currentPrice)}.`)
              : (isVi ? 'Phiên đấu giá đã kết thúc.' : 'This auction has ended.')}
          </span>
          {isWinner && (
            <Link to="/purchase-history" className="auction-end-banner-link" onClick={closeAuctionEndNotice}>
              {isVi ? 'Xem đơn hàng' : 'View Order'}
            </Link>
          )}
          <button type="button" className="auction-end-banner-close" onClick={closeAuctionEndNotice} aria-label="Dismiss">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import auctionService from '../../../services/auctionService';
import { createAuctionHubConnection } from '../../../services/auctionRealtimeService';
import { auctionDateTimeLocalToApiValue, formatAuctionDateTime, getFutureAuctionDateTimeLocal, parseAuctionDateTime } from '../../../utils/auctionTime';
import './Auction.css';
import './AuctionDetail.css';

function toAuctionPayload(form) {
  return {
    startingPrice: Number(form.startingPrice),
    minIncrement: Number(form.minIncrement),
    buyNowPrice: form.buyNowPrice ? Number(form.buyNowPrice) : null,
    startTime: auctionDateTimeLocalToApiValue(form.startTime),
    endTime: auctionDateTimeLocalToApiValue(form.endTime),
  };
}

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
});

const AUCTION_ENTRY_FEE = 20000;

function formatMoney(value) {
  if (value == null) return '-';
  return moneyFormatter.format(Number(value || 0));
}

function triggerFireworks() {
  if (typeof window === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '999999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 120 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 18,
    vy: (Math.random() - 0.7) * 18,
    size: Math.random() * 8 + 4,
    color: `hsl(${Math.floor(Math.random() * 360)}, 100%, 55%)`,
    rotation: Math.random() * 360,
    rSpeed: (Math.random() - 0.5) * 10,
    opacity: 1,
  }));

  let animationFrame;
  const render = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35;
      p.opacity -= 0.012;
      p.rotation += p.rSpeed;

      if (p.opacity > 0) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (alive) {
      animationFrame = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationFrame);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  };

  render();
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
  const { t, language } = useLanguage();
  const isVi = language === 'vi';
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState('');
  const [deposit, setDeposit] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
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

    const loadAuction = async () => {
      try {
        setLoading(true);
        const data = await auctionService.getById(auctionId);
        setAuction(data);
        setActiveImage(data?.images?.find(i => i.isMain)?.imageUrl || data?.images?.[0]?.imageUrl || data?.productImageUrl || '');
        if (user) {
          try {
            const myDeposit = await auctionService.getMyDeposit(auctionId);
            setDeposit(myDeposit);
            setPolicyAccepted(Boolean(myDeposit?.policyAccepted));
          } catch {
            setDeposit(null);
            setPolicyAccepted(false);
          }
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
      if (isAuctionWinner(auction, user)) {
        triggerFireworks();
      }
      triggerAuctionEndNotice(auction);
    }

    previousAuctionStatusRef.current = currentStatus;
  }, [auction, user, timeLeft, triggerAuctionEndNotice]);

  const refreshAuction = async () => {
    try {
      const data = await auctionService.getById(auctionId);
      setAuction(data);
      if (user) {
        try {
          const myDeposit = await auctionService.getMyDeposit(auctionId);
          setDeposit(myDeposit);
        } catch {
          // Ignore deposit fetch error on ended or finalized auctions
        }
      }
    } catch {
      // Ignore background refresh errors
    }
  };

  const handleDepositSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(depositAmount);
    if (amount < 20000) {
      showToast(t('auction.deposit_min_error'), 'warning');
      return;
    }
    if (!paidDeposit && !policyAccepted) {
      showToast(t('auction.deposit_policy_error'), 'warning');
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
        showToast(t('common.error_occurred'), 'error');
      }
    } catch (error) {
      showToast(getApiErrorMessage(error) || t('common.error_occurred'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(bidAmount);
    if (!canBid) {
      showToast(t('auction.bid_deposit_required'), 'warning');
      return;
    }
    const isBuyNowBid = Boolean(auction.buyNowPrice && amount === Number(auction.buyNowPrice));
    if (!isBuyNowBid && amount < minimumNextBid) {
      showToast(t('auction.bid_min_error', { minBid: formatMoney(minimumNextBid) }), 'warning');
      return;
    }
    if (amount > maxBidAmount) {
      showToast(t('auction.bid_limit_error'), 'warning');
      return;
    }
    if (auction.buyNowPrice && amount > Number(auction.buyNowPrice)) {
      showToast(t('auction.bid_buynow_exceed'), 'warning');
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
      if (result?.auctionEnded || isBuyNowBid) {
        triggerFireworks();
        showToast(t('auction.bid_buynow_ended'), 'success');
        triggerAuctionEndNotice(result?.auction || auction);
      } else {
        showToast(t('auction.bid_success'), 'success');
      }
      await refreshAuction();
    } catch (error) {
      showToast(translateBidError(getApiErrorMessage(error), t), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const [relistForm, setRelistForm] = useState(null);

  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);

  const openEndConfirmModal = () => {
    setShowEndConfirmModal(true);
  };

  const closeEndConfirmModal = () => {
    if (actionLoading) return;
    setShowEndConfirmModal(false);
  };

  const handleEndAuctionConfirm = async () => {
    try {
      setActionLoading(true);
      await auctionService.endAuction(auctionId);
      showToast(t('my_auctions.end_success'), 'success');
      setShowEndConfirmModal(false);
      await refreshAuction();
    } catch (error) {
      showToast(getApiErrorMessage(error) || t('my_auctions.end_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const openRelistModal = () => {
    setRelistForm({
      startingPrice: auction?.startingPrice ?? '',
      minIncrement: auction?.minIncrement ?? '',
      buyNowPrice: auction?.buyNowPrice ?? '',
      startTime: getFutureAuctionDateTimeLocal(0),
      endTime: getFutureAuctionDateTimeLocal(24 * 60 * 60 * 1000),
    });
  };

  const closeRelistModal = () => {
    if (actionLoading) return;
    setRelistForm(null);
  };

  const handleRelistChange = (event) => {
    const { name, value } = event.target;
    setRelistForm((current) => ({ ...current, [name]: value }));
  };

  const handleRelistSubmit = async (event) => {
    event.preventDefault();
    if (!relistForm) return;

    try {
      setActionLoading(true);
      await auctionService.relistAuction(auctionId, toAuctionPayload(relistForm));
      showToast(t('my_auctions.relist_success'), 'success');
      setRelistForm(null);
      await refreshAuction();
    } catch (error) {
      showToast(getApiErrorMessage(error) || t('my_auctions.relist_error'), 'error');
    } finally {
      setActionLoading(false);
    }
  };



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
        {/* Column 1 (Left): Gallery & Product Details */}
        <div className="auction-detail-col-left">
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
        </div>

        {/* Column 2 (Center): Auction Info & Bidding Action */}
        <div className="auction-detail-col-center">
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
          </div>

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
                    <p>{isVi ? 'Người thắng cuộc:' : 'Winner:'} <strong>{auction.winnerName || (auction.winnerId ? (isVi ? 'Ẩn danh' : 'Anonymous') : (isVi ? 'Không có' : 'None'))}</strong>.</p>
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
              <div className="auction-detail-notice">
                <p style={{ margin: 0 }}>{isVi ? 'Bạn không thể ra giá cho sản phẩm đấu giá của chính mình.' : 'You cannot bid on your own auction.'}</p>
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                  {effectiveStatus === 'Ongoing' && (
                    <button
                      type="button"
                      className="btn-outline"
                      style={{ color: '#dc2626', borderColor: '#fca5a5', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={openEndConfirmModal}
                      disabled={actionLoading}
                    >
                      {t('my_auctions.end_auction')}
                    </button>
                  )}
                  {(effectiveStatus === 'EndedNoBid' || (isEnded && Number(auction.bidCount || 0) === 0)) && (
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                      onClick={openRelistModal}
                      disabled={actionLoading}
                    >
                      {t('my_auctions.relist_auction')}
                    </button>
                  )}
                </div>
              </div>
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
                <div className="auction-policy-wrapper" style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="auction-policy-check" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={policyAccepted}
                      onChange={(event) => setPolicyAccepted(event.target.checked)}
                      disabled={!canDeposit || actionLoading}
                    />
                    <span>{t('auction.deposit_terms_accept')}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPolicyModal(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: '#1b6b51',
                      fontSize: '12px',
                      fontWeight: 600,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>article</span>
                    {t('auction.view_policy_terms')}
                  </button>
                </div>
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
        </div>

        {/* Column 3 (Right): Seller Info & Recent Bids */}
        <div className="auction-detail-col-right">
          <article className="auction-detail-card">
            <h2>{t('auction.seller')}</h2>
            <div className="auction-detail-seller" style={{ border: 'none', padding: 0 }}>
              <span className="material-symbols-outlined">storefront</span>
              <div>
                <strong>{auction.sellerName || t('auction.unknown_seller')}</strong>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{auction.sellerId}</p>
              </div>
              {auction.sellerId && <Link to={`/sellers/${auction.sellerId}`}>{t('auction.view_seller')}</Link>}
            </div>
          </article>

          <article className="auction-detail-card">
            <h2>{t('auction.recent_bids')}</h2>
            {(auction.recentBids || []).length === 0 ? (
              <p>{t('auction.no_bids_yet')}</p>
            ) : (
              <div className="auction-bid-history" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {auction.recentBids.map((bid) => (
                  <div
                    key={bid.bidId}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '10px 12px',
                      backgroundColor: '#f9fafb',
                      borderRadius: '10px',
                      border: '1px solid #f3f4f6'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '8px' }}>
                      <span style={{ fontWeight: 600, color: '#1f2937', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {bid.bidderName || bid.userId || t('auction.bidder')}
                      </span>
                      <strong style={{ color: '#1b6b51', fontSize: '15px', fontWeight: 700, flexShrink: 0 }}>
                        {formatMoney(bid.bidAmount)}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', width: '100%', color: '#9ca3af', fontSize: '11px' }}>
                      <small>{formatDateTime(bid.createdAt)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      {showRules && createPortal(
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
        </div>,
        document.body
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

      {/* Auction Deposit Policy & Terms Modal Popup */}
      {showPolicyModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '16px',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: '85vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            border: '1px solid #f3f4f6',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #f3f4f6', backgroundColor: '#f9fafb' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1b6b51' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>gavel</span>
                <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#111827', fontFamily: 'serif' }}>
                  {t('auction.policy_modal_title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', fontSize: '14px', color: '#4b5563', lineHeight: 1.6 }}>
              <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'flex-start', gap: '10px', color: '#065f46', marginBottom: '16px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#059669', flexShrink: 0, marginTop: '2px' }}>verified_user</span>
                <p style={{ fontSize: '12px', margin: 0 }}>
                  {t('auction.policy_banner_desc')}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ fontWeight: 700, color: '#111827', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 4px 0' }}>
                  {t('auction.policy_section_1_title')}
                </h4>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>{t('auction.policy_section_1_bullet_1')}</li>
                  <li>{t('auction.policy_section_1_bullet_2')}</li>
                  <li>{t('auction.policy_section_1_bullet_3')}</li>
                </ul>

                <h4 style={{ fontWeight: 700, color: '#111827', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '12px 0 4px 0' }}>
                  {t('auction.policy_section_2_title')}
                </h4>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13px', color: '#4b5563', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>{t('auction.policy_section_2_bullet_1')}</li>
                  <li>{t('auction.policy_section_2_bullet_2')}</li>
                </ul>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {t('auction.policy_modal_notice')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', color: '#374151', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  {t('common.close')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPolicyAccepted(true);
                    setShowPolicyModal(false);
                  }}
                  style={{ padding: '8px 20px', backgroundColor: '#1b6b51', color: '#ffffff', borderRadius: '10px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                  {t('auction.policy_btn_agree')}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {relistForm && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '540px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('my_auctions.relist_title')}</h3>
              <button type="button" onClick={closeRelistModal} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <form onSubmit={handleRelistSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{t('auction.starting_price')} (VND) *</label>
                  <input type="number" name="startingPrice" value={relistForm.startingPrice} onChange={handleRelistChange} required min="1" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{t('auction.min_step')} (VND) *</label>
                  <input type="number" name="minIncrement" value={relistForm.minIncrement} onChange={handleRelistChange} required min="1" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{t('auction.buy_now_price')} (VND) *</label>
                <input type="number" name="buyNowPrice" value={relistForm.buyNowPrice} onChange={handleRelistChange} required min="1" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{t('auction.start_time')} *</label>
                  <input type="datetime-local" name="startTime" value={relistForm.startTime} onChange={handleRelistChange} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>{t('auction.end_time')} *</label>
                  <input type="datetime-local" name="endTime" value={relistForm.endTime} onChange={handleRelistChange} min={relistForm.startTime || undefined} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={closeRelistModal} disabled={actionLoading} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>{t('common.cancel')}</button>
                <button type="submit" disabled={actionLoading} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: '#1b6b51', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>{actionLoading ? t('common.saving') : t('my_auctions.relist_auction')}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {showEndConfirmModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '440px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>warning</span>
                {t('my_auctions.end_auction')}
              </h3>
              <button type="button" onClick={closeEndConfirmModal} disabled={actionLoading} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '24px', fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>
              {t('my_auctions.confirm_end_msg')}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button type="button" onClick={closeEndConfirmModal} disabled={actionLoading} style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleEndAuctionConfirm} disabled={actionLoading} style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {actionLoading ? t('common.submitting') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import offerService from '../../../services/offerService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatFormattedNumber, parseRawNumber } from '../../../utils/numberUtils';

function formatVnd(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(value)) + ' VND';
}

function calculateTimeRemaining(expiresAtStr, t) {
  if (!expiresAtStr) return '—';
  const expiresAt = new Date(expiresAtStr);
  const now = new Date();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) return t('auction.status_ended');

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHrs > 24) {
    const days = Math.floor(diffHrs / 24);
    const hours = diffHrs % 24;
    return `${days}${t('auction.days_short', { count: '' }).trim()} ${hours}${t('auction.hours_short', { count: '' }).trim()}`;
  }

  return `${diffHrs}${t('auction.hours_short', { count: '' }).trim()} ${diffMins}${t('auction.minutes_short', { count: '' }).trim()}`;
}

export default function OfferList() {
  const { user } = useOutletContext();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Offers states
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [filterStatus, setFilterStatus] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Counter-offer modal states
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Action Confirm modal state (accept / reject)
  const [actionConfirm, setActionConfirm] = useState(null); // { type: 'accept' | 'reject', offer: object }
  const [submittingAction, setSubmittingAction] = useState(false);

  // Fetch offers from backend
  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await offerService.getSellerOffers();
      setOffers(Array.isArray(data) ? data : data?.items || []);
    } catch {
      showToast(t('common.error_occurred'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    if (user) {
      fetchOffers();
    }
  }, [user, fetchOffers]);

  // Open Action Confirm Modal (Accept / Reject)
  const handleOpenAcceptModal = (offer) => {
    setActionConfirm({ type: 'accept', offer });
  };

  const handleOpenRejectModal = (offer) => {
    setActionConfirm({ type: 'reject', offer });
  };

  // Handle Confirm Accept / Reject
  const handleConfirmAction = async () => {
    if (!actionConfirm) return;
    const { type, offer } = actionConfirm;
    setSubmittingAction(true);
    try {
      if (type === 'accept') {
        await offerService.acceptSellerOffer(offer.offerId);
        showToast(t('offer_list.accept_success'), 'success');
      } else {
        await offerService.rejectSellerOffer(offer.offerId);
        showToast(t('offer_list.reject_success'), 'info');
      }
      setActionConfirm(null);
      fetchOffers();
    } catch (e) {
      showToast(e?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Open counter offer modal
  const openCounterModal = (offer) => {
    setSelectedOffer(offer);
    setCounterPrice(offer.offerPrice || '');
  };

  // Handle submit counter offer
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOffer || !counterPrice) return;

    setSubmittingCounter(true);
    try {
      await offerService.counterOffer(selectedOffer.offerId, Number(counterPrice));
      showToast(t('toast.saved_success'), 'success');
      setSelectedOffer(null);
      fetchOffers();
    } catch (e) {
      showToast(e?.response?.data || t('common.error_occurred'), 'error');
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Status badge styling helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return { label: t('offer_list.status_pending'), bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'CounterOffer':
        return { label: t('seller_dashboard.contact'), bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'Accepted':
        return { label: t('offer_list.status_accepted'), bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'Rejected':
        return { label: t('offer_list.status_rejected'), bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'Cancelled':
        return { label: t('history.status_cancelled'), bg: 'bg-gray-100 text-gray-600 border-gray-200' };
      case 'Completed':
        return { label: t('sales_stats.completed'), bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { label: status, bg: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  // Filter & Search Logic
  const filteredOffers = useMemo(() => {
    return offers
      .filter((offer) => {
        if (filterStatus !== 'all' && offer.status !== filterStatus) return false;

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const pName = (offer.productName || '').toLowerCase();
          const bName = (offer.buyerName || '').toLowerCase();
          const id = (offer.offerId || '').toLowerCase();
          if (!pName.includes(query) && !bName.includes(query) && !id.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'price_desc') return b.offerPrice - a.offerPrice;
        if (sortBy === 'price_asc') return a.offerPrice - b.offerPrice;
        return 0;
      });
  }, [offers, filterStatus, searchQuery, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage) || 1;
  const paginatedOffers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOffers.slice(start, start + itemsPerPage);
  }, [filteredOffers, currentPage, itemsPerPage]);

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface text-on-surface font-body-md animate-fade-in bg-[#f9f9f8]">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200/60 pb-6">
            <div>
              <span className="text-secondary font-bold text-xs uppercase tracking-widest text-[#1b6b51]">{t('seller.offers_received')}</span>
              <h1 className="font-headline-md text-headline-md text-gray-900 mt-1 mb-2 font-serif text-3xl font-bold">{t('offer_list.title')}</h1>
              <p className="text-gray-500 font-body-md max-w-xl text-sm leading-relaxed">
                {t('offer_list.subtitle')}
              </p>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-8 border-b border-gray-200 px-2 mb-4">
              <button
                onClick={() => {
                  setActiveTab('ALL');
                  setCurrentPage(1);
                }}
                className={`pb-4 text-xs font-bold uppercase tracking-wider relative transition-all ${activeTab === 'ALL'
                  ? 'text-[#1b6b51] border-b-2 border-[#1b6b51]'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                {t('offer_list.title')}
                <span className="ml-2 bg-[#1b6b51] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {offers.length}
                </span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <div className="relative w-full">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder={t('common.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#1b6b51] transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1b6b51]"
                >
                  <option value="all">{t('common.all')}</option>
                  <option value="Pending">{t('offer_list.status_pending')}</option>
                  <option value="CounterOffer">{t('seller_dashboard.contact')}</option>
                  <option value="Accepted">{t('offer_list.status_accepted')}</option>
                  <option value="Rejected">{t('offer_list.status_rejected')}</option>
                  <option value="Completed">{t('sales_stats.completed')}</option>
                  <option value="Cancelled">{t('history.status_cancelled')}</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1b6b51]"
                >
                  <option value="newest">{t('product.sort_newest')}</option>
                  <option value="price_desc">{t('product.sort_price_desc')}</option>
                  <option value="price_asc">{t('product.sort_price_asc')}</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1b6b51] border-t-transparent mb-3"></div>
                  <p className="text-sm">{t('common.loading')}</p>
                </div>
              ) : paginatedOffers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">local_offer</span>
                  <p className="font-semibold text-gray-700">{t('common.no_data')}</p>
                  <p className="text-xs text-gray-400 mt-1">{t('offer_list.subtitle')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-4 px-6">{t('offer_list.th_product')}</th>
                        <th className="py-4 px-6">{t('offer_list.th_buyer')}</th>
                        <th className="py-4 px-6">{t('offer_list.th_offer_amount')}</th>
                        <th className="py-4 px-6">{t('auction.time_remaining')}</th>
                        <th className="py-4 px-6">{t('offer_list.th_status')}</th>
                        <th className="py-4 px-6 text-right">{t('offer_list.th_action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {paginatedOffers.map((offer) => {
                        const badge = getStatusBadge(offer.status);
                        const isPending = offer.status === 'Pending';
                        const discountPct = offer.originalPrice
                          ? Math.round(((offer.originalPrice - offer.offerPrice) / offer.originalPrice) * 100)
                          : 0;

                        return (
                          <tr key={offer.offerId} className="hover:bg-gray-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <img
                                  src={offer.productImage || 'https://placehold.co/80'}
                                  alt={offer.productName}
                                  className="w-12 h-12 object-cover rounded-lg border border-gray-100 shadow-sm"
                                />
                                <div>
                                  <span className="font-semibold text-gray-900 line-clamp-1 max-w-[200px]">
                                    {offer.productName || t('common.unnamed_product')}
                                  </span>
                                  <span className="text-xs text-gray-400 block mt-0.5">
                                    {t('offer_list.th_original_price')}: {formatVnd(offer.originalPrice)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-medium text-gray-800">{offer.buyerName || t('common.unknown_buyer')}</div>
                              <div className="text-xs text-gray-400">{offer.buyerEmail || ''}</div>
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-bold text-[#1b6b51]">{formatVnd(offer.offerPrice)}</div>
                              {discountPct > 0 && (
                                <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  -{discountPct}%
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-6">
                              <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                {calculateTimeRemaining(offer.expiresAt, t)}
                              </span>
                            </td>

                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg}`}>
                                {badge.label}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => handleOpenAcceptModal(offer)}
                                    className="px-3 py-1.5 bg-[#1b6b51] text-white rounded-md hover:bg-[#15533f] text-xs font-semibold transition-all shadow-sm"
                                  >
                                    {t('offer_list.accept')}
                                  </button>
                                  <button
                                    onClick={() => openCounterModal(offer)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 text-xs font-semibold transition-all"
                                  >
                                    {t('seller_dashboard.contact')}
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(offer)}
                                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100 text-xs font-semibold transition-all"
                                  >
                                    {t('offer_list.reject')}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">{badge.label}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
                  <div className="text-xs text-gray-500">
                    {t('common.page')} <span className="font-semibold text-gray-700">{currentPage}</span> {t('common.of')}{' '}
                    <span className="font-semibold text-gray-700">{totalPages}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                    >
                      {t('common.previous')}
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded text-xs font-semibold ${currentPage === p ? 'bg-[#1b6b51] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                    >
                      {t('common.next')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Counter offer modal */}
      {selectedOffer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 font-serif mb-1">{t('offer_list.title')}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {t('offer_list.subtitle')}
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('offer_list.th_product')}:</span>
                <span className="font-semibold text-gray-800 line-clamp-1 max-w-[200px]">{selectedOffer.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('offer_list.th_original_price')}:</span>
                <span className="font-semibold text-gray-800">{formatVnd(selectedOffer.originalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('offer_list.th_offer_amount')}:</span>
                <span className="font-bold text-amber-700">{formatVnd(selectedOffer.offerPrice)}</span>
              </div>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t('offer_list.th_offer_amount')} *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatFormattedNumber(counterPrice)}
                  onChange={(e) => setCounterPrice(parseRawNumber(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1b6b51]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOffer(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingCounter}
                  className="px-4 py-2 bg-[#1b6b51] text-white rounded-lg text-xs font-semibold hover:bg-[#15533f] disabled:opacity-50"
                >
                  {submittingCounter ? t('common.submitting') : t('common.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Action Confirm Modal (Accept / Reject) */}
      {actionConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 font-serif mb-2">
              {actionConfirm.type === 'accept' ? t('offer_list.accept') : t('offer_list.reject')}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {actionConfirm.type === 'accept'
                ? t('offer_list.confirm_accept_msg', { price: formatVnd(actionConfirm.offer.offerPrice), product: actionConfirm.offer.productName })
                : t('offer_list.confirm_reject_msg', { price: formatVnd(actionConfirm.offer.offerPrice), product: actionConfirm.offer.productName })}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submittingAction}
                onClick={() => setActionConfirm(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={submittingAction}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                  actionConfirm.type === 'accept'
                    ? 'bg-[#1b6b51] hover:bg-[#15533f]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingAction ? t('common.submitting') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

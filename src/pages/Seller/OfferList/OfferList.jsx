import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import offerService from '../../../services/offerService';
import { useToast } from '../../../context/ToastContext';

function formatVnd(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(value)) + ' VND';
}

function calculateTimeRemaining(expiresAtStr) {
  if (!expiresAtStr) return '—';
  const expiresAt = new Date(expiresAtStr);
  const now = new Date();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) return 'Closed';

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHrs > 24) {
    const days = Math.floor(diffHrs / 24);
    const hours = diffHrs % 24;
    return `${days}d ${hours}h`;
  }

  return `${diffHrs}h ${diffMins}m`;
}

export default function OfferList() {
  const { user } = useOutletContext();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Offers states
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, price_desc, price_asc
  const [filterStatus, setFilterStatus] = useState('all'); // all, Pending, CounterOffer, Accepted, Rejected, Cancelled, Completed

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Counter-offer modal states
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [submittingCounter, setSubmittingCounter] = useState(false);

  // Fetch offers from backend
  const fetchOffers = async () => {
    setLoading(true);
    try {
      const data = await offerService.getSellerOffers();
      setOffers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching seller offers:', error);
      showToast('Failed to load received offers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.userId) {
      fetchOffers();
    }
  }, [user]);

  // Handle Accept
  const handleAccept = async (offerId) => {
    if (!window.confirm('Are you sure you want to accept this offer?')) return;
    try {
      await offerService.acceptSellerOffer(offerId);
      showToast('Offer accepted successfully!', 'success');
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || 'Failed to accept offer.';
      showToast(typeof errMsg === 'string' ? errMsg : 'Failed to accept offer.', 'error');
    }
  };

  // Handle Reject
  const handleReject = async (offerId) => {
    if (!window.confirm('Are you sure you want to reject this offer?')) return;
    try {
      await offerService.rejectSellerOffer(offerId);
      showToast('Offer rejected successfully.', 'info');
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || 'Failed to reject offer.';
      showToast(typeof errMsg === 'string' ? errMsg : 'Failed to reject offer.', 'error');
    }
  };

  // Open counter offer modal
  const openCounterModal = (offer) => {
    setSelectedOffer(offer);
    setCounterPrice('');
  };

  // Submit counter offer
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    if (!counterPrice || Number(counterPrice) <= 0) {
      showToast('Please enter a valid counter price.', 'warning');
      return;
    }

    const price = Number(counterPrice);
    if (price <= selectedOffer.offerPrice) {
      showToast(`Counter price must be greater than the buyer's offer (${formatVnd(selectedOffer.offerPrice)}).`, 'warning');
      return;
    }
    if (price >= selectedOffer.originalPrice) {
      showToast(`Counter price must be lower than the product's original price (${formatVnd(selectedOffer.originalPrice)}).`, 'warning');
      return;
    }

    setSubmittingCounter(true);
    try {
      await offerService.counterOffer(selectedOffer.offerId, price);
      showToast('Counter offer proposed successfully!', 'success');
      setSelectedOffer(null);
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || 'Failed to submit counter offer.';
      showToast(typeof errMsg === 'string' ? errMsg : 'Failed to submit counter offer.', 'error');
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Tab Filtering & Search
  const filteredOffers = useMemo(() => {
    let result = [...offers];

    // Filter by active/past tab
    if (activeTab === 'ALL') {
      result = [...result];
    }
    else if (activeTab === 'PENDING') {
      result = result.filter(
        o => o.status === 'Pending'
      );
    }
    else if (activeTab === 'RECEIVED') {
      result = result.filter(
        o =>
          o.status === 'Accepted' ||
          o.status === 'Rejected' ||
          o.status === 'CounterOffer' ||
          o.status === 'Cancelled' ||
          o.status === 'Completed'
      );
    }

    // Sorting
    if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => (b.offerPrice || 0) - (a.offerPrice || 0));
    } else if (sortBy === 'price_asc') {
      result.sort((a, b) => (a.offerPrice || 0) - (b.offerPrice || 0));
    }

    return result;
  }, [offers, activeTab, searchQuery, sortBy, filterStatus]);

  // Pagination slicing
  const totalItems = filteredOffers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedOffers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOffers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOffers, currentPage]);

  // Statistics calculation
  const stats = useMemo(() => {
    const active = offers.filter(o => o.status === 'Pending' || o.status === 'CounterOffer').length;
    const pendingApproval = offers.filter(o => o.status === 'Pending').length;
    const accepted = offers.filter(o => o.status === 'Accepted' || o.status === 'Completed').length;
    const total = offers.length;
    const rate = total ? Math.round((accepted / total) * 100) : 68;

    return {
      active,
      pendingApproval,
      acceptanceRate: rate,
    };
  }, [offers]);

  // Generate activities dynamically from real offer list
  const recentActivities = useMemo(() => {
    return offers
      .slice(0, 3)
      .map(o => {
        let action = 'Offer Received';
        let detail = `${o.buyerName || 'Collector'} for ${o.productName || 'product'}`;
        if (o.status === 'Accepted') {
          action = 'Offer Accepted';
        } else if (o.status === 'Rejected') {
          action = 'Offer Rejected';
        } else if (o.status === 'CounterOffer') {
          action = 'Counter Offer Proposed';
          detail = `You proposed ${formatVnd(o.offerPrice)} on ${o.productName}`;
        } else if (o.status === 'Completed') {
          action = 'Negotiation Completed';
          detail = `${o.buyerName || 'Buyer'} checked out ${o.productName}`;
        }

        const timeDiff = new Date() - new Date(o.createdAt);
        const mins = Math.floor(timeDiff / (1000 * 60));
        let timeStr = 'Just now';
        if (mins > 0) {
          if (mins < 60) timeStr = `${mins} mins ago`;
          else {
            const hrs = Math.floor(mins / 60);
            if (hrs < 24) timeStr = `${hrs} hours ago`;
            else timeStr = `${Math.floor(hrs / 24)} days ago`;
          }
        }

        return {
          id: o.offerId,
          action,
          detail,
          time: timeStr,
          status: o.status,
        };
      });
  }, [offers]);

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface text-on-surface font-body-md animate-fade-in bg-[#f9f9f8]">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200/60 pb-6">
            <div>
              <span className="text-secondary font-bold text-xs uppercase tracking-widest text-[#1b6b51]">Atelier Workspace</span>
              <h1 className="font-headline-md text-headline-md text-gray-900 mt-1 mb-2 font-serif text-3xl font-bold">Offer Management</h1>
              <p className="text-gray-500 font-body-md max-w-xl text-sm leading-relaxed">
                Review and negotiate bids from premium collectors. Maintain shop prestige through prompt communications and balanced counter-offers.
              </p>
            </div>
            <div>
              <button
                onClick={() => navigate('/seller-dashboard/products/new')}
                className="flex items-center justify-center gap-2 bg-[#1b6b51] text-white px-6 py-3 rounded-lg hover:bg-[#15533f] transition-all text-sm font-semibold shadow-md"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                New Listing
              </button>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Table Section (Column 1-9) */}
          <div className="col-span-12 space-y-6">
            {/* Tabs */}
            <div className="flex items-center gap-8 border-b border-gray-200 px-2 mb-4">
              {/* All Offers */}
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
                OFFER LIST
                <span className="ml-2 bg-[#1b6b51] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {offers.length}
                </span>
              </button>

              {/* Pending Offers */}
              <button
                onClick={() => {
                  setActiveTab('PENDING');
                  setCurrentPage(1);
                }}
                className={`pb-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'PENDING'
                  ? 'text-[#1b6b51] border-b-2 border-[#1b6b51]'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                PENDING OFFERS
                <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {offers.filter(o => o.status === 'Pending').length}
                </span>
              </button>

              {/* Received Offers */}
              <button
                onClick={() => {
                  setActiveTab('RECEIVED');
                  setCurrentPage(1);
                }}
                className={`pb-4 text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'RECEIVED'
                  ? 'text-[#1b6b51] border-b-2 border-[#1b6b51]'
                  : 'text-gray-400 hover:text-gray-600'
                  }`}
              >
                RECEIVED OFFERS
                <span className="ml-2 bg-gray-200 text-gray-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {
                    offers.filter(
                      o =>
                        o.status === 'Accepted' ||
                        o.status === 'Rejected' ||
                        o.status === 'CounterOffer' ||
                        o.status === 'Cancelled' ||
                        o.status === 'Completed'
                    ).length
                  }
                </span>
              </button>
            </div>
            {/* High-Density Table Card */}
            <div className="bg-white rounded-xl shadow-[0px_4px_24px_rgba(0,0,0,0.02)] border border-gray-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-150">
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Product Info</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Buyer Name</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Offer & Ask Diff</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Time Limit</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="text-center py-12 text-gray-400">
                          <span className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#1b6b51] border-t-transparent mr-2"></span>
                          Loading received offers...
                        </td>
                      </tr>
                    ) : paginatedOffers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-16 text-gray-400">
                          <span className="material-symbols-outlined text-5xl block mb-2 opacity-30 text-gray-400">inbox</span>
                          <span className="text-sm font-semibold">No offers match the filters.</span>
                        </td>
                      </tr>
                    ) : (
                      paginatedOffers.map((offer) => {
                        // Calculate price diff percent vs Original Listing Price (Ask)
                        const diffVal = (offer.offerPrice || 0) - (offer.originalPrice || 0);
                        const percentDiff = offer.originalPrice
                          ? Math.round((diffVal / offer.originalPrice) * 100)
                          : 0;

                        const timeRemaining = calculateTimeRemaining(offer.expiresAt);

                        return (
                          <tr key={offer.offerId} className="offer-row hover:bg-gray-50/40 transition-colors group">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0 border border-gray-100">
                                  {offer.productImageUrl ? (
                                    <img src={offer.productImageUrl} alt={offer.productName} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs">RE</div>
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 text-sm mb-0.5 leading-snug">{offer.productName}</p>
                                  <div className="flex gap-2 items-center text-xs text-gray-400">
                                    <span>ID: #{offer.productId ? offer.productId.slice(0, 8) : 'N/A'}</span>
                                    <span>•</span>
                                    <span className="font-medium text-gray-500">Ask: {formatVnd(offer.originalPrice)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#e6f5ef] flex items-center justify-center font-bold text-[#0f7b5f] text-xs">
                                  {(offer.buyerName || 'C').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900 text-sm leading-tight">{offer.buyerName || 'Premium Buyer'}</p>
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <span className="material-symbols-outlined text-[12px] text-[#6bd9c8]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                      verified
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">VIP Collector</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <p className="font-bold text-gray-900 text-sm leading-tight">{formatVnd(offer.offerPrice)}</p>
                              {percentDiff < 0 ? (
                                <p className="text-[10px] text-red-600 font-bold uppercase mt-0.5">{percentDiff}% vs Ask</p>
                              ) : percentDiff > 0 ? (
                                <p className="text-[10px] text-[#0f7b5f] font-bold uppercase mt-0.5">+{percentDiff}% vs Ask</p>
                              ) : (
                                <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">At Ask Price</p>
                              )}
                            </td>
                            <td className="px-6 py-5">
                              {offer.status === 'Pending' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  PENDING
                                </span>
                              ) : offer.status === 'CounterOffer' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  COUNTER OFFERED
                                </span>
                              ) : offer.status === 'Accepted' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e6f5ef] text-[#0f7b5f] border border-[#a6f2d1]">
                                  ACCEPTED
                                </span>
                              ) : offer.status === 'Rejected' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  REJECTED
                                </span>
                              ) : offer.status === 'Completed' ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-350">
                                  COMPLETED
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                  {offer.status?.toUpperCase() || 'UNKNOWN'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-5">
                              <p className={`text-xs font-semibold ${timeRemaining === 'Closed' ? 'text-gray-400 font-normal italic' : 'text-gray-900'}`}>
                                {timeRemaining}
                              </p>
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1.5">
                                {offer.status === 'Pending' ? (
                                  <>
                                    <button
                                      onClick={() => handleAccept(offer.offerId)}
                                      className="p-1.5 hover:bg-green-50 text-[#0f7b5f] rounded-lg transition-colors border border-transparent hover:border-green-200"
                                      title="Accept Offer"
                                    >
                                      <span className="material-symbols-outlined text-lg">check_circle</span>
                                    </button>
                                    <button
                                      onClick={() => handleReject(offer.offerId)}
                                      className="p-1.5 hover:bg-red-50 text-red-650 rounded-lg transition-colors border border-transparent hover:border-red-250 text-red-600"
                                      title="Reject Offer"
                                    >
                                      <span className="material-symbols-outlined text-lg">cancel</span>
                                    </button>
                                    <button
                                      onClick={() => openCounterModal(offer)}
                                      className="p-1.5 hover:bg-indigo-50 text-indigo-700 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                                      title="Counter Offer"
                                    >
                                      <span className="material-symbols-outlined text-lg">swap_horiz</span>
                                    </button>
                                  </>
                                ) : offer.status === 'CounterOffer' ? (
                                  <>
                                    <button
                                      onClick={() => openCounterModal(offer)}
                                      className="p-1.5 hover:bg-indigo-50 text-indigo-700 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                                      title="Adjust Counter Price"
                                    >
                                      <span className="material-symbols-outlined text-lg font-bold">swap_horiz</span>
                                    </button>
                                    <span className="text-[11px] text-gray-400 italic flex items-center pr-2">Awaiting buyer response</span>
                                  </>
                                ) : (
                                  <span className="text-gray-400 text-xs italic pr-2 select-none">Archived</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t border-gray-150">
                <span className="text-xs text-gray-500 font-semibold">
                  Showing {paginatedOffers.length} of {totalItems} negotiations
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded-md hover:bg-gray-200 border border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-7 h-7 rounded-md text-xs font-bold ${currentPage === i + 1
                        ? 'bg-[#1b6b51] text-white'
                        : 'text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded-md hover:bg-gray-200 border border-gray-200 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Negotiation Sidebar (Column 10-12) */}
        </div>
      </div>

      {/* Counter Offer Modal */}
      {selectedOffer && (
        <div className="offer-modal-overlay flex items-center justify-center fixed inset-0 bg-black/60 z-50 backdrop-blur-sm">
          <div className="offer-modal bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in relative mx-4 border border-gray-100">
            <button
              onClick={() => setSelectedOffer(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2 border-b border-gray-100 pb-3">
              <span className="material-symbols-outlined text-[#0f7b5f] text-2xl">swap_horiz</span>
              Propose Counter Offer
            </h3>

            <div className="space-y-4 mb-4">
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-sm text-gray-600 border border-gray-100">
                <div className="flex justify-between">
                  <span>Product:</span>
                  <span className="font-semibold text-gray-900">{selectedOffer.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Original Price:</span>
                  <span className="font-bold text-gray-800">{formatVnd(selectedOffer.originalPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buyer's Offer:</span>
                  <span className="font-semibold text-red-600">{formatVnd(selectedOffer.offerPrice)}</span>
                </div>
              </div>

              <form onSubmit={handleCounterSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Your Counter Price (VND)
                  </label>
                  <input
                    type="number"
                    value={counterPrice}
                    onChange={(e) => setCounterPrice(e.target.value)}
                    required
                    autoFocus
                    placeholder="Enter counter price"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1b6b51] focus:ring-1 focus:ring-[#1b6b51] transition-all bg-gray-50/30"
                  />
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed italic bg-amber-50 text-amber-800 p-2 rounded-lg border border-amber-100">
                    * Rules: Price must be strictly between <strong>{formatVnd(selectedOffer.offerPrice)}</strong> and <strong>{formatVnd(selectedOffer.originalPrice)}</strong>.
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-gray-150">
                  <button
                    type="button"
                    onClick={() => setSelectedOffer(null)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCounter}
                    className="px-5 py-2.5 bg-[#1b6b51] text-white rounded-lg text-xs font-bold hover:bg-[#15533f] transition-all disabled:opacity-50"
                  >
                    {submittingCounter ? 'Submitting...' : 'Submit Counter'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

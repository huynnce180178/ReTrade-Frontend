import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import offerService from '../../../services/offerService';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';

function formatVnd(value) {
  if (value == null) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(value)) + ' VND';
}

function calculateTimeRemaining(expiresAtStr, isVi) {
  if (!expiresAtStr) return '—';
  const expiresAt = new Date(expiresAtStr);
  const now = new Date();
  const diffMs = expiresAt - now;

  if (diffMs <= 0) return isVi ? 'Đã đóng' : 'Closed';

  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffHrs > 24) {
    const days = Math.floor(diffHrs / 24);
    const hours = diffHrs % 24;
    return `${days}${isVi ? 'ngày' : 'd'} ${hours}${isVi ? 'giờ' : 'h'}`;
  }

  return `${diffHrs}${isVi ? 'giờ' : 'h'} ${diffMins}${isVi ? 'phút' : 'm'}`;
}

export default function OfferList() {
  const { user } = useOutletContext();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

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
      showToast(isVi ? 'Không thể tải danh sách đề xuất trả giá.' : 'Failed to load received offers.', 'error');
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
    if (!window.confirm(isVi ? 'Bạn có chắc chắn muốn chấp nhận mức giá đề xuất này?' : 'Are you sure you want to accept this offer?')) return;
    try {
      await offerService.acceptSellerOffer(offerId);
      showToast(isVi ? 'Chấp nhận đề xuất trả giá thành công!' : 'Offer accepted successfully!', 'success');
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || (isVi ? 'Không thể chấp nhận đề xuất.' : 'Failed to accept offer.');
      showToast(typeof errMsg === 'string' ? errMsg : (isVi ? 'Không thể chấp nhận đề xuất.' : 'Failed to accept offer.'), 'error');
    }
  };

  // Handle Reject
  const handleReject = async (offerId) => {
    if (!window.confirm(isVi ? 'Bạn có chắc chắn muốn từ chối mức giá đề xuất này?' : 'Are you sure you want to reject this offer?')) return;
    try {
      await offerService.rejectSellerOffer(offerId);
      showToast(isVi ? 'Đã từ chối đề xuất trả giá.' : 'Offer rejected successfully.', 'info');
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || (isVi ? 'Không thể từ chối đề xuất.' : 'Failed to reject offer.');
      showToast(typeof errMsg === 'string' ? errMsg : (isVi ? 'Không thể từ chối đề xuất.' : 'Failed to reject offer.'), 'error');
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
      showToast(isVi ? 'Vui lòng nhập mức giá phản hồi hợp lệ.' : 'Please enter a valid counter price.', 'warning');
      return;
    }

    const price = Number(counterPrice);
    if (price <= selectedOffer.offerPrice) {
      showToast(isVi ? `Giá phản hồi phải lớn hơn giá đề xuất của người mua (${formatVnd(selectedOffer.offerPrice)}).` : `Counter price must be greater than the buyer's offer (${formatVnd(selectedOffer.offerPrice)}).`, 'warning');
      return;
    }
    if (price >= selectedOffer.originalPrice) {
      showToast(isVi ? `Giá phản hồi phải nhỏ hơn giá gốc của sản phẩm (${formatVnd(selectedOffer.originalPrice)}).` : `Counter price must be lower than the product's original price (${formatVnd(selectedOffer.originalPrice)}).`, 'warning');
      return;
    }

    setSubmittingCounter(true);
    try {
      await offerService.createCounterOffer(selectedOffer.offerId, price);
      showToast(isVi ? 'Đã gửi đề xuất thương lượng thành công!' : 'Counter-offer sent successfully!', 'success');
      setSelectedOffer(null);
      fetchOffers();
    } catch (error) {
      const errMsg = error.response?.data || error.message || (isVi ? 'Không thể gửi đề xuất thương lượng.' : 'Failed to send counter offer.');
      showToast(typeof errMsg === 'string' ? errMsg : (isVi ? 'Không thể gửi đề xuất thương lượng.' : 'Failed to send counter offer.'), 'error');
    } finally {
      setSubmittingCounter(false);
    }
  };

  // Status mapping badge helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Pending':
        return { label: isVi ? 'Chờ Duyệt' : 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'CounterOffer':
        return { label: isVi ? 'Thương Lượng' : 'Counter Offer', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'Accepted':
        return { label: isVi ? 'Chấp Nhận' : 'Accepted', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'Rejected':
        return { label: isVi ? 'Từ Chối' : 'Rejected', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'Cancelled':
        return { label: isVi ? 'Đã Hủy' : 'Cancelled', bg: 'bg-gray-100 text-gray-600 border-gray-200' };
      case 'Completed':
        return { label: isVi ? 'Đã Mua' : 'Completed', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
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
              <span className="text-secondary font-bold text-xs uppercase tracking-widest text-[#1b6b51]">{isVi ? 'Kênh Quản Lý Đề Xuất' : 'Atelier Workspace'}</span>
              <h1 className="font-headline-md text-headline-md text-gray-900 mt-1 mb-2 font-serif text-3xl font-bold">{isVi ? 'Quản Lý Đề Xuất Trả Giá' : 'Offer Management'}</h1>
              <p className="text-gray-500 font-body-md max-w-xl text-sm leading-relaxed">
                {isVi ? 'Xem xét và thương lượng mức giá từ người mua. Phản hồi nhanh chóng để tăng tỷ lệ chốt đơn cho gian hàng.' : 'Review and negotiate bids from premium collectors. Maintain shop prestige through prompt communications and balanced counter-offers.'}
              </p>
            </div>
            <div>
              <button
                onClick={() => navigate('/seller-dashboard/products/new')}
                className="flex items-center justify-center gap-2 bg-[#1b6b51] text-white px-6 py-3 rounded-lg hover:bg-[#15533f] transition-all text-sm font-semibold shadow-md"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                {isVi ? 'Đăng Sản Phẩm Mới' : 'New Listing'}
              </button>
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
                {isVi ? 'DANH SÁCH ĐỀ XUẤT' : 'OFFER LIST'}
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
                    placeholder={isVi ? 'Tìm theo tên sản phẩm, mã đề xuất hoặc người mua...' : 'Search by product name, offer code or buyer...'}
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
                  <option value="all">{isVi ? 'Tất cả trạng thái' : 'All Statuses'}</option>
                  <option value="Pending">{isVi ? 'Chờ xử lý' : 'Pending'}</option>
                  <option value="CounterOffer">{isVi ? 'Thương lượng' : 'Counter Offer'}</option>
                  <option value="Accepted">{isVi ? 'Đã chấp nhận' : 'Accepted'}</option>
                  <option value="Rejected">{isVi ? 'Đã từ chối' : 'Rejected'}</option>
                  <option value="Completed">{isVi ? 'Đã hoàn tất mua' : 'Completed'}</option>
                  <option value="Cancelled">{isVi ? 'Đã hủy' : 'Cancelled'}</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1b6b51]"
                >
                  <option value="newest">{isVi ? 'Mới nhất' : 'Newest'}</option>
                  <option value="price_desc">{isVi ? 'Giá đề xuất: Cao đến Thấp' : 'Offer Price: High to Low'}</option>
                  <option value="price_asc">{isVi ? 'Giá đề xuất: Thấp đến Cao' : 'Offer Price: Low to High'}</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#1b6b51] border-t-transparent mb-3"></div>
                  <p className="text-sm">{isVi ? 'Đang tải đề xuất trả giá...' : 'Loading offers...'}</p>
                </div>
              ) : paginatedOffers.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">local_offer</span>
                  <p className="font-semibold text-gray-700">{isVi ? 'Không tìm thấy đề xuất trả giá nào' : 'No offers found'}</p>
                  <p className="text-xs text-gray-400 mt-1">{isVi ? 'Thử điều chỉnh từ khóa tìm kiếm hoặc bộ lọc trạng thái.' : 'Try adjusting your search criteria or filter status.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="py-4 px-6">{isVi ? 'Mặt Hàng' : 'Listing Item'}</th>
                        <th className="py-4 px-6">{isVi ? 'Người Mua' : 'Buyer'}</th>
                        <th className="py-4 px-6">{isVi ? 'Giá Đề Xuất' : 'Offer Price'}</th>
                        <th className="py-4 px-6">{isVi ? 'Thời Hạn' : 'Time Remaining'}</th>
                        <th className="py-4 px-6">{isVi ? 'Trạng Thái' : 'Status'}</th>
                        <th className="py-4 px-6 text-right">{isVi ? 'Thao Tác' : 'Action'}</th>
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
                                    {offer.productName || 'Unnamed Item'}
                                  </span>
                                  <span className="text-xs text-gray-400 block mt-0.5">
                                    {isVi ? 'Giá niêm yết:' : 'List Price:'} {formatVnd(offer.originalPrice)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-medium text-gray-800">{offer.buyerName || 'Collector'}</div>
                              <div className="text-xs text-gray-400">{offer.buyerEmail || 'Verified Buyer'}</div>
                            </td>

                            <td className="py-4 px-6">
                              <div className="font-bold text-[#1b6b51]">{formatVnd(offer.offerPrice)}</div>
                              {discountPct > 0 && (
                                <span className="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                  -{discountPct}% {isVi ? 'so với giá bán' : 'off list'}
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-6">
                              <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                {calculateTimeRemaining(offer.expiresAt, isVi)}
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
                                    onClick={() => handleAccept(offer.offerId)}
                                    className="px-3 py-1.5 bg-[#1b6b51] text-white rounded-md hover:bg-[#15533f] text-xs font-semibold transition-all shadow-sm"
                                  >
                                    {isVi ? 'Chấp Nhận' : 'Accept'}
                                  </button>
                                  <button
                                    onClick={() => openCounterModal(offer)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 text-xs font-semibold transition-all"
                                  >
                                    {isVi ? 'Thương Lượng' : 'Counter'}
                                  </button>
                                  <button
                                    onClick={() => handleReject(offer.offerId)}
                                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100 text-xs font-semibold transition-all"
                                  >
                                    {isVi ? 'Từ Chối' : 'Reject'}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400 italic">{isVi ? 'Đã phản hồi' : 'Action taken'}</span>
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
                    {isVi ? 'Hiển thị' : 'Showing'} <span className="font-semibold text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> {isVi ? 'đến' : 'to'}{' '}
                    <span className="font-semibold text-gray-700">{Math.min(currentPage * itemsPerPage, filteredOffers.length)}</span> {isVi ? 'trên' : 'of'}{' '}
                    <span className="font-semibold text-gray-700">{filteredOffers.length}</span> {isVi ? 'đề xuất' : 'offers'}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      className="px-3 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                    >
                      {isVi ? 'Trước' : 'Previous'}
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
                      {isVi ? 'Sau' : 'Next'}
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
            <h3 className="text-lg font-bold text-gray-900 font-serif mb-1">{isVi ? 'Đề Xuất Giá Phản Hồi' : 'Propose Counter-Offer'}</h3>
            <p className="text-xs text-gray-500 mb-4">
              {isVi ? 'Đưa ra mức giá phản hồi hợp lý cho người mua.' : 'Send a modified price offer back to the buyer.'}
            </p>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{isVi ? 'Sản phẩm:' : 'Product:'}</span>
                <span className="font-semibold text-gray-800 line-clamp-1 max-w-[200px]">{selectedOffer.productName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isVi ? 'Giá gốc:' : 'List Price:'}</span>
                <span className="font-semibold text-gray-800">{formatVnd(selectedOffer.originalPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{isVi ? 'Giá người mua đề xuất:' : "Buyer's Offer:"}</span>
                <span className="font-bold text-amber-700">{formatVnd(selectedOffer.offerPrice)}</span>
              </div>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{isVi ? 'Mức Giá Phản Hồi (VND) *' : 'Counter Price (VND) *'}</label>
                <input
                  type="number"
                  required
                  placeholder={isVi ? 'Nhập mức giá phản hồi...' : 'Enter your counter price...'}
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#1b6b51]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOffer(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200"
                >
                  {isVi ? 'Hủy Bỏ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={submittingCounter}
                  className="px-4 py-2 bg-[#1b6b51] text-white rounded-lg text-xs font-semibold hover:bg-[#15533f] disabled:opacity-50"
                >
                  {submittingCounter ? (isVi ? 'Đang gửi...' : 'Sending...') : (isVi ? 'Gửi Đề Xuất Phản Hồi' : 'Send Counter Offer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

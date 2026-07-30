import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import productService from '../../../services/productService';
import addressService from '../../../services/addressService';
import checkoutService from '../../../services/checkoutService';
import voucherService from '../../../services/voucherService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import vietnamAddressService from '../../../services/vietnamAddressService';
import { createVnPayPaymentUrl } from '../../../services/paymentService';

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t, language, formatCurrency } = useLanguage();

  const [product, setProduct] = useState(null);
  const [address, setAddress] = useState(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Extra states for payment & voucher
  const [paymentMethod, setPaymentMethod] = useState('vnpay');
  const [voucherCode, setVoucherCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedVoucherCode, setAppliedVoucherCode] = useState('');
  const [myVouchers, setMyVouchers] = useState([]);
  const [isOpenVoucherDropdown, setIsOpenVoucherDropdown] = useState(false);
  const [selectedDetailVoucher, setSelectedDetailVoucher] = useState(null);
  const [fullAddressNames, setFullAddressNames] = useState({ province: '', districtWard: '' });

  const calculateVoucherDiscount = (v, orderSubtotal, orderShippingFee = 0) => {
    if (!v) return 0;
    const minSpend = v.minOrderValue || 0;
    if (orderSubtotal < minSpend) return 0;

    let discount = 0;
    if (v.discountType === 'Percentage') {
      discount = orderSubtotal * ((v.discountValue || 0) / 100);
    } else if (v.discountType === 'Fixed') {
      discount = v.discountValue || 0;
    }

    if (v.maxDiscountValue && v.maxDiscountValue > 0) {
      discount = Math.min(discount, v.maxDiscountValue);
    }

    return Math.min(discount, orderSubtotal + orderShippingFee);
  };

  useEffect(() => {
    const fetchAddressNames = async () => {
      if (!address) return;
      try {
        let pName = address.provinceId;
        let dName = address.districtId;
        let wName = address.wardCode;

        const provinces = await vietnamAddressService.getProvinces();
        const p = provinces.find(x => String(x.code) === String(address.provinceId));
        if (p) pName = p.name;

        if (address.provinceId) {
          const districts = await vietnamAddressService.getDistricts(address.provinceId);
          const d = districts.find(x => String(x.code) === String(address.districtId));
          if (d) dName = d.name;
        }

        if (address.districtId) {
          const wards = await vietnamAddressService.getWards(address.districtId);
          const w = wards.find(x => String(x.code) === String(address.wardCode));
          if (w) wName = w.name;
        }

        setFullAddressNames({
          province: pName,
          districtWard: `${dName}, ${wName}`
        });
      } catch (err) {
      }
    };
    fetchAddressNames();
  }, [address]);

  useEffect(() => {
    if (productId) {
      fetchInitialData();
    } else {
      setLoading(false);
    }
  }, [productId]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const prodData = await productService.getById(productId);
      setProduct(prodData);

      const addrsData = await addressService.getMyAddresses();
      const addrs = Array.isArray(addrsData) ? addrsData : (addrsData?.data || addrsData?.items || addrsData?.value || []);
      const defaultAddr = addrs.find(a => a.isDefault) || addrs[0];

      if (defaultAddr) {
        setAddress(defaultAddr);
        await calculateFee(defaultAddr.addressId || defaultAddr.id || defaultAddr.AddressId);
      }

      // Load user claimed vouchers (Only currently ready/active vouchers)
      try {
        const vouchersData = await voucherService.getMyVouchers("$orderby=CreatedAt desc");
        const items = Array.isArray(vouchersData) ? vouchersData : (vouchersData?.value || vouchersData?.items || []);
        const now = new Date();
        const activeVouchers = items.filter(mv => {
          const isExpired = mv.expirationDate ? new Date(mv.expirationDate) < now : false;
          const isStarted = mv.startDate ? new Date(mv.startDate) <= now : true;
          const isActive = mv.status === 'Active' && !mv.usedAt;
          return isActive && isStarted && !isExpired;
        });

        const prodPrice = prodData?.price || 0;

        // Sort vouchers: eligible first (sorted by max calculated discount desc), then ineligible
        const sortedVouchers = [...activeVouchers].sort((a, b) => {
          const discA = calculateVoucherDiscount(a, prodPrice, 0);
          const discB = calculateVoucherDiscount(b, prodPrice, 0);
          const isEligA = prodPrice >= (a.minOrderValue || 0);
          const isEligB = prodPrice >= (b.minOrderValue || 0);

          if (isEligA && !isEligB) return -1;
          if (!isEligA && isEligB) return 1;
          if (isEligA && isEligB) {
            return discB - discA;
          }
          return (a.minOrderValue || 0) - (b.minOrderValue || 0);
        });

        setMyVouchers(sortedVouchers);

        // Auto apply best voucher if eligible and discount > 0
        const bestV = sortedVouchers.find(v => prodPrice >= (v.minOrderValue || 0) && calculateVoucherDiscount(v, prodPrice, 0) > 0);
        if (bestV) {
          try {
            const res = await checkoutService.validateVoucher(bestV.code, productId);
            let discount = 0;
            if (res.discountType === 'Percentage') {
              discount = prodPrice * (res.discountValue / 100);
            } else if (res.discountType === 'Fixed') {
              discount = res.discountValue;
            }
            if (res.maxDiscountValue && discount > res.maxDiscountValue) {
              discount = res.maxDiscountValue;
            }
            if (discount > prodPrice) {
              discount = prodPrice;
            }
            setDiscountAmount(discount);
            setAppliedVoucherCode(res.code);
            setVoucherCode(res.code);
          } catch (vErr) {
            console.error("Auto apply best voucher failed", vErr);
          }
        }
      } catch (err) {
        console.error("Failed to load user vouchers", err);
      }
    } catch (error) {
      showToast(language === 'vi' ? 'Không thể tải thông tin thanh toán.' : 'Failed to load checkout information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const calculateFee = async (addrId) => {
    try {
      const res = await checkoutService.calculateShippingFee({
        productId,
        addressId: addrId
      });
      setShippingFee(res.shippingFee || 0);
    } catch (error) {
      setShippingFee(0);
      const errMsg = error.response?.data?.message || error.response?.data || (language === 'vi' ? 'Không thể tính phí vận chuyển.' : 'Failed to calculate shipping fee');
      if (typeof errMsg === 'string') {
        showToast(errMsg, 'error');
      }
    }
  };

  const handleAddressSelect = async (selectedAddr) => {
    setAddress(selectedAddr);
    setIsPopupOpen(false);
    await calculateFee(selectedAddr.addressId || selectedAddr.id || selectedAddr.AddressId);
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      showToast(language === 'vi' ? 'Vui lòng nhập mã giảm giá.' : 'Please enter a voucher code', 'warning');
      return;
    }
    await applyVoucherByCode(voucherCode.trim());
  };

  const applyVoucherByCode = async (code) => {
    try {
      const res = await checkoutService.validateVoucher(code, productId);
      let discount = 0;
      if (res.discountType === 'Percentage') {
        discount = subtotal * (res.discountValue / 100);
      } else if (res.discountType === 'Fixed') {
        discount = res.discountValue;
      }
      if (res.maxDiscountValue && discount > res.maxDiscountValue) {
        discount = res.maxDiscountValue;
      }
      if (discount > subtotal + shippingFee) {
        discount = subtotal + shippingFee;
      }
      setDiscountAmount(discount);
      setAppliedVoucherCode(res.code);
      showToast(language === 'vi' ? 'Đã áp dụng mã giảm giá thành công!' : 'Voucher applied successfully!', 'success');
    } catch (error) {
      console.error(error);
      setDiscountAmount(0);
      setAppliedVoucherCode('');
      const errMsg = error.response?.data?.message || error.response?.data || (language === 'vi' ? 'Mã giảm giá không hợp lệ hoặc đã hết hạn.' : 'Invalid or inactive voucher code.');
      showToast(typeof errMsg === 'string' ? errMsg : (language === 'vi' ? 'Mã giảm giá không hợp lệ.' : 'Invalid or inactive voucher code.'), 'error');
    }
  };

  const handleRemoveVoucher = () => {
    setDiscountAmount(0);
    setAppliedVoucherCode('');
    setVoucherCode('');
    showToast(language === 'vi' ? 'Đã hủy áp dụng mã giảm giá.' : 'Voucher removed', 'info');
  };

  const handleCheckout = async () => {
    if (!address) {
      showToast(language === 'vi' ? 'Vui lòng chọn địa chỉ giao hàng.' : 'Please select a delivery address', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await checkoutService.createOrder({
        productId,
        addressId: address.addressId || address.id || address.AddressId,
        quantity: 1,
        paymentMethod,
        voucherCode: appliedVoucherCode || undefined
      });
      showToast(language === 'vi' ? 'Đặt hàng thành công!' : 'Order placed successfully!', 'success');

      if (paymentMethod === 'vnpay') {
        try {
          const paymentRes = await createVnPayPaymentUrl({
            orderId: res.orderId || res.OrderId,
            amount: total,
            orderDescription: `Payment for order ${res.orderId || res.OrderId}`
          });
          if (paymentRes?.paymentUrl) {
            window.location.href = paymentRes.paymentUrl;
            return;
          } else if (typeof paymentRes === 'string' && paymentRes.startsWith('http')) {
            window.location.href = paymentRes;
            return;
          } else {
            showToast(language === 'vi' ? 'Không thể tạo liên kết thanh toán VNPAY.' : 'Failed to create VNPAY payment URL', 'error');
          }
        } catch (paymentErr) {
          console.error(paymentErr);
          showToast(language === 'vi' ? 'Không thể kết nối đến VNPAY.' : 'Failed to connect to VNPAY', 'error');
        }
      }

      navigate('/purchase-history');
    } catch (error) {
      console.error(error);
      const serverErr = error.response?.data;
      let errMsg = '';
      if (typeof serverErr === 'string') {
        errMsg = serverErr;
      } else if (serverErr?.message) {
        errMsg = serverErr.message;
      } else if (serverErr?.title) {
        errMsg = serverErr.title;
      } else if (serverErr?.errors && typeof serverErr.errors === 'object') {
        errMsg = Object.values(serverErr.errors).flat().join(', ');
      } else {
        errMsg = error.message || (language === 'vi' ? 'Đặt hàng thất bại. Vui lòng thử lại.' : 'Order placement failed. Please try again.');
      }
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant">{language === 'vi' ? 'Đang tải thông tin thanh toán...' : 'Loading information...'}</div>;
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-on-surface-variant flex flex-col items-center justify-center min-h-[400px] gap-4">
        <span className="material-symbols-outlined text-6xl text-gray-400">shopping_cart_off</span>
        <h2 className="text-2xl font-bold text-gray-700">{language === 'vi' ? 'Không tìm thấy sản phẩm' : 'Product not found.'}</h2>
        <p className="text-gray-500">{language === 'vi' ? 'Vui lòng chọn một sản phẩm để thanh toán.' : 'Please select a product to checkout.'}</p>
        <button onClick={() => navigate('/product')} className="px-6 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-opacity-90 transition-all">
          {language === 'vi' ? 'KHÁM PHÁ SẢN PHẨM' : 'BROWSE PRODUCTS'}
        </button>
      </div>
    );
  }

  const subtotal = product.price || 0;
  const total = Math.max(0, subtotal + shippingFee - discountAmount);

  const bestVoucher = myVouchers.length > 0 ? (
    myVouchers.reduce((best, v) => {
      const d = calculateVoucherDiscount(v, subtotal, shippingFee);
      const bestD = best ? calculateVoucherDiscount(best, subtotal, shippingFee) : 0;
      return (subtotal >= (v.minOrderValue || 0) && d > 0 && d > bestD) ? v : best;
    }, null)
  ) : null;
  const bestVoucherCode = bestVoucher?.code || null;

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <main className="pb-section-gap max-w-container-max mx-auto px-margin-desktop pt-12">
        <div className="mb-stack-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary">{language === 'vi' ? 'Thanh Toán Đơn Hàng' : 'Checkout'}</h1>
          <p className="text-on-surface-variant mt-2 font-body-md">{language === 'vi' ? 'Hoàn tất địa chỉ và chọn phương thức thanh toán an toàn.' : 'Refining your acquisition of archival excellence.'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* Left Column: Shipping & Payment */}
          <div className="lg:col-span-7 space-y-stack-lg">

            {/* Shipping Address */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-stack-md">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">local_shipping</span>
                  <h2 className="font-headline-sm text-headline-sm">{language === 'vi' ? 'Địa Chỉ Giao Hàng' : 'Delivery Address'}</h2>
                </div>
                <button
                  onClick={() => setIsPopupOpen(true)}
                  className="flex items-center gap-2 text-secondary hover:text-primary transition-colors text-body-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  {language === 'vi' ? 'Thay đổi / Thêm Địa Chỉ' : 'Change / Add New Address'}
                </button>
              </div>

              {address ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">{language === 'vi' ? 'Họ và tên người nhận' : 'Full Name'}</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default font-semibold" type="text" value={address.receiverName || ''} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">{language === 'vi' ? 'Số điện thoại' : 'Phone Number'}</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default font-semibold" type="tel" value={address.receiverPhone || ''} />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">{language === 'vi' ? 'Địa chỉ cụ thể (Số nhà, Tên đường...)' : 'Street Address'}</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default font-semibold" type="text" value={address.street || ''} />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-2 gap-stack-md">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-on-surface-variant uppercase">{language === 'vi' ? 'Quận / Huyện, Phường / Xã' : 'District/Ward'}</label>
                      <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-surface-container-low py-2 px-0 text-on-surface-variant cursor-default" disabled type="text" value={fullAddressNames.districtWard} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-on-surface-variant uppercase">{language === 'vi' ? 'Tỉnh / Thành phố' : 'Province'}</label>
                      <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-surface-container-low py-2 px-0 text-on-surface-variant cursor-default" disabled type="text" value={fullAddressNames.province} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
                  <p>{language === 'vi' ? 'Bạn chưa chọn địa chỉ giao hàng. Vui lòng chọn hoặc thêm địa chỉ mới.' : 'No delivery address found. Please add a new address.'}</p>
                  <button onClick={() => setIsPopupOpen(true)} className="mt-3 px-4 py-2 bg-secondary text-white font-bold text-xs rounded-lg uppercase tracking-wider hover:bg-primary transition-all">
                    {language === 'vi' ? 'THÊM / CHỌN ĐỊA CHỈ' : 'ADD ADDRESS'}
                  </button>
                </div>
              )}
            </section>

            {/* Delivery Method */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-3 mb-stack-md">
                <span className="material-symbols-outlined text-secondary">verified_user</span>
                <h2 className="font-headline-sm text-headline-sm">{language === 'vi' ? 'Phương Thức Vận Chuyển' : 'Transport'}</h2>
              </div>
              <div className="border-2 border-secondary bg-secondary/5 p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded border border-outline-variant">
                    <span className="font-bold text-secondary text-lg">GHN</span>
                  </div>
                  <div>
                    <p className="font-bold text-primary">Giao Hàng Nhanh (GHN Express)</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">{language === 'vi' ? 'Vận chuyển tiêu chuẩn toàn quốc' : 'Standard Delivery'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{formatCurrency(shippingFee)}</p>
                </div>
              </div>
            </section>

            {/* Payment Selection */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-3 mb-stack-md">
                <span className="material-symbols-outlined text-secondary">account_balance_wallet</span>
                <h2 className="font-headline-sm text-headline-sm">{language === 'vi' ? 'Phương Thức Thanh Toán' : 'Payment Protocol'}</h2>
              </div>
              <div className="space-y-3">
                <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all group ${paymentMethod === 'vnpay' ? 'border-secondary bg-secondary/5' : 'border-outline-variant hover:border-secondary'}`}>
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      name="payment"
                      value="vnpay"
                      checked={paymentMethod === 'vnpay'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-secondary focus:ring-secondary border-outline-variant"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">VNPAY (ATM / QR Code / E-Wallet)</span>
                      <span className="text-body-sm text-on-surface-variant">{language === 'vi' ? 'Thanh toán trực tuyến bảo mật qua thẻ ngân hàng hoặc quét mã QR' : 'Instant secure bank transfer or QR'}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-secondary transition-colors">qr_code_2</span>
                </label>

                <label className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all group ${paymentMethod === 'cod' ? 'border-secondary bg-secondary/5' : 'border-outline-variant hover:border-secondary'}`}>
                  <div className="flex items-center gap-4">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-5 h-5 text-secondary focus:ring-secondary border-outline-variant"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">COD ({language === 'vi' ? 'Thanh toán khi nhận hàng' : 'Cash on Delivery'})</span>
                      <span className="text-body-sm text-on-surface-variant">{language === 'vi' ? 'Thanh toán trực tiếp cho nhân viên giao hàng sau khi kiểm tra' : 'Payment upon physical inspection'}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-outline-variant group-hover:text-secondary transition-colors">payments</span>
                </label>
              </div>
            </section>
          </div>

          {/* Right Column: Summary & Items */}
          <div className="lg:col-span-5 sticky top-28 space-y-stack-lg">
            {/* Order Items */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-stack-md">
                <h2 className="font-headline-sm text-headline-sm">{language === 'vi' ? 'Sản Phẩm Đã Chọn' : 'Your Selection'}</h2>
                <span className="text-body-sm text-secondary font-bold">1 {language === 'vi' ? 'Sản phẩm' : 'Item'}</span>
              </div>

              <div className="space-y-4 mb-stack-lg">
                <div className="flex gap-4 group">
                  <div className="w-20 h-24 flex-shrink-0 bg-surface-container overflow-hidden rounded">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))[0].imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">📦</div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h4 className="font-bold text-primary line-clamp-2">{product.name}</h4>
                    <p className="text-body-sm text-on-surface-variant">{t('checkout.condition_label')} {product.condition || t('common.unknown')}</p>
                    <p className="font-bold text-secondary mt-1">{formatCurrency(subtotal)}</p>
                  </div>
                </div>
              </div>

              {/* Voucher */}
              <div className="pt-stack-md border-t border-outline-variant/30">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="font-label-caps text-on-surface-variant font-bold text-xs uppercase tracking-wider">
                      {t('checkout.select_or_enter_voucher')}
                    </label>
                    {bestVoucherCode && (
                      <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 shadow-sm">
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                        {t('checkout.best_offer')}
                      </span>
                    )}
                  </div>

                  {myVouchers.length > 0 && (
                    <div className="relative mb-1">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider block mb-1">
                        {language === 'vi' ? 'MÃ ƯU ĐÃI TỪ VÍ CỦA BẠN:' : 'Select from your wallet:'}
                      </span>

                      {/* Dropdown Header Trigger */}
                      <button
                        type="button"
                        onClick={() => setIsOpenVoucherDropdown(!isOpenVoucherDropdown)}
                        className={`w-full flex items-center justify-between border rounded-lg p-3 text-body-sm bg-white transition-all text-left shadow-sm ${appliedVoucherCode && appliedVoucherCode === bestVoucherCode
                            ? 'border-emerald-500 ring-1 ring-emerald-400/40'
                            : 'border-outline-variant hover:border-secondary'
                          }`}
                      >
                        <div className="truncate font-semibold flex items-center gap-2">
                          {appliedVoucherCode ? (
                            <>
                              <span className="material-symbols-outlined text-[18px] text-emerald-600">confirmation_number</span>
                              <span className="text-gray-800">
                                {language === 'vi' ? 'Đã áp dụng:' : 'Applied:'} <strong className="font-mono text-secondary">{appliedVoucherCode}</strong>
                              </span>
                              {appliedVoucherCode === bestVoucherCode && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-emerald-200">
                                  ✨ {language === 'vi' ? 'Tiết kiệm nhất' : 'Best Savings'}
                                </span>
                              )}
                            </>
                          ) : voucherCode ? (
                            <span>{language === 'vi' ? 'Đã chọn:' : 'Selected:'} <strong>{voucherCode}</strong></span>
                          ) : (
                            <span className="text-gray-500">-- {language === 'vi' ? 'Chọn mã ưu đãi khả dụng' : 'Select Available Voucher'} --</span>
                          )}
                        </div>
                        <span
                          className="material-symbols-outlined text-[18px] transition-transform duration-200 text-gray-500"
                          style={{ transform: isOpenVoucherDropdown ? 'rotate(180deg)' : 'none' }}
                        >
                          expand_more
                        </span>
                      </button>

                      {/* Dropdown Menu */}
                      {isOpenVoucherDropdown && (
                        <>
                          {/* Invisible Backdrop to close click */}
                          <div className="fixed inset-0 z-10" onClick={() => setIsOpenVoucherDropdown(false)} />

                          <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-outline-variant rounded-xl shadow-2xl z-20 animate-fade-in p-2 space-y-2">
                            {bestVoucher && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-1.5 font-medium">
                                  <span className="material-symbols-outlined text-emerald-600 text-[16px]">auto_awesome</span>
                                  <span>{language === 'vi' ? `Ưu đãi tốt nhất cho đơn hàng ${formatCurrency(subtotal)}` : `Best offer for ${formatCurrency(subtotal)} order`}</span>
                                </div>
                                <span className="font-extrabold text-emerald-700 font-mono text-sm">
                                  -{formatCurrency(calculateVoucherDiscount(bestVoucher, subtotal, shippingFee))}
                                </span>
                              </div>
                            )}

                            {myVouchers.map((v) => {
                              const disc = calculateVoucherDiscount(v, subtotal, shippingFee);
                              const isEligible = subtotal >= (v.minOrderValue || 0);
                              const isBest = v.code === bestVoucherCode && isEligible && disc > 0;
                              const isApplied = appliedVoucherCode === v.code;

                              const discountText = v.discountType === 'Percentage'
                                ? `GIẢM ${v.discountValue}%`
                                : `GIẢM ${formatCurrency(v.discountValue)}`;
                              const minSpendText = v.minOrderValue > 0
                                ? `${language === 'vi' ? 'Đơn tối thiểu:' : 'Min Spend:'} ${formatCurrency(v.minOrderValue)}`
                                : (language === 'vi' ? 'Không quy định đơn tối thiểu' : 'No min spend');
                              const maxCapText = v.maxDiscountValue > 0
                                ? `${language === 'vi' ? 'Tối đa:' : 'Max Cap:'} ${formatCurrency(v.maxDiscountValue)}`
                                : null;
                              const expiryText = v.expirationDate
                                ? new Date(v.expirationDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : (language === 'vi' ? 'Không thời hạn' : 'No expiry');

                              return (
                                <div
                                  key={v.userVoucherId || v.code}
                                  className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-2 border ${isBest
                                      ? 'bg-gradient-to-r from-emerald-50/90 to-teal-50/50 border-emerald-400 shadow-sm'
                                      : isEligible
                                        ? 'bg-white border-gray-200 hover:border-secondary/50 hover:bg-gray-50/50'
                                        : 'bg-gray-50/80 border-gray-200 opacity-60'
                                    }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className={`font-bold px-2 py-0.5 rounded text-xs font-mono border ${isBest ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-gray-100 text-secondary border-gray-200'
                                        }`}>
                                        {v.code}
                                      </span>

                                      {isBest && (
                                        <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm uppercase tracking-wide">
                                          ✨ {language === 'vi' ? 'ƯU ĐÃI TỐT NHẤT' : 'BEST SAVINGS'}
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDetailVoucher(v);
                                        }}
                                        className="text-[10px] text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 px-1.5 py-0.5 rounded border border-gray-200 hover:border-emerald-300 transition-all flex items-center gap-0.5 font-medium ml-auto md:ml-0"
                                        title={language === 'vi' ? 'Xem chi tiết' : 'View Details'}
                                      >
                                        <span className="material-symbols-outlined text-[12px]">info</span>
                                        {language === 'vi' ? 'Chi tiết' : 'Details'}
                                      </button>
                                    </div>
                                    <span className={`font-extrabold text-xs ${isBest ? 'text-emerald-700' : 'text-secondary'}`}>
                                      {discountText}
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-medium flex-wrap gap-1">
                                    <span>{minSpendText} {maxCapText && `• ${maxCapText}`}</span>
                                    <span className="text-gray-500">{language === 'vi' ? 'HSD:' : 'Exp:'} <strong className="text-gray-700">{expiryText}</strong></span>
                                  </div>

                                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-0.5">
                                    <div className="text-xs font-bold">
                                      {isEligible ? (
                                        <span className="text-emerald-600 flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">savings</span>
                                          {language === 'vi' ? 'Tiết kiệm:' : 'Savings:'} -{formatCurrency(disc)}
                                        </span>
                                      ) : (
                                        <span className="text-amber-800 text-[11px] font-medium flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">warning</span>
                                          {language === 'vi' ? `Cần mua thêm ${formatCurrency((v.minOrderValue || 0) - subtotal)}` : `Needs ${formatCurrency((v.minOrderValue || 0) - subtotal)} more`}
                                        </span>
                                      )}
                                    </div>

                                    <div>
                                      {isApplied ? (
                                        <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-md flex items-center gap-1">
                                          <span className="material-symbols-outlined text-[14px]">check</span>
                                          {language === 'vi' ? 'Đã dùng' : 'Applied'}
                                        </span>
                                      ) : isEligible ? (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            setVoucherCode(v.code);
                                            setIsOpenVoucherDropdown(false);
                                            await applyVoucherByCode(v.code);
                                          }}
                                          className={`text-xs font-bold px-3 py-1 rounded-md transition-all shadow-sm flex items-center gap-1 ${isBest
                                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                              : 'bg-secondary text-white hover:bg-primary'
                                            }`}
                                        >
                                          {language === 'vi' ? 'Dùng mã' : 'Apply'}
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled
                                          className="text-xs font-semibold bg-gray-200 text-gray-400 px-3 py-1 rounded-md cursor-not-allowed"
                                        >
                                          {language === 'vi' ? 'Chưa đủ điều kiện' : 'Ineligible'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={language === 'vi' ? 'Nhập mã giảm giá thủ công' : 'Enter code manually'}
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      disabled={!!appliedVoucherCode}
                      className="flex-grow border border-outline-variant rounded-lg px-3 py-2 text-body-sm bg-transparent focus:border-secondary focus:ring-1 focus:ring-secondary transition-all disabled:opacity-60"
                    />
                    {appliedVoucherCode ? (
                      <button
                        type="button"
                        onClick={handleRemoveVoucher}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-button-text transition-colors uppercase text-[10px] tracking-widest font-bold flex items-center gap-1 shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                        {language === 'vi' ? 'HỦY' : 'Remove'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplyVoucher}
                        className="bg-secondary hover:bg-primary text-white px-4 py-2 rounded-lg font-button-text transition-colors uppercase text-[10px] tracking-widest font-bold shadow-sm"
                      >
                        {language === 'vi' ? 'ÁP DỤNG' : 'Apply'}
                      </button>
                    )}
                  </div>

                  {appliedVoucherCode && (
                    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs text-green-800 font-medium animate-fade-in">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-600 text-[18px]">check_circle</span>
                        <span>{language === 'vi' ? `Đã áp dụng mã ${appliedVoucherCode}` : `Voucher ${appliedVoucherCode} applied`} (-{formatCurrency(discountAmount)})</span>
                      </div>
                      {appliedVoucherCode === bestVoucherCode && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-xs">
                          ✨ {language === 'vi' ? 'Ưu đãi tốt nhất' : 'Best Offer'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Order Summary */}
            <section className="bg-primary text-on-primary p-stack-lg rounded-xl shadow-xl">
              <h2 className="font-headline-sm text-headline-sm mb-stack-md text-white">{language === 'vi' ? 'Tóm Tắt Đơn Hàng' : 'Order Summary'}</h2>

              <div className="space-y-3 text-body-sm border-b border-on-primary/10 pb-stack-md mb-stack-md">
                <div className="flex justify-between">
                  <span className="text-on-primary/70">{language === 'vi' ? 'Tạm tính' : 'Subtotal'}</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-primary/70">{language === 'vi' ? 'Phí vận chuyển (GHN)' : 'GHN Shipping'}</span>
                  <div className="flex gap-2 items-center">
                    <span className="font-medium text-white">{formatCurrency(shippingFee)}</span>
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-primary/70">{language === 'vi' ? 'Giảm giá Voucher' : 'Discount'}</span>
                    <span className="text-tertiary-fixed font-bold">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline mb-stack-lg">
                <span className="font-headline-sm text-white">{language === 'vi' ? 'Tổng thanh toán' : 'Total'}</span>
                <span className="text-headline-sm font-bold text-tertiary-fixed">{formatCurrency(total)}</span>
              </div>

              <button
                onClick={handleCheckout}
                disabled={!address || isProcessing}
                className={`w-full py-5 rounded-full font-button-text uppercase tracking-widest text-lg transition-all duration-300 shadow-lg active:scale-95 flex items-center justify-center gap-3
                  ${(!address || isProcessing) ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed' : 'bg-secondary text-white hover:bg-tertiary-fixed-dim hover:text-primary'}`}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {language === 'vi' ? 'ĐANG XỬ LÝ...' : 'PROCESSING...'}
                  </>
                ) : (language === 'vi' ? 'ĐẶT HÀNG NGAY' : 'Place Order')}
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-on-primary/50 text-[10px] uppercase tracking-tighter">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>{language === 'vi' ? 'Thanh toán bảo mật mã hóa SSL' : 'Encrypted SSL Secure Checkout'}</span>
              </div>
            </section>
          </div>
        </div>

        {isPopupOpen && (
          <AddressPopup
            onClose={() => setIsPopupOpen(false)}
            onSelect={handleAddressSelect}
            selectedAddressId={address?.addressId || address?.id || address?.AddressId}
          />
        )}

        {selectedDetailVoucher && (
          <div className="v-modal-overlay" onClick={() => setSelectedDetailVoucher(null)}>
            <div className="v-modal-card glass-panel animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <button className="v-modal-close" onClick={() => setSelectedDetailVoucher(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>

              <div className="v-modal-ticket active">
                <div className="v-modal-left">
                  <div className="v-modal-discount">
                    {selectedDetailVoucher.discountType === 'Percentage' ? (
                      <>
                        <span className="amount">{selectedDetailVoucher.discountValue}%</span>
                        <span className="label">OFF</span>
                      </>
                    ) : (
                      <>
                        <span className="amount" style={{ fontSize: '24px' }}>
                          {formatCurrency(selectedDetailVoucher.discountValue || 0)}
                        </span>
                        <span className="label">OFF</span>
                      </>
                    )}
                  </div>
                  <div className="v-modal-status-badge">
                    {language === 'vi' ? 'Khả dụng' : 'Available'}
                  </div>
                </div>

                <div className="v-modal-right">
                  <div className="v-modal-header">
                    <h2>{language === 'vi' ? 'Chi Tiết Mã Giảm Giá' : 'Voucher Details'}</h2>
                    <p className="v-modal-desc-text">
                      {selectedDetailVoucher.discountType === 'Fixed'
                        ? (language === 'vi' ? `Giảm giá trực tiếp lên đến ${formatCurrency(selectedDetailVoucher.discountValue)}` : `Free shipping discount up to ${formatCurrency(selectedDetailVoucher.discountValue)}`)
                        : (language === 'vi' ? `Giảm ${selectedDetailVoucher.discountValue}% cho đơn hàng đủ điều kiện` : `${selectedDetailVoucher.discountValue}% discount on eligible orders`)}
                    </p>
                  </div>

                  <div className="v-modal-info-grid">
                    <div className="v-info-row">
                      <span className="v-info-lbl">{language === 'vi' ? 'Mã ưu đãi:' : 'Voucher Code:'}</span>
                      <div className="v-info-val-code">
                        <span className="code-font">{selectedDetailVoucher.code}</span>
                      </div>
                    </div>

                    {selectedDetailVoucher.sellerName && (
                      <div className="v-info-row">
                        <span className="v-info-lbl">{language === 'vi' ? 'Áp dụng cho Cửa hàng:' : 'Applicable Store:'}</span>
                        <span className="v-info-val">{language === 'vi' ? `Chỉ tại ${selectedDetailVoucher.sellerName}` : `Only at ${selectedDetailVoucher.sellerName}`}</span>
                      </div>
                    )}

                    <div className="v-info-row">
                      <span className="v-info-lbl">{language === 'vi' ? 'Đơn hàng tối thiểu:' : 'Minimum Order Value:'}</span>
                      <span className="v-info-val">{selectedDetailVoucher.minOrderValue ? formatCurrency(selectedDetailVoucher.minOrderValue) : '0 VND'}</span>
                    </div>

                    <div className="v-info-row">
                      <span className="v-info-lbl">{language === 'vi' ? 'Mức giảm tối đa:' : 'Maximum Discount Cap:'}</span>
                      <span className="v-info-val">{selectedDetailVoucher.maxDiscountValue ? formatCurrency(selectedDetailVoucher.maxDiscountValue) : (language === 'vi' ? 'Không giới hạn' : 'No Cap')}</span>
                    </div>

                    <div className="v-info-row">
                      <span className="v-info-lbl">{language === 'vi' ? 'Có hiệu lực từ:' : 'Valid From:'}</span>
                      <span className="v-info-val">
                        {selectedDetailVoucher.startDate
                          ? new Date(selectedDetailVoucher.startDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'long' })
                          : (language === 'vi' ? 'Ngay lập tức' : 'Immediate')}
                      </span>
                    </div>

                    <div className="v-info-row">
                      <span className="v-info-lbl">{language === 'vi' ? 'Hạn sử dụng:' : 'Expires On:'}</span>
                      <span className="v-info-val">
                        {selectedDetailVoucher.expirationDate
                          ? new Date(selectedDetailVoucher.expirationDate).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'long' })
                          : (language === 'vi' ? 'Không giới hạn' : 'No expiry')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="v-modal-terms">
                <h3>{language === 'vi' ? 'Điều Khoản & Điều Kiện' : 'Terms & Conditions'}</h3>
                <ul>
                  <li>{language === 'vi' ? 'Mã ưu đãi độc quyền dành cho tài khoản của bạn.' : 'This voucher is non-transferable and exclusive to your active subscription.'}</li>
                  <li>{language === 'vi' ? 'Mã ưu đãi phải được áp dụng trước khi hoàn tất đặt hàng.' : 'Vouchers must be applied during checkout before completing payment.'}</li>
                  <li>{language === 'vi' ? 'Mỗi mã ưu đãi chỉ được sử dụng một lần.' : 'Each voucher can only be redeemed once within its validity period.'}</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setSelectedDetailVoucher(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {language === 'vi' ? 'Đóng' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const code = selectedDetailVoucher.code;
                    setSelectedDetailVoucher(null);
                    setVoucherCode(code);
                    setIsOpenVoucherDropdown(false);
                    await applyVoucherByCode(code);
                  }}
                  className="px-4 py-2 rounded-lg bg-secondary text-white text-sm font-bold hover:bg-primary"
                >
                  {language === 'vi' ? 'Dùng Mã Này' : 'Apply This Voucher'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Checkout;

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import productService from '../../../services/productService';
import addressService from '../../../services/addressService';
import checkoutService from '../../../services/checkoutService';
import AddressPopup from '../../../components/AddressPopup/AddressPopup';
import { useToast } from '../../../context/ToastContext';
import vietnamAddressService from '../../../services/vietnamAddressService';
import { createVnPayPaymentUrl } from '../../../services/paymentService';

const Checkout = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

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

  const [fullAddressNames, setFullAddressNames] = useState({ province: '', districtWard: '' });

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
      const addrs = Array.isArray(addrsData) ? addrsData : (addrsData?.data || []);
      const defaultAddr = addrs.find(a => a.isDefault) || addrs[0];
      
      if (defaultAddr) {
        setAddress(defaultAddr);
        await calculateFee(defaultAddr.addressId || defaultAddr.id);
      }
    } catch (error) {
      showToast('Failed to load checkout information', 'error');
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
      const errMsg = error.response?.data?.message || 'Failed to calculate shipping fee';
      showToast(errMsg, 'error');
    }
  };

  const handleAddressSelect = async (selectedAddr) => {
    setAddress(selectedAddr);
    await calculateFee(selectedAddr.addressId || selectedAddr.id || selectedAddr.AddressId);
  };

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      showToast('Please enter a voucher code', 'warning');
      return;
    }
    try {
      const res = await checkoutService.validateVoucher(voucherCode.trim(), productId);
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
      showToast('Voucher applied successfully!', 'success');
    } catch (error) {
      console.error(error);
      setDiscountAmount(0);
      setAppliedVoucherCode('');
      const errMsg = error.response?.data?.message || 'Invalid or inactive voucher code.';
      showToast(errMsg, 'error');
    }
  };

  const handleRemoveVoucher = () => {
    setDiscountAmount(0);
    setAppliedVoucherCode('');
    setVoucherCode('');
    showToast('Voucher removed', 'info');
  };

  const handleCheckout = async () => {
    if (!address) {
      showToast('Please select a delivery address', 'warning');
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
      showToast('Order placed successfully!', 'success');

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
          } else {
            showToast('Failed to create VNPAY payment URL', 'error');
          }
        } catch (paymentErr) {
          console.error(paymentErr);
          showToast('Failed to connect to VNPAY', 'error');
        }
      }

      navigate('/purchase-history');
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message || 'Order placement failed. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-on-surface-variant">Loading information...</div>;
  }

  if (!product) {
    return <div className="p-8 text-center text-on-surface-variant">Product not found.</div>;
  }

  const subtotal = product.price || 0;
  const total = subtotal + shippingFee - discountAmount;

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen">
      <main className="pb-section-gap max-w-container-max mx-auto px-margin-desktop pt-12">
        <div className="mb-stack-lg">
          <h1 className="font-headline-lg text-headline-lg text-primary">Checkout</h1>
          <p className="text-on-surface-variant mt-2 font-body-md">Refining your acquisition of archival excellence.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* Left Column: Shipping & Payment */}
          <div className="lg:col-span-7 space-y-stack-lg">
            
            {/* Shipping Address */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-stack-md">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">local_shipping</span>
                  <h2 className="font-headline-sm text-headline-sm">Delivery Address</h2>
                </div>
                <button 
                  onClick={() => setIsPopupOpen(true)}
                  className="flex items-center gap-2 text-secondary hover:text-primary transition-colors text-body-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Change / Add New Address
                </button>
              </div>

              {address ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">Full Name</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default" type="text" value={address.receiverName || ''} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">Phone Number</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default" type="tel" value={address.receiverPhone || ''} />
                  </div>
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="font-label-caps text-on-surface-variant uppercase">Street Address</label>
                    <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 px-0 text-on-surface-variant cursor-default" type="text" value={address.street || ''} />
                  </div>
                  <div className="md:col-span-2 grid grid-cols-2 gap-stack-md">
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-on-surface-variant uppercase">District/Ward</label>
                      <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-surface-container-low py-2 px-0 text-on-surface-variant cursor-default" disabled type="text" value={fullAddressNames.districtWard} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-label-caps text-on-surface-variant uppercase">Province</label>
                      <input readOnly className="border-t-0 border-x-0 border-b border-outline-variant bg-surface-container-low py-2 px-0 text-on-surface-variant cursor-default" disabled type="text" value={fullAddressNames.province} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-on-surface-variant border border-dashed border-outline-variant rounded-lg">
                  <p>No delivery address found. Please add a new address.</p>
                </div>
              )}
            </section>

            {/* Delivery Method */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-3 mb-stack-md">
                <span className="material-symbols-outlined text-secondary">verified_user</span>
                <h2 className="font-headline-sm text-headline-sm">Transport</h2>
              </div>
              <div className="border-2 border-secondary bg-secondary/5 p-4 rounded-lg flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded border border-outline-variant">
                    <span className="font-bold text-secondary text-lg">GHN</span>
                  </div>
                  <div>
                    <p className="font-bold text-primary">Giao Hang Nhanh</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Standard Delivery</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary">{shippingFee.toLocaleString('vi-VN')} VND</p>
                </div>
              </div>
            </section>

            {/* Payment Selection */}
            <section className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-3 mb-stack-md">
                <span className="material-symbols-outlined text-secondary">account_balance_wallet</span>
                <h2 className="font-headline-sm text-headline-sm">Payment Protocol</h2>
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
                      <span className="font-bold text-primary">VNPAY</span>
                      <span className="text-body-sm text-on-surface-variant">Instant secure bank transfer or QR</span>
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
                      <span className="font-bold text-primary">COD (Cash on Delivery)</span>
                      <span className="text-body-sm text-on-surface-variant">Payment upon physical inspection</span>
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
                <h2 className="font-headline-sm text-headline-sm">Your Selection</h2>
                <span className="text-body-sm text-secondary font-bold">1 Item</span>
              </div>
              
              <div className="space-y-4 mb-stack-lg">
                <div className="flex gap-4 group">
                  <div className="w-20 h-24 flex-shrink-0 bg-surface-container overflow-hidden rounded">
                    {product.images && product.images.length > 0 ? (
                      <img src={product.images[0].imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h4 className="font-bold text-primary line-clamp-2">{product.name}</h4>
                    <p className="text-body-sm text-on-surface-variant">Condition: {product.condition || 'Premium'}</p>
                    <p className="font-bold text-secondary mt-1">{subtotal.toLocaleString('vi-VN')} VND</p>
                  </div>
                </div>
              </div>

              {/* Voucher */}
              <div className="pt-stack-md border-t border-outline-variant/30">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="font-label-caps text-on-surface-variant">Select or Enter Code</label>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      placeholder="Enter code manually" 
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value)}
                      disabled={!!appliedVoucherCode}
                      className="flex-grow border-t-0 border-x-0 border-b border-outline-variant bg-transparent py-2 text-body-sm focus:border-secondary transition-all disabled:opacity-50" 
                    />
                    {appliedVoucherCode ? (
                      <button 
                        onClick={handleRemoveVoucher}
                        className="bg-red-600 text-white px-4 py-2 font-button-text hover:bg-red-700 transition-colors uppercase text-[10px] tracking-widest"
                      >
                        Remove
                      </button>
                    ) : (
                      <button 
                        onClick={handleApplyVoucher}
                        className="bg-primary text-on-primary px-4 py-2 font-button-text hover:bg-secondary transition-colors uppercase text-[10px] tracking-widest"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                  {appliedVoucherCode && (
                    <p className="text-green-600 text-xs font-semibold">
                      Code {appliedVoucherCode} applied (-{discountAmount.toLocaleString('vi-VN')} VND)
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Order Summary */}
            <section className="bg-primary text-on-primary p-stack-lg rounded-xl shadow-xl">
              <h2 className="font-headline-sm text-headline-sm mb-stack-md text-white">Order Summary</h2>
              
              <div className="space-y-3 text-body-sm border-b border-on-primary/10 pb-stack-md mb-stack-md">
                <div className="flex justify-between">
                  <span className="text-on-primary/70">Subtotal</span>
                  <span className="font-medium">{subtotal.toLocaleString('vi-VN')} VND</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-primary/70">GHN Shipping</span>
                  <div className="flex gap-2 items-center">
                    <span className="font-medium text-white">{shippingFee.toLocaleString('vi-VN')} VND</span>
                  </div>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-on-primary/70">Discount</span>
                    <span className="text-tertiary-fixed font-bold">-{discountAmount.toLocaleString('vi-VN')} VND</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-baseline mb-stack-lg">
                <span className="font-headline-sm text-white">Total</span>
                <span className="text-headline-sm font-bold text-tertiary-fixed">{total.toLocaleString('vi-VN')} VND</span>
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
                    PROCESSING...
                  </>
                ) : 'Place Order'}
              </button>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-on-primary/50 text-[10px] uppercase tracking-tighter">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                <span>Encrypted SSL Secure Checkout</span>
              </div>
            </section>
          </div>
        </div>

        {isPopupOpen && (
          <AddressPopup 
            onClose={() => setIsPopupOpen(false)} 
            onSelect={handleAddressSelect} 
            selectedAddressId={address?.addressId || address?.id}
          />
        )}
      </main>
    </div>
  );
};

export default Checkout;

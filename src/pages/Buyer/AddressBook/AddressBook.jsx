import React, { useEffect, useMemo, useState } from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useLanguage } from '../../../context/LanguageContext';
import addressService from '../../../services/addressService';
import vietnamAddressService from '../../../services/vietnamAddressService';
import '../../../styles/MyAccount.css';

const emptyForm = {
  receiverName: '',
  receiverPhone: '',
  streetAddress: '',
  provinceId: '',
  districtId: '',
  wardCode: '',
  isDefault: false,
};

const padProvince = (value) => String(value ?? '').padStart(2, '0');
const padDistrict = (value) => String(value ?? '').padStart(3, '0');
const padWard = (value) => String(value ?? '').padStart(5, '0');
const normalizeCode = (value) => String(value ?? '');

export default function AddressBook() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const { t, language } = useLanguage();
  const isVi = language === 'vi';

  const [addresses, setAddresses] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressLocationNames, setAddressLocationNames] = useState({
    districts: {},
    wards: {},
  });
  const [addressToDelete, setAddressToDelete] = useState(null);
  const [isDeletingAddress, setIsDeletingAddress] = useState(false);

  const provinceMap = useMemo(() => new Map(provinces.map((item) => [normalizeCode(item.code), item.name])), [provinces]);
  const districtMap = useMemo(() => new Map(districts.map((item) => [normalizeCode(item.code), item.name])), [districts]);
  const wardMap = useMemo(() => new Map(wards.map((item) => [normalizeCode(item.code), item.name])), [wards]);
  const defaultAddress = addresses.find((address) => address.isDefault);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      setAddresses(await addressService.getMyAddresses());
    } catch (err) {
      showToast(err?.response?.data || (isVi ? 'Không thể tải danh sách địa chỉ.' : 'Failed to load addresses.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user) return;
    loadAddresses();
  }, [authLoading, user?.accountId]);

  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setProvinces(await vietnamAddressService.getProvinces());
      } catch (err) {
        showToast(err.message || (isVi ? 'Không thể tải Tỉnh/Thành phố.' : 'Failed to load provinces.'), 'error');
      }
    };

    loadProvinces();
  }, [showToast, isVi]);

  useEffect(() => {
    if (!addresses.length) {
      setAddressLocationNames({ districts: {}, wards: {} });
      return;
    }

    let cancelled = false;

    const loadAddressLocationNames = async () => {
      const provinceCodes = [...new Set(addresses.map((address) => normalizeCode(address.provinceId)).filter(Boolean))];
      const districtCodes = [...new Set(addresses.map((address) => normalizeCode(address.districtId)).filter(Boolean))];

      const districtGroups = await Promise.all(
        provinceCodes.map(async (provinceCode) => {
          try {
            return await vietnamAddressService.getDistricts(provinceCode);
          } catch {
            return [];
          }
        })
      );

      const wardGroups = await Promise.all(
        districtCodes.map(async (districtCode) => {
          try {
            return await vietnamAddressService.getWards(districtCode);
          } catch {
            return [];
          }
        })
      );

      if (cancelled) return;

      const districts = {};
      districtGroups.flat().forEach((district) => {
        districts[normalizeCode(district.code)] = district.name;
      });

      const wards = {};
      wardGroups.flat().forEach((ward) => {
        wards[normalizeCode(ward.code)] = ward.name;
      });

      setAddressLocationNames({ districts, wards });
    };

    loadAddressLocationNames();

    return () => {
      cancelled = true;
    };
  }, [addresses]);

  const loadDistricts = async (provinceCode) => {
    if (!provinceCode) {
      setDistricts([]);
      return;
    }

    setLocationLoading(true);
    try {
      setDistricts(await vietnamAddressService.getDistricts(provinceCode));
    } catch (err) {
      showToast(err.message || (isVi ? 'Không thể tải Quận/Huyện.' : 'Failed to load districts.'), 'error');
    } finally {
      setLocationLoading(false);
    }
  };

  const loadWards = async (districtCode) => {
    if (!districtCode) {
      setWards([]);
      return;
    }

    setLocationLoading(true);
    try {
      setWards(await vietnamAddressService.getWards(districtCode));
    } catch (err) {
      showToast(err.message || (isVi ? 'Không thể tải Phường/Xã.' : 'Failed to load wards.'), 'error');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleAddClick = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDistricts([]);
    setWards([]);
    setShowForm(true);
  };

  const handleEditClick = async (address) => {
    const provinceCode = padProvince(address.provinceId);
    const districtCode = padDistrict(address.districtId);
    const wardCode = padWard(address.wardCode);

    setEditingId(address.addressId);
    setForm({
      receiverName: address.receiverName || '',
      receiverPhone: address.receiverPhone || '',
      streetAddress: address.streetAddress || address.street || '',
      provinceId: provinceCode,
      districtId: districtCode,
      wardCode,
      isDefault: Boolean(address.isDefault),
    });
    setShowForm(true);
    await loadDistricts(provinceCode);
    await loadWards(districtCode);
  };

  const handleFieldChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (field === 'provinceId') {
      setForm((current) => ({ ...current, districtId: '', wardCode: '' }));
      setWards([]);
      loadDistricts(value);
    } else if (field === 'districtId') {
      setForm((current) => ({ ...current, wardCode: '' }));
      loadWards(value);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.provinceId || !form.districtId || !form.wardCode) {
      showToast(isVi ? 'Vui lòng chọn đầy đủ Tỉnh/Thành phố, Quận/Huyện và Phường/Xã.' : 'Please select Province, District, and Ward.', 'error');
      return;
    }

    if (!form.receiverName.trim() || !form.receiverPhone.trim() || !form.streetAddress.trim()) {
      showToast(isVi ? 'Vui lòng điền tên, số điện thoại và địa chỉ chi tiết.' : 'Please fill in receiver name, phone, and street address.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        streetAddress: form.streetAddress.trim(),
        provinceId: parseInt(form.provinceId, 10),
        districtId: parseInt(form.districtId, 10),
        wardCode: form.wardCode,
        isDefault: form.isDefault,
      };

      if (editingId) {
        await addressService.updateAddress(editingId, payload);
        showToast(isVi ? 'Đã cập nhật địa chỉ thành công.' : 'Address updated successfully.', 'success');
      } else {
        await addressService.createAddress(payload);
        showToast(isVi ? 'Đã thêm địa chỉ thành công.' : 'Address added successfully.', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || (isVi ? 'Không thể lưu địa chỉ.' : 'Failed to save address.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await addressService.setDefault(addressId);
      showToast(isVi ? 'Đã cập nhật địa chỉ mặc định.' : 'Default address updated.', 'success');
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || (isVi ? 'Không thể đặt địa chỉ mặc định.' : 'Failed to set default address.'), 'error');
    }
  };

  const handleConfirmDeleteAddress = async () => {
    if (!addressToDelete) return;
    try {
      setIsDeletingAddress(true);
      await addressService.deleteAddress(addressToDelete);
      showToast(isVi ? 'Đã xóa địa chỉ thành công.' : 'Address deleted.', 'success');
      setAddressToDelete(null);
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || (isVi ? 'Không thể xóa địa chỉ.' : 'Failed to delete address.'), 'error');
    } finally {
      setIsDeletingAddress(false);
    }
  };

  const formatAddressLine = (address) => {
    const provinceCode = normalizeCode(address.provinceId);
    const districtCode = normalizeCode(address.districtId);
    const wardCode = normalizeCode(address.wardCode);
    const locationParts = [
      addressLocationNames.wards[wardCode] || wardMap.get(wardCode) || `${isVi ? 'Phường/Xã' : 'Ward'} ${wardCode}`,
      addressLocationNames.districts[districtCode] || districtMap.get(districtCode) || `${isVi ? 'Quận/Huyện' : 'District'} ${districtCode}`,
      provinceMap.get(provinceCode) || `${isVi ? 'Tỉnh/Thành' : 'Province'} ${provinceCode}`,
    ];
    return `${address.streetAddress || address.street || ''}, ${locationParts.join(', ')}`;
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>{isVi ? 'Đang tải sổ địa chỉ...' : 'Loading address book...'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="profile-page-wrapper container animate-fade-in">
        <div className="profile-grid">
          <AccountSidebar />

          <main className="ma-main">
            <div className="address-dashboard-grid">
              <div className="address-content-column">
                <div className="ma-card address-hero-card">
                  <div className="ma-header-info">
                    <div className="address-hero-icon">
                      <span className="material-symbols-outlined">location_on</span>
                    </div>
                    <div>
                      <h1 className="ma-headline">{isVi ? 'Sổ Địa Chỉ' : 'Address Book'}</h1>
                      <p className="ma-subtitle">{isVi ? 'Quản lý địa chỉ giao hàng và thanh toán để có trải nghiệm mua sắm mượt mà hơn.' : 'Manage your shipping and billing addresses to ensure a seamless checkout experience.'}</p>
                    </div>
                  </div>
                </div>

                <div className="ma-card address-saved-card">
                  <div className="address-section-header">
                    <h2>{isVi ? 'Địa Chỉ Đã Lưu' : 'Saved Addresses'}</h2>
                    <button className="ma-btn-primary address-add-btn" type="button" onClick={handleAddClick}>
                      <span className="material-symbols-outlined">add</span>
                      {isVi ? 'Thêm Địa Chỉ Mới' : 'Add New Address'}
                    </button>
                  </div>
                  {loading ? (
                    <div className="address-empty-state">
                      <span className="btn-spinner"></span>
                      <p>{isVi ? 'Đang tải danh sách địa chỉ...' : 'Loading addresses...'}</p>
                    </div>
                  ) : addresses.length === 0 ? (
                    <div className="address-empty-state">
                      <span className="material-symbols-outlined">home_work</span>
                      <p>{isVi ? 'Bạn chưa lưu địa chỉ nào.' : "You haven't added any addresses yet."}</p>
                    </div>
                  ) : (
                    <div className="address-list">
                      {addresses.map((address) => (
                        <article key={address.addressId} className="address-card">
                          <div className="address-card-main">
                            <div className="address-card-title-row">
                              <h3>{address.receiverName}</h3>
                              {address.isDefault && <span className="address-default-badge">{isVi ? 'Địa chỉ mặc định' : 'Default Shipping'}</span>}
                            </div>
                            <p><span className="material-symbols-outlined">call</span>{address.receiverPhone}</p>
                            <p><span className="material-symbols-outlined">home_pin</span>{formatAddressLine(address)}</p>
                          </div>
                          <div className="address-card-actions">
                            {!address.isDefault && <button type="button" onClick={() => handleSetDefault(address.addressId)}>{isVi ? 'Đặt mặc định' : 'Set Default'}</button>}
                            <button type="button" onClick={() => handleEditClick(address)}>{isVi ? 'Chỉnh sửa' : 'Edit'}</button>
                            <button type="button" className="danger" onClick={() => setAddressToDelete(address.addressId)}>{isVi ? 'Xóa' : 'Delete'}</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <aside className="address-side-column">
                <section className="ma-card address-preference-card">
                  <div className="address-side-title">
                    <span className="material-symbols-outlined">local_shipping</span>
                    <h3>{isVi ? 'Hình Thức Giao Hàng' : 'Delivery Preferences'}</h3>
                  </div>
                  <label className="address-delivery-option selected">
                    <input type="radio" defaultChecked />
                    <span>
                      <strong>{isVi ? 'Giao hàng Tiêu Chuẩn' : 'Standard Shipping'}</strong>
                      <small>{isVi ? '3-5 ngày làm việc' : '3-5 business days'}</small>
                    </span>
                  </label>
                  <label className="address-delivery-option">
                    <input type="radio" />
                    <span>
                      <strong>{isVi ? 'Giao hàng Hỏa Tốc' : 'Express Priority'}</strong>
                      <small>{isVi ? 'Nhận trong ngày tiếp theo' : 'Next day delivery'}</small>
                    </span>
                  </label>
                </section>

                <section className="ma-card address-stats-card">
                  <h3>{isVi ? 'Thống Kê Nhanh' : 'Quick Stats'}</h3>
                  <div className="address-stat-grid">
                    <div>
                      <span>{isVi ? 'TỔNG SỐ' : 'TOTAL'}</span>
                      <strong>{String(addresses.length).padStart(2, '0')}</strong>
                    </div>
                    <div>
                      <span>{isVi ? 'ĐÃ XÁC MINH' : 'VERIFIED'}</span>
                      <strong>{String(addresses.length).padStart(2, '0')}</strong>
                    </div>
                  </div>
                  <div className="address-default-status">
                    <span>{isVi ? 'TRẠNG THÁI MẶC ĐỊNH' : 'DEFAULT SET'}</span>
                    <strong>{defaultAddress ? (isVi ? 'Đã thiết lập' : 'Active') : (isVi ? 'Chưa thiết lập' : 'Missing')}</strong>
                    <span className="material-symbols-outlined">{defaultAddress ? 'check_circle' : 'error'}</span>
                  </div>
                </section>

                <section className="address-tip-card">
                  <span className="material-symbols-outlined">emoji_objects</span>
                  <h3>{isVi ? 'Mẹo Nhỏ' : 'Pro Tip'}</h3>
                  <p>{isVi ? 'Cung cấp chính xác thông tin địa chỉ giúp tránh chậm trễ khi giao hàng cho các đơn giá trị cao.' : 'Keep your address information accurate to avoid delivery delays for high-value orders.'}</p>
                </section>
              </aside>
            </div>
          </main>
        </div>
      </div>

      {showForm && (
        <div className="ma-modal-overlay">
          <div className="ma-modal animate-fade-in">
            <div className="ma-modal-header">
              <h3>{editingId ? (isVi ? 'Chỉnh Sửa Địa Chỉ' : 'Edit Address') : (isVi ? 'Thêm Địa Chỉ Mới' : 'Add New Address')}</h3>
              <button className="ma-modal-close" onClick={() => setShowForm(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="ma-modal-body">
              <form onSubmit={handleSubmit}>
                <div className="ma-form-grid">
                  <div className="ma-form-group">
                    <label className="ma-label">{isVi ? 'Tỉnh / Thành phố *' : 'Province *'}</label>
                    <select className="ma-input" value={form.provinceId} onChange={(e) => handleFieldChange('provinceId', e.target.value)}>
                      <option value="">{isVi ? '-- Chọn Tỉnh / Thành phố --' : 'Select Province'}</option>
                      {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                    </select>
                  </div>
                  <div className="ma-form-group">
                    <label className="ma-label">{isVi ? 'Quận / Huyện *' : 'District *'}</label>
                    <select className="ma-input" value={form.districtId} onChange={(e) => handleFieldChange('districtId', e.target.value)} disabled={!form.provinceId || locationLoading}>
                      <option value="">{isVi ? '-- Chọn Quận / Huyện --' : 'Select District'}</option>
                      {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
                    </select>
                  </div>
                  <div className="ma-form-group">
                    <label className="ma-label">{isVi ? 'Phường / Xã *' : 'Ward *'}</label>
                    <select className="ma-input" value={form.wardCode} onChange={(e) => handleFieldChange('wardCode', e.target.value)} disabled={!form.districtId || locationLoading}>
                      <option value="">{isVi ? '-- Chọn Phường / Xã --' : 'Select Ward'}</option>
                      {wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
                    </select>
                  </div>
                  <div className="ma-form-group">
                    <label className="ma-label">{isVi ? 'Tên Người Nhận *' : 'Receiver Name *'}</label>
                    <input className="ma-input" value={form.receiverName} onChange={(e) => handleFieldChange('receiverName', e.target.value)} placeholder={isVi ? 'Nhập họ và tên...' : 'Enter receiver name'} />
                  </div>
                  <div className="ma-form-group">
                    <label className="ma-label">{isVi ? 'Số Điện Thoại *' : 'Receiver Phone *'}</label>
                    <input className="ma-input" value={form.receiverPhone} onChange={(e) => handleFieldChange('receiverPhone', e.target.value.replace(/\D/g, ''))} placeholder={isVi ? 'Nhập số điện thoại...' : 'Enter phone number'} />
                  </div>
                  <div className="ma-form-group ma-form-group-wide">
                    <label className="ma-label">{isVi ? 'Địa Chỉ Chi Tiết *' : 'Street Address *'}</label>
                    <input className="ma-input" value={form.streetAddress} onChange={(e) => handleFieldChange('streetAddress', e.target.value)} placeholder={isVi ? 'Số nhà, tên đường, tòa nhà...' : 'House number, street, building'} />
                  </div>
                  <label className="address-default-toggle">
                    <input type="checkbox" checked={form.isDefault} onChange={(e) => handleFieldChange('isDefault', e.target.checked)} />
                    {isVi ? 'Đặt làm địa chỉ mặc định' : 'Set as default address'}
                  </label>
                </div>

                <div className="ma-form-actions" style={{ marginTop: '24px', paddingTop: '20px' }}>
                  <button className="ma-btn-primary" type="submit" disabled={saving}>{saving ? (isVi ? 'Đang lưu...' : 'Saving...') : (isVi ? 'Lưu Địa Chỉ' : 'Save Address')}</button>
                  <button className="ma-btn-secondary" type="button" onClick={() => setShowForm(false)}>{isVi ? 'Hủy Bỏ' : 'Cancel'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {addressToDelete && (
        <div className="ma-modal-overlay" onClick={() => !isDeletingAddress && setAddressToDelete(null)}>
          <div className="ma-modal animate-fade-in" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h2>{isVi ? 'Xác Nhận Xóa Địa Chỉ' : 'Confirm Delete Address'}</h2>
              <button className="ma-modal-close-btn" type="button" disabled={isDeletingAddress} onClick={() => setAddressToDelete(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="ma-modal-body" style={{ padding: '20px 24px' }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--text-color, #2c322e)' }}>
                {isVi ? 'Bạn có chắc chắn muốn xóa địa chỉ này? Thao tác này không thể hoàn tác.' : 'Are you sure you want to delete this address? This action cannot be undone.'}
              </p>
            </div>
            <div className="ma-form-actions" style={{ padding: '16px 24px', background: '#fafafa', borderTop: '1px solid #eee', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="ma-btn-secondary" type="button" disabled={isDeletingAddress} onClick={() => setAddressToDelete(null)}>
                {isVi ? 'Hủy Bỏ' : 'Cancel'}
              </button>
              <button className="ma-btn-primary" type="button" disabled={isDeletingAddress} onClick={handleConfirmDeleteAddress} style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                {isDeletingAddress ? (isVi ? 'Đang xóa...' : 'Deleting...') : (isVi ? 'Xóa' : 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

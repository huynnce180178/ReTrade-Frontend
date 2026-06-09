import React, { useEffect, useMemo, useState } from 'react';
import AccountSidebar from '../../../components/AccountSidebar/AccountSidebar';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
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

export default function AddressBook() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
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

  const provinceMap = useMemo(() => new Map(provinces.map((item) => [item.code, item.name])), [provinces]);
  const districtMap = useMemo(() => new Map(districts.map((item) => [item.code, item.name])), [districts]);
  const wardMap = useMemo(() => new Map(wards.map((item) => [item.code, item.name])), [wards]);
  const defaultAddress = addresses.find((address) => address.isDefault);

  const loadAddresses = async () => {
    setLoading(true);
    try {
      setAddresses(await addressService.getMyAddresses());
    } catch (err) {
      showToast(err?.response?.data || 'Failed to load addresses.', 'error');
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
        showToast(err.message || 'Failed to load provinces.', 'error');
      }
    };

    loadProvinces();
  }, [showToast]);

  const loadDistricts = async (provinceCode) => {
    if (!provinceCode) {
      setDistricts([]);
      return;
    }

    setLocationLoading(true);
    try {
      setDistricts(await vietnamAddressService.getDistricts(provinceCode));
    } catch (err) {
      showToast(err.message || 'Failed to load districts.', 'error');
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
      showToast(err.message || 'Failed to load wards.', 'error');
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
      isDefault: address.isDefault === true,
    });
    setShowForm(true);
    await loadDistricts(provinceCode);
    await loadWards(districtCode);
  };

  const handleFieldChange = async (field, value) => {
    if (field === 'provinceId') {
      setForm((current) => ({ ...current, provinceId: value, districtId: '', wardCode: '' }));
      setWards([]);
      await loadDistricts(value);
      return;
    }

    if (field === 'districtId') {
      setForm((current) => ({ ...current, districtId: value, wardCode: '' }));
      await loadWards(value);
      return;
    }

    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateForm = () => {
    if (!form.receiverName.trim()) return 'Receiver name is required.';
    if (!/^\d{9,12}$/.test(form.receiverPhone.trim())) return 'Receiver phone must be 9 to 12 digits.';
    if (!form.streetAddress.trim()) return 'Street address is required.';
    if (!form.provinceId) return 'Province is required.';
    if (!form.districtId) return 'District is required.';
    if (!form.wardCode) return 'Ward is required.';
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      showToast(validationMessage, 'warning');
      return;
    }

    const payload = {
      receiverName: form.receiverName.trim(),
      receiverPhone: form.receiverPhone.trim(),
      streetAddress: form.streetAddress.trim(),
      provinceId: Number(form.provinceId),
      districtId: Number(form.districtId),
      wardCode: form.wardCode,
      isDefault: form.isDefault,
    };

    setSaving(true);
    try {
      if (editingId) {
        await addressService.updateAddress(editingId, payload);
        showToast('Address updated successfully.', 'success');
      } else {
        await addressService.createAddress(payload);
        showToast('Address added successfully.', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to save address.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await addressService.setDefault(addressId);
      showToast('Default address updated.', 'success');
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to set default address.', 'error');
    }
  };

  const handleDelete = async (addressId) => {
    try {
      await addressService.deleteAddress(addressId);
      showToast('Address deleted.', 'success');
      await loadAddresses();
    } catch (err) {
      showToast(err?.response?.data || 'Failed to delete address.', 'error');
    }
  };

  const formatAddressLine = (address) => {
    const provinceCode = padProvince(address.provinceId);
    const districtCode = padDistrict(address.districtId);
    const wardCode = padWard(address.wardCode);
    const locationParts = [
      wardMap.get(wardCode) || `Ward ${wardCode}`,
      districtMap.get(districtCode) || `District ${districtCode}`,
      provinceMap.get(provinceCode) || `Province ${provinceCode}`,
    ];
    return `${address.streetAddress || address.street || ''}, ${locationParts.join(', ')}`;
  };

  if (authLoading) {
    return (
      <div className="profile-loading-wrapper">
        <span className="btn-spinner"></span>
        <p>Loading address book...</p>
      </div>
    );
  }

  return (
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
                    <h1 className="ma-headline">Address Book</h1>
                    <p className="ma-subtitle">Manage your shipping and billing addresses to ensure a seamless checkout experience.</p>
                  </div>
                </div>
              </div>

              {showForm && (
                <div className="ma-card address-form-card">
                  <h4 className="ma-card-title">{editingId ? 'Edit Address' : 'Add New Address'}</h4>
                  <form className="ma-form" onSubmit={handleSubmit}>
                    <div className="ma-form-grid">
                      <div className="ma-form-group">
                        <label className="ma-label">Province</label>
                        <select className="ma-input" value={form.provinceId} onChange={(e) => handleFieldChange('provinceId', e.target.value)}>
                          <option value="">Select Province</option>
                          {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
                        </select>
                      </div>
                      <div className="ma-form-group">
                        <label className="ma-label">District</label>
                        <select className="ma-input" value={form.districtId} onChange={(e) => handleFieldChange('districtId', e.target.value)} disabled={!form.provinceId || locationLoading}>
                          <option value="">Select District</option>
                          {districts.map((district) => <option key={district.code} value={district.code}>{district.name}</option>)}
                        </select>
                      </div>
                      <div className="ma-form-group">
                        <label className="ma-label">Ward</label>
                        <select className="ma-input" value={form.wardCode} onChange={(e) => handleFieldChange('wardCode', e.target.value)} disabled={!form.districtId || locationLoading}>
                          <option value="">Select Ward</option>
                          {wards.map((ward) => <option key={ward.code} value={ward.code}>{ward.name}</option>)}
                        </select>
                      </div>
                      <div className="ma-form-group">
                        <label className="ma-label">Receiver Name</label>
                        <input className="ma-input" value={form.receiverName} onChange={(e) => handleFieldChange('receiverName', e.target.value)} />
                      </div>
                      <div className="ma-form-group">
                        <label className="ma-label">Receiver Phone</label>
                        <input className="ma-input" value={form.receiverPhone} onChange={(e) => handleFieldChange('receiverPhone', e.target.value.replace(/\D/g, ''))} />
                      </div>
                      <div className="ma-form-group ma-form-group-wide">
                        <label className="ma-label">Street Address</label>
                        <input className="ma-input" value={form.streetAddress} onChange={(e) => handleFieldChange('streetAddress', e.target.value)} placeholder="House number, street, building" />
                      </div>
                      <label className="address-default-toggle">
                        <input type="checkbox" checked={form.isDefault} onChange={(e) => handleFieldChange('isDefault', e.target.checked)} />
                        Set as default address
                      </label>
                    </div>

                    <div className="ma-form-actions">
                      <button className="ma-btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Address'}</button>
                      <button className="ma-btn-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              <div className="ma-card address-saved-card">
                <div className="address-section-header">
                  <h2>Saved Addresses</h2>
                  <button className="ma-btn-primary address-add-btn" type="button" onClick={handleAddClick}>
                    <span className="material-symbols-outlined">add</span>
                    Add New Address
                  </button>
                </div>
                {loading ? (
                  <div className="address-empty-state">
                    <span className="btn-spinner"></span>
                    <p>Loading addresses...</p>
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="address-empty-state">
                    <span className="material-symbols-outlined">home_work</span>
                    <p>You haven't added any addresses yet.</p>
                  </div>
                ) : (
                  <div className="address-list">
                    {addresses.map((address) => (
                      <article key={address.addressId} className="address-card">
                        <div className="address-card-main">
                          <div className="address-card-title-row">
                            <h3>{address.receiverName}</h3>
                            {address.isDefault && <span className="address-default-badge">Default Shipping</span>}
                          </div>
                          <p><span className="material-symbols-outlined">call</span>{address.receiverPhone}</p>
                          <p><span className="material-symbols-outlined">home_pin</span>{formatAddressLine(address)}</p>
                        </div>
                        <div className="address-card-actions">
                          {!address.isDefault && <button type="button" onClick={() => handleSetDefault(address.addressId)}>Set Default</button>}
                          <button type="button" onClick={() => handleEditClick(address)}>Edit</button>
                          <button type="button" className="danger" onClick={() => handleDelete(address.addressId)}>Delete</button>
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
                  <h3>Delivery Preferences</h3>
                </div>
                <label className="address-delivery-option selected">
                  <input type="radio" defaultChecked />
                  <span>
                    <strong>Standard Shipping</strong>
                    <small>3-5 business days</small>
                  </span>
                </label>
                <label className="address-delivery-option">
                  <input type="radio" />
                  <span>
                    <strong>Express Priority</strong>
                    <small>Next day delivery</small>
                  </span>
                </label>
              </section>

              <section className="ma-card address-stats-card">
                <h3>Quick Stats</h3>
                <div className="address-stat-grid">
                  <div>
                    <span>Total</span>
                    <strong>{String(addresses.length).padStart(2, '0')}</strong>
                  </div>
                  <div>
                    <span>Verified</span>
                    <strong>{String(addresses.length).padStart(2, '0')}</strong>
                  </div>
                </div>
                <div className="address-default-status">
                  <span>Default Set</span>
                  <strong>{defaultAddress ? 'Active' : 'Missing'}</strong>
                  <span className="material-symbols-outlined">{defaultAddress ? 'check_circle' : 'error'}</span>
                </div>
              </section>

              <section className="address-tip-card">
                <span className="material-symbols-outlined">emoji_objects</span>
                <h3>Pro Tip</h3>
                <p>Keep your address information accurate to avoid delivery delays for high-value orders.</p>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

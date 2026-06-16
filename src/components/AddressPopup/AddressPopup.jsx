import React, { useState, useEffect } from 'react';
import addressService from '../../services/addressService';
import vietnamAddressService from '../../services/vietnamAddressService';

const AddressPopup = ({ onClose, onSelect, selectedAddressId }) => {
  const [addresses, setAddresses] = useState([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempSelectedId, setTempSelectedId] = useState(selectedAddressId);

  // New Address State
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [street, setStreet] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');
  
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  useEffect(() => {
    fetchAddresses();
    fetchProvinces();
  }, []);

  const fetchAddresses = async () => {
    try {
      const data = await addressService.getMyAddresses();
      const addrList = Array.isArray(data) ? data : (data?.data || []);
      setAddresses(addrList);
      if (addrList.length === 0) {
        setIsAddingNew(true);
      } else if (!tempSelectedId && addrList.length > 0) {
        setTempSelectedId(addrList[0].addressId || addrList[0].id);
      }
    } catch (error) {
    }
  };

  const fetchProvinces = async () => {
    try {
      const data = await vietnamAddressService.getProvinces();
      setProvinces(data || []);
    } catch (error) {
    }
  };

  const handleProvinceChange = async (e) => {
    const id = e.target.value;
    setProvinceId(id);
    setDistrictId('');
    setWardCode('');
    try {
      const data = await vietnamAddressService.getDistricts(id);
      setDistricts(data || []);
    } catch (error) {
    }
  };

  const handleDistrictChange = async (e) => {
    const id = e.target.value;
    setDistrictId(id);
    setWardCode('');
    try {
      const data = await vietnamAddressService.getWards(id);
      setWards(data || []);
    } catch (error) {
    }
  };

  const handleAddNew = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const newAddress = {
        receiverName,
        receiverPhone,
        streetAddress: street,
        provinceId: parseInt(provinceId),
        districtId: parseInt(districtId),
        wardCode,
        isDefault: addresses.length === 0
      };
      const res = await addressService.createAddress(newAddress);
      onSelect(res || newAddress);
      onClose();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelection = () => {
    const selectedAddr = addresses.find(a => (a.addressId || a.id) === tempSelectedId);
    if (selectedAddr) {
      onSelect(selectedAddr);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/40 backdrop-blur-sm transition-all duration-300">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-2xl overflow-hidden transform transition-transform duration-300">
        
        <div className="p-6 border-b border-outline-variant flex justify-between items-center">
          <h3 className="font-headline-sm text-headline-sm text-secondary">
            {isAddingNew ? 'Add New Address' : 'Select Delivery Address'}
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-secondary transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto font-body-md">
          {!isAddingNew ? (
            <>
              {addresses.length === 0 ? (
                <p className="text-on-surface-variant text-center">You haven't added any addresses yet.</p>
              ) : (
                <div className="space-y-4">
                  {addresses.map((addr) => {
                    const id = addr.addressId || addr.id;
                    const isSelected = id === tempSelectedId;
                    return (
                      <label 
                        key={id}
                        className={`flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all group ${isSelected ? 'border-2 border-secondary bg-secondary/5' : 'border border-outline-variant hover:border-secondary'}`}
                      >
                        <input 
                          type="radio" 
                          name="savedAddress" 
                          checked={isSelected}
                          onChange={() => setTempSelectedId(id)}
                          className="mt-1 w-5 h-5 text-secondary focus:ring-secondary border-outline-variant" 
                        />
                        <div className="flex-grow">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-bold text-secondary`}>{addr.receiverName}</span>
                            {addr.isDefault && <span className="bg-secondary text-on-secondary text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Default</span>}
                          </div>
                          <p className="text-body-sm text-on-surface-variant">{addr.receiverPhone}</p>
                          <p className="text-body-sm text-secondary mt-1">{addr.street}, {addr.wardCode}, {addr.districtId}, {addr.provinceId}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              
              <button 
                onClick={() => setIsAddingNew(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-outline hover:border-secondary hover:text-secondary transition-all rounded-lg text-body-sm font-semibold text-secondary"
              >
                <span className="material-symbols-outlined">add_circle</span> Add New Address
              </button>
            </>
          ) : (
            <form id="new-address-form" onSubmit={handleAddNew} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-on-surface-variant uppercase">Receiver Name</label>
                <input required type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all bg-transparent" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-on-surface-variant uppercase">Receiver Phone</label>
                <input required type="tel" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value.replace(/\D/g, ''))} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all bg-transparent" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-on-surface-variant uppercase">Province</label>
                  <select required value={provinceId} onChange={handleProvinceChange} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all bg-transparent text-sm">
                    <option value="">Select Province</option>
                    {provinces.map((p) => (
                      <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-on-surface-variant uppercase">District</label>
                  <select required disabled={!provinceId} value={districtId} onChange={handleDistrictChange} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all disabled:bg-surface-container-low text-sm bg-transparent">
                    <option value="">Select District</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-on-surface-variant uppercase">Ward</label>
                <select required disabled={!districtId} value={wardCode} onChange={(e) => setWardCode(e.target.value)} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all disabled:bg-surface-container-low text-sm bg-transparent">
                  <option value="">Select Ward</option>
                  {wards.map((w) => (
                    <option key={w.code} value={w.code}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-on-surface-variant uppercase">Street Address</label>
                <input required type="text" value={street} onChange={(e) => setStreet(e.target.value)} className="border border-outline-variant rounded-md py-2 px-3 text-secondary focus:border-secondary focus:ring-1 focus:ring-secondary focus:outline-none transition-all bg-transparent" placeholder="House number, street, building" />
              </div>
            </form>
          )}
        </div>

        <div className="p-6 bg-surface-container-low flex justify-end gap-4">
          {!isAddingNew ? (
            <>
              <button onClick={onClose} className="px-6 py-2 font-button-text text-on-surface-variant hover:text-secondary transition-colors">Cancel</button>
              <button 
                onClick={handleConfirmSelection} 
                className="px-8 py-2 bg-secondary text-white font-button-text rounded-full hover:bg-tertiary-fixed-dim hover:text-secondary transition-all"
              >
                Confirm Selection
              </button>
            </>
          ) : (
            <>
              {addresses.length > 0 && (
                <button onClick={() => setIsAddingNew(false)} className="px-6 py-2 font-button-text text-on-surface-variant hover:text-secondary transition-colors">Back</button>
              )}
              <button 
                type="submit" 
                form="new-address-form" 
                disabled={loading}
                className="px-8 py-2 bg-secondary text-white font-button-text rounded-full hover:bg-tertiary-fixed-dim hover:text-secondary transition-all disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Address'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default AddressPopup;

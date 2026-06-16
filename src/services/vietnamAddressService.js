import api from './api';

const vietnamAddressService = {
  getProvinces: async () => {
    const response = await api.get('/Address/provinces');
    return (response.data || []).map((province) => ({
      code: province.ProvinceID,
      name: province.ProvinceName,
    }));
  },

  getDistricts: async (provinceCode) => {
    const response = await api.get('/Address/districts', {
      params: { provinceId: Number(provinceCode) },
    });
    return (response.data || []).map((district) => ({
      code: district.DistrictID,
      name: district.DistrictName,
    }));
  },

  getWards: async (districtCode) => {
    const response = await api.get('/Address/wards', {
      params: { districtId: Number(districtCode) },
    });
    return (response.data || []).map((ward) => ({
      code: ward.WardCode,
      name: ward.WardName,
    }));
  },
};

export default vietnamAddressService;



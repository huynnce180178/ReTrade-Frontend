import api from './api';

const vietnamAddressService = {
  getProvinces: async () => {
    const response = await api.get('/Address/provinces');
    return (response.data || []).map((province) => ({
      code: province.ProvinceID || province.provinceId || province.provinceID || province.ProvinceId || province.province_id,
      name: province.ProvinceName || province.provinceName || province.ProvinceName || province.province_name,
    }));
  },

  getDistricts: async (provinceCode) => {
    const response = await api.get('/Address/districts', {
      params: { provinceId: Number(provinceCode) },
    });
    return (response.data || []).map((district) => ({
      code: district.DistrictID || district.districtId || district.districtID || district.DistrictId || district.district_id,
      name: district.DistrictName || district.districtName || district.DistrictName || district.district_name,
    }));
  },

  getWards: async (districtCode) => {
    const response = await api.get('/Address/wards', {
      params: { districtId: Number(districtCode) },
    });
    return (response.data || []).map((ward) => ({
      code: ward.WardCode || ward.wardCode || ward.ward_code,
      name: ward.WardName || ward.wardName || ward.ward_name,
    }));
  },
};

export default vietnamAddressService;
const API_BASE = 'https://provinces.open-api.vn/api';

const normalizeCode = (code) => String(code ?? '').padStart(2, '0');
const normalizeWardCode = (code) => String(code ?? '').padStart(5, '0');

const request = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to load Vietnam address data.');
  }
  return response.json();
};

const vietnamAddressService = {
  getProvinces: async () => {
    const provinces = await request(`${API_BASE}/p/`);
    return provinces.map((province) => ({
      code: normalizeCode(province.code),
      name: province.name,
    }));
  },

  getDistricts: async (provinceCode) => {
    const province = await request(`${API_BASE}/p/${provinceCode}?depth=2`);
    return (province.districts || []).map((district) => ({
      code: normalizeCode(district.code),
      name: district.name,
    }));
  },

  getWards: async (districtCode) => {
    const district = await request(`${API_BASE}/d/${districtCode}?depth=2`);
    return (district.wards || []).map((ward) => ({
      code: normalizeWardCode(ward.code),
      name: ward.name,
    }));
  },
};

export default vietnamAddressService;

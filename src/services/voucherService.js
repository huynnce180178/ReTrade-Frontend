import api from './api';

const voucherService = {
  getMyVouchers: (params = '') => {
    let query = '';
    if (typeof params === 'string') {
      query = params ? (params.startsWith('?') ? params : `?${params}`) : '';
    } else if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          searchParams.append(key, params[key]);
        }
      });
      const str = searchParams.toString();
      query = str ? `?${str}` : '';
    }
    return api.get(`/Profile/my-vouchers${query}`).then((r) => r.data);
  },
  getMyVoucherDetail: (userVoucherId) => {
    return api.get(`/Profile/my-vouchers/${userVoucherId}`).then((r) => r.data);
  },
};

export default voucherService;

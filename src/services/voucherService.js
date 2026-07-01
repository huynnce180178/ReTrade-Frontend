import api from './api';

const voucherService = {
  getMyVouchers: (params = '') => {
    const query = params ? `?${params}` : '';
    return api.get(`/Profile/my-vouchers${query}`).then((r) => r.data);
  },
  getMyVoucherDetail: (userVoucherId) => {
    return api.get(`/Profile/my-vouchers/${userVoucherId}`).then((r) => r.data);
  },
};

export default voucherService;

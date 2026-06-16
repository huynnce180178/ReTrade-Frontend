import api from './api';

const getManageRoles = (accountId) => api.get(`/account-roles/${accountId}`).then(r => r.data);
const assignRole = (accountId, roleId) => api.post(`/account-roles/${accountId}/roles/${roleId}`).then(r => r.data);
const removeRole = (accountId, roleId) => api.delete(`/account-roles/${accountId}/roles/${roleId}`).then(r => r.data);

const accountRoleService = {
  getManageRoles,
  assignRole,
  removeRole,
};

export default accountRoleService;

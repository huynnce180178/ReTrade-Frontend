import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import accountService from '../../../services/accountService';
import accountRoleService from '../../../services/accountRoleService';
import profileService from '../../../services/profileService';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useLanguage } from '../../../context/LanguageContext';
import { formatDateTimeGmt7 } from '../../../utils/dateTime';
import './UserAccounts.css';

const statusPalette = {
  Active: 'success',
  Inactive: 'danger',
  Pending: 'warning',
};

const statusTone = (status) => {
  if (status === 'Active') return 'success';
  if (isInactiveStatus(status)) return 'danger';
  if (status === 'Pending') return 'warning';
  return 'neutral';
};

const normalizeText = (value) => (value || '').toString().trim().toLowerCase();

const isInactiveStatus = (status) => {
  const s = (status || '').toString().toLowerCase();
  return s === 'inactive' || s === 'ban' || s === 'banned' || s.includes('inactive') || s.includes('ban') || s.includes('banned');
};

const extractErrorMessage = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const data = error?.response?.data ?? error?.data ?? error;
  if (!data) return error?.message || String(error);
  if (typeof data === 'string') return data;
  if (data?.message) return data.message;
  if (data?.Message) return data.Message;
  try { return JSON.stringify(data); } catch (e) { return String(data); }
};

function UserAvatar({ src, name }) {
  const [hasError, setHasError] = React.useState(false);
  const initials = (name || 'User').trim().slice(0, 2).toUpperCase();

  if (!src || hasError) {
    return <span>{initials}</span>;
  }

  return (
    <img
      src={src}
      alt={name || 'User'}
      onError={() => setHasError(true)}
    />
  );
}

export default function UserAccounts() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
  const { t, formatNumber } = useLanguage();
  const roleActionInFlightRef = useRef(new Set());

  const formatRole = (role) => {
    if (!role || role === 'All') return t('admin.listings.tab_all');
    if (role === 'Admin') return t('admin.users.role_admin');
    if (role === 'Buyer') return t('admin.users.role_buyer');
    if (role === 'Seller') return t('admin.users.role_seller');
    return role;
  };

  const formatStatus = (st) => {
    if (!st || st === 'All') return t('admin.listings.tab_all');
    if (st === 'Active') return t('common.active');
    if (isInactiveStatus(st)) return t('common.inactive');
    if (st === 'Pending') return t('common.pending');
    return st;
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pendingActionUser, setPendingActionUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleModalLoading, setRoleModalLoading] = useState(false);
  const [roleItems, setRoleItems] = useState([]);

  // New state variables for Ban reasons and Seller subscription management
  const [selectedBanReasonKey, setSelectedBanReasonKey] = useState('');
  const [customBanReason, setCustomBanReason] = useState('');
  const [pendingSellerGrantUser, setPendingSellerGrantUser] = useState(null);
  const [pendingSellerRevokeUser, setPendingSellerRevokeUser] = useState(null);
  const [sellerActionLoading, setSellerActionLoading] = useState(false);
  const [pendingRoleConfirm, setPendingRoleConfirm] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await accountService.getAdminUserList("?$orderby=CreatedAt desc&$top=100");
      const data = Array.isArray(response) ? response : (response?.value || []);
      setUsers(data);
      setSelectedUserId((currentId) => {
        if (currentId && data.some((item) => item.accountId === currentId)) {
          return currentId;
        }
        return data[0]?.accountId || null;
      });
    } catch (error) {
      showToast(t('common.load_error'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set(users.map((user) => user.primaryRole).filter(Boolean));
    return ['All', ...Array.from(uniqueRoles).sort()];
  }, [users]);

  const statusOptions = useMemo(() => {
    return ['All', 'Active', 'Inactive', 'Pending'];
  }, []);

  const filteredUsers = useMemo(() => {
    const search = normalizeText(searchTerm);

    return users.filter((user) => {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const haystack = [
        user.accountId,
        user.userId,
        user.username,
        user.email,
        user.primaryRole,
        name,
        user.provider,
      ]
        .map(normalizeText)
        .join(' ');

      const matchesSearch = !search || haystack.includes(search);
      const matchesRole = roleFilter === 'All' || user.primaryRole === roleFilter;
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && user.status === 'Active') ||
        (statusFilter === 'Pending' && user.status === 'Pending') ||
        (statusFilter === 'Inactive' && isInactiveStatus(user.status));

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pagination State (9 users per page)
  const pageSize = 9;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / pageSize) || 1;
  }, [filteredUsers, pageSize]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const selectedUser = filteredUsers.find((user) => user.accountId === selectedUserId) || filteredUsers[0] || null;

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === 'Active').length;
    const sellers = users.filter((user) => user.primaryRole === 'Seller').length;
    const buyers = users.filter((user) => user.primaryRole === 'Buyer').length;
    const admins = users.filter((user) => user.primaryRole === 'Admin').length;

    return { total, active, sellers, buyers, admins };
  }, [users]);

  const roleChartData = useMemo(() => [
    { name: t('admin.users.role_admin'), value: summary.admins, color: '#991B1B' },
    { name: t('admin.users.role_seller'), value: summary.sellers, color: '#d97706' },
    { name: t('admin.users.role_buyer'), value: summary.buyers, color: '#2563eb' }
  ].filter(d => d.value > 0), [summary, t]);

  const statusChartData = useMemo(() => [
    { name: t('common.active'), count: summary.active, color: '#16a34a' },
    { name: t('common.inactive'), count: users.length - summary.active, color: '#dc2626' }
  ], [summary, users, t]);

  const exportCsv = () => {
    if (!users.length) {
      showToast(t('common.no_data'), 'info');
      return;
    }

    const header = ['Account ID', 'User ID', 'Username', 'Email', 'Role', 'Status', 'Created At'];
    const rows = users.map((user) => [
      user.accountId || '',
      user.userId || '',
      user.username || '',
      user.email || '',
      user.primaryRole || '',
      user.status || '',
      user.createdAt ? new Date(user.createdAt).toISOString() : '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'retrade-user-accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const openRoleModal = async (user) => {
    if (!user?.accountId) {
      showToast(t('common.select_account_warning'), 'warning');
      return;
    }

    setSelectedUserId(user.accountId);
    setShowRoleModal(true);
    setRoleModalLoading(true);
    setRoleItems([]);

    try {
      const res = await accountRoleService.getManageRoles(user.accountId);
      let profileRoles = [];
      try {
        const prof = await profileService.getUserProfile(user.userId);
        profileRoles = prof?.roles || prof?.assignedRoles || [];
      } catch (e) {
        profileRoles = [];
      }

      let items = [];
      if (Array.isArray(res)) {
        items = res.map((r) => ({ roleId: r.roleId ?? r.id, name: r.name ?? r.roleName ?? r.displayName, isAssigned: !!r.isAssigned, loading: false }));
      } else {
        const roles = res.roles || res.allRoles || res.availableRoles || [];
        const assignedFromRes = new Set((res.assignedRoleIds || res.assignedRoles || res.assigned || []).map((a) => (typeof a === 'object' ? a.roleId ?? a.id : a)));
        items = (roles || []).map((r) => ({ roleId: r.roleId ?? r.id, name: r.name ?? r.roleName ?? r.displayName, isAssigned: assignedFromRes.has(r.roleId ?? r.id), loading: false }));
      }

      if (profileRoles && profileRoles.length > 0 && items.length > 0) {
        const profileIds = new Set(profileRoles.map((p) => (typeof p === 'object' ? p.roleId ?? p.id ?? p.name : p)));
        const profileNames = new Set(profileRoles.map((p) => (typeof p === 'object' ? (p.name || p.roleName || '').toString().toLowerCase() : String(p).toLowerCase())));

        items = items.map((it) => {
          const idMatch = profileIds.has(it.roleId) || profileIds.has(String(it.roleId));
          const nameMatch = profileNames.has((it.name || '').toString().toLowerCase());
          return { ...it, isAssigned: !!it.isAssigned || idMatch || nameMatch };
        });
      }

      if (items.length > 0 && !items.some((i) => i.isAssigned) && selectedUser?.primaryRole) {
        const primary = (selectedUser.primaryRole || '').toString().toLowerCase();
        items = items.map((it) => ({ ...it, isAssigned: it.isAssigned || (it.name || '').toString().toLowerCase() === primary }));
      }

      setRoleItems(items);
    } catch (error) {
      showToast(extractErrorMessage(error) || t('common.load_error'), 'error');
      setShowRoleModal(false);
    } finally {
      setRoleModalLoading(false);
    }
  };

  const closeRoleModal = () => {
    if (roleModalLoading) return;
    setShowRoleModal(false);
    setRoleItems([]);
  };

  const toggleRoleAssignment = async (role) => {
    if (!selectedUserId) return;
    if (role.loading) return;

    if (currentUser?.accountId === selectedUserId && role.isAssigned) {
      showToast(t('common.own_role_warning'), 'error');
      return;
    }

    const actionKey = `${selectedUserId}:${role.roleId}`;
    if (roleActionInFlightRef.current.has(actionKey)) return;
    roleActionInFlightRef.current.add(actionKey);

    setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, loading: true } : r)));

    try {
      if (role.isAssigned) {
        await accountRoleService.removeRole(selectedUserId, role.roleId);
        showToast(t('admin.users.revoke_role_success', { role: formatRole(role.name) || role.name }), 'success');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: false, loading: false } : r)));
      } else {
        await accountRoleService.assignRole(selectedUserId, role.roleId);
        showToast(t('admin.users.grant_role_success', { role: formatRole(role.name) || role.name }), 'success');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: true, loading: false } : r)));
      }
      await fetchUsers();
    } catch (error) {
      const msg = extractErrorMessage(error).toLowerCase();
      if (msg.includes('already assigned')) {
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: true, loading: false } : r)));
        showToast(t('common.save_error'), 'warning');
      } else if (msg.includes('not found') || msg.includes('assignment not found')) {
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: false, loading: false } : r)));
        showToast(t('common.save_error'), 'warning');
      } else {
        showToast(extractErrorMessage(error) || t('common.save_error'), 'error');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, loading: false } : r)));
      }
    } finally {
      roleActionInFlightRef.current.delete(actionKey);
    }
  };

  const openUserDetail = async (user) => {
    if (!user?.userId) {
      showToast(t('common.no_data'), 'warning');
      return;
    }

    setSelectedUserId(user.accountId);
    setShowDetailModal(true);
    setDetailError('');
    setSelectedUserDetail(null);
    setDetailLoading(true);

    try {
      const detail = await profileService.getUserProfile(user.userId);
      setSelectedUserDetail(detail);
    } catch (error) {
      setDetailError(extractErrorMessage(error) || t('common.load_error'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    if (detailLoading) return;
    setShowDetailModal(false);
    setSelectedUserDetail(null);
    setDetailError('');
  };

  const openStatusActionModal = (user) => {
    if (!user?.accountId) return;
    if (user?.primaryRole?.toLowerCase() === 'admin') {
      showToast('Không thể thực hiện khóa/mở khóa đối với tài khoản Admin.', 'error');
      return;
    }
    setPendingActionUser(user);
    setSelectedBanReasonKey('');
    setCustomBanReason('');
  };

  const closeStatusActionModal = () => {
    if (actionLoading) return;
    setPendingActionUser(null);
    setSelectedBanReasonKey('');
    setCustomBanReason('');
  };

  const confirmStatusAction = async () => {
    if (!pendingActionUser?.accountId) return;

    const isInactive = isInactiveStatus(pendingActionUser?.status);
    let banReason = null;

    if (!isInactive) {
      if (selectedBanReasonKey && selectedBanReasonKey !== 'other') {
        const presetText = t(`admin.users.ban_reasons.${selectedBanReasonKey}`);
        banReason = customBanReason.trim() ? `${presetText} - ${customBanReason.trim()}` : presetText;
      } else if (customBanReason.trim()) {
        banReason = customBanReason.trim();
      } else {
        banReason = t('admin.users.ban_reasons.terms_violation');
      }
    }

    try {
      setActionLoading(true);
      await accountService.banUser(pendingActionUser.accountId, banReason);
      showToast(isInactive ? t('admin.users.unban_success') : t('admin.users.ban_success'), 'success');
      setPendingActionUser(null);
      setSelectedBanReasonKey('');
      setCustomBanReason('');
      await fetchUsers();
      if (showDetailModal && selectedUserDetail?.accountId === pendingActionUser.accountId) {
        const detail = await profileService.getUserProfile(pendingActionUser.userId);
        setSelectedUserDetail(detail);
      }
    } catch (error) {
      showToast(
        extractErrorMessage(error) || (isInactive ? t('admin.users.unban_error') : t('admin.users.ban_error')),
        'error'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const confirmGrantSeller = async () => {
    if (!pendingSellerGrantUser?.accountId) return;
    try {
      setSellerActionLoading(true);
      await accountService.grantSellerUnlimited(pendingSellerGrantUser.accountId);
      showToast(t('admin.users.grant_seller_success'), 'success');
      setPendingSellerGrantUser(null);
      await fetchUsers();
      if (showDetailModal && selectedUserDetail?.accountId === pendingSellerGrantUser.accountId) {
        const detail = await profileService.getUserProfile(pendingSellerGrantUser.userId);
        setSelectedUserDetail(detail);
      }
    } catch (error) {
      showToast(extractErrorMessage(error) || t('common.save_error'), 'error');
    } finally {
      setSellerActionLoading(false);
    }
  };

  const confirmRevokeSeller = async () => {
    if (!pendingSellerRevokeUser?.accountId) return;
    try {
      setSellerActionLoading(true);
      await accountService.revokeSeller(pendingSellerRevokeUser.accountId);
      showToast(t('admin.users.revoke_seller_success'), 'success');
      setPendingSellerRevokeUser(null);
      await fetchUsers();
      if (showDetailModal && selectedUserDetail?.accountId === pendingSellerRevokeUser.accountId) {
        const detail = await profileService.getUserProfile(pendingSellerRevokeUser.userId);
        setSelectedUserDetail(detail);
      }
    } catch (error) {
      showToast(extractErrorMessage(error) || t('common.save_error'), 'error');
    } finally {
      setSellerActionLoading(false);
    }
  };

  const pendingIsInactive = (() => {
    const statusFromPending = pendingActionUser?.status;
    if (statusFromPending) return isInactiveStatus(statusFromPending);
    const found = users.find((u) => u.accountId === pendingActionUser?.accountId);
    return isInactiveStatus(found?.status);
  })();

  return (
    <div className="admin-user-list-page animate-fade-in">
      <section className="admin-user-hero">
        <div>
          <p className="admin-eyebrow">{t('admin.eyebrow')}</p>
          <h1>{t('admin.users.hero_title')}</h1>
          <p className="admin-hero-copy">
            {t('admin.users.hero_sub')}
          </p>
        </div>

        <button className="admin-export-btn" onClick={exportCsv}>
          <span className="material-symbols-outlined">download</span>
          {t('admin.users.export_dataset')}
        </button>
      </section>

      <section className="admin-stat-grid">
        <article className="admin-stat-card">
          <span className="admin-stat-label">{t('admin.users.stat_total')}</span>
          <strong className="admin-stat-value">{formatNumber(summary.total)}</strong>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{t('admin.users.stat_sellers')}</span>
          <strong className="admin-stat-value">{formatNumber(summary.sellers)}</strong>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{t('admin.users.stat_buyers')}</span>
          <strong className="admin-stat-value">{formatNumber(summary.buyers)}</strong>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">{t('admin.users.stat_admins')}</span>
          <strong className="admin-stat-value">{formatNumber(summary.admins)}</strong>
        </article>
      </section>

      <section className="admin-user-charts-grid">
        <article className="admin-user-chart-card">
          <div className="chart-card-header">
            <span className="material-symbols-outlined icon">pie_chart</span>
            <div>
              <h3>{t('admin.users.role_distribution_title')}</h3>
              <p>{t('admin.users.role_distribution_sub')}</p>
            </div>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={roleChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {roleChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={32} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-user-chart-card">
          <div className="chart-card-header">
            <span className="material-symbols-outlined icon">bar_chart</span>
            <div>
              <h3>{t('admin.users.status_breakdown_title')}</h3>
              <p>{t('admin.users.status_breakdown_sub')}</p>
            </div>
          </div>
          <div className="chart-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={statusChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="admin-user-panel">
        <div className="admin-user-list-shell">
          <header className="admin-panel-header">
            <div>
              <h2>{t('admin.users.participants')}</h2>
              <p>{t('admin.users.participants_sub')}</p>
            </div>

            <div className="admin-panel-toolbar-area">
              <div className="admin-pill-group">
                {roleOptions.map((option) => (
                  <button
                    key={option}
                    className={`admin-pill ${roleFilter === option ? 'active' : ''}`}
                    onClick={() => setRoleFilter(option)}
                    type="button"
                  >
                    {option === 'All' ? `${t('admin.listings.tab_all')} (${formatNumber(users.length)})` : formatRole(option)}
                  </button>
                ))}
              </div>

              <div className="admin-search-row">
                <label className="admin-search-box">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    type="text"
                    placeholder={t('admin.users.search_placeholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>

                <label className="admin-select-box">
                  <span className="material-symbols-outlined">filter_alt</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {t('admin.users.status_filter_label', { status: formatStatus(option) })}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </header>

          <div className="admin-user-table-wrap">
            {loading ? (
              <div className="admin-empty-state">
                <span className="btn-spinner"></span>
                <p>{t('common.loading')}</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty-state">
                <span className="material-symbols-outlined">manage_accounts</span>
                <h3>{t('admin.listings.no_products')}</h3>
                <p>{t('admin.listings.no_products_sub')}</p>
              </div>
            ) : (
              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="admin-user-table">
                  <thead>
                    <tr>
                      <th>{t('admin.users.col_info')}</th>
                      <th>{t('admin.users.col_role')}</th>
                      <th>{t('admin.users.col_provider')}</th>
                      <th>{t('admin.users.col_status')}</th>
                      <th>{t('admin.users.col_last_login')}</th>
                      <th>{t('admin.users.col_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => {
                      const isSelected = selectedUser?.accountId === user.accountId;
                      const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || t('admin.users.unknown_user');
                      const statusClass = statusTone(user.status);

                      return (
                        <tr
                          key={user.accountId}
                          className={isSelected ? 'selected' : ''}
                          onClick={() => openUserDetail(user)}
                        >
                          <td>
                            <div className="admin-user-identity">
                              <div className="admin-user-avatar">
                                <UserAvatar src={user.avatarUrl} name={displayName} />
                              </div>
                              <div>
                                <strong>{displayName}</strong>
                                <p>{user.email || t('admin.users.no_email')}</p>
                                <span className="admin-subtle-id">{user.accountId}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`admin-role-badge role-${(user.primaryRole || 'unknown').toLowerCase()}`}>
                              {formatRole(user.primaryRole) || t('admin.users.unassigned')}
                            </span>
                          </td>
                          <td>{user.provider || 'Local'}</td>
                          <td>
                            <span className={`admin-status-badge ${statusClass}`}>
                              {formatStatus(user.status)}
                            </span>
                          </td>
                          <td>{(user.lastLoginAt || user.lastLogin || user.LastLoginAt || user.LastLogin) ? formatDateTimeGmt7(user.lastLoginAt || user.lastLogin || user.LastLoginAt || user.LastLogin) : t('admin.users.never')}</td>
                          <td>
                            <div className="admin-table-actions-cell" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="admin-tbl-action-btn view-btn"
                                title={t('admin.users.detail')}
                                onClick={() => openUserDetail(user)}
                              >
                                <span className="material-symbols-outlined">visibility</span>
                                <span>{t('admin.users.detail')}</span>
                              </button>
                              <button
                                type="button"
                                className="admin-tbl-action-btn role-btn"
                                title={t('admin.users.roles')}
                                onClick={() => openRoleModal(user)}
                              >
                                <span className="material-symbols-outlined">manage_accounts</span>
                                <span>{t('admin.users.roles')}</span>
                              </button>
                              <button
                                type="button"
                                className={`admin-tbl-action-btn ${isInactiveStatus(user.status) ? 'unban-btn' : 'ban-btn'}`}
                                title={user.primaryRole?.toLowerCase() === 'admin' ? 'Không thể thao tác Admin' : isInactiveStatus(user.status) ? t('admin.users.unban') : t('admin.users.ban')}
                                onClick={() => openStatusActionModal(user)}
                                disabled={currentUser?.accountId === user.accountId || user.primaryRole?.toLowerCase() === 'admin'}
                              >
                                <span className="material-symbols-outlined">
                                  {isInactiveStatus(user.status) ? 'check_circle' : 'block'}
                                </span>
                                <span>{isInactiveStatus(user.status) ? t('admin.users.unban') : t('admin.users.ban')}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <footer className="admin-table-footer">
            <span>
              {t('admin.users.displaying_count', { current: paginatedUsers.length, total: formatNumber(filteredUsers.length) })}
              {filteredUsers.length > 0 && (
                <span style={{ marginLeft: '8px', opacity: 0.8, fontSize: '13px' }}>
                  ({(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredUsers.length)})
                </span>
              )}
            </span>
            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  title={t('admin.users.prev')}
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={p === currentPage ? 'active' : ''}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  title={t('admin.users.next')}
                >
                  ›
                </button>
              </div>
            )}
          </footer>
        </div>
      </section>

      {pendingActionUser && createPortal(
        <div className="admin-confirm-modal-overlay" onClick={closeStatusActionModal}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`admin-confirm-modal-header ${pendingIsInactive ? 'is-unban' : 'is-ban'}`}>
              <div className="admin-confirm-icon-badge">
                <span className="material-symbols-outlined">
                  {pendingIsInactive ? 'verified_user' : 'gavel'}
                </span>
              </div>
              <div>
                <p className="admin-confirm-kicker">
                  {pendingIsInactive ? t('admin.users.unban') : t('admin.users.ban')}
                </p>
                <h3>
                  {pendingIsInactive ? t('admin.users.unban_confirm_title') : t('admin.users.ban_confirm_title')}
                </h3>
              </div>
              <button type="button" className="admin-confirm-close" onClick={closeStatusActionModal} disabled={actionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-confirm-modal-body">
              <div className="admin-confirm-user-card">
                <div className="user-avatar-sm">
                  {pendingActionUser.avatarUrl ? (
                    <img src={pendingActionUser.avatarUrl} alt={pendingActionUser.username} />
                  ) : (
                    <span>{(pendingActionUser.username || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="user-details-summary">
                  <strong>{pendingActionUser.username || pendingActionUser.accountId}</strong>
                  <p>{pendingActionUser.email || t('admin.users.no_email')}</p>
                  <span className="user-id-subtle">ID: {pendingActionUser.accountId}</span>
                </div>
              </div>

              <div className={`admin-confirm-note-box ${pendingIsInactive ? 'unban-note' : 'ban-note'}`}>
                <span className="material-symbols-outlined icon">
                  {pendingIsInactive ? 'check_circle' : 'warning'}
                </span>
                <p>
                  {pendingIsInactive
                    ? t('admin.users.unban_confirm_body')
                    : t('admin.users.ban_confirm_body')}
                </p>
              </div>

              {!pendingIsInactive && (
                <div className="admin-ban-reason-form">
                  <label className="admin-ban-reason-label">
                    {t('admin.users.ban_reason_label')}
                  </label>
                  <select
                    className="admin-ban-reason-select"
                    value={selectedBanReasonKey}
                    onChange={(e) => setSelectedBanReasonKey(e.target.value)}
                  >
                    <option value="">{t('admin.users.ban_reason_select')}</option>
                    <option value="terms_violation">{t('admin.users.ban_reasons.terms_violation')}</option>
                    <option value="fake_counterfeit_product">{t('admin.users.ban_reasons.fake_counterfeit_product')}</option>
                    <option value="fraud_scam">{t('admin.users.ban_reasons.fraud_scam')}</option>
                    <option value="multiple_reports">{t('admin.users.ban_reasons.multiple_reports')}</option>
                    <option value="other">{t('admin.users.ban_reasons.other')}</option>
                  </select>

                  <textarea
                    className="admin-ban-reason-textarea"
                    placeholder={t('admin.users.ban_reason_custom_placeholder')}
                    value={customBanReason}
                    onChange={(e) => setCustomBanReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            <div className="admin-confirm-modal-footer">
              <button type="button" className="admin-confirm-btn cancel" onClick={closeStatusActionModal} disabled={actionLoading}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={`admin-confirm-btn submit ${pendingIsInactive ? 'unban' : 'ban'}`}
                onClick={confirmStatusAction}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>{t('common.loading')}</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">
                      {pendingIsInactive ? 'check_circle' : 'block'}
                    </span>
                    <span>{pendingIsInactive ? t('admin.users.unban') : t('admin.users.ban')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showRoleModal && createPortal(
        <div className="admin-role-modal-overlay" onClick={closeRoleModal}>
          <div className="admin-role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-role-modal-header">
              <div>
                <p className="admin-detail-kicker">{t('admin.users.manage_roles_title')}</p>
                <h3>{selectedUser ? `${selectedUser.username || selectedUser.accountId}` : selectedUserId}</h3>
              </div>
              <button type="button" className="admin-detail-close" onClick={closeRoleModal} disabled={roleModalLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-role-modal-body">
              {roleModalLoading ? (
                <div className="admin-detail-loading">
                  <span className="btn-spinner"></span>
                  <p>{t('common.loading')}</p>
                </div>
              ) : (
                <div className="admin-role-list">
                  {roleItems.length === 0 ? (
                    <p className="admin-detail-muted">{t('common.no_data')}</p>
                  ) : (
                    roleItems.map((role) => {
                      const isSelf = currentUser?.accountId === selectedUserId;
                      const isRemovingSelfRole = isSelf && role.isAssigned;
                      return (
                        <div key={role.roleId} className="role-item">
                          <div>
                            <strong>{formatRole(role.name) || role.name || `Role ${role.roleId}`}</strong>
                          </div>
                          <div>
                            <button
                              type="button"
                              className={`admin-action-btn ${role.isAssigned ? 'danger' : 'ghost'}`}
                              onClick={() => setPendingRoleConfirm({ role })}
                              disabled={role.loading || isRemovingSelfRole}
                              title={isRemovingSelfRole ? t('common.own_role_warning') : ''}
                            >
                              {role.loading ? t('common.loading') : role.isAssigned ? t('admin.users.remove') : t('admin.users.assign')}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="admin-detail-modal-footer">
              <button type="button" className="admin-action-btn outline" onClick={closeRoleModal} disabled={roleModalLoading}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDetailModal && createPortal(
        <div className="admin-detail-modal-overlay" onClick={closeDetailModal}>
          <div className="admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-detail-modal-header">
              <div>
                <p className="admin-detail-kicker">{t('admin.users.user_detail_title')}</p>
                <h3>{selectedUserDetail ? selectedUserDetail.username || selectedUserDetail.accountId : t('common.loading')}</h3>
              </div>
              <button type="button" className="admin-detail-close" onClick={closeDetailModal} disabled={detailLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-detail-modal-body">
              {detailLoading ? (
                <div className="admin-detail-loading">
                  <span className="btn-spinner"></span>
                  <p>{t('common.loading')}</p>
                </div>
              ) : detailError ? (
                <div className="admin-detail-error">
                  <span className="material-symbols-outlined">error</span>
                  <p>{detailError}</p>
                </div>
              ) : selectedUserDetail ? (
                <>
                  <div className="admin-detail-profile-head">
                    <div className="admin-detail-big-avatar">
                      <UserAvatar src={selectedUserDetail.avatarUrl} name={selectedUserDetail.username || selectedUserDetail.firstName} />
                    </div>
                    <div>
                      <h4>{`${selectedUserDetail.firstName || ''} ${selectedUserDetail.lastName || ''}`.trim() || selectedUserDetail.username || t('admin.users.no_username')}</h4>
                      <p>{selectedUserDetail.email || t('admin.users.no_email')}</p>
                      <div className="admin-detail-badges">
                        <span className={`admin-status-badge ${statusTone(selectedUserDetail.status)}`}>{formatStatus(selectedUserDetail.status)}</span>
                        {selectedUserDetail.roles?.map((role) => (
                          <span key={role} className={`admin-role-badge role-${role?.toLowerCase() || 'unknown'}`}>{formatRole(role)}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="admin-detail-info-grid">
                    <div><span>{t('admin.users.account_id')}</span><strong>{selectedUserDetail.accountId}</strong></div>
                    <div><span>{t('admin.users.user_id')}</span><strong>{selectedUserDetail.userId}</strong></div>
                    <div><span>{t('admin.users.username')}</span><strong>{selectedUserDetail.username || '-'}</strong></div>
                    <div><span>{t('admin.users.phone')}</span><strong>{selectedUserDetail.phone || '-'}</strong></div>
                    <div><span>{t('admin.users.created_at')}</span><strong>{formatDateTimeGmt7(selectedUserDetail.createdAt)}</strong></div>
                    <div><span>{t('admin.users.updated_at')}</span><strong>{formatDateTimeGmt7(selectedUserDetail.updatedAt)}</strong></div>
                    <div><span>{t('admin.users.is_deleted')}</span><strong>{selectedUserDetail.isDeleted ? t('common.yes') : t('common.no')}</strong></div>
                    <div><span>{t('admin.users.default_address')}</span><strong>{selectedUserDetail.defaultAddress?.street || t('admin.users.no_default_address')}</strong></div>
                  </div>

                  <div className="admin-detail-address-card">
                    <h4>{t('admin.users.default_address')}</h4>
                    {selectedUserDetail.defaultAddress ? (
                      <div className="admin-detail-address-content">
                        <p>{selectedUserDetail.defaultAddress.receiverName || '-'}</p>
                        <p>{selectedUserDetail.defaultAddress.receiverPhone || '-'}</p>
                        <p>{selectedUserDetail.defaultAddress.street || '-'}</p>
                      </div>
                    ) : (
                      <p className="admin-detail-muted">{t('admin.users.no_default_address_sub')}</p>
                    )}
                  </div>

                  <div className="admin-detail-address-card">
                    <h4>{t('admin.users.seller_subscription')}</h4>
                    {selectedUserDetail.roles?.includes('Seller') ? (
                      <div className="admin-seller-sub-box">
                        <div className="sub-badge-row">
                          <span className="badge-unlimited">{t('admin.users.unlimited')}</span>
                          <span className="badge-admin-granted">{t('admin.users.admin_granted')}</span>
                        </div>
                        <p className="admin-detail-muted">{t('admin.users.seller_active_desc')}</p>
                        <button
                          type="button"
                          className="admin-seller-action-btn danger"
                          onClick={() => setPendingSellerRevokeUser(selectedUserDetail)}
                        >
                          <span className="material-symbols-outlined">person_remove</span>
                          <span>{t('admin.users.btn_revoke_seller')}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="admin-seller-sub-box">
                        <p className="admin-detail-muted">{t('admin.users.seller_inactive_desc')}</p>
                        <button
                          type="button"
                          className="admin-seller-action-btn success"
                          onClick={() => setPendingSellerGrantUser(selectedUserDetail)}
                        >
                          <span className="material-symbols-outlined">workspace_premium</span>
                          <span>{t('admin.users.btn_grant_seller')}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {selectedUserDetail.addresses?.length > 0 && (
                    <div className="admin-detail-address-card">
                      <h4>{t('admin.users.all_addresses')}</h4>
                      <div className="admin-address-list">
                        {selectedUserDetail.addresses.map((address) => (
                          <div key={address.addressId} className="admin-address-item">
                            <strong>{address.receiverName || address.addressId}</strong>
                            <p>{address.receiverPhone || '-'}</p>
                            <p>{address.street || '-'}</p>
                            <span>{address.isDefault ? t('admin.users.default_address') : t('admin.users.secondary_address')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingSellerGrantUser && createPortal(
        <div className="admin-confirm-modal-overlay" onClick={() => !sellerActionLoading && setPendingSellerGrantUser(null)}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-confirm-modal-header is-unban">
              <div className="admin-confirm-icon-badge">
                <span className="material-symbols-outlined">workspace_premium</span>
              </div>
              <div>
                <p className="admin-confirm-kicker">{t('admin.users.grant_seller_title')}</p>
                <h3>{pendingSellerGrantUser.username || pendingSellerGrantUser.accountId}</h3>
              </div>
              <button type="button" className="admin-confirm-close" onClick={() => setPendingSellerGrantUser(null)} disabled={sellerActionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="admin-confirm-modal-body">
              <p>{t('admin.users.grant_seller_msg')}</p>
            </div>
            <div className="admin-confirm-modal-footer">
              <button type="button" className="admin-confirm-btn cancel" onClick={() => setPendingSellerGrantUser(null)} disabled={sellerActionLoading}>
                {t('common.cancel')}
              </button>
              <button type="button" className="admin-confirm-btn submit unban" onClick={confirmGrantSeller} disabled={sellerActionLoading}>
                {sellerActionLoading ? <span className="btn-spinner"></span> : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingSellerRevokeUser && createPortal(
        <div className="admin-confirm-modal-overlay" onClick={() => !sellerActionLoading && setPendingSellerRevokeUser(null)}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-confirm-modal-header is-ban">
              <div className="admin-confirm-icon-badge">
                <span className="material-symbols-outlined">person_remove</span>
              </div>
              <div>
                <p className="admin-confirm-kicker">{t('admin.users.revoke_seller_title')}</p>
                <h3>{pendingSellerRevokeUser.username || pendingSellerRevokeUser.accountId}</h3>
              </div>
              <button type="button" className="admin-confirm-close" onClick={() => setPendingSellerRevokeUser(null)} disabled={sellerActionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="admin-confirm-modal-body">
              <p>{t('admin.users.revoke_seller_msg')}</p>
            </div>
            <div className="admin-confirm-modal-footer">
              <button type="button" className="admin-confirm-btn cancel" onClick={() => setPendingSellerRevokeUser(null)} disabled={sellerActionLoading}>
                {t('common.cancel')}
              </button>
              <button type="button" className="admin-confirm-btn submit ban" onClick={confirmRevokeSeller} disabled={sellerActionLoading}>
                {sellerActionLoading ? <span className="btn-spinner"></span> : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingRoleConfirm && createPortal(
        <div className="admin-confirm-modal-overlay" onClick={() => setPendingRoleConfirm(null)}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`admin-confirm-modal-header ${pendingRoleConfirm.role.isAssigned ? 'is-ban' : 'is-unban'}`}>
              <div className="admin-confirm-icon-badge">
                <span className="material-symbols-outlined">
                  {pendingRoleConfirm.role.isAssigned ? 'person_remove' : 'manage_accounts'}
                </span>
              </div>
              <div>
                <p className="admin-confirm-kicker">{t('admin.users.manage_roles_title')}</p>
                <h3>{pendingRoleConfirm.role.isAssigned ? t('admin.users.revoke_role_title') : t('admin.users.grant_role_title')}</h3>
              </div>
              <button type="button" className="admin-confirm-close" onClick={() => setPendingRoleConfirm(null)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="admin-confirm-modal-body">
              <p>
                {pendingRoleConfirm.role.isAssigned
                  ? t('admin.users.confirm_remove_role_msg', { role: formatRole(pendingRoleConfirm.role.name) || pendingRoleConfirm.role.name, user: selectedUserDetail?.username || selectedUserDetail?.accountId || '' })
                  : t('admin.users.confirm_assign_role_msg', { role: formatRole(pendingRoleConfirm.role.name) || pendingRoleConfirm.role.name, user: selectedUserDetail?.username || selectedUserDetail?.accountId || '' })}
              </p>
            </div>
            <div className="admin-confirm-modal-footer">
              <button type="button" className="admin-confirm-btn cancel" onClick={() => setPendingRoleConfirm(null)}>
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className={`admin-confirm-btn submit ${pendingRoleConfirm.role.isAssigned ? 'ban' : 'unban'}`}
                onClick={() => {
                  const r = pendingRoleConfirm.role;
                  setPendingRoleConfirm(null);
                  toggleRoleAssignment(r);
                }}
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

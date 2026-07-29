import React, { useEffect, useMemo, useState } from 'react';
import accountService from '../../../services/accountService';
import accountRoleService from '../../../services/accountRoleService';
import profileService from '../../../services/profileService';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { formatDateTimeGmt7 } from '../../../utils/dateTime';
import './UserAccounts.css';

const moneyFormatter = new Intl.NumberFormat('vi-VN');

const statusPalette = {
  Active: 'success',
  Inactive: 'danger',
  Pending: 'warning',
};

const statusTone = (status) => statusPalette[status] || 'neutral';

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
  if (error?.message) return error.message;
  try { return JSON.stringify(data); } catch (e) { return String(data); }
};

export default function UserAccounts() {
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();
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
  const [roleItems, setRoleItems] = useState([]); // { roleId, name, isAssigned, loading }

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
      showToast('Failed to load user accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions = useMemo(() => {
    const uniqueRoles = new Set(users.map((user) => user.primaryRole).filter(Boolean));
    return ['All', ...Array.from(uniqueRoles).sort()];
  }, [users]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set(users.map((user) => user.status).filter(Boolean));
    return ['All', ...Array.from(uniqueStatuses).sort()];
  }, [users]);

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
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const selectedUser = filteredUsers.find((user) => user.accountId === selectedUserId) || filteredUsers[0] || null;

  const summary = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.status === 'Active').length;
    const sellers = users.filter((user) => user.primaryRole === 'Seller').length;
    const buyers = users.filter((user) => user.primaryRole === 'Buyer').length;
    const admins = users.filter((user) => user.primaryRole === 'Admin').length;

    return { total, active, sellers, buyers, admins };
  }, [users]);

  const exportCsv = () => {
    if (!users.length) {
      showToast('No user data to export.', 'info');
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
      showToast('No account selected for role management.', 'warning');
      return;
    }

    setSelectedUserId(user.accountId);
    setShowRoleModal(true);
    setRoleModalLoading(true);
    setRoleItems([]);

    try {
      const res = await accountRoleService.getManageRoles(user.accountId);

      // try to fetch profile roles as fallback/source of truth
      let profileRoles = [];
      try {
        const prof = await profileService.getUserProfile(user.userId);
        profileRoles = prof?.roles || prof?.assignedRoles || [];
      } catch (e) {
        // ignore profile fetch errors
        profileRoles = [];
      }

      // Normalize common response shapes
      let items = [];

      if (Array.isArray(res)) {
        // array of { roleId, name, isAssigned }
        items = res.map((r) => ({ roleId: r.roleId ?? r.id, name: r.name ?? r.roleName ?? r.displayName, isAssigned: !!r.isAssigned, loading: false }));
      } else {
        const roles = res.roles || res.allRoles || res.availableRoles || [];
        const assignedFromRes = new Set((res.assignedRoleIds || res.assignedRoles || res.assigned || []).map((a) => (typeof a === 'object' ? a.roleId ?? a.id : a)));

        items = (roles || []).map((r) => ({ roleId: r.roleId ?? r.id, name: r.name ?? r.roleName ?? r.displayName, isAssigned: assignedFromRes.has(r.roleId ?? r.id), loading: false }));
      }

      // If profileRoles exist, use them to mark assignments too (match by id or by name)
      if (profileRoles && profileRoles.length > 0 && items.length > 0) {
        const profileIds = new Set(profileRoles.map((p) => (typeof p === 'object' ? p.roleId ?? p.id ?? p.name : p)));
        const profileNames = new Set(profileRoles.map((p) => (typeof p === 'object' ? (p.name || p.roleName || '').toString().toLowerCase() : String(p).toLowerCase())));

        items = items.map((it) => {
          const idMatch = profileIds.has(it.roleId) || profileIds.has(String(it.roleId));
          const nameMatch = profileNames.has((it.name || '').toString().toLowerCase());
          return { ...it, isAssigned: !!it.isAssigned || idMatch || nameMatch };
        });
      }

      // Final fallback: if none marked assigned but selectedUser.primaryRole matches any role name, mark it
      if (items.length > 0 && !items.some((i) => i.isAssigned) && selectedUser?.primaryRole) {
        const primary = (selectedUser.primaryRole || '').toString().toLowerCase();
        items = items.map((it) => ({ ...it, isAssigned: it.isAssigned || (it.name || '').toString().toLowerCase() === primary }));
      }

      setRoleItems(items);
    } catch (error) {
      showToast(extractErrorMessage(error) || 'Failed to load roles.', 'error');
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
    // prevent double actions
    if (role.loading) return;

    if (currentUser?.accountId === selectedUserId && role.isAssigned) {
      showToast('You cannot remove roles from your own account.', 'error');
      return;
    }

    setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, loading: true } : r)));

    try {
      if (role.isAssigned) {
        await accountRoleService.removeRole(selectedUserId, role.roleId);
        showToast('Role removed.', 'success');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: false, loading: false } : r)));
      } else {
        await accountRoleService.assignRole(selectedUserId, role.roleId);
        showToast('Role assigned.', 'success');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: true, loading: false } : r)));
      }
      // refresh users list to reflect role changes in table if necessary
      await fetchUsers();
    } catch (error) {
      const msg = extractErrorMessage(error).toLowerCase();
      // If backend says role already assigned, update UI to assigned
      if (msg.includes('already assigned')) {
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: true, loading: false } : r)));
        showToast('Role is already assigned to this account.', 'warning');
      } else if (msg.includes('not found') || msg.includes('assignment not found')) {
        // If backend says assignment not found when removing, mark as not assigned
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, isAssigned: false, loading: false } : r)));
        showToast('Role assignment not found (already removed).', 'warning');
      } else {
        showToast(extractErrorMessage(error) || 'Failed to update role.', 'error');
        setRoleItems((prev) => prev.map((r) => (r.roleId === role.roleId ? { ...r, loading: false } : r)));
      }
    }
  };

  const openUserDetail = async (user) => {
    if (!user?.userId) {
      showToast('No user profile found for this account.', 'warning');
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
      setDetailError(extractErrorMessage(error) || 'Failed to load user detail.');
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
    setPendingActionUser(user);
  };

  const closeStatusActionModal = () => {
    if (actionLoading) return;
    setPendingActionUser(null);
  };

  const confirmStatusAction = async () => {
    if (!pendingActionUser?.accountId) return;

    const isInactive = isInactiveStatus(pendingActionUser?.status);
    const actionLabel = isInactive ? 'activate' : 'ban';
    const pastTense = isInactive ? 'activated' : 'banned';

    try {
      setActionLoading(true);
      // Backend exposes a ban endpoint that toggles status between Active <-> Inactive.
      await accountService.banUser(pendingActionUser.accountId);
      showToast(`User ${pastTense} successfully.`, 'success');
      setPendingActionUser(null);
      await fetchUsers();
    } catch (error) {
      showToast(extractErrorMessage(error) || `Failed to ${actionLabel} user.`, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingIsInactive = (() => {
    const statusFromPending = pendingActionUser?.status;
    if (statusFromPending) return isInactiveStatus(statusFromPending);
    // fallback: find the user in current users list by accountId
    const found = users.find((u) => u.accountId === pendingActionUser?.accountId);
    return isInactiveStatus(found?.status);
  })();

  return (
    <div className="admin-user-list-page animate-fade-in">
      <section className="admin-user-hero">
        <div>
          <p className="admin-eyebrow">Platform Controller</p>
          <h1>User Account Management</h1>
          <p className="admin-hero-copy">
            Global oversight of buyers, sellers, and internal administrators in one place.
          </p>
        </div>

        <button className="admin-export-btn" onClick={exportCsv}>
          <span className="material-symbols-outlined">download</span>
          Export Dataset
        </button>
      </section>

      <section className="admin-stat-grid">
        <article className="admin-stat-card">
          <span className="admin-stat-label">Total Users</span>
          <strong className="admin-stat-value">{moneyFormatter.format(summary.total)}</strong>
          <span className="admin-stat-chip positive">+2.1%</span>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Active Sellers</span>
          <strong className="admin-stat-value">{moneyFormatter.format(summary.sellers)}</strong>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Active Buyers</span>
          <strong className="admin-stat-value">{moneyFormatter.format(summary.buyers)}</strong>
        </article>
        <article className="admin-stat-card">
          <span className="admin-stat-label">Administrators</span>
          <strong className="admin-stat-value">{moneyFormatter.format(summary.admins)}</strong>
        </article>
      </section>

      <section className="admin-user-panel">
        <div className="admin-user-list-shell">
          <header className="admin-panel-header">
            <div>
              <h2>Platform Participants</h2>
              <p>Search, filter, and review account activity across the system.</p>
            </div>

            <div className="admin-panel-actions">
              <div className="admin-pill-group">
                {roleOptions.map((option) => (
                  <button
                    key={option}
                    className={`admin-pill ${roleFilter === option ? 'active' : ''}`}
                    onClick={() => setRoleFilter(option)}
                    type="button"
                  >
                    {option === 'All' ? `All (${moneyFormatter.format(users.length)})` : option}
                  </button>
                ))}
              </div>

              <div className="admin-search-row">
                <label className="admin-search-box">
                  <span className="material-symbols-outlined">search</span>
                  <input
                    type="text"
                    placeholder="Search by name, email, or account ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>

                <label className="admin-select-box">
                  <span className="material-symbols-outlined">filter_alt</span>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        Status: {option}
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
                <p>Loading user accounts...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty-state">
                <span className="material-symbols-outlined">manage_accounts</span>
                <h3>No accounts found</h3>
                <p>Try a different keyword or filter combination.</p>
              </div>
            ) : (
              <table className="admin-user-table">
                <thead>
                  <tr>
                    <th>User Information</th>
                    <th>Role</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => {
                    const isSelected = selectedUser?.accountId === user.accountId;
                    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Unknown User';
                    const statusClass = statusTone(user.status);

                    return (
                      <tr
                        key={user.accountId}
                        className={isSelected ? 'selected' : ''}
                        onClick={() => setSelectedUserId(user.accountId)}
                      >
                        <td>
                          <div className="admin-user-identity">
                            <div className="admin-user-avatar">
                              {user.avatarUrl ? <img src={user.avatarUrl} alt={displayName} /> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}
                            </div>
                            <div>
                              <strong>{displayName}</strong>
                              <p>{user.email || 'No email available'}</p>
                              <span className="admin-subtle-id">{user.accountId}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`admin-role-badge role-${(user.primaryRole || 'unknown').toLowerCase()}`}>
                            {user.primaryRole || 'Unassigned'}
                          </span>
                        </td>
                        <td>{user.provider || 'Local'}</td>
                        <td>
                          <span className={`admin-status-badge ${statusClass}`}>
                            {user.status || 'Unknown'}
                          </span>
                        </td>
                        <td>{user.lastLoginAt ? formatDateTimeGmt7(user.lastLoginAt) : 'Never'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <footer className="admin-table-footer">
            <span>
              Displaying {filteredUsers.length} of {moneyFormatter.format(users.length)} active accounts
            </span>
            <div className="admin-pagination">
              <button type="button" disabled>Previous</button>
              <button type="button" className="active">Next</button>
            </div>
          </footer>
        </div>
        <aside className="admin-user-detail-card">
          {selectedUser ? (
            <div className="admin-detail-inner">
              <div className="admin-detail-top">
                <div className="admin-detail-avatar">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.username} />
                  ) : (
                    (selectedUser.username || 'U').slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="admin-detail-title">
                  <h3>{selectedUser.username || 'No Username'}</h3>
                  <span className={`admin-status-badge ${statusTone(selectedUser.status)}`}>
                    {selectedUser.status || 'Unknown'}
                  </span>
                </div>
              </div>

              <div className="admin-detail-grid">
                <div>
                  <span>Account ID</span>
                  <strong>{selectedUser.accountId}</strong>
                </div>
                <div>
                  <span>User ID</span>
                  <strong>{selectedUser.userId || '-'}</strong>
                </div>
                <div>
                  <span>Username</span>
                  <strong>{selectedUser.username || '-'}</strong>
                </div>
                <div>
                  <span>Primary Role</span>
                  <strong>{selectedUser.roles?.[0] || 'User'}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{selectedUser.provider || 'Local'}</strong>
                </div>
                <div>
                  <span>Last Login</span>
                  <strong>{(selectedUser.lastLoginAt || selectedUser.lastLogin) ? formatDateTimeGmt7(selectedUser.lastLoginAt || selectedUser.lastLogin) : 'Never'}</strong>
                </div>
              </div>

              <div className="admin-panel-actions">
                <button type="button" className="admin-action-btn outline" onClick={() => openUserDetail(selectedUser)}>
                  <span className="material-symbols-outlined">visibility</span>
                  <span>Detail</span>
                </button>
                <button type="button" className="admin-action-btn outline" onClick={() => openRoleModal(selectedUser)}>
                  <span className="material-symbols-outlined">manage_accounts</span>
                  <span>Roles</span>
                </button>
                <button 
                  type="button" 
                  className={`admin-action-btn ${isInactiveStatus(selectedUser.status) ? 'outline' : 'danger'}`}
                  onClick={() => openStatusActionModal(selectedUser)}
                  disabled={currentUser?.accountId === selectedUser.accountId}
                >
                  <span className="material-symbols-outlined">{isInactiveStatus(selectedUser.status) ? 'check_circle' : 'block'}</span>
                  <span>{isInactiveStatus(selectedUser.status) ? 'Unban' : 'Ban'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="admin-empty-selection">
              <span className="material-symbols-outlined">person_search</span>
              <p>Select a user from the list to view quick details</p>
            </div>
          )}
        </aside>
      </section>

      {pendingActionUser && (
        <div className="admin-confirm-modal-overlay" onClick={closeStatusActionModal}>
          <div className="admin-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-confirm-modal-header">
              <div>
                <p className="admin-confirm-kicker">{pendingIsInactive ? 'Unban User' : 'Ban User'}</p>
                <h3>{pendingIsInactive ? 'Unban this account?' : 'Ban this account?'}</h3>
              </div>
              <button type="button" className="admin-confirm-close" onClick={closeStatusActionModal} disabled={actionLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-confirm-modal-body">
              <p>
                {pendingIsInactive
                  ? 'This account is currently Banned. Unbanning will allow the user to sign in and transact.'
                  : 'This account will be set to Banned, preventing sign in or transactions. The system will send an email notification to the registered address.'}
                </p>

              <div className="admin-confirm-target-card">
                <span>Account</span>
                <strong>{pendingActionUser.username || pendingActionUser.accountId}</strong>
                <small>{pendingActionUser.email || 'No email available'}</small>
              </div>

              {!pendingIsInactive && (
                <div className="admin-confirm-note">
                  The user will receive an email notification about the ban.
                </div>
              )}
            </div>

            <div className="admin-confirm-modal-footer">
              <button type="button" className="admin-action-btn outline" onClick={closeStatusActionModal} disabled={actionLoading}>
                Cancel
              </button>
              <button
                type="button"
                className={`admin-action-btn ${pendingIsInactive ? 'ghost' : 'danger'}`}
                onClick={confirmStatusAction}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : pendingIsInactive ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="admin-role-modal-overlay" onClick={closeRoleModal}>
          <div className="admin-role-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-role-modal-header">
              <div>
                <p className="admin-detail-kicker">Manage Roles</p>
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
                  <p>Loading roles...</p>
                </div>
              ) : (
                <div className="admin-role-list">
                  {roleItems.length === 0 ? (
                    <p className="admin-detail-muted">No roles available for this account.</p>
                  ) : (
                    roleItems.map((role) => {
                      const isSelf = currentUser?.accountId === selectedUserId;
                      const isRemovingSelfRole = isSelf && role.isAssigned;
                      return (
                        <div key={role.roleId} className="role-item">
                          <div>
                            <strong>{role.name || `Role ${role.roleId}`}</strong>
                          </div>
                          <div>
                            <button
                              type="button"
                              className={`admin-action-btn ${role.isAssigned ? 'danger' : 'ghost'}`}
                              onClick={() => toggleRoleAssignment(role)}
                              disabled={role.loading || isRemovingSelfRole}
                              title={isRemovingSelfRole ? 'Cannot remove roles from your own account' : ''}
                            >
                              {role.loading ? 'Processing...' : role.isAssigned ? 'Remove' : 'Assign'}
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && (
        <div className="admin-detail-modal-overlay" onClick={closeDetailModal}>
          <div className="admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-detail-modal-header">
              <div>
                <p className="admin-detail-kicker">User Detail</p>
                <h3>{selectedUserDetail ? selectedUserDetail.username || selectedUserDetail.accountId : 'Loading user detail...'}</h3>
              </div>
              <button type="button" className="admin-detail-close" onClick={closeDetailModal} disabled={detailLoading}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="admin-detail-modal-body">
              {detailLoading ? (
                <div className="admin-detail-loading">
                  <span className="btn-spinner"></span>
                  <p>Loading user detail...</p>
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
                      {selectedUserDetail.avatarUrl ? <img src={selectedUserDetail.avatarUrl} alt={selectedUserDetail.username || 'User'} /> : <span>{(selectedUserDetail.username || 'U').slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div>
                      <h4>{`${selectedUserDetail.firstName || ''} ${selectedUserDetail.lastName || ''}`.trim() || selectedUserDetail.username}</h4>
                      <p>{selectedUserDetail.email || 'No email available'}</p>
                      <div className="admin-detail-badges">
                        <span className={`admin-status-badge ${statusTone(selectedUserDetail.status)}`}>{selectedUserDetail.status || 'Unknown'}</span>
                        {selectedUserDetail.roles?.map((role) => (
                          <span key={role} className={`admin-role-badge role-${role?.toLowerCase() || 'unknown'}`}>{role}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="admin-detail-info-grid">
                    <div><span>Account ID</span><strong>{selectedUserDetail.accountId}</strong></div>
                    <div><span>User ID</span><strong>{selectedUserDetail.userId}</strong></div>
                    <div><span>Username</span><strong>{selectedUserDetail.username || '-'}</strong></div>
                    <div><span>Phone</span><strong>{selectedUserDetail.phone || '-'}</strong></div>
                    <div><span>Created At</span><strong>{formatDateTimeGmt7(selectedUserDetail.createdAt)}</strong></div>
                    <div><span>Updated At</span><strong>{formatDateTimeGmt7(selectedUserDetail.updatedAt)}</strong></div>
                    <div><span>Deleted</span><strong>{selectedUserDetail.isDeleted ? 'Yes' : 'No'}</strong></div>
                    <div><span>Default Address</span><strong>{selectedUserDetail.defaultAddress?.street || 'No default address'}</strong></div>
                  </div>

                  <div className="admin-detail-address-card">
                    <h4>Default Address</h4>
                    {selectedUserDetail.defaultAddress ? (
                      <div className="admin-detail-address-content">
                        <p>{selectedUserDetail.defaultAddress.receiverName || '-'}</p>
                        <p>{selectedUserDetail.defaultAddress.receiverPhone || '-'}</p>
                        <p>{selectedUserDetail.defaultAddress.street || '-'}</p>
                        <p>
                          Province: {selectedUserDetail.defaultAddress.provinceId ?? '-'} · District: {selectedUserDetail.defaultAddress.districtId ?? '-'} · Ward: {selectedUserDetail.defaultAddress.wardCode || '-'}
                        </p>
                      </div>
                    ) : (
                      <p className="admin-detail-muted">This user has no default address.</p>
                    )}
                  </div>

                  {selectedUserDetail.addresses?.length > 0 && (
                    <div className="admin-detail-address-card">
                      <h4>All Addresses</h4>
                      <div className="admin-address-list">
                        {selectedUserDetail.addresses.map((address) => (
                          <div key={address.addressId} className="admin-address-item">
                            <strong>{address.receiverName || address.addressId}</strong>
                            <p>{address.receiverPhone || '-'}</p>
                            <p>{address.street || '-'}</p>
                            <span>{address.isDefault ? 'Default' : 'Secondary'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}


                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

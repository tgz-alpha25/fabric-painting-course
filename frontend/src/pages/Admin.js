import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  FaUsers, FaBell, FaCloud, FaSearch, FaTrash, FaUnlock, FaLock,
  FaCheck, FaTimes, FaChevronDown, FaChevronUp, FaSync,
  FaDesktop, FaPlay, FaClock, FaExclamationTriangle, FaVideo
} from 'react-icons/fa';
import './Admin.css';

const AdminPage = () => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [cloudinaryAccounts, setCloudinaryAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [accessModal, setAccessModal] = useState(null);
  const [accessMonths, setAccessMonths] = useState(6);
  const [authenticated, setAuthenticated] = useState(false);

  // Simple admin login check
  const handleAdminLogin = (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) { toast.error('Please login first'); return; }
    
    let user = {};
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser && storedUser !== 'undefined') {
        user = JSON.parse(storedUser);
      }
    } catch (e) {
      console.error('Admin page user parse error:', e);
    }

    if (user.role === 'admin') {
      setAuthenticated(true);
    } else {
      toast.error('Admin access required');
    }
  };

  const fetchUsers = useCallback(async () => {
    if (users.length === 0) setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [users.length]);

  const fetchNotifications = useCallback(async () => {
    if (notifications.length === 0) setLoading(true);
    try {
      const res = await api.get('/admin/notifications');
      setNotifications(res.data.notifications);
    } catch (err) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [notifications.length]);

  const fetchCloudinary = useCallback(async () => {
    if (cloudinaryAccounts.length === 0) setLoading(true);
    try {
      const res = await api.get('/admin/cloudinary/status');
      setCloudinaryAccounts(res.data.accounts || []);
    } catch (err) {
      toast.error('Failed to load Cloudinary status');
    } finally {
      setLoading(false);
    }
  }, [cloudinaryAccounts.length]);

  useEffect(() => {
    if (!authenticated) return;
    
    if (tab === 'users') fetchUsers();
    else if (tab === 'notifications') fetchNotifications();
    else if (tab === 'cloudinary') fetchCloudinary();

    // Silent background polling every 15 seconds
    const interval = setInterval(() => {
      if (tab === 'users') fetchUsers();
      else if (tab === 'notifications') fetchNotifications();
      else if (tab === 'cloudinary') fetchCloudinary();
    }, 15000);

    return () => clearInterval(interval);
  }, [tab, authenticated, fetchUsers, fetchNotifications, fetchCloudinary]);

  const fetchUserDetail = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); setUserDetail(null); return; }
    setExpandedUser(userId);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/users/${userId}`);
      setUserDetail(res.data);
    } catch (err) {
      toast.error('Failed to load user details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const grantAccess = async (userId) => {
    try {
      const res = await api.post(`/admin/users/${userId}/grant-access`, { durationMonths: accessMonths });
      const { expiresAt } = res.data;
      toast.success(`Access granted for ${accessMonths} months`);
      setAccessModal(null);
      
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return {
            ...u,
            access: {
              hasAccess: true,
              grantedAt: { toDate: () => new Date() },
              expiresAt: typeof expiresAt === 'string' ? { toDate: () => new Date(expiresAt) } : expiresAt,
              isExpired: false
            }
          };
        }
        return u;
      }));
    } catch (err) {
      toast.error('Failed to grant access');
    }
  };

  const revokeAccess = async (userId) => {
    if (!window.confirm('Revoke this user\'s course access?')) return;
    try {
      await api.post(`/admin/users/${userId}/revoke-access`);
      toast.success('Access revoked');
      
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return {
            ...u,
            access: u.access ? { ...u.access, hasAccess: false, isExpired: false } : null
          };
        }
        return u;
      }));
    } catch (err) {
      toast.error('Failed to revoke access');
    }
  };

  const extendAccess = async (userId, months) => {
    try {
      const res = await api.post(`/admin/users/${userId}/extend-access`, { additionalMonths: months });
      const { newExpiresAt } = res.data;
      toast.success(`Access extended by ${months} months`);
      
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return {
            ...u,
            access: u.access ? {
              ...u.access,
              hasAccess: true,
              expiresAt: typeof newExpiresAt === 'string' ? { toDate: () => new Date(newExpiresAt) } : newExpiresAt,
              isExpired: false
            } : {
              hasAccess: true,
              grantedAt: { toDate: () => new Date() },
              expiresAt: typeof newExpiresAt === 'string' ? { toDate: () => new Date(newExpiresAt) } : newExpiresAt,
              isExpired: false
            }
          };
        }
        return u;
      }));
    } catch (err) {
      toast.error('Failed to extend access');
    }
  };

  const removeDevice = async (userId, deviceId) => {
    if (!window.confirm('Remove this device?')) return;
    try {
      await api.delete(`/admin/users/${userId}/devices/${deviceId}`);
      toast.success('Device removed');
      
      setUserDetail(prev => {
        if (prev && prev.uid === userId) {
          return {
            ...prev,
            devices: (prev.devices || []).filter(d => d.id !== deviceId)
          };
        }
        return prev;
      });

      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return {
            ...u,
            deviceCount: Math.max(0, (u.deviceCount || 1) - 1)
          };
        }
        return u;
      }));
    } catch (err) {
      toast.error('Failed to remove device');
    }
  };

  const updateDeviceLimit = async (userId, limit) => {
    try {
      await api.patch(`/admin/users/${userId}/device-limit`, { deviceLimit: limit });
      toast.success('Device limit updated');
      
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return { ...u, deviceLimit: limit };
        }
        return u;
      }));
      setUserDetail(prev => {
        if (prev && prev.uid === userId) {
          return { ...prev, deviceLimit: limit };
        }
        return prev;
      });
    } catch (err) {
      toast.error('Failed to update limit');
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    try {
      await api.patch(`/admin/users/${userId}/status`, { isActive });
      toast.success(`User ${isActive ? 'activated' : 'suspended'}`);
      
      setUsers(prev => prev.map(u => {
        if (u.uid === userId) {
          return { ...u, isActive };
        }
        return u;
      }));
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const markNotifRead = async (id) => {
    try {
      await api.patch(`/admin/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {}
  };

  const deleteNotif = async (id) => {
    if (!window.confirm('Delete this notification?')) return;
    try {
      await api.delete(`/admin/notifications/${id}`);
      toast.success('Notification deleted');
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      toast.error('Failed to delete notification');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.mobile?.includes(search)
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (!authenticated) {
    return (
      <div className="admin-login">
        <div className="admin-login-box">
          <h2>Admin Access</h2>
          <p>This page is restricted to administrators.</p>
          <form onSubmit={handleAdminLogin}>
            <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }}>
              Verify Admin Access
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      {/* SIDEBAR */}
      <div className="admin-sidebar">
        <div className="admin-brand">
          <h2>Admin Panel</h2>
          <p>Fabric Painting Course</p>
        </div>
        <nav className="admin-nav">
          <button className={`admin-nav-item ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            <FaUsers /> Users
          </button>
          <button className={`admin-nav-item ${tab === 'notifications' ? 'active' : ''}`} onClick={() => setTab('notifications')}>
            <FaBell />
            Notifications
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button className={`admin-nav-item ${tab === 'cloudinary' ? 'active' : ''}`} onClick={() => setTab('cloudinary')}>
            <FaCloud /> Cloudinary
          </button>
        </nav>
      </div>

      {/* MAIN */}
      <div className="admin-main">
        {/* USERS TAB */}
        {tab === 'users' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>User Management</h2>
              <div className="search-wrapper">
                <FaSearch className="search-icon" />
                <input className="search-input" placeholder="Search by name, email, mobile..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <button className="btn btn-ghost btn-sm" onClick={fetchUsers}><FaSync /> Refresh</button>
            </div>

            {loading && users.length === 0 ? (
              <div className="admin-loading"><div className="spinner" /></div>
            ) : (
              <div className="users-list">
                {filteredUsers.map((user) => (
                  <div key={user.uid} className={`user-card ${expandedUser === user.uid ? 'expanded' : ''}`}>
                    {/* USER SUMMARY ROW */}
                    <div className="user-row" onClick={() => fetchUserDetail(user.uid)}>
                      <div className="user-avatar">{user.name?.[0]?.toUpperCase()}</div>
                      <div className="user-basic">
                        <span className="user-name">{user.name}</span>
                        <span className="user-email">{user.email}</span>
                        <span className="user-mobile">{user.mobile}</span>
                      </div>
                      <div className="user-meta">
                        <span className="user-meta-item">
                          <FaDesktop /> {user.deviceCount}/{user.deviceLimit} devices
                        </span>
                        <span className="user-meta-item">
                          <FaPlay /> {user.stats?.totalVideosWatched || 0} videos watched
                        </span>
                        <span className="user-meta-item">
                          <FaClock /> Joined {user.createdAt ? format(user.createdAt.toDate?.() || new Date(user.createdAt._seconds * 1000), 'MMM d, yyyy') : '-'}
                        </span>
                      </div>
                      <div className="user-status-col">
                        {user.isActive
                          ? <span className="badge badge-success">Active</span>
                          : <span className="badge badge-error">Suspended</span>}
                        {user.access?.hasAccess
                          ? <span className="badge badge-primary">Has Access</span>
                          : <span className="badge badge-warning">No Access</span>}
                        {user.access?.expiresAt && (
                          <span className="access-expiry">
                            Expires: {format(user.access.expiresAt.toDate?.() || new Date(user.access.expiresAt._seconds * 1000), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      <div className="user-actions" onClick={(e) => e.stopPropagation()}>
                        {!user.access?.hasAccess
                          ? <button className="btn btn-primary btn-sm" onClick={() => setAccessModal(user.uid)}>
                              <FaUnlock /> Grant Access
                            </button>
                          : <>
                              <button className="btn btn-outline btn-sm" onClick={() => extendAccess(user.uid, 6)}>
                                +6 Months
                              </button>
                              <button className="btn btn-ghost btn-sm danger" onClick={() => revokeAccess(user.uid)}>
                                <FaLock /> Revoke
                              </button>
                            </>}
                        <button
                          className={`btn btn-sm ${user.isActive ? 'btn-ghost danger' : 'btn-outline'}`}
                          onClick={() => toggleUserStatus(user.uid, !user.isActive)}>
                          {user.isActive ? <><FaTimes /> Suspend</> : <><FaCheck /> Activate</>}
                        </button>
                      </div>
                      <button className="expand-btn">
                        {expandedUser === user.uid ? <FaChevronUp /> : <FaChevronDown />}
                      </button>
                    </div>

                    {/* EXPANDED DETAIL */}
                    {expandedUser === user.uid && (
                      <div className="user-detail">
                        {loadingDetail ? <div className="spinner" /> : userDetail && (
                          <div className="detail-grid">
                            {/* Personal Info */}
                            <div className="detail-section">
                              <h4>Personal Information</h4>
                              <div className="detail-row"><span>Age</span><b>{userDetail.age}</b></div>
                              <div className="detail-row"><span>Gender</span><b>{userDetail.gender}</b></div>
                              <div className="detail-row"><span>Native</span><b>{userDetail.native}</b></div>
                            </div>

                            {/* Devices */}
                            <div className="detail-section">
                              <h4>
                                Devices ({userDetail.devices?.length || 0}/{userDetail.deviceLimit || 3})
                                <select className="device-limit-select"
                                  defaultValue={userDetail.deviceLimit || 3}
                                  onChange={(e) => updateDeviceLimit(user.uid, parseInt(e.target.value))}>
                                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} devices</option>)}
                                </select>
                              </h4>
                              {userDetail.devices?.map((d) => (
                                <div key={d.id} className="device-row">
                                  <FaDesktop />
                                  <div>
                                    <span>{d.browser} on {d.os}</span>
                                    <small>IP: {d.ip} | Last: {d.lastLogin ? format(d.lastLogin.toDate?.() || new Date(d.lastLogin._seconds * 1000), 'MMM d, HH:mm') : '-'}</small>
                                  </div>
                                  <button className="btn btn-ghost btn-sm danger"
                                    onClick={() => removeDevice(user.uid, d.id)}>
                                    <FaTrash />
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* Watch History */}
                            <div className="detail-section full-width">
                              <h4>Watch History</h4>
                              {userDetail.watchHistory?.length === 0 && <p className="empty-text">No videos watched yet</p>}
                              <div className="watch-grid">
                                {userDetail.watchHistory?.map((v) => (
                                  <div key={v.videoId} className="watch-item">
                                    <FaVideo />
                                    <div>
                                      <span>{v.title}</span>
                                      <small>Watched {v.watchCount}x | Progress: {v.progress}%</small>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {filteredUsers.length === 0 && !loading && (
                  <div className="empty-state"><p>No users found</p></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* NOTIFICATIONS TAB */}
        {tab === 'notifications' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Notifications</h2>
              <button className="btn btn-ghost btn-sm" onClick={fetchNotifications}><FaSync /> Refresh</button>
            </div>
            {loading && notifications.length === 0 ? <div className="admin-loading"><div className="spinner" /></div> : (
              <div className="notif-list">
                {notifications.map((n) => (
                  <div key={n.id} className={`notif-card ${!n.isRead ? 'unread' : ''} notif-${n.type}`}>
                    <div className="notif-icon">
                      {n.type === 'access_expired' && <FaClock />}
                      {n.type === 'new_registration' && <FaUsers />}
                      {n.type === 'cloudinary_limit' && <FaCloud />}
                      {n.type === 'multi_device' && <FaDesktop />}
                      {!['access_expired','new_registration','cloudinary_limit','multi_device'].includes(n.type) && <FaBell />}
                    </div>
                    <div className="notif-body">
                      <h4>{n.title}</h4>
                      <p>{n.message}</p>
                      <span className="notif-time">
                        {n.createdAt ? format(n.createdAt.toDate?.() || new Date(n.createdAt._seconds * 1000), 'MMM d, yyyy HH:mm') : ''}
                      </span>
                    </div>
                    <div className="notif-actions" style={{ display: 'flex', gap: '8px' }}>
                      {!n.isRead && (
                        <button className="btn btn-ghost btn-sm" onClick={() => markNotifRead(n.id)}>
                          <FaCheck /> Mark Read
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm danger" onClick={() => deleteNotif(n.id)}>
                        <FaTrash /> Delete
                      </button>
                    </div>
                  </div>
                ))}
                {notifications.length === 0 && !loading && (
                  <div className="empty-state"><p>No notifications yet</p></div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CLOUDINARY TAB */}
        {tab === 'cloudinary' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2>Cloudinary Accounts</h2>
              <button className="btn btn-ghost btn-sm" onClick={fetchCloudinary}><FaSync /> Refresh Status</button>
            </div>
            {loading && cloudinaryAccounts.length === 0 ? <div className="admin-loading"><div className="spinner" /></div> : (
              <div className="cloudinary-list">
                {cloudinaryAccounts.map((acc, i) => (
                  <div key={acc.id || i} className={`cloudinary-card ${acc.isCurrentActive ? 'current' : ''}`}>
                    <div className="cloud-header">
                      <h4>{acc.name}</h4>
                      {acc.isCurrentActive && <span className="badge badge-success">Currently Streaming</span>}
                    </div>
                    <div className="usage-bar-wrapper">
                      <div className="usage-label">
                        <span>Bandwidth Usage</span>
                        <span>{acc.usagePercent || 0}%</span>
                      </div>
                      <div className="usage-bar">
                        <div className="usage-fill" style={{
                          width: `${acc.usagePercent || 0}%`,
                          background: acc.usagePercent >= 90 ? '#DC2626' : acc.usagePercent >= 70 ? '#D97706' : '#059669'
                        }} />
                      </div>
                    </div>
                    {acc.usagePercent >= 90 && (
                      <div className="cloud-warning">
                        <FaExclamationTriangle /> This account is near its limit. Auto-switch will trigger.
                      </div>
                    )}
                  </div>
                ))}
                {cloudinaryAccounts.length === 0 && (
                  <div className="empty-state">
                    <p>No Cloudinary accounts configured. Add accounts via .env or database.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GRANT ACCESS MODAL */}
      {accessModal && (
        <div className="modal-overlay" onClick={() => setAccessModal(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Grant Course Access</h3>
            <p>Set access duration for the user:</p>
            <div className="input-group" style={{ margin: '20px 0' }}>
              <label className="input-label">Duration (months)</label>
              <select className="input-field" value={accessMonths}
                onChange={(e) => setAccessMonths(parseInt(e.target.value))}>
                {[1, 3, 6, 12, 24].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => grantAccess(accessModal)} style={{ flex: 1, justifyContent: 'center' }}>
                <FaUnlock /> Grant Access
              </button>
              <button className="btn btn-ghost" onClick={() => setAccessModal(null)} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;

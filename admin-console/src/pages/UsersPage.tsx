import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldBan, 
  MoreVertical, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Key, 
  Smartphone, 
  Trash2, 
  Eye, 
  Clock, 
  UserCheck, 
  UserX,
  X
} from 'lucide-react';
import { fetchUsersList, banUserAction, unbanUserAction, verifyUserAction, sendUserPasswordReset } from '../services/adminService';
import { Language, i18n } from '../i18n';
import { VerifiedBadge } from '../../../src/components/VerifiedBadge';

export const UsersPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [actionModal, setActionModal] = useState<{
    type: 'ban' | 'suspend' | 'unban' | 'verify' | 'resetPw' | 'delete';
    user: any;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [suspendDays, setSuspendDays] = useState(7);
  const [submitting, setSubmitting] = useState(false);
  const t = i18n[lang];

  const loadUsers = async () => {
    setLoading(true);
    const res = await fetchUsersList({ searchQuery: search, statusFilter });
    setUsers(res.users);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  const handleExecuteAction = async () => {
    if (!actionModal || !reason.trim()) return;
    setSubmitting(true);
    const { type, user } = actionModal;

    try {
      if (type === 'ban') {
        await banUserAction(user.uid, true, 0, reason);
      } else if (type === 'suspend') {
        await banUserAction(user.uid, false, suspendDays, reason);
      } else if (type === 'unban') {
        await unbanUserAction(user.uid, reason);
      } else if (type === 'verify') {
        await verifyUserAction(user.uid, !user.isVerified && !user.verified, reason);
      } else if (type === 'resetPw') {
        await sendUserPasswordReset(user.email, reason);
      }
      setActionModal(null);
      setReason('');
      await loadUsers();
    } catch (e: any) {
      alert(`Action error: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectUser = (uid: string) => {
    const next = new Set(selectedUids);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedUids(next);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, phone, UID..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-sm rounded-xl border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500 text-gray-900 dark:text-white"
          />
        </form>

        <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </select>

          <button
            onClick={loadUsers}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100 dark:border-white/5">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && selectedUids.size === users.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUids(new Set(users.map(u => u.uid)));
                      else setSelectedUids(new Set());
                    }}
                    className="rounded text-purple-600"
                  />
                </th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Followers</th>
                <th className="py-3 px-4">Posts</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Loading users list...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No users matching criteria
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isBanned = u.status === 'banned';
                  const isSuspended = u.status === 'suspended';
                  const isVerified = u.isVerified || u.verified;

                  return (
                    <tr key={u.uid} className="hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedUids.has(u.uid)}
                          onChange={() => toggleSelectUser(u.uid)}
                          className="rounded text-purple-600"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}`}
                            alt={u.name}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-white/10"
                          />
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center space-x-1">
                              <span>{u.name || 'Unnamed'}</span>
                              {isVerified && <VerifiedBadge className="w-3.5 h-3.5" />}
                            </div>
                            <div className="text-[11px] text-gray-400 font-mono">
                              @{u.username || 'user'} • {u.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isBanned
                            ? 'bg-red-100 dark:bg-red-950/60 text-red-600'
                            : isSuspended
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600'
                        }`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-gray-600 dark:text-gray-300">
                          {u.role || (u.isAdmin ? 'admin' : 'user')}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {u.followersCount ?? 0}
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        {u.postsCount ?? 0}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            onClick={() => setSelectedUser(u)}
                            title="Inspect Profile"
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-purple-600 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setActionModal({ type: 'verify', user: u })}
                            title={isVerified ? 'Remove verification' : 'Verify'}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-500 cursor-pointer"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>

                          {isBanned || isSuspended ? (
                            <button
                              onClick={() => setActionModal({ type: 'unban', user: u })}
                              title="Unban User"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-emerald-600 cursor-pointer"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setActionModal({ type: 'suspend', user: u })}
                              title="Suspend or Ban"
                              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-red-500 cursor-pointer"
                            >
                              <ShieldBan className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center space-x-3">
                <img
                  src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}`}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">
                    {selectedUser.name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    @{selectedUser.username} • UID: {selectedUser.uid}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-2xl">
                <div>Email: <span className="font-semibold text-gray-900 dark:text-white">{selectedUser.email || 'N/A'}</span></div>
                <div>Status: <span className="font-semibold text-purple-600">{selectedUser.status || 'active'}</span></div>
                <div>FCM Tokens: <span className="font-semibold">{selectedUser.fcmTokens?.length || 0} registered</span></div>
                <div>Role: <span className="font-semibold">{selectedUser.role || 'user'}</span></div>
              </div>

              {selectedUser.bio && (
                <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-2xl">
                  <span className="text-gray-400 block mb-1">Bio:</span>
                  <p className="text-gray-700 dark:text-gray-300">{selectedUser.bio}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-white/5">
              <button
                onClick={() => {
                  setActionModal({ type: 'resetPw', user: selectedUser });
                  setSelectedUser(null);
                }}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-200 cursor-pointer"
              >
                Send Password Reset
              </button>

              <button
                onClick={() => {
                  setActionModal({ type: 'ban', user: selectedUser });
                  setSelectedUser(null);
                }}
                className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold hover:bg-red-700 cursor-pointer"
              >
                Ban Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Execution Dialog */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirm {actionModal.type.toUpperCase()} for @{actionModal.user.username}
            </h3>

            {actionModal.type === 'suspend' && (
              <div className="mb-4">
                <label className="text-xs text-gray-500 block mb-1">Suspension Period (Days):</label>
                <select
                  value={suspendDays}
                  onChange={(e) => setSuspendDays(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-white/10"
                >
                  <option value={1}>1 Day</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days (Standard)</option>
                  <option value={30}>30 Days</option>
                </select>
              </div>
            )}

            <div className="mb-4">
              <label className="text-xs text-gray-500 block mb-1 font-semibold">
                Mandatory Audit Reason:
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain the administrative justification for this action..."
                className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:ring-2 focus:ring-purple-500 h-24 resize-none"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setActionModal(null);
                  setReason('');
                }}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={!reason.trim() || submitting}
                onClick={handleExecuteAction}
                className="px-4 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {submitting ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

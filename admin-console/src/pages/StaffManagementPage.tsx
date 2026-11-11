import React, { useState } from 'react';
import { Users, UserPlus, Shield, Key, Lock, CheckCircle, Trash2 } from 'lucide-react';
import { Language, i18n } from '../i18n';
import { logAdminAction } from '../services/adminService';

export const StaffManagementPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [staffList, setStaffList] = useState([
    { email: 'erfanalltime@gmail.com', role: 'superadmin', name: 'Erfan Sarker', status: 'active' },
    { email: 'moderator@ennvoapp.com', role: 'moderator', name: 'Ops Moderator', status: 'active' },
    { email: 'support@ennvoapp.com', role: 'support', name: 'Customer Support Lead', status: 'active' },
    { email: 'analyst@ennvoapp.com', role: 'analyst', name: 'Growth Analyst', status: 'active' },
  ]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'moderator' | 'support' | 'analyst'>('moderator');
  const [inviteName, setInviteName] = useState('');
  const t = i18n[lang];

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    await logAdminAction({
      action: 'staff_invited',
      targetType: 'staff_account',
      targetId: inviteEmail,
      afterValue: { role: inviteRole, name: inviteName },
      reason: 'Staff administrator issued employee invitation',
    });

    setStaffList([...staffList, { email: inviteEmail, role: inviteRole, name: inviteName || 'Staff', status: 'active' }]);
    setInviteEmail('');
    setInviteName('');
    alert(`Invitation sent to ${inviteEmail} with role: ${inviteRole}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.staff}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage company staff members, enforce multi-factor TOTP requirements, and define permissions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invite Form */}
        <form onSubmit={handleInvite} className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-gray-900 dark:text-white flex items-center space-x-2">
            <UserPlus className="w-4 h-4 text-purple-600" />
            <span>Invite New Staff Member</span>
          </h3>

          <div>
            <label className="text-xs text-gray-500 block mb-1 font-semibold">Staff Name:</label>
            <input
              type="text"
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Asif Rahman"
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1 font-semibold">Company Email:</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@ennvoapp.com"
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1 font-semibold">Assigned Role:</label>
            <select
              value={inviteRole}
              onChange={(e: any) => setInviteRole(e.target.value)}
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-semibold"
            >
              <option value="admin">Admin (All except billing/roles)</option>
              <option value="moderator">Moderator (Content, Reports, Bans)</option>
              <option value="support">Support Agent (Users, Tickets)</option>
              <option value="analyst">Analyst (Read-only Analytics)</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-colors"
          >
            Send Staff Invite
          </button>
        </form>

        {/* Staff Table */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-100 dark:border-white/5 font-bold text-xs">
            Active Staff Directory
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">2FA / TOTP</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {staffList.map((s, idx) => (
                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-white/5">
                  <td className="py-3 px-4">
                    <div className="font-bold text-gray-900 dark:text-white">{s.name}</div>
                    <div className="text-[11px] text-gray-400 font-mono">{s.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                      {s.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-600 font-semibold flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Enforced</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {s.role !== 'superadmin' && (
                      <button
                        onClick={() => setStaffList(staffList.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

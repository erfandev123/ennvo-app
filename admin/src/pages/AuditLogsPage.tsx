import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  ShieldCheck, 
  Lock, 
  RefreshCw 
} from 'lucide-react';
import { fetchAuditLogs } from '../services/adminService';
import { AdminLogItem } from '../types';
import { Language, i18n } from '../i18n';
import { formatTime } from '../../../src/utils';

export const AuditLogsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const t = i18n[lang];

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await fetchAuditLogs(100);
    setLogs(data);
    setLoading(false);
  };

  const filteredLogs = logs.filter(l => 
    (l.action && l.action.toLowerCase().includes(search.toLowerCase())) ||
    (l.adminEmail && l.adminEmail.toLowerCase().includes(search.toLowerCase())) ||
    (l.targetId && l.targetId.toLowerCase().includes(search.toLowerCase())) ||
    (l.reason && l.reason.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Admin Email', 'Action', 'Target Type', 'Target ID', 'Reason'];
    const rows = filteredLogs.map(l => [
      l.timestamp?.toDate ? l.timestamp.toDate().toISOString() : new Date().toISOString(),
      `"${l.adminEmail || ''}"`,
      `"${l.action || ''}"`,
      `"${l.targetType || ''}"`,
      `"${l.targetId || ''}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ennvo-audit-logs-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {t.auditLogs}
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 rounded-full flex items-center space-x-1">
              <Lock className="w-3 h-3" />
              <span>Immutable (WORM)</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tamper-proof forensic trail of every administrative action, user ban, configuration tweak, and legal review.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={loadLogs}
            className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, admin email, target ID, or reason..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs rounded-xl border border-gray-200 dark:border-white/10"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-400 uppercase font-bold text-[10px]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4">Reason / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading audit trail...</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No logs found</td></tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{formatTime(log.timestamp)}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">{log.adminEmail}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 capitalize">{log.targetType}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-gray-400">{log.targetId?.substring(0, 12)}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 italic max-w-xs truncate">{log.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

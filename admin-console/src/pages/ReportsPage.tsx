import React, { useState, useEffect } from 'react';
import { 
  Flag, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  User, 
  ExternalLink,
  MessageSquare,
  ShieldBan
} from 'lucide-react';
import { fetchReportsList, resolveReportAction } from '../services/adminService';
import { ReportItem } from '../types';
import { Language, i18n } from '../i18n';
import { formatTime } from '../../../src/utils';

export const ReportsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDecision, setActionDecision] = useState<'resolved' | 'dismissed'>('resolved');
  const [actionType, setActionType] = useState('warned');
  const [submitting, setSubmitting] = useState(false);
  const t = i18n[lang];

  const cannedTemplates = [
    'Violates community safety rules regarding harassment and bullying.',
    'Spam link or promotional bot activity.',
    'Inappropriate sexual or adult imagery.',
    'Misleading or fraudulent identity report verified.',
    'Report reviewed and found non-violating (dismissed).'
  ];

  const loadReports = async () => {
    setLoading(true);
    const data = await fetchReportsList(statusFilter);
    setReports(data);
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter]);

  const handleResolve = async () => {
    if (!selectedReport || !actionReason.trim()) return;
    setSubmitting(true);
    try {
      await resolveReportAction(
        selectedReport.id,
        actionDecision,
        actionType,
        actionReason
      );
      setSelectedReport(null);
      setActionReason('');
      await loadReports();
    } catch (e: any) {
      alert(`Report action failed: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">
            {t.reports}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Community flags, abuse complaints, and SLA moderation triage queue.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200"
          >
            <option value="open">Open Reports Only</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
            <option value="all">All Reports</option>
          </select>

          <button
            onClick={loadReports}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
          >
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100 dark:border-white/5">
              <tr>
                <th className="py-3 px-4">Report ID</th>
                <th className="py-3 px-4">Target Type</th>
                <th className="py-3 px-4">Reason Category</th>
                <th className="py-3 px-4">Reporter UID</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5 text-gray-700 dark:text-gray-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Loading reports queue...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    No reports in this queue
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const isOpen = r.status === 'open';

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60 dark:hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-400">
                        {r.id.substring(0, 8)}...
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-600">
                          {r.targetType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                        {r.reason}
                      </td>
                      <td className="py-3 px-4 text-gray-400 font-mono text-[11px]">
                        {r.reporterId?.substring(0, 10)}...
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {formatTime(r.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isOpen ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedReport(r)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10 space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Flag className="w-5 h-5 text-red-500" />
              <span>Review Report ({selectedReport.id})</span>
            </h3>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl text-xs space-y-2 border border-gray-100 dark:border-white/5">
              <div>Target Type: <span className="font-bold text-purple-600">{selectedReport.targetType}</span></div>
              <div>Target ID: <span className="font-mono text-gray-700 dark:text-gray-300">{selectedReport.targetId}</span></div>
              <div>Reason: <span className="font-semibold text-red-600">{selectedReport.reason}</span></div>
              {selectedReport.details && (
                <div>Details: <p className="text-gray-600 dark:text-gray-300 mt-1 italic">"{selectedReport.details}"</p></div>
              )}
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Decision Status:</label>
                  <select
                    value={actionDecision}
                    onChange={(e: any) => setActionDecision(e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-semibold"
                  >
                    <option value="resolved">Take Action (Resolved)</option>
                    <option value="dismissed">Dismiss (No Violation)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Enforcement Action:</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full p-2 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs font-semibold"
                  >
                    <option value="warned">Warn User</option>
                    <option value="content_hidden">Hide Content</option>
                    <option value="user_suspended">Suspend User (7d)</option>
                    <option value="user_banned">Ban User Permanently</option>
                    <option value="none">No Action</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 block mb-1 font-semibold">
                  Canned Reason Templates:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {cannedTemplates.map((template, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActionReason(template)}
                      className="text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-950/50 p-1.5 rounded-lg text-gray-600 dark:text-gray-300 transition-colors"
                    >
                      {template.slice(0, 32)}...
                    </button>
                  ))}
                </div>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Type or select moderation reason..."
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-20 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100 dark:border-white/5">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={!actionReason.trim() || submitting}
                onClick={handleResolve}
                className="px-4 py-2 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {submitting ? 'Resolving...' : 'Submit Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

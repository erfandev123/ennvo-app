import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, ShieldAlert, Trash2, PauseCircle, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface DeactivateDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeactivateDeleteModal: React.FC<DeactivateDeleteModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setIsAuthenticated, popPage } = useAppStore();
  const [selectedAction, setSelectedAction] = useState<'deactivate' | 'delete'>('deactivate');
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('Need a break from social media');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (selectedAction === 'delete' && confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm permanent deletion');
      return;
    }

    setIsLoading(true);
    try {
      if (selectedAction === 'deactivate') {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          isDeactivated: true,
          deactivatedAt: Date.now()
        });
        alert('Your account has been deactivated. You can log back in anytime to restore it.');
        setIsAuthenticated(false);
        onClose();
        popPage();
      } else {
        // Permanent deletion scheduled
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          isScheduledForDeletion: true,
          deletionScheduledAt: Date.now(),
          deletionEffectiveDate: Date.now() + 30 * 24 * 60 * 60 * 1000
        });
        alert('Your account is scheduled for permanent deletion in 30 days. Logging in before then will cancel this request.');
        setIsAuthenticated(false);
        onClose();
        popPage();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Action failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden border border-gray-100 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Deactivate or Delete</h3>
                <p className="text-[11px] text-gray-500 font-medium">Manage your account availability</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleAction} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-xs font-semibold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Option Cards */}
            <div className="space-y-2.5">
              <div
                onClick={() => setSelectedAction('deactivate')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedAction === 'deactivate'
                    ? 'border-purple-600 bg-purple-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                  <PauseCircle className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-gray-900">Deactivate Account (Temporary)</h4>
                    <input
                      type="radio"
                      name="deactivate_action"
                      checked={selectedAction === 'deactivate'}
                      onChange={() => setSelectedAction('deactivate')}
                      className="accent-purple-600"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Your profile, posts, likes, and comments will be hidden until you reactivate by logging back in anytime.
                  </p>
                </div>
              </div>

              <div
                onClick={() => setSelectedAction('delete')}
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedAction === 'delete'
                    ? 'border-red-600 bg-red-50/50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-red-700">Delete Account (Permanent)</h4>
                    <input
                      type="radio"
                      name="deactivate_action"
                      checked={selectedAction === 'delete'}
                      onChange={() => setSelectedAction('delete')}
                      className="accent-red-600"
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                    Your account and all content will be permanently removed. You have a 30-day grace period to log in and cancel.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Reason for leaving</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-600"
              >
                <option value="Need a break from social media">Need a break from social media</option>
                <option value="Concerned about privacy">Concerned about my privacy</option>
                <option value="Creating a new account">Creating a new account</option>
                <option value="Too many notifications">Too many notifications</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {selectedAction === 'delete' && (
              <div>
                <label className="block text-xs font-bold text-red-700 mb-1">
                  Type <span className="underline font-black">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3.5 py-2.5 bg-red-50/50 border border-red-200 rounded-xl text-xs font-bold text-red-700 focus:outline-none focus:border-red-600"
                />
              </div>
            )}

            <div className="pt-2 flex items-center space-x-2.5">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-2xl transition-colors active:scale-98"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-1/2 py-3 font-extrabold text-xs rounded-2xl text-white shadow-md flex items-center justify-center space-x-1.5 transition-transform active:scale-98 disabled:opacity-70 ${
                  selectedAction === 'delete'
                    ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                    : 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <span>
                    {selectedAction === 'delete' ? 'Delete Account' : 'Deactivate'}
                  </span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

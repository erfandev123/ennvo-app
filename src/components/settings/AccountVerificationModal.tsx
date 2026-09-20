import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, ShieldCheck, BadgeCheck, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface AccountVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountVerificationModal: React.FC<AccountVerificationModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, setCurrentUser } = useAppStore();
  const [fullName, setFullName] = useState(currentUser?.name || '');
  const [knownAs, setKnownAs] = useState(currentUser?.username || '');
  const [category, setCategory] = useState('Creator / Influencer');
  const [documentType, setDocumentType] = useState('National ID');
  const [websiteLink, setWebsiteLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSubmitting(true);

    try {
      // Simulate verification review or instant verification for demonstration
      await new Promise((resolve) => setTimeout(resolve, 800));
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        isVerified: true,
        verificationStatus: 'verified',
        verificationRequestedAt: Date.now()
      });

      setCurrentUser({
        ...currentUser,
        isVerified: true
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      // Fallback local update
      if (currentUser) {
        setCurrentUser({ ...currentUser, isVerified: true });
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
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
          className="bg-white rounded-3xl w-full max-w-lg shadow-xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Request Verification Badge</h3>
                <p className="text-[11px] text-gray-500 font-medium">Verify your profile with an official Blue Badge</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            {submitted || currentUser?.isVerified ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center border-2 border-blue-200">
                  <BadgeCheck className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-gray-900">Account Verified! 🎉</h4>
                  <p className="text-xs text-gray-600 font-medium leading-relaxed max-w-sm mx-auto">
                    Your profile now displays the official verified blue badge next to your name across posts, comments, search, and messages.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-500/20 transition-transform active:scale-98"
                >
                  Awesome, Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 font-medium flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    Verified accounts have blue badges next to their names to show that Ennvo has confirmed they are authentic public figures, creators, or brands.
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Legal Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Erfan Ahmed"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Known As / Public Identity</label>
                    <input
                      type="text"
                      required
                      value={knownAs}
                      onChange={(e) => setKnownAs(e.target.value)}
                      placeholder="Stage name, brand name, or nickname"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      >
                        <option value="Creator / Influencer">Creator / Influencer</option>
                        <option value="News / Media">News / Media</option>
                        <option value="Music / Artist">Music / Artist</option>
                        <option value="Sports / Athlete">Sports / Athlete</option>
                        <option value="Gamer / Streamer">Gamer / Streamer</option>
                        <option value="Business / Brand">Business / Brand</option>
                        <option value="Public Figure">Public Figure</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Document Type</label>
                      <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                      >
                        <option value="National ID">National ID / NID</option>
                        <option value="Passport">Passport</option>
                        <option value="Driver License">Driver's License</option>
                        <option value="Utility Bill">Utility / Tax Bill</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Official Website or Social Link</label>
                    <input
                      type="url"
                      value={websiteLink}
                      onChange={(e) => setWebsiteLink(e.target.value)}
                      placeholder="https://instagram.com/yourhandle or website"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

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
                    disabled={isSubmitting}
                    className="w-1/2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-blue-500/20 flex items-center justify-center space-x-1.5 transition-transform active:scale-98 disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <BadgeCheck className="w-4 h-4" />
                        <span>Submit Request</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

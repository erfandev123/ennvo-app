import React from 'react';
import { X, Shield, Lock, Eye, FileText, CheckCircle2, UserCheck, PhoneCall, Server, KeyRound, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="bg-white rounded-3xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-purple-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 via-indigo-50/50 to-white sticky top-0 z-10">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-md shadow-purple-600/20">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Privacy Policy & Security Terms</h2>
                <p className="text-xs font-semibold text-purple-700">Official Compliance & Data Protection Standard</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-gray-700 text-sm leading-relaxed">
            
            {/* Owner & Legal Identity */}
            <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-2xl flex flex-col space-y-2">
              <div className="flex items-center space-x-2 text-purple-900 font-bold text-base">
                <UserCheck className="w-5 h-5 text-purple-600 shrink-0" />
                <span>Application Ownership & Developer Identity</span>
              </div>
              <p className="text-xs text-purple-950 font-medium leading-normal">
                <strong>Ennvo</strong> is designed, owned, and exclusively developed by <strong>Erfan Sarker</strong> (Father: <strong>Rasto Sarker</strong>), originating from Bijoynagar, Brahmanbaria, Bangladesh. All intellectual property, trademarks, UI designs, and source architecture belong solely to the developer.
              </p>
            </div>

            {/* 1. Data Collection & Usage */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                <span>1. Information Collection & Usage Policy</span>
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Ennvo collects minimal user information strictly required for core functionality, including your account name, email address, profile avatar, and posted content (reels, stories, posts). We enforce a strict <strong>Zero Third-Party Data Selling Policy</strong>. Your personal credentials and usage habits will never be sold, rented, or monetized to advertisers.
              </p>
            </div>

            {/* 2. Audio & Video Call Encryption */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 text-purple-600 shrink-0" />
                <span>2. WebRTC Real-Time Calling & Camera Privacy</span>
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Audio and video communication on Ennvo utilizes peer-to-peer <strong>WebRTC (Web Real-Time Communication)</strong> protocol with end-to-end transport encryption. Camera and microphone hardware access is requested only during active calls. <strong>No audio or video streams are ever recorded, monitored, or stored</strong> on our servers.
              </p>
            </div>

            {/* 3. Cloud Database & Infrastructure Security */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <Server className="w-4 h-4 text-purple-600 shrink-0" />
                <span>3. Firebase Infrastructure & Cloud Security Rules</span>
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                All cloud persistence operates on Google Firebase infrastructure. Strict <strong>Firestore Security Rules</strong> enforce granular access control: user profiles, private chats, and settings can only be accessed or modified by authenticated account owners.
              </p>
            </div>

            {/* 4. Password Protection & Authentication */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-purple-600 shrink-0" />
                <span>4. Authentication & Password Protection</span>
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                User passwords are cryptographic hashes managed securely through standard Firebase Authentication services. Ennvo administrators cannot read or view plain-text user passwords.
              </p>
            </div>

            {/* 5. User Rights & Account Deletion */}
            <div className="space-y-2">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <Eye className="w-4 h-4 text-purple-600 shrink-0" />
                <span>5. Right to Erasure & Account Deletion</span>
              </h3>
              <p className="text-gray-600 text-xs sm:text-sm">
                Under global privacy standards (GDPR / CCPA principles), users retain full ownership of their data. You can delete your posts, comments, or permanently remove your account at any time via the Settings menu under "Danger Zone".
              </p>
            </div>

            {/* Verification Checklist */}
            <div className="pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Verified End-to-End Encrypted Calling & High Security Compliance</span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-500">© 2026 Ennvo • Developed by Erfan Sarker</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              Close Privacy Policy
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


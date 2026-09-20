import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, ShieldCheck, CheckCircle2, AlertTriangle, Smartphone, KeyRound, 
  Mail, Lock, Fingerprint, Laptop, ChevronRight, Check
} from 'lucide-react';
import { useAppStore } from '../../store';

interface SecurityCheckupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPasswordModal?: () => void;
}

export const SecurityCheckupModal: React.FC<SecurityCheckupModalProps> = ({
  isOpen,
  onClose,
  onOpenPasswordModal
}) => {
  const { currentUser } = useAppStore();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    localStorage.getItem('ennvo_2fa_enabled') === 'true'
  );
  const [passkeyEnabled, setPasskeyEnabled] = useState(
    localStorage.getItem('ennvo_passkey_enabled') === 'true'
  );

  if (!isOpen) return null;

  const hasPhone = Boolean(currentUser?.mobileNumber);
  const hasMail = Boolean(currentUser?.email);
  const hasPassword = Boolean(currentUser?.hasPassword);
  
  // Calculate security score
  let score = 30; // base score
  if (hasMail) score += 15;
  if (hasPhone) score += 15;
  if (hasPassword) score += 15;
  if (twoFactorEnabled) score += 15;
  if (passkeyEnabled) score += 10;
  score = Math.min(100, score);

  const toggle2FA = () => {
    const next = !twoFactorEnabled;
    setTwoFactorEnabled(next);
    localStorage.setItem('ennvo_2fa_enabled', String(next));
  };

  const togglePasskey = () => {
    const next = !passkeyEnabled;
    setPasskeyEnabled(next);
    localStorage.setItem('ennvo_passkey_enabled', String(next));
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
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-gray-900">Security Checkup</h3>
                <p className="text-[11px] text-gray-500 font-medium">Review your complete account protection</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-5">
            {/* Score Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/50 border border-emerald-200/80 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Account Protection Status</span>
                <h4 className="text-lg font-black text-emerald-950">
                  {score >= 85 ? 'Excellent Protection 🛡️' : 'Good (Action Recommended)'}
                </h4>
                <p className="text-xs text-emerald-700">
                  {score >= 85 
                    ? 'Your account satisfies essential security best practices.' 
                    : 'Turn on 2-step verification or set a recovery phone for max security.'}
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white border-2 border-emerald-400 shadow-sm flex flex-col items-center justify-center shrink-0">
                <span className="text-base font-black text-emerald-700">{score}%</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase">Score</span>
              </div>
            </div>

            {/* Checklist Items */}
            <div className="space-y-2.5">
              <h5 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Security Checklist</h5>

              {/* 1. Phone */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${hasPhone ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">Recovery Phone</h4>
                      {hasPhone ? (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Verified</span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Recommended</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{currentUser?.mobileNumber || 'Add a phone number to recover your account if locked out'}</p>
                  </div>
                </div>
                {hasPhone && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
              </div>

              {/* 2. 2-Step Verification */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${twoFactorEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">2-Step Verification (2FA)</h4>
                      {twoFactorEnabled ? (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Active</span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Off</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Require an extra verification code when signing in from a new device</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={toggle2FA}
                  className={`w-11 h-6 rounded-full relative transition-colors border ${twoFactorEnabled ? 'bg-emerald-600 border-emerald-600' : 'bg-gray-200 border-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${twoFactorEnabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* 3. Passkey */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${passkeyEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    <Fingerprint className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">Biometric Passkey</h4>
                      {passkeyEnabled ? (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Registered</span>
                      ) : (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">Optional</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">Sign in with Fingerprint, Face ID, or Windows Hello security key</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={togglePasskey}
                  className={`w-11 h-6 rounded-full relative transition-colors border ${passkeyEnabled ? 'bg-indigo-600 border-indigo-600' : 'bg-gray-200 border-gray-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${passkeyEnabled ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>

              {/* 4. Recovery Email */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">Recovery Email</h4>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">Primary</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 break-all">{currentUser?.email || 'No email registered'}</p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              {/* 5. Your Device */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">Trusted Device</h4>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Active Now</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{navigator.platform || 'This Device'} • No suspicious activity detected</p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              </div>

              {/* 6. Password Check */}
              <div className="p-3.5 border border-gray-100 rounded-2xl bg-gray-50/60 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${hasPassword ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-gray-900">Account Password</h4>
                      <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${hasPassword ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {hasPassword ? 'Protected' : 'Set Password'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {hasPassword ? 'Password is secure and protected with encryption' : 'Set a standalone password to secure your account'}
                    </p>
                  </div>
                </div>
                {hasPassword ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onOpenPasswordModal) onOpenPasswordModal();
                    }}
                    className="px-2.5 py-1 bg-purple-600 text-white text-[11px] font-bold rounded-lg"
                  >
                    Set
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-extrabold text-xs rounded-2xl shadow-sm transition-transform active:scale-98"
            >
              Done Checkup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

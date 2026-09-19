import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  Plus, 
  Trash2, 
  LogOut, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAppStore } from '../store';
import { getSavedAccounts, saveAccount, removeSavedAccount, SavedAccount } from '../services/accountService';
import { signIn, logout } from '../services/authService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

interface AccountSwitcherModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AccountSwitcherModal: React.FC<AccountSwitcherModalProps> = ({ isOpen, onClose }) => {
  const { 
    currentUser, 
    setCurrentUser, 
    pushPage, 
    setViewingUser,
    showAccountSwitcherModal, 
    setShowAccountSwitcherModal 
  } = useAppStore();

  const isModalOpen = isOpen !== undefined ? isOpen : showAccountSwitcherModal;
  const handleCloseModal = () => {
    if (onClose) onClose();
    setShowAccountSwitcherModal(false);
  };

  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Synchronize saved accounts on open
  useEffect(() => {
    if (isModalOpen) {
      if (currentUser) {
        saveAccount(currentUser);
      }
      setAccounts(getSavedAccounts());
      setShowAddForm(false);
      setErrorMessage('');
    }
  }, [isModalOpen, currentUser]);

  const handleSwitchToAccount = async (account: SavedAccount) => {
    if (account.uid === currentUser?.uid) {
      setViewingUser(null);
      pushPage('profile');
      handleCloseModal();
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      // Fetch the full user document from Firestore to ensure fresh profile data
      const userRef = doc(db, 'users', account.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = { uid: userSnap.id, ...userSnap.data() } as User;
        saveAccount(uData);
        try {
          localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(uData));
        } catch (e) {}
        setCurrentUser(uData);
        setViewingUser(null);
        pushPage('profile');
        handleCloseModal();
      } else {
        // Fallback to local saved account data
        const fallbackUser: User = {
          uid: account.uid,
          name: account.name,
          username: account.username,
          avatar: account.avatar,
          email: account.email || '',
          bio: '',
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          createdAt: Date.now() as any,
        };
        saveAccount(fallbackUser);
        try {
          localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(fallbackUser));
        } catch (e) {}
        setCurrentUser(fallbackUser);
        setViewingUser(null);
        pushPage('profile');
        handleCloseModal();
      }
    } catch (e: any) {
      console.warn('Switch account error:', e);
      setErrorMessage(e.message || 'Could not switch account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAccount = (e: React.MouseEvent, uid: string) => {
    e.stopPropagation();
    const updated = removeSavedAccount(uid);
    setAccounts(updated);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('Please enter both username/email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      const loggedInUser = await signIn(loginIdentifier.trim(), loginPassword);
      if (loggedInUser) {
        saveAccount(loggedInUser);
        try {
          localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(loggedInUser));
        } catch (e) {}
        setCurrentUser(loggedInUser);
        setViewingUser(null);
        pushPage('profile');
        setAccounts(getSavedAccounts());
        setShowAddForm(false);
        setLoginIdentifier('');
        setLoginPassword('');
        handleCloseModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogOutCurrent = async () => {
    if (!currentUser) return;
    try {
      removeSavedAccount(currentUser.uid);
      try {
        localStorage.removeItem('ennvo_last_active_user_v1');
      } catch (e) {}
      await logout();
      setCurrentUser(null);
      setViewingUser(null);
      handleCloseModal();
      pushPage('home');
    } catch (e) {
      console.error(e);
    }
  };

  if (!isModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleCloseModal}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal / Sheet */}
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative w-full max-w-[460px] bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh] z-10"
        >
          {/* iOS Grabber Pill */}
          <div className="w-full flex items-center justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-purple-600" />
              <h2 className="text-[17px] font-semibold text-gray-900 tracking-tight">
                {showAddForm ? 'Add account' : 'Switch accounts'}
              </h2>
            </div>
            <button 
              onClick={handleCloseModal}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-5 py-4 space-y-3">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl flex items-center space-x-2 text-red-600 text-[13px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            {!showAddForm ? (
              <>
                {/* Account List */}
                <div className="space-y-1.5">
                  {accounts.map((acc) => {
                    const isCurrent = acc.uid === currentUser?.uid;
                    return (
                      <div
                        key={acc.uid}
                        onClick={() => handleSwitchToAccount(acc)}
                        className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98] ${
                          isCurrent 
                            ? 'bg-purple-50/90 border-2 border-purple-300/80 shadow-xs' 
                            : 'bg-gray-50/80 hover:bg-gray-100/80 border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="relative shrink-0">
                            <img 
                              src={acc.avatar} 
                              alt={acc.name} 
                              className="w-12 h-12 rounded-full object-cover border border-white shadow-xs"
                              referrerPolicy="no-referrer"
                            />
                            {isCurrent && (
                              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-gray-900 truncate flex items-center space-x-1">
                              <span>{acc.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-semibold bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                  Current
                                </span>
                              )}
                            </p>
                            <p className="text-[13px] text-gray-500 truncate">@{acc.username}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 pl-2">
                          {!isCurrent && (
                            <button
                              onClick={(e) => handleRemoveAccount(e, acc.uid)}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                              title="Remove from saved accounts"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Account Action */}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full mt-2 py-3 px-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 text-purple-600 font-medium text-[14px] flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log into another account</span>
                </button>

                {/* Log Out Current Account */}
                {currentUser && (
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-center">
                    <button
                      onClick={handleLogOutCurrent}
                      className="text-[13px] text-red-500 hover:text-red-600 font-medium flex items-center space-x-1.5 py-2 px-3 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log out of @{currentUser.username || 'current account'}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Add Account Login Form */
              <form onSubmit={handleLoginSubmit} className="space-y-4 pt-1">
                <p className="text-[13px] text-gray-500 leading-relaxed">
                  Log in to an existing account to add it to your device and switch between accounts in one tap.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">
                      Username or Email
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. john or john@example.com"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 pr-10 transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-[14px] font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[14px] font-medium transition-all shadow-md shadow-purple-200 flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Log in</span>
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

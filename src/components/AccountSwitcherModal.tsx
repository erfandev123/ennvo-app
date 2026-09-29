import React, { useState, useEffect, useRef } from 'react';
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
import { signIn, signInWithGoogle, logout } from '../services/authService';
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
  const [accountToRemove, setAccountToRemove] = useState<SavedAccount | null>(null);

  // Synchronize saved accounts on open
  useEffect(() => {
    if (isModalOpen) {
      if (currentUser) {
        saveAccount(currentUser);
      }
      const saved = getSavedAccounts();
      setAccounts(saved.slice(0, 7));
      setShowAddForm(false);
      setErrorMessage('');
      setAccountToRemove(null);
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
      setErrorMessage(e.message || 'Error switching account');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRemoveAccount = () => {
    if (!accountToRemove) return;
    const updated = removeSavedAccount(accountToRemove.uid);
    setAccounts(updated.slice(0, 7));
    setAccountToRemove(null);
  };

  const handleGoogleSignInSubmit = async () => {
    if (accounts.length >= 7) {
      setErrorMessage('Maximum 7 accounts saved.');
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
        saveAccount(loggedInUser);
        try {
          localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(loggedInUser));
        } catch (e) {}
        setCurrentUser(loggedInUser);
        setViewingUser(null);
        pushPage('profile');
        setAccounts(getSavedAccounts().slice(0, 7));
        setShowAddForm(false);
        handleCloseModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Sign-In failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accounts.length >= 7) {
      setErrorMessage('Maximum 7 accounts saved.');
      return;
    }
    if (!loginIdentifier.trim() || !loginPassword.trim()) {
      setErrorMessage('Enter login details');
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
        setAccounts(getSavedAccounts().slice(0, 7));
        setShowAddForm(false);
        setLoginIdentifier('');
        setLoginPassword('');
        handleCloseModal();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid details');
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
          className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        />

        {/* Modal Sheet */}
        <motion.div 
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 360 }}
          className="relative w-full max-w-[420px] bg-white rounded-t-[32px] sm:rounded-[28px] shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh] z-10 select-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50/80">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-purple-600" />
              <h2 className="text-[15.5px] font-bold text-gray-900 tracking-tight">
                {showAddForm ? 'Add Account' : 'Switch Account'}
              </h2>
            </div>
            <button 
              onClick={handleCloseModal}
              className="w-7 h-7 rounded-full bg-gray-200/80 hover:bg-gray-300 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto px-4 py-3 space-y-2.5">
            {errorMessage && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-600 text-[12.5px]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1 font-medium">{errorMessage}</span>
              </div>
            )}

            {!showAddForm ? (
              <>
                {/* Accounts List */}
                <div className="space-y-1.5">
                  {accounts.map((acc) => {
                    const isCurrent = acc.uid === currentUser?.uid;
                    return (
                      <div
                        key={acc.uid}
                        onClick={() => handleSwitchToAccount(acc)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all active:scale-[0.985] ${
                          isCurrent 
                            ? 'bg-purple-50/90 border-2 border-purple-300/80 shadow-2xs' 
                            : 'bg-gray-50/80 hover:bg-gray-100/80 border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="relative shrink-0">
                            <img 
                              src={acc.avatar} 
                              alt={acc.name} 
                              className="w-11 h-11 rounded-full object-cover border border-white shadow-2xs"
                              referrerPolicy="no-referrer"
                            />
                            {isCurrent && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-4.5 h-4.5 bg-purple-600 text-white rounded-full flex items-center justify-center border border-white shadow-2xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pr-1">
                            <p className="text-[14.5px] font-bold text-gray-900 truncate">
                              {acc.name}
                            </p>
                            <p className="text-[12px] font-normal text-gray-500 truncate">
                              @{acc.username}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {!isCurrent && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToRemove(acc);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Account Card Box */}
                  {accounts.length < 7 && (
                    <div
                      onClick={() => setShowAddForm(true)}
                      className="flex items-center space-x-3 p-2.5 rounded-2xl cursor-pointer border-2 border-dashed border-purple-200 bg-purple-50/30 hover:bg-purple-50/70 transition-all active:scale-[0.985]"
                    >
                      <div className="w-11 h-11 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 border border-purple-200">
                        <Plus className="w-5 h-5 stroke-[2.5]" />
                      </div>
                      <span className="text-[14px] font-bold text-purple-700">Add Account</span>
                    </div>
                  )}
                </div>

                {/* Log Out Current */}
                {currentUser && (
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-center">
                    <button
                      onClick={handleLogOutCurrent}
                      className="text-[12.5px] text-red-500 hover:text-red-600 font-semibold flex items-center space-x-1.5 py-1.5 px-3 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Logout @{currentUser.username}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Clean Minimal Add Account Login Form */
              <form onSubmit={handleLoginSubmit} className="space-y-3 pt-1">
                {/* Google Sign In Quick Action */}
                <button
                  type="button"
                  onClick={handleGoogleSignInSubmit}
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-bold text-[13.5px] flex items-center justify-center space-x-2 transition-all shadow-2xs active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <div className="relative flex items-center justify-center my-1.5">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-2 text-[11px] text-gray-400 font-medium absolute">OR</span>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Username or Email"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 transition-all"
                    required
                  />

                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-[13.5px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-purple-500 pr-9 transition-all"
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

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-[13px] font-bold hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[13px] font-bold transition-all shadow-xs flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Save Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>

        {/* Account Removal Confirmation Popup */}
        <AnimatePresence>
          {accountToRemove && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl text-center space-y-3"
              >
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Remove @{accountToRemove.username}?</h3>
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={() => setAccountToRemove(null)}
                    className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRemoveAccount}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
};

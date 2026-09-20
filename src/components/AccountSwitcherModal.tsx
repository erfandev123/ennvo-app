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
  ShieldCheck,
  AlertTriangle
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

  const longPressTimerRef = useRef<any>(null);

  // Synchronize saved accounts on open
  useEffect(() => {
    if (isModalOpen) {
      if (currentUser) {
        saveAccount(currentUser);
      }
      setAccounts(getSavedAccounts());
      setShowAddForm(false);
      setErrorMessage('');
      setAccountToRemove(null);
    }
  }, [isModalOpen, currentUser]);

  const handlePressStart = (acc: SavedAccount) => {
    longPressTimerRef.current = setTimeout(() => {
      setAccountToRemove(acc);
    }, 450);
  };

  const handlePressEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

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
      console.warn('Switch account error:', e);
      setErrorMessage(e.message || 'Could not switch account');
    } finally {
      setIsLoading(false);
    }
  };

  const confirmRemoveAccount = () => {
    if (!accountToRemove) return;
    const updated = removeSavedAccount(accountToRemove.uid);
    setAccounts(updated);
    setAccountToRemove(null);
  };

  const handleGoogleSignInSubmit = async () => {
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
        setAccounts(getSavedAccounts());
        setShowAddForm(false);
        handleCloseModal();
      }
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      setErrorMessage(err.message || 'Google Sign-In failed');
    } finally {
      setIsLoading(false);
    }
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
                        onTouchStart={() => handlePressStart(acc)}
                        onTouchEnd={handlePressEnd}
                        onMouseDown={() => handlePressStart(acc)}
                        onMouseUp={handlePressEnd}
                        onMouseLeave={handlePressEnd}
                        className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98] select-none ${
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setAccountToRemove(acc);
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors"
                              title="Remove account (or long press)"
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

                {/* Google Sign In Quick Action */}
                <button
                  type="button"
                  onClick={handleGoogleSignInSubmit}
                  disabled={isLoading}
                  className="w-full mt-2.5 py-3 px-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-[14px] flex items-center justify-center space-x-2.5 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
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
                  <span>Continue with Google</span>
                </button>

                {/* Add Account Action */}
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full mt-2 py-3 px-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 text-purple-600 font-medium text-[14px] flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Log into another account with Email</span>
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

                {/* Google Sign in Button in Add Form */}
                <button
                  type="button"
                  onClick={handleGoogleSignInSubmit}
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 font-semibold text-[14px] flex items-center justify-center space-x-2.5 transition-all shadow-xs active:scale-[0.98] disabled:opacity-50"
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
                  <span>Sign in with Google</span>
                </button>

                <div className="relative flex items-center justify-center my-2">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-3 text-[12px] text-gray-400 font-medium absolute">OR EMAIL</span>
                </div>

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

        {/* Account Removal Confirmation Popup */}
        <AnimatePresence>
          {accountToRemove && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl text-center space-y-4"
              >
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-900">Remove Saved Account?</h3>
                  <p className="text-sm text-gray-500">
                    Are you sure you want to remove <span className="font-semibold text-gray-800">@{accountToRemove.username}</span> from saved accounts on this device?
                  </p>
                </div>
                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => setAccountToRemove(null)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmRemoveAccount}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium text-sm transition-colors shadow-md shadow-red-200"
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

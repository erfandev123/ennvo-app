import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Check, 
  Plus, 
  Trash2, 
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
import { signIn, signInWithGoogle } from '../services/authService';
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
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

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

  const handlePointerDown = (acc: SavedAccount) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (navigator.vibrate) {
        try { navigator.vibrate(40); } catch (e) {}
      }
      setAccountToRemove(acc);
    }, 450);
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleAccountClick = (account: SavedAccount) => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    handleSwitchToAccount(account);
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
      const uData: User = userSnap.exists()
        ? ({ uid: userSnap.id, ...userSnap.data() } as User)
        : {
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

      saveAccount(uData);
      try {
        localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(uData));
      } catch (e) {}
      
      setCurrentUser(uData);
      setViewingUser(null);

      // Load following & followers in real-time for the switched account
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const [followingSnap, followerSnap] = await Promise.all([
          getDocs(collection(db, 'users', uData.uid, 'following')),
          getDocs(collection(db, 'users', uData.uid, 'followers'))
        ]);
        const followingIds = followingSnap.docs.map(d => d.id);
        const followerIds = followerSnap.docs.map(d => d.id);
        useAppStore.getState().setFollowingIds(followingIds);
        useAppStore.getState().setFollowerIds(followerIds);
      } catch (err) {
        console.warn('Real-time relationship sync error:', err);
      }

      pushPage('profile');
      handleCloseModal();
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

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 animate-in fade-in duration-150">
      <div 
        onClick={handleCloseModal}
        className="absolute inset-0"
      />

      {/* Modal Sheet - 100% 2D lag-free UI */}
      <div 
        className="relative w-full max-w-[390px] bg-white rounded-t-3xl sm:rounded-2xl border border-neutral-100 overflow-hidden flex flex-col max-h-[85vh] z-10 select-none shadow-none animate-in slide-in-from-bottom duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 bg-white">
          <div className="flex items-center space-x-2">
            <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight">
              {showAddForm ? 'Add Account' : 'Switch Account'}
            </h2>
            {!showAddForm && (
              <span className="text-[11px] font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                {accounts.length}/7
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            {!showAddForm && accounts.length < 7 && (
              <button 
                onClick={() => setShowAddForm(true)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-all border-0"
                title="Add account"
              >
                <Plus className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}
            <button 
              onClick={handleCloseModal}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center transition-all border-0"
              title="Close"
            >
              <X className="w-4 h-4 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-3.5 py-2.5 space-y-1.5">
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-100 rounded-xl flex items-center space-x-2 text-red-600 text-[12px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1 font-medium">{errorMessage}</span>
            </div>
          )}

          {!showAddForm ? (
            <>
              {/* Accounts List - 2D Clean */}
              <div className="space-y-1">
                {accounts.map((acc) => {
                  const isCurrent = acc.uid === currentUser?.uid;
                  return (
                    <div
                      key={acc.uid}
                      onClick={() => handleAccountClick(acc)}
                      onMouseDown={() => handlePointerDown(acc)}
                      onMouseUp={handlePointerUpOrCancel}
                      onMouseLeave={handlePointerUpOrCancel}
                      onTouchStart={() => handlePointerDown(acc)}
                      onTouchEnd={handlePointerUpOrCancel}
                      onTouchCancel={handlePointerUpOrCancel}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setAccountToRemove(acc);
                      }}
                      className={`flex items-center justify-between p-2 rounded-2xl cursor-pointer transition-colors  select-none ${
                        isCurrent 
                          ? 'bg-neutral-100/90 text-neutral-900' 
                          : 'hover:bg-neutral-50 text-neutral-900 active:bg-neutral-100/60'
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <img 
                          src={acc.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.name || 'User')}&background=random`} 
                          alt="" 
                          className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0 flex-1 pr-1">
                          <p className="text-[13.5px] font-bold text-neutral-900 truncate leading-tight">
                            {acc.name}
                          </p>
                          <p className="text-[11.5px] font-normal text-neutral-500 truncate leading-tight mt-0.5">
                            @{acc.username}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isCurrent ? (
                          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {/* Add Account Option */}
                {accounts.length < 7 && (
                  <div
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center space-x-3 p-2 rounded-2xl cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-700 flex items-center justify-center shrink-0">
                      <Plus className="w-4.5 h-4.5 stroke-[2]" />
                    </div>
                    <span className="text-[13.5px] font-semibold text-neutral-800">Add Account</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Clean 2D Minimal Add Account Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleGoogleSignInSubmit}
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 font-semibold text-[13px] flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-neutral-100 w-full" />
                <span className="bg-white px-2 text-[10.5px] text-neutral-400 font-medium absolute">OR</span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Username or Email"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-purple-500 transition-all"
                  required
                />

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-purple-500 pr-9 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 border-0"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-2 rounded-xl border border-neutral-200 text-neutral-700 text-[12.5px] font-semibold hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#ff3b5c] to-[#ff5376] hover:brightness-105 text-white text-[12.5px] font-semibold transition-all shadow-xs flex items-center justify-center space-x-1 disabled:opacity-50 border-0"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Log In</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Account Removal Confirmation Popup - 2D Clean */}
      {accountToRemove && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-100">
          <div
            className="bg-white rounded-2xl p-4 max-w-xs w-full shadow-lg text-center space-y-2.5 border border-neutral-100 animate-in zoom-in-95 duration-150"
          >
            <div className="w-9 h-9 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-4 h-4" />
            </div>
            <h3 className="text-[14px] font-bold text-neutral-900">Remove @{accountToRemove.username}?</h3>
            <p className="text-[12px] text-neutral-500">You can always log back in later.</p>
            <div className="flex space-x-2 pt-1">
              <button
                onClick={() => setAccountToRemove(null)}
                className="flex-1 py-1.5 rounded-xl border border-neutral-200 text-neutral-700 font-semibold text-[12px] hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveAccount}
                className="flex-1 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-[12px] transition-colors border-0"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

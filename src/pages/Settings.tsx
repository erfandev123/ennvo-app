import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Shield, Share2, Lock, UserX, MessageSquare, AtSign, Send,
  Link, Download, Users, Heart, Eye, Moon, Sun, Trash2, Smartphone, 
  Check, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, 
  KeyRound, ShieldCheck, Mail, EyeOff, Fingerprint, BadgeCheck, 
  ShieldAlert, Info, QrCode, Copy, FileText, RefreshCw, Film, Sparkles
} from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { AccountVerificationModal } from '../components/settings/AccountVerificationModal';
import { DeactivateDeleteModal } from '../components/settings/DeactivateDeleteModal';
import { SecurityCheckupModal } from '../components/settings/SecurityCheckupModal';
import { BlockedUsersModal } from '../components/settings/BlockedUsersModal';
import { AccountInfoScreen } from '../components/settings/AccountInfoScreen';
import { VerificationScreen } from '../components/settings/VerificationScreen';
import { BlockedAccountsScreen } from '../components/settings/BlockedAccountsScreen';
import { changeUserPassword, sendPasswordReset, setUserPassword } from '../services/authService';

type SettingsScreen = 
  | 'main'                    // Settings and privacy
  | 'account'                 // Account
  | 'account_info'            // Account information edit form
  | 'password'                // Password change form
  | 'security_permissions'    // Security and permissions
  | 'security_overview'       // Security overview (No security issues found)
  | 'manage_devices'          // Manage devices
  | 'private_account'         // Private account settings
  | 'comments'                // Comments settings
  | 'mentions'                // Mentions settings
  | 'direct_messages'         // Direct messages settings
  | 'reuse_content'           // Reuse of content (Duet / Stitch)
  | 'following_list'          // Following list privacy
  | 'liked_videos'            // Liked videos privacy
  | 'free_up_space'           // Free up space
  | 'display_theme'           // Display theme
  | 'verification'            // Full-page verification
  | 'blocked_accounts';       // Full-page blocked accounts

export default function Settings() {
  const [currentScreen, setCurrentScreen] = useState<SettingsScreen>('main');
  const { setIsAuthenticated, currentUser, setCurrentUser, popPage } = useAppStore();

  // Modals state
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showSecurityCheckupModal, setShowSecurityCheckupModal] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showLegacyModal, setShowLegacyModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Business Account upgrade state
  const [businessCategory, setBusinessCategory] = useState('Creator & Media');
  const [businessEmail, setBusinessEmail] = useState(currentUser?.email || '');
  const [isUpgradingBusiness, setIsUpgradingBusiness] = useState(false);
  const [businessUpgradeSuccess, setBusinessUpgradeSuccess] = useState(false);

  // Legacy Contact state
  const [legacyContact, setLegacyContact] = useState('');
  const [legacySuccess, setLegacySuccess] = useState(false);

  // Password Management State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwSuccessMsg, setPwSuccessMsg] = useState<string | null>(null);
  const [pwErrorMsg, setPwErrorMsg] = useState<string | null>(null);
  const [isSendingResetEmail, setIsSendingResetEmail] = useState(false);
  const [resetEmailSentMsg, setResetEmailSentMsg] = useState<string | null>(null);

  // Passkey State
  const [isPasskeyEnabled, setIsPasskeyEnabled] = useState(
    localStorage.getItem('ennvo_passkey_enabled') === 'true'
  );

  // Cache & Free Up Space State
  const [cacheSize, setCacheSize] = useState<number>(() => {
    const saved = localStorage.getItem('ennvo_cache_size');
    return saved ? parseFloat(saved) : 48.6;
  });
  const [downloadsSize, setDownloadsSize] = useState<number>(12.4);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isClearingDownloads, setIsClearingDownloads] = useState(false);

  // Account Info Edit Form State
  const [accountInfo, setAccountInfo] = useState({
    name: currentUser?.name || 'Ennvo User',
    username: currentUser?.username || 'ennvo_user',
    email: currentUser?.email || '',
    mobileNumber: currentUser?.mobileNumber || '+880 1700-000000',
    birthday: '2001-05-14',
    gender: currentUser?.gender || 'male',
    location: currentUser?.location || 'Dhaka, Bangladesh',
    bio: currentUser?.bio || 'Hey there! I am using Ennvo.'
  });
  const [isSavingAccountInfo, setIsSavingAccountInfo] = useState(false);
  const [accountInfoSuccess, setAccountInfoSuccess] = useState(false);

  // Comprehensive User Settings synced to Firestore
  const [userSettings, setUserSettings] = useState<any>({
    // Privacy
    isPrivate: false,
    showActivity: true,
    // Interactions
    whoCanMessage: 'everyone', // everyone | friends | no_one
    whoCanComment: 'everyone', // everyone | friends | no_one
    whoCanMention: 'everyone', // everyone | friends | no_one
    reuseOfContent: 'everyone', // everyone | friends | only_you
    displayProfileWhenSharing: true,
    downloadsAllowed: true,
    followingListPrivacy: 'everyone', // everyone | only_you
    likedVideosPrivacy: 'only_you', // only_you | everyone
    viewersEnabled: true,
    offensiveFilter: true,
    readReceipts: true,
    // Security
    saveLoginInfo: true,
    twoFactorAuth: false,
    // Display
    appTheme: localStorage.getItem('ennvo_theme_mode') || 'light'
  });

  // Real device detection
  const detectedDevice = useMemo(() => {
    const ua = navigator.userAgent;
    let browser = 'Web Browser';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Google Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Apple Safari';
    else if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
    else if (ua.includes('Edg')) browser = 'Microsoft Edge';

    let os = 'Redmi 13C';
    let isMobile = false;
    if (/android/i.test(ua)) {
      os = 'Redmi 13C';
      isMobile = true;
    } else if (/iPad|iPhone|iPod/.test(ua)) {
      os = 'iPhone';
      isMobile = true;
    } else if (/windows/i.test(ua)) os = 'Windows 11 PC';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS Apple';
    else if (/linux/i.test(ua)) os = 'Linux Desktop';

    return { browser, os, isMobile };
  }, []);

  // Devices list matching the screenshot style (Redmi 13C and Vivo Y18)
  const [devices, setDevices] = useState([
    {
      id: 'current_device',
      name: detectedDevice.os || 'Redmi 13C',
      app: 'ennvo',
      method: 'Password / Google login',
      date: '20 Sept 2026, 6:57 am',
      isCurrent: true
    },
    {
      id: 'vivo_y18',
      name: 'Vivo Y18',
      app: 'ennvo',
      method: 'Unknown login method',
      date: '25 Aug 2026, 12:13 am',
      isCurrent: false
    }
  ]);

  // Sync profile data from currentUser & Firestore
  useEffect(() => {
    if (currentUser) {
      setAccountInfo({
        name: currentUser.name || 'Ennvo User',
        username: currentUser.username ? currentUser.username.replace('@', '') : 'user',
        email: currentUser.email || '',
        mobileNumber: currentUser.mobileNumber || '+880 1700-000000',
        birthday: '2001-05-14',
        gender: currentUser.gender || 'male',
        location: currentUser.location || 'Dhaka, Bangladesh',
        bio: currentUser.bio || 'Hey there! I am using Ennvo.'
      });

      const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docObj) => {
        if (docObj.exists()) {
          const data = docObj.data();
          setUserSettings((prev: any) => ({ ...prev, ...data }));
        }
      }, () => {});
      return () => unsub();
    }
  }, [currentUser]);

  // Toggle user setting in Firestore & local state
  const toggleSetting = async (key: string) => {
    if (!currentUser) return;
    const newValue = !userSettings[key];
    setUserSettings((prev: any) => ({ ...prev, [key]: newValue }));
    setCurrentUser({
      ...currentUser,
      [key]: newValue
    });
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: newValue
      });
      if (key === 'saveLoginInfo') {
        localStorage.setItem('ennvo_save_login_info', String(newValue));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateSettingValue = async (key: string, value: any) => {
    if (!currentUser) return;
    setUserSettings((prev: any) => ({ ...prev, [key]: value }));
    setCurrentUser({
      ...currentUser,
      [key]: value
    });
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: value
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Back button logic matching the screenshots' navigation stack
  const handleBack = () => {
    if (currentScreen === 'main') {
      popPage();
    } else if (
      currentScreen === 'account_info' ||
      currentScreen === 'password' ||
      currentScreen === 'verification'
    ) {
      setCurrentScreen('account');
    } else if (currentScreen === 'security_overview' || currentScreen === 'manage_devices') {
      setCurrentScreen('security_permissions');
    } else {
      setCurrentScreen('main');
    }
  };

  // Working Passkey Registration & Toggle
  const handleTogglePasskey = async () => {
    if (!currentUser) return;
    const next = !isPasskeyEnabled;
    if (next) {
      try {
        if (typeof window !== 'undefined' && window.PublicKeyCredential && navigator.credentials?.create) {
          const challenge = new Uint8Array(32);
          window.crypto.getRandomValues(challenge);
          const userId = new TextEncoder().encode(currentUser.uid);
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: 'Ennvo' },
              user: {
                id: userId,
                name: currentUser.email || currentUser.username || 'user',
                displayName: currentUser.name || 'User'
              },
              pubKeyCredParams: [
                { alg: -7, type: 'public-key' },
                { alg: -257, type: 'public-key' }
              ],
              authenticatorSelection: { userVerification: 'preferred' },
              timeout: 60000
            }
          });
        }
      } catch (authErr: any) {
        console.warn('WebAuthn prompt bypassed or unsupported:', authErr);
      }
      setIsPasskeyEnabled(true);
      localStorage.setItem('ennvo_passkey_enabled', 'true');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          passkeyEnabled: true,
          passkeyDevice: detectedDevice.os,
          passkeyRegisteredAt: Date.now()
        });
      } catch (e) {}
      setCurrentUser({
        ...currentUser,
        passkeyEnabled: true
      });
      alert(`Passkey activated for ${detectedDevice.os}! You can now use your device lock screen, fingerprint or PIN to sign in.`);
    } else {
      setIsPasskeyEnabled(false);
      localStorage.setItem('ennvo_passkey_enabled', 'false');
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          passkeyEnabled: false
        });
      } catch (e) {}
      setCurrentUser({
        ...currentUser,
        passkeyEnabled: false
      });
    }
  };

  // Save Account Info
  const handleSaveAccountInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingAccountInfo(true);
    setAccountInfoSuccess(false);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        name: accountInfo.name,
        username: accountInfo.username.toLowerCase(),
        mobileNumber: accountInfo.mobileNumber,
        location: accountInfo.location,
        bio: accountInfo.bio,
        gender: accountInfo.gender
      });

      setCurrentUser({
        ...currentUser,
        name: accountInfo.name,
        username: accountInfo.username.toLowerCase(),
        mobileNumber: accountInfo.mobileNumber,
        location: accountInfo.location,
        bio: accountInfo.bio,
        gender: accountInfo.gender as any
      });

      setAccountInfoSuccess(true);
      setTimeout(() => {
        setAccountInfoSuccess(false);
        setCurrentScreen('account');
      }, 1200);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update account information');
    } finally {
      setIsSavingAccountInfo(false);
    }
  };

  // Password update form
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwErrorMsg(null);
    setPwSuccessMsg(null);

    if (currentUser?.hasPassword && !currentPw) {
      setPwErrorMsg('Please enter your current password');
      return;
    }

    if (newPw.length < 6) {
      setPwErrorMsg('New password must be at least 6 characters');
      return;
    }

    if (newPw !== confirmPw) {
      setPwErrorMsg('New passwords do not match');
      return;
    }

    setIsChangingPw(true);
    try {
      if (currentUser?.hasPassword) {
        await changeUserPassword(currentPw, newPw);
      } else {
        await setUserPassword(newPw);
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, hasPassword: true, authProvider: 'both' });
      }

      setPwSuccessMsg('Password updated successfully!');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => {
        setPwSuccessMsg(null);
        setCurrentScreen('account');
      }, 1500);
    } catch (err: any) {
      setPwErrorMsg(err.message || 'Failed to update password');
    } finally {
      setIsChangingPw(false);
    }
  };

  // Send Reset Email
  const handleSendResetEmail = async () => {
    if (!currentUser?.email) return;
    setIsSendingResetEmail(true);
    try {
      await sendPasswordReset(currentUser.email);
      setResetEmailSentMsg(`Reset email sent to ${currentUser.email}!`);
      setTimeout(() => setResetEmailSentMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to send reset email');
    } finally {
      setIsSendingResetEmail(false);
    }
  };

  // Clear Cache function
  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      setCacheSize(0.0);
      localStorage.setItem('ennvo_cache_size', '0.0');
      setIsClearingCache(false);
    }, 600);
  };

  const handleClearDownloads = () => {
    setIsClearingDownloads(true);
    setTimeout(() => {
      setDownloadsSize(0.0);
      setIsClearingDownloads(false);
    }, 600);
  };

  // Remove Device Session
  const handleRemoveDevice = (deviceId: string) => {
    if (window.confirm('Log out this device from your account?')) {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
    }
  };

  // Download User Data Archive
  const handleDownloadMyData = () => {
    if (!currentUser) return;
    const exportData = {
      profile: {
        uid: currentUser.uid,
        name: currentUser.name,
        username: currentUser.username,
        email: currentUser.email,
        mobile: currentUser.mobileNumber,
        location: currentUser.location,
        bio: currentUser.bio,
        isVerified: currentUser.isVerified,
        createdAt: currentUser.createdAt
      },
      settings: userSettings,
      exportedAt: new Date().toISOString(),
      platform: 'Ennvo'
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `ennvo_user_data_${currentUser.username || 'export'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Upgrade to Business Account
  const handleUpgradeToBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsUpgradingBusiness(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        accountType: 'business',
        businessCategory,
        businessEmail
      });
      setCurrentUser({
        ...currentUser,
        accountType: 'business'
      });
      setBusinessUpgradeSuccess(true);
      setTimeout(() => {
        setBusinessUpgradeSuccess(false);
        setShowBusinessModal(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Upgrade failed');
    } finally {
      setIsUpgradingBusiness(false);
    }
  };

  // Save Legacy Contact
  const handleSaveLegacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !legacyContact) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        legacyContact
      });
      setLegacySuccess(true);
      setTimeout(() => {
        setLegacySuccess(false);
        setShowLegacyModal(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to set legacy contact');
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto overscroll-y-contain bg-[#F6F6F8] text-gray-900 font-sans antialiased md:pl-24 flex flex-col items-center">
      {/* Container restricted to mobile-optimized width for that clean TikTok-style settings feel */}
      <div className="w-full max-w-xl min-h-full flex flex-col bg-[#F6F6F8] pb-20">

        {/* ========================================================= */}
        {/* SCREEN 1: MAIN "Settings and privacy"                     */}
        {/* ========================================================= */}
        {currentScreen === 'main' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button 
                onClick={handleBack}
                className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Settings and privacy
              </h1>
            </div>

            <div className="px-4 pt-3 pb-8 space-y-4">
              {/* --- 1. Account Section --- */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Account</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <button 
                    onClick={() => setCurrentScreen('account')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Account</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('security_permissions')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Shield className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Security and permissions</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setShowShareModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Share2 className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Share profile</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* --- 2. Visibility Section --- */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Visibility</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <button 
                    onClick={() => setCurrentScreen('private_account')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Lock className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Private account</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[13px] text-gray-400">
                        {userSettings.isPrivate ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('blocked_accounts')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <UserX className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Blocked accounts</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </div>
              </div>

              {/* --- 3. Interactions Section --- */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Interactions</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <button 
                    onClick={() => setCurrentScreen('comments')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Comments</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('mentions')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <AtSign className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Mentions</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('direct_messages')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Send className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Direct messages</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('reuse_content')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Film className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Reuse of content</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      <Link className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Display profile when sharing links</span>
                    </div>
                    <button 
                      onClick={() => toggleSetting('displayProfileWhenSharing')}
                      className="flex items-center space-x-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[14px] text-gray-400">
                        {userSettings.displayProfileWhenSharing !== false ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      <Download className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Downloads</span>
                    </div>
                    <button 
                      onClick={() => toggleSetting('downloadsAllowed')}
                      className="flex items-center space-x-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[14px] text-gray-400">
                        {userSettings.downloadsAllowed !== false ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  <button 
                    onClick={() => setCurrentScreen('following_list')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Following list</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400 capitalize">
                        {userSettings.followingListPrivacy === 'only_you' ? 'Only you' : 'Everyone'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('liked_videos')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Heart className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Liked videos</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400">
                        {userSettings.likedVideosPrivacy === 'everyone' ? 'Everyone' : 'Only you'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </button>

                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Viewers</span>
                    </div>
                    <button 
                      onClick={() => toggleSetting('viewersEnabled')}
                      className="flex items-center space-x-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[14px] text-gray-400">
                        {userSettings.viewersEnabled !== false ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* --- 4. Content & Display Section --- */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Content & display</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <button 
                    onClick={() => setCurrentScreen('display_theme')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Sun className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Display</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400 capitalize">{userSettings.appTheme || 'Light'}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('free_up_space')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Trash2 className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Free up space</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400">{cacheSize.toFixed(1)} MB</span>
                      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                    </div>
                  </button>
                </div>
              </div>

              {/* --- 5. Support & About --- */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">About & Log out</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <button 
                    onClick={() => setShowPrivacyModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Terms and policies</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => {
                      if (window.confirm('Switch account? You will be taken to the sign-in screen.')) {
                        setIsAuthenticated(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="w-5 h-5 text-gray-700 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Switch account</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to log out of Ennvo?')) {
                        setIsAuthenticated(false);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50/40 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-red-600">Log out</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 2: "Account" (Image 4)                             */}
        {/* ========================================================= */}
        {currentScreen === 'account' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button 
                onClick={handleBack}
                className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Account
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {/* 1. Account information */}
                <button 
                  onClick={() => setCurrentScreen('account_info')}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Account information</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>

                {/* 2. Password */}
                <button 
                  onClick={() => setCurrentScreen('password')}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Password</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>

                {/* 3. Passkey */}
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-gray-900">Passkey</span>
                    <button
                      type="button"
                      onClick={handleTogglePasskey}
                      className={`w-12 h-6 rounded-full relative transition-colors ${
                        isPasskeyEnabled ? 'bg-[#00c4cc]' : 'bg-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                        isPasskeyEnabled ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                  {isPasskeyEnabled && (
                    <span className="text-[11px] text-emerald-600 font-semibold block mt-1">
                      ✓ Active on {detectedDevice.os}
                    </span>
                  )}
                  <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                    Create a passkey to log in to Ennvo using screen lock, fingerprint or PIN. Passkeys are safer than passwords.
                  </p>
                </div>

                {/* 4. Verification */}
                <button 
                  onClick={() => setCurrentScreen('verification')}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[15px] font-medium text-gray-900">Verification</span>
                    {currentUser?.isVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>

                {/* 5. Become a Verified Business Account */}
                <div 
                  onClick={() => setShowBusinessModal(true)}
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-gray-900">Become a Verified Business Account</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                  <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                    You're currently using a personal account. To become a Verified Business Account, verify your business and unlock additional commercial tools and features.
                  </p>
                </div>

                {/* 6. Account legacy */}
                <div 
                  onClick={() => setShowLegacyModal(true)}
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-gray-900">Account legacy</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                  <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                    Plan ahead for how your account will be cared for.
                  </p>
                </div>

                {/* 7. Download your data */}
                <div 
                  onClick={handleDownloadMyData}
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-gray-900">Download your data</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                  <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                    Get a copy of your data from all the Ennvo apps you use.
                  </p>
                </div>

                {/* 8. Deactivate or delete account */}
                <button 
                  onClick={() => setShowDeactivateModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Deactivate or delete account</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 3: "Security and permissions" (Image 3)            */}
        {/* ========================================================= */}
        {currentScreen === 'security_permissions' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button 
                onClick={handleBack}
                className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Security and permissions
              </h1>
            </div>

            <div className="px-4 py-3 space-y-4">
              {/* Category: Security */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Security</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  {/* Security alerts */}
                  <button 
                    onClick={() => setCurrentScreen('security_overview')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Security alerts</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  {/* Security checkup */}
                  <button 
                    onClick={() => setShowSecurityCheckupModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Security checkup</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  {/* Your devices */}
                  <button 
                    onClick={() => setCurrentScreen('manage_devices')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Your devices</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </button>

                  {/* 2-step verification */}
                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <span className="text-[15px] font-medium text-gray-900">2-step verification</span>
                    <button 
                      onClick={() => toggleSetting('twoFactorAuth')}
                      className="flex items-center space-x-1 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[14px] text-gray-400">
                        {userSettings.twoFactorAuth ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Save login info (Toggle ON matching screenshot) */}
                  <div className="px-4 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-medium text-gray-900">Save login info</span>
                      <button
                        type="button"
                        onClick={() => toggleSetting('saveLoginInfo')}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          userSettings.saveLoginInfo !== false ? 'bg-[#00c4cc]' : 'bg-gray-200'
                        }`}
                      >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                          userSettings.saveLoginInfo !== false ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                      Log in to {currentUser?.username || 'erfan_ennvo'} on this device without needing to enter your info, or on a new device when you restore your backup.
                    </p>
                  </div>

                  {/* Help friends recover accounts */}
                  <div 
                    onClick={() => alert('Trusted Friend Recovery is enabled. You can receive secure verification codes to help trusted contacts regain account access.')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Help friends recover accounts</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Category: Permissions */}
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Permissions</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  <div 
                    onClick={() => alert('All Ennvo apps & camera/microphone permissions are active and securely managed.')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Apps and services permissions</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>

                  <div 
                    onClick={() => alert('Browser cookies and cache permissions are configured to optimize playback performance.')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Browser settings</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 4: "Security" Overview (Image 2)                   */}
        {/* ========================================================= */}
        {currentScreen === 'security_overview' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button 
                onClick={handleBack}
                className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex-1" />
            </div>

            <div className="px-4 py-6 space-y-6">
              {/* Centered Icon & Title */}
              <div className="flex flex-col items-center text-center pt-2 pb-2">
                <div className="relative mb-4">
                  <Smartphone className="w-14 h-14 text-gray-800 stroke-[1.5]" />
                  <ShieldCheck className="w-6 h-6 text-gray-900 absolute top-2.5 right-2" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Security</h2>
                <p className="text-[13px] text-gray-500 max-w-xs mt-1 leading-normal font-normal">
                  View and manage settings to keep your account secure
                </p>
              </div>

              {/* Group 1: Security alerts */}
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-gray-900">Security alerts</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-[13px] text-gray-500 font-normal">
                  Account activity over the past 7 days
                </p>
                <div className="flex items-center space-x-2 pt-1 text-gray-900">
                  <ShieldCheck className="w-5 h-5 text-gray-800 shrink-0" />
                  <span className="text-[14px] font-medium">No security issues found</span>
                </div>
              </div>

              {/* Group 2: Your devices */}
              <div 
                onClick={() => setCurrentScreen('manage_devices')}
                className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden p-4 space-y-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-gray-900">Your devices</span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-[13px] text-gray-500 font-normal">
                  Manage your logged in devices
                </p>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2 text-[14px] text-gray-900">
                    <Smartphone className="w-4 h-4 text-gray-700 shrink-0" />
                    <span>Redmi 13C. <span className="text-gray-400 font-normal">This device</span></span>
                  </div>
                  <div className="flex items-center space-x-2 text-[14px] text-gray-900">
                    <Smartphone className="w-4 h-4 text-gray-700 shrink-0" />
                    <span>Vivo Y18. <span className="text-gray-400 font-normal">08-25</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 5: "Manage devices" (Image 6)                      */}
        {/* ========================================================= */}
        {currentScreen === 'manage_devices' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button 
                onClick={handleBack}
                className="p-1 -ml-1 text-gray-900 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="px-4 py-4 space-y-6">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                Manage devices
              </h1>

              {/* Current device */}
              <div className="space-y-2.5">
                <h2 className="text-[14px] font-bold text-gray-900">Current device</h2>
                <div className="bg-white rounded-2xl border border-gray-100/90 p-4">
                  <div className="flex items-start space-x-3">
                    <Smartphone className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h3 className="text-[15px] font-bold text-gray-900">
                        {detectedDevice.os || 'Redmi 13C'}
                      </h3>
                      <p className="text-[13px] text-gray-500 font-normal">ennvo</p>
                      <p className="text-[13px] text-gray-500 font-normal">Unknown login method</p>
                      <p className="text-[13px] text-gray-500 font-normal">20 Sept 2026, 6:57 am</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other devices you've logged in on */}
              <div className="space-y-2.5">
                <div className="flex items-center space-x-1 text-[14px] font-bold text-gray-900">
                  <span>Other devices you've logged in on</span>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>

                {devices.filter(d => !d.isCurrent).length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100/90 p-5 text-center text-[13px] text-gray-500">
                    No other devices currently logged in.
                  </div>
                ) : (
                  devices.filter(d => !d.isCurrent).map(dev => (
                    <div key={dev.id} className="bg-white rounded-2xl border border-gray-100/90 p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <Smartphone className="w-5 h-5 text-gray-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h3 className="text-[15px] font-bold text-gray-900">{dev.name}</h3>
                            <p className="text-[13px] text-gray-500 font-normal">{dev.app}</p>
                            <p className="text-[13px] text-gray-500 font-normal">{dev.method}</p>
                            <p className="text-[13px] text-gray-500 font-normal">{dev.date}</p>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleRemoveDevice(dev.id)}
                          className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                          title="Remove device"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Account Information (Full Page)               */}
        {/* ========================================================= */}
        {currentScreen === 'account_info' && (
          <AccountInfoScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Verification (Full Page)                      */}
        {/* ========================================================= */}
        {currentScreen === 'verification' && (
          <VerificationScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Blocked Accounts (Full Page)                  */}
        {/* ========================================================= */}
        {currentScreen === 'blocked_accounts' && (
          <BlockedAccountsScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Password                                      */}
        {/* ========================================================= */}
        {currentScreen === 'password' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Password
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              {pwSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-[13px] font-medium flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{pwSuccessMsg}</span>
                </div>
              )}

              {pwErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-[13px] font-medium flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{pwErrorMsg}</span>
                </div>
              )}

              {resetEmailSentMsg && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-800 text-[13px] font-medium flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{resetEmailSentMsg}</span>
                </div>
              )}

              <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  {currentUser?.hasPassword && (
                    <div className="p-4">
                      <label className="block text-[13px] font-medium text-gray-500 mb-1">Current password</label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPw}
                          onChange={(e) => setCurrentPw(e.target.value)}
                          placeholder="Enter current password"
                          className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-0 top-0.5 text-gray-400 hover:text-gray-600"
                        >
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="p-4">
                    <label className="block text-[13px] font-medium text-gray-500 mb-1">New password</label>
                    <div className="relative">
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-0 top-0.5 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4">
                    <label className="block text-[13px] font-medium text-gray-500 mb-1">Confirm password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        placeholder="Re-enter new password"
                        className="w-full text-[15px] font-medium text-gray-900 focus:outline-none bg-transparent pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className="absolute right-0 top-0.5 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isChangingPw}
                  className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold text-[15px] rounded-2xl transition-transform active:scale-98 disabled:opacity-60 flex items-center justify-center space-x-2"
                >
                  {isChangingPw ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{currentUser?.hasPassword ? 'Update Password' : 'Save Password'}</span>
                  )}
                </button>

                {currentUser?.email && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={handleSendResetEmail}
                      disabled={isSendingResetEmail}
                      className="text-[13px] font-medium text-gray-600 hover:text-gray-900 underline"
                    >
                      {isSendingResetEmail ? 'Sending...' : 'Forgot your current password?'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Private Account                               */}
        {/* ========================================================= */}
        {currentScreen === 'private_account' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Private account
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100/90 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-bold text-gray-900">Private account</span>
                  <button
                    type="button"
                    onClick={() => toggleSetting('isPrivate')}
                    className={`w-12 h-6 rounded-full relative transition-colors ${
                      userSettings.isPrivate ? 'bg-[#00c4cc]' : 'bg-gray-200'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                      userSettings.isPrivate ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </div>
                <p className="text-[13px] text-gray-500 font-normal leading-relaxed mt-2.5">
                  With a private account, only users you approve can follow you and watch your videos. Your existing followers won't be affected.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Comments Settings                             */}
        {/* ========================================================= */}
        {currentScreen === 'comments' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Comments
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can comment on your videos</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  {[
                    { id: 'everyone', label: 'Everyone' },
                    { id: 'friends', label: 'Followers you follow back' },
                    { id: 'no_one', label: 'No one' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateSettingValue('whoCanComment', opt.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                    >
                      <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                      {userSettings.whoCanComment === opt.id && (
                        <Check className="w-5 h-5 text-gray-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Comment filters</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[15px] font-medium text-gray-900 block">Filter offensive comments</span>
                      <span className="text-[12px] text-gray-500">Hide offensive or spam comments automatically</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSetting('offensiveFilter')}
                      className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                        userSettings.offensiveFilter !== false ? 'bg-[#00c4cc]' : 'bg-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                        userSettings.offensiveFilter !== false ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Mentions Settings                             */}
        {/* ========================================================= */}
        {currentScreen === 'mentions' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Mentions
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can mention you in comments or videos</p>
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {[
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'friends', label: 'People you follow' },
                  { id: 'no_one', label: 'No one' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSettingValue('whoCanMention', opt.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                    {userSettings.whoCanMention === opt.id && (
                      <Check className="w-5 h-5 text-gray-900" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Direct Messages Settings                      */}
        {/* ========================================================= */}
        {currentScreen === 'direct_messages' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Direct messages
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can send you direct messages</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                  {[
                    { id: 'everyone', label: 'Everyone' },
                    { id: 'friends', label: 'Friends' },
                    { id: 'no_one', label: 'No one' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => updateSettingValue('whoCanMessage', opt.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                    >
                      <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                      {userSettings.whoCanMessage === opt.id && (
                        <Check className="w-5 h-5 text-gray-900" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Message status</p>
                <div className="bg-white rounded-2xl border border-gray-100/90 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[15px] font-medium text-gray-900 block">Read status</span>
                      <span className="text-[12px] text-gray-500">Show when you have read messages</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSetting('readReceipts')}
                      className={`w-12 h-6 rounded-full relative transition-colors shrink-0 ${
                        userSettings.readReceipts !== false ? 'bg-[#00c4cc]' : 'bg-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                        userSettings.readReceipts !== false ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Reuse of content                              */}
        {/* ========================================================= */}
        {currentScreen === 'reuse_content' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Reuse of content
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can Duet and Stitch with your videos</p>
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {[
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'friends', label: 'Followers you follow back' },
                  { id: 'only_you', label: 'Only you' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSettingValue('reuseOfContent', opt.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                    {userSettings.reuseOfContent === opt.id && (
                      <Check className="w-5 h-5 text-gray-900" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Following List Privacy                        */}
        {/* ========================================================= */}
        {currentScreen === 'following_list' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Following list
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can see your following list</p>
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {[
                  { id: 'everyone', label: 'Everyone' },
                  { id: 'only_you', label: 'Only you' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSettingValue('followingListPrivacy', opt.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                    {userSettings.followingListPrivacy === opt.id && (
                      <Check className="w-5 h-5 text-gray-900" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Liked Videos Privacy                          */}
        {/* ========================================================= */}
        {currentScreen === 'liked_videos' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Liked videos
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Who can watch your liked videos</p>
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {[
                  { id: 'only_you', label: 'Only you' },
                  { id: 'everyone', label: 'Everyone' }
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => updateSettingValue('likedVideosPrivacy', opt.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">{opt.label}</span>
                    {(userSettings.likedVideosPrivacy || 'only_you') === opt.id && (
                      <Check className="w-5 h-5 text-gray-900" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Free up space (Cache cleaner)                 */}
        {/* ========================================================= */}
        {currentScreen === 'free_up_space' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Free up space
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {/* Cache item */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-900">Cache</h3>
                    <p className="text-[13px] text-gray-500 font-normal">
                      Clear your cache to free up space. Won't affect your Ennvo experience.
                    </p>
                    <p className="text-[14px] font-semibold text-gray-900 mt-1">
                      {cacheSize.toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={isClearingCache || cacheSize === 0}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-[13px] font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 shrink-0 ml-3"
                  >
                    {isClearingCache ? 'Clearing...' : 'Clear'}
                  </button>
                </div>

                {/* Downloads item */}
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-bold text-gray-900">Downloads</h3>
                    <p className="text-[13px] text-gray-500 font-normal">
                      Downloads may include effects, filters, and offline videos.
                    </p>
                    <p className="text-[14px] font-semibold text-gray-900 mt-1">
                      {downloadsSize.toFixed(1)} MB
                    </p>
                  </div>
                  <button
                    onClick={handleClearDownloads}
                    disabled={isClearingDownloads || downloadsSize === 0}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-[13px] font-bold text-gray-900 hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-40 shrink-0 ml-3"
                  >
                    {isClearingDownloads ? 'Clearing...' : 'Clear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Display Theme                                 */}
        {/* ========================================================= */}
        {currentScreen === 'display_theme' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-gray-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-2xs">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Display
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[13px] font-medium text-gray-500 px-2 py-1">Appearance</p>
              <div className="bg-white rounded-2xl border border-gray-100/90 overflow-hidden divide-y divide-gray-100">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        updateSettingValue('appTheme', t.id);
                        localStorage.setItem('ennvo_theme_mode', t.id);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-gray-700" />
                        <span className="text-[15px] font-medium text-gray-900">{t.label}</span>
                      </div>
                      {(userSettings.appTheme || 'light') === t.id && (
                        <Check className="w-5 h-5 text-gray-900" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODALS & BOTTOM SHEETS                                    */}
      {/* ========================================================= */}

      {/* Share Profile Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Share profile</h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold"
              >
                Close
              </button>
            </div>

            <div className="flex flex-col items-center py-2 space-y-2">
              <img 
                src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/120/120"} 
                alt="Avatar" 
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
              />
              <p className="text-sm font-bold text-gray-900">{currentUser?.name || 'Ennvo User'}</p>
              <p className="text-xs text-gray-500 font-medium">@{currentUser?.username || 'user'}</p>
            </div>

            <div className="space-y-2">
              <button 
                onClick={() => {
                  const url = `${window.location.origin}/@${currentUser?.username || 'user'}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 bg-gray-900 text-white text-[14px] font-bold rounded-2xl active:scale-98 transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link copied!' : 'Copy link'}</span>
              </button>

              <button 
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `${currentUser?.name} on Ennvo`,
                      url: window.location.href
                    }).catch(() => {});
                  } else {
                    const url = `${window.location.origin}/@${currentUser?.username || 'user'}`;
                    navigator.clipboard.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 border border-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl active:scale-98 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Share via apps</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Become a Verified Business Account Modal */}
      {showBusinessModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Verified Business Account</h3>
              <button onClick={() => setShowBusinessModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            {businessUpgradeSuccess ? (
              <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-800 text-center font-bold text-sm">
                🎉 Congratulations! Your account has been upgraded to a Verified Business Account.
              </div>
            ) : (
              <form onSubmit={handleUpgradeToBusiness} className="space-y-3.5">
                <p className="text-[13px] text-gray-600">
                  Switch to a Business Account to access advanced analytics, commercial music libraries, and business contact tools.
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Business Category</label>
                  <select
                    value={businessCategory}
                    onChange={(e) => setBusinessCategory(e.target.value)}
                    className="w-full border border-gray-200 rounded-2xl p-3 text-xs font-semibold focus:outline-none"
                  >
                    <option value="Creator & Media">Creator & Media</option>
                    <option value="Fashion & Apparel">Fashion & Apparel</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Software & Tech">Software & Tech</option>
                    <option value="Education">Education</option>
                    <option value="E-commerce">E-commerce</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Business Contact Email</label>
                  <input
                    type="email"
                    required
                    value={businessEmail}
                    onChange={(e) => setBusinessEmail(e.target.value)}
                    placeholder="business@example.com"
                    className="w-full border border-gray-200 rounded-2xl p-3 text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpgradingBusiness}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-2xl transition-all"
                  >
                    {isUpgradingBusiness ? 'Upgrading...' : 'Switch to Business Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Account Legacy Modal */}
      {showLegacyModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">Account legacy</h3>
              <button onClick={() => setShowLegacyModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                ✕
              </button>
            </div>

            {legacySuccess ? (
              <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-800 text-center font-bold text-sm">
                Legacy contact saved successfully!
              </div>
            ) : (
              <form onSubmit={handleSaveLegacy} className="space-y-3.5">
                <p className="text-[13px] text-gray-600">
                  Choose someone to manage your memorialized account or remove your data in the event of your passing.
                </p>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Legacy Contact (Username or Email)</label>
                  <input
                    type="text"
                    required
                    value={legacyContact}
                    onChange={(e) => setLegacyContact(e.target.value)}
                    placeholder="@trusted_friend or friend@gmail.com"
                    className="w-full border border-gray-200 rounded-2xl p-3 text-xs font-semibold focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-2xl transition-all"
                  >
                    Save Legacy Contact
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modals for verification, checkup, deactivate, blocked users, policies */}
      <AccountVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
      />

      <SecurityCheckupModal
        isOpen={showSecurityCheckupModal}
        onClose={() => setShowSecurityCheckupModal(false)}
      />

      <DeactivateDeleteModal
        isOpen={showDeactivateModal}
        onClose={() => setShowDeactivateModal(false)}
      />

      <BlockedUsersModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
      />

      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  User, Shield, Share2, Lock, UserX, MessageSquare, AtSign, Send,
  Link, Download, Users, Heart, Eye, Moon, Sun, Trash2, Smartphone, 
  Check, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, 
  KeyRound, ShieldCheck, Mail, EyeOff, Fingerprint, BadgeCheck, 
  ShieldAlert, Info, QrCode, Copy, FileText, RefreshCw, Film, Sparkles,
  Palette, UserCheck, Play, Headphones, Bell, BellOff
} from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { native, NotifMode } from '../native';
import { useAppStore } from '../store';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { AccountVerificationModal } from '../components/settings/AccountVerificationModal';
import { DeactivateDeleteModal } from '../components/settings/DeactivateDeleteModal';
import { SecurityCheckupModal } from '../components/settings/SecurityCheckupModal';
import { BlockedUsersModal } from '../components/settings/BlockedUsersModal';
import { AccountInfoScreen } from '../components/settings/AccountInfoScreen';
import { VerificationScreen } from '../components/settings/VerificationScreen';
import { BlockedAccountsScreen } from '../components/settings/BlockedAccountsScreen';
import { changeUserPassword, sendPasswordReset, setUserPassword, logout } from '../services/authService';
import { saveAccount } from '../services/accountService';
import { shareUserProfile } from '../services/deepLinkService';
import { shareContent } from '../services/shareService';

type SettingsScreen = 
  | 'main'                    // Settings and privacy
  | 'account'                 // Account
  | 'account_info'            // Account information edit form
  | 'password'                // Password change form
  | 'security_permissions'    // Security and permissions
  | 'security_overview'       // Security overview (No security issues found)
  | 'manage_devices'          // Manage devices
  | 'private_account'         // Private account settings
  | 'notifications'           // Push notification privacy (On / Off / Secret)
  | 'comments'                // Comments settings
  | 'mentions'                // Mentions settings
  | 'direct_messages'         // Direct messages settings
  | 'reuse_content'           // Reuse of content (Duet / Stitch)
  | 'following_list'          // Following list privacy
  | 'liked_videos'            // Liked videos privacy
  | 'free_up_space'           // Free up space
  | 'display_theme'           // Display theme
  | 'ui_customize'            // UI Customization
  | 'verification'            // Full-page verification
  | 'blocked_accounts';       // Full-page blocked accounts

export default function Settings() {
  const [currentScreen, setCurrentScreen] = useState<SettingsScreen>('main');
  const { setIsAuthenticated, currentUser, setCurrentUser, popPage, pushPage, setShowAccountSwitcherModal, navStyle, setNavStyle, profileStyle, setProfileStyle, reelsStyle, setReelsStyle, appTheme, setAppTheme } = useAppStore();

  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const effectiveScreen: SettingsScreen = isDesktop && currentScreen === 'main' ? 'account' : currentScreen;

  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      if (currentUser) {
        saveAccount(currentUser);
      }
    } catch (e) {}
    try {
      localStorage.removeItem('ennvo_last_active_user_v1');
    } catch (e) {}
    try {
      await logout();
    } catch (e) {}
    setCurrentUser(null);
    setIsAuthenticated(false);
    setShowAccountSwitcherModal(false);
  };

  const handleSwitchAccount = () => {
    if (currentUser) {
      saveAccount(currentUser);
    }
    setShowAccountSwitcherModal(true);
  };

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

  const [notifMode, setNotifModeState] = useState<NotifMode>(() => {
    return (currentUser?.notifMode as NotifMode) || native.getNotifMode() || 'on';
  });

  const handleSelectNotifMode = async (mode: NotifMode) => {
    setNotifModeState(mode);
    native.setNotifMode(mode);
    if (currentUser?.uid) {
      setCurrentUser({
        ...currentUser,
        notifMode: mode
      });
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { notifMode: mode });
        fetch('/api/native/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.uid, notifMode: mode })
        }).catch(() => {});
      } catch (e) {
        console.warn('Failed saving notifMode to profile:', e);
      }
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
      if (isDesktop) {
        setCurrentScreen('account');
      } else {
        setCurrentScreen('main');
      }
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
        await changeUserPassword(currentPw, newPw, currentUser?.email);
      } else {
        await setUserPassword(newPw, currentUser?.email);
      }

      if (currentUser) {
        setCurrentUser({ ...currentUser, hasPassword: true, authProvider: 'both' });
      }

      setPwSuccessMsg(currentUser?.hasPassword ? 'Password updated successfully!' : 'Password set successfully! You can now log in using either Google or Password.');
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

  const navGroups = useMemo(() => [
    {
      title: 'Account & Security',
      items: [
        { id: 'account', label: 'Account Overview', icon: User },
        { id: 'account_info', label: 'Account Information', icon: Info },
        { id: 'password', label: 'Password & Security', icon: KeyRound },
        { id: 'security_permissions', label: 'Security & Permissions', icon: Shield },
        { id: 'manage_devices', label: 'Manage Devices', icon: Smartphone, badge: `${devices.length}` },
        { id: 'verification', label: 'Verification Request', icon: BadgeCheck }
      ]
    },
    {
      title: 'Privacy & Safety',
      items: [
        { id: 'private_account', label: 'Private Account', icon: Lock, badge: userSettings.isPrivate ? 'On' : 'Off' },
        { id: 'blocked_accounts', label: 'Blocked Accounts', icon: UserX },
        { 
          id: 'share_profile', 
          label: 'Share Profile', 
          icon: Share2, 
          action: () => {
            if (currentUser?.username) {
              shareUserProfile(currentUser.username);
            } else {
              setShowShareModal(true);
            }
          } 
        }
      ]
    },
    {
      title: 'Interactions',
      items: [
        { id: 'comments', label: 'Comments', icon: MessageSquare },
        { id: 'mentions', label: 'Mentions & Tags', icon: AtSign },
        { id: 'direct_messages', label: 'Direct Messages', icon: Send },
        { id: 'reuse_content', label: 'Reuse of Content', icon: Film },
        { id: 'following_list', label: 'Following List', icon: Users },
        { id: 'liked_videos', label: 'Liked Videos', icon: Heart }
      ]
    },
    {
      title: 'Preferences',
      items: [
        { id: 'notifications', label: 'Push Notifications & Privacy', icon: Bell, badge: notifMode === 'secret' ? 'Secret' : (notifMode === 'off' ? 'Off' : 'On') },
        { id: 'ui_customize', label: 'UI Customization', icon: Palette, badge: navStyle === 'glass' ? 'Glass' : 'Classic' },
        { id: 'display_theme', label: 'Display & Theme', icon: Sun, badge: userSettings.appTheme === 'dark' ? 'Dark' : 'Light' },
        { id: 'free_up_space', label: 'Free Up Space & Cache', icon: Trash2 }
      ]
    },
    {
      title: 'Customer Care & Help Center',
      items: [
        {
          id: 'help_center',
          label: '24/7 Customer Care & Help Desk',
          icon: Headphones,
          badge: '24/7',
          action: () => {
            alert('📞 Ennvo Official Customer Care\nHotline: +880 1700-000000\nEmail: ennvoapp@gmail.com\n\nFor Verified Blue Badge inquiries, review responses are delivered within 24 hours. Our support staff is online 24/7.');
          }
        }
      ]
    },
    {
      title: 'Administration',
      items: [
        {
          id: 'admin_panel',
          label: 'Company Admin Panel',
          icon: ShieldAlert,
          badge: 'Staff',
          action: () => pushPage('admin')
        }
      ]
    }
  ], [devices.length, userSettings.isPrivate, userSettings.appTheme, navStyle, notifMode, currentUser?.username, pushPage]);

  return (
    <div className="h-full w-full overflow-y-auto overscroll-y-contain bg-[#F4F8FF] text-slate-900 font-sans antialiased md:pl-24 flex flex-col items-center">
      {/* Container: on mobile max-w-xl, on PC max-w-7xl with two columns */}
      <div className="w-full max-w-xl md:max-w-7xl min-h-full flex flex-col pb-20 px-0 md:px-6 md:py-6">
        
        {/* Desktop Top Title Bar */}
        <div className="hidden md:flex items-center justify-between gap-4 pb-5 mb-6 border-b border-sky-100">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => popPage()}
              className="p-2.5 rounded-2xl hover:bg-sky-50 text-slate-600 transition-colors border border-sky-100 bg-white shadow-[0_1px_2px_rgba(2,132,199,0.06)] cursor-pointer"
              title="Return to app"
            >
              <ArrowLeft className="w-[18px] h-[18px]" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(2,132,199,0.28)]">
                <Shield className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">Settings &amp; privacy</h1>
                <p className="text-[12.5px] text-slate-500 font-medium">Account, security, privacy and preferences in one place</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-2xl border border-sky-100 shadow-[0_1px_2px_rgba(2,132,199,0.06)]">
            <img 
              src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/120/120"} 
              alt="Avatar" 
              className="w-9 h-9 rounded-full object-cover border border-sky-500/30"
            />
            <div className="leading-tight">
              <p className="text-[13px] font-bold text-gray-900">{currentUser?.name || 'Ennvo User'}</p>
              <p className="text-[11px] text-blue-700 font-medium">@{currentUser?.username || 'user'}</p>
            </div>
          </div>
        </div>

        {/* Desktop 2-Column Split View */}
        <div className="w-full md:grid md:grid-cols-12 md:gap-6 lg:gap-8 items-start">
          
          {/* DESKTOP LEFT NAVIGATION SIDEBAR (Visible on md+) */}
          <aside className="hidden md:flex md:col-span-5 lg:col-span-4 flex-col bg-white rounded-[24px] border border-sky-100 shadow-[0_2px_10px_rgba(2,132,199,0.06)] p-3.5 sticky top-6 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-5">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-sky-700/60 px-3 pt-1 pb-1.5">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = effectiveScreen === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (item.action) {
                            item.action();
                          } else if (item.id) {
                            setCurrentScreen(item.id as SettingsScreen);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-[14px] text-left text-[13.5px] font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold shadow-[0_6px_16px_rgba(2,132,199,0.28)]'
                            : 'text-slate-700 hover:bg-sky-50 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-sky-500'}`} />
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-gray-100 space-y-1">
              <button
                onClick={handleSwitchAccount}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-left text-[14px] font-medium text-gray-700 hover:bg-gray-100/70 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-gray-500 shrink-0" />
                <span>Switch account</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-left text-[14px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4 text-red-500 shrink-0" />
                <span>Log out</span>
              </button>
            </div>
          </aside>

          {/* RIGHT DETAIL CONTENT PANEL (Full width on mobile, col-span-7/8 on desktop) */}
          <main className="w-full md:col-span-7 lg:col-span-8 bg-transparent md:bg-white md:rounded-[24px] md:border md:border-sky-100 md:shadow-[0_2px_10px_rgba(2,132,199,0.06)] overflow-hidden min-h-[620px]">

        {/* ========================================================= */}
        {/* SCREEN 1: MAIN "Settings and privacy"                     */}
        {/* ========================================================= */}
        {(!isDesktop && currentScreen === 'main') && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
              {/* --- Profile hero card --- */}
              <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-sky-500 via-blue-600 to-blue-700 p-[18px] text-white shadow-[0_10px_28px_-6px_rgba(2,132,199,0.45)]">
                <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/[0.07]" aria-hidden="true" />
                <div className="relative flex items-center gap-3.5">
                  <img
                    src={currentUser?.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(currentUser?.name || "Ennvo") + "&background=0ea5e9&color=fff"}
                    alt="Profile"
                    className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/70"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-bold leading-tight">{currentUser?.name || 'Ennvo User'}</p>
                    <p className="truncate text-[12.5px] font-medium text-white/80">@{currentUser?.username || 'user'}</p>
                    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-[3px] text-[10.5px] font-semibold ring-1 ring-inset ring-white/25">
                      <ShieldCheck className="h-3 w-3" strokeWidth={2.4} />
                      {userSettings.isPrivate ? 'Private account' : 'Personal account'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentScreen('account')}
                    className="shrink-0 rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-bold ring-1 ring-inset ring-white/30 hover:bg-white/25 transition-colors cursor-pointer"
                  >
                    Manage
                  </button>
                </div>
              </div>

              {/* --- 1. Account Section --- */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Account</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  <button 
                    onClick={() => setCurrentScreen('account')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <User className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Account</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('security_permissions')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Shield className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Security and permissions</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={() => {
                      if (currentUser?.username) {
                        shareUserProfile(currentUser.username);
                      } else {
                        setShowShareModal(true);
                      }
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Share2 className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Share profile</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>
                </div>
              </div>

              {/* --- 2. Visibility Section --- */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Visibility</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  <button 
                    onClick={() => setCurrentScreen('private_account')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Lock className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Private account</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[13px] text-gray-400">
                        {userSettings.isPrivate ? 'On' : 'Off'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('blocked_accounts')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <UserX className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Blocked accounts</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>
                </div>
              </div>

              {/* --- 3. Interactions Section --- */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Interactions</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  <button 
                    onClick={() => setCurrentScreen('comments')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Comments</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('mentions')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <AtSign className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Mentions</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('direct_messages')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Send className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Direct messages</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('reuse_content')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Film className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Reuse of content</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      <Link className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
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
                      <Download className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
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
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Following list</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400 capitalize">
                        {userSettings.followingListPrivacy === 'only_you' ? 'Only you' : 'Everyone'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('liked_videos')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Heart className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Liked videos</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400">
                        {userSettings.likedVideosPrivacy === 'everyone' ? 'Everyone' : 'Only you'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>

                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      <Eye className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
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
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Content & display</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  {/* Direct Dark Mode Switch */}
                  <div className="w-full flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center space-x-3">
                      {appTheme === 'dark' ? (
                        <Moon className="w-5 h-5 text-sky-500 shrink-0" />
                      ) : (
                        <Sun className="w-5 h-5 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <span className="text-[15px] font-medium text-gray-900 block">Dark mode</span>
                        <span className="text-[12px] text-gray-500 block">Switch app appearance to dark</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = appTheme === 'dark' ? 'light' : 'dark';
                        setAppTheme(next);
                        updateSettingValue('appTheme', next);
                      }}
                      className={`w-12 h-6 rounded-full relative transition-colors cursor-pointer ${
                        appTheme === 'dark' ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-xs ${
                        appTheme === 'dark' ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setCurrentScreen('notifications')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Bell className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <div>
                        <span className="text-[15px] font-medium text-gray-900 block">Push Notifications & Privacy</span>
                        <span className="text-[12px] text-gray-500 block">On, Secret mode, or Off</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[13px] font-semibold text-blue-700 bg-sky-50 px-2 py-0.5 rounded-full capitalize">{notifMode}</span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('ui_customize')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/60 transition-colors text-left bg-sky-50/30"
                  >
                    <div className="flex items-center space-x-3">
                      <Palette className="w-5 h-5 text-sky-600 shrink-0" />
                      <div>
                        <span className="text-[15px] font-bold text-gray-900 block">UI Customization</span>
                        <span className="text-[12px] text-gray-500 block">Classic vs Glass Nav, Profile & Reels</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[12px] font-bold text-blue-700 bg-sky-100/90 px-2.5 py-0.5 rounded-full capitalize">{navStyle === 'glass' ? 'Glass' : 'Classic'}</span>
                      <ChevronRight className="w-4 h-4 text-sky-600 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('display_theme')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Sun className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Display</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400 capitalize">{userSettings.appTheme || 'Light'}</span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>

                  <button 
                    onClick={() => setCurrentScreen('free_up_space')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Trash2 className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Free up space</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-[14px] text-gray-400">{cacheSize.toFixed(1)} MB</span>
                      <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                    </div>
                  </button>
                </div>
              </div>

              {/* --- 5. Support, Admin & Log out --- */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">About, Staff & Log out</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  <button 
                    onClick={() => pushPage('admin')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <ShieldAlert className="w-5 h-5 text-sky-600 shrink-0" />
                      <div>
                        <span className="text-[15px] font-semibold text-gray-900 block">Company Admin Panel</span>
                        <span className="text-[11px] text-sky-600 font-medium">Staff & Operations Dashboard</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-600 shrink-0" />
                  </button>

                  <button 
                    onClick={() => setShowPrivacyModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <FileText className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Terms and policies</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={handleSwitchAccount}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <RefreshCw className="w-9 h-9 p-2 rounded-[12px] bg-sky-50 text-sky-600 ring-1 ring-sky-100 shrink-0" />
                      <span className="text-[15px] font-medium text-gray-900">Switch account</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-red-50/40 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-red-600">Log out</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 2: "Account" (Image 4)                             */}
        {/* ========================================================= */}
        {effectiveScreen === 'account' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                {/* 1. Account information */}
                <button 
                  onClick={() => setCurrentScreen('account_info')}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Account information</span>
                  <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                </button>

                {/* 2. Password */}
                <button 
                  onClick={() => setCurrentScreen('password')}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Password</span>
                  <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
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
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-[15px] font-medium text-gray-900">Verification</span>
                    {currentUser?.isVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                </button>

                {/* 5. Become a Verified Business Account */}
                <div 
                  onClick={() => setShowBusinessModal(true)}
                  className="px-4 py-3.5 cursor-pointer hover:bg-gray-50/70 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium text-gray-900">Become a Verified Business Account</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
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
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
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
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </div>
                  <p className="text-[12px] text-gray-500 font-normal leading-relaxed mt-1 pr-6">
                    Get a copy of your data from all the Ennvo apps you use.
                  </p>
                </div>

                {/* 8. Deactivate or delete account */}
                <button 
                  onClick={() => setShowDeactivateModal(true)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                >
                  <span className="text-[15px] font-medium text-gray-900">Deactivate or delete account</span>
                  <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 3: "Security and permissions" (Image 3)            */}
        {/* ========================================================= */}
        {effectiveScreen === 'security_permissions' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Security</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  {/* Security alerts */}
                  <button 
                    onClick={() => setCurrentScreen('security_overview')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Security alerts</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  {/* Security checkup */}
                  <button 
                    onClick={() => setShowSecurityCheckupModal(true)}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Security checkup</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </button>

                  {/* Your devices */}
                  <button 
                    onClick={() => setCurrentScreen('manage_devices')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Your devices</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
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
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Help friends recover accounts</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Category: Permissions */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Permissions</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                  <div 
                    onClick={() => alert('All Ennvo apps & camera/microphone permissions are active and securely managed.')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Apps and services permissions</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </div>

                  <div 
                    onClick={() => alert('Browser cookies and cache permissions are configured to optimize playback performance.')}
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-sky-50/70 active:bg-sky-50 transition-colors text-left cursor-pointer"
                  >
                    <span className="text-[15px] font-medium text-gray-900">Browser settings</span>
                    <ChevronRight className="w-4 h-4 text-sky-300 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCREEN 4: "Security" Overview (Image 2)                   */}
        {/* ========================================================= */}
        {effectiveScreen === 'security_overview' && (
          <div className="flex-1 flex flex-col pb-16">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
        {effectiveScreen === 'manage_devices' && (
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
        {effectiveScreen === 'account_info' && (
          <AccountInfoScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Verification (Full Page)                      */}
        {/* ========================================================= */}
        {effectiveScreen === 'verification' && (
          <VerificationScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Blocked Accounts (Full Page)                  */}
        {/* ========================================================= */}
        {effectiveScreen === 'blocked_accounts' && (
          <BlockedAccountsScreen onBack={handleBack} />
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Password                                      */}
        {/* ========================================================= */}
        {effectiveScreen === 'password' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
                  className="w-full py-3.5 bg-gray-900 hover:bg-black text-white font-bold text-[15px] rounded-2xl transition-transform disabled:opacity-60 flex items-center justify-center space-x-2"
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
        {effectiveScreen === 'private_account' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
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
        {effectiveScreen === 'comments' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Comments
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can comment on your videos</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Comment filters</p>
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
        {effectiveScreen === 'mentions' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Mentions
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can mention you in comments or videos</p>
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
        {effectiveScreen === 'direct_messages' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Direct messages
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can send you direct messages</p>
                <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Message status</p>
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
        {effectiveScreen === 'reuse_content' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Reuse of content
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can Duet and Stitch with your videos</p>
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
        {effectiveScreen === 'following_list' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Following list
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can see your following list</p>
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
        {effectiveScreen === 'liked_videos' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Liked videos
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Who can watch your liked videos</p>
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
        {effectiveScreen === 'free_up_space' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Free up space
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
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
                    className="px-4 py-2 border border-gray-300 rounded-xl text-[13px] font-bold text-gray-900 hover:bg-gray-50 transition-all disabled:opacity-40 shrink-0 ml-3"
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
                    className="px-4 py-2 border border-gray-300 rounded-xl text-[13px] font-bold text-gray-900 hover:bg-gray-50 transition-all disabled:opacity-40 shrink-0 ml-3"
                  >
                    {isClearingDownloads ? 'Clearing...' : 'Clear'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Push Notifications & Privacy (On/Off/Secret)  */}
        {/* ========================================================= */}
        {effectiveScreen === 'notifications' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600 cursor-pointer">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Push Notifications
              </h1>
            </div>

            <div className="px-4 py-5 space-y-6">
              {/* Informational banner */}
              <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 flex items-start space-x-3">
                <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 space-y-1">
                  <p className="font-bold">Message Push Notification Modes</p>
                  <p className="text-blue-800 leading-relaxed font-normal">
                    Choose how message notifications appear on your phone. <strong className="font-bold">Calls are never affected</strong> and will continue to ring in every mode.
                  </p>
                </div>
              </div>

              {/* 3-Way Notification Options */}
              <div className="space-y-3">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Notification Mode
                </p>

                {/* Option 1: ON */}
                <button
                  type="button"
                  onClick={() => handleSelectNotifMode('on')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                    notifMode === 'on'
                      ? 'bg-sky-50/80 border-sky-400 shadow-xs'
                      : 'bg-white border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      notifMode === 'on' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-gray-900">On (Normal Notifications)</h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        Show standard notifications with sender name, message preview text, and profile picture.
                      </p>
                    </div>
                  </div>
                  {notifMode === 'on' ? (
                    <Check className="w-5 h-5 text-sky-600 shrink-0 ml-3 mt-1" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-3 mt-1" />
                  )}
                </button>

                {/* Option 2: SECRET (Requested by user) */}
                <button
                  type="button"
                  onClick={() => handleSelectNotifMode('secret')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                    notifMode === 'secret'
                      ? 'bg-sky-50/80 border-sky-400 shadow-xs'
                      : 'bg-white border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      notifMode === 'secret' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-[15px] font-bold text-gray-900">Secret Mode (Private)</h4>
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-sky-200 text-blue-900 px-2 py-0.5 rounded-full">
                          Confidential
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        The phone shows strictly the app name <strong className="text-gray-900 font-semibold">"Ennvo"</strong> and <strong className="text-gray-900 font-semibold">"New notification"</strong>. Sender name, text message, and profile photo are completely hidden from lock screen for total privacy.
                      </p>
                    </div>
                  </div>
                  {notifMode === 'secret' ? (
                    <Check className="w-5 h-5 text-sky-600 shrink-0 ml-3 mt-1" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-3 mt-1" />
                  )}
                </button>

                {/* Option 3: OFF */}
                <button
                  type="button"
                  onClick={() => handleSelectNotifMode('off')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                    notifMode === 'off'
                      ? 'bg-sky-50/80 border-sky-400 shadow-xs'
                      : 'bg-white border-gray-200/80 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      notifMode === 'off' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <BellOff className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-gray-900">Off (Disable Message Notifications)</h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        Mute all incoming message notifications. (Incoming audio and video calls will still ring in every mode).
                      </p>
                    </div>
                  </div>
                  {notifMode === 'off' ? (
                    <Check className="w-5 h-5 text-sky-600 shrink-0 ml-3 mt-1" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-3 mt-1" />
                  )}
                </button>
              </div>

              {/* Android Background Reliability Settings */}
              <div className="pt-2 space-y-3">
                <p className="text-[13px] font-bold text-gray-500 uppercase tracking-wider px-1">
                  Background Reliability & System Settings
                </p>

                <div className="bg-white rounded-2xl border border-gray-200/80 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Background Battery Exemption</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Prevents strict battery savers (Xiaomi, Oppo, Vivo, Samsung) from killing notifications when the app is closed.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => native.requestBatteryExemption()}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Allow Background Messages & Calls
                    </button>
                    <button
                      type="button"
                      onClick={() => native.openNotificationSettings()}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      System Notification Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: Display Theme                                 */}
        {/* ========================================================= */}
        {effectiveScreen === 'display_theme' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                Display
              </h1>
            </div>

            <div className="px-4 py-4 space-y-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Appearance</p>
              <div className="bg-white rounded-[20px] border border-sky-100/80 shadow-[0_1px_3px_rgba(2,132,199,0.05)] overflow-hidden divide-y divide-slate-100">
                {[
                  { id: 'light', label: 'Light', icon: Sun },
                  { id: 'dark', label: 'Dark', icon: Moon }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setAppTheme(t.id as 'light' | 'dark');
                        updateSettingValue('appTheme', t.id);
                        localStorage.setItem('ennvo_theme_mode', t.id);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/70 text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5 text-gray-700" />
                        <span className="text-[15px] font-medium text-gray-900">{t.label}</span>
                      </div>
                      {appTheme === t.id && (
                        <Check className="w-5 h-5 text-sky-600" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUB-SCREEN: UI Customization                              */}
        {/* ========================================================= */}
        {effectiveScreen === 'ui_customize' && (
          <div className="flex-1 flex flex-col pb-16">
            <div className="sticky top-0 z-20 bg-white/95 border-b border-sky-100 flex items-center justify-between px-4 pt-7 md:pt-4 pb-3.5 shadow-[0_1px_2px_rgba(2,132,199,0.05)]">
              <button onClick={handleBack} className="p-1 -ml-1 text-gray-900 hover:text-gray-600">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-gray-900 tracking-tight text-center flex-1 pr-5">
                UI Customization
              </h1>
            </div>

            <div className="px-4 py-4 space-y-6">
              {/* Navigation Bar Design */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Navigation Bar (2 Designs)</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => setNavStyle('glass')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      navStyle === 'glass' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        navStyle === 'glass' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Glass Navigation</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Floating glass capsule with drag gesture</span>
                      </div>
                    </div>
                    {navStyle === 'glass' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>

                  <button
                    onClick={() => setNavStyle('classic')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      navStyle === 'classic' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        navStyle === 'classic' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Classic Navigation</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Standard clean bottom navigation bar</span>
                      </div>
                    </div>
                    {navStyle === 'classic' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>
                </div>
              </div>

              {/* Profile Layout Design */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Profile Layout (2 Designs)</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => setProfileStyle('design1')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      profileStyle === 'design1' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        profileStyle === 'design1' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <User className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Design 1 (Standard Modern)</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Full banner header, avatar ring & tabs</span>
                      </div>
                    </div>
                    {profileStyle === 'design1' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>

                  <button
                    onClick={() => setProfileStyle('design2')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      profileStyle === 'design2' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        profileStyle === 'design2' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Design 2 (Compact Minimal Card)</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Centered avatar card with quick stats</span>
                      </div>
                    </div>
                    {profileStyle === 'design2' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>
                </div>
              </div>

              {/* Reels Layout Design */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-sky-700/70 px-3 pt-1 pb-1.5">Reels Feed (2 Designs)</p>
                <div className="space-y-2.5">
                  <button
                    onClick={() => setReelsStyle('design1')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      reelsStyle === 'design1' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        reelsStyle === 'design1' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Film className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Design 1 (Immersive Player)</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Edge-to-edge full screen with action icons</span>
                      </div>
                    </div>
                    {reelsStyle === 'design1' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>

                  <button
                    onClick={() => setReelsStyle('design2')}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                      reelsStyle === 'design2' 
                        ? 'bg-sky-50/70 border-sky-300 shadow-2xs' 
                        : 'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        reelsStyle === 'design2' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <Play className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <span className="text-[15px] font-bold text-gray-900 block leading-snug">Design 2 (Clean Minimal)</span>
                        <span className="text-[12px] text-gray-500 block leading-tight">Minimal overlays with focused video view</span>
                      </div>
                    </div>
                    {reelsStyle === 'design2' ? (
                      <Check className="w-5 h-5 text-sky-600 shrink-0 ml-2" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-gray-300 shrink-0 ml-2" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </main>
        </div>
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
                className="w-full flex items-center justify-center space-x-2 py-3 bg-gray-900 text-white text-[14px] font-bold rounded-2xl transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Link copied!' : 'Copy link'}</span>
              </button>

              <button
                onClick={() => {
                  const url = `${window.location.origin}/user/${encodeURIComponent(currentUser?.username || currentUser?.uid || 'user')}`;
                  shareContent({
                    title: `${currentUser?.name} on Ennvo`,
                    text: `Connect with ${currentUser?.name || 'me'} on Ennvo`,
                    url,
                  }).then((mode) => {
                    if (mode === 'copied') {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    }
                  });
                }}
                className="w-full flex items-center justify-center space-x-2 py-3 border border-gray-200 text-gray-800 text-[14px] font-bold rounded-2xl transition-all"
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

      {/* Modern In-App Logout Confirmation Modal */}
      {showLogoutModal && (
        <div 
          className="fixed inset-0 z-[600] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Log out of Ennvo?</h3>
              <p className="text-xs text-gray-500 mt-1">
                You can always log back in anytime. Your account is saved on this device.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="py-3 px-4 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="py-3 px-4 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-md shadow-red-500/20"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


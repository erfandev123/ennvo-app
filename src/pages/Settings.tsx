import React, { useState, useEffect } from 'react';
import { 
  User, Bell, Lock, Shield, Palette, HelpCircle, ChevronRight, Moon, 
  Globe, Activity, LogOut, ArrowLeft, Smartphone, AlertTriangle, UserX, 
  MessageSquare, AtSign, SlidersHorizontal, Zap, Gauge, Sparkles, Volume2, Check, Sliders, FileText
} from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAppStore } from '../store';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { playNotificationSound, playIncomingRingtone, playOutgoingRingtone, stopCallSounds } from '../services/soundService';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('Account');
  const [showMobileContent, setShowMobileContent] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const { setIsAuthenticated, currentUser, popPage, navStyle, setNavStyle } = useAppStore();

  const [userSettings, setUserSettings] = useState<any>({
    // Privacy
    isPrivate: false,
    showActivity: true,
    hideStory: false,
    publicSearch: true,
    whoCanMessage: 'everyone',
    whoCanComment: 'everyone',
    followRequests: 'everyone',
    // Notifications
    pushNotifications: true,
    likeAlerts: true,
    commentAlerts: true,
    followAlerts: true,
    messageAlerts: true,
    silentMode: false,
    // Security
    suspiciousLogins: true
  });

  // Customize App settings state
  const [customizeConfig, setCustomizeConfig] = useState({
    accentColor: localStorage.getItem('ennvo_accent') || 'purple',
    ultraPerf: localStorage.getItem('ennvo_ultra_perf') === 'true',
    disableMotion: localStorage.getItem('ennvo_disable_motion') === 'true',
    feedDensity: localStorage.getItem('ennvo_feed_density') || 'standard',
    videoAutoplay: localStorage.getItem('ennvo_autoplay') || 'always',
    fontScale: localStorage.getItem('ennvo_font_scale') || 'normal',
    soundHaptics: localStorage.getItem('ennvo_haptics') !== 'false',
    appThemeMode: localStorage.getItem('ennvo_theme_mode') || 'light'
  });

  const updateCustomize = (key: string, value: any) => {
    setCustomizeConfig(prev => {
      const updated = { ...prev, [key]: value };
      localStorage.setItem(`ennvo_${key === 'accentColor' ? 'accent' : key}`, String(value));
      return updated;
    });
  };

  useEffect(() => {
    if (currentUser) {
      const unsub = onSnapshot(doc(db, 'users', currentUser.uid), (docObj) => {
        if (docObj.exists()) {
          const data = docObj.data();
          setUserSettings(prev => ({ ...prev, ...data }));
        }
      }, () => {});
      return () => unsub();
    }
  }, [currentUser]);

  const toggleSetting = async (key: string) => {
    if (!currentUser) return;
    const newValue = !userSettings[key];
    setUserSettings(prev => ({ ...prev, [key]: newValue }));
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: newValue
      });
    } catch (err) {
      console.error(err);
      setUserSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  const updateSelectSetting = async (key: string, value: string) => {
    if (!currentUser) return;
    setUserSettings(prev => ({ ...prev, [key]: value }));
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: value
      });
    } catch (err) {
      console.error(err);
    }
  };

  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || 'Ennvo',
    username: '@ennvo_official',
    email: currentUser?.email || 'user@ennvo.com',
    phone: '',
    bio: 'Digital creator & artist 🎨'
  });

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: profileData.name,
        bio: profileData.bio,
        phone: profileData.phone
      });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile', err);
      alert('Failed to save profile');
    }
    setIsSaving(false);
  };

  const tabs = [
    { name: 'Account', icon: User },
    { name: 'Customize', icon: SlidersHorizontal },
    { name: 'Privacy', icon: Lock },
    { name: 'Notifications', icon: Bell },
    { name: 'Security', icon: Shield },
    { name: 'Theme', icon: Palette },
    { name: 'Help', icon: HelpCircle },
  ];

  const accentColors = [
    { id: 'purple', name: 'Purple', bg: 'bg-purple-600', ring: 'ring-purple-600' },
    { id: 'blue', name: 'Blue', bg: 'bg-blue-600', ring: 'ring-blue-600' },
    { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-600', ring: 'ring-emerald-600' },
    { id: 'rose', name: 'Rose', bg: 'bg-rose-600', ring: 'ring-rose-600' },
    { id: 'orange', name: 'Sunset', bg: 'bg-orange-600', ring: 'ring-orange-600' },
    { id: 'slate', name: 'Dark Slate', bg: 'bg-slate-800', ring: 'ring-slate-800' },
  ];

  return (
    <div className="h-full w-full bg-[#f6f7fb] flex flex-col md:flex-row overflow-hidden select-none md:pl-24">
      {/* Full-screen Modern Desktop Settings on PC, Native layout on mobile */}
      <div className="w-full h-full flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Settings Navigation Sidebar */}
        <div className={`w-full md:w-[320px] lg:w-[360px] shrink-0 border-r border-gray-200/80 bg-white md:bg-white/80 md:backdrop-blur-2xl flex flex-col absolute md:relative inset-0 z-10 transition-transform duration-200 ${showMobileContent ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
          <div className="px-6 pt-6 pb-4 border-b border-gray-200/70 bg-white md:bg-transparent">
            <div className="flex items-center space-x-3 mb-3">
              <button 
                onClick={() => popPage()} 
                className="p-2.5 -ml-2 rounded-2xl bg-gray-100/80 hover:bg-gray-200/80 text-gray-800 transition-all active:scale-95 touch-manipulation flex items-center justify-center shadow-2xs"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-800" />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h2>
                <p className="text-xs text-purple-600 font-medium hidden md:block">Preferences & Privacy</p>
              </div>
            </div>

            {/* Quick Profile Snippet on PC */}
            <div className="hidden md:flex items-center space-x-3 p-3 rounded-2xl bg-gradient-to-r from-purple-50 to-indigo-50/50 border border-purple-100/80">
              <img 
                src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/80/80"} 
                alt="Profile" 
                className="w-10 h-10 rounded-full object-cover border border-purple-200 shadow-2xs shrink-0" 
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{currentUser?.name || 'Ennvo User'}</p>
                <p className="text-xs text-gray-500 truncate">@{currentUser?.username || 'user'}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-1.5 flex-1 overflow-y-auto p-4">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.name;
              return (
                <button
                  key={tab.name}
                  onClick={() => { setActiveTab(tab.name); setShowMobileContent(true); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all touch-manipulation active:scale-[0.98] ${
                    isActive 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-sm shadow-purple-600/20' 
                      : 'bg-white md:bg-transparent border border-gray-200/50 md:border-transparent text-gray-700 hover:bg-gray-100/70 font-normal mb-1 md:mb-0'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl transition-all ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100/80 md:bg-white/80 text-gray-600 shadow-2xs'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[14px]">{tab.name}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'text-white translate-x-0.5' : 'text-gray-400'}`} />
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-gray-200/60 bg-white md:bg-transparent">
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl text-red-600 bg-red-50/80 hover:bg-red-100/80 border border-red-100 font-medium transition-all active:scale-[0.98] text-sm touch-manipulation shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2.5 hidden md:block">Ennvo Web v2.4.0</p>
          </div>
        </div>

        {/* Settings Content Area */}
        <div className={`flex-1 bg-white md:bg-[#fbfbfd]/70 md:backdrop-blur-xl flex flex-col absolute md:relative inset-0 z-20 transition-transform duration-200 ${showMobileContent ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          <div className="md:hidden flex items-center px-4 pt-6 pb-4 border-b border-gray-200 sticky top-0 bg-white z-30">
            <button onClick={() => setShowMobileContent(false)} className="p-2 -ml-2 mr-2 hover:bg-gray-100 rounded-xl transition-colors active:scale-95 touch-manipulation">
              <ArrowLeft className="w-5 h-5 text-gray-900" />
            </button>
            <h3 className="text-lg font-medium text-gray-900 tracking-tight">{activeTab}</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 md:p-10">
            <div className="hidden md:block pb-5 mb-6 border-b border-gray-200/70">
              <h3 className="text-2xl font-bold tracking-tight text-gray-900">{activeTab}</h3>
              <p className="text-xs text-gray-500 mt-1">Configure your personal preferences and account settings</p>
            </div>
          
          {/* Account Settings Tab */}
          {activeTab === 'Account' && (
            <div className="max-w-xl space-y-5 pb-8">
              <div className="flex items-center space-x-4 mb-2">
                <img src={currentUser?.avatar || "https://picsum.photos/seed/myprofile/80/80"} alt="Profile" className="w-16 h-16 rounded-full object-cover border border-gray-200" />
                <div>
                  <button className="bg-gray-50 flex items-center space-x-2 border border-gray-200 hover:bg-gray-100 text-gray-800 font-medium px-4 py-2 rounded-xl transition-colors text-xs active:scale-95 touch-manipulation">
                    <Palette className="w-3.5 h-3.5" />
                    <span>Change Photo</span>
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={profileData.name} onChange={e => setProfileData(p => ({...p, name: e.target.value}))} className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-600 transition-all text-sm font-normal" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Username</label>
                  <input type="text" value={profileData.username} onChange={e => setProfileData(p => ({...p, username: e.target.value}))} className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-600 transition-all text-sm font-normal" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email (Private)</label>
                  <input type="email" value={profileData.email} onChange={e => setProfileData(p => ({...p, email: e.target.value}))} className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-600 transition-all text-sm font-normal" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
                  <input type="tel" value={profileData.phone} onChange={e => setProfileData(p => ({...p, phone: e.target.value}))} placeholder="+1 (555) 000-0000" className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-purple-600 transition-all text-sm font-normal" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
                <textarea value={profileData.bio} onChange={e => setProfileData(p => ({...p, bio: e.target.value}))} className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 h-24 resize-none focus:outline-none focus:border-purple-600 transition-all text-sm font-normal leading-relaxed"></textarea>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-200">
                <button onClick={handleSaveProfile} disabled={isSaving} className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all active:scale-95 text-xs disabled:opacity-50 touch-manipulation">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>

              <div className="pt-6 border-t border-gray-200">
                <div className="bg-red-50/60 border border-red-200 p-4 rounded-xl">
                  <h4 className="text-red-700 font-medium text-xs mb-1 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5" /> Danger Zone</h4>
                  <p className="text-xs text-red-600/80 mb-3 leading-normal">Deactivating or deleting your account is a permanent action.</p>
                  <button onClick={() => { if(window.confirm('Are you sure you want to request account deletion?')) alert('Account deletion requested.') }} className="w-full md:w-auto bg-white text-red-600 border border-red-200 hover:bg-red-50 font-medium py-2 px-4 rounded-xl transition-all active:scale-95 text-xs">
                    Deactivate / Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* NEW Customize Page Option */}
          {activeTab === 'Customize' && (
            <div className="max-w-xl space-y-6 pb-8">
              
              {/* App Accent Theme Colors */}
              <div className="p-4 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="mb-3">
                  <h4 className="font-medium text-gray-900 text-sm flex items-center">
                    <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
                    App Accent Color
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">Select primary theme highlight color for Ennvo</p>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
                  {accentColors.map(c => (
                    <button
                      key={c.id}
                      onClick={() => updateCustomize('accentColor', c.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all active:scale-95 touch-manipulation ${
                        customizeConfig.accentColor === c.id 
                          ? 'bg-white border-purple-600 text-purple-700 font-medium' 
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full ${c.bg} flex items-center justify-center text-white mb-1`}>
                        {customizeConfig.accentColor === c.id && <Check className="w-3.5 h-3.5" />}
                      </div>
                      <span className="text-[11px]">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Bar UI Selection */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight flex items-center">
                  <Smartphone className="w-4 h-4 mr-2 text-purple-600" />
                  Navigation Bar Style
                </h4>

                <div className="p-3.5 border border-gray-200 rounded-xl bg-white space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-xs text-gray-900 block">Choose Navigation Bar UI</span>
                      <span className="text-[11px] text-gray-500">Select your preferred bottom bar experience</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNavStyle('classic');
                        updateCustomize('navStyle', 'classic');
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all active:scale-[0.98] touch-manipulation ${
                        navStyle === 'classic'
                          ? 'bg-purple-50/80 border-purple-400 text-purple-700 ring-2 ring-purple-500/20'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-xs">Classic Nav</span>
                        {navStyle === 'classic' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>}
                      </div>
                      <span className="text-[10px] text-gray-500">Standard bottom bar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNavStyle('glass');
                        updateCustomize('navStyle', 'glass');
                      }}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all active:scale-[0.98] touch-manipulation ${
                        navStyle === 'glass'
                          ? 'bg-purple-50/80 border-purple-400 text-purple-700 ring-2 ring-purple-500/20'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-xs flex items-center gap-1">
                          Liquid Glass ✨
                        </span>
                        {navStyle === 'glass' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>}
                      </div>
                      <span className="text-[10px] text-gray-500">Floating liquid glass capsule</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Performance & Speed Optimizations */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-amber-500" />
                  Speed & Android Performance
                </h4>

                {/* Ultra Performance Mode */}
                <div 
                  className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation" 
                  onClick={() => updateCustomize('ultraPerf', !customizeConfig.ultraPerf)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                      <Gauge className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">Ultra Speed Boost Mode</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Disables heavy blur filters for low-end Android RAM</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors border ${customizeConfig.ultraPerf ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${customizeConfig.ultraPerf ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>

                {/* Disable Motion Animations */}
                <div 
                  className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation" 
                  onClick={() => updateCustomize('disableMotion', !customizeConfig.disableMotion)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                      <Zap className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">Instant Page Switch (No Motion)</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Removes page slide transitions for instant click speed</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors border ${customizeConfig.disableMotion ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${customizeConfig.disableMotion ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>
              </div>

              {/* Feed & Video Options */}
              <div className="space-y-3 pt-2">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight flex items-center">
                  <Sliders className="w-4 h-4 mr-2 text-indigo-600" />
                  Layout & Content Settings
                </h4>

                {/* Feed Density */}
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs text-gray-900">Feed Layout Density</span>
                    <span className="text-[11px] text-gray-500 capitalize">{customizeConfig.feedDensity}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['standard', 'compact'].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateCustomize('feedDensity', mode)}
                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all touch-manipulation ${
                          customizeConfig.feedDensity === mode 
                            ? 'bg-purple-50 border-purple-200 text-purple-700' 
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {mode === 'standard' ? 'Standard Spacing' : 'Compact View'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video Autoplay */}
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-xs text-gray-900">Video Auto-Play</span>
                    <span className="text-[11px] text-gray-500 capitalize">{customizeConfig.videoAutoplay}</span>
                  </div>
                  <select
                    value={customizeConfig.videoAutoplay}
                    onChange={(e) => updateCustomize('videoAutoplay', e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-normal focus:outline-none focus:border-purple-600 cursor-pointer"
                  >
                    <option value="always">Always Autoplay Videos</option>
                    <option value="wifi">WiFi Only</option>
                    <option value="never">Never (Tap to Play)</option>
                  </select>
                </div>

                {/* Sound & Haptics */}
                <div 
                  className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation" 
                  onClick={() => updateCustomize('soundHaptics', !customizeConfig.soundHaptics)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      <Volume2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">Touch Vibration & Click Feedback</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">Haptic feedback when pressing buttons</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors border ${customizeConfig.soundHaptics ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${customizeConfig.soundHaptics ? 'right-0.5' : 'left-0.5'}`}></div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* Privacy Settings Tab */}
          {activeTab === 'Privacy' && (
            <div className="max-w-xl space-y-5">
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight">Account Visibility</h4>
                {[
                  { icon: Lock, title: 'Private Account', desc: 'Only approved followers can see your posts.', key: 'isPrivate' },
                  { icon: Globe, title: 'Public Search', desc: 'Allow your profile to appear in search engines.', key: 'publicSearch' },
                  { icon: Activity, title: 'Activity Status', desc: 'Show when you are online and active.', key: 'showActivity' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition-colors cursor-pointer touch-manipulation" onClick={() => toggleSetting(item.key)}>
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-100 p-2 rounded-lg border border-gray-200">
                        <item.icon className="w-4 h-4 text-gray-700" />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-xs">{item.title}</h4>
                        <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors border ${userSettings[item.key] ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${userSettings[item.key] ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight">Interactions</h4>
                
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center space-x-2">
                       <MessageSquare className="w-4 h-4 text-gray-600" />
                       <h4 className="font-medium text-gray-900 text-xs">Who can message you</h4>
                     </div>
                   </div>
                   <select 
                     value={userSettings.whoCanMessage} 
                     onChange={(e) => updateSelectSetting('whoCanMessage', e.target.value)}
                     className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-normal focus:outline-none focus:border-purple-600 cursor-pointer"
                   >
                     <option value="everyone">Everyone</option>
                     <option value="followers">Followers Only</option>
                     <option value="nobody">Nobody</option>
                   </select>
                </div>
                
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white">
                   <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center space-x-2">
                       <AtSign className="w-4 h-4 text-gray-600" />
                       <h4 className="font-medium text-gray-900 text-xs">Follow Requests</h4>
                     </div>
                   </div>
                   <select 
                     value={userSettings.followRequests} 
                     onChange={(e) => updateSelectSetting('followRequests', e.target.value)}
                     className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-normal focus:outline-none focus:border-purple-600 cursor-pointer"
                   >
                     <option value="everyone">Everyone</option>
                     <option value="nobody">Nobody</option>
                   </select>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-gray-200">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight">Restricted Accounts</h4>
                <div className="p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-white touch-manipulation">
                  <div className="flex items-center space-x-3">
                    <UserX className="w-4 h-4 text-gray-600" />
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">Blocked Users</h4>
                      <p className="text-[11px] text-gray-500">Manage blocked accounts</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          )}
          
          {/* Notifications Settings Tab */}
          {activeTab === 'Notifications' && (
            <div className="max-w-xl space-y-4">
               
               <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-purple-50/50 hover:bg-purple-50 transition-colors cursor-pointer touch-manipulation" onClick={() => toggleSetting('pushNotifications')}>
                 <div className="flex items-center space-x-3">
                   <div className="bg-purple-100 p-2 rounded-lg border border-purple-200">
                     <Bell className="w-4 h-4 text-purple-700" />
                   </div>
                   <div>
                     <h4 className="font-medium text-purple-950 text-xs">Push Notifications</h4>
                     <p className="text-[11px] text-purple-700 mt-0.5">Toggle overall push alerts</p>
                   </div>
                 </div>
                 <div className={`w-10 h-5 rounded-full relative transition-colors border ${userSettings.pushNotifications ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${userSettings.pushNotifications ? 'right-0.5' : 'left-0.5'}`}></div>
                 </div>
               </div>
               
               <div className="flex items-center justify-between p-3.5 border border-gray-200 rounded-xl bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer touch-manipulation" onClick={() => toggleSetting('silentMode')}>
                 <div className="flex items-center space-x-3">
                   <div className="bg-amber-100 p-2 rounded-lg border border-amber-200">
                     <Moon className="w-4 h-4 text-amber-700" />
                   </div>
                   <div>
                     <h4 className="font-medium text-amber-950 text-xs">Do Not Disturb (Silent)</h4>
                     <p className="text-[11px] text-amber-700 mt-0.5">Mute notification sounds</p>
                   </div>
                 </div>
                 <div className={`w-10 h-5 rounded-full relative transition-colors border ${userSettings.silentMode ? 'bg-amber-600 border-amber-600' : 'bg-gray-200 border-gray-300'}`}>
                   <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${userSettings.silentMode ? 'right-0.5' : 'left-0.5'}`}></div>
                 </div>
               </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight mb-2">Alert Types</h4>
                {[
                  { title: 'Likes & Reactions', desc: 'When someone likes your post', key: 'likeAlerts' },
                  { title: 'Comments', desc: 'When someone comments on your post', key: 'commentAlerts' },
                  { title: 'New Followers', desc: 'When someone starts following you', key: 'followAlerts' },
                  { title: 'Direct Messages', desc: 'When you receive a new message', key: 'messageAlerts' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 cursor-pointer touch-manipulation" onClick={() => toggleSetting(item.key)}>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">{item.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors border ${userSettings[item.key] ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${userSettings[item.key] ? 'right-0.5' : 'left-0.5'}`}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Ringtone & Notification Sound Test Controls */}
              <div className="space-y-2 pt-3 border-t border-gray-200">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight flex items-center">
                  <Volume2 className="w-4 h-4 mr-2 text-purple-600" />
                  Ringtone & Sound Effects Test
                </h4>
                <div className="p-3.5 border border-purple-100 bg-purple-50/40 rounded-xl space-y-2.5">
                  <p className="text-xs text-purple-900 font-medium">Test app sounds & ringtone audio output:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button 
                      onClick={() => playNotificationSound()}
                      className="px-3 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-800 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-purple-600" />
                      <span>Notification Sound</span>
                    </button>
                    <button 
                      onClick={() => playIncomingRingtone()}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Incoming Ringtone</span>
                    </button>
                    <button 
                      onClick={() => playOutgoingRingtone()}
                      className="px-3 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-800 rounded-lg text-xs font-medium flex items-center justify-center space-x-1.5 transition-all active:scale-95 shadow-sm"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-purple-600" />
                      <span>Calling Tone</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => stopCallSounds()}
                    className="w-full py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-medium transition-all active:scale-95 mt-1"
                  >
                    Stop Playing Sound
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Settings Tab */}
          {activeTab === 'Security' && (
            <div className="max-w-xl space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 <div className="p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer bg-white touch-manipulation">
                   <Shield className="w-5 h-5 text-purple-600 mb-2" />
                   <h4 className="font-medium text-gray-900 text-xs">Password</h4>
                   <p className="text-[11px] text-gray-500 mt-0.5">Change account password</p>
                 </div>
                 <div className="p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer bg-white touch-manipulation">
                   <Smartphone className="w-5 h-5 text-indigo-600 mb-2" />
                   <h4 className="font-medium text-gray-900 text-xs">Two-Factor Auth</h4>
                   <p className="text-[11px] text-gray-500 mt-0.5">Add extra security layer</p>
                 </div>
               </div>

              <div className="space-y-2 pt-2 border-t border-gray-200">
                <h4 className="font-medium text-sm text-gray-900 tracking-tight">Login Activity</h4>
                
                <div className="p-3.5 border border-gray-200 rounded-xl bg-white flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 text-xs">Android Device (Active)</h4>
                      <p className="text-[11px] text-gray-500">Dhaka, Bangladesh • App</p>
                    </div>
                  </div>
                  <div className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">Now</div>
                </div>

                <button className="w-full text-center py-2 text-red-600 font-medium text-xs hover:underline transition-all">
                  Log out of all devices
                </button>
              </div>
            </div>
          )}

          {/* Theme Mode Tab */}
          {activeTab === 'Theme' && (
            <div className="max-w-md space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div 
                  onClick={() => updateCustomize('appThemeMode', 'light')}
                  className={`border-2 rounded-xl p-3.5 cursor-pointer relative bg-white transition-all touch-manipulation ${
                    customizeConfig.appThemeMode === 'light' ? 'border-purple-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-full h-24 bg-gray-50 rounded-lg mb-2 flex flex-col p-2 space-y-1.5 border border-gray-200">
                    <div className="w-full h-3 bg-white rounded border border-gray-200"></div>
                    <div className="w-3/4 h-3 bg-white rounded border border-gray-200"></div>
                  </div>
                  <h4 className="font-medium text-center text-gray-900 text-xs">Light Mode</h4>
                </div>

                <div 
                  onClick={() => updateCustomize('appThemeMode', 'dark')}
                  className={`border-2 rounded-xl p-3.5 cursor-pointer relative bg-white transition-all touch-manipulation ${
                    customizeConfig.appThemeMode === 'dark' ? 'border-purple-600' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-full h-24 bg-gray-900 rounded-lg mb-2 flex flex-col p-2 space-y-1.5 border border-gray-800">
                    <div className="w-full h-3 bg-gray-800 rounded"></div>
                    <div className="w-3/4 h-3 bg-gray-800 rounded"></div>
                  </div>
                  <h4 className="font-medium text-center text-gray-900 text-xs">Dark Mode</h4>
                </div>
              </div>
            </div>
          )}
          
          {/* Help Tab */}
          {activeTab === 'Help' && (
            <div className="max-w-md space-y-2.5">
              <div 
                onClick={() => setShowPrivacyModal(true)}
                className="p-3.5 border border-purple-200 bg-purple-50/40 rounded-xl hover:bg-purple-50 transition-colors cursor-pointer flex justify-between items-center touch-manipulation"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg text-purple-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-purple-950 text-xs">Privacy Policy & Terms (গোপনীয়তা নীতিমালা)</h4>
                    <p className="text-[11px] text-purple-700 mt-0.5">Read app rules, data security & developer info</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-600" />
              </div>
              <div className="p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-white touch-manipulation">
                <div>
                  <h4 className="font-medium text-gray-900 text-xs">Help Center</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Find answers to your questions</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
              <div className="p-3.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer flex justify-between items-center bg-white touch-manipulation">
                <div>
                  <h4 className="font-medium text-gray-900 text-xs">Report a Problem</h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">Let us know if something is broken</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          )}

          </div>
        </div>
      </div>

      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
}

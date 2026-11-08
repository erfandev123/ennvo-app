import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  Upload, 
  Hammer, 
  RotateCcw, 
  CheckCircle, 
  AlertTriangle, 
  Globe, 
  Wifi, 
  ShieldCheck, 
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { fetchAppConfig, updateAppConfigAction } from '../services/adminService';
import { Language, i18n } from '../i18n';

export const AppVersionsPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [config, setConfig] = useState({
    latestVersionCode: 2,
    latestVersionName: '1.1.0',
    minVersionCode: 1,
    forceUpdate: false,
    apkUrl: 'https://ennvo.app/download/ennvo-latest.apk',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.ennvo.app',
    releaseNotes: {
      en: 'Major performance update! Instant reels playback, HD video calls, and memory optimizations for 2 GB devices.',
      bn: 'নতুন আপডেট! আল্ট্রা-ফাস্ট রিলস প্লেব্যাক, এইচডি ভিডিও কলিং এবং লো-এন্ড ফোনে সর্বোচ্চ পারফরম্যান্স।'
    },
    maintenance: {
      enabled: false,
      message: 'Ennvo is undergoing scheduled infrastructure upgrades. We will be back online shortly!'
    },
    ota: {
      enabled: true,
      version: '1.1.0-web',
      bundleUrl: 'https://ennvo.app/bundles/web-bundle-v1.1.0.zip',
      minNativeVersionCode: 1,
      rolloutPercent: 100
    },
    rtc: {
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: ['stun:global.stun.twilio.com:3478'] }
      ]
    }
  });

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const t = i18n[lang];

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const remote = await fetchAppConfig();
    if (remote) {
      setConfig((prev: any) => ({
        ...prev,
        ...remote,
        releaseNotes: { ...prev.releaseNotes, ...(remote.releaseNotes || {}) },
        maintenance: { ...prev.maintenance, ...(remote.maintenance || {}) },
        ota: { ...prev.ota, ...(remote.ota || {}) }
      }));
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('Please enter an audit reason for modifying application configurations.');
      return;
    }
    setSaving(true);
    try {
      await updateAppConfigAction(config, reason);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setReason('');
    } catch (e: any) {
      alert(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white">
              {t.appVersions}
            </h1>
            <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full">
              appConfig/android
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Manage remote Android app updates, forced update thresholds, OTA web bundles, and maintenance switch.
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold">
            <CheckCircle className="w-4 h-4" />
            <span>Config Published to Firestore!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Form */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-6">
          {/* Version Numbers Card */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Smartphone className="w-5 h-5 text-purple-600" />
              <span>Android APK Release Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
              <div>
                <label className="text-gray-500 block mb-1">Latest Version Code:</label>
                <input
                  type="number"
                  value={config.latestVersionCode}
                  onChange={(e) => setConfig({ ...config, latestVersionCode: Number(e.target.value) })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Latest Version Name:</label>
                <input
                  type="text"
                  value={config.latestVersionName}
                  onChange={(e) => setConfig({ ...config, latestVersionName: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Minimum Version Code (Blocked below):</label>
                <input
                  type="number"
                  value={config.minVersionCode}
                  onChange={(e) => setConfig({ ...config, minVersionCode: Number(e.target.value) })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Force Update Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-purple-50 dark:bg-purple-950/30 rounded-2xl border border-purple-100 dark:border-purple-900/40">
              <div>
                <span className="font-bold text-xs text-purple-900 dark:text-purple-200 block">
                  Force Update Required
                </span>
                <span className="text-[11px] text-purple-700 dark:text-purple-300">
                  Blocks users on older versions with a non-dismissible full-screen modal
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.forceUpdate}
                onChange={(e) => setConfig({ ...config, forceUpdate: e.target.checked })}
                className="w-5 h-5 accent-purple-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="text-gray-500 block mb-1">Play Store URL:</label>
                <input
                  type="text"
                  value={config.storeUrl}
                  onChange={(e) => setConfig({ ...config, storeUrl: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10"
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1">Direct APK Download URL:</label>
                <input
                  type="text"
                  value={config.apkUrl}
                  onChange={(e) => setConfig({ ...config, apkUrl: e.target.value })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10"
                />
              </div>
            </div>

            {/* Bilingual Release Notes */}
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-gray-500 block mb-1 font-semibold text-xs">
                  Release Notes (English):
                </label>
                <textarea
                  value={config.releaseNotes.en}
                  onChange={(e) => setConfig({
                    ...config,
                    releaseNotes: { ...config.releaseNotes, en: e.target.value }
                  })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-16 resize-none"
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1 font-semibold text-xs">
                  Release Notes (বাংলা):
                </label>
                <textarea
                  value={config.releaseNotes.bn}
                  onChange={(e) => setConfig({
                    ...config,
                    releaseNotes: { ...config.releaseNotes, bn: e.target.value }
                  })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-16 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Maintenance Mode Card */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Hammer className="w-5 h-5 text-amber-500" />
              <span>Maintenance Mode Switch</span>
            </h3>

            <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40">
              <div>
                <span className="font-bold text-xs text-amber-900 dark:text-amber-200 block">
                  Enable Maintenance Mode
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-300">
                  Blocks regular app access with a maintenance screen (Admins bypass automatically)
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.maintenance.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  maintenance: { ...config.maintenance, enabled: e.target.checked }
                })}
                className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="text-gray-500 block mb-1 font-semibold text-xs">
                Maintenance Notice Message:
              </label>
              <input
                type="text"
                value={config.maintenance.message}
                onChange={(e) => setConfig({
                  ...config,
                  maintenance: { ...config.maintenance, message: e.target.value }
                })}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
              />
            </div>
          </div>

          {/* OTA Web Updates Card */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <Wifi className="w-5 h-5 text-blue-500" />
              <span>Over-The-Air (OTA) Instant Web Updates</span>
            </h3>

            <div className="flex items-center justify-between p-3.5 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-200 dark:border-blue-900/40">
              <div>
                <span className="font-bold text-xs text-blue-900 dark:text-blue-200 block">
                  OTA Enabled (@capgo/capacitor-updater)
                </span>
                <span className="text-[11px] text-blue-700 dark:text-blue-300">
                  Instantly updates web bundle in background without reinstalling APK
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.ota.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  ota: { ...config.ota, enabled: e.target.checked }
                })}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div>
                <label className="text-gray-500 block mb-1">OTA Version Tag:</label>
                <input
                  type="text"
                  value={config.ota.version}
                  onChange={(e) => setConfig({
                    ...config,
                    ota: { ...config.ota, version: e.target.value }
                  })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-gray-500 block mb-1">Rollout Percentage (0-100%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.ota.rolloutPercent}
                  onChange={(e) => setConfig({
                    ...config,
                    ota: { ...config.ota, rolloutPercent: Number(e.target.value) }
                  })}
                  className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-white/10"
                />
              </div>
            </div>

            <div>
              <label className="text-gray-500 block mb-1 font-semibold text-xs">
                Web Bundle Zip URL (Firebase Storage / R2 CDN):
              </label>
              <input
                type="text"
                value={config.ota.bundleUrl}
                onChange={(e) => setConfig({
                  ...config,
                  ota: { ...config.ota, bundleUrl: e.target.value }
                })}
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 font-mono"
              />
            </div>
          </div>

          {/* Audit Reason & Submit */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs space-y-3">
            <label className="text-xs font-bold text-gray-900 dark:text-white block">
              Mandatory Audit Reason for Config Change:
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bumped release to v1.1.0 with WebRTC fixes; rolled out 50% OTA..."
              className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-20 resize-none focus:ring-2 focus:ring-purple-500"
            />

            <button
              type="submit"
              disabled={saving || !reason.trim()}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Upload className="w-4 h-4" />
              <span>{saving ? 'Publishing Changes...' : 'Publish Configuration to Live App'}</span>
            </button>
          </div>
        </form>

        {/* Live Phone Preview Card */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>User Experience Preview</span>
            </h3>

            {/* Mobile Mock Container */}
            <div className="w-full max-w-[280px] mx-auto bg-black rounded-[36px] p-3 shadow-2xl border-4 border-gray-800">
              <div className="w-full aspect-[9/18] bg-white dark:bg-gray-950 rounded-[26px] p-4 flex flex-col justify-between text-center overflow-hidden">
                <div className="w-16 h-1 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-4" />

                {config.maintenance.enabled ? (
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-3">
                      <Hammer className="w-6 h-6 animate-bounce" />
                    </div>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">
                      Maintenance
                    </h4>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-3">
                      {config.maintenance.message}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-600 mx-auto flex items-center justify-center mb-3">
                      <Download className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-xs text-gray-900 dark:text-white mb-1">
                      {config.forceUpdate ? 'Update Required' : 'Update Available'}
                    </h4>
                    <p className="text-[10px] text-purple-600 font-semibold mb-2">
                      Version {config.latestVersionName}
                    </p>
                    <p className="text-[9px] text-gray-500 dark:text-gray-400 line-clamp-4 leading-relaxed bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                      {config.releaseNotes.bn || config.releaseNotes.en}
                    </p>
                  </div>
                )}

                <div className="w-full py-2 bg-purple-600 text-white rounded-xl text-[10px] font-bold">
                  {config.maintenance.enabled ? 'Check Again Later' : 'Update Ennvo'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

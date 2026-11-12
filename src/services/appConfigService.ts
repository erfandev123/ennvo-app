/**
 * Ennvo App Configuration, Updates, Maintenance & OTA Service
 * Syncs with Firestore document `appConfig/android`
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { bridge } from '../native/bridge';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

export interface AndroidAppConfig {
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  forceUpdate: boolean;
  apkUrl: string;
  storeUrl: string;
  releaseNotes: {
    en: string;
    bn: string;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  ota: {
    enabled: boolean;
    version: string;
    bundleUrl: string;
    minNativeVersionCode: number;
    rolloutPercent: number;
  };
  rtc?: {
    iceServers: RTCIceServer[];
  };
}

const DEFAULT_CONFIG: AndroidAppConfig = {
  latestVersionCode: 1,
  latestVersionName: '1.0.0',
  minVersionCode: 1,
  forceUpdate: false,
  apkUrl: 'https://ennvo.app/download',
  storeUrl: 'https://play.google.com/store/apps/details?id=com.ennvo.app',
  releaseNotes: {
    en: 'Welcome to Ennvo! Experience ultra-fast social media, HD calls, and reels.',
    bn: 'Ennvo-তে আপনাকে স্বাগতম! আল্ট্রা-ফাস্ট সোশ্যাল মিডিয়া, এইচডি কল এবং রিলস উপভোগ করুন।'
  },
  maintenance: {
    enabled: false,
    message: 'Ennvo is undergoing scheduled maintenance for speed improvements. We will be back shortly!'
  },
  ota: {
    enabled: false,
    version: '1.0.0',
    bundleUrl: '',
    minNativeVersionCode: 1,
    rolloutPercent: 100
  },
  rtc: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
      { urls: ['stun:global.stun.twilio.com:3478'] }
    ]
  }
};

let currentConfig: AndroidAppConfig = DEFAULT_CONFIG;
type ConfigSubscriber = (config: AndroidAppConfig) => void;
const subscribers = new Set<ConfigSubscriber>();

export const getCachedAppConfig = (): AndroidAppConfig => currentConfig;

export const subscribeAppConfig = (cb: ConfigSubscriber) => {
  subscribers.add(cb);
  cb(currentConfig);

  const unsub = onSnapshot(doc(db, 'appConfig', 'android'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data() as Partial<AndroidAppConfig>;
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...data,
        releaseNotes: { ...DEFAULT_CONFIG.releaseNotes, ...(data.releaseNotes || {}) },
        maintenance: { ...DEFAULT_CONFIG.maintenance, ...(data.maintenance || {}) },
        ota: { ...DEFAULT_CONFIG.ota, ...(data.ota || {}) },
        rtc: data.rtc?.iceServers ? data.rtc : DEFAULT_CONFIG.rtc
      };
      subscribers.forEach(sub => sub(currentConfig));
      handleOtaUpdate(currentConfig);
    }
  }, (err) => console.warn('[AppConfig] snapshot warning:', err));

  return () => {
    subscribers.delete(cb);
    unsub();
  };
};

// Check if user hash falls in rollout percentage (deterministic per uid)
const isUserInRollout = (uid: string, percent: number): boolean => {
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const score = Math.abs(hash) % 100;
  return score < percent;
};

// OTA Updater helper
const OTA_VERSION_KEY = 'ennvo_ota_version';

export const handleOtaUpdate = async (config: AndroidAppConfig, uid: string = 'guest') => {
  if (!config.ota?.enabled || !config.ota.bundleUrl) return;

  try {
    const appInfo = bridge.getAppInfo();
    const nativeCode = appInfo.versionCode || 1;

    if (nativeCode < config.ota.minNativeVersionCode) {
      return; // Native APK too old for this web bundle
    }

    // Already applied this bundle: nothing to do.
    try {
      const applied = localStorage.getItem(OTA_VERSION_KEY);
      if (applied && applied === config.ota.version) return;
    } catch (e) {}

    if (!isUserInRollout(uid, config.ota.rolloutPercent)) {
      return;
    }

    // Check data saver
    const conn = (navigator as any).connection;
    if (conn && (conn.saveData || conn.effectiveType === '2g')) {
      return; // Do not auto-download large updates on slow/save-data connections
    }

    // Download update bundle via @capgo/capacitor-updater
    if (typeof CapacitorUpdater !== 'undefined' && CapacitorUpdater.download) {
      const downloaded = await CapacitorUpdater.download({
        url: config.ota.bundleUrl,
        version: config.ota.version
      });

      if (downloaded) {
        console.log('[OTA] Bundle downloaded, applying it now:', config.ota.version);
        try { localStorage.setItem(OTA_VERSION_KEY, config.ota.version || ''); } catch (e) {}
        // The new bundle is used right away, so an update is live after a
        // restart instead of after the next app update from the store.
        try {
          if (downloaded?.id && typeof CapacitorUpdater.set === 'function') {
            // set() switches to the bundle and reloads the app.
            await CapacitorUpdater.set({ id: downloaded.id });
          } else if (typeof CapacitorUpdater.reload === 'function') {
            setTimeout(() => CapacitorUpdater.reload(), 400);
          }
        } catch (e) {
          console.warn('[OTA] Applying the bundle failed, it will be used on the next start:', e);
        }
      }
    }
  } catch (e) {
    console.warn('[OTA] Download attempt notice:', e);
  }
};

export const notifyAppReady = () => {
  try {
    if (typeof CapacitorUpdater !== 'undefined' && CapacitorUpdater.notifyAppReady) {
      CapacitorUpdater.notifyAppReady();
    }
  } catch (e) {}
};

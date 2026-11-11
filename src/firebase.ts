import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager, 
  memoryLocalCache 
} from 'firebase/firestore';
import type { Database } from 'firebase/database';
import type { FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDhDRjiwHb5aeC8YJ6-JQDmxlSAVKZQzd0",
  authDomain: "ennvo-6c01c.firebaseapp.com",
  databaseURL: "https://ennvo-6c01c-default-rtdb.firebaseio.com",
  projectId: "ennvo-6c01c",
  storageBucket: "ennvo-6c01c.firebasestorage.app",
  messagingSenderId: "8931913340",
  appId: "1:8931913340:web:7c7506d7c2a1ba87e123f9",
  measurementId: "G-3FZM5D6EDG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Use persistent disk cache (IndexedDB) for instant offline startup and zero-delay loads on low-end devices, with fallback to memory
let localCacheSetting: any;
try {
  localCacheSetting = persistentLocalCache({
    tabManager: persistentSingleTabManager({})
  });
} catch (e) {
  console.warn('[Firebase] Persistent cache init fallback to memory:', e);
  localCacheSetting = memoryLocalCache();
}

export const db = initializeFirestore(app, {
  localCache: localCacheSetting,
  ignoreUndefinedProperties: true,
  // Android WebView sometimes blocks the long-lived WebChannel stream on
  // carrier networks. Autodetect falls back to long polling instead of
  // hanging for 30+ seconds on the first query after a cold start.
  experimentalAutoDetectLongPolling: true,
});

/**
 * Realtime Database and Storage SDKs are loaded only when they are actually
 * needed (presence/typing and media uploads). Keeping them out of the boot
 * bundle saves ~50 kB gzip and a chunk parse on low-end phones.
 */
let rtdbInstance: Database | null = null;
export const getRtdbInstance = async (): Promise<Database> => {
  if (!rtdbInstance) {
    const { getDatabase } = await import('firebase/database');
    rtdbInstance = getDatabase(app);
  }
  return rtdbInstance;
};

let storageInstance: FirebaseStorage | null = null;
export const getStorageInstance = async (): Promise<FirebaseStorage> => {
  if (!storageInstance) {
    const { getStorage } = await import('firebase/storage');
    storageInstance = getStorage(app);
  }
  return storageInstance;
};
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
import { FacebookAuthProvider } from 'firebase/auth';
export const facebookProvider = new FacebookAuthProvider();

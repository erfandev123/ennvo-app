import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager, 
  memoryLocalCache 
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';

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
});

export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
import { FacebookAuthProvider } from 'firebase/auth';
export const facebookProvider = new FacebookAuthProvider();

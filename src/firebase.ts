import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
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

// Enable robust memory cache so Firestore target view assertions don't fail during hot-reloads or multi-tab preview sessions
let localCacheSetting;
try {
  localCacheSetting = memoryLocalCache();
} catch (e) {
  console.warn('Memory cache fallback:', e);
}

export const db = initializeFirestore(app, {
  localCache: localCacheSetting,
  experimentalAutoDetectLongPolling: true,
  ignoreUndefinedProperties: true,
});
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();


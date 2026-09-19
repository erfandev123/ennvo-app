import { User } from '../types';
import { signIn } from './authService';

export interface SavedAccount {
  uid: string;
  name: string;
  username: string;
  avatar: string;
  email?: string;
  savedAt: number;
}

const STORAGE_KEY = 'ennvo_saved_accounts_v1';

export const getSavedAccounts = (): SavedAccount[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: SavedAccount[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out dummy auto-created anonymous placeholder 'User' accounts
    const hasRealAccounts = parsed.some(a => a.name && a.name !== 'User');
    const valid = hasRealAccounts 
      ? parsed.filter(a => a && a.uid && a.name && a.name !== 'User')
      : parsed.filter(a => a && a.uid);
    return valid;
  } catch (e) {
    console.warn('Error reading saved accounts:', e);
    return [];
  }
};

export const saveAccount = (user: User | { uid: string; name: string; username: string; avatar: string; email?: string }): SavedAccount[] => {
  if (!user || !user.uid) return getSavedAccounts();
  // Don't save empty/dummy anonymous 'User' if real accounts exist
  const isDummyUser = (!user.name || user.name === 'User') && (!user.username || user.username.startsWith('user_'));
  const currentSaved = getSavedAccounts();
  if (isDummyUser && currentSaved.length > 0 && currentSaved.some(a => a.name !== 'User')) {
    return currentSaved;
  }

  try {
    const list = getSavedAccounts();
    const existingIndex = list.findIndex(a => a.uid === user.uid);
    const accountData: SavedAccount = {
      uid: user.uid,
      name: user.name || user.username || 'User',
      username: user.username ? user.username.replace('@', '').toLowerCase() : `user_${user.uid.slice(0, 5)}`,
      avatar: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=5633D8&color=fff`,
      email: user.email || '',
      savedAt: Date.now()
    };

    let updated: SavedAccount[];
    if (existingIndex >= 0) {
      updated = [...list];
      updated[existingIndex] = { ...updated[existingIndex], ...accountData, savedAt: Date.now() };
    } else {
      updated = [accountData, ...list];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Error saving account:', e);
    return getSavedAccounts();
  }
};

export const removeSavedAccount = (uid: string): SavedAccount[] => {
  try {
    const list = getSavedAccounts().filter(a => a.uid !== uid);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return list;
  } catch (e) {
    console.warn('Error removing saved account:', e);
    return getSavedAccounts();
  }
};

import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

export const findUserByUsername = async (username: string): Promise<User | null> => {
  if (!username) return null;
  try {
    const clean = username.trim().toLowerCase().replace(/^@/, '');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', clean), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnapshot = querySnapshot.docs[0];
      return { uid: docSnapshot.id, ...docSnapshot.data() } as User;
    }
  } catch (err) {
    console.warn('[userService] findUserByUsername error:', err);
  }
  return null;
};

export const getUserById = async (uid: string): Promise<User | null> => {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { uid: snap.id, ...snap.data() } as User;
    }
  } catch (err) {
    console.warn('[userService] getUserById error:', err);
  }
  return null;
};

export const getUserByUsernameOrId = async (param: string): Promise<User | null> => {
  if (!param) return null;
  const byUsername = await findUserByUsername(param);
  if (byUsername) return byUsername;
  return await getUserById(param);
};

export const getUserByUsername = findUserByUsername;

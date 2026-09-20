import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  linkWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { User } from '../types';
import { getDefaultAvatar } from '../utils/defaultAvatars';

export const isUsernameUnique = async (username: string): Promise<boolean> => {
  const q = query(collection(db, 'users'), where('username', '==', username.toLowerCase()));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

export const signUp = async (
  emailOrUsername: string, 
  password: string, 
  name: string, 
  username: string, 
  mobileNumber?: string,
  avatar?: string,
  gender?: 'male' | 'female' | 'other',
  location?: string
) => {
  try {
    const cleanUsername = username.trim().toLowerCase();
    const unique = await isUsernameUnique(cleanUsername);
    if (!unique) throw new Error('Username already taken');

    let email = emailOrUsername.trim();
    if (!email || !email.includes('@')) {
      email = `${cleanUsername}@ennvo.app`;
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const userData: User = {
      uid: firebaseUser.uid,
      name: name || username,
      username: cleanUsername,
      email,
      mobileNumber: mobileNumber || '',
      avatar: avatar || getDefaultAvatar(gender),
      bio: '',
      gender: gender || 'male',
      location: location || 'Dhaka, Bangladesh',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
      hasPassword: true,
      authProvider: 'password',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    return userData;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signIn = async (usernameOrEmail: string, password: string) => {
  try {
    let email = usernameOrEmail.trim();
    let foundUserDoc: User | null = null;

    // Check if user exists by username or email in Firestore
    if (!email.includes('@')) {
      const q = query(collection(db, 'users'), where('username', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('No account found with this username');
      }
      foundUserDoc = snap.docs[0].data() as User;
      email = foundUserDoc.email || `${foundUserDoc.username}@ennvo.app`;
    } else {
      const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        foundUserDoc = snap.docs[0].data() as User;
      }
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const u = docSnap.data() as User;
        if (!u.hasPassword) {
          await updateDoc(docRef, { hasPassword: true });
        }
        return { ...u, hasPassword: true } as User;
      }
      return null;
    } catch (authError: any) {
      if (foundUserDoc && (!foundUserDoc.hasPassword || foundUserDoc.authProvider === 'google')) {
        throw new Error('This account was created with Google and doesn\'t have a password set yet. Please click "Continue with Google" to log in, and you can set a password in Settings.');
      }
      if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
        throw new Error('Incorrect password. Click "Forgot Password?" below to reset it.');
      }
      if (authError.code === 'auth/user-not-found') {
        throw new Error('No account found with this email or username.');
      }
      throw new Error(authError.message || 'Login failed');
    }
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;
    
    const docRef = doc(db, 'users', firebaseUser.uid);
    const docSnap = await getDoc(docRef);

    const hasPasswordProvider = firebaseUser.providerData.some(p => p.providerId === 'password');

    if (!docSnap.exists()) {
      const username = firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`;
      const userData: User = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || 'User',
        username: username.toLowerCase(),
        email: firebaseUser.email || '',
        avatar: firebaseUser.photoURL || `https://picsum.photos/seed/${firebaseUser.uid}/150/150`,
        bio: '',
        followersCount: 0,
        followingCount: 0,
        postsCount: 0,
        hasPassword: hasPasswordProvider,
        authProvider: hasPasswordProvider ? 'both' : 'google',
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, userData);
      return userData;
    }
    
    const existing = docSnap.data() as User;
    if (existing.hasPassword === undefined) {
      await updateDoc(docRef, { 
        hasPassword: hasPasswordProvider,
        authProvider: hasPasswordProvider ? 'both' : 'google'
      });
      existing.hasPassword = hasPasswordProvider;
      existing.authProvider = hasPasswordProvider ? 'both' : 'google';
    }
    return existing;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

/**
 * Send password reset email to a user's registered email or username
 */
export const sendPasswordReset = async (emailOrUsername: string): Promise<string> => {
  try {
    let email = emailOrUsername.trim();
    if (!email) {
      throw new Error('Please enter your email or username');
    }

    if (!email.includes('@')) {
      const q = query(collection(db, 'users'), where('username', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error(`No account found with username @${email}`);
      }
      const u = snap.docs[0].data() as User;
      if (!u.email || !u.email.includes('@')) {
        throw new Error(`No email address associated with @${email}`);
      }
      email = u.email;
    }

    await sendPasswordResetEmail(auth, email);
    return email;
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      throw new Error('No user found with this email address.');
    }
    if (error.code === 'auth/invalid-email') {
      throw new Error('Please enter a valid email address.');
    }
    throw new Error(error.message || 'Failed to send password reset email');
  }
};

/**
 * Set a new password for an account (e.g., Google user who has no password yet)
 */
export const setUserPassword = async (newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('You must be signed in to set a password');
  }
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  try {
    const hasPasswordProvider = user.providerData.some(p => p.providerId === 'password');
    if (!hasPasswordProvider) {
      // Link email/password credential to this account
      const credential = EmailAuthProvider.credential(user.email, newPassword);
      await linkWithCredential(user, credential);
    } else {
      await updatePassword(user, newPassword);
    }

    // Update Firestore user document
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      hasPassword: true,
      authProvider: 'both',
      updatedAt: serverTimestamp()
    });

    try {
      const raw = localStorage.getItem('ennvo_last_active_user_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify({ ...parsed, hasPassword: true, authProvider: 'both' }));
      }
    } catch (e) {}
  } catch (error: any) {
    if (error.code === 'auth/credential-already-in-use') {
      throw new Error('This email is already linked with another account password.');
    }
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('Security check: Please log in again before setting a new password.');
    }
    throw new Error(error.message || 'Failed to set password');
  }
};

/**
 * Change existing password with current password confirmation
 */
export const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('You must be signed in to change password');
  }
  if (newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters');
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      hasPassword: true,
      updatedAt: serverTimestamp()
    });
  } catch (error: any) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      throw new Error('Current password is incorrect. Please try again or use "Forgot Password".');
    }
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('For security, please log out and log back in to change your password.');
    }
    throw new Error(error.message || 'Failed to change password');
  }
};

export const logout = async () => {
  try {
    localStorage.removeItem('ennvo_last_active_user_v1');
  } catch (e) {}
  return signOut(auth);
};

export const updateUserProfile = async (userId: string, data: Partial<User>) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Batch update posts authored by this user asynchronously in background so profile save is instant
    if (data.name || data.avatar || data.username) {
      (async () => {
        try {
          const postsQuery = query(collection(db, 'posts'), where('authorId', '==', userId));
          const postsSnap = await getDocs(postsQuery);
          const updatePromises = postsSnap.docs.map(postDoc => {
            const updatePayload: any = {};
            if (data.name) updatePayload.authorName = data.name;
            if (data.avatar) updatePayload.authorAvatar = data.avatar;
            if (data.username) updatePayload.authorUsername = data.username;
            return updateDoc(doc(db, 'posts', postDoc.id), updatePayload);
          });
          await Promise.all(updatePromises);
        } catch (err) {
          console.warn('Post sync after profile update notice:', err);
        }
      })();
    }

    const updatedSnap = await getDoc(userRef);
    const updatedUser = { uid: updatedSnap.id, ...updatedSnap.data() } as User;
    try {
      localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(updatedUser));
    } catch (e) {}
    return updatedUser;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  let userUnsub: (() => void) | null = null;
  const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
    if (userUnsub) {
      userUnsub();
      userUnsub = null;
    }
    if (firebaseUser && !firebaseUser.isAnonymous) {
      const docRef = doc(db, 'users', firebaseUser.uid);
      userUnsub = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          const uData = docSnap.data() as User;
          try {
            localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(uData));
          } catch (e) {}
          callback(uData);
        } else {
          // Real authenticated user without doc (e.g. fresh Google signin)
          const fallbackUser: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            username: firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`,
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=5633D8&color=fff`,
            bio: '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            createdAt: serverTimestamp() as any,
          };
          try {
            await setDoc(docRef, fallbackUser, { merge: true });
            localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(fallbackUser));
          } catch (e) {
            console.warn('Auto-create user doc notice:', e);
          }
          callback(fallbackUser);
        }
      }, (err) => {
        console.warn('User listener error:', err);
        try {
          const raw = localStorage.getItem('ennvo_last_active_user_v1');
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved?.uid && saved.name !== 'User') callback(saved);
          }
        } catch (e) {}
      });
    } else {
      // Anonymous user or signed out - check if a real user profile was previously active
      try {
        const raw = localStorage.getItem('ennvo_last_active_user_v1');
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved && saved.uid && saved.name && saved.name !== 'User') {
            // Subscribe to real saved user document
            const userDocRef = doc(db, 'users', saved.uid);
            userUnsub = onSnapshot(userDocRef, (snap) => {
              if (snap.exists()) {
                const liveData = snap.data() as User;
                localStorage.setItem('ennvo_last_active_user_v1', JSON.stringify(liveData));
                callback(liveData);
              } else {
                callback(saved);
              }
            }, () => {
              callback(saved);
            });
            return;
          }
        }
      } catch (e) {}
      callback(null);
    }
  });

  return () => {
    if (userUnsub) userUnsub();
    authUnsub();
  };
};

export const searchUsers = async (searchTerm: string): Promise<User[]> => {
  if (!searchTerm.trim()) return [];
  const qStr = searchTerm.toLowerCase();
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('username', '>=', qStr), where('username', '<=', qStr + '\uf8ff'), limit(10));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as User);
};

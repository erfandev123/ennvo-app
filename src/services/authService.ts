import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { User } from '../types';

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
  avatar?: string
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
      avatar: avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || username)}&background=5633D8&color=fff`,
      bio: '',
      followersCount: 0,
      followingCount: 0,
      postsCount: 0,
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
    if (!email.includes('@')) {
      const q = query(collection(db, 'users'), where('username', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('No account found with this username');
      }
      const uData = snap.docs[0].data() as User;
      email = uData.email || `${uData.username}@ennvo.app`;
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const docRef = doc(db, 'users', userCredential.user.uid);
    const docSnap = await getDoc(docRef);
    return docSnap.data() as User;
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
        createdAt: serverTimestamp(),
      };
      await setDoc(docRef, userData);
      return userData;
    }
    
    return docSnap.data() as User;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const logout = () => signOut(auth);

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
    return { uid: updatedSnap.id, ...updatedSnap.data() } as User;
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
    if (firebaseUser) {
      const docRef = doc(db, 'users', firebaseUser.uid);
      userUnsub = onSnapshot(docRef, async (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data() as User);
        } else {
          const fallbackUser: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            username: firebaseUser.email?.split('@')[0] || `user_${firebaseUser.uid.substring(0, 5)}`,
            email: firebaseUser.email || '',
            avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || 'User')}&background=random`,
            bio: '',
            followersCount: 0,
            followingCount: 0,
            postsCount: 0,
            createdAt: serverTimestamp() as any,
          };
          try {
            await setDoc(docRef, fallbackUser, { merge: true });
          } catch (e) {
            console.warn('Auto-create user doc notice:', e);
          }
          callback(fallbackUser);
        }
      }, (err) => {
        console.warn('User listener error:', err);
      });
    } else {
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

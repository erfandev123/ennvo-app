import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export const requestFirebaseNotificationPermission = async (userId: string) => {
  console.log('Requesting notification permission...');
  
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications.');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      try {
        const messaging = getMessaging();
        const currentToken = await getToken(messaging, {
          vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-skvMeZ2eqgU7zZ_9X3t3t_v9p9z9_v9_p9_vz9t_z9_v_z9t_z9_v'
        }).catch((err) => {
          console.warn('FCM token generation notice:', err);
          return null;
        });
        
        if (currentToken && userId) {
          console.log('FCM Token generated:', currentToken);
          await setDoc(doc(db, 'users', userId), {
            fcmToken: currentToken
          }, { merge: true });
        }
      } catch (err) {
         console.warn('Firebase Messaging notice:', err);
      }
    }
  } catch (error) {
    console.warn('Notification permission notice:', error);
  }
};

export const onMessageListener = () => {
  try {
    const messaging = getMessaging();
    return new Promise((resolve) => {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    });
  } catch (err) {
    return Promise.resolve(null);
  }
};

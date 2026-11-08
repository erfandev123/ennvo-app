/**
 * Ennvo Notification Center (Single Source of Truth)
 * Consolidated listener for notifications and messages with native bridge integration.
 */

import { collection, onSnapshot, query, where, limit, orderBy, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { bridge } from '../native/bridge';
import { playNotificationSound } from './soundService';

interface NotificationCenterState {
  currentUid: string | null;
  activeChatId: string | null;
  unsubConversations: Unsubscribe | null;
  unsubNotifications: Unsubscribe | null;
  appStartTime: number;
  initialConversationsLoaded: boolean;
  initialNotificationsLoaded: boolean;
  seenNotificationIds: Set<string>;
}

const state: NotificationCenterState = {
  currentUid: null,
  activeChatId: null,
  unsubConversations: null,
  unsubNotifications: null,
  appStartTime: Date.now(),
  initialConversationsLoaded: false,
  initialNotificationsLoaded: false,
  seenNotificationIds: new Set(),
};

export const isUserActivelyTyping = (): boolean => {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if ((active as HTMLElement).isContentEditable) return true;
  return false;
};

type ToastCallback = (toast: {
  id: string;
  type: string;
  actorName: string;
  actorAvatar: string;
  content: string;
  conversationId?: string;
  postId?: string;
  targetId?: string;
  postMedia?: string;
  mediaUrl?: string;
}) => void;

let onToastListener: ToastCallback | null = null;

export const setInAppToastListener = (cb: ToastCallback | null) => {
  onToastListener = cb;
};

export const setActiveChatInCenter = (chatId: string | null) => {
  state.activeChatId = chatId;
};

export const startNotificationCenter = (uid: string) => {
  if (state.currentUid === uid && (state.unsubConversations || state.unsubNotifications)) {
    return;
  }

  stopNotificationCenter();
  state.currentUid = uid;
  state.appStartTime = Date.now();
  state.initialConversationsLoaded = false;
  state.initialNotificationsLoaded = false;

  // 1. Single Listener for Conversations
  const convQuery = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', uid),
    limit(20)
  );

  state.unsubConversations = onSnapshot(convQuery, (snapshot) => {
    if (!state.initialConversationsLoaded) {
      state.initialConversationsLoaded = true;
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified' || change.type === 'added') {
        const data = change.doc.data();
        const cid = change.doc.id;
        const otherId = data.participantIds?.find((id: string) => id !== uid);
        const name = (data.isGroup ? data.groupName : data.participantNames?.[otherId]) || 'Ennvo User';
        const avatar = (data.isGroup ? data.groupAvatar : data.participantAvatars?.[otherId]) || '';

        // Typing notification when user is not inside this chat
        if (otherId && data.typing?.[otherId] && state.activeChatId !== cid) {
          const typingTime = data.typing[otherId];
          if (Date.now() - (typeof typingTime === 'number' ? typingTime : Date.now()) < 4000) {
            if (onToastListener) {
              onToastListener({
                id: `${cid}-typing`,
                type: 'typing',
                actorName: name,
                actorAvatar: avatar,
                content: 'is typing a message...',
                conversationId: cid,
              });
            }
          }
        }

        // New message alert check
        const unreadForMe = (data.unreadCount?.[uid] || 0) > 0;
        const updatedAtMillis = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
        const isRecent = updatedAtMillis >= state.appStartTime - 5000;
        const isNotActiveChat = state.activeChatId !== cid;
        const isNotMuted = !data.mutedBy?.[uid];

        if (unreadForMe && isRecent && isNotActiveChat && isNotMuted) {
          const rawText = data.lastMessage || '';
          let body = rawText;
          if (data.lastMessageType === 'image') body = 'Photo';
          else if (data.lastMessageType === 'video') body = 'Video';
          else if (data.lastMessageType === 'voice') body = 'Voice message';
          else if (data.lastMessageType === 'reel') body = 'Shared a reel';

          const typingNow = isUserActivelyTyping();

          if (!typingNow) {
            playNotificationSound();
          }

          // Native Android notification (ignored by native while app is in foreground)
          bridge.showNotification(name, body, avatar, 'message');

          // In-App Toast (suppressed if user is actively typing)
          if (onToastListener && !typingNow) {
            onToastListener({
              id: cid,
              type: 'message',
              actorName: name,
              actorAvatar: avatar,
              content: body,
              conversationId: cid,
            });
          }
        }
      }
    });
  }, (err) => console.warn('[NotificationCenter] conversations listener notice:', err));

  // 2. Activity Notifications Listener (likes, comments, replies, reposts, favorites, mentions, follows)
  const notifQuery = query(
    collection(db, 'notifications', uid, 'items'),
    orderBy('createdAt', 'desc'),
    limit(30)
  );

  state.unsubNotifications = onSnapshot(notifQuery, (snapshot) => {
    if (!state.initialNotificationsLoaded) {
      state.initialNotificationsLoaded = true;
      // Mark existing items as already seen so we only notify for fresh incoming events
      snapshot.docs.forEach((doc) => state.seenNotificationIds.add(doc.id));
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const id = change.doc.id;
        if (state.seenNotificationIds.has(id)) return;
        state.seenNotificationIds.add(id);

        const data = change.doc.data();
        const createdAtMillis = data.createdAt?.toMillis 
          ? data.createdAt.toMillis() 
          : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

        if (createdAtMillis >= state.appStartTime - 10000) {
          const actorName = data.actorName || 'Someone';
          let body = data.content || 'New activity';
          if (data.type === 'like') body = 'liked your video.';
          else if (data.type === 'comment') body = data.content ? `commented: "${data.content}"` : 'commented on your video.';
          else if (data.type === 'reply') body = data.content ? `replied: "${data.content}"` : 'replied to your comment.';
          else if (data.type === 'repost') body = 'reposted your video.';
          else if (data.type === 'favorite') body = 'saved your video to favorites.';
          else if (data.type === 'mention') body = data.content ? `mentioned you: "${data.content}"` : 'mentioned you in a post.';
          else if (data.type === 'comment_like') body = 'liked your comment.';
          else if (data.type === 'follow') body = 'started following you.';

          const typingNow = isUserActivelyTyping();

          if (!typingNow) {
            playNotificationSound();
          }

          bridge.showNotification(actorName, body, data.actorAvatar || '', 'activity');

          if (onToastListener && !typingNow) {
            onToastListener({
              id,
              type: data.type || 'activity',
              actorName,
              actorAvatar: data.actorAvatar || '',
              content: body,
              postId: data.postId,
              targetId: data.targetId,
              postMedia: data.postMedia,
              mediaUrl: data.mediaUrl,
            });
          }
        }
      }
    });
  }, (err) => console.warn('[NotificationCenter] notifications listener notice:', err));
};

export const stopNotificationCenter = () => {
  if (state.unsubConversations) {
    state.unsubConversations();
    state.unsubConversations = null;
  }
  if (state.unsubNotifications) {
    state.unsubNotifications();
    state.unsubNotifications = null;
  }
  state.currentUid = null;
  state.initialConversationsLoaded = false;
  state.initialNotificationsLoaded = false;
};

/**
 * Ennvo Notification Center (Single Source of Truth)
 * Consolidated listener for notifications and messages with native bridge integration.
 */

import { collection, onSnapshot, query, where, limit, orderBy, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { bridge } from '../native/bridge';
import { playNotificationSound } from './soundService';
import { deviceNotification } from './deviceNotification';
import { activityBody } from '../utils/activityText';
import { activityUrl } from '../utils/activityLink';

interface NotificationCenterState {
  currentUid: string | null;
  activeChatId: string | null;
  unsubConversations: Unsubscribe | null;
  unsubNotifications: Unsubscribe | null;
  appStartTime: number;
  initialConversationsLoaded: boolean;
  initialNotificationsLoaded: boolean;
  seenNotificationIds: Set<string>;
  /** Last message time that already produced an alert, per conversation. */
  lastAlertedMessageAt: Map<string, number>;
}

const isNativeShell = (): boolean => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return !!(w.Android || w.AndroidInterface);
};

const state: NotificationCenterState = {
  currentUid: null,
  activeChatId: null,
  unsubConversations: null,
  unsubNotifications: null,
  appStartTime: Date.now(),
  initialConversationsLoaded: false,
  initialNotificationsLoaded: false,
  seenNotificationIds: new Set(),
  lastAlertedMessageAt: new Map(),
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
        // For a group the notification names the person who wrote, which is
        // also what the push says. Using the group name here produced a second,
        // differently titled notification for the same message.
        const actorId = data.lastSenderId || otherId;
        const isGroup = !!data.isGroup;
        const name = (isGroup
          ? data.participantNames?.[actorId] || data.groupName
          : data.participantNames?.[otherId]) || 'Ennvo User';
        const avatar = (isGroup
          ? data.participantAvatars?.[actorId] || data.groupAvatar
          : data.participantAvatars?.[otherId]) || '';

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

        // New message alert check. A message written on another device of the
        // same account must never notify the sender, even when older unread
        // messages are still in the chat.
        const fromSomeoneElse = !data.lastSenderId || data.lastSenderId !== uid;
        const unreadForMe = (data.unreadCount?.[uid] || 0) > 0 && fromSomeoneElse;
        const updatedAtMillis = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
        const isRecent = updatedAtMillis >= state.appStartTime - 5000;
        const isNotActiveChat = state.activeChatId !== cid;
        const isNotMuted = !data.mutedBy?.[uid];

        // Typing status is written to the conversation document too. Without
        // this time gate every "typing..." update re-fired the message alert
        // (sound + notification) for the previous unread message.
        const messageTime =
          (data.lastMessageTime?.toMillis && data.lastMessageTime.toMillis()) ||
          (typeof data.lastMessageTime === 'number' ? data.lastMessageTime : 0) ||
          updatedAtMillis;
        const previousAlert = state.lastAlertedMessageAt.get(cid) || 0;
        const isNewMessage = messageTime > previousAlert;
        if (isNewMessage) state.lastAlertedMessageAt.set(cid, messageTime);

        if (unreadForMe && isNewMessage && isRecent && isNotActiveChat && isNotMuted) {
          // The sender already writes a clean label ("Photo", "Voice message",
          // the text itself). Using it verbatim keeps the in-app toast and the
          // FCM push identical, which is what the native dedupe compares.
          const rawText = data.lastMessage || '';
          let body = rawText || 'New message';
          if (!rawText) {
            if (data.lastMessageType === 'image') body = 'Photo';
            else if (data.lastMessageType === 'video') body = 'Video';
            else if (data.lastMessageType === 'voice') body = 'Voice message';
            else if (data.lastMessageType === 'reel') body = 'Shared a reel';
          }

          const typingNow = isUserActivelyTyping();
          const nativeShell = isNativeShell();

          if (!typingNow) {
            if (nativeShell) playNotificationSound();
            else {
              // Browser: a real desktop notification that opens the chat when
              // clicked. It plays its own sound, so no double chime.
              deviceNotification.show({
                title: name,
                body,
                icon: avatar || '/icon-192.png?v=5',
                type: 'message',
                tag: `chat-${cid}`,
                data: { convId: cid },
              });
            }
          }

          // Native Android notification (the WebView notification is skipped
          // only for the chat that is open right now).
          if (nativeShell) bridge.showMessageNotification(name, body, avatar, cid);

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
        if (state.seenNotificationIds.size > 300) {
          // Keep the memory bounded on a long session.
          const keep = Array.from(state.seenNotificationIds).slice(-200);
          state.seenNotificationIds = new Set(keep);
        }

        const data = change.doc.data();
        // Skip an activity I caused myself.
        if (data.actorId && data.actorId === uid) return;
        const createdAtMillis = data.createdAt?.toMillis 
          ? data.createdAt.toMillis() 
          : (typeof data.createdAt === 'number' ? data.createdAt : Date.now());

        if (createdAtMillis >= state.appStartTime - 10000) {
          const actorName = data.actorName || 'Someone';
          const body = activityBody(data.type, data);

          const typingNow = isUserActivelyTyping();
          const nativeShell = isNativeShell();
          const targetUrl = activityUrl({ ...data, type: data.type });

          if (!typingNow) {
            if (nativeShell) playNotificationSound();
            else {
              deviceNotification.show({
                title: actorName,
                body,
                icon: data.actorAvatar || '/icon-192.png?v=5',
                type: 'activity',
                tag: `activity-${id}`,
                data: { url: targetUrl },
              });
            }
          }

          if (nativeShell) {
            bridge.showActivityNotification(
              actorName,
              body,
              data.actorAvatar || '',
              targetUrl
            );
          }

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

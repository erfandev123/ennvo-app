# Ennvo Social Platform Data Model & Schema Specification

This document maps all Firestore collections, document shapes, and fields currently used in the Ennvo social media application, along with the admin panel integration contracts and audit requirements.

---

## 1. Core Collections

### 1.1 `users/{uid}`
Primary user account and profile record.
- **Fields**:
  - `uid` (string): Firebase Auth User ID.
  - `name` (string): Full display name.
  - `username` (string): Unique handle (lowercase, alphanumeric, dots, underscores).
  - `email` (string): User email address.
  - `phoneNumber` / `mobileNumber` (string, optional): Mobile phone number.
  - `avatar` (string): Profile picture CDN URL or avatar.
  - `bannerUrl` (string, optional): Profile banner image URL.
  - `bio` (string): User bio text.
  - `gender` ('male' | 'female' | 'other', optional).
  - `dob` (string, optional): Date of birth (YYYY-MM-DD).
  - `location` (string, optional): User location.
  - `link` (string, optional): External website / social link.
  - `isVerified` / `verified` (boolean): Blue verification badge status.
  - `isPrivate` (boolean): Private account toggle.
  - `followersCount` (number): Cached follower count.
  - `followingCount` (number): Cached following count.
  - `postsCount` (number): Cached total posts and reels count.
  - `status` ('active' | 'suspended' | 'banned', optional - default: 'active'): Account safety status.
  - `bannedUntil` (number | Timestamp, optional): Unix timestamp or Firestore timestamp for temporary suspension expiry.
  - `banReason` (string, optional): Reason for ban or suspension.
  - `isAdmin` (boolean, optional): Staff or admin flag.
  - `role` ('superadmin' | 'admin' | 'moderator' | 'support' | 'analyst', optional): Admin panel role claim.
  - `fcmTokens` (array of string): Registered Firebase Cloud Messaging device push tokens.
  - `blockedUserIds` (array of string): IDs of users blocked by this user.
  - `highlights` (array of string, optional): Featured story IDs.
  - `hasPassword` (boolean): Whether email/password credentials are configured.
  - `authProvider` ('password' | 'google' | 'both'): Authentication provider type.
  - `accountType` ('personal' | 'business', optional).
  - `statusNote` (string, optional): 24h status note.
  - `createdAt` (Timestamp | number): Account registration timestamp.
  - `lastActive` (Timestamp | number, optional): Last online or activity timestamp.

#### Subcollections under `users/{uid}`:
- `users/{uid}/followers/{followerUid}`:
  - `name`, `avatar`, `createdAt`.
- `users/{uid}/following/{targetUid}`:
  - `name`, `avatar`, `createdAt`.
- `users/{uid}/favorites/{postId}`:
  - `createdAt`: Saved bookmark timestamp.
- `users/{uid}/reposts/{postId}`:
  - `createdAt`, `text`.

---

### 1.2 `posts/{postId}`
Feed posts, reels, video updates, and photos.
- **Fields**:
  - `id` (string): Post ID.
  - `authorId` (string): Author UID.
  - `authorName` (string): Display name.
  - `authorAvatar` (string): Avatar image URL.
  - `authorUsername` (string, optional): Author handle.
  - `text` (string): Caption / post description.
  - `media` (array of string): Array of CDN URLs (images or video MP4/WebM).
  - `thumbnailUrl` (string, optional): Video thumbnail frame URL.
  - `type` ('post' | 'reel' | 'text'): Content type.
  - `likesCount` (number): Cached likes counter.
  - `commentsCount` (number): Cached comments counter.
  - `repostsCount` (number): Cached repost counter.
  - `viewsCount` (number): Total view impressions.
  - `favoritesCount` (number): Total saves/bookmarks.
  - `songId`, `songTitle`, `songArtist`, `songUrl` (optional): Background music info.
  - `location` (string, optional): Geo tag / tagged place.
  - `taggedUsers` (array, optional): Tagged user handles / UIDs.
  - `privacy` ('public' | 'followers' | 'private', default: 'public').
  - `category` (string, optional): Post topic/category.
  - `isPinned` (boolean, optional): Pinned to top of profile.
  - `isFeatured` (boolean, optional): Featured in discovery / trending.
  - `isSensitive` (boolean, optional): Content marked 18+ or sensitive.
  - `status` ('published' | 'hidden' | 'deleted', default: 'published'): Moderation status.
  - `createdAt` (Timestamp | number): Publication date.

#### Subcollections under `posts/{postId}`:
- `posts/{postId}/likes/{userId}`:
  - `userId`, `userName`, `userAvatar`, `createdAt`.
- `posts/{postId}/reposts/{userId}`:
  - `userId`, `userName`, `userAvatar`, `text`, `createdAt`.
- `posts/{postId}/comments/{commentId}`:
  - `authorId`, `authorName`, `authorAvatar`, `text`.
  - `parentId` (string, optional): Parent comment ID for threaded replies.
  - `replyToName`, `replyToAuthorId` (string, optional).
  - `imageUrl`, `audioUrl`, `audioDuration`, `stickerUrl` (optional).
  - `likesCount` (number).
  - `createdAt` (Timestamp | number).
  - `status` ('published' | 'hidden' | 'deleted', optional).
- `posts/{postId}/comments/{commentId}/likes/{userId}`:
  - `userId`, `createdAt`.

---

### 1.3 `stories/{storyId}`
24-hour ephemeral photos and short video clips.
- **Fields**:
  - `authorId` (string).
  - `authorName` (string).
  - `authorAvatar` (string).
  - `mediaUrl` (string): Media file URL.
  - `type` ('image' | 'video').
  - `viewers` (array of string): UIDs of users who viewed the story.
  - `status` ('active' | 'deleted' | 'expired').
  - `createdAt` (Timestamp).
  - `expiresAt` (Timestamp): 24h expiration timestamp.

---

### 1.4 `conversations/{conversationId}`
Direct and group chat rooms.
- **Fields**:
  - `participantIds` (array of string): Member UIDs.
  - `participantNames` (map `[uid]: string`).
  - `participantAvatars` (map `[uid]: string`).
  - `lastMessage` (string): Text preview of latest message.
  - `lastMessageType` ('text' | 'image' | 'video' | 'voice' | 'reel' | 'sticker' | 'system', optional).
  - `unreadCount` (map `[uid]: number`).
  - `updatedAt` (Timestamp).
  - `typing` (map `[uid]: number | boolean`, optional).
  - `theme` (string, optional): Chat wallpaper theme key.
  - `isGroup` (boolean, optional).
  - `groupName`, `groupAvatar` (string, optional).
  - `isRequest` (boolean, optional): Message request state.
  - `requestTo`, `requestFrom` (string, optional).
  - `requestStatus` ('pending' | 'accepted' | 'blocked' | 'declined', optional).
  - `mutedBy` (map `[uid]: boolean`, optional): Muted status.

#### Subcollection: `conversations/{conversationId}/messages/{messageId}`
- **Fields**:
  - `senderId` (string).
  - `type` ('text' | 'image' | 'video' | 'voice' | 'reel' | 'sticker' | 'system' | 'album').
  - `content` (string): Message text or caption.
  - `mediaUrl` / `mediaUrls` (string | array): Attachment URLs.
  - `stickerUrl` (string, optional).
  - `postId` (string, optional): Shared reel/post ID.
  - `status` ('sending' | 'sent' | 'delivered' | 'seen').
  - `voiceDuration` (number, optional).
  - `reaction` (string, optional).
  - `replyTo` (`{ id, text, authorName }`, optional).
  - `createdAt` (Timestamp | number).

---

### 1.5 `calls/{callId}`
WebRTC audio and video calling records.
- **Fields**:
  - `callerId`, `callerName`, `callerAvatar` (string).
  - `receiverId`, `receiverName`, `receiverAvatar` (string).
  - `type` ('audio' | 'video').
  - `status` ('ringing' | 'accepted' | 'rejected' | 'ended').
  - `offer` (object): SDP offer `{ type, sdp }`.
  - `answer` (object, optional): SDP answer `{ type, sdp }`.
  - `duration` (number, optional): Call duration in seconds.
  - `createdAt` (number | Timestamp).

#### Subcollections:
- `calls/{callId}/callerCandidates/{id}`: ICE candidate object.
- `calls/{callId}/receiverCandidates/{id}`: ICE candidate object.

---

### 1.6 `notifications/{userId}/items/{notificationId}`
User notification items.
- **Fields**:
  - `actorId`, `actorName`, `actorAvatar` (string).
  - `type` ('like' | 'comment' | 'follow' | 'mention' | 'reply' | 'favorite' | 'comment_like').
  - `targetId` (string): Target post ID or user ID.
  - `postId`, `postMedia`, `postAuthorId` (optional).
  - `content` (string, optional).
  - `isRead` (boolean).
  - `createdAt` (Timestamp | number).

---

### 1.7 `reports/{reportId}`
User moderation and abuse reports created by mobile/web apps.
- **Fields**:
  - `reporterId` (string): UID of reporter.
  - `reporterName` (string, optional).
  - `targetType` ('user' | 'post' | 'reel' | 'comment' | 'message').
  - `targetId` (string): ID of reported item or user.
  - `reason` (string): Reason code ('spam', 'harassment', 'nudity', 'hate_speech', 'violence', 'copyright', 'other').
  - `details` (string): Optional extra text.
  - `status` ('open' | 'investigating' | 'resolved' | 'dismissed').
  - `assignedTo` (string, optional): Staff UID assigned to review.
  - `resolution` (string, optional): Action taken ('none', 'warned', 'content_hidden', 'user_suspended', 'user_banned').
  - `createdAt` (Timestamp | number).
  - `resolvedAt` (Timestamp, optional).

---

## 2. Admin & System Collections

### 2.1 `appConfig/android`
Mobile app remote configuration, updates, maintenance, and WebRTC TURN settings:
```typescript
{
  latestVersionCode: number;
  latestVersionName: string;
  minVersionCode: number;
  forceUpdate: boolean;
  apkUrl: string;
  storeUrl: string;
  releaseNotes: {
    en: string;
    bn: string;
  };
  maintenance: {
    enabled: boolean;
    message: string;
  };
  ota: {
    enabled: boolean;
    version: string;
    bundleUrl: string;
    minNativeVersionCode: number;
    rolloutPercent: number;
  };
  rtc: {
    iceServers: RTCIceServer[];
  };
}
```

### 2.2 `appConfig/ranking`
Feed and reels algorithm weights:
```typescript
{
  recencyWeight: number;    // e.g. 0.35
  likesWeight: number;      // e.g. 0.25
  commentsWeight: number;   // e.g. 0.25
  sharesWeight: number;     // e.g. 0.15
  boostList: string[];      // Promoted post/reel IDs
  updatedAt: Timestamp;
  updatedBy: string;
}
```

### 2.3 `appConfig/flags`
Feature flags and remote switches:
```typescript
{
  callsEnabled: boolean;
  reelsUploadEnabled: boolean;
  aiChatEnabled: boolean;
  storiesEnabled: boolean;
  adsEnabled: boolean;
  maintenanceBypassRoles: string[];
}
```

### 2.4 `appConfig/moderation`
Safety rules, blocked terms, and spam rate thresholds:
```typescript
{
  bannedWords: string[];
  reservedUsernames: string[];
  maxReportsBeforeAutoFlag: number;
  bannedIps: string[];
  bannedDevices: string[];
}
```

### 2.5 `adminLogs/{logId}`
Immutable audit trail for all company staff actions:
- `id` (string).
- `adminUid` (string).
- `adminEmail` (string).
- `adminRole` (string).
- `action` (string, e.g. 'user_banned', 'content_deleted', 'config_updated', 'role_changed').
- `targetType` (string, e.g. 'user', 'post', 'config', 'report').
- `targetId` (string).
- `beforeValue` (any, optional).
- `afterValue` (any, optional).
- `reason` (string): Mandatory explanation.
- `ipAddress` (string, optional).
- `userAgent` (string, optional).
- `timestamp` (Timestamp).

### 2.6 `stats/live` & `stats/daily/{yyyy-mm-dd}`
Maintained by Cloud Functions triggers:
- `totalUsers`: number
- `newUsersToday`: number
- `activeNow`: number
- `dau`: number
- `wau`: number
- `mau`: number
- `postsCreated`: number
- `reelsCreated`: number
- `commentsCreated`: number
- `messagesSent`: number
- `callsCompleted`: number
- `callMinutes`: number
- `openReports`: number
- `bannedUsers`: number
- `storageUsedBytes`: number

---

## 3. Assumptions & Placeholders Noted
1. `users/{uid}.status` is used for account state ('active', 'suspended', 'banned'). Default fallback is 'active' for legacy users who do not have this field.
2. `users/{uid}.bannedUntil` holds suspension expiration. If omitted or in the past, suspension is expired.
3. `adminLogs` is write-once and rules strictly prohibit modification or deletion to preserve forensic audit trails.

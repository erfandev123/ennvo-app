export interface User {
  uid: string;
  name: string;
  username: string;
  email: string;
  mobileNumber?: string;
  avatar: string;
  bio: string;
  link?: string;
  isVerified?: boolean;
  highlights?: string[];
  followersCount: number;
  followingCount: number;
  postsCount: number;
  statusNote?: string;
  createdAt: any;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail?: string;
  duration?: number;
  creatorId: string;
  creatorName: string;
  createdAt: any;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  media: string[];
  type: 'post' | 'reel';
  likesCount: number;
  commentsCount: number;
  repostsCount?: number;
  viewsCount?: number;
  favoritesCount?: number;
  songId?: string;
  privacy?: 'public' | 'followers' | 'private';
  category?: string;
  aspectRatioFit?: 'contain' | 'cover';
  createdAt: any;
  thumbnailUrl?: string;
  mediaDetails?: {
    originalSize?: string;
    compressedSize?: string;
    savedPercentage?: string;
  }[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  likesCount?: number;
  createdAt: any;
  parentId?: string | null;
  replyToName?: string;
  replyToAuthorId?: string;
  imageUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  stickerUrl?: string;
}

export interface Conversation {
  id: string;
  participantIds: string[];
  participantNames?: { [uid: string]: string };
  participantAvatars?: { [uid: string]: string };
  lastMessage: string;
  unreadCount: { [uid: string]: number };
  updatedAt: any;
  typing?: { [uid: string]: boolean };
  theme?: string;
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
}

export interface CustomSticker {
  id: string;
  url: string;
  title?: string;
  type: 'image' | 'video' | 'animated';
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  tags?: string[];
  isPublic?: boolean;
  createdAt: any;
}

export interface Message {
  id: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'voice' | 'reel' | 'sticker' | 'system';
  content: string;
  mediaUrl?: string;
  stickerUrl?: string;
  stickerType?: 'image' | 'video' | 'animated';
  postId?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'seen';
  voiceDuration?: number;
  reaction?: string;
  createdAt: any;
  replyTo?: {
    id: string;
    text: string;
    authorName: string;
  };
}

export interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'favorite' | 'comment_like';
  actorId: string;
  actorName: string;
  actorAvatar: string;
  targetId: string; // postId or userId
  postId?: string;
  postMedia?: string;
  postAuthorId?: string;
  postAuthorName?: string;
  postAuthorAvatar?: string;
  content?: string;
  isRead: boolean;
  createdAt: any;
}

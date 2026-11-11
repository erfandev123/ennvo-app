/**
 * Ennvo Admin Panel Types & Interfaces
 */

export type AdminRole = 'superadmin' | 'admin' | 'moderator' | 'support' | 'analyst';

export interface AdminUser {
  uid: string;
  email: string;
  displayName?: string;
  role: AdminRole;
  lastLogin?: number;
}

export interface LiveStats {
  totalUsers: number;
  newToday: number;
  activeNow: number;
  dau: number;
  wau: number;
  mau: number;
  postsToday: number;
  reelsToday: number;
  commentsToday: number;
  messagesToday: number;
  callsToday: number;
  openReports: number;
  bannedUsers: number;
  storageUsedBytes: number;
}

export interface AdminLogItem {
  id: string;
  adminUid: string;
  adminEmail: string;
  adminRole?: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeValue?: any;
  afterValue?: any;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: any;
}

export interface ReportItem {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetType: 'user' | 'post' | 'reel' | 'comment' | 'message';
  targetId: string;
  reason: string;
  details?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  assignedTo?: string;
  resolution?: string;
  createdAt: any;
  resolvedAt?: any;
}

export interface ModerationSettings {
  bannedWords: string[];
  reservedUsernames: string[];
  maxReportsBeforeAutoFlag: number;
  bannedIps: string[];
  bannedDevices: string[];
}

export interface RankingConfig {
  recencyWeight: number;
  likesWeight: number;
  commentsWeight: number;
  sharesWeight: number;
  boostList: string[];
}

export interface FeatureFlags {
  callsEnabled: boolean;
  reelsUploadEnabled: boolean;
  aiChatEnabled: boolean;
  storiesEnabled: boolean;
  adsEnabled: boolean;
}

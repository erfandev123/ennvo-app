/**
 * Builds the exact in-app target for an activity notification.
 *
 * The native notification and the in-app toast must agree, so both use this
 * helper. A post/reel opens its viewer; a follow opens the actor's profile;
 * anything else falls back to the activity list.
 */
export const activityUrl = (data: any = {}): string => {
  const existing = typeof data?.url === 'string' ? data.url.trim() : '';
  if (existing) return existing;

  const type = String(data?.type || '');
  const postId = data?.postId || (data?.targetType === 'post' || data?.targetType === 'reel' ? data?.targetId : '');
  if (postId) return `/post/${encodeURIComponent(String(postId))}`;

  if (type === 'follow' || type === 'mention' || type === 'profile') {
    const uid = data?.actorId || data?.targetId;
    if (uid) return `/user/${encodeURIComponent(String(uid))}`;
  }

  return '/notifications';
};

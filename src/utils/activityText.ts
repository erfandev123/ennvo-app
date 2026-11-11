/**
 * Single source of truth for activity wording.
 * Used by the in-app toast, the native notification and the activity list so
 * every surface says exactly the same thing.
 */
export type ActivityType =
  | 'like' | 'comment' | 'follow' | 'mention' | 'reply' | 'favorite' | 'comment_like' | 'repost'
  | 'story_like' | 'repost_like' | 'share' | string;

export const activityBody = (type: ActivityType, data: any = {}): string => {
  const kind = String(type || '');
  const target = String(data?.targetType || data?.postType || '').toLowerCase();
  const isStory = target === 'story' || kind.includes('story');
  const isRepost = target === 'repost' || kind.includes('repost');
  const isReel = target === 'reel';
  const isComment = target === 'comment' || kind.includes('comment');

  switch (kind) {
    case 'like':
      if (isStory) return 'liked your story';
      if (isRepost) return 'liked your repost';
      if (isComment) return 'liked your comment';
      if (isReel) return 'liked your reel';
      return 'liked your video';

    case 'comment':
      if (isStory) return 'replied to your story';
      return 'commented on your video';

    case 'reply':
      if (isRepost) return 'replied to your repost';
      return 'replied to your comment';

    case 'repost':
      return 'shared your video';

    case 'favorite':
      return 'saved your video';

    case 'mention':
      return 'mentioned you in a post';

    case 'comment_like':
      return 'liked your comment';

    case 'story_like':
      return 'liked your story';

    case 'repost_like':
      return 'liked your repost';

    case 'follow':
      return 'started following you';

    default:
      return data?.content ? String(data.content) : 'sent you a notification';
  }
};

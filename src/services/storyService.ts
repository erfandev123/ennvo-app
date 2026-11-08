import {
  collection,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { deleteMedia, uploadMedia } from "./githubStorage";
import { ensureFirebaseAuth } from "./authService";
import { generateVideoThumbnail } from "../utils";

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  text?: string;
  bg?: string;
  type: "image" | "video" | "text";
  createdAt: any;
  expiresAt: any;
  storyMode?: "home" | "inbox";
  songId?: string;
  songTitle?: string;
  songArtist?: string;
  songThumbnail?: string;
  songUrl?: string;
}

export const uploadStory = async (
  userId: string,
  userName: string,
  userAvatar: string,
  file?: File | null,
  text?: string,
  storyMode: "home" | "inbox" = "home",
  songId?: string,
  extraSong?: {
    title?: string;
    artist?: string;
    thumbnail?: string;
    url?: string;
  }
) => {
  try {
    const authUid = await ensureFirebaseAuth();
    let mediaUrl = "";
    let thumbnailUrl = "";
    let type: "image" | "video" | "text" = "text";

    if (file) {
      type = file.type.startsWith("video") ? "video" : "image";
      mediaUrl = await uploadMedia(file, "stories");
      if (!mediaUrl) {
        throw new Error("Failed to upload story media. Please check your internet connection.");
      }
      if (mediaUrl.startsWith("data:video") && mediaUrl.length > 500000) {
        throw new Error("Video file size is too large for fallback. Please check internet connection.");
      }
      if (type === "video") {
        try {
          thumbnailUrl = await generateVideoThumbnail(file);
        } catch (e) {
          thumbnailUrl = "";
        }
      }
    }

    const currentAuthId = auth.currentUser?.uid || userId || authUid;
    const authorName = userName || auth.currentUser?.displayName || "User";
    const authorAvatar = userAvatar || auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=5633D8&color=fff`;

    const nowSeconds = Math.floor(Date.now() / 1000);
    const expiresAt = new Timestamp(nowSeconds + 24 * 60 * 60, 0); // 24 hours expiry
    const nowTimestamp = Timestamp.now();

    const storyData: Record<string, any> = {
      authorId: currentAuthId,
      authorName,
      authorAvatar,
      type,
      createdAt: nowTimestamp,
      expiresAt,
      storyMode: storyMode || "home",
    };

    if (mediaUrl) storyData.mediaUrl = mediaUrl;
    if (thumbnailUrl && thumbnailUrl.length < 300000) storyData.thumbnailUrl = thumbnailUrl;
    if (text && text.trim()) storyData.text = text.trim();
    if (songId) storyData.songId = songId;
    if (extraSong?.title) storyData.songTitle = extraSong.title;
    if (extraSong?.artist) storyData.songArtist = extraSong.artist;
    if (extraSong?.thumbnail) storyData.songThumbnail = extraSong.thumbnail;
    if (extraSong?.url) storyData.songUrl = extraSong.url;

    const docRef = await addDoc(collection(db, "stories"), storyData);
    return { id: docRef.id, ...storyData };
  } catch (error: any) {
    console.error("Story upload failed:", error);
    throw new Error(error.message || "Failed to upload story");
  }
};

const preloadStoryMedia = (stories: Story[]) => {
  if (typeof window === 'undefined') return;
  try {
    stories.slice(0, 20).forEach(s => {
      if (s.mediaUrl && s.type === 'image') {
        const img = new Image();
        img.src = s.mediaUrl;
      }
      if (s.thumbnailUrl) {
        const img = new Image();
        img.src = s.thumbnailUrl;
      }
      if (s.authorAvatar) {
        const img = new Image();
        img.src = s.authorAvatar;
      }
    });
  } catch (e) {}
};

export const subscribeStories = (
  callback: (stories: Story[]) => void,
  _mode?: "home" | "inbox" | string,
) => {
  const q = query(
    collection(db, "stories"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const stories = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt || { seconds: nowSeconds },
          } as Story;
        })
        .filter((s) => {
          if (s.expiresAt) {
            const expSec = s.expiresAt.seconds || (s.expiresAt.toMillis ? Math.floor(s.expiresAt.toMillis() / 1000) : null);
            if (expSec && expSec < nowSeconds) return false;
          }
          return true;
        });
      preloadStoryMedia(stories);
      callback(stories);
    },
    (error) => {
      console.warn("Stories query fallback:", error?.message);
      const fallbackQ = query(collection(db, "stories"), limit(50));
      return onSnapshot(fallbackQ, (snapshot) => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const stories = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }) as Story)
          .filter((s) => {
            if (s.expiresAt) {
              const expSec = s.expiresAt.seconds || (s.expiresAt.toMillis ? Math.floor(s.expiresAt.toMillis() / 1000) : null);
              if (expSec && expSec < nowSeconds) return false;
            }
            return true;
          })
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        preloadStoryMedia(stories);
        callback(stories);
      });
    }
  );
};

export const deleteStory = async (storyId: string) => {
  try {
    const storyRef = doc(db, "stories", storyId);
    const storySnap = await getDoc(storyRef);
    if (storySnap.exists()) {
      const data = storySnap.data();
      if (data.mediaUrl) {
        deleteMedia(data.mediaUrl).catch(e => console.warn('Story media delete warning:', e));
      }
    }
    await deleteDoc(storyRef);
  } catch (err) {
    console.warn('Delete story error:', err);
    await deleteDoc(doc(db, "stories", storyId)).catch(() => {});
  }
};

import React, { useState, useEffect } from 'react';
import { HardDrive, Trash2, ExternalLink, RefreshCw, FileText, Video, Image as ImageIcon } from 'lucide-react';
import { Language, i18n } from '../i18n';
import { deleteMedia } from '../../../src/services/githubStorage';
import { logAdminAction } from '../services/adminService';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../../../src/firebase';

export const MediaStoragePage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const t = i18n[lang];

  useEffect(() => {
    loadRecentMedia();
  }, []);

  const loadRecentMedia = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), limit(30));
      const snap = await getDocs(q);
      const items: any[] = [];
      snap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.media && Array.isArray(d.media)) {
          d.media.forEach((url: string, idx: number) => {
            items.push({
              id: `${doc.id}-${idx}`,
              postId: doc.id,
              authorName: d.authorName,
              url,
              createdAt: d.createdAt,
              type: url.includes('.mp4') ? 'video' : 'image'
            });
          });
        }
      });
      setMediaItems(items);
    } catch (e) {}
    setLoading(false);
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to permanently delete this media file from storage?')) return;
    setDeletingId(item.id);
    try {
      await deleteMedia(item.url);
      await logAdminAction({
        action: 'media_file_purged',
        targetType: 'storage_file',
        targetId: item.url,
        reason: 'Staff purged orphaned/inappropriate storage asset'
      });
      setMediaItems(mediaItems.filter(m => m.id !== item.id));
    } catch (e: any) {
      alert(`Delete error: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.media}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cloudflare R2 Object Storage browser. Delete operations route securely through backend proxy without exposing keys.
          </p>
        </div>

        <button
          onClick={loadRecentMedia}
          className="p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-xl cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400">Loading media library...</div>
        ) : mediaItems.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400">No media assets found</div>
        ) : (
          mediaItems.map((item) => (
            <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden group shadow-xs flex flex-col justify-between">
              <div className="aspect-square bg-black relative flex items-center justify-center">
                {item.type === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt="" className="w-full h-full object-cover" />
                )}
                <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-black/60 text-white">
                  {item.type}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between text-xs">
                <span className="truncate text-gray-500 font-semibold text-[11px] max-w-[80px]">
                  {item.authorName}
                </span>
                <div className="flex items-center space-x-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-400 hover:text-purple-600"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item)}
                    className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Film, 
  Image as ImageIcon, 
  EyeOff, 
  Eye, 
  Trash2, 
  Pin, 
  Sparkles, 
  Sliders, 
  AlertTriangle, 
  Play, 
  CheckCircle,
  MessageCircle,
  RefreshCw,
  Rocket
} from 'lucide-react';
import { fetchContentList, moderateContentAction } from '../services/adminService';
import { Language, i18n } from '../i18n';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../src/firebase';

export const ContentPage: React.FC<{ lang: Language }> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'reels' | 'posts' | 'ranking'>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [targetAction, setTargetAction] = useState<{
    id: string;
    action: 'hide' | 'restore' | 'delete' | 'pin' | 'feature' | 'sensitive' | 'promote';
  } | null>(null);

  // Ranking weights configuration
  const [rankingWeights, setRankingWeights] = useState({
    recencyWeight: 0.35,
    likesWeight: 0.25,
    commentsWeight: 0.25,
    sharesWeight: 0.15,
    boostList: ''
  });
  const [savingWeights, setSavingWeights] = useState(false);

  const t = i18n[lang];

  const loadContent = async () => {
    setLoading(true);
    const filter = activeTab === 'reels' ? 'reel' : activeTab === 'posts' ? 'post' : 'all';
    const data = await fetchContentList(filter as any);
    setItems(data);
    setLoading(false);
  };

  const loadRankingConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'ranking'));
      if (snap.exists()) {
        const d = snap.data();
        setRankingWeights({
          recencyWeight: d.recencyWeight ?? 0.35,
          likesWeight: d.likesWeight ?? 0.25,
          commentsWeight: d.commentsWeight ?? 0.25,
          sharesWeight: d.sharesWeight ?? 0.15,
          boostList: Array.isArray(d.boostList) ? d.boostList.join(', ') : ''
        });
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (activeTab === 'ranking') {
      loadRankingConfig();
    } else {
      loadContent();
    }
  }, [activeTab]);

  const handleExecuteAction = async () => {
    if (!targetAction || !actionReason.trim()) return;
    try {
      await moderateContentAction(targetAction.id, targetAction.action, actionReason);
      setTargetAction(null);
      setActionReason('');
      await loadContent();
    } catch (e: any) {
      alert(`Moderation failed: ${e.message}`);
    }
  };

  const handleTogglePromote = async (item: any) => {
    try {
      const next = !item.isPromoted;
      await moderateContentAction(
        item.id, 
        'promote', 
        next ? 'Admin fast-promoted content to #1 Top position for all users' : 'Removed from fast-promotion'
      );
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, isPromoted: next } : p));
    } catch (e: any) {
      alert(`Promotion toggle failed: ${e.message}`);
    }
  };

  const handleSaveRanking = async () => {
    setSavingWeights(true);
    try {
      const boosts = rankingWeights.boostList.split(',').map(s => s.trim()).filter(Boolean);
      await setDoc(doc(db, 'appConfig', 'ranking'), {
        recencyWeight: Number(rankingWeights.recencyWeight),
        likesWeight: Number(rankingWeights.likesWeight),
        commentsWeight: Number(rankingWeights.commentsWeight),
        sharesWeight: Number(rankingWeights.sharesWeight),
        boostList: boosts,
        updatedAt: new Date()
      }, { merge: true });
      alert('Ranking algorithm weights updated successfully!');
    } catch (e: any) {
      alert(`Error saving weights: ${e.message}`);
    } finally {
      setSavingWeights(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="flex bg-white dark:bg-gray-900 p-2 rounded-2xl border border-gray-100 dark:border-white/5 shadow-xs max-w-md">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'all' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          All Feed
        </button>
        <button
          onClick={() => setActiveTab('reels')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'reels' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Reels
        </button>
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            activeTab === 'posts' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Posts
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
            activeTab === 'ranking' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Ranking</span>
        </button>
      </div>

      {activeTab === 'ranking' ? (
        /* Ranking Algorithm Settings */
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm max-w-xl space-y-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Feed & Reels Ranking Weights
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Control algorithm weights used to sort content in user feeds and discovery tabs. Stored in <code>appConfig/ranking</code>.
            </p>
          </div>

          <div className="space-y-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <div>
              <div className="flex justify-between mb-1">
                <span>Recency Weight ({rankingWeights.recencyWeight})</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingWeights.recencyWeight}
                onChange={(e) => setRankingWeights({ ...rankingWeights, recencyWeight: Number(e.target.value) })}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>Likes Weight ({rankingWeights.likesWeight})</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingWeights.likesWeight}
                onChange={(e) => setRankingWeights({ ...rankingWeights, likesWeight: Number(e.target.value) })}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>Comments Weight ({rankingWeights.commentsWeight})</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingWeights.commentsWeight}
                onChange={(e) => setRankingWeights({ ...rankingWeights, commentsWeight: Number(e.target.value) })}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span>Shares Weight ({rankingWeights.sharesWeight})</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rankingWeights.sharesWeight}
                onChange={(e) => setRankingWeights({ ...rankingWeights, sharesWeight: Number(e.target.value) })}
                className="w-full accent-purple-600"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-500">
                Boosted Post IDs (Comma-separated IDs promoted to the top):
              </label>
              <input
                type="text"
                value={rankingWeights.boostList}
                onChange={(e) => setRankingWeights({ ...rankingWeights, boostList: e.target.value })}
                placeholder="post_123, reel_456"
                className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10"
              />
            </div>
          </div>

          <button
            onClick={handleSaveRanking}
            disabled={savingWeights}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            {savingWeights ? 'Saving Weights...' : 'Save Algorithm Weights'}
          </button>
        </div>
      ) : (
        /* Content List Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-12 text-center text-gray-400">
              Loading content items...
            </div>
          ) : items.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-400">
              No content items found
            </div>
          ) : (
            items.map((item) => {
              const isVideo = item.type === 'reel' || item.media?.[0]?.includes('.mp4') || item.media?.[0]?.includes('video');
              const mediaUrl = item.media?.[0] || item.thumbnailUrl;
              const isHidden = item.status === 'hidden';

              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-gray-900 rounded-3xl border ${
                    isHidden ? 'border-red-300 dark:border-red-900/60 opacity-70' : 'border-gray-100 dark:border-white/5'
                  } p-4 shadow-xs flex flex-col justify-between space-y-3`}
                >
                  {/* Media Preview Box */}
                  <div className="relative aspect-video bg-black rounded-2xl overflow-hidden flex items-center justify-center">
                    {mediaUrl ? (
                      isVideo ? (
                        <video src={mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                      )
                    ) : (
                      <div className="text-gray-500 text-xs">Text-only Post</div>
                    )}

                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-black/60 text-white backdrop-blur-xs">
                      {item.type || 'post'}
                    </span>

                    {item.isPromoted && (
                      <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md flex items-center space-x-1">
                        <Rocket className="w-3 h-3" />
                        <span>TOP #1</span>
                      </span>
                    )}

                    {isHidden && !item.isPromoted && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-600 text-white">
                        Hidden
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1.5">
                      <img
                        src={item.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.authorName || 'User')}`}
                        alt=""
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="font-bold text-xs text-gray-900 dark:text-white truncate">
                        {item.authorName || 'Unknown'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2 leading-relaxed">
                      {item.text || 'No caption'}
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleTogglePromote(item)}
                        title={item.isPromoted ? 'Remove from #1 Top position' : 'Fast promote to #1 position for all users'}
                        className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                          item.isPromoted
                            ? 'bg-amber-500 text-white shadow-xs'
                            : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                        }`}
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        <span>{item.isPromoted ? 'Promoted #1' : 'Promote Top'}</span>
                      </button>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setTargetAction({ id: item.id, action: isHidden ? 'restore' : 'hide' })}
                        title={isHidden ? 'Restore to feed' : 'Hide from feed'}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg cursor-pointer"
                      >
                        {isHidden ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-amber-500" />}
                      </button>

                      <button
                        onClick={() => setTargetAction({ id: item.id, action: 'pin' })}
                        title="Pin or Unpin"
                        className={`p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg cursor-pointer ${item.isPinned ? 'text-purple-600' : ''}`}
                      >
                        <Pin className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setTargetAction({ id: item.id, action: 'feature' })}
                        title="Feature on Discovery"
                        className={`p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg cursor-pointer ${item.isFeatured ? 'text-yellow-500' : ''}`}
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setTargetAction({ id: item.id, action: 'delete' })}
                        title="Permanently Delete"
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Moderation Reason Dialog */}
      {targetAction && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-100 dark:border-white/10">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">
              Action: {targetAction.action.toUpperCase()}
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Please enter the administrative reason for this content moderation action:
            </p>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Inappropriate content reported by community..."
              className="w-full p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs border border-gray-200 dark:border-white/10 h-20 mb-4 resize-none"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setTargetAction(null)}
                className="px-3 py-1.5 text-xs text-gray-500 rounded-lg"
              >
                Cancel
              </button>
              <button
                disabled={!actionReason.trim()}
                onClick={handleExecuteAction}
                className="px-4 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl cursor-pointer"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

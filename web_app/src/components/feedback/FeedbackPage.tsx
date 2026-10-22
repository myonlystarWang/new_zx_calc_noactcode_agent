import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  Pin,
  Send,
  Dices,
  Filter,
  CheckCircle2,
  Clock,
  MessageCircle,
  CornerDownRight,
  X,
  Loader2
} from 'lucide-react';
import clsx from 'clsx';
import { computeGuestbookStamp, markGuestbookSeen } from '../../utils/guestbookSeen';

export type GuestbookCategory = 'all' | 'suggestion' | 'bug' | 'build' | 'feature';

export interface GuestbookReply {
  id: string;
  author: string;
  content: string;
  time: string;
  isAuthor?: boolean;
}

export interface GuestbookEntry {
  id: string;
  author: string;
  category: GuestbookCategory;
  content: string;
  time: string;
  likes: number;
  isPinned?: boolean;
  statusBadge?: 'adopted' | 'in_progress' | 'fixed';
  statusText?: string;
  replies?: GuestbookReply[];
}

const CATEGORIES: { id: GuestbookCategory; label: string }[] = [
  { id: 'all', label: '全部留言' },
  { id: 'suggestion', label: '功能建议' },
  { id: 'bug', label: '数值捉虫' },
  { id: 'build', label: '副本交流' },
  { id: 'feature', label: '催更求索' }
];

const IMMORTAL_TITLES = [
  '玉清散人', '青云九叶', '太极道玄', '焚香老祖', '天音行僧',
  '逐霜客', '惊岚行者', '逍遥剑仙', '紫霞真人', '昆仑仙客',
  '玄天居士', '南疆巫灵', '天音参悟者', '诛仙百晓生', '星耀散仙'
];

const INITIAL_POSTS: GuestbookEntry[] = [
  {
    id: 'pin-1',
    author: '星耀-萝卜 (作者)',
    category: 'suggestion',
    content: '欢迎仙友使用天书万象 AI 诛仙全知大模型！本平台 100% 静态边缘计算，真实数据全量免费开放。任何技能公式误差、BOSS属性校对或战力对比建议，均可在此留言交流！',
    time: '2026-10-14 12:00',
    likes: 88,
    isPinned: true,
    statusBadge: 'adopted',
    statusText: '官方公告',
    replies: []
  }
];

const STORAGE_KEY = 'tianshu_guestbook_posts_v3';
const LIKED_STORAGE_KEY = 'tianshu_guestbook_liked_v3';

export const FeedbackPage: React.FC = () => {
  const [posts, setPosts] = useState<GuestbookEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedPin = parsed.find((p: GuestbookEntry) => p && p.id === 'pin-1');
          const pinnedPost: GuestbookEntry = savedPin
            ? {
              ...INITIAL_POSTS[0],
              likes: typeof savedPin.likes === 'number' ? Math.max(INITIAL_POSTS[0].likes, savedPin.likes) : INITIAL_POSTS[0].likes,
              replies: Array.isArray(savedPin.replies) ? savedPin.replies : (INITIAL_POSTS[0].replies || [])
            }
            : INITIAL_POSTS[0];
          const userPosts = parsed.filter((p: GuestbookEntry) => p && p.id !== 'pin-1');
          return [pinnedPost, ...userPosts];
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_POSTS;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeCategory, setActiveCategory] = useState<GuestbookCategory>('all');
  const [authorName, setAuthorName] = useState(() => {
    return IMMORTAL_TITLES[Math.floor(Math.random() * IMMORTAL_TITLES.length)];
  });
  const [newPostCategory, setNewPostCategory] = useState<GuestbookCategory>('suggestion');
  const [postContent, setPostContent] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(LIKED_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { }
    return {};
  });

  // 回复状态管理：当前正在回复哪条留言
  const [replyingPostId, setReplyingPostId] = useState<string | null>(null);
  const [replyAuthorName, setReplyAuthorName] = useState(() => {
    return IMMORTAL_TITLES[Math.floor(Math.random() * IMMORTAL_TITLES.length)];
  });
  const [replyContent, setReplyContent] = useState('');

  // 同步本地缓存
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save guestbook posts', e);
    }
  }, [posts]);

  // 停留在本页即视为已读（与更新动态规则一致），同步收起 Header 的 NEW 角标
  useEffect(() => {
    markGuestbookSeen(computeGuestbookStamp(posts));
  }, [posts]);

  // 从服务端拉取全量留言
  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/guestbook');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.posts)) {

          // 如果云端只有置顶帖，而本地有存量自创留言，则自动同步合入云端
          const localSaved = localStorage.getItem(STORAGE_KEY);
          let localUserPosts: GuestbookEntry[] = [];
          if (localSaved) {
            try {
              const parsed = JSON.parse(localSaved);
              if (Array.isArray(parsed)) {
                localUserPosts = parsed.filter(p => p.id !== 'pin-1');
              }
            } catch { }
          }

          if (data.cloud && data.posts.length <= 1 && localUserPosts.length > 0) {
            // 静默同步本地存量留言到云端
            try {
              const syncRes = await fetch('/api/guestbook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync', posts: localUserPosts })
              });
              if (syncRes.ok) {
                const syncData = await syncRes.json();
                if (syncData.success && Array.isArray(syncData.posts)) {
                  setPosts(syncData.posts);
                  return;
                }
              }
            } catch (syncErr) {
              console.warn('Auto sync local posts to cloud failed:', syncErr);
            }
          }

          setPosts(data.posts);
          return;
        }
      }
    } catch (err) {
      console.warn('Guestbook fetch fallback to local storage:', err);
    }
  }, []);

  // 初始加载拉取云端
  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleRandomizeTitle = () => {
    const filtered = IMMORTAL_TITLES.filter(t => t !== authorName);
    const next = filtered[Math.floor(Math.random() * filtered.length)];
    setAuthorName(next);
  };

  const handleRandomizeReplyTitle = () => {
    const filtered = IMMORTAL_TITLES.filter(t => t !== replyAuthorName);
    const next = filtered[Math.floor(Math.random() * filtered.length)];
    setReplyAuthorName(next);
  };

  const handleLike = async (id: string) => {
    if (likedMap[id]) return;
    const nextLiked = { ...likedMap, [id]: true };
    setLikedMap(nextLiked);
    try {
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(nextLiked));
    } catch { }

    // 乐观更新
    setPosts(prev =>
      prev.map(p => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    );

    // 云端上报
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'like', postId: id })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.posts)) {
          setPosts(data.posts);
        }
      }
    } catch (e) {
      console.warn('Like report error:', e);
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = postContent.trim();
    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    const author = authorName.trim() || '匿踪仙友';
    const category = newPostCategory;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // 乐观更新
    const tempEntry: GuestbookEntry = {
      id: `post-${Date.now()}`,
      author,
      category,
      content,
      time: timeStr,
      likes: 1,
      replies: []
    };

    setPosts(prev => [prev[0], tempEntry, ...prev.slice(1)]);
    setPostContent('');

    // 发送至服务端云端存储
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          author,
          category,
          content,
          faxian_trap: honeypot
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.posts)) {
          setPosts(data.posts);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          alert(errData.error || '仙友论道调息中，请稍后再试');
          // 回滚乐观更新
          setPosts(prev => prev.filter(p => p.id !== tempEntry.id));
        } else if (errData.error) {
          alert(errData.error);
          setPosts(prev => prev.filter(p => p.id !== tempEntry.id));
        }
      }
    } catch (err) {
      console.warn('Post submit error, kept in local state:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReplySubmit = async (postId: string) => {
    const content = replyContent.trim();
    if (!content) return;

    const author = replyAuthorName.trim() || '热心仙友';
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newReply: GuestbookReply = {
      id: `rep-${Date.now()}`,
      author,
      content,
      time: timeStr
    };

    // 乐观更新
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            replies: [...(p.replies || []), newReply]
          };
        }
        return p;
      })
    );

    setReplyContent('');
    setReplyingPostId(null);

    // 上报云端
    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply',
          postId,
          author,
          content,
          faxian_trap: honeypot
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.posts)) {
          setPosts(data.posts);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          alert(errData.error || '回复稍频，请稍后再试');
          // 回滚该回复
          setPosts(prev =>
            prev.map(p =>
              p.id === postId
                ? { ...p, replies: (p.replies || []).filter(r => r.id !== newReply.id) }
                : p
            )
          );
        }
      }
    } catch (err) {
      console.warn('Reply submit error:', err);
    }
  };

  const filteredPosts = posts.filter(p => {
    if (activeCategory === 'all') return true;
    return p.category === activeCategory;
  });

  return (
    <div className="w-full min-h-full bg-[#05080f] text-slate-100 flex flex-col justify-between select-none">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 w-full flex-1 flex flex-col gap-6">
        {/* 顶部标头与云端状态 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 shadow-sm shadow-amber-500/10">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-100 tracking-wide">
                仙友留言板
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono font-bold">
                共 {posts.length} 条
              </span>
            </div>
          </div>

          {/* 分类筛选药丸 */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1 mr-0.5" />
            {CATEGORIES.map(c => {
              const isActive = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveCategory(c.id)}
                  className={clsx(
                    'px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border cursor-pointer',
                    isActive
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 顶置发帖卡片 */}
        <form onSubmit={handlePostSubmit} className="p-4 sm:p-5 rounded-2xl bg-[#090d18]/90 border border-slate-800/90 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* 法号输入 */}
              <div className="flex items-center gap-1.5 bg-black/50 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400 font-medium">法号:</span>
                <input
                  type="text"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  maxLength={12}
                  className="bg-transparent text-slate-100 font-medium focus:outline-none w-24 text-xs"
                  placeholder="自定义法号"
                />
                <button
                  type="button"
                  onClick={handleRandomizeTitle}
                  className="text-amber-400 hover:text-amber-300 p-0.5 cursor-pointer transition-transform active:rotate-180"
                  title="随机仙门法号"
                >
                  <Dices className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 类别选择 */}
              <div className="flex items-center gap-1.5 bg-black/50 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-slate-400 font-medium">类别:</span>
                <select
                  value={newPostCategory}
                  onChange={e => setNewPostCategory(e.target.value as GuestbookCategory)}
                  className="bg-transparent text-amber-300 font-semibold focus:outline-none text-xs cursor-pointer"
                >
                  {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <span className="text-[11px] text-slate-500">
              与千万仙友真诚交流，共研诛仙万象大道
            </span>
          </div>

          {/* 防刷蜜罐陷阱：爬虫脚本若填值则被服务端静默拦截 */}
          <input
            type="text"
            name="faxian_trap"
            value={honeypot}
            onChange={e => setHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            style={{ display: 'none' }}
            aria-hidden="true"
          />

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              placeholder="写下你的战术心得、数据捉虫或建议（回车发送）..."
              maxLength={300}
              className="flex-1 bg-black/60 border border-slate-700/80 focus:border-amber-500/70 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!postContent.trim() || isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/40 cursor-pointer shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 text-slate-950 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-slate-950" />
              )}
              <span>{isSubmitting ? '同步中...' : '发布留言'}</span>
            </button>
          </div>
        </form>

        {/* 留言列表 */}
        <div className="space-y-4">
          {filteredPosts.map(post => {
            const isLiked = !!likedMap[post.id];
            const isReplying = replyingPostId === post.id;
            const replies = post.replies || [];

            return (
              <div
                key={post.id}
                className={clsx(
                  'rounded-2xl border p-4 sm:p-5 transition-all shadow-md',
                  post.isPinned
                    ? 'bg-gradient-to-br from-[#131b2e] to-[#0a101d] border-amber-500/40 shadow-amber-950/20'
                    : 'bg-[#090d16]/80 border-slate-800/80 hover:border-slate-700/80'
                )}
              >
                {/* 卡片头部：作者、时间、官方状态 */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    {post.isPinned && (
                      <span className="p-1 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40" title="置顶官方公告">
                        <Pin className="w-3 h-3" />
                      </span>
                    )}
                    <span className="font-bold text-sm text-slate-100">{post.author}</span>
                    <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.time}
                    </span>
                  </div>

                  {post.statusText && (
                    <span
                      className={clsx(
                        'px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
                        post.statusBadge === 'adopted'
                          ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                          : post.statusBadge === 'fixed'
                            ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
                            : 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                      )}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{post.statusText}</span>
                    </span>
                  )}
                </div>

                {/* 留言正文 */}
                <div className="text-sm text-slate-200 mt-3 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </div>

                {/* 底部互动操作栏：分类、点赞、回复按钮 */}
                <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-xs">
                    分类: {CATEGORIES.find(c => c.id === post.category)?.label || '论道'}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* 回复触发按钮 */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isReplying) {
                          setReplyingPostId(null);
                        } else {
                          setReplyingPostId(post.id);
                          setReplyContent('');
                        }
                      }}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border cursor-pointer',
                        isReplying
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>{replies.length > 0 ? `回复 (${replies.length})` : '回复'}</span>
                    </button>

                    {/* 点赞按钮 */}
                    <button
                      type="button"
                      onClick={() => handleLike(post.id)}
                      className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border cursor-pointer',
                        isLiked
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                      )}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>所言极是 ({post.likes})</span>
                    </button>
                  </div>
                </div>

                {/* 嵌套回复流列表 */}
                {replies.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                    {replies.map(r => (
                      <div
                        key={r.id}
                        className="text-xs p-2.5 rounded-xl bg-black/40 border border-slate-800/60 flex items-start justify-between gap-3"
                      >
                        <div className="flex-1 leading-relaxed">
                          <span
                            className={clsx(
                              'font-bold mr-1.5',
                              r.isAuthor ? 'text-cyan-300' : 'text-amber-300'
                            )}
                          >
                            {r.author}：
                          </span>
                          <span className="text-slate-200">{r.content}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 pt-0.5">
                          {r.time}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* 展开的回复输入框 */}
                {isReplying && (
                  <div className="mt-3 p-3 rounded-xl bg-black/50 border border-cyan-500/30 space-y-2.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <CornerDownRight className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-slate-400 font-medium">回复 @{post.author}</span>
                      </div>

                      {/* 回复者法号 */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-0.5 text-xs">
                        <span className="text-slate-400">法号:</span>
                        <input
                          type="text"
                          value={replyAuthorName}
                          onChange={e => setReplyAuthorName(e.target.value)}
                          maxLength={12}
                          className="bg-transparent text-slate-200 font-medium focus:outline-none w-20 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleRandomizeReplyTitle}
                          className="text-amber-400 hover:text-amber-300 p-0.5 cursor-pointer"
                          title="随机法号"
                        >
                          <Dices className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={replyContent}
                        onChange={e => setReplyContent(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleReplySubmit(post.id);
                        }}
                        placeholder={`回复 ${post.author}...`}
                        maxLength={200}
                        className="flex-1 bg-slate-950/80 border border-slate-700/80 focus:border-cyan-500/70 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleReplySubmit(post.id)}
                        disabled={!replyContent.trim()}
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0"
                      >
                        <Send className="w-3 h-3 text-slate-950" />
                        <span>发送</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyingPostId(null)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 cursor-pointer"
                        title="取消回复"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

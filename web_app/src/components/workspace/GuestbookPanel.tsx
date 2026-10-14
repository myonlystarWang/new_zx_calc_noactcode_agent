import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  ThumbsUp,
  Pin,
  Send,
  Dices,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';

export type GuestbookCategory = 'all' | 'suggestion' | 'bug' | 'build' | 'feature';

export interface GuestbookEntry {
  id: string;
  author: string;
  sect: string;
  category: GuestbookCategory;
  content: string;
  time: string;
  likes: number;
  isPinned?: boolean;
  statusBadge?: 'adopted' | 'in_progress' | 'fixed';
  statusText?: string;
  authorReply?: string;
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

const SECTS = [
  '天音', '逐霜', '青云', '合欢', '鬼道', '鬼王', '焚香', '烈山',
  '九黎', '怀光', '天华', '太昊', '辰皇', '牵机', '破军', '归云',
  '画影', '惊岚', '昭冥', '涅羽'
];

const INITIAL_POSTS: GuestbookEntry[] = [
  {
    id: 'pin-1',
    author: '星耀-萝卜 (作者)',
    sect: '天音',
    category: 'suggestion',
    content: '欢迎仙友光临天书万象 AI 全知工作台！本平台 100% 运行于 Cloudflare Pages 静态边缘计算，数据全量开源且零商业推广。任何技能公式误差、BOSS抗性校对或战力对比建议，均可在此留言交流！',
    time: '2026-10-14 12:00',
    likes: 88,
    isPinned: true,
    statusBadge: 'adopted',
    statusText: '官方公告',
    authorReply: '天地不仁，以万物为刍狗；天书通晓诛仙万象规则。'
  },
  {
    id: 'post-1',
    author: '玉清剑客',
    sect: '青云',
    category: 'bug',
    content: 'T20 首领的减爆伤数值在 1920% 左右，实测减免百分比在 91.5% 边界上存在阶段衰减，建议测算引擎增加对分阶段抗性波动的推演。',
    time: '2026-10-14 11:20',
    likes: 24,
    statusBadge: 'in_progress',
    statusText: '排期推演中',
    authorReply: '已收录该抗性采样样本，确定性战斗引擎将在下一补丁加入动态阶段系数。'
  },
  {
    id: 'post-2',
    author: '浮生未歇',
    sect: '逐霜',
    category: 'build',
    content: '佛逐霜配合天弈印记与 11 阶四象青龙策，破防无视达到 110% 后对 T20 碎晶宫爆发直接质变，推荐大家多堆无视！',
    time: '2026-10-14 10:45',
    likes: 36,
    statusBadge: 'adopted',
    statusText: '精选战术心得'
  },
  {
    id: 'post-3',
    author: '梵音清心',
    sect: '天音',
    category: 'feature',
    content: '希望能增加类似凝灵契 1:1 的完美度洗练模拟器，以及须弥天缘的极品上限对比，这样就不用在游戏里盲目消耗材料了！',
    time: '2026-10-14 09:30',
    likes: 52,
    statusBadge: 'fixed',
    statusText: '已在最新版上线',
    authorReply: '凝灵契与新版天缘模拟器已接入右侧多功能工作区，点击微工具即可体验！'
  }
];

const STORAGE_KEY = 'tianshu_guestbook_posts_v1';

export const GuestbookPanel: React.FC = () => {
  const [posts, setPosts] = useState<GuestbookEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_POSTS;
  });

  const [activeCategory, setActiveCategory] = useState<GuestbookCategory>('all');
  const [authorName, setAuthorName] = useState(() => {
    return IMMORTAL_TITLES[Math.floor(Math.random() * IMMORTAL_TITLES.length)];
  });
  const [selectedSect, setSelectedSect] = useState('天音');
  const [newPostCategory, setNewPostCategory] = useState<GuestbookCategory>('suggestion');
  const [postContent, setPostContent] = useState('');
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save guestbook posts', e);
    }
  }, [posts]);

  const handleRandomizeTitle = () => {
    const filtered = IMMORTAL_TITLES.filter(t => t !== authorName);
    const next = filtered[Math.floor(Math.random() * filtered.length)];
    setAuthorName(next);
  };

  const handleLike = (id: string) => {
    if (likedMap[id]) return;
    setLikedMap(prev => ({ ...prev, [id]: true }));
    setPosts(prev =>
      prev.map(p => (p.id === id ? { ...p, likes: p.likes + 1 } : p))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = postContent.trim();
    if (!content) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const newEntry: GuestbookEntry = {
      id: `post-${Date.now()}`,
      author: authorName.trim() || '匿踪仙友',
      sect: selectedSect,
      category: newPostCategory,
      content,
      time: timeStr,
      likes: 1
    };

    setPosts(prev => [prev[0], newEntry, ...prev.slice(1)]);
    setPostContent('');
  };

  const filteredPosts = posts.filter(p => {
    if (activeCategory === 'all') return true;
    return p.category === activeCategory;
  });

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] text-slate-200">
      {/* 头部说明栏 */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>仙友留言板 · 诛仙战术反馈墙</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60 font-mono">
                  共 {posts.length} 条论道
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                战术推演心得、数值机制捉虫、新功能催更，与全服仙友共同求索诛仙万象大道
              </p>
            </div>
          </div>
        </div>

        {/* 分类筛选药丸 */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-1 mr-0.5" />
          {CATEGORIES.map(c => {
            const isActive = activeCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap border',
                  isActive
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 滚动留言主卷轴 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {filteredPosts.map(post => {
          const isLiked = !!likedMap[post.id];
          return (
            <div
              key={post.id}
              className={clsx(
                'rounded-xl border p-4 transition-all',
                post.isPinned
                  ? 'bg-gradient-to-br from-[#172033] to-[#0d1424] border-amber-500/40 shadow-lg shadow-amber-950/20'
                  : 'bg-[#0e131d] border-slate-800 hover:border-slate-700'
              )}
            >
              {/* 卡片头部：作者、门派、时间、状态 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2">
                  {post.isPinned && (
                    <span className="p-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      <Pin className="w-3 h-3" />
                    </span>
                  )}
                  <span className="font-bold text-sm text-slate-100">{post.author}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                    {post.sect}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.time}
                  </span>
                </div>

                {post.statusText && (
                  <span
                    className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1',
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

              {/* 官方回复区块 */}
              {post.authorReply && (
                <div className="mt-3 p-3 rounded-lg bg-black/40 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>天书道祖回复：</span>
                  </div>
                  <p className="leading-relaxed text-slate-300">{post.authorReply}</p>
                </div>
              )}

              {/* 底部点赞互动 */}
              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  分类: {CATEGORIES.find(c => c.id === post.category)?.label || '论道'}
                </span>

                <button
                  type="button"
                  onClick={() => handleLike(post.id)}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all border',
                    isLiked
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                  )}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>仙友所言极是 ({post.likes})</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部留言表单 */}
      <form onSubmit={handleSubmit} className="p-3.5 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md shrink-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* 仙门法号输入与随机化 */}
          <div className="flex items-center gap-1 bg-black/50 border border-slate-700 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-400">法号:</span>
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
              className="text-amber-400 hover:text-amber-300 p-0.5"
              title="随机仙门法号"
            >
              <Dices className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 门派选择 */}
          <div className="flex items-center gap-1 bg-black/50 border border-slate-700 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-400">门派:</span>
            <select
              value={selectedSect}
              onChange={e => setSelectedSect(e.target.value)}
              className="bg-transparent text-cyan-300 font-medium focus:outline-none text-xs cursor-pointer"
            >
              {SECTS.map(s => (
                <option key={s} value={s} className="bg-slate-900 text-slate-100">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* 留言分类选择 */}
          <div className="flex items-center gap-1 bg-black/50 border border-slate-700 rounded-lg px-2 py-1 text-xs">
            <span className="text-slate-400">类别:</span>
            <select
              value={newPostCategory}
              onChange={e => setNewPostCategory(e.target.value as GuestbookCategory)}
              className="bg-transparent text-amber-300 font-medium focus:outline-none text-xs cursor-pointer"
            >
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-slate-100">
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 留言内容富输入 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            placeholder="写下你的战术心得、抗性捉虫或建议（回车发送）..."
            maxLength={300}
            className="flex-1 bg-black/60 border border-slate-700 focus:border-amber-500/80 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!postContent.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-950/50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>论道发布</span>
          </button>
        </div>
      </form>
    </div>
  );
};

import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Sparkles,
  Bug,
  Zap,
  Database,
  ArrowUp,
  Calendar,
  Filter,
  Search,
  ShieldCheck,
  Code2,
  Heart
} from 'lucide-react';
import clsx from 'clsx';
import { CHANGELOG, type ChangeType, type ChangelogEntry } from '../../data/changelog';
import { CURRENT_VERSION, markChangelogSeen } from '../../utils/changelogSeen';

/**
 * 变更类型配置：沿用关于本站与留言板一致的低饱和度配色配方
 */
const TYPE_META: Record<
  ChangeType,
  { label: string; icon: React.FC<{ className?: string }>; tint: string; dot: string; iconCls: string }
> = {
  feat: {
    label: '新功能',
    icon: Sparkles,
    tint: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    dot: 'bg-cyan-400',
    iconCls: 'text-cyan-400'
  },
  fix: {
    label: '修复',
    icon: Bug,
    tint: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    dot: 'bg-rose-400',
    iconCls: 'text-rose-400'
  },
  perf: {
    label: '优化',
    icon: Zap,
    tint: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    dot: 'bg-amber-400',
    iconCls: 'text-amber-400'
  },
  data: {
    label: '数值校准',
    icon: Database,
    tint: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    dot: 'bg-emerald-400',
    iconCls: 'text-emerald-400'
  }
};

const TYPE_LIST: ChangeType[] = ['feat', 'fix', 'perf', 'data'];
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getWeekday(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return WEEKDAYS[d.getDay()] || '';
  }
  return '';
}

function getFormattedDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0]} 年 ${parts[1]} 月 ${parts[2]} 日`;
  }
  return dateStr;
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  return `${y} 年 ${m} 月`;
}

/**
 * 文本冒号拆分：加粗前缀标题，提升阅读扫描体验
 */
function renderChangeText(text: string) {
  const colonIdx = text.indexOf('：') !== -1 ? text.indexOf('：') : text.indexOf(':');
  if (colonIdx > 0 && colonIdx < 35) {
    const prefix = text.slice(0, colonIdx);
    const suffix = text.slice(colonIdx + 1);
    return (
      <span className="leading-relaxed">
        <strong className="font-bold text-slate-100 tracking-wide">{prefix}：</strong>
        <span className="text-slate-300">{suffix}</span>
      </span>
    );
  }
  return <span className="leading-relaxed text-slate-300">{text}</span>;
}

export const ChangelogPage: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // 进入本页即标记当前版本已读，清空 Header NEW 徽章
  useEffect(() => {
    markChangelogSeen(CURRENT_VERSION);
  }, []);

  // 监听容器滚动，控制回到顶部按钮显隐
  useEffect(() => {
    const el = containerRef.current;
    const scrollParent = el?.closest('.overflow-y-auto') || window;

    const handleScroll = () => {
      const parent = el?.closest('.overflow-y-auto');
      const currentScrollTop = parent ? parent.scrollTop : window.scrollY;
      setShowBackToTop(currentScrollTop > 280);
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollParent.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    const scrollParent = containerRef.current?.closest('.overflow-y-auto');
    if (scrollParent) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [activeCategory, setActiveCategory] = useState<'all' | ChangeType>('all');
  const [activeMonth, setActiveMonth] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 统计各类变更条目与月份数据
  const { countsByType, totalChanges, monthGroups } = useMemo(() => {
    const counts = { all: 0, feat: 0, fix: 0, perf: 0, data: 0 };
    const monthMap = new Map<string, number>();

    CHANGELOG.forEach(entry => {
      counts.all += entry.changes.length;
      const m = getMonthKey(entry.date);
      monthMap.set(m, (monthMap.get(m) || 0) + 1);

      entry.changes.forEach(c => {
        if (counts[c.type] !== undefined) {
          counts[c.type]++;
        }
      });
    });

    const months = Array.from(monthMap.entries()).map(([key, count]) => ({
      key,
      label: formatMonthLabel(key),
      count
    }));

    return {
      countsByType: counts,
      totalChanges: counts.all,
      monthGroups: months
    };
  }, []);

  // 过滤后的版本列表
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return CHANGELOG.map(entry => {
      if (activeMonth !== 'all' && getMonthKey(entry.date) !== activeMonth) {
        return null;
      }

      const matchingChanges = entry.changes.filter(c => {
        if (activeCategory !== 'all' && c.type !== activeCategory) {
          return false;
        }
        if (q) {
          const matchesText = c.text.toLowerCase().includes(q);
          const matchesVersion = entry.version.toLowerCase().includes(q);
          const matchesTitle = entry.title.toLowerCase().includes(q);
          return matchesText || matchesVersion || matchesTitle;
        }
        return true;
      });

      if (matchingChanges.length === 0) {
        if (q && (entry.version.toLowerCase().includes(q) || entry.title.toLowerCase().includes(q))) {
          if (activeCategory === 'all') {
            return entry;
          }
        }
        return null;
      }

      return {
        ...entry,
        changes: matchingChanges
      };
    }).filter((entry): entry is ChangelogEntry => entry !== null);
  }, [activeCategory, activeMonth, searchQuery]);

  const hasFilterActive = activeCategory !== 'all' || activeMonth !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setActiveCategory('all');
    setActiveMonth('all');
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className="w-full min-h-full bg-[#05080f] text-slate-100 flex flex-col justify-between select-none relative"
    >
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 md:py-16 max-w-4xl mx-auto w-full space-y-10 sm:space-y-12">
        {/* 顶部 Hero 标头区（与「关于本站」风格 1:1 保持一致，居中道风引言与 4 大指标面板） */}
        <div className="flex flex-col items-center text-center max-w-3xl w-full">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-amber-300 mb-4">
            天书万象 AI · 更新动态
          </h1>

          {/* <p className="text-sm sm:text-base text-slate-400 font-serif-sc tracking-[0.22em] text-shadow mb-6">
            天地不仁以万物为刍狗 · 天书通晓诛仙万象规则
          </p> */}

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl text-center">
            天书万象 AI 诛仙全知大模型、底层伤害公式拟合与微工具集持续演进记录。
            每一次技能机制校正、BOSS属性实测拟合与模拟器迭代均在此记录，让每一次修真抉择皆有确凿数据支撑。
          </p>

          {/* 4 大核心关键指标看板（同 AboutPage 布局） */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full mt-8 pt-6 border-t border-slate-800/80">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300 font-mono">
                V {CURRENT_VERSION}
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                当前生效版本
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 font-mono">
                {CHANGELOG.length}
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">历史里程碑版本</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 font-mono">
                {totalChanges}+
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">全域功能算法改动</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300 font-mono">
                100%
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">版本变动可测可验</span>
            </div>
          </div>
        </div>

        {/* 筛选与搜索控制栏（与「仙友留言板」完全一致的胶囊筛选条与输入框风格） */}
        <div className="w-full space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            {/* 分类筛选药丸 */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0 ml-0.5 mr-1" />
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className={clsx(
                  'px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border cursor-pointer',
                  activeCategory === 'all'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                )}
              >
                全部 ({countsByType.all})
              </button>
              {TYPE_LIST.map(t => {
                const meta = TYPE_META[t];
                const isActive = activeCategory === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setActiveCategory(t)}
                    className={clsx(
                      'px-3 py-1 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border cursor-pointer flex items-center gap-1.5',
                      isActive
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', meta.dot)} />
                    <span>{meta.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({countsByType[t]})</span>
                  </button>
                );
              })}
            </div>

            {/* 右侧：月份选择与快速检索输入框（同留言板输入框规范） */}
            <div className="flex items-center gap-2.5">
              {/* 月份下拉 */}
              <div className="flex items-center gap-1.5 bg-black/50 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs shrink-0">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={activeMonth}
                  onChange={e => setActiveMonth(e.target.value)}
                  className="bg-transparent text-slate-200 font-medium focus:outline-none text-xs cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-100">全部月份</option>
                  {monthGroups.map(m => (
                    <option key={m.key} value={m.key} className="bg-slate-900 text-slate-100">
                      {m.label} ({m.count}条)
                    </option>
                  ))}
                </select>
              </div>

              {/* 搜索框 */}
              {/* <div className="flex items-center gap-1.5 bg-black/50 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs flex-1 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索更新、技能..."
                  className="bg-transparent text-slate-100 font-medium focus:outline-none w-full text-xs placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div> */}
            </div>
          </div>

          {/* 筛选激活提示条 */}
          {hasFilterActive && (
            <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <span>
                当前已筛选出 <strong className="font-bold text-white">{filteredEntries.length}</strong> 个版本记录
                {activeCategory !== 'all' && ` · ${TYPE_META[activeCategory].label}`}
                {activeMonth !== 'all' && ` · ${formatMonthLabel(activeMonth)}`}
                {searchQuery && ` · 包含"${searchQuery}"`}
              </span>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-slate-400 hover:text-amber-200 underline underline-offset-2 cursor-pointer font-medium ml-3"
              >
                重置筛选
              </button>
            </div>
          )}
        </div>

        {/* 版本时间轴卡片列表（同留言板卡片设计规范） */}
        <div className="w-full space-y-4">
          {filteredEntries.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#090d18]/90 border border-slate-800/90 flex flex-col items-center justify-center text-center space-y-3 shadow-xl">
              <Search className="w-8 h-8 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-300">未检索到匹配的更新记录</h3>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                可尝试缩减关键词，或清除筛选条件查看完整日志。
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-xs text-cyan-300 font-bold hover:bg-cyan-500/30 transition-all cursor-pointer mt-1"
              >
                查看全部版本
              </button>
            </div>
          ) : (
            filteredEntries.map((entry, idx) => {
              const isLatest = idx === 0 && !hasFilterActive;
              const weekday = getWeekday(entry.date);
              const formattedDate = getFormattedDate(entry.date);

              return (
                <article
                  key={entry.version}
                  className={clsx(
                    'p-5 sm:p-6 rounded-2xl transition-all shadow-xl space-y-3.5',
                    isLatest
                      ? 'bg-gradient-to-b from-[#0e1628]/90 to-[#090d18]/90 border border-cyan-500/40 shadow-cyan-950/20 hover:border-cyan-500/60'
                      : 'bg-[#090d18]/90 border border-slate-800/90 hover:border-slate-700/80'
                  )}
                >
                  {/* 卡片顶栏：版本号、日期与星期、变动数胶囊 */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 min-w-0">
                      <span
                        className={clsx(
                          'font-mono font-black text-sm sm:text-base px-2.5 py-0.5 rounded-lg border whitespace-nowrap shrink-0',
                          isLatest
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                            : 'bg-slate-900 border-slate-700/80 text-slate-200'
                        )}
                      >
                        V {entry.version}
                      </span>

                      {isLatest && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          当前最新
                        </span>
                      )}

                      {/* 窄屏用紧凑日期，避免「2026 年 10 月 24 日」被拆成多行 */}
                      <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5 ml-1 whitespace-nowrap shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="sm:hidden">
                          {entry.date}
                          {weekday && ` · ${weekday}`}
                        </span>
                        <span className="hidden sm:inline">
                          {formattedDate}
                          {weekday && <span className="text-slate-500"> · {weekday}</span>}
                        </span>
                      </span>
                    </div>

                    {/* <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono font-bold">
                      共 {entry.changes.length} 项变动
                    </span> */}
                  </div>

                  {/* 版本一句话核心主题 */}
                  <h3 className="text-sm sm:text-base font-bold text-slate-100 tracking-wide leading-snug">
                    {entry.title}
                  </h3>

                  {/* 变动条目列表 */}
                  <ul className="space-y-2.5 pt-1">
                    {entry.changes.map((change, cIdx) => {
                      const meta = TYPE_META[change.type];

                      return (
                        <li
                          key={cIdx}
                          className="flex items-start gap-2.5 text-xs sm:text-[13px] group"
                        >
                          <span
                            className={clsx(
                              'mt-0.5 shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border transition-transform group-hover:scale-105',
                              meta.tint
                            )}
                          >
                            <span className={clsx('w-1 h-1 rounded-full', meta.dot)} />
                            <span>{meta.label}</span>
                          </span>

                          <div className="flex-1 min-w-0">
                            {renderChangeText(change.text)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })
          )}
        </div>

        {/* 纯净开源原则（1:1 复制自 AboutPage，保持全站底部统一） */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <ShieldCheck className="w-4 h-4 text-cyan-400/80 shrink-0" />
            <span>100% 静态边缘计算 · 零隐私上传</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Code2 className="w-4 h-4 text-amber-400/80 shrink-0" />
            <span>真实数据全量开放 · 拒绝任何虚假宣传</span>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-end">
            <Heart className="w-4 h-4 text-rose-400/80 shrink-0" />
            <span>纯粹由热爱驱动 · 与全服仙友共建</span>
          </div>
        </div>
      </div>

      {/* 滚动回到顶部悬浮圆形按钮（样式 1:1 还原用户参考图，白底黑箭头高对比度浮动） */}
      <button
        type="button"
        onClick={handleScrollToTop}
        aria-label="回到顶部"
        title="回到顶部"
        className={clsx(
          'fixed bottom-8 right-6 sm:right-10 z-50 w-11 h-11 rounded-full bg-white text-slate-800 shadow-xl shadow-black/40 border border-slate-200/60 flex items-center justify-center cursor-pointer transition-all duration-300 ease-out hover:bg-slate-100 hover:scale-110 active:scale-95',
          showBackToTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <ArrowUp className="w-5 h-5 stroke-[2.2]" />
      </button>
    </div>
  );
};

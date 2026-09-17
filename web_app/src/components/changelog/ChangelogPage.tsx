import React, { useEffect } from 'react';
import { History, Sparkles, Bug, Zap, Database, type LucideIcon } from 'lucide-react';
import { CHANGELOG, type ChangeType } from '../../data/changelog';
import { CURRENT_VERSION, markChangelogSeen } from '../../utils/changelogSeen';

/**
 * 变更类型 → 文案 + 图标 + 标签配色。
 *
 * 配色沿用「极致属性攻略」页 `DOMAINS` 的低饱和配方（`bg-X-500/15 border-X-500/30 text-X-300`、图标 `text-X-400`），
 * 四类各一个色相（青 / 玫瑰 / 琥珀 / 青绿）；颜色只出现在 10~11px 的小标签上，页面其余部分
 * 仍是青 + 白/灰（最新条目的版本号、左轨与节点为唯一强调色）。
 */
const TYPE_META: Record<ChangeType, { label: string; icon: LucideIcon; tint: string; iconCls: string }> = {
    feat: { label: '新功能', icon: Sparkles, tint: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300', iconCls: 'text-cyan-400' },
    fix: { label: '修复', icon: Bug, tint: 'bg-rose-500/15 border-rose-500/30 text-rose-300', iconCls: 'text-rose-400' },
    perf: { label: '更快', icon: Zap, tint: 'bg-amber-500/15 border-amber-500/30 text-amber-300', iconCls: 'text-amber-400' },
    data: { label: '内容更新', icon: Database, tint: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', iconCls: 'text-emerald-400' },
};

const TYPE_ORDER: ChangeType[] = ['feat', 'fix', 'perf', 'data'];

/** 面板/卡片底：与攻略页顶栏、分组卡完全同一套 */
const PANEL_CLS = 'bg-slate-900/70 border border-slate-800/80 rounded-2xl shadow-lg';

/**
 * 更新日志页面（Step 11.3）
 *
 * - 时间线展示版本历史，数组第 0 条即当前版本
 * - **进入本页即标记已读**（用户拍板，覆盖直链 / 刷新 / 搜索跳转等所有进入方式）
 * - 配色：面板/卡片走 `slate-900/70 + slate-800/80` 玻璃底；主强调色青（最新条目的版本号、当前版本节点与左轨）；
 *   四类标签用 TYPE_META.tint 的低饱和色相（青/玫瑰/琥珀/青绿），页面其余部分只用青 + 白/灰
 * - 页头不放版本号 pill：Header 徽章与最新条目已各有一处，第三处是重复
 */
export const ChangelogPage: React.FC = () => {
    useEffect(() => {
        markChangelogSeen(CURRENT_VERSION);
    }, []);

    return (
        <div className="w-full max-w-[1040px] mx-auto px-4 xl:px-6 pt-5 pb-14 animate-in fade-in duration-300">
            {/* 页头面板 */}
            <header className={`${PANEL_CLS} p-4 sm:px-5 mb-5 flex flex-col gap-3.5`}>
                {/* 不放「当前版本 x.y.z」pill：Header 徽章已有版本号，下方最新条目也有标记，三是重复 */}
                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-wide">更新日志</h2>

                <p className="text-[13px] leading-relaxed text-slate-400">
                    每次更新改了什么、加了什么、在哪用，都记在这里；最新的版本排在最上面。
                </p>

                {/* 图例：与条目内标签同一套配色 */}
                <div className="flex flex-wrap items-center gap-2">
                    {TYPE_ORDER.map((t) => {
                        const meta = TYPE_META[t];
                        const Icon = meta.icon;
                        return (
                            <span
                                key={t}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border ${meta.tint}`}
                            >
                                <Icon className={`w-3.5 h-3.5 ${meta.iconCls}`} aria-hidden />
                                {meta.label}
                            </span>
                        );
                    })}
                </div>
            </header>

            {/* 时间线 */}
            <ol className="relative">
                <span
                    className="absolute left-[13px] top-3 bottom-6 w-px bg-gradient-to-b from-cyan-500/30 via-slate-700/60 to-transparent"
                    aria-hidden
                />
                {CHANGELOG.map((entry, idx) => {
                    const isLatest = idx === 0;
                    return (
                        <li key={entry.version} className="relative pl-10 md:pl-12 pb-4 last:pb-0">
                            {/* 时间线节点：当前版本用主强调色 */}
                            <span
                                className={`absolute left-0 top-3 w-[27px] h-[27px] rounded-full border flex items-center justify-center ${
                                    isLatest
                                        ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                        : 'border-slate-800 bg-slate-900 text-slate-500'
                                }`}
                                aria-hidden
                            >
                                <History className="w-3.5 h-3.5" />
                            </span>

                            <article
                                className={`relative overflow-hidden rounded-2xl border p-4 md:p-5 transition-all shadow-lg ${
                                    isLatest
                                        ? 'bg-slate-900/70 border-cyan-500/35 hover:border-cyan-500/55'
                                        : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80'
                                }`}
                            >
                                {/* 当前版本：2px 主强调色左轨 */}
                                {isLatest && (
                                    <span className="absolute left-0 top-4 bottom-4 w-[2px] rounded-r bg-cyan-400/70" aria-hidden />
                                )}

                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span
                                        className={`font-mono font-black text-sm ${isLatest ? 'text-cyan-300' : 'text-slate-200'}`}
                                    >
                                        V {entry.version}
                                    </span>
                                    {isLatest && (
                                        <span className="px-2 py-0.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold">
                                            当前版本
                                        </span>
                                    )}
                                    <span className="text-xs text-slate-400 font-mono">{entry.date}</span>
                                </div>

                                <h3 className="mt-2 text-sm md:text-[15px] font-bold text-slate-100 leading-snug">{entry.title}</h3>

                                <ul className="mt-3 space-y-2">
                                    {entry.changes.map((change, i) => {
                                        const meta = TYPE_META[change.type];
                                        const Icon = meta.icon;
                                        return (
                                            <li key={i} className="flex items-start gap-2.5">
                                                <span
                                                    className={`mt-[1px] shrink-0 inline-flex items-center gap-1 px-1.5 py-[3px] rounded-md text-[10px] font-bold border ${meta.tint}`}
                                                >
                                                    <Icon className={`w-3 h-3 ${meta.iconCls}`} aria-hidden />
                                                    {meta.label}
                                                </span>
                                                <span className="text-[13px] leading-relaxed text-slate-300">{change.text}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </article>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};

import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../../services/DataService';
import { BookOpen, Shield, Swords, Target, Users, CheckCircle, AlertCircle, Search } from 'lucide-react';
import clsx from 'clsx';
import type { AttributeCeilingRow, SupportRole, StatSourceSection } from '../../services/DataService';
import type { SearchTarget } from '../GlobalSearch';

export type SubTab = 'ignore' | 'reduction' | 'critReduction' | 'monsterDamageBonus' | 'dodge' | 'support';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ignore', label: '极致无视', icon: <Target className="w-4 h-4" /> },
    { id: 'reduction', label: '极致减免', icon: <Shield className="w-4 h-4" /> },
    { id: 'critReduction', label: '极致减暴击', icon: <Swords className="w-4 h-4" /> },
    { id: 'monsterDamageBonus', label: '极致怪增', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'dodge', label: '极致躲闪', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'support', label: '各职业状态', icon: <Users className="w-4 h-4" /> },
];

const CATEGORY_COLORS = [
    'border-l-cyan-500/60',
    'border-l-emerald-500/60',
    'border-l-amber-500/60',
    'border-l-rose-500/60',
    'border-l-purple-500/60',
    'border-l-blue-500/60',
    'border-l-orange-500/60',
    'border-l-pink-500/60',
];

const CATEGORY_TEXT_COLORS = [
    'text-cyan-400', 'text-emerald-400', 'text-amber-400', 'text-rose-400',
    'text-purple-400', 'text-blue-400', 'text-orange-400', 'text-pink-400',
];

const CATEGORY_BG_COLORS = [
    'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
    'bg-purple-500', 'bg-blue-500', 'bg-orange-500', 'bg-pink-500',
];

const renderValue = (v: number | string | undefined) => {
    if (v === undefined || v === null) return '-';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
    return v;
};

const SectionTitle: React.FC<{ title: string; total?: number; verified?: boolean }> = ({ title, total, verified }) => (
    <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="text-lg sm:text-xl font-bold text-slate-100 truncate">{title}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
            {total !== undefined && (
                <span className="text-xs sm:text-sm font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 rounded-lg">
                    合计 {Number.isInteger(total) ? total : total.toFixed(2)}
                </span>
            )}
            {verified ? (
                <span className="hidden sm:flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle className="w-4 h-4" /> 已核对
                </span>
            ) : (
                <span className="hidden sm:flex items-center gap-1 text-sm text-amber-400">
                    <AlertCircle className="w-4 h-4" /> 未核对
                </span>
            )}
        </div>
    </div>
);

const catIndex = (category: string) => {
    let hash = 0;
    for (let i = 0; i < category.length; i++) hash = category.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % CATEGORY_COLORS.length;
};
const catColor = (category: string) => CATEGORY_COLORS[catIndex(category)];
const catTextColor = (category: string) => CATEGORY_TEXT_COLORS[catIndex(category)];
const catBarColor = (category: string) => CATEGORY_BG_COLORS[catIndex(category)];

/* ---- 极致无视/减免/减暴击：移动端卡片行 ---- */
const MobileAttrRow: React.FC<{ row: AttributeCeilingRow }> = ({ row }) => (
    <div data-item={row.item} className="flex flex-col gap-1.5 py-2 border-b border-slate-700/30 last:border-0 last:pb-0">
        <div className="text-base font-medium text-slate-100">{row.item}</div>
        <div className="grid grid-cols-4 gap-1.5">
            {[
                { label: '理论最高', value: row.theoryMax, color: 'text-cyan-300' },
                { label: '夯', value: row.floor, color: 'text-slate-300' },
                { label: '顶级', value: row.top, color: 'text-slate-300' },
                { label: '毕业', value: row.graduation, color: 'text-slate-300' },
            ].map((c) => (
                <div key={c.label} className="flex flex-col items-center bg-slate-900/50 rounded-lg py-1.5">
                    <span className="text-[10px] text-slate-500 mb-0.5">{c.label}</span>
                    <span className={clsx('text-sm font-mono', c.color)}>{renderValue(c.value)}</span>
                </div>
            ))}
        </div>
    </div>
);

const AttributeTable: React.FC<{ sectionKey: string; sectionTitle: string }> = ({ sectionKey, sectionTitle }) => {
    const guide = DataService.getInstance().getAttributeCeilingGuide();
    const section = guide?.sections[sectionKey];

    if (!guide || !section) {
        return <div className="text-slate-400 text-base">数据加载中...</div>;
    }

    const grouped = useMemo(() => {
        const map = new Map<string, AttributeCeilingRow[]>();
        for (const row of section.rows) {
            const list = map.get(row.category) || [];
            list.push(row);
            map.set(row.category, list);
        }
        return Array.from(map.entries());
    }, [section.rows]);

    return (
        <div className="zx-card p-4 sm:p-5">
            <SectionTitle title={sectionTitle} total={section.total} verified={section.verified} />

            {/* 桌面端：表格 */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-base">
                    <thead>
                        <tr className="border-b border-slate-700/70 text-slate-400">
                            <th className="text-left py-2.5 px-3 font-medium w-28">类别</th>
                            <th className="text-left py-2.5 px-3 font-medium">项目</th>
                            <th className="text-right py-2.5 px-3 font-medium w-24">理论最高</th>
                            <th className="text-right py-2.5 px-3 font-medium w-24">夯</th>
                            <th className="text-right py-2.5 px-3 font-medium w-24">顶级</th>
                            <th className="text-right py-2.5 px-3 font-medium w-28">大致毕业</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grouped.map(([category, rows]) => (
                            <React.Fragment key={category}>
                                {grouped.length > 1 && (
                                    <tr className={clsx('border-l-4 bg-slate-800/40', catColor(category))}>
                                        <td colSpan={6} className="py-1.5 px-3 text-sm font-bold text-slate-300 tracking-wide">
                                            {category}
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        data-item={row.item}
                                        className={clsx(
                                            'border-l-4 hover:bg-slate-800/30 transition-colors',
                                            grouped.length > 1 ? catColor(category) : 'border-l-transparent',
                                            idx !== rows.length - 1 && 'border-b border-slate-700/20'
                                        )}
                                    >
                                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap align-top">
                                            {grouped.length > 1 ? <span className="opacity-0">{category}</span> : category}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-200 align-top">{row.item}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-cyan-300 align-top">{renderValue(row.theoryMax)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 align-top">{renderValue(row.floor)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 align-top">{renderValue(row.top)}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 align-top">{renderValue(row.graduation)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 移动端：分组卡片 */}
            <div className="sm:hidden flex flex-col gap-3">
                {grouped.map(([category, rows]) => (
                    <div
                        key={category}
                        className={clsx('zx-card p-3 border-l-4', grouped.length > 1 ? catColor(category) : 'border-l-transparent')}
                    >
                        {grouped.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('w-1 h-4 rounded-full', catBarColor(category))}></span>
                                <span className={clsx('text-sm font-bold tracking-wide', catTextColor(category))}>{category}</span>
                            </div>
                        )}
                        <div className="flex flex-col">
                            {rows.map((row, idx) => (
                                <MobileAttrRow key={idx} row={row} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-sm text-slate-500 mt-4">数据截至 {guide.asOf}，玩家总结仅供参考</p>
        </div>
    );
};

/* ---- 极致怪增/躲闪：移动端卡片行 ---- */
const MobileSourceRow: React.FC<{ row: StatSourceSection['sources'][number]; category: string; showCategory: boolean }> = ({ row, category, showCategory }) => (
    <div data-item={row.item} className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0 last:pb-0">
        <div className="flex flex-col min-w-0 pr-2">
            {showCategory && <span className="text-[10px] text-slate-500">{category}</span>}
            <span className="text-base text-slate-200 break-words">{row.item}</span>
        </div>
        <span className="font-mono text-cyan-300 text-base flex-shrink-0">{renderValue(row.value)}</span>
    </div>
);

const SourceSectionView: React.FC<{ section: StatSourceSection; showConditional?: boolean; valueColumnLabel?: string }> = ({ section, showConditional = true, valueColumnLabel = '数值' }) => {
    const grouped = useMemo(() => {
        const map = new Map<string, typeof section.sources>();
        for (const row of section.sources) {
            const cat = row.category || '其他';
            const list = map.get(cat) || [];
            list.push(row);
            map.set(cat, list);
        }
        return Array.from(map.entries());
    }, [section.sources]);

    return (
        <div className="zx-card p-4 sm:p-5">
            <SectionTitle
                title={section.title}
                total={section.grandTotal ?? section.total ?? section.subtotal}
                verified={section.verified}
            />

            {/* 桌面端：表格 */}
            <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-base">
                    <thead>
                        <tr className="border-b border-slate-700/70 text-slate-400">
                            <th className="text-left py-2.5 px-3 font-medium w-28">类别</th>
                            <th className="text-left py-2.5 px-3 font-medium">项目</th>
                            <th className="text-right py-2.5 px-3 font-medium w-28">{valueColumnLabel}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grouped.map(([category, rows]) => (
                            <React.Fragment key={category}>
                                {grouped.length > 1 && (
                                    <tr className={clsx('border-l-4 bg-slate-800/40', catColor(category))}>
                                        <td colSpan={3} className="py-1.5 px-3 text-sm font-bold text-slate-300 tracking-wide">
                                            {category}
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        data-item={row.item}
                                        className={clsx(
                                            'border-l-4 hover:bg-slate-800/30 transition-colors',
                                            grouped.length > 1 ? catColor(category) : 'border-l-transparent',
                                            idx !== rows.length - 1 && 'border-b border-slate-700/20'
                                        )}
                                    >
                                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap align-top">
                                            {grouped.length > 1 ? <span className="opacity-0">{category}</span> : category}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-200 align-top">{row.item}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-cyan-300 align-top">{renderValue(row.value)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {showConditional && section.conditionals && section.conditionals.length > 0 && (
                            <>
                                <tr className="bg-slate-800/40">
                                    <td colSpan={3} className="py-2 px-3 text-sm text-slate-400 font-medium">条件项（额外加成，非基础合计）</td>
                                </tr>
                                {section.conditionals.map((row, idx) => (
                                    <tr key={`c-${idx}`} className="hover:bg-slate-800/30 transition-colors border-l-4 border-l-transparent">
                                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap align-top">{row.category || '-'}</td>
                                        <td className="py-2.5 px-3 text-slate-400 align-top">{row.item}</td>
                                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 align-top">{renderValue(row.value)}</td>
                                    </tr>
                                ))}
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 移动端：分组卡片 */}
            <div className="sm:hidden flex flex-col gap-3">
                {grouped.map(([category, rows]) => (
                    <div
                        key={category}
                        className={clsx('zx-card p-3 border-l-4', grouped.length > 1 ? catColor(category) : 'border-l-transparent')}
                    >
                        {grouped.length > 1 && (
                            <div className="flex items-center gap-2 mb-2">
                                <span className={clsx('w-1 h-4 rounded-full', catBarColor(category))}></span>
                                <span className={clsx('text-sm font-bold tracking-wide', catTextColor(category))}>{category}</span>
                            </div>
                        )}
                        <div className="flex flex-col">
                            {rows.map((row, idx) => (
                                <MobileSourceRow
                                    key={idx}
                                    row={row}
                                    category={category}
                                    showCategory={grouped.length > 1}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {showConditional && section.conditionals && section.conditionals.length > 0 && (
                    <div className="zx-card p-3 border-l-4 border-l-transparent">
                        <div className="text-sm font-bold text-slate-400 mb-1.5">条件项（额外加成，非基础合计）</div>
                        <div className="flex flex-col">
                            {section.conditionals.map((row, idx) => (
                                <MobileSourceRow key={`c-${idx}`} row={row} category={row.category || '-'} showCategory />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {section.totalLabel && (
                <p className="text-sm text-slate-500 mt-4">{section.totalLabel}</p>
            )}
        </div>
    );
};

/** 评级排序权重：S+ → S → A+ → A → 其他（如输出职业） */
const RATING_ORDER = ['S+', 'S', 'A+', 'A', 'B+', 'B', 'C'];
const ratingRank = (rating?: string): number => {
    if (!rating) return RATING_ORDER.length;
    const idx = RATING_ORDER.indexOf(rating);
    return idx >= 0 ? idx : RATING_ORDER.length;
};

const isZeroValue = (v: number | string | undefined): boolean => {
    if (v === undefined || v === null) return false;
    if (typeof v === 'number') return v === 0;
    const n = Number(v);
    return !Number.isNaN(n) && n === 0;
};

// 把 '70+' / '27+' 这类字符串取首个整数，用于排序
const metricValue = (v: number | string | undefined): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const m = v.match(/^(\d+)(?:\+.*)?$/);
        return m ? parseInt(m[1], 10) : 0;
    }
    return 0;
};

const SupportCard: React.FC<{ role: SupportRole; metrics: string[] }> = ({ role, metrics }) => {
    const metricPairs = [
        { label: metrics[0] ?? '易伤', value: role.damageBoost, color: 'text-amber-400' },
        { label: metrics[1] ?? '绿点', value: role.greenPoint, color: 'text-emerald-400' },
        { label: metrics[2] ?? '紫点', value: role.purplePoint, color: 'text-purple-400' },
        { label: metrics[3] ?? '破防', value: role.defenseBreak, color: 'text-rose-400' },
        { label: metrics[4] ?? '专注', value: role.focus ?? 0, color: 'text-orange-400' },
    ].sort((a, b) => Number(isZeroValue(a.value)) - Number(isZeroValue(b.value)));

    const ratingColor = (r: string) => {
        if (r.startsWith('S+')) return 'text-yellow-400 border-yellow-400/50 bg-yellow-500/10';
        if (r.startsWith('S')) return 'text-amber-400 border-amber-400/50 bg-amber-500/10';
        if (r.startsWith('A+')) return 'text-emerald-400 border-emerald-400/50 bg-emerald-500/10';
        return 'text-slate-300 border-slate-500/50 bg-slate-500/10';
    };

    const factionColor = (f: string) => {
        const key = f.charAt(0); // 支持组合阵营（如 魔佛/仙佛），按首字符取色
        if (key === '仙') return 'text-sky-300 border-sky-400/50 bg-sky-500/15 shadow-[0_0_10px_rgba(56,189,248,0.30)]';
        if (key === '佛') return 'text-amber-300 border-amber-400/50 bg-amber-500/15 shadow-[0_0_10px_rgba(251,191,36,0.30)]';
        if (key === '魔') return 'text-purple-300 border-purple-400/50 bg-purple-500/15 shadow-[0_0_10px_rgba(168,85,247,0.35)]';
        return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    };

    // 组合阵营（魔佛/仙佛）：每字独立配色，拼接为一个徽章
    const factionSegColor = (ch: string) => {
        if (ch === '仙') return 'text-sky-300 border-sky-400/50 bg-sky-500/15';
        if (ch === '佛') return 'text-amber-300 border-amber-400/50 bg-amber-500/15';
        if (ch === '魔') return 'text-purple-300 border-purple-400/50 bg-purple-500/15';
        return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    };

    const FactionBadge: React.FC<{ faction: string }> = ({ faction }) => {
        if (faction.length <= 1) {
            return (
                <span className={clsx('text-xs px-1 py-0.5 rounded border flex-shrink-0', factionColor(faction))}>
                    {faction}
                </span>
            );
        }
        const chars = Array.from(faction);
        return (
            <span className="flex flex-shrink-0 gap-1">
                {chars.map((ch, i) => (
                    <span key={i} className={clsx('text-xs px-1 py-0.5 rounded border', factionSegColor(ch))}>
                        {ch}
                    </span>
                ))}
            </span>
        );
    };

    return (
        <div data-role={role.name} className="zx-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-base font-bold text-slate-100 truncate">{role.name}</span>
                    <FactionBadge faction={role.faction} />
                </div>
                <span className={clsx('text-xs font-black px-1.5 py-0.5 rounded border flex-shrink-0', ratingColor(role.rating))}>
                    {role.rating}
                </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
                {metricPairs.map((m) =>
                    isZeroValue(m.value) ? (
                        <div key={m.label} className="rounded-lg py-1.5 px-0.5" aria-hidden="true" />
                    ) : (
                        <div key={m.label} className="flex flex-col items-center bg-slate-900/50 rounded-lg py-1.5 px-0.5">
                            <span className="text-[10px] text-slate-500 mb-0.5 leading-none">
                                {m.label}
                            </span>
                            <span className={clsx('text-xs sm:text-sm font-mono font-bold', m.color)}>
                                {renderValue(m.value)}
                            </span>
                        </div>
                    )
                )}
            </div>
            <div className="flex flex-wrap gap-1">
                {role.abilities.map((ability, i) => (
                    <span key={i} className="text-xs text-slate-300 bg-slate-800/70 border border-slate-700/50 px-1.5 py-0.5 rounded">
                        {ability}
                    </span>
                ))}
            </div>
        </div>
    );
};

/* ---- 专注值参考：以灰色标题分组 自身专注 / 群体专注（可同时出现） ---- */
const FocusReferenceSection: React.FC = () => {
    const allRoles = DataService.getInstance().getSupportRoles()?.roles ?? [];
    const general = DataService.getInstance().getSkillMeta()?.focusReference?.general ?? [];

    const selfRoles = allRoles.filter((r) => Array.isArray(r.focusType) && r.focusType.includes('self'));
    const groupRoles = allRoles.filter((r) => Array.isArray(r.focusType) && r.focusType.includes('group'));
    if (selfRoles.length === 0 && groupRoles.length === 0 && general.length === 0) return null;

    const sortByFocus = (a: SupportRole, b: SupportRole) => metricValue(b.focus) - metricValue(a.focus);

    const FocusRow: React.FC<{ name: string; faction?: string; value: number | string | undefined }> = ({ name, faction, value }) => (
        <div data-item={name} className="bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-700/40 flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">{name}{faction && <span className="text-slate-500 text-xs ml-1">{faction}</span>}</span>
            <span className="text-base font-black text-orange-400 font-mono ml-auto">{isZeroValue(value) ? '—' : renderValue(value)}</span>
        </div>
    );

    return (
        <div data-item="专注值参考" className="zx-card p-4 sm:p-5">
            <SectionTitle title="专注值参考" verified />
            <p className="text-sm text-slate-500 -mt-2 mb-4">
                专注分为 <span className="text-slate-300 font-semibold">自身专注</span> 与 <span className="text-slate-300 font-semibold">群体专注</span> 两类；有的职业两者兼具，会同时出现在两个分组中。数值带 <span className="text-orange-400 font-mono font-bold">+</span> 表示随真气等条件仍可继续提升。
            </p>

            <h4 className="text-sm font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-slate-500 rounded-full"></span>自身专注
            </h4>
            <div className="flex flex-wrap gap-2 mb-4">
                {selfRoles.sort(sortByFocus).map((r) => (
                    <FocusRow key={`${r.name}-${r.faction}`} name={r.name} faction={r.faction} value={r.focus} />
                ))}
            </div>

            <h4 className="text-sm font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-slate-500 rounded-full"></span>群体专注
            </h4>
            <div className="flex flex-wrap gap-2">
                {general.map((g: any, i: number) => (
                    <FocusRow key={`g${i}`} name={g.name} value={g.total} />
                ))}
                {groupRoles.sort(sortByFocus).map((r) => (
                    <FocusRow key={`${r.name}-${r.faction}`} name={r.name} faction={r.faction} value={r.focus} />
                ))}
            </div>
        </div>
    );
};

const SupportView: React.FC = () => {
    const roles = DataService.getInstance().getSupportRoles();
    const [metricFilter, setMetricFilter] = useState<string[]>([]);
    const [query, setQuery] = useState('');

    if (!roles) return <div className="text-slate-400 text-base">数据加载中...</div>;

    // 属性筛选字段映射（多选 = 必须同时具备所有选中属性且非 0）
    const METRIC_FIELD: Record<string, (r: SupportRole) => number | string | undefined> = {
        '易伤': (r) => r.damageBoost,
        '绿点': (r) => r.greenPoint,
        '紫点': (r) => r.purplePoint,
        '破防': (r) => r.defenseBreak,
        '专注': (r) => r.focus,
    };

    const filtered = roles.roles
        .filter((r) => {
            const passMetric = metricFilter.every((m) => {
                const getter = METRIC_FIELD[m];
                return getter ? !isZeroValue(getter(r)) : true;
            });
            const q = query.trim();
            const passQuery = !q || r.name.includes(q) || r.abilities.some(a => a.includes(q));
            return passMetric && passQuery;
        })
        .sort((a, b) => {
            // 排序规则：
            // 0 个筛选：按评级 S+→A
            // 1 个筛选：按该属性数值从大到小（70+ 按 70）
            // 2 个及以上：按所选属性数值之和从大到小
            if (metricFilter.length === 0) {
                const rc = ratingRank(a.rating) - ratingRank(b.rating);
                if (rc !== 0) return rc;
                return a.name.localeCompare(b.name);
            }
            const sumA = metricFilter.reduce((sum, m) => {
                const getter = METRIC_FIELD[m];
                return sum + (getter ? metricValue(getter(a)) : 0);
            }, 0);
            const sumB = metricFilter.reduce((sum, m) => {
                const getter = METRIC_FIELD[m];
                return sum + (getter ? metricValue(getter(b)) : 0);
            }, 0);
            if (sumA !== sumB) return sumB - sumA;
            const rc = ratingRank(a.rating) - ratingRank(b.rating);
            if (rc !== 0) return rc;
            return a.name.localeCompare(b.name);
        });

    const toggleMetric = (m: string) => {
        setMetricFilter((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="zx-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-400 mr-1">筛选</span>
                    {['易伤', '绿点', '紫点', '破防', '专注'].map((m) => (
                        <button
                            key={m}
                            onClick={() => toggleMetric(m)}
                            className={clsx(
                                'px-3 py-1 rounded-lg text-sm font-medium border transition-all',
                                metricFilter.includes(m)
                                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                            )}
                        >
                            {m}
                        </button>
                    ))}
                    {metricFilter.length > 0 && (
                        <button
                            onClick={() => setMetricFilter([])}
                            className="px-2 py-1 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            清除
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="搜索职业或能力"
                            className="bg-slate-900/60 border border-slate-700/60 rounded-lg pl-7 pr-2 py-1 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-full sm:w-40"
                        />
                    </div>
                    <span className="text-sm text-slate-500 flex-shrink-0">{filtered.length} / {roles.roles.length}</span>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                {filtered.map((role, idx) => (
                    // 同名多阵营卡片共存（如 逐霜 仙 / 逐霜 魔佛），key 必须带阵营
                    <SupportCard key={`${role.name}-${role.faction}-${idx}`} role={role} metrics={roles.metrics} />
                ))}
            </div>
            <FocusReferenceSection />
            {roles.notes && roles.notes.length > 0 && (
                <div className="zx-card p-4">
                    <h3 className="text-base font-bold text-slate-200 mb-2">说明</h3>
                    <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                        {roles.notes.map((note, i) => (
                            <li key={i}>{note}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export const CompendiumView: React.FC<{ searchNav?: SearchTarget | null; onSearchConsumed?: () => void }> = ({ searchNav, onSearchConsumed }) => {
    const [activeSubTab, setActiveSubTab] = useState<SubTab>('ignore');

    // Jump to a sub-tab (and optional item) driven by global search
    useEffect(() => {
        if (!searchNav || searchNav.tab !== 'compendium') return;
        setActiveSubTab(searchNav.sub);
        if (searchNav.item) {
            const escape = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape : (s: string) => s.replace(/(["'\\#$%&()*+,\/:;<=>?@[\\]^`{|}~])/g, '\\$1');
            const sel = `[data-item="${escape(searchNav.item)}"], [data-role="${escape(searchNav.item)}"]`;
            // wait a tick for the sub-tab content to render
            const t = setTimeout(() => {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-400', 'bg-cyan-500/10', 'rounded-lg', 'transition-all');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400', 'bg-cyan-500/10', 'rounded-lg'), 2000);
                }
                onSearchConsumed?.();
            }, 120);
            return () => clearTimeout(t);
        } else {
            onSearchConsumed?.();
        }
    }, [searchNav]);

    const content = useMemo(() => {
        switch (activeSubTab) {
            case 'ignore': return <AttributeTable sectionKey="ignore" sectionTitle="极致无视攻略" />;
            case 'reduction': return <AttributeTable sectionKey="reduction" sectionTitle="极致减免伤害攻略" />;
            case 'critReduction': return <AttributeTable sectionKey="critReduction" sectionTitle="极致减暴击攻略" />;
            case 'monsterDamageBonus': {
                const lists = DataService.getInstance().getStatSourceLists();
                const section = lists?.sections.monsterDamageBonus;
                if (!section) return <div className="text-slate-400 text-base">数据加载中...</div>;
                return <SourceSectionView section={section} showConditional={false} />;
            }
            case 'dodge': {
                const lists = DataService.getInstance().getStatSourceLists();
                const section = lists?.sections.dodge;
                if (!section) return <div className="text-slate-400 text-base">数据加载中...</div>;
                return <SourceSectionView section={section} showConditional />;
            }
            case 'support': return <SupportView />;
            default: return null;
        }
    }, [activeSubTab]);

    return (
        <div className="flex flex-col gap-4 sm:gap-6 pb-8">
            <div className="flex flex-col gap-3">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 flex items-center gap-3">
                    <span className="w-1.5 h-7 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
                    资料图鉴
                </h1>
                {/* 子页签：移动端横向滚动单行，桌面端换行 */}
                <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                    {SUB_TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={clsx(
                                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all duration-300 border backdrop-blur-md whitespace-nowrap flex-shrink-0',
                                activeSubTab === tab.id
                                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                                    : 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            {content}
        </div>
    );
};

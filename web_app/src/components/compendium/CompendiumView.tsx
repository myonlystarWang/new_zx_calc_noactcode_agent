import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../../services/DataService';
import { BookOpen, Shield, Swords, Target, Users, CheckCircle, AlertCircle, Search, X } from 'lucide-react';
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
    if (v === undefined || v === null) return true;
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

// 增益区字段配置：label + 颜色（专注由 focusType 单独推导，不在此表）
type BuffKey = 'critDamage' | 'atkUp' | 'healUp' | 'manaUp' | 'defUp' | 'monsterDmgUp';
const BUFF_FIELDS: Record<BuffKey, { label: string; color: string }> = {
    critDamage: { label: '加爆伤', color: 'text-rose-400' },
    atkUp: { label: '加攻击', color: 'text-red-400' },
    healUp: { label: '加血', color: 'text-emerald-400' },
    manaUp: { label: '加蓝', color: 'text-sky-400' },
    defUp: { label: '加防御', color: 'text-blue-400' },
    monsterDmgUp: { label: '加怪增', color: 'text-purple-400' },
};

// 新的两级筛选配置
const DEBUFF_OPTIONS = ['易伤', '绿点', '紫点', '破防'];
const BUFF_OPTIONS = ['专注', '加爆伤', '加攻击', '加血', '加蓝', '加防御', '加怪增'];

const DEBUFF_FIELD: Record<string, (r: SupportRole) => number | string | undefined> = {
    '易伤': (r) => r.damageBoost,
    '绿点': (r) => r.greenPoint,
    '紫点': (r) => r.purplePoint,
    '破防': (r) => r.defenseBreak,
};

const BUFF_FIELD: Record<string, (r: SupportRole) => number | string | undefined> = {
    '专注': (r) => r.focus,
    '加爆伤': (r) => r.critDamage,
    '加攻击': (r) => r.atkUp,
    '加血': (r) => r.healUp,
    '加蓝': (r) => r.manaUp,
    '加防御': (r) => r.defUp,
    '加怪增': (r) => r.monsterDmgUp,
};

// 从 abilities 中抽「每X万真气+1专注」类说明，作为专注 chip 的小字备注
const focusScalingNote = (role: SupportRole): string | null =>
    role.abilities.find((a) => /真气.*专注/.test(a)) ?? null;

const SupportCard: React.FC<{ role: SupportRole; metrics: string[]; showDebuff?: boolean; showBuff?: boolean }> = ({ role, metrics, showDebuff = true, showBuff = true }) => {
    // —— 减益区：4 列网格（易伤/绿点/紫点/破防）——
    const debuffItems = [
        { label: metrics[0] ?? '易伤', value: role.damageBoost, color: 'text-amber-400' },
        { label: metrics[1] ?? '绿点', value: role.greenPoint, color: 'text-emerald-400' },
        { label: metrics[2] ?? '紫点', value: role.purplePoint, color: 'text-purple-400' },
        { label: metrics[3] ?? '破防', value: role.defenseBreak, color: 'text-rose-400' },
    ];

    // —— 增益区：仅非零，专注 label 由 focusType 推导 ——
    const focusLabel = ((): string => {
        const types = role.focusType ?? [];
        const hasSelf = types.includes('self');
        const hasGroup = types.includes('group');
        if (hasSelf && hasGroup) return '自身/群体专注';
        if (hasSelf) return '自身专注';
        if (hasGroup) return '群体专注';
        return '专注';
    })();
    const scalingNote = focusScalingNote(role);

    const buffItems: { key: string; label: string; color: string; value: number | string; sub?: string | null; empty: boolean }[] = [
        { key: 'focus', label: focusLabel, color: 'text-orange-400', value: role.focus ?? 0, sub: scalingNote, empty: isZeroValue(role.focus) },
        { key: 'critDamage', label: BUFF_FIELDS.critDamage.label, color: BUFF_FIELDS.critDamage.color, value: role.critDamage ?? 0, empty: isZeroValue(role.critDamage) },
        { key: 'atkUp', label: BUFF_FIELDS.atkUp.label, color: BUFF_FIELDS.atkUp.color, value: role.atkUp ?? 0, empty: isZeroValue(role.atkUp) },
        { key: 'healUp', label: BUFF_FIELDS.healUp.label, color: BUFF_FIELDS.healUp.color, value: role.healUp ?? 0, empty: isZeroValue(role.healUp) },
        { key: 'manaUp', label: BUFF_FIELDS.manaUp.label, color: BUFF_FIELDS.manaUp.color, value: role.manaUp ?? 0, empty: isZeroValue(role.manaUp) },
        { key: 'defUp', label: BUFF_FIELDS.defUp.label, color: BUFF_FIELDS.defUp.color, value: role.defUp ?? 0, empty: isZeroValue(role.defUp) },
        { key: 'monsterDmgUp', label: BUFF_FIELDS.monsterDmgUp.label, color: BUFF_FIELDS.monsterDmgUp.color, value: role.monsterDmgUp ?? 0, empty: isZeroValue(role.monsterDmgUp) },
    ];

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
            {showDebuff && (
                <div>
                    <div className="flex items-center gap-1 mb-1">
                        <span className="w-1 h-2.5 bg-rose-500/70 rounded-full"></span>
                        <span className="text-[11px] font-medium text-rose-300">减益</span>
                    </div>
                    {debuffItems.some((m) => !isZeroValue(m.value)) ? (
                        <div className="flex flex-wrap gap-1.5">
                            {debuffItems.filter((m) => !isZeroValue(m.value)).map((m) => (
                                <div key={m.label} className="flex flex-col items-center rounded-lg py-1.5 px-2 min-w-[3.25rem] bg-slate-900/50">
                                    <span className={clsx(
                                        'mb-0.5 leading-none text-center text-[10px] text-slate-500',
                                        m.label.length > 2 ? 'text-[9px]' : ''
                                    )}>
                                        {m.label}
                                    </span>
                                    <span className={clsx('text-xs sm:text-sm font-mono font-bold', m.color)}>
                                        {renderValue(m.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="min-h-[2.75rem]" aria-hidden="true"></div>
                    )}
                </div>
            )}

            {showBuff && (
                <div>
                    <div className="flex items-center gap-1 mb-1">
                        <span className="w-1 h-2.5 bg-emerald-500/70 rounded-full"></span>
                        <span className="text-[11px] font-medium text-emerald-300">增益</span>
                    </div>
                    {buffItems.some((b) => !b.empty) ? (
                        <div className="flex flex-wrap gap-1.5">
                            {buffItems.filter((b) => !b.empty).map((b) => (
                                <div key={b.key} className="flex flex-col items-center rounded-lg py-1.5 px-2 min-w-[3.25rem] bg-slate-900/50">
                                    <span className={clsx(
                                        'mb-0.5 leading-none text-center text-[10px] text-slate-500',
                                        b.label.length > 3 ? 'text-[9px]' : ''
                                    )}>
                                        {b.label}
                                    </span>
                                    <span className={clsx('text-xs sm:text-sm font-mono font-bold', b.color)}>
                                        {renderValue(b.value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="min-h-[2.75rem]" aria-hidden="true"></div>
                    )}
                </div>
            )}

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

/* ---- 专注值参考：只保留通用群体专注（三碗专注） ---- */
const FocusReferenceSection: React.FC = () => {
    const general = DataService.getInstance().getSkillMeta()?.focusReference?.general ?? [];
    if (general.length === 0) return null;

    const FocusRow: React.FC<{ name: string; value: number | string | undefined }> = ({ name, value }) => (
        <div data-item={name} className="bg-slate-900/50 rounded-xl px-3 py-2 border border-slate-700/40 flex items-center gap-2">
            <span className="text-sm font-bold text-slate-200">{name}</span>
            <span className="text-base font-black text-orange-400 font-mono ml-auto">{isZeroValue(value) ? '—' : renderValue(value)}</span>
        </div>
    );

    return (
        <div data-item="专注值参考" className="zx-card p-4 sm:p-5">
            <h4 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                <span className="w-1 h-3.5 bg-slate-500 rounded-full"></span>专注值参考
            </h4>
            <div className="flex flex-wrap gap-2">
                {general.map((g: any, i: number) => (
                    <FocusRow key={`g${i}`} name={g.name} value={g.total} />
                ))}
            </div>
        </div>
    );
};

const SupportView: React.FC = () => {
    const roles = DataService.getInstance().getSupportRoles();
    const [categoryFilter, setCategoryFilter] = useState<Array<'debuff' | 'buff'>>([]);
    const [debuffFilter, setDebuffFilter] = useState<string[]>([]);
    const [buffFilter, setBuffFilter] = useState<string[]>([]);
    const [query, setQuery] = useState('');

    if (!roles) return <div className="text-slate-400 text-base">数据加载中...</div>;

    const hasDebuff = (r: SupportRole) =>
        !isZeroValue(r.damageBoost) || !isZeroValue(r.greenPoint) ||
        !isZeroValue(r.purplePoint) || !isZeroValue(r.defenseBreak);

    const hasBuff = (r: SupportRole) =>
        !isZeroValue(r.focus) || !isZeroValue(r.critDamage) ||
        !isZeroValue(r.atkUp) || !isZeroValue(r.healUp) ||
        !isZeroValue(r.manaUp) || !isZeroValue(r.defUp) ||
        !isZeroValue(r.monsterDmgUp);

    const filtered = roles.roles
        .filter((r) => {
            const q = query.trim();
            const passQuery = !q || r.name.includes(q) || r.abilities.some(a => a.includes(q));
            if (!passQuery) return false;

            if (categoryFilter.length === 0) return false; // 未选分类时整页空白

            // 分类级过滤：选中的分类中至少有一个有效果（OR）
            const passCategory = categoryFilter.some((cat) => {
                if (cat === 'debuff') return hasDebuff(r);
                return hasBuff(r);
            });
            if (!passCategory) return false;

            // 二级属性过滤：每个分类内选中的属性必须同时满足（AND），跨分类也是 AND
            const passDebuffSub = debuffFilter.every((m) => {
                const getter = DEBUFF_FIELD[m];
                return getter ? !isZeroValue(getter(r)) : true;
            });
            const passBuffSub = buffFilter.every((m) => {
                const getter = BUFF_FIELD[m];
                return getter ? !isZeroValue(getter(r)) : true;
            });
            return passDebuffSub && passBuffSub;
        })
        .sort((a, b) => {
            const hasSubFilter = debuffFilter.length > 0 || buffFilter.length > 0;
            if (!hasSubFilter) {
                const rc = ratingRank(a.rating) - ratingRank(b.rating);
                if (rc !== 0) return rc;
                return a.name.localeCompare(b.name);
            }
            const sumA =
                debuffFilter.reduce((sum, m) => sum + metricValue(DEBUFF_FIELD[m](a)), 0) +
                buffFilter.reduce((sum, m) => sum + metricValue(BUFF_FIELD[m](a)), 0);
            const sumB =
                debuffFilter.reduce((sum, m) => sum + metricValue(DEBUFF_FIELD[m](b)), 0) +
                buffFilter.reduce((sum, m) => sum + metricValue(BUFF_FIELD[m](b)), 0);
            if (sumA !== sumB) return sumB - sumA;
            const rc = ratingRank(a.rating) - ratingRank(b.rating);
            if (rc !== 0) return rc;
            return a.name.localeCompare(b.name);
        });

    const toggleCategory = (cat: 'debuff' | 'buff') => {
        setCategoryFilter((prev) =>
            prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
        );
        if (cat === 'debuff') setDebuffFilter([]);
        else setBuffFilter([]);
    };

    const toggleDebuff = (m: string) => {
        setDebuffFilter((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    };

    const toggleBuff = (m: string) => {
        setBuffFilter((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
    };

    const clearAll = () => {
        setCategoryFilter([]);
        setDebuffFilter([]);
        setBuffFilter([]);
    };

    const showDebuff = categoryFilter.includes('debuff');
    const showBuff = categoryFilter.includes('buff');

    const supportRoles = filtered.filter((r) => r.roleType !== 'dps');
    const dpsRoles = filtered.filter((r) => r.roleType === 'dps');
    const hasAnySelection = categoryFilter.length > 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="zx-card p-3 flex flex-col gap-3">
                {/* 顶部：搜索 + 计数 */}
                <div className="flex items-center gap-2">
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
                    <span className="text-sm text-slate-500 flex-shrink-0 sm:ml-auto">{filtered.length} / {roles.roles.length}</span>
                </div>

                {/* 减益分类行：点击一级按钮才展开二级属性 */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => toggleCategory('debuff')}
                        className={clsx(
                            'px-3 py-1 rounded-lg text-sm font-semibold border transition-all flex-shrink-0',
                            showDebuff
                                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                        )}
                    >
                        减益
                    </button>
                    {showDebuff && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {DEBUFF_OPTIONS.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => toggleDebuff(m)}
                                    className={clsx(
                                        'px-2 py-0.5 rounded-lg text-xs font-medium border transition-all',
                                        debuffFilter.includes(m)
                                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                            : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                            <button
                                onClick={() => setDebuffFilter([])}
                                className="px-2 py-0.5 rounded-lg text-xs font-medium border transition-all bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-rose-300 hover:border-rose-500/40 flex items-center justify-center"
                                title="清除减益筛选"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>

                {/* 增益分类行：点击一级按钮才展开二级属性 */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => toggleCategory('buff')}
                        className={clsx(
                            'px-3 py-1 rounded-lg text-sm font-semibold border transition-all flex-shrink-0',
                            showBuff
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                                : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                        )}
                    >
                        增益
                    </button>
                    {showBuff && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {BUFF_OPTIONS.map((m) => (
                                <button
                                    key={m}
                                    onClick={() => toggleBuff(m)}
                                    className={clsx(
                                        'px-2 py-0.5 rounded-lg text-xs font-medium border transition-all',
                                        buffFilter.includes(m)
                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                            : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                            <button
                                onClick={() => setBuffFilter([])}
                                className="px-2 py-0.5 rounded-lg text-xs font-medium border transition-all bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/40 flex items-center justify-center"
                                title="清除增益筛选"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {!hasAnySelection && (
                <div className="zx-card p-8 text-center text-slate-500">
                    选择增益/减益效果以查看职业状态
                </div>
            )}

            {/* 辅助职业卡片网格 */}
            {hasAnySelection && supportRoles.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1 h-3.5 bg-slate-500 rounded-full"></span>辅助职业
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {supportRoles.map((role, idx) => (
                            <SupportCard
                                key={`${role.name}-${role.faction}-${idx}`}
                                role={role}
                                metrics={roles.metrics}
                                showDebuff={showDebuff}
                                showBuff={showBuff}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 输出职业卡片网格 */}
            {hasAnySelection && dpsRoles.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold text-slate-400 flex items-center gap-1.5">
                        <span className="w-1 h-3.5 bg-slate-500 rounded-full"></span>输出职业
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {dpsRoles.map((role, idx) => (
                            <SupportCard
                                key={`${role.name}-${role.faction}-${idx}`}
                                role={role}
                                metrics={roles.metrics}
                                showDebuff={showDebuff}
                                showBuff={showBuff}
                            />
                        ))}
                    </div>
                </div>
            )}

            {hasAnySelection && <FocusReferenceSection />}
            {hasAnySelection && roles.notes && roles.notes.length > 0 && (
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

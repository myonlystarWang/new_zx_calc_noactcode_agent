import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../../services/DataService';
import {
    BookOpen,
    Shield,
    Swords,
    Target,
    Users,
    AlertCircle,
    X,
    Search,
    LayoutGrid,
    List,
    Sparkles,
    Zap,
    Compass,
    Layers,
    Award
} from 'lucide-react';
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

export type DomainKey = 'equip' | 'accessory' | 'soulDharma' | 'tomeStar' | 'arrayMind' | 'comprehensive';

interface DomainMeta {
    id: DomainKey;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    accentBorder: string;
    accentText: string;
    accentBg: string;
    badgeStyle: string;
}

const DOMAINS: Record<DomainKey, DomainMeta> = {
    equip: {
        id: 'equip',
        label: '装备与防具',
        icon: Shield,
        accentBorder: 'border-amber-500/35 hover:border-amber-500/60',
        accentText: 'text-amber-400',
        accentBg: 'bg-amber-500/10',
        badgeStyle: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    },
    accessory: {
        id: 'accessory',
        label: '首饰与法宝',
        icon: Sparkles,
        accentBorder: 'border-sky-500/35 hover:border-sky-500/60',
        accentText: 'text-sky-400',
        accentBg: 'bg-sky-500/10',
        badgeStyle: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    },
    soulDharma: {
        id: 'soulDharma',
        label: '法身与元婴',
        icon: Zap,
        accentBorder: 'border-purple-500/35 hover:border-purple-500/60',
        accentText: 'text-purple-400',
        accentBg: 'bg-purple-500/10',
        badgeStyle: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    },
    tomeStar: {
        id: 'tomeStar',
        label: '天书与星宿',
        icon: Compass,
        accentBorder: 'border-teal-500/35 hover:border-teal-500/60',
        accentText: 'text-teal-400',
        accentBg: 'bg-teal-500/10',
        badgeStyle: 'bg-teal-500/15 border-teal-500/30 text-teal-300',
    },
    arrayMind: {
        id: 'arrayMind',
        label: '阵灵与心法',
        icon: Layers,
        accentBorder: 'border-blue-500/35 hover:border-blue-500/60',
        accentText: 'text-blue-400',
        accentBg: 'bg-blue-500/10',
        badgeStyle: 'bg-blue-500/15 border-blue-500/30 text-blue-300',
    },
    comprehensive: {
        id: 'comprehensive',
        label: '综合养成与外显',
        icon: Award,
        accentBorder: 'border-rose-500/35 hover:border-rose-500/60',
        accentText: 'text-rose-400',
        accentBg: 'bg-rose-500/10',
        badgeStyle: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    },
};

const DOMAIN_ORDER: DomainKey[] = ['equip', 'accessory', 'soulDharma', 'tomeStar', 'arrayMind', 'comprehensive'];

const getDomainKey = (category: string = ''): DomainKey => {
    if (['武器', '衣服', '头', '鞋子', '腰带', '神隐之力', '装备', '鞋子/腰带'].includes(category)) return 'equip';
    if (['首饰', '护符', '佩章', '玺绶', '勋章', '罡气', '法宝', '法宝/印'].includes(category)) return 'accessory';
    if (['法身', '元婴', '法身/元婴'].includes(category)) return 'soulDharma';
    if (['轩辕策', '星宿', '星魂'].includes(category)) return 'tomeStar';
    if (['阵灵', '心法', '四灵', '造化', '心法/周天'].includes(category)) return 'arrayMind';
    return 'comprehensive';
};

const renderValue = (v: number | string | undefined) => {
    if (v === undefined || v === null) return '-';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
    return v;
};

interface CompendiumHeaderProps {
    title: string;
    total?: number;
    totalLabel?: string;
    totalItems: number;
    domainCounts: Record<DomainKey, number>;
    activeDomain: DomainKey | 'all';
    onSelectDomain: (domain: DomainKey | 'all') => void;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    viewMode: 'grid' | 'table';
    onViewModeChange: (mode: 'grid' | 'table') => void;
}

const CompendiumHeader: React.FC<CompendiumHeaderProps> = ({
    title,
    total,
    totalLabel,
    totalItems,
    domainCounts,
    activeDomain,
    onSelectDomain,
    searchQuery,
    onSearchChange,
    viewMode,
    onViewModeChange,
}) => {
    return (
        <div className="flex flex-col gap-3.5 mb-2">
            {/* 顶栏控制栏：标题 + 验证徽章 + 搜索 + 视图切换 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:px-5 shadow-lg">
                <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-wide">{title}</h2>
                    {total !== undefined && (
                        <div className="flex items-baseline gap-1.5 ml-1">
                            <span className="text-xs text-slate-400">理论总计</span>
                            <span className="text-base sm:text-lg font-mono font-black text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-lg shadow-[0_0_10px_rgba(6,182,212,0.15)]">
                                {Number.isInteger(total) ? total : total.toFixed(2)}
                            </span>
                            {totalLabel && totalLabel !== String(total) && (
                                <span className="text-xs text-slate-400 font-mono">({totalLabel})</span>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2.5 self-end lg:self-auto w-full lg:w-auto">
                    {/* 实时过滤搜索 */}
                    <div className="relative flex-1 lg:w-56">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="检索项目/分类/数值..."
                            className="w-full bg-slate-950/60 border border-slate-700/60 rounded-xl pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => onSearchChange('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* 视图模式切换 */}
                    <div className="flex items-center bg-slate-950/60 p-0.5 rounded-xl border border-slate-800 flex-shrink-0">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                                viewMode === 'grid'
                                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                    : 'text-slate-400 hover:text-slate-300'
                            )}
                            title="聚类卡片视图"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>卡片</span>
                        </button>
                        <button
                            onClick={() => onViewModeChange('table')}
                            className={clsx(
                                'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                                viewMode === 'table'
                                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                                    : 'text-slate-400 hover:text-slate-300'
                            )}
                            title="全量表格视图"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>表格</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 领域筛选 Pills 导航 */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <button
                    onClick={() => onSelectDomain('all')}
                    className={clsx(
                        'px-3 py-1.5 rounded-xl font-bold transition-all border whitespace-nowrap flex-shrink-0',
                        activeDomain === 'all'
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-300'
                    )}
                >
                    全部 ({totalItems})
                </button>
                {DOMAIN_ORDER.map((dk) => {
                    const count = domainCounts[dk] || 0;
                    if (count === 0) return null;
                    const meta = DOMAINS[dk];
                    const Icon = meta.icon;
                    const isActive = activeDomain === dk;
                    return (
                        <button
                            key={dk}
                            onClick={() => onSelectDomain(dk)}
                            className={clsx(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition-all border whitespace-nowrap flex-shrink-0',
                                isActive
                                    ? clsx(meta.badgeStyle, 'font-bold shadow-md')
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-300'
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{meta.label}</span>
                            <span className="font-mono text-[11px] opacity-70">({count})</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

const AttributeTable: React.FC<{ sectionKey: string; sectionTitle: string }> = ({ sectionKey, sectionTitle }) => {
    const guide = DataService.getInstance().getAttributeCeilingGuide();
    const section = guide?.sections[sectionKey];

    const [activeDomain, setActiveDomain] = useState<DomainKey | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    if (!guide || !section) {
        return <div className="text-slate-400 text-base">数据加载中...</div>;
    }

    const { domainGroups, totalCount, domainCounts, domainSubtotals } = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = section.rows.filter((r) => {
            if (!q) return true;
            return (
                r.item.toLowerCase().includes(q) ||
                r.category.toLowerCase().includes(q) ||
                String(r.theoryMax).includes(q) ||
                String(r.floor).includes(q) ||
                String(r.top).includes(q) ||
                String(r.graduation).includes(q)
            );
        });

        const groups: Record<DomainKey, AttributeCeilingRow[]> = {
            equip: [],
            accessory: [],
            soulDharma: [],
            tomeStar: [],
            arrayMind: [],
            comprehensive: [],
        };

        const counts: Record<DomainKey, number> = {
            equip: 0,
            accessory: 0,
            soulDharma: 0,
            tomeStar: 0,
            arrayMind: 0,
            comprehensive: 0,
        };

        const subtotals: Record<DomainKey, number> = {
            equip: 0,
            accessory: 0,
            soulDharma: 0,
            tomeStar: 0,
            arrayMind: 0,
            comprehensive: 0,
        };

        for (const row of section.rows) {
            const dk = getDomainKey(row.category);
            counts[dk] = (counts[dk] || 0) + 1;
            const val = typeof row.theoryMax === 'number' ? row.theoryMax : 0;
            subtotals[dk] = (subtotals[dk] || 0) + val;
        }

        for (const row of filtered) {
            const dk = getDomainKey(row.category);
            groups[dk].push(row);
        }

        return {
            domainGroups: groups,
            totalCount: section.rows.length,
            domainCounts: counts,
            domainSubtotals: subtotals,
        };
    }, [section.rows, searchQuery]);

    const visibleDomains = activeDomain === 'all' ? DOMAIN_ORDER : [activeDomain];
    const hasAnyResults = visibleDomains.some((dk) => (domainGroups[dk]?.length || 0) > 0);

    return (
        <div className="flex flex-col gap-3">
            <CompendiumHeader
                title={sectionTitle}
                total={section.total}
                totalItems={totalCount}
                domainCounts={domainCounts}
                activeDomain={activeDomain}
                onSelectDomain={setActiveDomain}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
            />

            {!hasAnyResults ? (
                <div className="zx-card p-12 text-center text-slate-500">
                    没有找到符合检索条件的项目
                </div>
            ) : viewMode === 'grid' ? (
                /* 卡片视图：响应式多列网格，吃满大屏空间，单卡紧凑排列 */
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {visibleDomains.map((domainKey) => {
                        const meta = DOMAINS[domainKey];
                        const Icon = meta.icon;
                        const rows = domainGroups[domainKey] || [];
                        if (rows.length === 0) return null;
                        const subtotal = domainSubtotals[domainKey];
                        const pct = section.total ? ((subtotal / section.total) * 100).toFixed(1) : null;

                        return (
                            <div
                                key={domainKey}
                                className={clsx(
                                    'zx-card p-0 rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 shadow-lg',
                                    meta.accentBorder,
                                    'bg-slate-900/70 hover:bg-slate-900/90'
                                )}
                            >
                                {/* 卡片标题栏 */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-800/30">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={clsx('p-1.5 rounded-lg border flex-shrink-0', meta.badgeStyle)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-100 tracking-wide truncate">
                                                {meta.label}
                                            </h3>
                                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 flex-shrink-0">
                                                {rows.length}项
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 block leading-none mb-0.5">理论最高小计</span>
                                            <span className={clsx('text-sm font-mono font-bold', meta.accentText)}>
                                                {Number.isInteger(subtotal) ? subtotal : subtotal.toFixed(2)}
                                            </span>
                                            {pct && (
                                                <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                                                    ({pct}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 卡片内部紧凑表格：项目与4档数值紧密相连 */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs sm:text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 bg-slate-950/40">
                                                <th className="text-left py-2 px-3 font-medium">项目 / 细分</th>
                                                <th className="text-right py-2 px-2 font-medium w-16 text-cyan-400">理论最高</th>
                                                <th className="text-right py-2 px-2 font-medium w-12 text-slate-400">夯</th>
                                                <th className="text-right py-2 px-2 font-medium w-12 text-slate-400">顶级</th>
                                                <th className="text-right py-2 px-2.5 font-medium w-14 text-slate-400">大致毕业</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800/40 font-sans">
                                            {rows.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    data-item={row.item}
                                                    className="hover:bg-slate-800/40 transition-colors group"
                                                >
                                                    <td className="py-2.5 px-3 align-middle">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 flex-shrink-0">
                                                                {row.category}
                                                            </span>
                                                            <span className="text-slate-200 group-hover:text-cyan-200 font-medium text-xs sm:text-sm">
                                                                {row.item}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono font-bold text-cyan-300 text-xs sm:text-sm align-middle tabular-nums">
                                                        {renderValue(row.theoryMax)}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono text-slate-300 text-xs align-middle tabular-nums">
                                                        {renderValue(row.floor)}
                                                    </td>
                                                    <td className="py-2.5 px-2 text-right font-mono text-slate-300 text-xs align-middle tabular-nums">
                                                        {renderValue(row.top)}
                                                    </td>
                                                    <td className="py-2.5 px-2.5 text-right font-mono text-slate-300 text-xs align-middle tabular-nums">
                                                        {renderValue(row.graduation)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* 表格视图：全量表格模式 */
                <div className="zx-card p-0 rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/80 text-xs text-slate-400 bg-slate-950/60">
                                    <th className="text-left py-3 px-4 font-semibold">领域 / 分类 / 项目</th>
                                    <th className="text-right py-3 px-3 font-semibold w-24 text-cyan-400">理论最高</th>
                                    <th className="text-right py-3 px-3 font-semibold w-20 text-slate-400">夯</th>
                                    <th className="text-right py-3 px-3 font-semibold w-20 text-slate-400">顶级</th>
                                    <th className="text-right py-3 px-4 font-semibold w-24 text-slate-400">大致毕业</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-sans">
                                {visibleDomains.map((dk) => {
                                    const meta = DOMAINS[dk];
                                    const Icon = meta.icon;
                                    const rows = domainGroups[dk];
                                    if (!rows || rows.length === 0) return null;
                                    const subtotal = domainSubtotals[dk];
                                    return (
                                        <React.Fragment key={dk}>
                                            <tr className="bg-slate-800/40 border-y border-slate-750">
                                                <td colSpan={5} className="py-2.5 px-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={clsx('w-4 h-4', meta.accentText)} />
                                                            <span className="font-bold text-slate-200 text-sm">{meta.label}</span>
                                                            <span className="text-xs text-slate-400 font-mono">({rows.length}项)</span>
                                                        </div>
                                                        <div className="text-xs font-mono text-slate-400">
                                                            小计: <span className={clsx('font-bold', meta.accentText)}>{Number.isInteger(subtotal) ? subtotal : subtotal.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {rows.map((row, idx) => (
                                                <tr key={idx} data-item={row.item} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-2.5 px-4 align-middle">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                                                                {row.category}
                                                            </span>
                                                            <span className="text-slate-200 font-medium">{row.item}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-cyan-300 tabular-nums">{renderValue(row.theoryMax)}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">{renderValue(row.floor)}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">{renderValue(row.top)}</td>
                                                    <td className="py-2.5 px-4 text-right font-mono text-slate-300 tabular-nums">{renderValue(row.graduation)}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="text-xs text-slate-500 mt-2 px-1">数据截至 {guide.asOf}，玩家总结仅供参考</p>
        </div>
    );
};

interface SourceSectionViewProps {
    section: StatSourceSection;
    showConditional?: boolean;
    valueColumnLabel?: string;
}

const SourceSectionView: React.FC<SourceSectionViewProps> = ({ section, showConditional = true }) => {
    const [activeDomain, setActiveDomain] = useState<DomainKey | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const { domainGroups, totalCount, domainCounts, domainSubtotals } = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = section.sources.filter((r) => {
            if (!q) return true;
            return (
                r.item.toLowerCase().includes(q) ||
                (r.category && r.category.toLowerCase().includes(q)) ||
                String(r.value).includes(q) ||
                (r.note && r.note.toLowerCase().includes(q))
            );
        });

        const groups: Record<DomainKey, typeof section.sources> = {
            equip: [],
            accessory: [],
            soulDharma: [],
            tomeStar: [],
            arrayMind: [],
            comprehensive: [],
        };
        const counts: Record<DomainKey, number> = {
            equip: 0,
            accessory: 0,
            soulDharma: 0,
            tomeStar: 0,
            arrayMind: 0,
            comprehensive: 0,
        };
        const subtotals: Record<DomainKey, number> = {
            equip: 0,
            accessory: 0,
            soulDharma: 0,
            tomeStar: 0,
            arrayMind: 0,
            comprehensive: 0,
        };

        for (const row of section.sources) {
            const dk = getDomainKey(row.category || '其他');
            counts[dk] = (counts[dk] || 0) + 1;
            subtotals[dk] = (subtotals[dk] || 0) + (typeof row.value === 'number' ? row.value : 0);
        }

        for (const row of filtered) {
            const dk = getDomainKey(row.category || '其他');
            groups[dk].push(row);
        }

        return {
            domainGroups: groups,
            totalCount: section.sources.length,
            domainCounts: counts,
            domainSubtotals: subtotals,
        };
    }, [section.sources, searchQuery]);

    const visibleDomains = activeDomain === 'all' ? DOMAIN_ORDER : [activeDomain];
    const hasAnyResults = visibleDomains.some((dk) => (domainGroups[dk]?.length || 0) > 0);

    const baseTotal = section.grandTotal ?? section.total ?? section.subtotal;

    return (
        <div className="flex flex-col gap-3">
            <CompendiumHeader
                title={section.title}
                total={baseTotal}
                totalLabel={section.totalLabel}
                totalItems={totalCount}
                domainCounts={domainCounts}
                activeDomain={activeDomain}
                onSelectDomain={setActiveDomain}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
            />

            {!hasAnyResults ? (
                <div className="zx-card p-12 text-center text-slate-500">
                    没有找到符合检索条件的项目
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                    {visibleDomains.map((domainKey) => {
                        const meta = DOMAINS[domainKey];
                        const Icon = meta.icon;
                        const rows = domainGroups[domainKey] || [];
                        if (rows.length === 0) return null;
                        const subtotal = domainSubtotals[domainKey];
                        const pct = baseTotal ? ((subtotal / baseTotal) * 100).toFixed(1) : null;

                        return (
                            <div
                                key={domainKey}
                                className={clsx(
                                    'zx-card p-0 rounded-2xl border flex flex-col overflow-hidden transition-all duration-200 shadow-lg',
                                    meta.accentBorder,
                                    'bg-slate-900/70 hover:bg-slate-900/90'
                                )}
                            >
                                {/* 卡片标题栏 */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-800/30">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={clsx('p-1.5 rounded-lg border flex-shrink-0', meta.badgeStyle)}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-100 tracking-wide truncate">
                                                {meta.label}
                                            </h3>
                                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 flex-shrink-0">
                                                {rows.length}项
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 pl-2">
                                        <div className="text-right">
                                            <span className="text-[10px] text-slate-400 block leading-none mb-0.5">小计</span>
                                            <span className={clsx('text-sm font-mono font-bold', meta.accentText)}>
                                                +{Number.isInteger(subtotal) ? subtotal : subtotal.toFixed(2)}
                                            </span>
                                            {pct && (
                                                <span className="text-[10px] text-slate-400 font-mono ml-1.5">
                                                    ({pct}%)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 紧凑列表行 */}
                                <div className="divide-y divide-slate-800/40">
                                    {rows.map((row, idx) => (
                                        <div
                                            key={idx}
                                            data-item={row.item}
                                            className="flex items-center justify-between py-2.5 px-3 hover:bg-slate-800/40 transition-colors group"
                                        >
                                            <div className="flex items-center gap-2 min-w-0 pr-3">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60 flex-shrink-0 font-medium">
                                                    {row.category || '其他'}
                                                </span>
                                                <span className="text-slate-200 group-hover:text-cyan-200 text-xs sm:text-sm font-medium truncate">
                                                    {row.item}
                                                </span>
                                                {row.note && (
                                                    <span className="text-[11px] text-slate-500 truncate hidden sm:inline" title={row.note}>
                                                        ({row.note})
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <span className="font-mono text-cyan-300 font-bold text-xs sm:text-sm bg-cyan-500/10 border border-cyan-500/25 px-2 py-0.5 rounded-lg tabular-nums">
                                                    +{renderValue(row.value)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="zx-card p-0 rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs sm:text-sm">
                            <thead>
                                <tr className="border-b border-slate-700/80 text-xs text-slate-400 bg-slate-950/60">
                                    <th className="text-left py-3 px-4 font-semibold">领域 / 分类 / 项目</th>
                                    <th className="text-right py-3 px-4 font-semibold w-28 text-cyan-400">加成数值</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50 font-sans">
                                {visibleDomains.map((dk) => {
                                    const meta = DOMAINS[dk];
                                    const Icon = meta.icon;
                                    const rows = domainGroups[dk];
                                    if (!rows || rows.length === 0) return null;
                                    const subtotal = domainSubtotals[dk];
                                    return (
                                        <React.Fragment key={dk}>
                                            <tr className="bg-slate-800/40 border-y border-slate-750">
                                                <td colSpan={2} className="py-2.5 px-4">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <Icon className={clsx('w-4 h-4', meta.accentText)} />
                                                            <span className="font-bold text-slate-200 text-sm">{meta.label}</span>
                                                            <span className="text-xs text-slate-400 font-mono">({rows.length}项)</span>
                                                        </div>
                                                        <div className="text-xs font-mono text-slate-400">
                                                            小计: <span className={clsx('font-bold', meta.accentText)}>+{Number.isInteger(subtotal) ? subtotal : subtotal.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {rows.map((row, idx) => (
                                                <tr key={idx} data-item={row.item} className="hover:bg-slate-800/40 transition-colors">
                                                    <td className="py-2.5 px-4 align-middle">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
                                                                {row.category || '其他'}
                                                            </span>
                                                            <span className="text-slate-200 font-medium">{row.item}</span>
                                                            {row.note && (
                                                                <span className="text-[11px] text-slate-500 truncate hidden sm:inline" title={row.note}>
                                                                    ({row.note})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-300 tabular-nums">
                                                        +{renderValue(row.value)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 条件项（额外加成，非基础合计） */}
            {showConditional && section.conditionals && section.conditionals.length > 0 && (
                <div className="zx-card p-0 rounded-2xl border border-amber-500/30 bg-amber-500/5 flex flex-col overflow-hidden shadow-lg mt-3">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg border bg-amber-500/20 border-amber-500/40 text-amber-300">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-amber-200 tracking-wide">特殊条件项加成</h3>
                                <span className="text-[11px] text-amber-400/80">非基础合计项，特定职业/阵营/性别额外达成</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] text-amber-400/70 block leading-none mb-0.5">额外加成总计</span>
                            <span className="text-sm font-mono font-bold text-amber-300">
                                +{section.conditionals.reduce((sum, c) => sum + (typeof c.value === 'number' ? c.value : 0), 0)}
                            </span>
                        </div>
                    </div>
                    <div className="divide-y divide-amber-500/10">
                        {section.conditionals.map((row, idx) => (
                            <div
                                key={`c-${idx}`}
                                data-item={row.item}
                                className="flex items-center justify-between py-2.5 px-4 hover:bg-amber-500/10 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0 pr-3">
                                    <span className="text-slate-200 text-xs sm:text-sm font-medium">{row.item}</span>
                                    {row.note && (
                                        <span className="text-[11px] text-amber-400/80 truncate hidden sm:inline">
                                            ({row.note})
                                        </span>
                                    )}
                                </div>
                                <span className="font-mono text-amber-300 font-bold text-xs sm:text-sm bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-lg tabular-nums">
                                    +{renderValue(row.value)}
                                </span>
                            </div>
                        ))}
                    </div>
                    {section.grandTotal && (
                        <div className="px-4 py-2.5 bg-amber-950/30 border-t border-amber-500/20 text-xs text-amber-300/90 font-mono">
                            基础合计 {section.subtotal} + 条件加成 19.00 = 完美极限总计 {section.grandTotal}
                        </div>
                    )}
                </div>
            )}

            {section.totalLabel && (
                <p className="text-xs text-slate-500 mt-2 px-1">{section.totalLabel}</p>
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

/* ---- 战斗增益上限参考看板：置于各职业状态最上方，提供5项满配极值指标与联动筛选 ---- */
interface CombatBuffsHeroSectionProps {
    onSelectBuff?: (buffId: string) => void;
    showDebuff: boolean;
    showBuff: boolean;
    debuffFilter: string[];
    buffFilter: string[];
}

const CombatBuffsHeroSection: React.FC<CombatBuffsHeroSectionProps> = ({
    onSelectBuff,
    showDebuff,
    showBuff,
    debuffFilter,
    buffFilter,
}) => {
    const buffs = DataService.getInstance().getBuffs();
    if (!buffs || buffs.length === 0) return null;

    const BUFF_META: Record<string, { label: string; unit: string; color: string; desc: string; filterAttr?: string; filterType?: 'debuff' | 'buff' }> = {
        BUFF_MON_HARMED_EFFECT: {
            label: '易伤上限',
            unit: '%',
            color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
            desc: '多职业易伤叠加标准上限，副本团队伤害放大器',
            filterAttr: '易伤',
            filterType: 'debuff',
        },
        BUFF_MON_CRITDAMAGE_EFFECT: {
            label: '绿点增益',
            unit: '%',
            color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
            desc: '弱化怪物减暴伤（鬼王/英招等），暴击类输出核心收益',
            filterAttr: '绿点',
            filterType: 'debuff',
        },
        BUFF_FOCUS_EFFECT: {
            label: '全队专注',
            unit: '%',
            color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
            desc: '天华、昭冥、焚香等核心辅助群体专注环境满配预设',
            filterAttr: '专注',
            filterType: 'buff',
        },
        BUFF_HOLYWRATH_EFFECT: {
            label: '巫咒增益',
            unit: '%',
            color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
            desc: '巫咒伤害百分比增幅，副本团队增幅',
        },
        BUFF_ATT_PERCENT_EFFECT: {
            label: '攻击比增益',
            unit: '%',
            color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
            desc: '全队基础攻击力百分比提升，团队基础面板放大',
            filterAttr: '加攻击',
            filterType: 'buff',
        },
    };

    return (
        <div data-item="战斗增益参考" className="zx-card p-4 sm:p-5 flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-4 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100 tracking-wide">
                        团队战斗增益上限参考
                    </h3>
                    <span className="text-xs text-slate-400 font-normal hidden sm:inline">
                        （副本标准团队增益满额预设 · 各类增益上限基准）
                    </span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono hidden md:inline">
                    点击卡片可快速筛选下方对应职业
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {buffs.map((b) => {
                    const meta = BUFF_META[b.BuffID] || { label: b.BuffName, unit: '%', color: 'text-cyan-400 border-slate-700/40 bg-slate-900/50', desc: '' };
                    const isFocus = b.BuffID === 'BUFF_FOCUS_EFFECT';

                    let isActive = false;
                    if (meta.filterType === 'debuff' && showDebuff && meta.filterAttr) {
                        isActive = debuffFilter.includes(meta.filterAttr);
                    } else if (meta.filterType === 'buff' && showBuff && meta.filterAttr) {
                        isActive = buffFilter.includes(meta.filterAttr);
                    }

                    return (
                        <div
                            key={b.BuffID}
                            data-item={isFocus ? '专注值参考' : b.BuffName}
                            onClick={() => onSelectBuff?.(b.BuffID)}
                            className={clsx(
                                'rounded-xl p-3.5 border transition-all flex flex-col justify-between group relative select-none',
                                meta.filterAttr ? 'cursor-pointer' : 'cursor-default',
                                isActive
                                    ? 'border-cyan-400/60 bg-slate-850 shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/50'
                                    : 'border-slate-800/80 bg-slate-950/50 hover:border-slate-700 hover:bg-slate-900/80'
                            )}
                            title={meta.filterAttr ? `点击筛选提供「${meta.filterAttr}」的职业` : undefined}
                        >
                            <div>
                                <div className="flex items-center justify-between gap-1 mb-2">
                                    <span className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-cyan-200 transition-colors">
                                        {meta.label}
                                    </span>
                                    <span className={clsx('text-xs px-2 py-0.5 rounded-lg font-mono font-bold border tabular-nums', meta.color)}>
                                        +{b.DefaultEffectValue}{meta.unit}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 leading-relaxed">
                                    {meta.desc}
                                </p>
                            </div>

                            {isFocus && (
                                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">三碗专注参考</span>
                                    <span className="font-mono text-amber-300 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/25">
                                        +20
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SupportView: React.FC = () => {
    const roles = DataService.getInstance().getSupportRoles();
    const [categoryFilter, setCategoryFilter] = useState<Array<'debuff' | 'buff'>>(['debuff', 'buff']);
    const [debuffFilter, setDebuffFilter] = useState<string[]>([]);
    const [buffFilter, setBuffFilter] = useState<string[]>([]);

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

    const showDebuff = categoryFilter.includes('debuff');
    const showBuff = categoryFilter.includes('buff');

    const supportRoles = filtered.filter((r) => r.roleType !== 'dps');
    const dpsRoles = filtered.filter((r) => r.roleType === 'dps');
    const hasAnySelection = categoryFilter.length > 0;

    const handleSelectBuff = (buffId: string) => {
        if (buffId === 'BUFF_MON_HARMED_EFFECT') {
            if (!categoryFilter.includes('debuff')) {
                setCategoryFilter((prev) => [...prev, 'debuff']);
            }
            toggleDebuff('易伤');
        } else if (buffId === 'BUFF_MON_CRITDAMAGE_EFFECT') {
            if (!categoryFilter.includes('debuff')) {
                setCategoryFilter((prev) => [...prev, 'debuff']);
            }
            toggleDebuff('绿点');
        } else if (buffId === 'BUFF_FOCUS_EFFECT') {
            if (!categoryFilter.includes('buff')) {
                setCategoryFilter((prev) => [...prev, 'buff']);
            }
            toggleBuff('专注');
        } else if (buffId === 'BUFF_ATT_PERCENT_EFFECT') {
            if (!categoryFilter.includes('buff')) {
                setCategoryFilter((prev) => [...prev, 'buff']);
            }
            toggleBuff('加攻击');
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* 顶部：团队战斗增益上限参考看板 */}
            <CombatBuffsHeroSection
                onSelectBuff={handleSelectBuff}
                showDebuff={showDebuff}
                showBuff={showBuff}
                debuffFilter={debuffFilter}
                buffFilter={buffFilter}
            />

            <div className="zx-card p-3 flex flex-col gap-3">
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
                                onClick={() => {
                                    setCategoryFilter((prev) => prev.filter((c) => c !== 'debuff'));
                                    setDebuffFilter([]);
                                }}
                                className="px-2 py-0.5 rounded-lg text-xs font-medium border transition-all bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-rose-300 hover:border-rose-500/40 flex items-center justify-center"
                                title="关闭减益"
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
                                onClick={() => {
                                    setCategoryFilter((prev) => prev.filter((c) => c !== 'buff'));
                                    setBuffFilter([]);
                                }}
                                className="px-2 py-0.5 rounded-lg text-xs font-medium border transition-all bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-emerald-300 hover:border-emerald-500/40 flex items-center justify-center"
                                title="关闭增益"
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
                        <span className="text-xs font-medium text-slate-600">· {supportRoles.length}</span>
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
                        <span className="text-xs font-medium text-slate-600">· {dpsRoles.length}</span>
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

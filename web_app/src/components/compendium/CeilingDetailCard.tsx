import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { DataService } from '../../services/DataService';
import type { AttributeCeilingRow } from '../../services/DataService';

/**
 * 极致属性攻略信息卡（T-18 攻略体系）
 * 聊天内 inline 呈现「极致无视 / 极致减免 / 极致减暴 / 极致怪增 / 技能躲闪」全领域细分，
 * 不再跳转 /compendium/ceiling 路由页。
 *
 * 数据源（与全景资料库 AttributeTable / SourceSectionView 同源）：
 *   - ignore / reduction / critReduction -> DataService.getAttributeCeilingGuide().sections[key]
 *   - monsterDamageBonus / dodge        -> DataService.getStatSourceLists().sections[key]
 *
 * 视觉规格：
 *   - 卡容器 max-w-xl + border-cyan-500/20 + bg-[#121824]，标题区 1.5×16 青竖条 + 15px font-black（同 BossDetailCard）
 *   - 数据落在独立单元格内（rounded-lg border-white/5 bg-black/40），靠 4px 间隙分节，不用表格线
 *   - 领域分色：色板 1:1 取 CompendiumView 的 DOMAINS（amber/sky/purple/teal/blue/rose），
 *     组头领域名 + 小计用领域色，行内「类别」小字用同色低一档（解决全灰看不清），数值仍保持亮白不染色
 *   - 布局用容器查询（@container + @sm）而非视口断点：左分屏下视口很宽但卡片只有 ~370px，
 *     @sm 以卡片自身宽度判断，窄卡自动切紧凑排版（类别内联、项目名 truncate），保证主行永不折行
 *   - 字阶：标题 15 / 正文 12（窄卡 11）/ 微标 10–11；颜色只留三档：数值 slate-100、正文 slate-200、次要 slate-400
 */

export interface CeilingDetailCardProps {
    cardData?: {
        title?: string;
        attrKey?: string;
        /** 兼容旧消息：理论最高基准（新逻辑由卡片按数据实算，不再依赖此值） */
        ceilingVal?: number;
        /** 兼容旧消息：旧版路由跳转地址（信息卡不再使用） */
        route?: string;
    };
    className?: string;
}

type DomainKey =
    | 'basic'
    | 'equip'
    | 'accessory'
    | 'soulDharma'
    | 'tomeStar'
    | 'arrayMind'
    | 'classFaction'
    | 'comprehensive';

// 领域元数据与 CompendiumView 的 DOMAINS/getDomainKey 保持一致；色板沿用其六大领域配色
const DOMAIN_ORDER: DomainKey[] = [
    'basic',
    'equip',
    'accessory',
    'soulDharma',
    'tomeStar',
    'arrayMind',
    'classFaction',
    'comprehensive',
];

const DOMAIN_META: Record<DomainKey, { label: string; text: string; tag: string; dot: string }> = {
    basic: { label: '基础通用', text: 'text-slate-200', tag: 'text-slate-400', dot: 'bg-slate-400' },
    equip: { label: '装备相关', text: 'text-amber-300', tag: 'text-amber-400/90', dot: 'bg-amber-400' },
    accessory: { label: '首饰配饰', text: 'text-sky-300', tag: 'text-sky-400/90', dot: 'bg-sky-400' },
    soulDharma: { label: '法身元婴', text: 'text-purple-300', tag: 'text-purple-400/90', dot: 'bg-purple-400' },
    tomeStar: { label: '星宿轩辕策', text: 'text-teal-300', tag: 'text-teal-400/90', dot: 'bg-teal-400' },
    arrayMind: { label: '阵灵心法', text: 'text-blue-300', tag: 'text-blue-400/90', dot: 'bg-blue-400' },
    classFaction: { label: '职业阵营', text: 'text-indigo-300', tag: 'text-indigo-400/90', dot: 'bg-indigo-400' },
    comprehensive: { label: '宠物时装称号', text: 'text-rose-300', tag: 'text-rose-400/90', dot: 'bg-rose-400' },
};

const getDomainKey = (category: string = ''): DomainKey => {
    if (['基础/通用'].includes(category)) return 'basic';
    if (['武器', '衣服', '头', '鞋子', '腰带', '神隐之力', '装备', '鞋子/腰带'].includes(category)) return 'equip';
    if (['首饰', '配饰', '护符', '佩章', '玺绶', '勋章', '罡气', '法宝', '法宝/印'].includes(category)) return 'accessory';
    if (['法身', '元婴', '法身/元婴'].includes(category)) return 'soulDharma';
    if (['轩辕策', '星宿', '星魂'].includes(category)) return 'tomeStar';
    if (['阵灵', '心法', '心法/周天', '四灵', '造化'].includes(category)) return 'arrayMind';
    if (['职业/阵营', '职业', '阵营'].includes(category)) return 'classFaction';
    return 'comprehensive';
};

const renderValue = (v: number | string | undefined | null) => {
    if (v === undefined || v === null || v === '') return '-';
    if (typeof v === 'number') return Number.isInteger(v) ? v.toString() : v.toFixed(2);
    return v;
};

const fmtTotal = (v: number | undefined | null) => {
    if (v === undefined || v === null) return '-';
    return Number.isInteger(v) ? v.toString() : v.toFixed(2);
};

interface SourceRow {
    category?: string;
    item: string;
    value: number;
    note?: string;
}

/**
 * 单行网格：左侧「类别 + 项目」，右侧一或四列数值。
 * 窄卡（<@sm）压窄数值列并收掉独立类别列，把宽度全部让给项目名。
 */
const ROW_GRID_SOURCE = 'grid grid-cols-[minmax(0,1fr)_2.75rem] @sm:grid-cols-[minmax(0,1fr)_3.25rem] items-center gap-x-1.5 @sm:gap-x-2';
/**
 * 四档列（最高 / 夯 / 顶级 / 毕业）。
 * 窄卡（<@sm，即卡片 < 384px）：项目名独占一行，四个数值落到第二行按 4 等分排，
 *   每个数值前带 10px 小标签（列头在窄卡隐藏，否则 5 列塞不进 280px 会把毕业列裁掉）。
 * ≥@sm：恢复单行 5 列，列头由上方表头统一承担。
 */
const ROW_GRID_CEILING =
    'grid grid-cols-4 gap-x-1.5 gap-y-1 @sm:grid-cols-[minmax(0,1fr)_3rem_2.5rem_2.5rem_3rem] @sm:gap-x-2 @sm:gap-y-0 items-center';

/** 单元格：与 BossDetailCard 属性格同款（黑底 + 极淡描边 + 8px 圆角） */
const CELL =
    'rounded-lg border border-white/5 bg-black/40 px-2 @sm:px-2.5 py-1.5 transition-colors hover:border-white/10 hover:bg-black/50';

/** 类别列：≥@sm 独立成列保证项目名左对齐；窄卡内联到项目名前（带 ·），不占固定宽度 */
const CategoryTag: React.FC<{ children?: React.ReactNode; tone: string }> = ({ children, tone }) => (
    <span className={clsx('hidden @sm:inline-block w-[3.6rem] shrink-0 text-[11px] leading-snug break-all', tone)}>
        {children || '其他'}
    </span>
);

const CategoryInline: React.FC<{ children?: React.ReactNode; tone: string }> = ({ children, tone }) => (
    <span className={clsx('@sm:hidden mr-1 shrink-0 text-[10px] leading-snug', tone)}>{children || '其他'}·</span>
);

/**
 * 四档数值单元。
 * 窄卡：左标签右数值（一行内两端对齐），保证 280px 下四档全部可见；
 * ≥@sm：只剩数值并右对齐，标签由表头承担。
 */
const CeilingValue: React.FC<{ label: string; value: React.ReactNode; strong?: boolean; tone?: string }> = ({
    label,
    value,
    strong,
    tone,
}) => (
    <div className="flex items-baseline justify-between gap-1 @sm:block @sm:text-right">
        <span className="shrink-0 text-[10px] leading-none text-slate-500 @sm:hidden">{label}</span>
        <span
            className={clsx(
                'font-mono tabular-nums whitespace-nowrap text-[11px] @sm:text-xs',
                strong ? 'font-bold text-slate-100' : tone || 'text-slate-400'
            )}
        >
            {value}
        </span>
    </div>
);

export const CeilingDetailCard: React.FC<CeilingDetailCardProps> = ({ cardData, className }) => {
    const attrKey = cardData?.attrKey || 'ignore';
    const isSourceMode =
        attrKey === 'monsterDamageBonus' || attrKey === 'dodge' || attrKey === 'critRate' || attrKey === 'critDamage';

    const ds = DataService.getInstance();
    const guide = isSourceMode ? null : ds.getAttributeCeilingGuide();
    const ceilingSection = isSourceMode ? undefined : guide?.sections?.[attrKey];
    const sourceSection = isSourceMode
        ? (ds.getStatSourceLists()?.sections?.[attrKey] as
            | {
                title: string;
                subtotal?: number;
                grandTotal?: number;
                totalLabel?: string;
                sources: SourceRow[];
                conditionals?: SourceRow[];
                notes?: string[];
            }
            | undefined)
        : undefined;

    const [activeDomain, setActiveDomain] = useState<DomainKey | 'all'>('all');
    const chipRowRef = useRef<HTMLDivElement>(null);
    // 左右箭头可用性（对齐 ClassStatusCard：不出滚动条，靠两端箭头翻）
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = chipRowRef.current;
        if (!el) return;
        const left = el.scrollLeft > 4;
        const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
        setCanScrollLeft((prev) => (prev === left ? prev : left));
        setCanScrollRight((prev) => (prev === right ? prev : right));
    }, []);

    const handleScrollStep = useCallback((dir: 'left' | 'right') => {
        const el = chipRowRef.current;
        if (!el) return;
        el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
        setTimeout(updateScrollState, 240);
    }, [updateScrollState]);

    /**
     * 领域筛选条：竖向滚轮转横向滚动，与 BaoshiDetailCard / ClassStatusCard /
     * FashionSkillDetailCard / OldTianyuanDetailCard / PeizhangDetailCard 保持同一套写法。
     *
     * 关键点：只要筛选条自身溢出，就**无条件** preventDefault 并吃掉滚轮——
     * 绝不能"到边缘放行"，否则滚轮会链式冒泡到聊天区/页面，出现「左右滚动时整页跟着往下滚」。
     * 未溢出时直接 return，滚轮照常交给页面。
     */
    useEffect(() => {
        const el = chipRowRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (el.scrollWidth <= el.clientWidth + 1) return;
            if (e.deltaY === 0) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
            updateScrollState();
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [ceilingSection, sourceSection, updateScrollState]);

    // 箭头可用性跟随：初次渲染、切换筛选、卡片宽度变化（左分屏拖分隔条）
    useEffect(() => {
        const el = chipRowRef.current;
        if (!el) return;
        updateScrollState();
        const raf = requestAnimationFrame(updateScrollState);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollState()) : null;
        ro?.observe(el);
        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
        };
    }, [updateScrollState, ceilingSection, sourceSection, activeDomain]);


    // 统一行模型：ceiling 行带四档数值，source 行带单值与备注
    const grouped = useMemo(() => {
        const groups: {
            key: DomainKey;
            ceilingRows: AttributeCeilingRow[];
            sourceRows: SourceRow[];
            subtotal: number;
        }[] = [];
        const counts: Record<string, number> = {};
        let totalCount = 0;

        const pushRow = (dk: DomainKey, ceilingRow?: AttributeCeilingRow, sourceRow?: SourceRow) => {
            counts[dk] = (counts[dk] || 0) + 1;
            totalCount++;
            const val = ceilingRow
                ? typeof ceilingRow.theoryMax === 'number'
                    ? ceilingRow.theoryMax
                    : 0
                : sourceRow && typeof sourceRow.value === 'number'
                    ? sourceRow.value
                    : 0;
            let g = groups.find((x) => x.key === dk);
            if (!g) {
                g = { key: dk, ceilingRows: [], sourceRows: [], subtotal: 0 };
                groups.push(g);
            }
            g.subtotal += val;
            if (ceilingRow) g.ceilingRows.push(ceilingRow);
            if (sourceRow) g.sourceRows.push(sourceRow);
        };

        if (ceilingSection) {
            for (const row of ceilingSection.rows) pushRow(getDomainKey(row.category), row);
        } else if (sourceSection) {
            for (const row of sourceSection.sources) pushRow(getDomainKey(row.category || '其他'), undefined, row);
        }

        groups.sort((a, b) => DOMAIN_ORDER.indexOf(a.key) - DOMAIN_ORDER.indexOf(b.key));
        return { groups, counts, totalCount };
    }, [ceilingSection, sourceSection]);

    if (!ceilingSection && !sourceSection) {
        return (
            <div
                className={clsx(
                    'w-full max-w-xl rounded-xl bg-[#121824] border border-cyan-500/20 p-4 text-xs text-slate-400 shadow-md',
                    className
                )}
            >
                极致属性数据尚未就绪，请稍后重试，或前往「全景资料库 · 极致属性攻略」查看完整拆解。
            </div>
        );
    }

    const visibleGroups = activeDomain === 'all' ? grouped.groups : grouped.groups.filter((g) => g.key === activeDomain);

    const title = cardData?.title || ceilingSection?.title || sourceSection?.title || '极致属性攻略';
    const sectionTotal = ceilingSection?.total;
    const sourceTotal = sourceSection ? (sourceSection.grandTotal ?? sourceSection.subtotal) : undefined;
    const totalLabel = sourceSection?.totalLabel;
    // const asOf = guide?.asOf;
    const conditionals = sourceSection?.conditionals || [];
    // const notes = sourceSection?.notes || [];

    // 筛选胶囊：字号对齐职业状态卡的 text-xs（12px），选中态用青色描边
    const chipBase = 'px-2 py-1 rounded text-xs shrink-0 whitespace-nowrap transition-colors border cursor-pointer';
    const chipIdle = 'bg-slate-800/45 text-slate-300 hover:text-slate-100 hover:bg-slate-800/70 border-transparent';
    const chipActive = 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold';

    /** 一行条目：主行永不折行（项目名 truncate，title 保留全名） */
    const renderRow = (row: SourceRow, idx: number) => {
        const meta = DOMAIN_META[getDomainKey(row.category || '其他')];
        return (
            <div key={idx} className={clsx(CELL, ROW_GRID_SOURCE)}>
                <div className="flex items-baseline gap-1 @sm:gap-2 min-w-0">
                    <CategoryTag tone={meta.tag}>{row.category}</CategoryTag>
                    <div className="min-w-0">
                        <span
                            className="block truncate text-[11px] @sm:text-xs text-slate-200 leading-relaxed"
                            title={row.item}
                        >
                            <CategoryInline tone={meta.tag}>{row.category}</CategoryInline>
                            {row.item}
                        </span>
                        {row.note && (
                            <span className="block text-[10px] @sm:text-[11px] text-slate-400 leading-snug mt-0.5 break-words">
                                {row.note}
                            </span>
                        )}
                    </div>
                </div>
                <span className="text-right font-mono font-bold text-[11px] @sm:text-xs text-slate-100 tabular-nums whitespace-nowrap">
                    {renderValue(row.value)}
                </span>
            </div>
        );
    };

    return (
        <div
            className={clsx(
                '@container w-full max-w-xl rounded-xl p-3 @sm:p-3.5 border border-cyan-500/20 bg-[#121824] flex flex-col gap-3 shadow-md text-slate-300 font-sans',
                className
            )}
        >
            {/* 1. 头部：青色竖条 + 15px 特粗标题 + amber 总览徽章（同 BossDetailCard） */}
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full shrink-0"></span>
                    <h4 className="text-[15px] font-black text-slate-100 tracking-wide truncate">{title}</h4>
                </div>
                {totalLabel ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300 font-mono whitespace-nowrap">
                        {totalLabel}
                    </span>
                ) : sectionTotal !== undefined || sourceTotal !== undefined ? (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300 font-mono whitespace-nowrap">
                        理论最高 {fmtTotal(sectionTotal ?? sourceTotal)}
                    </span>
                ) : null}
            </div>

            {/* 2. 领域筛选：两端箭头翻页（同 ClassStatusCard），条内不出滚动条；滚轮仍可横向滚 */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-800/70 bg-[#0a0f18]/60 p-1">
                <button
                    type="button"
                    onClick={() => handleScrollStep('left')}
                    disabled={!canScrollLeft}
                    title="向左滚动"
                    className={clsx(
                        'p-1 rounded shrink-0 transition-colors',
                        canScrollLeft
                            ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 cursor-pointer'
                            : 'text-slate-600 cursor-default'
                    )}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                    ref={chipRowRef}
                    onScroll={updateScrollState}
                    className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
                >
                    <button
                        type="button"
                        onClick={() => setActiveDomain('all')}
                        className={clsx(chipBase, activeDomain === 'all' ? chipActive : chipIdle)}
                    >
                        全部
                        <span className="ml-1 font-mono text-[11px] opacity-70">{grouped.totalCount}</span>
                    </button>
                    {DOMAIN_ORDER.map((dk) => {
                        const count = grouped.counts[dk] || 0;
                        if (count === 0) return null;
                        const isActive = activeDomain === dk;
                        return (
                            <button
                                key={dk}
                                type="button"
                                onClick={() => setActiveDomain(dk)}
                                className={clsx(chipBase, isActive ? chipActive : chipIdle)}
                            >
                                {DOMAIN_META[dk].label}
                                <span className="ml-1 font-mono text-[11px] opacity-70">{count}</span>
                            </button>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={() => handleScrollStep('right')}
                    disabled={!canScrollRight}
                    title="向右滚动"
                    className={clsx(
                        'p-1 rounded shrink-0 transition-colors',
                        canScrollRight
                            ? 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 cursor-pointer'
                            : 'text-slate-600 cursor-default'
                    )}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* 3. 数据区 */}
            <div className="overflow-x-auto no-scrollbar">
                <div className="min-w-0 flex flex-col gap-3">
                    {/* 四档列头（仅 ceiling 篇目需要；窄卡隐藏，四档标签内联到每个数值前）。
                        用外层 wrapper 控制显隐，避免 hidden 与 grid 同元素上的 display 冲突。 */}
                    {!isSourceMode && (
                        <div className="hidden @sm:block px-2 @sm:px-2.5 -mb-1">
                            <div className={clsx(ROW_GRID_CEILING, 'text-[10px] @sm:text-[11px] text-slate-400')}>
                                <span className="@sm:pl-[4.1rem] pl-0">项目 / 细分</span>
                                <span className="text-right">最高</span>
                                <span className="text-right">夯</span>
                                <span className="text-right">顶级</span>
                                <span className="text-right">毕业</span>
                            </div>
                        </div>
                    )}

                    {/* 纵向瀑布：每个领域一段，段内逐条单元格 */}
                    <div className="flex flex-col gap-3">
                        {visibleGroups.map((g, gi) => {
                            const meta = DOMAIN_META[g.key];
                            const rows = isSourceMode ? g.sourceRows : g.ceilingRows;
                            return (
                                <section
                                    key={g.key}
                                    className={clsx('flex flex-col gap-1', gi > 0 && 'border-t border-white/5 pt-2.5')}
                                >
                                    {/* 段头：色点 + 领域名（领域色）+ 项数 + 右侧小计（同领域色，右缘与数值对齐） */}
                                    <div className="flex items-baseline justify-between gap-2 pl-0.5 pr-2 @sm:pr-2.5 pb-1">
                                        <div className="flex items-baseline gap-1.5 min-w-0">
                                            <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0 self-center', meta.dot)} />
                                            <span className={clsx('text-xs font-bold tracking-wide truncate', meta.text)}>
                                                {meta.label}
                                            </span>
                                            <span className="shrink-0 text-[11px] text-slate-400 font-mono">
                                                {rows.length} 项
                                            </span>
                                        </div>
                                        <span className="shrink-0 text-[10px] @sm:text-[11px] text-slate-400 font-mono whitespace-nowrap">
                                            小计{' '}
                                            <span
                                                className={clsx(
                                                    'text-[11px] @sm:text-xs font-bold tabular-nums',
                                                    meta.text
                                                )}
                                            >
                                                {fmtTotal(g.subtotal)}
                                            </span>
                                        </span>
                                    </div>

                                    {isSourceMode
                                        ? (g.sourceRows as SourceRow[]).map((row, idx) => renderRow(row, idx))
                                        : (g.ceilingRows as AttributeCeilingRow[]).map((row, idx) => (
                                            <div key={idx} className={clsx(CELL, ROW_GRID_CEILING)}>
                                                {/* 窄卡独占一行（col-span-4），≥@sm 回到首列 */}
                                                <div className="col-span-4 @sm:col-span-1 flex items-baseline gap-1 @sm:gap-2 min-w-0">
                                                    <CategoryTag tone={meta.tag}>{row.category}</CategoryTag>
                                                    <span
                                                        className="min-w-0 truncate text-[11px] @sm:text-xs text-slate-200 leading-relaxed"
                                                        title={row.item}
                                                    >
                                                        <CategoryInline tone={meta.tag}>{row.category}</CategoryInline>
                                                        {row.item}
                                                    </span>
                                                </div>
                                                <CeilingValue label="最高" value={renderValue(row.theoryMax)} strong />
                                                <CeilingValue label="夯" value={renderValue(row.floor)} />
                                                <CeilingValue label="顶级" value={renderValue(row.top)} />
                                                <CeilingValue label="毕业" value={renderValue(row.graduation)} tone="text-slate-300" />
                                            </div>
                                        ))}
                                </section>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 4. 条件项（来源篇目专属：不计入基准合计的换装/阵营条件） */}
            {conditionals.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 pl-0.5 pr-2 @sm:pr-2.5">
                        <span className="text-xs font-bold text-amber-300 tracking-wide">条件项</span>
                        <span className="text-[11px] text-slate-400 font-mono">不计入小计</span>
                    </div>
                    {conditionals.map((row, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                ROW_GRID_SOURCE,
                                'rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2 @sm:px-2.5 py-1.5'
                            )}
                        >
                            <div className="flex items-baseline gap-1 @sm:gap-2 min-w-0">
                                <span className="hidden @sm:inline-block w-[3.6rem] shrink-0 text-[11px] leading-snug text-amber-400/80 break-all">
                                    {row.category || '其他'}
                                </span>
                                <div className="min-w-0">
                                    <span className="block truncate text-[11px] @sm:text-xs text-slate-200 leading-relaxed" title={row.item}>
                                        <span className=" @sm:hidden mr-1 text-[10px] text-amber-400/80">
                                            {row.category || '其他'}·
                                        </span>
                                        {row.item}
                                    </span>
                                    {row.note && (
                                        <span className="block text-[10px] @sm:text-[11px] text-slate-400 leading-snug mt-0.5 break-words">
                                            {row.note}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className="text-right font-mono font-bold text-[11px] @sm:text-xs text-amber-300 tabular-nums whitespace-nowrap">
                                +{renderValue(row.value)}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* 5. 口径说明与数据脚注 */}
            {/* <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                {notes.map((n, idx) => (
                    <p key={idx} className="text-[11px] text-slate-400 leading-relaxed break-words">
                        {n}
                    </p>
                ))}
                <p className="text-[11px] text-slate-400 leading-relaxed">
                    {asOf ? `数据截至 ${asOf} · ` : ''}玩家总结仅供参考
                    {isSourceMode &&
                    sourceSection?.subtotal !== undefined &&
                    sourceSection?.grandTotal !== undefined &&
                    sourceSection.subtotal !== sourceSection.grandTotal
                        ? ` · 基础合计 ${fmtTotal(sourceSection.subtotal)} / 极限 ${fmtTotal(sourceSection.grandTotal)}`
                        : ''}
                </p>
            </div> */}
        </div>
    );
};

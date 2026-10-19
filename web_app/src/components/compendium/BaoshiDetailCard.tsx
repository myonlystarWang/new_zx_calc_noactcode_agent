import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Calculator, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Gem } from 'lucide-react';
import clsx from 'clsx';

export interface BaoshiLevelItem {
    level: number;
    isOpen: boolean;
    normal: Record<string, number>;
    perfect: Record<string, number>;
}

export interface BaoshiGemItem {
    id: string;
    name: string;
    type: string;
    coreAttr: string;
    extraAttr: string;
    levels: BaoshiLevelItem[];
}

export interface BaoshiData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    openStatus?: {
        openLevels: number[];
        unreleasedLevels: number[];
    };
    gems?: BaoshiGemItem[];
}

export interface BaoshiDetailCardProps {
    cardData?: {
        data?: BaoshiData;
        initialGemId?: string;
        initialLevel?: number;
        initialQuality?: 'normal' | 'perfect';
    };
    className?: string;
}

export const BaoshiDetailCard: React.FC<BaoshiDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const gems = data?.gems || [];

    const [activeGemId, setActiveGemId] = useState<string>(() => {
        return cardData?.initialGemId || (gems[0]?.id ?? 'hundun_jingang');
    });

    const [level, setLevel] = useState<number>(() => {
        return cardData?.initialLevel && cardData.initialLevel >= 1 && cardData.initialLevel <= 10
            ? cardData.initialLevel
            : 6;
    });

    const [quality, setQuality] = useState<'normal' | 'perfect'>(() => {
        return cardData?.initialQuality || 'perfect';
    });

    const [showCalc, setShowCalc] = useState(false);
    const [calcSocketCount, setCalcSocketCount] = useState<number>(3); // 默认3孔（首饰）
    const [showFullTable, setShowFullTable] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    const scrollToActiveItem = useCallback((smooth = true) => {
        const el = scrollRef.current;
        if (!el) return;
        const activeBtn = el.querySelector<HTMLElement>('[data-active="true"]');
        if (activeBtn) {
            const containerLeft = el.getBoundingClientRect().left;
            const containerWidth = el.clientWidth;
            const itemLeft = activeBtn.getBoundingClientRect().left;
            const itemWidth = activeBtn.clientWidth;
            const offset = (itemLeft - containerLeft) - (containerWidth / 2 - itemWidth / 2);
            el.scrollBy({
                left: offset,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
        setTimeout(updateScrollState, 220);
    }, [updateScrollState]);

    useEffect(() => {
        updateScrollState();
        const handleResize = () => updateScrollState();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateScrollState]);

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToActiveItem(true);
        }, 50);
        return () => clearTimeout(timer);
    }, [activeGemId, scrollToActiveItem]);

    // 滚轮监听：垂直滚轮实时转为横向滑动
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                updateScrollState();
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [updateScrollState]);

    const handleScrollStep = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const step = 200;
        el.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
        setTimeout(updateScrollState, 220);
    };

    const activeGem = useMemo(() => {
        return gems.find((g) => g.id === activeGemId) || gems[0];
    }, [gems, activeGemId]);

    const activeLevelData = useMemo(() => {
        if (!activeGem) return null;
        return activeGem.levels.find((l) => l.level === level) || activeGem.levels[0];
    }, [activeGem, level]);

    const currentAttrs = useMemo(() => {
        if (!activeLevelData) return {};
        return quality === 'perfect' ? activeLevelData.perfect : activeLevelData.normal;
    }, [activeLevelData, quality]);

    // 多孔镶嵌总属性汇总
    const socketTotals = useMemo(() => {
        const res: Record<string, number> = {};
        for (const [k, v] of Object.entries(currentAttrs)) {
            res[k] = +(v * calcSocketCount).toFixed(2);
        }
        return res;
    }, [currentAttrs, calcSocketCount]);

    if (!activeGem) return null;

    // 属性名清洗与单位规范化
    const formatAttrName = (raw: string): { name: string; isPercent: boolean } => {
        if (raw.endsWith('%')) {
            return { name: raw.slice(0, -1), isPercent: true };
        }
        return { name: raw, isPercent: false };
    };

    return (
        <div
            className={clsx(
                'rounded-xl p-3.5 sm:p-4 transition-all duration-200 border border-cyan-500/20 bg-[#121824] flex flex-col justify-start gap-3 shadow-md w-full max-w-xl select-none',
                className
            )}
        >
            {/* 0. 顶层宝石切换栏：完全对齐 CandidateSelectorBar / ClassStatusCard 的统一规范 */}
            {gems.length > 1 && (
                <div className="relative flex items-center bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 gap-1.5 w-full">
                    {canScrollLeft && (
                        <button
                            type="button"
                            onClick={() => handleScrollStep('left')}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                            title="向左滚动"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}

                    <div
                        ref={scrollRef}
                        className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 px-0.5 w-full scroll-smooth"
                    >
                        {gems.map((g) => {
                            const isActive = g.id === activeGemId;
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    data-active={isActive ? 'true' : 'false'}
                                    onClick={() => setActiveGemId(g.id)}
                                    className={clsx(
                                        'px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all shrink-0 cursor-pointer flex items-center gap-1.5',
                                        isActive
                                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/50 shadow-[0_0_8px_rgba(6,182,212,0.25)] font-bold'
                                            : 'bg-slate-800/50 text-slate-400 border border-slate-700/40 hover:bg-slate-800 hover:text-slate-200'
                                    )}
                                >
                                    <Gem className={clsx('w-3 h-3', isActive ? 'text-cyan-300' : 'text-slate-400')} />
                                    <span>{g.name}</span>
                                    <span className="text-[10px] opacity-70">({g.coreAttr.split('/')[0].trim()})</span>
                                </button>
                            );
                        })}
                    </div>

                    {canScrollRight && (
                        <button
                            type="button"
                            onClick={() => handleScrollStep('right')}
                            className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                            title="向右滚动"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}

            {/* 1. Header 行：宝石标题 + 镶嵌胶囊 + 开放状态 + 右侧多孔测算按钮 */}
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full shrink-0"></span>
                    <h4 className="text-[15px] font-black text-slate-100 tracking-wide truncate">
                        {activeGem.name}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[11px] bg-slate-800/80 text-cyan-300/90 border border-cyan-500/30 whitespace-nowrap">
                        装备镶嵌
                    </span>
                    <span
                        className={clsx(
                            'px-1.5 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap font-mono',
                            activeLevelData?.isOpen
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                        )}
                    >
                        {activeLevelData?.isOpen ? `Lv.${level} 已开放` : `Lv.${level} 前瞻未开`}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => setShowCalc(!showCalc)}
                    className="px-2.5 py-1 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/30 text-cyan-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showCalc ? '收起测算' : '多孔测算'}</span>
                </button>
            </div>

            {/* 2. 品阶切换与等级控制区（参考九纹琅/旧天缘同款控制台） */}
            <div className="bg-black/30 border border-white/5 rounded-lg p-2.5 flex flex-col gap-2.5 text-xs">
                {/* 第一行：品阶选择与快捷等级档位 */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 text-[11px] shrink-0">品阶：</span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setQuality('normal')}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                                    quality === 'normal'
                                        ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 font-bold'
                                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                普通品阶
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuality('perfect')}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer',
                                    quality === 'perfect'
                                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 font-bold shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                完美品阶 ★
                            </button>
                        </div>
                    </div>

                    {/* 快捷等级档位 */}
                    <div className="flex items-center gap-1">
                        {[1, 3, 6, 8, 10].map((lvl) => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => setLevel(lvl)}
                                className={clsx(
                                    'px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer border',
                                    level === lvl
                                        ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-200 font-bold'
                                        : 'bg-slate-800/50 border-slate-700/40 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                {lvl === 6 ? '6级(上限)' : `${lvl}级`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 第二行：滑块与微调步进 */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setLevel((prev) => Math.max(1, prev - 1))}
                        disabled={level <= 1}
                        className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 transition-colors cursor-pointer',
                            level <= 1
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                        )}
                    >
                        -1级
                    </button>

                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={level}
                        onChange={(e) => setLevel(Number(e.target.value))}
                        className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />

                    <button
                        type="button"
                        onClick={() => setLevel((prev) => Math.min(10, prev + 1))}
                        disabled={level >= 10}
                        className={clsx(
                            'px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 transition-colors cursor-pointer',
                            level >= 10
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                        )}
                    >
                        +1级
                    </button>

                    <span className="font-mono font-bold text-cyan-300 text-xs shrink-0 w-8 text-right">
                        Lv.{level}
                    </span>
                </div>
            </div>

            {/* 3. 属性矩阵网格：1:1 像素级对齐 BossDetailCard 与高保真原生面板 */}
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                    <span>
                        【{activeGem.name}】Lv.{level} · {quality === 'perfect' ? '完美' : '普通'} 单颗属性
                    </span>
                    <span className="font-mono text-slate-500">{activeGem.type}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                    {Object.entries(currentAttrs).map(([rawName, val]) => {
                        const { name, isPercent } = formatAttrName(rawName);
                        const isHighlight =
                            name.includes('暴') ||
                            name.includes('伤害') ||
                            name.includes('御') ||
                            name.includes('躲闪') ||
                            name.includes('命中');
                        return (
                            <div
                                key={rawName}
                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-black/40 border-white/5 transition-colors"
                            >
                                <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0 mr-1.5">
                                    {name}
                                </span>
                                <span
                                    className={clsx(
                                        'font-mono font-bold text-xs shrink-0 whitespace-nowrap',
                                        isHighlight ? 'text-amber-300' : 'text-slate-100'
                                    )}
                                >
                                    +{val}{isPercent ? '%' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* 6级特化副属性解锁状态条 */}
                {level >= 6 && activeGem.extraAttr && (
                    <div className="mt-1 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[11px]">
                        <span className="text-amber-300/90 font-medium">
                            已激活特化副属性：{activeGem.extraAttr}
                        </span>
                        <span className="text-amber-400/80 font-mono text-[10px]">6级专属解锁</span>
                    </div>
                )}
            </div>

            {/* 4. 多孔镶嵌总属性测算器（折叠展开） */}
            {showCalc && (
                <div className="rounded-lg bg-black/40 border border-cyan-500/30 p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>多孔镶嵌总属性汇总测算</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 6].map((count) => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => setCalcSocketCount(count)}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer border',
                                        calcSocketCount === count
                                            ? 'bg-cyan-500/30 border-cyan-400/60 text-cyan-200 font-bold'
                                            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    {count}颗
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs pt-1">
                        {Object.entries(socketTotals).map(([rawName, v]) => {
                            const { name, isPercent } = formatAttrName(rawName);
                            return (
                                <div
                                    key={rawName}
                                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-black/50 border-cyan-500/20"
                                >
                                    <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0 mr-1.5">
                                        {name}
                                    </span>
                                    <span className="font-mono font-bold text-xs text-emerald-300 shrink-0 whitespace-nowrap">
                                        +{v}{isPercent ? '%' : ''}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 5. 1~10 级全量对照表（折叠面板） */}
            <div className="border-t border-white/5 pt-2">
                <button
                    type="button"
                    onClick={() => setShowFullTable(!showFullTable)}
                    className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 py-1 text-xs transition-colors cursor-pointer"
                >
                    <span className="font-medium">【{activeGem.name}】1~10 级（普通 vs 完美）对照表</span>
                    {showFullTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showFullTable && (
                    <div className="mt-2 overflow-x-auto max-h-[260px] overflow-y-auto border border-white/10 rounded-lg">
                        <table className="w-full text-left text-[11px] min-w-[460px]">
                            <thead className="bg-[#0a0f18] text-slate-400 sticky top-0 border-b border-white/10">
                                <tr>
                                    <th className="p-2 text-center w-14">等级</th>
                                    <th className="p-2">普通属性</th>
                                    <th className="p-2">完美属性</th>
                                    <th className="p-2 text-center w-16">状态</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 font-mono">
                                {activeGem.levels.map((item) => {
                                    const isCurrent = item.level === level;
                                    const normalStr = Object.entries(item.normal)
                                        .map(([k, v]) => `${formatAttrName(k).name}+${v}${formatAttrName(k).isPercent ? '%' : ''}`)
                                        .join('  ');
                                    const perfectStr = Object.entries(item.perfect)
                                        .map(([k, v]) => `${formatAttrName(k).name}+${v}${formatAttrName(k).isPercent ? '%' : ''}`)
                                        .join('  ');

                                    return (
                                        <tr
                                            key={item.level}
                                            onClick={() => setLevel(item.level)}
                                            className={clsx(
                                                'cursor-pointer transition-colors',
                                                isCurrent
                                                    ? 'bg-cyan-500/20 text-cyan-100 font-bold border-l-2 border-cyan-400'
                                                    : 'hover:bg-slate-800/40 text-slate-300'
                                            )}
                                        >
                                            <td className="p-2 text-center font-bold">
                                                Lv.{item.level}
                                            </td>
                                            <td className="p-2 text-slate-300">{normalStr}</td>
                                            <td className="p-2 text-amber-300 font-semibold">{perfectStr}</td>
                                            <td className="p-2 text-center">
                                                <span
                                                    className={clsx(
                                                        'px-1.5 py-0.5 rounded text-[10px] font-bold border',
                                                        item.isOpen
                                                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                                                            : 'text-slate-400 bg-slate-800/60 border-slate-700/40'
                                                    )}
                                                >
                                                    {item.isOpen ? '已开' : '未开'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 6. 底部数据来源与说明 */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500">
                <span>来源：官方/贴吧《诛仙3宝石1-10级全景图》</span>
                <span>6级起解锁特化副属性</span>
            </div>
        </div>
    );
};

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface OldTianyuanAttr {
    name: string;
    minBase: number;
    maxBase: number;
    unit: string;
    perLevelGain: number;
    probability: string;
    note?: string;
}

export interface OldTianyuanPart {
    partId: string;
    partName: string;
    slot: string;
    countProbabilities: Array<{ count: number; probability: string }>;
    attributes: OldTianyuanAttr[];
}

export interface OldTianyuanData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    parts?: OldTianyuanPart[];
}

export interface OldTianyuanDetailCardProps {
    cardData?: {
        data?: OldTianyuanData;
        initialPartId?: string;
        initialLevel?: number;
    };
    className?: string;
}

export const OldTianyuanDetailCard: React.FC<OldTianyuanDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const parts = data?.parts || [];

    const [activePartId, setActivePartId] = useState<string>(() => {
        return cardData?.initialPartId || (parts[0]?.partId ?? 'weapon');
    });

    const [level, setLevel] = useState<number>(() => {
        return cardData?.initialLevel && cardData.initialLevel >= 1 && cardData.initialLevel <= 10
            ? cardData.initialLevel
            : 10;
    });

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
    }, [activePartId, scrollToActiveItem]);

    // 滚轮横向滑动
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

    const activePart = useMemo(() => {
        return parts.find((p) => p.partId === activePartId) || parts[0];
    }, [parts, activePartId]);

    // 计算当前等级下各属性的取值范围
    const computedAttrs = useMemo(() => {
        if (!activePart) return [];
        return activePart.attributes.map((attr) => {
            const added = (level - 1) * attr.perLevelGain;
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            return {
                ...attr,
                currentMin,
                currentMax,
            };
        });
    }, [activePart, level]);

    if (!activePart) return null;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 顶层部位切换栏：占满 AI 对话框完整宽度 w-full */}
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
                    className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
                >
                    {parts.map((p) => {
                        const isActive = p.partId === activePartId;
                        return (
                            <button
                                key={p.partId}
                                type="button"
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setActivePartId(p.partId)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                )}
                            >
                                {p.partName}
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

            {/* 1. 下方核心信息卡：限制宽度 max-w-xl */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2 w-max min-w-[min(320px,100%)] max-w-[min(100%,36rem)]"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 头部两层式布局 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整部位与天命等级 */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{ color: '#ffd272' }}
                    >
                        {activePart.partName}（天缘 +{level}）
                    </div>

                    {/* 第 2 行：微标 与 右侧天命等级步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 font-bold whitespace-nowrap">
                                旧天命天缘
                            </span>
                            {/* <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                2~3条产生率 90%
                            </span> */}
                        </div>

                        {/* 右侧：步进升级控制台 */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setLevel((prev) => Math.max(1, prev - 1))}
                                disabled={level <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    level <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等级 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setLevel((prev) => Math.min(10, prev + 1))}
                                disabled={level >= 10}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    level >= 10
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* 类似装备卡的属性逐行展示：经典游戏蓝（#8080ff）+ 宋体。
                    移动端不换行：内容超宽时整块左右滑动（外层 overflow-x-auto + 内层 min-w-max） */}
                <div className="overflow-x-auto no-scrollbar">
                <div className="w-full min-w-max py-1 space-y-1">
                    {computedAttrs.map((attr) => (
                        <div
                            key={attr.name}
                            className="flex items-baseline justify-between gap-3 text-[13px] leading-[22px] whitespace-nowrap"
                        >
                            <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                                · {attr.name} {attr.currentMin}{attr.unit} - {attr.currentMax}{attr.unit}
                                {/* 每级提升紧跟在属性后面，概率列单独靠右 */}
                                {level < 10 && attr.perLevelGain > 0 && (
                                    <span className="text-emerald-400 text-[11px] font-sans ml-1.5 font-medium">
                                        (升级 +{attr.perLevelGain}{attr.unit})
                                    </span>
                                )}
                            </span>
                            <span className="text-[11px] font-sans" style={{ color: '#8892b0' }}>
                                概率 {attr.probability}
                            </span>
                        </div>
                    ))}
                </div>
                </div>

                {/* 底部属性与洗炼要求 */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                        已绑定；已锁定；不会掉落；不可卖店
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        洗炼部位：
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            武器、防具天命属性
                        </span>
                    </div>
                    {/* <div style={{ color: GAME_COLORS.WHITE }}>
                        天命等级：
                        <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                            共 10 级，每升 1 级上限提升一个基数
                        </span>
                    </div> */}
                </div>
            </div>
        </div>
    );
};

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface XingsuAttr {
    name: string;
    minBase: number;
    maxBase: number;
    unit: string;
    gains: number[]; // 1->2, 2->3, 3->4, 4->5
    probability: string;
}

export interface XingsuStarType {
    typeId: string;
    name: string;
    slot: string;
    ruleDesc: string;
    mainAttrs: XingsuAttr[];
    subAttrs: XingsuAttr[];
}

export interface XingsuData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    rules?: string[];
    stars?: XingsuStarType[];
}

export interface XingsuDetailCardProps {
    cardData?: {
        data?: XingsuData;
        initialTypeId?: string;
        initialRank?: number;
    };
    className?: string;
}

export const XingsuDetailCard: React.FC<XingsuDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const stars = data?.stars || [];

    const [activeTypeId, setActiveTypeId] = useState<string>(() => {
        return cardData?.initialTypeId || (stars[2]?.typeId ?? 'chonghua');
    });

    const [rank, setRank] = useState<number>(() => {
        return cardData?.initialRank && cardData.initialRank >= 1 && cardData.initialRank <= 5
            ? cardData.initialRank
            : 5;
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
    }, [activeTypeId, scrollToActiveItem]);

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

    const activeStar = useMemo(() => {
        return stars.find((s) => s.typeId === activeTypeId) || stars[0];
    }, [stars, activeTypeId]);

    // 计算指定等级下的属性累加值
    const getAccumulatedGain = (gains: number[], targetRank: number) => {
        if (targetRank <= 1) return 0;
        let sum = 0;
        for (let i = 0; i < targetRank - 1 && i < gains.length; i++) {
            sum += gains[i];
        }
        return sum;
    };

    const computedMainAttrs = useMemo(() => {
        if (!activeStar) return [];
        return activeStar.mainAttrs.map((attr) => {
            const added = getAccumulatedGain(attr.gains, rank);
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            const nextGain = rank < 5 ? attr.gains[rank - 1] : null;
            return {
                ...attr,
                currentMin,
                currentMax,
                nextGain
            };
        });
    }, [activeStar, rank]);

    const computedSubAttrs = useMemo(() => {
        if (!activeStar) return [];
        return activeStar.subAttrs.map((attr) => {
            const added = getAccumulatedGain(attr.gains, rank);
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            const nextGain = rank < 5 ? attr.gains[rank - 1] : null;
            return {
                ...attr,
                currentMin,
                currentMax,
                nextGain
            };
        });
    }, [activeStar, rank]);

    if (!activeStar) return null;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 顶层星宿切换栏：占满 AI 对话框完整宽度 w-full */}
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
                    {stars.map((s) => {
                        const isActive = s.typeId === activeTypeId;
                        return (
                            <button
                                key={s.typeId}
                                type="button"
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setActiveTypeId(s.typeId)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                )}
                            >
                                {s.name}
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

            {/* 1. 下方核心信息卡：限制宽度 max-w-xl，居左 */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2 w-full max-w-xl"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 头部两层式布局 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整星宿名称与当前等级（启明星辰白色、荧惑星辰绿色、重华星辰偏蓝色） */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{
                            color:
                                activeStar.typeId === 'qiming' || activeStar.name.includes('启明')
                                    ? GAME_COLORS.WHITE
                                    : activeStar.typeId === 'yinghuo' || activeStar.name.includes('荧惑')
                                    ? GAME_COLORS.BRIGHT_GREEN
                                    : '#5e8eff'
                        }}
                    >
                        {activeStar.name}（{rank}级）
                    </div>

                    {/* 第 2 行：孔位部位徽标 与 等级步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 font-bold whitespace-nowrap">
                                星宿
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                {activeStar.ruleDesc}
                            </span>
                        </div>

                        {/* 右侧：步进升级控制台 */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setRank((prev) => Math.max(1, prev - 1))}
                                disabled={rank <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rank <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等级 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setRank((prev) => Math.min(5, prev + 1))}
                                disabled={rank >= 5}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rank >= 5
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* 装备属性区：主属性候选池 */}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="text-[12px] font-bold" style={{ color: '#ffcb4a' }}>
                        【主属性候选池】
                    </div>
                    <div className="py-0.5 space-y-1">
                        {computedMainAttrs.map((attr) => (
                            <div
                                key={attr.name}
                                className="flex items-center justify-between text-[13px] leading-[22px]"
                            >
                                <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                                    {attr.name} {attr.currentMin}{attr.unit} - {attr.currentMax}{attr.unit}
                                </span>
                                <span className="text-[11px] font-sans" style={{ color: '#8892b0' }}>
                                    概率 {attr.probability}
                                    {attr.nextGain !== null && (
                                        <span className="text-emerald-400 ml-1.5 font-medium">
                                            (升级 +{attr.nextGain}{attr.unit})
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 副属性候选池 */}
                {computedSubAttrs.length > 0 && (
                    <div className="flex flex-col gap-1 min-w-0 pt-1.5 border-t border-[#1f293d]/60">
                        <div className="text-[12px] font-bold" style={{ color: '#ffcb4a' }}>
                            【副属性候选池】
                        </div>
                        <div className="py-0.5 space-y-1">
                            {computedSubAttrs.map((attr) => (
                                <div
                                    key={attr.name}
                                    className="flex items-center justify-between text-[13px] leading-[22px]"
                                >
                                    <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                                        {attr.name} {attr.currentMin}{attr.unit} - {attr.currentMax}{attr.unit}
                                    </span>
                                    <span className="text-[11px] font-sans" style={{ color: '#8892b0' }}>
                                        概率 {attr.probability}
                                        {attr.nextGain !== null && (
                                            <span className="text-emerald-400 ml-1.5 font-medium">
                                                (升级 +{attr.nextGain}{attr.unit})
                                            </span>
                                        )}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 底部升星规则与原生装备说明 */}
                {/* <div
                    className="pt-2 border-t border-[#1f293d]/80 text-[11px] leading-relaxed flex flex-col gap-0.5"
                    style={{ color: '#a6a6a6' }}
                >
                    <div style={{ color: '#ffcb4a' }}>
                        升星机制：相同主属性星辰合成经验加成更高，升级消耗包裹金币。
                    </div>
                    <div>
                        星辰品阶：1星至5星属性递增，重华提供2条副属性，荧惑提供1条副属性。
                    </div>
                </div> */}
            </div>
        </div>
    );
};


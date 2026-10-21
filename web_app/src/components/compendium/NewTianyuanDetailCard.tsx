import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface NewTianyuanAttr {
    name: string;
    probability: string;
    initMin: number;
    initMax: number;
    perLevelGain: number;
    unit?: string;
}

export interface NewTianyuanGroup {
    name: string;
    extraCoeffs: number[];
    attributes: NewTianyuanAttr[];
}

export interface NewTianyuanData {
    attributeGroups: NewTianyuanGroup[];
}

export interface NewTianyuanDetailCardProps {
    cardData?: {
        data?: NewTianyuanData;
        initialGroupName?: string;
        initialLevel?: number;
    };
    className?: string;
}

function fmt(val: number, unit = ''): string {
    const isInt = Number.isInteger(val);
    const numStr = isInt ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '');
    return `${numStr}${unit}`;
}

export const NewTianyuanDetailCard: React.FC<NewTianyuanDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const groups = data?.attributeGroups || [];

    const [activeGroupName, setActiveGroupName] = useState<string>(() => {
        if (cardData?.initialGroupName) {
            const found = groups.find(g => g.name.includes(cardData.initialGroupName!) || cardData.initialGroupName!.includes(g.name));
            if (found) return found.name;
        }
        return groups[0]?.name ?? '';
    });

    const [level, setLevel] = useState<number>(() => {
        return cardData?.initialLevel !== undefined && cardData.initialLevel >= 0 && cardData.initialLevel <= 10
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
    }, [activeGroupName, scrollToActiveItem]);

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

    const activeGroup = useMemo(() => {
        return groups.find((g) => g.name === activeGroupName) || groups[0];
    }, [groups, activeGroupName]);

    // 计算当前等级下的天命额外等级
    const maxExtraLevel = useMemo(() => {
        if (level === 10) return 10;
        if (level >= 9) return 9;
        if (level >= 6) return 6;
        if (level >= 3) return 3;
        return 0;
    }, [level]);

    // 计算各属性的数值范围
    const computedAttrs = useMemo(() => {
        if (!activeGroup) return [];

        const getSumCoeffForExtraLevel = (exLv: number) => {
            let sum = 0;
            for (let i = 0; i < exLv; i++) {
                if (activeGroup.extraCoeffs[i]) sum += activeGroup.extraCoeffs[i];
            }
            return sum;
        };

        const maxExtraCoeff = getSumCoeffForExtraLevel(maxExtraLevel);

        return activeGroup.attributes.map((attr, idx) => {
            const u = attr.unit || '';
            const fixedMin = attr.initMin + (level * attr.perLevelGain);
            const fixedMax = attr.initMax + (level * attr.perLevelGain);
            const extraMax = maxExtraCoeff * attr.perLevelGain;
            const totalMax = fixedMax + extraMax;

            return {
                ...attr,
                idx,
                unitStr: u,
                baseRangeStr: `${fmt(fixedMin, u)} - ${fmt(fixedMax, u)}`,
                extraMaxStr: extraMax > 0 ? `+${fmt(extraMax, u)}` : '0',
                totalRangeStr: `${fmt(fixedMin, u)} - ${fmt(totalMax, u)}`,
                totalMaxFormatted: fmt(totalMax, u),
            };
        });
    }, [activeGroup, level, maxExtraLevel]);

    if (!activeGroup) return null;

    const shortGroupName = activeGroup.name.replace('上玄佑万辰', '');

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
                    {groups.map((g) => {
                        const isActive = g.name === activeGroupName;
                        const label = g.name.replace('上玄佑万辰', '');
                        return (
                            <button
                                key={g.name}
                                type="button"
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setActiveGroupName(g.name)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                )}
                            >
                                {label}
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
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2 w-full max-w-xl"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 头部两层式布局 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整装备名称与天命等级 */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{ color: '#ffd272' }}
                    >
                        {activeGroup.name}（天缘 +{level}）
                    </div>

                    {/* 第 2 行：微标 与 右侧天命等级步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/50 text-amber-200 font-bold whitespace-nowrap">
                                新天缘
                            </span>
                        </div>

                        {/* 右侧：步进升级控制台 */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setLevel((prev) => Math.max(0, prev - 1))}
                                disabled={level <= 0}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    level <= 0
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
                                        : 'bg-amber-600/30 border-amber-500/50 text-amber-200 hover:bg-amber-600/50 hover:text-white'
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* 属性逐行展示：经典游戏蓝（#8080ff）+ 宋体 */}
                <div className="py-1 space-y-1">
                    {computedAttrs.map((attr, i) => (
                        <div
                            key={`${attr.name}-${attr.probability}-${i}`}
                            className="flex items-center justify-between text-[13px] leading-[22px]"
                        >
                            <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                                · {attr.name} {attr.totalRangeStr}
                            </span>
                            <span className="text-[11px] font-sans" style={{ color: '#8892b0' }}>
                                概率 {attr.probability}
                                {attr.perLevelGain > 0 && (
                                    <span className="text-emerald-400 ml-1.5 font-medium">
                                        (+{attr.perLevelGain}{attr.unitStr}/级)
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 底部属性与洗炼说明 */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                        已绑定；已锁定；不会掉落；不可卖店
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        洗炼部位：
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            {shortGroupName} · 上玄佑万辰天缘属性
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        天命成长：
                        <span style={{ color: GAME_COLORS.TIANYUAN_LIME }}>
                            Lv.0~10 基础递增，Lv.3/6/9/10 阶跃激活额外天命增益
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

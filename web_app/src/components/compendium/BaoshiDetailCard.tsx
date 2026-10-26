import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

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

    const activeGem = useMemo(() => {
        return gems.find((g) => g.id === activeGemId) || gems[0];
    }, [gems, activeGemId]);

    const activeLevelData = useMemo(() => {
        if (!activeGem) return null;
        return activeGem.levels.find((l) => l.level === level) || activeGem.levels[0];
    }, [activeGem, level]);

    const nextLevelData = useMemo(() => {
        if (!activeGem || level >= 10) return null;
        return activeGem.levels.find((l) => l.level === level + 1) || null;
    }, [activeGem, level]);

    const currentAttrs = useMemo(() => {
        if (!activeLevelData) return {};
        return quality === 'perfect' ? activeLevelData.perfect : activeLevelData.normal;
    }, [activeLevelData, quality]);

    const nextAttrs = useMemo(() => {
        if (!nextLevelData) return null;
        return quality === 'perfect' ? nextLevelData.perfect : nextLevelData.normal;
    }, [nextLevelData, quality]);

    if (!activeGem) return null;

    // 属性名清洗与单位规范化
    const formatAttrName = (raw: string): { name: string; isPercent: boolean } => {
        if (raw.endsWith('%')) {
            return { name: raw.slice(0, -1), isPercent: true };
        }
        return { name: raw, isPercent: false };
    };

    const titleColor = quality === 'perfect' ? '#ffd272' : '#8080ff';

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 顶层宝石切换栏：占满 AI 对话框完整宽度 w-full，无图标 */}
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
                        className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
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
                                        'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                        isActive
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                    )}
                                >
                                    {g.name}
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

            {/* 1. 下方核心宝石信息卡：限制宽度 max-w-xl（显示效果与 boss 属性类似） */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2 w-max min-w-[min(320px,100%)] max-w-[min(100%,36rem)]"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 头部两层式布局：第 1 行名称与等级，第 2 行品质切换微标与强化步进控制台 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整宝石名称 */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{ color: titleColor }}
                    >
                        {activeGem.name}（Lv.{level}）
                    </div>

                    {/* 第 2 行：品质切换微标 与 右侧强化步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        {/* 左侧：品阶切换 */}
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            <button
                                type="button"
                                onClick={() => setQuality('normal')}
                                className={clsx(
                                    'px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                    quality === 'normal'
                                        ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200 font-bold'
                                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                普通品阶
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuality('perfect')}
                                className={clsx(
                                    'px-1.5 py-0.5 rounded border transition-colors cursor-pointer',
                                    quality === 'perfect'
                                        ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 font-bold'
                                        : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                完美品阶
                            </button>
                        </div>

                        {/* 右侧：步进升级控制台（与 EquipDetailCard 1:1 对齐） */}
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

                {/* 类似装备卡的属性逐行展示：经典游戏蓝（#8080ff）+ 宋体 */}
                <div className="py-1 space-y-1">
                    {/* 基础属性与已激活特化属性（过滤掉 <= 0 的属性，普通品阶不显示 0 增益项） */}
                    {Object.entries(currentAttrs).map(([rawName, val]) => {
                        if (!val || val <= 0) return null;
                        const { name, isPercent } = formatAttrName(rawName);
                        const unit = isPercent ? '%' : '';

                        // 计算升级增益 (升级 +XX)
                        let upgradeDiff: number | null = null;
                        if (nextAttrs && nextAttrs[rawName] !== undefined) {
                            const nextVal = nextAttrs[rawName];
                            const diff = Number((nextVal - val).toFixed(2));
                            if (diff > 0) {
                                upgradeDiff = diff;
                            }
                        }

                        return (
                            <div
                                key={rawName}
                                style={{ color: GAME_COLORS.STAT_BLUE }}
                                className="flex items-baseline gap-2 text-[13px] leading-[22px] whitespace-nowrap"
                            >
                                <span>
                                    {name} ＋{val}{unit}
                                </span>
                                {upgradeDiff !== null && (
                                    <span className="text-emerald-400 font-sans text-[11px] font-medium ml-1.5 whitespace-nowrap">
                                        (升级 +{upgradeDiff}{unit})
                                    </span>
                                )}
                            </div>
                        );
                    })}

                    {/* 完美品阶未到 6 级时：显示置灰的 (+6) 隐藏属性；满 6 级时已在上方直接显示蓝字数值，此处不重复显示 */}
                    {quality === 'perfect' && level < 6 && activeGem.extraAttr && (
                        <div
                            style={{ color: GAME_COLORS.TEXT_LOCKED }}
                            className="flex items-baseline gap-2 text-[13px] leading-[22px] whitespace-nowrap"
                        >
                            <span>
                                (+6) {activeGem.extraAttr}
                            </span>
                            {level === 5 && (
                                <span className="text-emerald-400 font-sans text-[11px] font-medium ml-1.5 whitespace-nowrap">
                                    (升级 +6解锁)
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* 底部属性与穿戴/镶嵌要求（寻宝天行与游戏实机 1:1 标准） */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                        已绑定；已锁定；不会掉落；不可卖店
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        镶嵌部位：
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            戒指、项链等饰品孔位
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        宝石品阶：
                        <span style={{ color: quality === 'perfect' ? '#ffd272' : GAME_COLORS.WHITE }}>
                            {quality === 'perfect' ? '完美宝石' : '普通宝石'}
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        核心倾向：
                        <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                            {activeGem.coreAttr}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

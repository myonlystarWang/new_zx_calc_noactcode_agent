import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Gem } from 'lucide-react';
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

    const currentAttrs = useMemo(() => {
        if (!activeLevelData) return {};
        return quality === 'perfect' ? activeLevelData.perfect : activeLevelData.normal;
    }, [activeLevelData, quality]);

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
        <div
            className={clsx(
                'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0 max-w-xl select-none',
                className
            )}
        >
            {/* 0. 顶层宝石切换栏：完全对齐 CandidateSelectorBar 统一规范 */}
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

            {/* 1:1 游戏实机与寻宝天行原生 Tooltip 视效容器（完全对齐 EquipDetailCard 装备卡样式） */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 头部两层式布局：第 1 行名称与当前品质/等级，第 2 行胶囊微标与升降级步进控制台 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整宝石名称（带等级与品质标签，采用装备卡原生高亮字体） */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{ color: titleColor }}
                    >
                        {activeGem.name}（Lv.{level} · {quality === 'perfect' ? '完美品阶' : '普通品阶'}）
                    </div>

                    {/* 第 2 行：品质切换微标 + 装备镶嵌微标 与 右侧强化步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        {/* 左侧：品阶切换与状态微标 */}
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
                                完美品阶 ★
                            </button>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                装备镶嵌
                            </span>
                            <span
                                className={clsx(
                                    'px-1.5 py-0.5 rounded text-[10px] font-mono border whitespace-nowrap',
                                    activeLevelData?.isOpen
                                        ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                                        : 'bg-slate-800/40 border-slate-700/40 text-slate-400'
                                )}
                            >
                                {activeLevelData?.isOpen ? 'Lv.1~6 已开放' : '前瞻未开放'}
                            </span>
                        </div>

                        {/* 右侧：步进升级控制台（与 EquipDetailCard 的 强化-1 / 强化+1 1:1 对齐） */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <span className="text-[10px] sm:text-[11px] font-sans text-cyan-300/90 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 whitespace-nowrap">
                                Lv.{level}
                            </span>
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

                {/* 快捷档位跳选与连续微调滑块 */}
                <div className="bg-[#0a0f18]/60 border border-white/5 rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1 font-sans text-xs">
                        <span className="text-slate-400 text-[11px] mr-1">快捷档位:</span>
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

                    <div className="flex items-center gap-2 flex-1 max-w-[160px] ml-auto">
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={level}
                            onChange={(e) => setLevel(Number(e.target.value))}
                            className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                        />
                    </div>
                </div>

                {/* 类似装备卡的属性逐行展示：经典游戏蓝（#8080ff）+ 宋体 */}
                <div className="py-1 space-y-1">
                    {/* 基础属性 */}
                    {Object.entries(currentAttrs).map(([rawName, val]) => {
                        const { name, isPercent } = formatAttrName(rawName);
                        return (
                            <div
                                key={rawName}
                                style={{ color: GAME_COLORS.STAT_BLUE }}
                                className="flex items-center"
                            >
                                <span>
                                    {name} ＋{val}{isPercent ? '%' : ''}
                                </span>
                            </div>
                        );
                    })}

                    {/* 6级特化属性（达到6级点亮经典游戏蓝，未达6级显示灰色解锁提示，与装备卡完全同源） */}
                    {activeGem.extraAttr && (
                        <div
                            style={{
                                color: level >= 6 ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED
                            }}
                            className="flex items-center"
                        >
                            <span>
                                {level >= 6 ? '' : '(6级解锁)'}特化副属性：{activeGem.extraAttr}
                            </span>
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
                            戒指、项链、锦囊等饰品孔位
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        宝石品阶：
                        <span style={{ color: quality === 'perfect' ? '#ffd272' : GAME_COLORS.WHITE }}>
                            {quality === 'perfect' ? '完美宝石（全属性提升）' : '普通宝石'}
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        核心倾向：
                        <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                            {activeGem.coreAttr}
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.TEXT_LOCKED }}>
                        {activeGem.type} · 6级起激活特化副属性
                    </div>
                </div>
            </div>

            {/* 1~10 级全量对照表（折叠面板） */}
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
                    <div className="mt-2 overflow-x-auto max-h-[240px] overflow-y-auto border border-white/10 rounded-lg">
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

            {/* 底部数据来源说明 */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                <span>来源：官方/贴吧《诛仙3宝石1-10级全景图》</span>
                <span>6级起解锁特化副属性</span>
            </div>
        </div>
    );
};

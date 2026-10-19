import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface JiuwenlangLevelData {
    level: number;
    hp: number;
    mp: number;
    skillAccuracy: number;
    skillDodge: number;
    critReduction: number;
    critDamageReduction: number;
    resistImmortal: number;
    resistBuddha: number;
    resistDemon: number;
    damageReduction: number;
}

export interface JiuwenlangData {
    systemName?: string;
    category?: string;
    source?: string;
    maxLevel?: number;
    description?: string;
    levels?: JiuwenlangLevelData[];
}

export interface JiuwenlangDetailCardProps {
    cardData?: {
        data?: JiuwenlangData;
        initialLevel?: number;
    };
    className?: string;
}

const DEFAULT_LEVELS: JiuwenlangLevelData[] = [
    { level: 1, hp: 12000, mp: 12000, skillAccuracy: 5.0, skillDodge: 5.0, critReduction: 1.0, critDamageReduction: 5.0, resistImmortal: 1.0, resistBuddha: 1.0, resistDemon: 1.0, damageReduction: 1.0 },
    { level: 2, hp: 12600, mp: 12600, skillAccuracy: 5.5, skillDodge: 5.5, critReduction: 1.2, critDamageReduction: 6.0, resistImmortal: 1.2, resistBuddha: 1.2, resistDemon: 1.2, damageReduction: 1.2 },
    { level: 3, hp: 13200, mp: 13200, skillAccuracy: 6.0, skillDodge: 6.0, critReduction: 1.4, critDamageReduction: 7.0, resistImmortal: 1.4, resistBuddha: 1.4, resistDemon: 1.4, damageReduction: 1.4 },
    { level: 4, hp: 13800, mp: 13800, skillAccuracy: 6.5, skillDodge: 6.5, critReduction: 1.6, critDamageReduction: 8.0, resistImmortal: 1.6, resistBuddha: 1.6, resistDemon: 1.6, damageReduction: 1.6 },
    { level: 5, hp: 14400, mp: 14400, skillAccuracy: 7.0, skillDodge: 7.0, critReduction: 1.8, critDamageReduction: 9.0, resistImmortal: 1.8, resistBuddha: 1.8, resistDemon: 1.8, damageReduction: 1.8 },
    { level: 6, hp: 15000, mp: 15000, skillAccuracy: 7.5, skillDodge: 7.5, critReduction: 2.0, critDamageReduction: 10.0, resistImmortal: 2.0, resistBuddha: 2.0, resistDemon: 2.0, damageReduction: 2.0 },
    { level: 7, hp: 15600, mp: 15600, skillAccuracy: 8.0, skillDodge: 8.0, critReduction: 2.2, critDamageReduction: 11.0, resistImmortal: 2.2, resistBuddha: 2.2, resistDemon: 2.2, damageReduction: 2.2 },
    { level: 8, hp: 16200, mp: 16200, skillAccuracy: 8.5, skillDodge: 8.5, critReduction: 2.4, critDamageReduction: 12.0, resistImmortal: 2.4, resistBuddha: 2.4, resistDemon: 2.4, damageReduction: 2.4 },
    { level: 9, hp: 16800, mp: 16800, skillAccuracy: 9.0, skillDodge: 9.0, critReduction: 2.6, critDamageReduction: 13.0, resistImmortal: 2.6, resistBuddha: 2.6, resistDemon: 2.6, damageReduction: 2.6 },
    { level: 10, hp: 17400, mp: 17400, skillAccuracy: 9.5, skillDodge: 9.5, critReduction: 2.8, critDamageReduction: 14.0, resistImmortal: 2.8, resistBuddha: 2.8, resistDemon: 2.8, damageReduction: 2.8 },
    { level: 11, hp: 18000, mp: 18000, skillAccuracy: 10.0, skillDodge: 10.0, critReduction: 3.0, critDamageReduction: 15.0, resistImmortal: 3.0, resistBuddha: 3.0, resistDemon: 3.0, damageReduction: 3.0 },
    { level: 12, hp: 18600, mp: 18600, skillAccuracy: 10.5, skillDodge: 10.5, critReduction: 3.2, critDamageReduction: 16.0, resistImmortal: 3.2, resistBuddha: 3.2, resistDemon: 3.2, damageReduction: 3.2 },
    { level: 13, hp: 19200, mp: 19200, skillAccuracy: 11.0, skillDodge: 11.0, critReduction: 3.4, critDamageReduction: 17.0, resistImmortal: 3.4, resistBuddha: 3.4, resistDemon: 3.4, damageReduction: 3.4 },
    { level: 14, hp: 19800, mp: 19800, skillAccuracy: 11.5, skillDodge: 11.5, critReduction: 3.6, critDamageReduction: 18.0, resistImmortal: 3.6, resistBuddha: 3.6, resistDemon: 3.6, damageReduction: 3.6 },
    { level: 15, hp: 20400, mp: 20400, skillAccuracy: 12.0, skillDodge: 12.0, critReduction: 3.8, critDamageReduction: 19.0, resistImmortal: 3.8, resistBuddha: 3.8, resistDemon: 3.8, damageReduction: 3.8 },
    { level: 16, hp: 21000, mp: 21000, skillAccuracy: 12.5, skillDodge: 12.5, critReduction: 4.0, critDamageReduction: 20.0, resistImmortal: 4.0, resistBuddha: 4.0, resistDemon: 4.0, damageReduction: 4.0 },
    { level: 17, hp: 21600, mp: 21600, skillAccuracy: 13.0, skillDodge: 13.0, critReduction: 4.2, critDamageReduction: 21.0, resistImmortal: 4.2, resistBuddha: 4.2, resistDemon: 4.2, damageReduction: 4.2 },
    { level: 18, hp: 22200, mp: 22200, skillAccuracy: 13.5, skillDodge: 13.5, critReduction: 4.4, critDamageReduction: 22.0, resistImmortal: 4.4, resistBuddha: 4.4, resistDemon: 4.4, damageReduction: 4.4 },
    { level: 19, hp: 22800, mp: 22800, skillAccuracy: 14.0, skillDodge: 14.0, critReduction: 4.6, critDamageReduction: 23.0, resistImmortal: 4.6, resistBuddha: 4.6, resistDemon: 4.6, damageReduction: 4.6 },
    { level: 20, hp: 24000, mp: 24000, skillAccuracy: 15.0, skillDodge: 15.0, critReduction: 5.0, critDamageReduction: 25.0, resistImmortal: 5.0, resistBuddha: 5.0, resistDemon: 5.0, damageReduction: 5.0 },
];

export const JiuwenlangDetailCard: React.FC<JiuwenlangDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const levels = data?.levels || DEFAULT_LEVELS;

    const [currentLevel, setCurrentLevel] = useState<number>(() => {
        return cardData?.initialLevel && cardData.initialLevel >= 1 && cardData.initialLevel <= 20
            ? cardData.initialLevel
            : 20;
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
    }, [currentLevel, scrollToActiveItem]);

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

    const activeItem = useMemo(() => {
        return levels.find((l) => l.level === currentLevel) || levels[levels.length - 1];
    }, [levels, currentLevel]);

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 顶层等级切换栏：占满 AI 对话框完整宽度 w-full */}
            {/* <div className="relative flex items-center bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 gap-1.5 w-full">
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
                    {levels.map((item) => {
                        const isActive = item.level === currentLevel;
                        return (
                            <button
                                key={item.level}
                                type="button"
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setCurrentLevel(item.level)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                )}
                            >
                                {item.level === 20 ? '满级 (Lv.20)' : `Lv.${item.level}`}
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
            </div> */}

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
                    {/* 第 1 行：完整装备名称与等级 */}
                    <div
                        className="font-bold text-[14px] sm:text-[15px] leading-snug break-words"
                        style={{ color: '#ffd272' }}
                    >
                        佩章·九纹琅（Lv.{currentLevel}）
                    </div>

                    {/* 第 2 行：微标 与 右侧等级步进控制台 */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold whitespace-nowrap">
                                佩章
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                上限 40 级
                            </span>
                        </div>

                        {/* 右侧：步进升级控制台 */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setCurrentLevel((prev) => Math.max(1, prev - 1))}
                                disabled={currentLevel <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    currentLevel <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等级 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentLevel((prev) => Math.min(20, prev + 1))}
                                disabled={currentLevel >= 20}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    currentLevel >= 20
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
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 基础气血 ＋{activeItem.hp.toLocaleString()}</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 基础真气 ＋{activeItem.mp.toLocaleString()}</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 增加技能命中 {activeItem.skillAccuracy.toFixed(1)}</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 增加技能躲闪 {activeItem.skillDodge.toFixed(1)}</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 被致命一击的概率减少 {activeItem.critReduction.toFixed(1)}%</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 减免暴伤 ＋{activeItem.critDamageReduction.toFixed(1)}%</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 御仙 ＋{activeItem.resistImmortal.toFixed(1)}%</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 御佛 ＋{activeItem.resistBuddha.toFixed(1)}%</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 御魔 ＋{activeItem.resistDemon.toFixed(1)}%</span>
                    </div>
                    <div style={{ color: GAME_COLORS.STAT_BLUE }} className="flex items-center">
                        <span>· 减免伤害 ＋{activeItem.damageReduction.toFixed(1)}%</span>
                    </div>
                </div>

                {/* 底部属性与穿戴/附魔要求 */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                        已绑定；已锁定；不会掉落；不可卖店
                    </div>
                    {/* <div style={{ color: GAME_COLORS.WHITE }}>
                        附魔部位：
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            佩章装备核心附魔
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        成长特性：
                        <span style={{ color: GAME_COLORS.STAT_BLUE }}>
                            全项属性随等级线性提升
                        </span>
                    </div> */}
                </div>
            </div>
        </div>
    );
};

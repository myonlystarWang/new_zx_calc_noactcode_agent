import React, { useState, useRef, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ClassStatusRole {
    faction: string;
    roleType?: string;
    rating?: string;
    abilities?: string[];
    // 4 项团队减益（弱化怪物）
    damageBoost?: number | string;    // 易伤
    greenPoint?: number | string;     // 绿点
    purplePoint?: number | string;    // 紫点
    defenseBreak?: number | string;   // 破防
    // 7 项团队/自身增益（属性加成）
    focus?: number | string;          // 专注
    focusType?: string[];             // ['self'] | ['group']
    critDamage?: number | string;     // 加爆伤
    atkUp?: number | string;          // 加攻击
    healUp?: number | string;         // 加血
    manaUp?: number | string;         // 加蓝
    defUp?: number | string;          // 加防御
    monsterDmgUp?: number | string;   // 加怪增
}

export interface ClassStatusCardData {
    className: string;
    isDps?: boolean;
    factions?: string[];
    preferredFaction?: string;
    metrics?: string[];
    roles: ClassStatusRole[];
    allRoles?: any[];
    allClasses?: string[];
}

export interface ClassStatusCardProps {
    cardData: ClassStatusCardData;
    className?: string;
}

/** 辅助判断是否为有效非零数值 */
const isEffectiveValue = (v: any): boolean => {
    if (v === undefined || v === null || v === '' || v === 0 || v === '0') return false;
    return true;
};

/** 格式化指标数值（自动适配 % 单位与数字格式） */
const formatMetricValue = (val: number | string, unit: string = ''): string => {
    if (typeof val === 'number') {
        return unit ? `${val}${unit}` : String(val);
    }
    const str = String(val).trim();
    if (unit && !str.endsWith('%') && !str.endsWith('+')) {
        return `${str}${unit}`;
    }
    return str;
};

interface MetricItem {
    key: string;
    label: string;
    val: number | string;
    unit: string;
    color: string;
}

export const ClassStatusCard: React.FC<ClassStatusCardProps> = ({
    cardData,
    className = '',
}) => {
    const [selectedClassName, setSelectedClassName] = useState<string>(cardData.className || '逐霜');
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState<boolean>(false);
    const [canScrollRight, setCanScrollRight] = useState<boolean>(false);

    // 检查横向滚动边界
    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 4);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }, []);

    // 如果传入了 allRoles，则根据当前选中的 selectedClassName 动态提取当前职业的角色列表
    const currentRoles = React.useMemo<ClassStatusRole[]>(() => {
        if (Array.isArray(cardData.allRoles) && cardData.allRoles.length > 0) {
            const list = cardData.allRoles.filter((r: any) => r?.name === selectedClassName);
            if (list.length > 0) {
                return list.map((r: any) => ({
                    faction: r.faction,
                    roleType: r.roleType,
                    rating: r.rating,
                    abilities: Array.isArray(r.abilities) ? r.abilities : [],
                    damageBoost: r.damageBoost,
                    greenPoint: r.greenPoint,
                    purplePoint: r.purplePoint,
                    defenseBreak: r.defenseBreak,
                    focus: r.focus,
                    focusType: r.focusType,
                    critDamage: r.critDamage,
                    atkUp: r.atkUp,
                    healUp: r.healUp,
                    manaUp: r.manaUp,
                    defUp: r.defUp,
                    monsterDmgUp: r.monsterDmgUp,
                }));
            }
        }
        return cardData.roles || [];
    }, [cardData.allRoles, cardData.roles, selectedClassName]);

    const [activeIdx, setActiveIdx] = useState<number>(() => {
        if (cardData.preferredFaction) {
            const found = currentRoles.findIndex((r) => r.faction?.includes(cardData.preferredFaction!));
            if (found >= 0) return found;
        }
        return 0;
    });

    const handleSelectClass = (cls: string) => {
        setSelectedClassName(cls);
        setActiveIdx(0);
    };

    // 精确将活动项平滑居中滚动至横向视图中央（对齐 CandidateSelectorBar）
    const scrollToActiveItem = useCallback((smooth = true) => {
        const container = scrollRef.current;
        if (!container) return;
        const allClasses = cardData.allClasses || [];
        const activeIdx = allClasses.indexOf(selectedClassName);
        if (activeIdx < 0) return;
        const activeNode = container.children[activeIdx] as HTMLElement;
        if (!activeNode) return;

        const targetLeft = activeNode.offsetLeft - (container.clientWidth / 2) + (activeNode.clientWidth / 2);
        container.scrollTo({
            left: Math.max(0, targetLeft),
            behavior: smooth ? 'smooth' : 'auto'
        });
        setTimeout(updateScrollState, 160);
    }, [selectedClassName, cardData.allClasses, updateScrollState]);

    useEffect(() => {
        updateScrollState();
        window.addEventListener('resize', updateScrollState);
        return () => window.removeEventListener('resize', updateScrollState);
    }, [updateScrollState, cardData.allClasses]);

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToActiveItem(true);
        }, 50);
        return () => clearTimeout(timer);
    }, [selectedClassName, scrollToActiveItem]);

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

    const currentRole = currentRoles[activeIdx] || currentRoles[0];
    if (!currentRole) return null;

    // 专注标签推导：直接体现自身/群体，不再在数值旁挂小字
    const focusLabel = (() => {
        const types = currentRole.focusType || [];
        const hasSelf = types.includes('self');
        const hasGroup = types.includes('group');
        if (hasSelf && hasGroup) return '自/群专注';
        if (hasGroup) return '群体专注';
        if (hasSelf) return '自身专注';
        return '专注';
    })();

    // 收集当前阵营所有有效指标（4 减益 + 7 增益）
    const matrixItems: MetricItem[] = [
        // 减益（Debuff）
        { key: 'damageBoost', label: '易伤', val: currentRole.damageBoost ?? '', unit: '%', color: 'text-amber-300' },
        { key: 'greenPoint', label: '绿点', val: currentRole.greenPoint ?? '', unit: '', color: 'text-emerald-300' },
        { key: 'purplePoint', label: '紫点', val: currentRole.purplePoint ?? '', unit: '%', color: 'text-purple-300' },
        { key: 'defenseBreak', label: '破防', val: currentRole.defenseBreak ?? '', unit: '%', color: 'text-rose-300' },
        // 增益（Buff）
        { key: 'focus', label: focusLabel, val: currentRole.focus ?? '', unit: '', color: 'text-orange-300' },
        { key: 'critDamage', label: '加爆伤', val: currentRole.critDamage ?? '', unit: '%', color: 'text-rose-300' },
        { key: 'atkUp', label: '加攻击', val: currentRole.atkUp ?? '', unit: '', color: 'text-red-300' },
        { key: 'healUp', label: '加血', val: currentRole.healUp ?? '', unit: '%', color: 'text-emerald-300' },
        { key: 'manaUp', label: '加蓝', val: currentRole.manaUp ?? '', unit: '%', color: 'text-sky-300' },
        { key: 'defUp', label: '加防御', val: currentRole.defUp ?? '', unit: '%', color: 'text-blue-300' },
        { key: 'monsterDmgUp', label: '加怪增', val: currentRole.monsterDmgUp ?? '', unit: '%', color: 'text-purple-300' },
    ].filter((m) => isEffectiveValue(m.val));

    // 战术定位：提炼打法与能力特性，绝不重复打印上方已有数值
    const tacticalSummary = (() => {
        if (currentRole.abilities && currentRole.abilities.length > 0) {
            return currentRole.abilities.join(' · ');
        }
        if (currentRole.roleType === 'dps' || cardData.isDps) {
            return '核心任务为个人极致爆发输出，以自身伤害循环为主';
        }
        return '常规团队辅助与协同定位';
    })();

    return (
        <div
            className={clsx(
                'rounded-xl p-3.5 sm:p-4 transition-all duration-200 border border-cyan-500/20 bg-[#121824] flex flex-col justify-start gap-3 shadow-md w-full max-w-xl select-none',
                className
            )}
        >
            {/* 0. 顶部门派全景切换栏：对齐 CandidateSelectorBar 交互规范与样式 */}
            {Array.isArray(cardData.allClasses) && cardData.allClasses.length > 1 && (
                <div className="relative flex items-center bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 gap-1.5 w-full">
                    {/* 左滚动按钮 */}
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

                    {/* 可横向滚动职业标签容器 */}
                    <div
                        ref={scrollRef}
                        onScroll={updateScrollState}
                        className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
                    >
                        {cardData.allClasses.map((cls) => {
                            const isSelected = cls === selectedClassName;
                            return (
                                <button
                                    key={cls}
                                    type="button"
                                    onClick={() => handleSelectClass(cls)}
                                    className={clsx(
                                        'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                        isSelected
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                    )}
                                >
                                    {cls}
                                </button>
                            );
                        })}
                    </div>

                    {/* 右滚动按钮 */}
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

            {/* 1. Header 行：职业名 + 紧随右侧阵营徽章按钮 + 右侧纯净评级（完全对齐 BossDetailCard 头部比例） */}
            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full shrink-0"></span>
                    <h4 className="text-[15px] font-black text-slate-100 tracking-wide truncate">
                        {selectedClassName}
                    </h4>

                    {/* 阵营分支直接在职业名字右边：参考 BossCard 的微标风格，极简小胶囊 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {currentRoles.map((r, idx) => {
                            const isActive = idx === activeIdx;
                            return (
                                <button
                                    key={`${r.faction}-${idx}`}
                                    type="button"
                                    onClick={() => setActiveIdx(idx)}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 transition-colors cursor-pointer',
                                        isActive
                                            ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                                            : 'bg-slate-800/60 border-slate-700/50 text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    {r.faction}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 右侧：纯净展示评级，不额外加花哨大框 */}
                {currentRole.rating && (
                    <div className="text-xs font-mono text-slate-400 shrink-0">
                        评级 <span className="font-bold text-amber-300">{currentRole.rating}</span>
                    </div>
                )}
            </div>

            {/* 2. 属性矩阵网格：1:1 对齐 BossDetailCard 紧凑网格结构 (在 max-w-xl 约束下美观协调) */}
            {matrixItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                    {matrixItems.map((m) => (
                        <div
                            key={m.key}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-black/40 border-white/5 transition-colors"
                        >
                            <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0 mr-1.5">
                                {m.label}
                            </span>
                            <span className={clsx('font-mono font-bold text-xs shrink-0 whitespace-nowrap', m.color)}>
                                {formatMetricValue(m.val, m.unit)}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-center text-xs text-slate-400">
                    输出职业以个人伤害为主，团队增益面板较少，可在模拟训练场使用输出模板起号。
                </div>
            )}

            {/* 3. 底部战术定位行：低调内敛，紧凑布局对齐属性网格 */}
            <div className="pt-2 border-t border-white/5 flex items-start gap-1.5 text-xs leading-relaxed">
                <span className="text-cyan-400 font-semibold shrink-0">战术定位：</span>
                <span className="text-slate-300">
                    {tacticalSummary}
                </span>
            </div>
        </div>
    );
};

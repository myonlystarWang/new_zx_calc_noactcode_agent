import React, { useRef, useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';

export interface CandidateItem {
    id: string | number;
    title: string;
    badge?: string;
    subtitle?: string;
}

interface CandidateSelectorBarProps {
    items: CandidateItem[];
    activeIndex: number;
    onSelect: (index: number) => void;
    summaryText?: string;
    className?: string;
}

export const CandidateSelectorBar: React.FC<CandidateSelectorBarProps> = ({
    items,
    activeIndex,
    onSelect,
    summaryText,
    className = ''
}) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
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

    useEffect(() => {
        updateScrollState();
        window.addEventListener('resize', updateScrollState);
        return () => window.removeEventListener('resize', updateScrollState);
    }, [updateScrollState, items]);

    // 当展开/收起状态切换或选中项切换时，刷新横向滚动尺寸并对齐活动项
    useEffect(() => {
        const timer = setTimeout(() => {
            updateScrollState();
            if (!isExpanded && scrollRef.current) {
                const activeNode = scrollRef.current.children[activeIndex] as HTMLElement;
                if (activeNode) {
                    activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [isExpanded, activeIndex, updateScrollState]);

    // 监听横向滚轮：在收起模式下滚轮垂直滚动转化为横向滑动，体验极度顺滑
    useEffect(() => {
        const el = scrollRef.current;
        if (!el || isExpanded) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                updateScrollState();
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [isExpanded, updateScrollState]);

    // 选中项居中滚动
    useEffect(() => {
        if (isExpanded || !scrollRef.current) return;
        const activeNode = scrollRef.current.children[activeIndex] as HTMLElement;
        if (activeNode) {
            activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeIndex, isExpanded]);

    const handleScrollStep = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const step = 240;
        el.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
        setTimeout(updateScrollState, 260);
    };

    if (!items || items.length === 0) return null;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-2', className)}>
            {/* 顶栏信息与展开/收起切换 */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
                <span className="font-medium text-slate-300">
                    {summaryText || `为你匹配到 ${items.length} 个候选结果，支持点选切换：`}
                </span>

                {items.length > 4 && (
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-all"
                    >
                        <span>{isExpanded ? '收起横排' : `展开全部 (${items.length})`}</span>
                        {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-cyan-400" />
                        ) : (
                            <ChevronDown className="w-3 h-3 text-cyan-400" />
                        )}
                    </button>
                )}
            </div>

            {/* 候选列表区 */}
            {isExpanded ? (
                /* 展开网格模式：全部一览无余，一键直达 */
                <div className="flex flex-wrap gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 max-h-56 overflow-y-auto animate-in fade-in duration-200">
                    {items.map((item, idx) => {
                        const isActive = idx === activeIndex;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    onSelect(idx);
                                }}
                                className={clsx(
                                    'whitespace-nowrap shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm select-none',
                                    isActive
                                        ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                                        : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                                )}
                            >
                                <span className="whitespace-nowrap">{item.title}</span>
                                {item.badge && (
                                    <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            ) : (
                /* 收起横滑模式：带左右精准平滑切滑按钮与滚轮穿透映射 */
                <div className="relative group flex items-center w-full min-w-0 max-w-full overflow-hidden">
                    {/* 左滑导航按钮 */}
                    {canScrollLeft && (
                        <button
                            type="button"
                            onClick={() => handleScrollStep('left')}
                            className="absolute left-0 z-20 w-7 h-8 flex items-center justify-center rounded-r-lg bg-slate-950/90 hover:bg-slate-900 border-y border-r border-slate-700/80 text-cyan-300 shadow-lg backdrop-blur-md transition-all -ml-1"
                            title="向左滚动候选列表"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}

                    {/* 滚动容器 */}
                    <div
                        ref={scrollRef}
                        onScroll={updateScrollState}
                        className="w-full min-w-0 flex items-center gap-2 overflow-x-auto py-1.5 px-0.5 scroll-smooth no-scrollbar"
                    >
                        {items.map((item, idx) => {
                            const isActive = idx === activeIndex;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelect(idx)}
                                    className={clsx(
                                        'whitespace-nowrap shrink-0 flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border shadow-sm select-none',
                                        isActive
                                            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
                                            : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
                                    )}
                                >
                                    <span className="whitespace-nowrap">{item.title}</span>
                                    {item.badge && (
                                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-normal">
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* 右滑导航按钮 */}
                    {canScrollRight && (
                        <button
                            type="button"
                            onClick={() => handleScrollStep('right')}
                            className="absolute right-0 z-20 w-7 h-8 flex items-center justify-center rounded-l-lg bg-slate-950/90 hover:bg-slate-900 border-y border-l border-slate-700/80 text-cyan-300 shadow-lg backdrop-blur-md transition-all -mr-1"
                            title="向右滚动候选列表"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

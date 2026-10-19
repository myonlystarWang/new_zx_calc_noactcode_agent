import React, { useState, useMemo } from 'react';
import { Sparkles, Calculator, ChevronDown, ChevronUp, Gem } from 'lucide-react';

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

    return (
        <div className={`w-full max-w-[560px] bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 text-xs font-sans shadow-xl select-none ${className || ''}`}>
            {/* 头部标题与徽标 */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#06b6d4] shadow-[0_0_8px_#06b6d4]"></span>
                    <span className="text-[13px] font-bold text-white tracking-wide">
                        {data?.systemName || '宝石属性及升级全景'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#06b6d4]/15 border border-[#06b6d4]/30 text-[#67e8f9]">
                        装备镶嵌
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        activeLevelData?.isOpen
                            ? 'bg-[#10b981]/15 text-[#34d399] border border-[#10b981]/30'
                            : 'bg-[#f59e0b]/15 text-[#fbbf24] border border-[#f59e0b]/30'
                    }`}>
                        {activeLevelData?.isOpen ? `Lv.${level} 已开放` : `Lv.${level} 未开放前瞻`}
                    </span>
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e293b]/70 hover:bg-[#334155] text-[#38bdf8] text-[11px] transition-colors border border-[#38bdf8]/20"
                >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showCalc ? '收起测算' : '多孔测算'}</span>
                </button>
            </div>

            {/* 宝石选择下拉/胶囊 */}
            <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                    <span className="text-[#94a3b8]">选择宝石：</span>
                    <span className="text-[#38bdf8] font-medium">{activeGem.name} ({activeGem.coreAttr})</span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-thin">
                    {gems.map((g) => {
                        const isActive = g.id === activeGemId;
                        return (
                            <button
                                key={g.id}
                                onClick={() => setActiveGemId(g.id)}
                                className={`px-2 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                                    isActive
                                        ? 'bg-[#06b6d4] text-[#0f172a] font-bold shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                        : 'bg-[#1e293b]/70 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                                }`}
                            >
                                <Gem className="w-2.5 h-2.5" />
                                <span>{g.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 品阶切换（普通 vs 完美）与 等级切换 */}
            <div className="grid grid-cols-2 gap-2 bg-[#0f172a]/70 rounded border border-[#1e293b]/80 p-2 mb-2.5">
                <div>
                    <span className="text-[11px] text-[#94a3b8] block mb-1">宝石品阶：</span>
                    <div className="grid grid-cols-2 gap-1">
                        <button
                            onClick={() => setQuality('normal')}
                            className={`py-1 rounded text-[11px] font-medium transition-colors ${
                                quality === 'normal'
                                    ? 'bg-[#38bdf8] text-[#0f172a] font-bold'
                                    : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'
                            }`}
                        >
                            普通品阶
                        </button>
                        <button
                            onClick={() => setQuality('perfect')}
                            className={`py-1 rounded text-[11px] font-medium transition-colors ${
                                quality === 'perfect'
                                    ? 'bg-[#f59e0b] text-[#0f172a] font-bold shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                    : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'
                            }`}
                        >
                            完美品阶 ★
                        </button>
                    </div>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="text-[#94a3b8]">宝石等级：</span>
                        <span className="font-mono font-bold text-white text-[12px]">{level}级</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={level}
                            onChange={(e) => setLevel(Number(e.target.value))}
                            className="w-full accent-[#06b6d4] h-1.5 bg-[#1e293b] rounded cursor-pointer"
                        />
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-[#64748b] mt-0.5">
                        <span>1级</span>
                        <span className="text-[#34d399]">6级(当前上限)</span>
                        <span>10级</span>
                    </div>
                </div>
            </div>

            {/* 当前等级属性卡片展示 */}
            <div className="bg-[#131b2e]/60 border border-[#1e293b] rounded p-2.5 mb-2.5">
                <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-[#1e293b]/60">
                    <span className="text-[11px] text-[#94a3b8]">
                        【{activeGem.name}】{level}级 · {quality === 'perfect' ? '完美' : '普通'} 单颗属性
                    </span>
                    <span className="text-[10px] text-[#64748b]">{activeGem.type}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(currentAttrs).map(([name, val]) => {
                        const isPercent = name.endsWith('%');
                        const isHighlight = name.includes('暴') || name.includes('伤害') || name.includes('御') || name.includes('躲闪');
                        return (
                            <div key={name} className="bg-[#0b0f19] border border-[#1e293b]/80 rounded p-1.5 flex flex-col justify-between">
                                <span className="text-[10px] text-[#94a3b8]">{name}</span>
                                <span className={`font-mono text-[13px] font-bold mt-0.5 ${
                                    isHighlight ? 'text-[#f59e0b]' : 'text-white'
                                }`}>
                                    +{val}{isPercent ? '' : ''}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 多孔镶嵌总属性测算器 */}
            {showCalc && (
                <div className="bg-[#111827] border border-[#06b6d4]/30 rounded p-2.5 mb-2.5">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[#67e8f9] font-bold text-[11px]">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>多孔镶嵌总属性汇总测算</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 6].map((count) => (
                                <button
                                    key={count}
                                    onClick={() => setCalcSocketCount(count)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                                        calcSocketCount === count
                                            ? 'bg-[#06b6d4] text-[#0f172a] font-bold'
                                            : 'bg-[#1e293b] text-[#94a3b8]'
                                    }`}
                                >
                                    {count}颗
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                        <div className="text-[10px] text-[#94a3b8] mb-1">
                            镶嵌 {calcSocketCount} 颗【{level}级 {quality === 'perfect' ? '完美' : '普通'} {activeGem.name}】总加成：
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
                            {Object.entries(socketTotals).map(([k, v]) => (
                                <div key={k} className="flex items-center gap-1">
                                    <span className="text-[#cbd5e1]">{k}:</span>
                                    <span className="text-[#34d399] font-bold">+{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 1~10 级全量对照表折叠展开 */}
            <div className="border-t border-[#1e293b] pt-2">
                <button
                    onClick={() => setShowFullTable(!showFullTable)}
                    className="w-full flex items-center justify-between text-[#94a3b8] hover:text-white py-1 text-[11px] transition-colors"
                >
                    <span>【{activeGem.name}】1~10 级（普通 vs 完美）对照表</span>
                    {showFullTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showFullTable && (
                    <div className="mt-2 overflow-x-auto max-h-[260px] overflow-y-auto border border-[#1e293b] rounded">
                        <table className="w-full text-left text-[10px] min-w-[460px]">
                            <thead className="bg-[#1e293b] text-[#94a3b8] sticky top-0">
                                <tr>
                                    <th className="p-1.5 text-center">等级</th>
                                    <th className="p-1.5">普通属性</th>
                                    <th className="p-1.5">完美属性</th>
                                    <th className="p-1.5 text-center">状态</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e293b]/50 font-mono">
                                {activeGem.levels.map((item) => {
                                    const isCurrent = item.level === level;
                                    const normalStr = Object.entries(item.normal).map(([k, v]) => `${k}:${v}`).join(' ');
                                    const perfectStr = Object.entries(item.perfect).map(([k, v]) => `${k}:${v}`).join(' ');

                                    return (
                                        <tr
                                            key={item.level}
                                            onClick={() => setLevel(item.level)}
                                            className={`cursor-pointer transition-colors ${
                                                isCurrent
                                                    ? 'bg-[#06b6d4]/20 text-white font-bold'
                                                    : 'hover:bg-[#1e293b]/40 text-[#cbd5e1]'
                                            }`}
                                        >
                                            <td className="p-1.5 text-center font-bold">
                                                {item.level}级
                                            </td>
                                            <td className="p-1.5 text-[#94a3b8]">{normalStr}</td>
                                            <td className="p-1.5 text-[#f59e0b] font-semibold">{perfectStr}</td>
                                            <td className="p-1.5 text-center">
                                                <span className={`px-1 py-0.5 rounded text-[9px] ${
                                                    item.isOpen ? 'text-[#34d399] bg-[#34d399]/10' : 'text-[#94a3b8] bg-[#1e293b]'
                                                }`}>
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

            <div className="mt-2 pt-1.5 border-t border-[#1e293b]/60 flex items-center justify-between text-[10px] text-[#64748b]">
                <span>数据来源：贴吧/完美官方论坛《诛仙3宝石1-10级全景图》</span>
                <span>6级起解锁特化副属性</span>
            </div>
        </div>
    );
};

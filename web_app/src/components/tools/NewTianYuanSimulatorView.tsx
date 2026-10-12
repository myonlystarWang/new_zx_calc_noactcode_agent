import React, { useState, useEffect, useMemo } from 'react';
import {
    Sparkles,
    Sliders,
    ChevronDown,
    ChevronUp,
    Info
} from 'lucide-react';
import clsx from 'clsx';

interface TianYuanAttr {
    name: string;
    probability: string;
    initMin: number;
    initMax: number;
    perLevelGain: number;
    unit?: string;
}

interface TianYuanGroup {
    name: string;
    extraCoeffs: number[];
    attributes: TianYuanAttr[];
}

interface TianYuanData {
    attributeGroups: TianYuanGroup[];
}

function fmt(val: number, unit = ''): string {
    const isInt = Number.isInteger(val);
    const numStr = isInt ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '');
    return `${numStr}${unit}`;
}

export const NewTianYuanSimulatorView: React.FC = () => {
    const [data, setData] = useState<TianYuanData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedGroupIdx, setSelectedGroupIdx] = useState<number>(0);
    const [currentLevel, setCurrentLevel] = useState<number>(10); // 默认展示顶级 Lv.10
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        fetch('/game_data/new_tianyuan_data.json')
            .then(r => r.json())
            .then((d: TianYuanData) => {
                if (mounted) {
                    setData(d);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error('Failed to load new_tianyuan_data.json:', err);
                if (mounted) setLoading(false);
            });
        return () => { mounted = false; };
    }, []);

    // 计算当前等级下的天命额外等级
    const maxExtraLevel = useMemo(() => {
        if (currentLevel === 10) return 10;
        if (currentLevel >= 9) return 9;
        if (currentLevel >= 6) return 6;
        if (currentLevel >= 3) return 3;
        return 0;
    }, [currentLevel]);

    const activeGroup = data?.attributeGroups[selectedGroupIdx];

    // 计算属性列表
    const computedAttributes = useMemo(() => {
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
            const fixedMin = attr.initMin + (currentLevel * attr.perLevelGain);
            const fixedMax = attr.initMax + (currentLevel * attr.perLevelGain);
            const extraMax = maxExtraCoeff * attr.perLevelGain;

            // 梯级天命详情
            const possibleLadder = [];
            for (let lv = 0; lv <= maxExtraLevel; lv++) {
                const coeff = getSumCoeffForExtraLevel(lv);
                const extraVal = coeff * attr.perLevelGain;
                possibleLadder.push({
                    extraLevel: lv,
                    extraValStr: fmt(extraVal, u),
                    totalRangeStr: `${fmt(fixedMin + extraVal, u)} ~ ${fmt(fixedMax + extraVal, u)}`
                });
            }

            return {
                idx,
                name: attr.name,
                probability: attr.probability,
                perLevelGain: attr.perLevelGain,
                unit: u,
                baseRangeStr: `${fmt(fixedMin, u)} ~ ${fmt(fixedMax, u)}`,
                extraRangeStr: `0 ~ +${fmt(extraMax, u)}`,
                totalRangeStr: `${fmt(fixedMin, u)} ~ ${fmt(fixedMax + extraMax, u)}`,
                fixedMin,
                fixedMax,
                extraMax,
                possibleLadder
            };
        });
    }, [activeGroup, currentLevel, maxExtraLevel]);

    if (loading) {
        return (
            <div className="zx-card p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>正在加载新版天缘数据...</span>
            </div>
        );
    }

    if (!data || !activeGroup) {
        return (
            <div className="zx-card p-8 text-center text-rose-400">
                数据加载失败，请刷新重试。
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 max-w-[1500px] mx-auto w-full">
            {/* 顶栏控制栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        <Sparkles className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-100 tracking-wide">
                                新版天缘属性模拟器
                            </h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                现代天缘数值体系
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            支持须弥刃、须弥甲、须弥冠履 天缘0~10级数值成长、天命增益系数与理论极限范围对照
                        </p>
                    </div>
                </div>

                {/* 部位选择 Pills */}
                <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                    {data.attributeGroups.map((group, gIdx) => {
                        const isSelected = selectedGroupIdx === gIdx;
                        return (
                            <button
                                key={group.name}
                                onClick={() => {
                                    setSelectedGroupIdx(gIdx);
                                    setExpandedKey(null);
                                }}
                                className={clsx(
                                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                    isSelected
                                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                )}
                            >
                                {group.name.replace('上玄佑万辰', '')}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 等级调节器 */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                            <span>天缘等级:</span>
                            <span className="font-mono font-black text-amber-400 text-base">
                                Lv.{currentLevel}
                            </span>
                        </div>
                        <span className="text-xs text-slate-500">
                            当前激活天命额外阶数: +{maxExtraLevel} 阶
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-1 sm:max-w-md">
                    <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={currentLevel}
                        onChange={(e) => setCurrentLevel(Number(e.target.value))}
                        className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {[0, 3, 6, 9, 10].map(lv => (
                            <button
                                key={lv}
                                onClick={() => setCurrentLevel(lv)}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-xs font-mono font-bold transition-all',
                                    currentLevel === lv
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                )}
                            >
                                {lv}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 属性数据表 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/80 text-xs text-slate-400 bg-slate-950/60">
                                <th className="text-left py-3.5 px-4 font-semibold">属性名称</th>
                                <th className="text-center py-3.5 px-3 font-semibold w-24">产生概率</th>
                                <th className="text-center py-3.5 px-3 font-semibold w-24">每级增益</th>
                                <th className="text-right py-3.5 px-4 font-semibold w-36 text-slate-300">天缘基础范围</th>
                                <th className="text-right py-3.5 px-4 font-semibold w-36 text-orange-400">天命增益上限</th>
                                <th className="text-right py-3.5 px-4 font-semibold w-44 text-cyan-300">理论总数值范围</th>
                                <th className="text-center py-3.5 px-3 font-semibold w-16">梯级</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 font-sans">
                            {computedAttributes.map((attr) => {
                                const isExpanded = expandedKey === String(attr.idx);

                                return (
                                    <React.Fragment key={attr.idx}>
                                        <tr
                                            onClick={() => setExpandedKey(isExpanded ? null : String(attr.idx))}
                                            className={clsx(
                                                'cursor-pointer transition-colors',
                                                isExpanded ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                                            )}
                                        >
                                            <td className="py-3 px-4 font-bold text-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span>{attr.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-mono text-cyan-400 font-bold">
                                                {attr.probability}
                                            </td>
                                            <td className="py-3 px-3 text-center font-mono text-slate-300">
                                                +{attr.perLevelGain}{attr.unit}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-slate-300">
                                                {attr.baseRangeStr}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-orange-300 font-bold">
                                                {attr.extraRangeStr}
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-cyan-300 font-black">
                                                {attr.totalRangeStr}
                                            </td>
                                            <td className="py-3 px-3 text-center text-slate-500">
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 mx-auto text-amber-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 mx-auto text-slate-500" />
                                                )}
                                            </td>
                                        </tr>

                                        {/* 展开的各级天命梯级数值明细 */}
                                        {isExpanded && (
                                            <tr className="bg-slate-950/70 border-y border-amber-500/20">
                                                <td colSpan={7} className="p-4">
                                                    <div className="flex flex-col gap-2">
                                                        <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                                                            <Info className="w-3.5 h-3.5" />
                                                            <span>
                                                                {attr.name} · 天命额外阶数梯级分布（当前 Lv.{currentLevel} 最高 +{maxExtraLevel} 阶）:
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1 font-mono text-xs">
                                                            {attr.possibleLadder.map(step => (
                                                                <div
                                                                    key={step.extraLevel}
                                                                    className={clsx(
                                                                        'p-2 rounded-lg border flex flex-col gap-0.5',
                                                                        step.extraLevel === maxExtraLevel
                                                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                                                                            : 'bg-slate-900 border-slate-800 text-slate-300'
                                                                    )}
                                                                >
                                                                    <div className="flex justify-between text-[10px] text-slate-400">
                                                                        <span>天命+{step.extraLevel}</span>
                                                                        <span className="text-orange-400">+{step.extraValStr}</span>
                                                                    </div>
                                                                    <div className="font-bold text-xs truncate mt-0.5">
                                                                        {step.totalRangeStr}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

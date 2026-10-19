import React, { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';

export interface ZhenlingUpgradeTier {
    tier: number;
    gold: { bingzhu: number; dan: number };
    purple: { bingzhu: number; dan: number };
}

export interface ZhenlingUpgradeData {
    title?: string;
    category?: string;
    subCategory?: string;
    description?: string;
    goldPerTierInc?: { bingzhu: number; dan: number };
    purplePerTierInc?: { bingzhu: number; dan: number };
    tiers?: ZhenlingUpgradeTier[];
    singleCardTotal?: {
        gold: { bingzhu: number; dan: number };
        purple: { bingzhu: number; dan: number };
    };
    presetCombos?: Array<{
        name: string;
        tag?: string;
        goldCount: number;
        purpleCount: number;
        targetTier: number;
        bingzhu: number;
        dan: number;
        desc?: string;
    }>;
}

export interface ZhenlingUpgradeCardProps {
    cardData?: {
        data?: ZhenlingUpgradeData;
    };
    className?: string;
}

const DEFAULT_TIERS: ZhenlingUpgradeTier[] = [
    { tier: 1, gold: { bingzhu: 10000, dan: 8 }, purple: { bingzhu: 5000, dan: 4 } },
    { tier: 2, gold: { bingzhu: 20000, dan: 16 }, purple: { bingzhu: 10000, dan: 8 } },
    { tier: 3, gold: { bingzhu: 30000, dan: 24 }, purple: { bingzhu: 15000, dan: 12 } },
    { tier: 4, gold: { bingzhu: 40000, dan: 32 }, purple: { bingzhu: 20000, dan: 16 } },
    { tier: 5, gold: { bingzhu: 50000, dan: 40 }, purple: { bingzhu: 25000, dan: 20 } },
    { tier: 6, gold: { bingzhu: 60000, dan: 48 }, purple: { bingzhu: 30000, dan: 24 } },
    { tier: 7, gold: { bingzhu: 70000, dan: 56 }, purple: { bingzhu: 35000, dan: 28 } },
    { tier: 8, gold: { bingzhu: 80000, dan: 64 }, purple: { bingzhu: 40000, dan: 32 } },
    { tier: 9, gold: { bingzhu: 90000, dan: 72 }, purple: { bingzhu: 45000, dan: 36 } },
    { tier: 10, gold: { bingzhu: 100000, dan: 80 }, purple: { bingzhu: 50000, dan: 40 } },
    { tier: 11, gold: { bingzhu: 110000, dan: 88 }, purple: { bingzhu: 55000, dan: 44 } },
    { tier: 12, gold: { bingzhu: 120000, dan: 96 }, purple: { bingzhu: 60000, dan: 48 } },
];

export const ZhenlingUpgradeCard: React.FC<ZhenlingUpgradeCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const tiers = data?.tiers || DEFAULT_TIERS;

    // 自定义测算器状态
    const [showCalc, setShowCalc] = useState(false);
    const [calcStartTier, setCalcStartTier] = useState<number>(0);
    const [calcTargetTier, setCalcTargetTier] = useState<number>(12);
    const [goldCount, setGoldCount] = useState<number>(6);
    const [purpleCount, setPurpleCount] = useState<number>(2);

    // 测算消耗逻辑
    const customResult = useMemo(() => {
        let goldBingzhu = 0;
        let goldDan = 0;
        let purpleBingzhu = 0;
        let purpleDan = 0;

        for (const item of tiers) {
            if (item.tier > calcStartTier && item.tier <= calcTargetTier) {
                goldBingzhu += item.gold.bingzhu;
                goldDan += item.gold.dan;
                purpleBingzhu += item.purple.bingzhu;
                purpleDan += item.purple.dan;
            }
        }

        const totalBingzhu = goldBingzhu * goldCount + purpleBingzhu * purpleCount;
        const totalDan = goldDan * goldCount + purpleDan * purpleCount;

        return {
            goldPerCard: { bingzhu: goldBingzhu, dan: goldDan },
            purplePerCard: { bingzhu: purpleBingzhu, dan: purpleDan },
            totalBingzhu,
            totalDan
        };
    }, [tiers, calcStartTier, calcTargetTier, goldCount, purpleCount]);

    return (
        <div className={`w-full max-w-xl mx-auto rounded-lg bg-[#0b101b] border border-[#1e293b] p-3 text-slate-200 font-sans shadow-xl text-xs space-y-3 ${className || ''}`}>
            {/* 顶部标题行与内嵌测算按钮 */}
            <div className="flex items-center justify-between border-b border-[#1f293d]/80 pb-2">
                <div className="flex items-center gap-2">
                    {/* <Layers className="w-4 h-4 text-amber-400" /> */}
                    <span className="font-bold text-sm text-slate-100 tracking-wide">
                        阵灵聚灵升级消耗对照表
                    </span>
                    {/* <span className="text-[10px] text-amber-400/90 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                        1~12阶全景
                    </span> */}
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/40 transition-colors"
                >
                    <Calculator className="w-3 h-3" />
                    <span>{showCalc ? '收起测算' : '自定义阶数测算'}</span>
                    {showCalc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>

            {/* 自定义阶数速算模块 */}
            {showCalc && (
                <div className="p-2.5 rounded bg-[#080d16] border border-cyan-900/40 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] gap-1">
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-slate-400">升级阶数：</span>
                            <select
                                value={calcStartTier}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setCalcStartTier(val);
                                    if (val >= calcTargetTier) setCalcTargetTier(Math.min(12, val + 1));
                                }}
                                className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                            >
                                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((t) => (
                                    <option key={t} value={t}>
                                        {t === 0 ? '0 阶' : `${t}阶`}
                                    </option>
                                ))}
                            </select>
                            <span className="text-slate-500 text-[10px]">→</span>
                            <select
                                value={calcTargetTier}
                                onChange={(e) => setCalcTargetTier(Number(e.target.value))}
                                className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                            >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
                                    .filter((t) => t > calcStartTier)
                                    .map((t) => (
                                        <option key={t} value={t}>
                                            {t} 阶
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <div className="flex items-center gap-0.5">
                                <span className="text-amber-400">金卡:</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={8}
                                    value={goldCount}
                                    onChange={(e) => {
                                        const val = Math.max(0, Math.min(8, parseInt(e.target.value) || 0));
                                        setGoldCount(val);
                                        if (val + purpleCount > 8) {
                                            setPurpleCount(8 - val);
                                        }
                                    }}
                                    className="w-7 bg-[#111827] border border-slate-700 rounded py-0.5 text-center text-amber-300 outline-none text-xs"
                                />
                            </div>
                            <div className="flex items-center gap-0.5">
                                <span className="text-purple-400">紫卡:</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={8}
                                    value={purpleCount}
                                    onChange={(e) => {
                                        const val = Math.max(0, Math.min(8, parseInt(e.target.value) || 0));
                                        setPurpleCount(val);
                                        if (val + goldCount > 8) {
                                            setGoldCount(8 - val);
                                        }
                                    }}
                                    className="w-7 bg-[#111827] border border-slate-700 rounded py-0.5 text-center text-purple-300 outline-none text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between p-2 rounded bg-black/40 border border-[#1e293b] text-[11px] gap-1.5">
                        <span className="text-slate-300">
                            从 <span className="text-cyan-300 font-bold">{calcStartTier}阶</span> 升至{' '}
                            <span className="text-cyan-300 font-bold">{calcTargetTier}阶</span>（
                            {goldCount > 0 && <span className="text-amber-300">{goldCount}金</span>}
                            {goldCount > 0 && purpleCount > 0 && ' + '}
                            {purpleCount > 0 && <span className="text-purple-300">{purpleCount}紫</span>}
                            ）：
                        </span>
                        <div className="flex items-center gap-3 font-semibold text-[11px]">
                            <span>
                                沧浪冰珠：<span className="text-amber-300 font-bold">{customResult.totalBingzhu.toLocaleString()}</span>
                            </span>
                            <span>
                                沧热聚灵丹：<span className="text-emerald-400 font-bold">{customResult.totalDan.toLocaleString()}</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 1~12阶消耗完整对照表（紧凑无溢出排版，杜绝窄屏水平滚动条） */}
            <div className="overflow-x-auto w-full rounded border border-[#1f293d]/80 bg-[#080d16]">
                <table className="w-full text-center border-collapse whitespace-nowrap text-[11px] sm:text-xs">
                    <thead>
                        {/* 双级表头 */}
                        <tr className="border-b border-[#1c2436]">
                            <th rowSpan={2} className="px-1.5 py-1.5 font-bold text-sky-300 bg-sky-950/30 border-r border-[#1c2436] w-12 shrink-0">
                                阶数
                            </th>
                            <th colSpan={2} className="px-1.5 py-1 font-bold text-amber-300 bg-amber-950/20 border-r border-[#1c2436]">
                                金卡
                            </th>
                            <th colSpan={2} className="px-1.5 py-1 font-bold text-purple-300 bg-purple-950/20">
                                紫卡
                            </th>
                        </tr>
                        <tr className="border-b border-[#1c2436] text-[10px] sm:text-[11px] text-slate-400 bg-black/40">
                            <th className="px-1 py-1 border-r border-[#1c2436] font-medium text-amber-200/80">
                                需要冰珠
                            </th>
                            <th className="px-1 py-1 border-r border-[#1c2436] font-medium text-amber-300/90">
                                需要沧热
                            </th>
                            <th className="px-1 py-1 border-r border-[#1c2436] font-medium text-purple-200/80">
                                需要冰珠
                            </th>
                            <th className="px-1 py-1 font-medium text-purple-300/90">
                                需要沧热
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#161f30]">
                        {tiers.map((t) => (
                            <tr key={t.tier} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-1.5 py-1 font-bold text-sky-400 bg-sky-950/10 border-r border-[#1c2436]">
                                    {t.tier}阶
                                </td>
                                <td className="px-1.5 py-1 text-amber-100/90 border-r border-[#1c2436]">
                                    {t.gold.bingzhu.toLocaleString()}
                                </td>
                                <td className="px-1 py-1 text-amber-300 font-semibold border-r border-[#1c2436]">
                                    {t.gold.dan}
                                </td>
                                <td className="px-1.5 py-1 text-purple-100/90 border-r border-[#1c2436]">
                                    {t.purple.bingzhu.toLocaleString()}
                                </td>
                                <td className="px-1 py-1 text-purple-300 font-semibold">
                                    {t.purple.dan}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {/* 满12阶总需汇总行 */}
                        <tr className="bg-emerald-950/50 font-bold border-t-2 border-emerald-500/40 text-emerald-300">
                            <td className="px-1.5 py-1.5 border-r border-emerald-800/40 text-emerald-300">
                                单卡共计
                            </td>
                            <td className="px-2 py-2 border-r border-emerald-800/40 text-amber-300">
                                780,000
                            </td>
                            <td className="px-2 py-2 border-r border-emerald-800/40 text-amber-400">
                                624
                            </td>
                            <td className="px-2 py-2 border-r border-emerald-800/40 text-purple-300">
                                390,000
                            </td>
                            <td className="px-2 py-2 text-purple-400">
                                312
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* 主流顶配组合测算（对应原图下方 6金2紫12 汇总表） */}
            <div className="rounded border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-[#0d1422] to-purple-950/30 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        {/* <Sparkles className="w-3.5 h-3.5 text-amber-400" /> */}
                        <span className="font-bold text-amber-300 text-xs">
                            主流组合测算：6金2紫满阶满聚灵
                        </span>
                    </div>
                    {/* <span className="text-[10px] text-slate-400">
                        主流 8 阵毕业基准
                    </span> */}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2 rounded bg-black/40 border border-[#1f293d] flex flex-col justify-center">
                        <span className="text-[11px] text-slate-400">需要冰珠总数</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-amber-300 font-bold text-sm tracking-wide">
                                5,460,000
                            </span>
                            <span className="text-[10px] text-slate-400">（546 万）</span>
                        </div>
                    </div>
                    <div className="p-2 rounded bg-black/40 border border-[#1f293d] flex flex-col justify-center">
                        <span className="text-[11px] text-slate-400">需要沧热总数</span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-emerald-400 font-bold text-sm tracking-wide">
                                4,368
                            </span>
                            {/* <span className="text-[10px] text-slate-400">颗</span> */}
                        </div>
                    </div>
                </div>
                {/* <div className="text-[10px] text-slate-400 pt-0.5 leading-relaxed">
                    测算口径：6 × (78万冰珠 + 624丹) + 2 × (39万冰珠 + 312丹)。紫卡消耗固定为金卡的 50%。
                </div> */}
            </div>
        </div>
    );
};

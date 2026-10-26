import React, { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react';

export interface FabaoLevelRow {
    level: number;
    currentExp: number;
    cumulativeExp: number;
    tianlong: number;
}

export interface FabaoUpgradeExpData {
    title?: string;
    version?: string;
    description?: string;
    itemConversion?: {
        tianlong?: { name: string; exp: number };
        zhenlong?: { name: string; exp: number; tianlongCount: number };
        liyang?: { name: string; exp: number };
    };
    milestones?: Array<{
        level: number;
        cumulativeExp: number;
        tianlong: number;
        desc?: string;
    }>;
    levels?: FabaoLevelRow[];
}

export interface FabaoUpgradeCardProps {
    cardData?: {
        data?: FabaoUpgradeExpData;
    };
    className?: string;
}

const DEFAULT_LEVELS: FabaoLevelRow[] = [
    { level: 1, currentExp: 0, cumulativeExp: 0, tianlong: 0 },
    { level: 2, currentExp: 350, cumulativeExp: 350, tianlong: 0.7 },
    { level: 3, currentExp: 600, cumulativeExp: 950, tianlong: 1.9 },
    { level: 4, currentExp: 860, cumulativeExp: 1810, tianlong: 3.6 },
    { level: 5, currentExp: 1130, cumulativeExp: 2940, tianlong: 5.9 },
    { level: 6, currentExp: 1420, cumulativeExp: 4360, tianlong: 8.7 },
    { level: 7, currentExp: 1720, cumulativeExp: 6080, tianlong: 12.2 },
    { level: 8, currentExp: 2030, cumulativeExp: 8110, tianlong: 16.2 },
    { level: 9, currentExp: 2350, cumulativeExp: 10460, tianlong: 20.9 },
    { level: 10, currentExp: 2690, cumulativeExp: 13150, tianlong: 26.3 },
    { level: 11, currentExp: 3030, cumulativeExp: 16180, tianlong: 32.4 },
    { level: 12, currentExp: 3390, cumulativeExp: 19570, tianlong: 39.1 },
    { level: 13, currentExp: 3940, cumulativeExp: 23510, tianlong: 47.0 },
    { level: 14, currentExp: 4350, cumulativeExp: 27860, tianlong: 55.7 },
    { level: 15, currentExp: 4780, cumulativeExp: 32640, tianlong: 65.3 },
    { level: 16, currentExp: 5220, cumulativeExp: 37860, tianlong: 75.7 },
    { level: 17, currentExp: 5680, cumulativeExp: 43540, tianlong: 87.1 },
    { level: 18, currentExp: 6160, cumulativeExp: 49700, tianlong: 99.4 },
    { level: 19, currentExp: 6630, cumulativeExp: 56330, tianlong: 112.7 },
    { level: 20, currentExp: 7130, cumulativeExp: 63460, tianlong: 126.9 },
    { level: 21, currentExp: 7660, cumulativeExp: 71120, tianlong: 142.2 },
    { level: 22, currentExp: 8190, cumulativeExp: 79310, tianlong: 158.6 },
    { level: 23, currentExp: 8750, cumulativeExp: 88060, tianlong: 176.1 },
    { level: 24, currentExp: 9330, cumulativeExp: 97390, tianlong: 194.8 },
    { level: 25, currentExp: 9920, cumulativeExp: 107310, tianlong: 214.6 },
    { level: 26, currentExp: 10550, cumulativeExp: 117860, tianlong: 235.7 },
    { level: 27, currentExp: 11240, cumulativeExp: 129100, tianlong: 258.2 },
    { level: 28, currentExp: 11970, cumulativeExp: 141070, tianlong: 282.1 },
    { level: 29, currentExp: 12840, cumulativeExp: 153910, tianlong: 307.8 },
    { level: 30, currentExp: 13900, cumulativeExp: 167810, tianlong: 335.6 },
    { level: 31, currentExp: 17270, cumulativeExp: 185080, tianlong: 370.2 },
    { level: 32, currentExp: 21740, cumulativeExp: 206820, tianlong: 413.6 },
    { level: 33, currentExp: 25470, cumulativeExp: 232290, tianlong: 464.6 },
    { level: 34, currentExp: 32340, cumulativeExp: 264630, tianlong: 529.3 },
    { level: 35, currentExp: 50570, cumulativeExp: 315200, tianlong: 630.4 },
    { level: 36, currentExp: 100000, cumulativeExp: 415200, tianlong: 830.4 },
    { level: 37, currentExp: 200000, cumulativeExp: 615200, tianlong: 1230.4 },
    { level: 38, currentExp: 375000, cumulativeExp: 990200, tianlong: 1980.4 },
    { level: 39, currentExp: 625000, cumulativeExp: 1615200, tianlong: 3230.4 },
    { level: 40, currentExp: 900000, cumulativeExp: 2515200, tianlong: 5030.4 }
];

export const FabaoUpgradeCard: React.FC<FabaoUpgradeCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const levels = data?.levels || DEFAULT_LEVELS;

    // 分段折叠状态：p1 (1~20级默认折叠), p2 (21~40级默认展开)
    const [openP1, setOpenP1] = useState(false);
    const [openP2, setOpenP2] = useState(true);

    // 交互测算器
    const [showCalc, setShowCalc] = useState(false);
    const [startLevel, setStartLevel] = useState<number>(1);
    const [targetLevel, setTargetLevel] = useState<number>(35);

    // 测算逻辑
    const LIYANG_EXP = data?.itemConversion?.liyang?.exp ?? 100;
    const calcResult = useMemo(() => {
        const startRow = levels.find((l) => l.level === startLevel);
        const targetRow = levels.find((l) => l.level === targetLevel);
        const startExp = startRow ? startRow.cumulativeExp : 0;
        const targetExp = targetRow ? targetRow.cumulativeExp : 0;
        const diffExp = Math.max(0, targetExp - startExp);

        const tianlongCount = Math.ceil(diffExp / 500);
        const zhenlongCount = Math.floor(diffExp / 5500);
        const remainTianlong = Math.ceil((diffExp % 5500) / 500);
        const liyangCount = Math.ceil(diffExp / LIYANG_EXP);

        return {
            diffExp,
            tianlongCount,
            zhenlongCount,
            remainTianlong,
            liyangCount
        };
    }, [levels, startLevel, targetLevel, LIYANG_EXP]);

    const p1Levels = levels.filter((l) => l.level >= 1 && l.level <= 20);
    const p2Levels = levels.filter((l) => l.level >= 21 && l.level <= 40);

    const renderLevelTable = (rows: FabaoLevelRow[]) => (
        <table className="w-full text-center border-collapse whitespace-nowrap text-[11px] sm:text-xs">
            <thead>
                <tr className="border-b border-[#1c2436] bg-black/60 text-[10px] sm:text-[11px] text-slate-400">
                    <th className="px-1 sm:px-1.5 py-1.5 font-bold text-sky-400 bg-sky-950/20 border-r border-[#1c2436] w-12 sm:w-14 shrink-0">
                        等级
                    </th>
                    <th className="px-1 sm:px-2 py-1.5 text-slate-300 border-r border-[#1c2436] text-right">
                        本级经验
                    </th>
                    <th className="px-1 sm:px-2 py-1.5 text-slate-300 border-r border-[#1c2436] text-right">
                        累计经验
                    </th>
                    <th className="px-1 sm:px-2 py-1.5 text-red-400 font-semibold border-r border-[#1c2436] text-right">
                        天龙魔血
                    </th>
                    <th className="px-1 sm:px-2 py-1.5 text-amber-400 font-semibold text-right">
                        折合真龙
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-[#161f30]">
                {rows.map((row) => {
                    const isMilestone = row.level === 30 || row.level === 35 || row.level === 40;
                    const zhenlong = (row.cumulativeExp / 5500).toFixed(1);

                    return (
                        <tr
                            key={row.level}
                            className={`hover:bg-slate-800/30 transition-colors ${isMilestone ? 'bg-red-950/20 font-medium' : ''
                                }`}
                        >
                            <td
                                className={`px-1 sm:px-1.5 py-1 font-bold border-r border-[#1c2436] ${isMilestone
                                    ? 'text-red-400 bg-red-950/40 font-black'
                                    : 'text-sky-400 bg-sky-950/10'
                                    }`}
                            >
                                {row.level}级
                            </td>
                            <td className="px-1 sm:px-2 py-1 text-slate-300 border-r border-[#1c2436] text-right">
                                {row.level > 1 ? row.currentExp.toLocaleString() : '-'}
                            </td>
                            <td className={`px-1 sm:px-2 py-1 border-r border-[#1c2436] text-right ${isMilestone ? 'text-red-300 font-bold' : 'text-slate-300'
                                }`}>
                                {row.level > 1 ? row.cumulativeExp.toLocaleString() : '-'}
                            </td>
                            <td className={`px-1 sm:px-2 py-1 border-r border-[#1c2436] text-right font-semibold ${isMilestone ? 'text-red-400 font-bold' : 'text-red-300/90'
                                }`}>
                                {row.level > 1 ? row.tianlong.toFixed(1) : '-'}
                            </td>
                            <td className="px-1 sm:px-2 py-1 text-amber-300 text-right">
                                {row.level > 1 ? zhenlong : '-'}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    return (
        <div className={`w-full max-w-xl rounded-lg bg-[#0b101b] border border-[#1e293b] p-3 text-slate-200 font-sans shadow-xl text-xs space-y-3 ${className || ''}`}>
            {/* 顶部标题行与右侧按钮 */}
            <div className="flex items-center justify-between border-b border-[#1f293d]/80 pb-2">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100 tracking-wide">
                        法宝经验等级对照表
                    </span>
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/40 transition-colors"
                >
                    <Calculator className="w-3 h-3" />
                    <span>{showCalc ? '收起测算' : '自定义等级测算'}</span>
                    {showCalc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>

            {/* 自定义等级速算工具 */}
            {showCalc && (
                <div className="p-2.5 rounded bg-[#080d16] border border-cyan-900/40 space-y-2 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px] gap-1">
                        <div className="flex items-center gap-1 shrink-0">
                            <span className="text-slate-400">升级区间：</span>
                            <select
                                value={startLevel}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setStartLevel(val);
                                    if (val >= targetLevel) setTargetLevel(Math.min(40, val + 1));
                                }}
                                className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                            >
                                {levels.filter((l) => l.level < 40).map((l) => (
                                    <option key={l.level} value={l.level}>
                                        {l.level}级
                                    </option>
                                ))}
                            </select>
                            <span className="text-slate-500 text-[10px]">→</span>
                            <select
                                value={targetLevel}
                                onChange={(e) => setTargetLevel(Number(e.target.value))}
                                className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                            >
                                {levels.filter((l) => l.level > startLevel).map((l) => (
                                    <option key={l.level} value={l.level}>
                                        {l.level}级
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="p-2 rounded bg-black/40 border border-[#1e293b] text-[11px] space-y-1.5">
                        <div className="text-slate-300">
                            从 <span className="text-cyan-300 font-bold">{startLevel}级</span> 升至{' '}
                            <span className="text-cyan-300 font-bold">{targetLevel}级</span>（差额：
                            <span className="text-amber-300 font-bold">{calcResult.diffExp.toLocaleString()}</span>）
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                            <span className="whitespace-nowrap">
                                <span className="text-red-400">天龙魔血</span>
                                <span className="text-slate-500">：</span>
                                <span className="text-red-400 font-bold tabular-nums">{calcResult.tianlongCount.toLocaleString()}</span>
                                <span className="text-slate-400"> 个</span>
                            </span>
                            <span className="whitespace-nowrap">
                                <span className="text-amber-400">真龙圣血</span>
                                <span className="text-slate-500">：</span>
                                <span className="text-amber-400 font-bold tabular-nums">{calcResult.zhenlongCount}</span>
                                <span className="text-slate-400"> 个</span>
                                {calcResult.remainTianlong > 0 && (
                                    <>
                                        <span className="text-slate-500"> + </span>
                                        <span className="text-red-400 font-bold tabular-nums">{calcResult.remainTianlong}</span>
                                        <span className="text-slate-400"> 个</span>
                                        <span className="text-red-400">天龙魔血</span>
                                    </>
                                )}
                            </span>
                            <span className="whitespace-nowrap">
                                <span className="text-orange-400">离阳火精</span>
                                <span className="text-slate-500">：</span>
                                <span className="text-orange-400 font-bold tabular-nums">{calcResult.liyangCount.toLocaleString()}</span>
                                <span className="text-slate-400"> 个</span>
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* 1~20级 与 21~40级 独立折叠区域（紧凑无溢出，告别臃肿双列） */}
            <div className="space-y-2">
                {/* 1. 前期阶段：1~20 级折叠卡 */}
                <div className="rounded border border-[#1f293d]/80 bg-[#080d16] overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setOpenP1(!openP1)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[#0d1424] hover:bg-[#121c32] transition-colors text-left"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-sky-300 text-xs">1 ~ 20 级</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <span>{openP1 ? '收起' : '展开'}</span>
                            {openP1 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                    </button>
                    {openP1 && (
                        <div className="overflow-x-auto no-scrollbar w-full border-t border-[#1c2436]">
                            {renderLevelTable(p1Levels)}
                        </div>
                    )}
                </div>

                {/* 2. 高阶阶段：21~40 级折叠卡（默认展开，核心高阶与满级） */}
                <div className="rounded border border-[#2b3952] bg-[#080d16] overflow-hidden shadow-lg">
                    <button
                        type="button"
                        onClick={() => setOpenP2(!openP2)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-[#0f172a] hover:bg-[#15203a] transition-colors text-left border-b border-[#1c2436]/50"
                    >
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-300 text-xs">21 ~ 40 级</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <span>{openP2 ? '收起' : '展开'}</span>
                            {openP2 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                    </button>
                    {openP2 && (
                        <div className="overflow-x-auto no-scrollbar w-full border-t border-[#1c2436]">
                            {renderLevelTable(p2Levels)}
                        </div>
                    )}
                </div>
            </div>

            {/* 核心换算与三大里程碑全景卡（自适应横条排版，杜绝文字折行挤压） */}
            <div className="rounded border border-red-500/25 bg-gradient-to-r from-red-950/20 via-[#0d1422] to-amber-950/20 p-2.5 space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] border-b border-[#1f293d]/80 pb-1.5">
                    <span className="whitespace-nowrap">
                        <span className="text-orange-400">离阳火精</span>
                        <span className="text-slate-500"> × 1 = </span>
                        <span className="text-orange-400 font-bold tabular-nums">100</span>
                        <span className="text-slate-400"> 经验</span>
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="text-red-400">天龙魔血</span>
                        <span className="text-slate-500"> × 1 = </span>
                        <span className="text-red-400 font-bold tabular-nums">500</span>
                        <span className="text-slate-400"> 经验</span>
                    </span>
                    <span className="whitespace-nowrap">
                        <span className="text-amber-400">真龙圣血</span>
                        <span className="text-slate-500"> × 1 = </span>
                        <span className="text-red-400">天龙魔血</span>
                        <span className="text-slate-500"> × 11 = </span>
                        <span className="text-amber-400 font-bold tabular-nums">5,500</span>
                        <span className="text-slate-400"> 经验</span>
                    </span>
                </div>

                <div className="space-y-1.5 pt-0.5">
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-2.5 py-1.5 rounded bg-black/50 border border-[#1f293d] gap-1 hover:border-cyan-500/30 transition-colors">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-cyan-400 font-bold">30级满</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] ml-auto sm:grid sm:grid-cols-[5rem_6rem_4rem] sm:gap-x-2 sm:gap-y-0">
                            <span className="text-right whitespace-nowrap">
                                <span className="text-orange-400 font-bold tabular-nums">1,679</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-orange-400">离阳</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-slate-500">约</span>
                                <span className="text-red-300 font-bold tabular-nums"> 336 </span>
                                <span className="text-slate-500">个</span>
                                <span className="text-red-300">天龙</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-amber-400 font-bold tabular-nums">31</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-amber-400">真龙</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-2.5 py-1.5 rounded bg-black/50 border border-[#1f293d] gap-1 hover:border-cyan-500/30 transition-colors">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-cyan-400 font-bold">35级满</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] ml-auto sm:grid sm:grid-cols-[5rem_6rem_4rem] sm:gap-x-2 sm:gap-y-0">
                            <span className="text-right whitespace-nowrap">
                                <span className="text-orange-400 font-bold tabular-nums">3,152</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-orange-400">离阳</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-slate-500">约</span>
                                <span className="text-red-300 font-bold tabular-nums"> 631 </span>
                                <span className="text-slate-500">个</span>
                                <span className="text-red-300">天龙</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-amber-400 font-bold tabular-nums">58</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-amber-400">真龙</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-2.5 py-1.5 rounded bg-black/50 border border-[#1f293d] gap-1 hover:border-cyan-500/30 transition-colors">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs text-cyan-400 font-bold">40级满</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] ml-auto sm:grid sm:grid-cols-[5rem_6rem_4rem] sm:gap-x-2 sm:gap-y-0">
                            <span className="text-right whitespace-nowrap">
                                <span className="text-orange-400 font-bold tabular-nums">25,152</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-orange-400">离阳</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-slate-500">约</span>
                                <span className="text-red-300 font-bold tabular-nums"> 5,031 </span>
                                <span className="text-slate-500">个</span>
                                <span className="text-red-300">天龙</span>
                            </span>
                            <span className="text-right whitespace-nowrap">
                                <span className="text-amber-400 font-bold tabular-nums">458</span>
                                <span className="text-slate-500"> 个</span>
                                <span className="text-amber-400">真龙</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

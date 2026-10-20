import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface NinglingqiAttribute {
    id: number;
    name: string;
    isPercent: boolean;
    weight: number;
    min: number;
    max: number;
}

export interface NinglingqiPool {
    lineIndex: number;
    attributes: NinglingqiAttribute[];
}

export interface NinglingqiData {
    name?: string;
    tier?: string;
    maxRows?: number;
    unlockNeeds?: number[];
    stageCosts?: Array<{ dou: number; stone: number }>;
    postMaxCost?: { dou: number; stone: number };
    rollbackCosts?: Array<{ times: number; pact: number; silver: number }>;
    caps?: {
        cap2AttrIds?: number[];
        cap2Desc?: string;
        cap1AttrIds?: number[];
        cap1Desc?: string;
    };
    secrets?: Array<{
        rate: number;
        need: string[];
        bonus: { name: string; value: string };
    }>;
    pools?: NinglingqiPool[];
}

export interface NinglingqiDetailCardProps {
    cardData?: {
        data?: NinglingqiData;
        initialHole?: number;
    };
    className?: string;
}

// 稀有属性出现限制提示（从第 3 条到第 12 条统一标注存在上限）
const LINE_CAP_NOTES: Record<number, string> = {
    3: '稀有属性存在上限',
    4: '稀有属性存在上限',
    5: '稀有属性存在上限',
    6: '稀有属性存在上限',
    7: '稀有属性存在上限',
    8: '稀有属性存在上限',
    9: '稀有属性存在上限',
    10: '稀有属性存在上限',
    11: '稀有属性存在上限',
    12: '稀有属性存在上限',
};

// 稀有/核心高阶属性名称集合（高亮呈现）
const RARE_ATTR_NAMES = new Set([
    '暴击', '减免暴击', '暴击伤害', '致命一击伤害', '减免爆伤',
    '无视伤害减免', '减免伤害百分比', '冲灵', '化灵',
    '技能命中', '技能躲闪',
    '对人族增伤', '对神裔增伤', '对天脉增伤', '对苍祇增伤', '对苍衠增伤',
    '对人族减伤', '对神裔减伤', '对天脉减伤', '对苍祇减伤', '对苍衠减伤',
    '克仙', '克佛', '克魔', '御仙', '御佛', '御魔',
    '攻击百分比', '气血百分比', '真气百分比', '防御百分比'
]);

/**
 * 将底层词条名称格式化为客户端原生实机展示名（1:1 对齐官方截图）
 */
function formatNlqAttrName(name: string): string {
    switch (name) {
        case '暴击伤害': return '致命一击伤害';
        case '对苍衠增伤': return '对苍祇增伤';
        case '对苍衠减伤': return '对苍祇减伤';
        case '气血基础值': return '基础气血';
        case '真气基础值': return '基础真气';
        case '防御基础值': return '基础防御';
        case '攻击基础值': return '基础攻击';
        default: return name;
    }
}

export const NinglingqiDetailCard: React.FC<NinglingqiDetailCardProps> = ({
    cardData,
    className
}) => {
    const data = cardData?.data;
    const pools = data?.pools || [];

    // 当前选中的阶位孔数（1 ~ 12，默认全开 12 孔）
    const [activeHoles, setActiveHoles] = useState<number>(() => {
        if (typeof cardData?.initialHole === 'number') {
            return Math.min(12, Math.max(1, cardData.initialHole));
        }
        return 12;
    });

    // 默认所有条目均折叠
    const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({});

    // 升级孔位逻辑：升级到哪个孔就只展开哪个孔，同时允许用户自由展开其他孔
    const handleHoleChange = (nextHole: number) => {
        const clamped = Math.min(12, Math.max(1, nextHole));
        setActiveHoles(clamped);
        setExpandedLines({ [clamped]: true });
    };

    // 是否展开规则与成本面板
    const [showCostPanel, setShowCostPanel] = useState<boolean>(false);
    const [showSecretsPanel, setShowSecretsPanel] = useState<boolean>(false);

    const toggleLine = (lineIdx: number) => {
        setExpandedLines(prev => ({ ...prev, [lineIdx]: !prev[lineIdx] }));
    };

    const toggleAllLines = (expand: boolean) => {
        const next: Record<number, boolean> = {};
        for (let i = 1; i <= 12; i++) {
            next[i] = expand;
        }
        setExpandedLines(next);
    };

    const allExpanded = useMemo(() => {
        for (let i = 1; i <= activeHoles; i++) {
            if (!expandedLines[i]) return false;
        }
        return true;
    }, [activeHoles, expandedLines]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0 max-w-xl',
            className
        )}>
            {/* 顶部分类与展开/折叠所有属性按钮 */}
            <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 text-[11px] font-sans">
                <div className="flex items-center gap-1.5">
                    <button
                        type="button"
                        className="px-2.5 py-1 rounded-md text-xs font-medium border bg-amber-500/20 text-amber-200 border-amber-500/50 shadow-sm cursor-default"
                    >
                        宸极
                    </button>
                    <span className="text-[11px] text-slate-400 ml-1">
                        12 孔位洗炼属性池与概率表
                    </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={() => toggleAllLines(!allExpanded)}
                        className="px-2.5 py-1 rounded text-[11px] text-cyan-300 bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 transition-colors cursor-pointer whitespace-nowrap"
                    >
                        {allExpanded ? '折叠所有属性' : '展开所有属性'}
                    </button>
                </div>
            </div>

            {/* 1:1 游戏实机截图原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-3 sm:p-4 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/98 shadow-2xl min-w-0"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.75), inset 0 0 16px rgba(16, 28, 48, 0.4)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 装备头部区域：装备名称（游戏金色 #ffdc50，无标点），右侧推演步进器 */}
                <div className="pb-1.5 mb-1 border-b border-[#1f293d]/80 flex items-center justify-between gap-2 min-w-0 flex-wrap">
                    <div
                        className="font-bold text-[15px] sm:text-[16px] leading-snug tracking-wide"
                        style={{ color: GAME_COLORS.GOLD_AMBER }}
                    >
                        宸极凝灵契
                    </div>

                    {/* 孔数推演步进控制台 */}
                    <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto font-sans">
                        <button
                            type="button"
                            onClick={() => handleHoleChange(activeHoles - 1)}
                            disabled={activeHoles <= 1}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border whitespace-nowrap cursor-pointer',
                                activeHoles <= 1
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                            )}
                        >
                            孔数 -1
                        </button>
                        <button
                            type="button"
                            onClick={() => handleHoleChange(activeHoles + 1)}
                            disabled={activeHoles >= 12}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border whitespace-nowrap cursor-pointer',
                                activeHoles >= 12
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-amber-600/30 border-amber-500/50 text-amber-200 hover:bg-amber-600/50 hover:text-white'
                            )}
                        >
                            孔数 +1
                        </button>
                    </div>
                </div>

                {/* 装备状态（橙红色 不会掉落，1:1 游戏实机） */}
                <div style={{ color: GAME_COLORS.OWNER_ORANGE }} className="font-medium text-[13px] mb-1">
                    不会掉落
                </div>

                {/* 凝灵契全局洗炼上限说明（顶部规则清晰呈现） */}
                <div className="my-2 p-2 rounded bg-black/40 border border-[#1c2436] text-[12px] leading-relaxed">
                    <div className="font-semibold text-amber-300 mb-0.5">凝灵契全局洗炼约束:</div>
                    <div className="text-slate-300 text-[11px] pl-1 space-y-0.5 font-sans">
                        <div>• <span className="text-rose-400 font-medium">暴击/暴伤系上限</span>：暴击、减免暴击、致命一击伤害、减免爆伤在整个凝灵契中<span className="text-amber-200 font-bold">最多出现 2 条</span>。</div>
                        <div>• <span className="text-sky-300 font-medium">稀有独立上限</span>：无视、减免百分比、技能命中、技能躲闪、冲灵化灵、六大克御属性在整个凝灵契中<span className="text-amber-200 font-bold">各类最多出现 1 条</span>。</div>
                    </div>
                </div>

                {/* 12 孔位属性列表 */}
                <div className="space-y-1.5 my-1.5">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((lineIdx) => {
                        const isUnlocked = lineIdx <= activeHoles;
                        const p = pools.find(pool => pool.lineIndex === lineIdx);
                        const capNote = LINE_CAP_NOTES[lineIdx];
                        const isExpanded = Boolean(expandedLines[lineIdx]);
                        const totalWeight = p ? p.attributes.reduce((sum, a) => sum + a.weight, 0) : 1;

                        return (
                            <div
                                key={lineIdx}
                                className={clsx(
                                    'rounded border transition-all overflow-hidden',
                                    isUnlocked
                                        ? 'bg-[#09111c]/80 border-[#1a283e]'
                                        : 'bg-[#06080e]/60 border-slate-800/30'
                                )}
                            >
                                {/* 属性条目表头：与佩章档位颜色对齐（#ffd272） */}
                                <div
                                    onClick={() => toggleLine(lineIdx)}
                                    className="px-2.5 py-1.5 flex items-center justify-between gap-1.5 select-none cursor-pointer hover:bg-white/[0.04]"
                                >
                                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span
                                            className="font-bold text-[12.5px] whitespace-nowrap"
                                            style={{
                                                color: isUnlocked ? '#ffd272' : GAME_COLORS.TEXT_LOCKED
                                            }}
                                        >
                                            第{lineIdx}条
                                        </span>
                                        {!isUnlocked && (
                                            <span className="text-[11px] text-slate-500">
                                                (未解锁)
                                            </span>
                                        )}

                                        {/* 稀有排他上限提示 */}
                                        {capNote && isUnlocked && (
                                            <span className="text-[10px] text-rose-400 bg-rose-950/40 px-1.5 py-0.2 rounded border border-rose-500/30 whitespace-nowrap font-sans">
                                                ★ {capNote}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-sans">
                                        {isExpanded ? '收起 ▲' : '展开 ▼'}
                                    </span>
                                </div>

                                {/* 展开后的完整候选池与概率表（统一星宿/天缘同款两端对齐展示，无顶部表头） */}
                                {isExpanded && p && (
                                    <div className="border-t border-[#1b2537] p-2 bg-black/40 space-y-1">
                                        {p.attributes.map((attr, aIdx) => {
                                            const isRare = RARE_ATTR_NAMES.has(attr.name);
                                            const ratePct = ((attr.weight / totalWeight) * 100).toFixed(1);
                                            const unit = attr.isPercent ? '%' : '';
                                            const displayName = formatNlqAttrName(attr.name);

                                            return (
                                                <div
                                                    key={aIdx}
                                                    className="flex items-center justify-between text-[13px] leading-[22px]"
                                                >
                                                    <span style={{
                                                        color: isRare ? '#38bdf8' : GAME_COLORS.STAT_BLUE
                                                    }}>
                                                        · {displayName} {attr.min}{unit} - {attr.max}{unit}
                                                    </span>
                                                    <span className="text-[11px] font-sans" style={{ color: '#8892b0' }}>
                                                        概率 {ratePct}%
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 灵契秘效激活条件与增益（1:1 游戏实机排版） */}
                <div className="mt-2.5 pt-2 border-t border-[#1f293d]/80 text-[12.5px] leading-relaxed space-y-1">
                    {/* <div>
                        <span style={{ color: GAME_COLORS.WHITE }}>灵契秘效激活条件：</span>
                        <span className="text-slate-400">技能躲闪、</span>
                        <span style={{ color: GAME_COLORS.MINT_GREEN }}>减免爆伤、</span>
                        <span className="text-slate-400">基础气血</span>
                    </div>
                    <div>
                        <span style={{ color: GAME_COLORS.WHITE }}>灵契秘效激活增益：</span>
                        <span className="text-slate-400">技能躲闪+3.2(未激活)</span>
                    </div> */}

                    {/* 查看全部 6 种灵契秘效激活抽屉 */}
                    <div className="pt-0.5">
                        <button
                            type="button"
                            onClick={() => setShowSecretsPanel(prev => !prev)}
                            className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-sans"
                        >
                            {showSecretsPanel ? '收起 6 种灵契秘效共鸣池 ▲' : '查看全部 6 种灵契秘效共鸣池 ▼'}
                        </button>
                    </div>

                    {showSecretsPanel && (
                        <div className="mt-1.5 p-2 rounded bg-black/50 border border-[#1c2436] space-y-1.5 font-sans">
                            {(data?.secrets || []).map((sec, sIdx) => (
                                <div key={sIdx} className="p-2 rounded bg-[#0c121e] border border-slate-800/80 flex flex-col gap-1 text-[11px]">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-emerald-400">
                                            秘效：{sec.bonus.name} +{sec.bonus.value}
                                        </span>
                                        <span className="text-[10px] text-amber-300/80 font-sans">
                                            生成概率 {sec.rate}%
                                        </span>
                                    </div>
                                    <div className="text-slate-300 font-sans text-[11.5px] leading-relaxed">
                                        组合：<span className="text-amber-200/90">{sec.need.map(formatNlqAttrName).join(' + ')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 回溯次数与价格（青色与白色，1:1 游戏实机） */}
                {/* <div className="mt-2 pt-2 border-t border-[#1f293d]/80 text-[12.5px] leading-relaxed space-y-0.5">
                    <div style={{ color: GAME_COLORS.SHENYIN_CYAN }}>
                        已回溯次数/可回溯次数：3/3
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        价格 1 银
                    </div>
                </div> */}

                {/* 品质与官方原著背景文本（1:1 游戏截图诗文） */}
                <div className="mt-2.5 pt-2 border-t border-[#1f293d]/80 text-[12.5px] leading-5 space-y-1">
                    <div style={{ color: GAME_COLORS.GOLD_AMBER }} className="font-bold">
                        品质：宸极
                    </div>
                    <div style={{ color: GAME_COLORS.HUN_GREEN }}>
                        灵凝方寸契，暗合印中玄。
                    </div>
                    <div style={{ color: GAME_COLORS.GOLD_AMBER }} className="leading-snug">
                        灵宠朝夕吐纳灵韵，溢散的精纯之气与天地灵气交感，自然凝为方寸契石。将其嵌于 誓印-凝灵契 的孔槽内，灵韵随行，增益修为。
                    </div>
                </div>

                {/* 开孔消耗与日常洗炼成本（折叠抽屉） */}
                <div className="mt-2.5 pt-2 border-t border-[#1f293d]/80 font-sans">
                    <button
                        type="button"
                        onClick={() => setShowCostPanel(prev => !prev)}
                        className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-sans"
                    >
                        {showCostPanel ? '收起开孔与回溯材料成本 ▲' : '查看开孔累计与洗炼回溯消耗成本明细 ▼'}
                    </button>

                    {showCostPanel && (
                        <div className="mt-1.5 p-2 rounded bg-black/50 border border-[#1c2436] text-[11px] space-y-1.5">
                            <div className="p-1.5 rounded bg-[#0c121e] border border-slate-800/80 space-y-0.5">
                                <div className="text-cyan-300 font-bold">开孔累计消耗（至 12 孔全开）</div>
                                <div className="text-slate-300 pl-1 space-y-0.5">
                                    <div>• 洗炼总次数：<strong className="text-amber-200">745 次</strong></div>
                                    <div>• 仙豆总计：<strong className="text-amber-200">43,600</strong> 颗</div>
                                    <div>• 凝灵石总计：<strong className="text-amber-200">87,200</strong> 颗</div>
                                </div>
                            </div>
                            <div className="p-1.5 rounded bg-[#0c121e] border border-slate-800/80 space-y-0.5">
                                <div className="text-cyan-300 font-bold">日常洗炼与回溯消耗</div>
                                <div className="text-slate-300 pl-1 space-y-0.5">
                                    <div>• 满孔后单次洗炼：10 仙豆 + 20 凝灵石</div>
                                    <div>• 回溯第 1 次：1 凝灵契 + 200 银票</div>
                                    <div>• 回溯第 2 次：2 凝灵契 + 400 银票</div>
                                    <div>• 回溯第 3 次：3 凝灵契 + 600 银票（至多 3 次）</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

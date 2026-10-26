import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';
import { formatPointAttrValue, isPointAttr } from '../../utils/attrUnits';

/**
 * 四灵本元（伏龙鼎镶嵌）信息卡
 * 数据源：web_app/public/game_data/silin_benyuan.json
 *
 * 系统特性（非模拟器）：
 * - 四灵各一系（夔牛/黄鸟/烛龙/饕餮），每灵 1~5 阶，同灵同阶本元名固定
 * - 阶 N 的本元 = N+1 条词条，每条按对应阶概率池独立抽取
 * - 数值按阶位系数折算（一阶 6.25% → 五阶 100%），表内 value 为五阶满值
 * 因此本卡只做「每灵 × 每阶」的可能词条 + 概率 + 折算值速查，不提供随机模拟。
 */

export interface SilinBenyuanPoolEntry {
    attr: string;
    value: number;
    isPercent: boolean;
    rate: number;
    perElementRate?: number;
    sheetValue?: string;
}

export interface SilinBenyuanSpirit {
    id: string;
    name: string;
    slotFace?: string;
    theme?: string;
    tierNames?: Record<string, string | null>;
    flavor?: Record<string, string | null>;
    bestPicks?: string[];
    pools?: Record<string, SilinBenyuanPoolEntry[]>;
}

export interface SilinBenyuanSample {
    spirit: string;
    tier: number;
    itemName: string;
    lines: string[];
    check?: string;
    anomaly?: string;
    rawTooltip?: string;
}

export interface SilinBenyuanData {
    systemName?: string;
    category?: string;
    description?: string;
    source?: string;
    dropStatus?: string;
    rules?: {
        maxTier?: number;
        slotRule?: string;
        slotCountByTier?: Record<string, number>;
        valueScale?: Record<string, number>;
        valueScaleNote?: string;
        resistanceRule?: string;
        bindNote?: string;
    };
    attributeDictionary?: Record<string, { display?: string; isPercent?: boolean; isGroup?: boolean }>;
    spirits?: SilinBenyuanSpirit[];
    tierSamples?: SilinBenyuanSample[];
    openQuestions?: string[];
}

export interface SilinBenyuanCardProps {
    cardData?: {
        data?: SilinBenyuanData;
        initialSpiritId?: string;
        initialTier?: number;
    };
    className?: string;
}

const TIERS = [1, 2, 3, 4, 5];

/**
 * 诛仙实机四灵本元阶位品质色映射（1:1 游戏实机）
 * 一阶：纯白 (#ffffff)
 * 二阶：翠绿 (#00ff00)
 * 三阶：湛蓝 (#3aa6f9)
 * 四阶：幽紫 (#aa32ff)
 * 五阶：炽橙 (#ff6000)
 */
const TIER_QUALITY_COLORS: Record<number, string> = {
    1: GAME_COLORS.WHITE,
    2: GAME_COLORS.BRIGHT_GREEN,
    3: GAME_COLORS.SKY_BLUE,
    4: GAME_COLORS.VIOLET_PURPLE,
    5: GAME_COLORS.OWNER_ORANGE
};

const TIER_CN: Record<number, string> = { 1: '一阶', 2: '二阶', 3: '三阶', 4: '四阶', 5: '五阶' };

/** 只产出数值部分（不含属性名），供「每阶提升」括号复用 */
function formatAttrValue(displayName: string, curVal: number, isPercent: boolean): string {
    // 技能命中 / 技能躲闪是点数，永不带 %（数据源 isPercent 可能误标，这里硬兜底）
    if (isPointAttr(displayName)) return formatPointAttrValue(curVal);
    if (isPercent) {
        if (
            displayName.includes('冲灵') ||
            displayName.includes('化灵') ||
            displayName.includes('防御百分比') ||
            displayName.includes('减免百分比') ||
            displayName.includes('无视')
        ) {
            return `${curVal.toFixed(2)}%`;
        }
        if (displayName.includes('伤害增加') || displayName.includes('伤害减少')) {
            return `${curVal.toFixed(0)}%`;
        }
        if (
            displayName.includes('暴击率') ||
            displayName.includes('暴击伤害') ||
            displayName.includes('致命一击')
        ) {
            return curVal % 1 === 0 ? `${curVal}%` : `${curVal.toFixed(2)}%`;
        }
        return `${curVal}%`;
    }
    return String(Math.round(curVal));
}

function formatAttrEntry(displayName: string, curVal: number, isPercent: boolean): string {
    const valStr = formatAttrValue(displayName, curVal, isPercent);
    if (
        displayName.includes('增加技能命中') ||
        displayName.includes('增加技能躲闪') ||
        displayName.includes('被致命一击的概率减少') ||
        displayName.includes('受到致命一击伤害减少')
    ) {
        return `${displayName} ${valStr}`;
    }
    if (
        displayName.endsWith('增加') ||
        displayName.endsWith('减少') ||
        displayName.endsWith('降低') ||
        displayName.includes('固定值')
    ) {
        return `${displayName} ${valStr}`;
    }
    if (displayName.includes('无视')) {
        return `${displayName}+${valStr}`;
    }
    return `${displayName} +${valStr}`;
}

const TIER_SCALE: Record<number, number> = {
    1: 0.0625, // 1/16 (除以4次2)
    2: 0.125,  // 1/8  (除以3次2)
    3: 0.25,   // 1/4  (除以2次2)
    4: 0.5,    // 1/2  (除以1次2)
    5: 1.0     // 满属性基准
};

const TIER_SLOT_COUNT: Record<number, number> = {
    1: 2,
    2: 3,
    3: 4,
    4: 5,
    5: 6
};

export const SilinBenyuanCard: React.FC<SilinBenyuanCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const spirits = useMemo(() => data?.spirits || [], [data?.spirits]);
    const dict = data?.attributeDictionary || {};

    const [activeSpiritId, setActiveSpiritId] = useState<string>(() => {
        const wanted = cardData?.initialSpiritId;
        if (wanted && spirits.some((s) => s.id === wanted)) return wanted;
        return spirits[0]?.id ?? 'kuiniu';
    });
    const [tier, setTier] = useState<number>(() => {
        const t = cardData?.initialTier;
        return t && t >= 1 && t <= 5 ? t : 5;
    });
    const [expandedAttr, setExpandedAttr] = useState<string | null>(null);

    const activeSpirit = useMemo(
        () => spirits.find((s) => s.id === activeSpiritId) || spirits[0],
        [spirits, activeSpiritId]
    );

    // 当前阶位的数值折算系数（以五阶满值为 1.0 基准，每降一阶除以 2）
    const scale = TIER_SCALE[tier] ?? 1.0;
    const slotCount = TIER_SLOT_COUNT[tier] ?? (tier + 1);

    // 当前选定阶位下，可出现的属性来自 1..tier 阶累计解锁池
    const unlockedPools = useMemo(() => {
        if (!activeSpirit?.pools) return [];
        const result: { tierLevel: number; entries: SilinBenyuanPoolEntry[] }[] = [];

        for (let t = 1; t <= tier; t++) {
            const rawPool = activeSpirit.pools[String(t)] || [];
            const normal: SilinBenyuanPoolEntry[] = [];
            const resistance: SilinBenyuanPoolEntry[] = [];
            for (const entry of rawPool) {
                if (entry.attr === '抗性（五行之一）' || entry.attr.includes('抗性')) {
                    resistance.push(entry);
                } else {
                    normal.push(entry);
                }
            }
            result.push({
                tierLevel: t,
                entries: [...normal, ...resistance]
            });
        }
        return result;
    }, [activeSpirit, tier]);

    const attrDisplay = (attr: string) => dict[attr]?.display || attr;

    if (!activeSpirit) return null;

    const tierColor = TIER_QUALITY_COLORS[tier] || GAME_COLORS.WHITE;
    const tierName = activeSpirit.tierNames?.[String(tier)] || null;
    const itemTitle = tierName
        ? `${activeSpirit.name}本元·${tierName}`
        : `${activeSpirit.name}本元`;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 顶部控制栏：四灵切换（移动端横向滑动，不换行） */}
            <div className="flex flex-col gap-1.5 w-full max-w-[32rem]">
                {/* 四灵切换栏 */}
                <div className="bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 w-full overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-1.5 w-max min-w-full">
                    {spirits.map((s) => {
                        const isActive = s.id === activeSpiritId;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    setActiveSpiritId(s.id);
                                    setExpandedAttr(null);
                                }}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer border',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-transparent'
                                )}
                            >
                                {s.name}本元
                            </button>
                        );
                    })}
                    </div>
                </div>

                {/* 阶位切换：已改为卡片内的「等阶 -1 / +1」步进（与天缘/九纹琅同款），此处不再用五个页签 */}
            </div>

            {/* 本元主卡：1:1 游戏实机 Tooltip 排版（对齐佩章原生排版样式） */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2.5 w-full max-w-[32rem]"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 装备头部区域：装备名称（按品质变色，下带细分隔线，与佩章完全对齐） */}
                <div className="pb-1.5 border-b border-[#1f293d]/80 flex items-center justify-between gap-2 min-w-0 flex-wrap">
                    <div
                        className="font-bold text-[13px] sm:text-[14px] leading-snug break-words"
                        style={{ color: tierColor }}
                    >
                        {itemTitle}
                    </div>
                </div>

                {/* 装备状态（橙色 不会掉落） */}
                <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                    不会掉落
                </div>

                {/* 阶位信息 + 等阶步进（与天缘 / 九纹琅信息卡同款按钮） */}
                <div className="flex items-center justify-between gap-2 flex-wrap" style={{ color: GAME_COLORS.WHITE }}>
                    <span className="flex items-baseline gap-2">
                        {TIER_CN[tier]}
                        <span className="text-slate-200 text-[12px]">
                            限定属性数目：<span className="text-amber-400 font-bold">{slotCount} 条</span>
                        </span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setTier((t) => Math.max(TIERS[0], t - 1));
                                setExpandedAttr(null);
                            }}
                            disabled={tier <= TIERS[0]}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                tier <= TIERS[0]
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                            )}
                        >
                            等阶 -1
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTier((t) => Math.min(TIERS[TIERS.length - 1], t + 1));
                                setExpandedAttr(null);
                            }}
                            disabled={tier >= TIERS[TIERS.length - 1]}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                tier >= TIERS[TIERS.length - 1]
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                            )}
                        >
                            等阶 +1
                        </button>
                    </div>
                </div>

                {/* 2. 词条池区域：按几阶才会出现的可选项分段列出当前真实数值与概率 */}
                <div className="flex flex-col gap-3 border-t border-[#1f293d]/60 pt-2">
                    {unlockedPools.map(({ tierLevel, entries }) => {
                        const tColor = TIER_QUALITY_COLORS[tierLevel];
                        const tTitle = `${TIER_CN[tierLevel]}解锁可洗练属性`;

                        return (
                            <div key={tierLevel} className="flex flex-col gap-1">
                                {/* 阶位解锁池标签 */}
                                <div className="flex items-center justify-between text-xs py-0.5 border-b border-[#1c2433]">
                                    <span className="font-bold flex items-center gap-1.5" style={{ color: tColor }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tColor }} />
                                        {tTitle}
                                    </span>
                                </div>

                                {/* 该阶池所有词条（当前阶数值折算 + 抽取概率）。
                                    移动端不换行：外层 overflow-x-auto，行内 whitespace-nowrap */}
                                <div className="flex flex-col gap-1 pt-0.5 overflow-x-auto no-scrollbar">
                                    <div className="flex flex-col gap-1 min-w-max">
                                    {entries.map((entry) => {
                                        const isPercent = entry.isPercent;
                                        const curVal = entry.value * scale;
                                        const isGroup = entry.attr.includes('抗性') || dict[entry.attr]?.isGroup === true;
                                        const uniqueKey = `${tierLevel}_${entry.attr}`;
                                        const expanded = expandedAttr === uniqueKey;
                                        const ratePct = (entry.rate * 100).toFixed(2);
                                        const lineText = formatAttrEntry(attrDisplay(entry.attr), curVal, isPercent);
                                        // 升到下一阶的增量（五阶已满，不再显示）
                                        const nextScale = TIER_SCALE[tier + 1];
                                        const gainStr = nextScale
                                            ? formatAttrValue(attrDisplay(entry.attr), entry.value * nextScale - curVal, isPercent)
                                            : null;

                                        return (
                                            <div key={entry.attr} className="min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedAttr(expanded ? null : uniqueKey)}
                                                    className="w-full text-left flex items-center gap-2 min-w-0 cursor-pointer group"
                                                    title={isGroup ? '点击展开五系单系概率' : undefined}
                                                >
                                                    <span
                                                        className="shrink-0 inline-flex items-center justify-center w-3.5 text-slate-500 group-hover:text-slate-300"
                                                        style={{ visibility: isGroup ? 'visible' : 'hidden' }}
                                                    >
                                                        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                    </span>
                                                    <span
                                                        className="flex-1 min-w-0 whitespace-nowrap"
                                                        style={{ color: GAME_COLORS.STAT_BLUE }}
                                                    >
                                                        {lineText}
                                                        {gainStr && (
                                                            <span className="text-emerald-400 text-[11px] font-sans ml-1.5 font-medium">
                                                                (升级 +{gainStr})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="shrink-0 text-[11px] font-sans text-slate-400">
                                                        概率 {ratePct}%
                                                    </span>
                                                </button>

                                                {isGroup && expanded && (
                                                    <div
                                                        className="pl-5 pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-sans"
                                                        style={{ color: GAME_COLORS.STAT_BLUE }}
                                                    >
                                                        {['虚弱', '眩晕', '昏睡', '定身', '魅惑'].map((el) => (
                                                            <span key={el} className="flex items-center gap-1">
                                                                <span>
                                                                    {el}抗性 +{Math.round(entry.value * scale)}
                                                                    {TIER_SCALE[tier + 1] && (
                                                                        <span className="text-emerald-400 ml-1 font-medium">
                                                                            (升级 +{Math.round(entry.value * TIER_SCALE[tier + 1] - curVal)})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <span className="text-slate-400">
                                                                    (单系 {((entry.perElementRate ?? entry.rate / 5) * 100).toFixed(2)}%)
                                                                </span>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SilinBenyuanCard;

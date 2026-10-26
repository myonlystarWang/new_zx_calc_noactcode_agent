import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

/**
 * 轩辕策属性信息卡（1:1 还原游戏 tooltip 的信息层级，版式对齐旧天缘卡）
 *
 * 数据口径：
 * - 属性池 / 数值区间 / 每级增益：`public/game_data/xyc_rules.json`（与官方参考站 mujiston 同源同值）
 * - 四系书名、品阶、等级上限：`public/game_data/xyc_tomes.json`（完美世界官方专题「天书第四卷---轩辕策」）
 *
 * 版式基准：`OldTianyuanDetailCard.tsx`（青色选中 tab / 扁平等级步进 / 青色徽章）
 */

const FONT_SONG = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';

/** 四系专属属性专用色：亮蓝（避开右侧「+N/级」绿字与通用属性的紫蓝） */
const SPECIAL_ATTR_COLOR = GAME_COLORS.SKY_BLUE;

export interface XycAttrRule {
    name: string;
    min: number;
    max: number;
    gain: number;
    unit?: string;
    beast?: string;
}

export interface XycRules {
    standard: Record<string, XycAttrRule>;
    hero: Record<string, XycAttrRule>;
    beasts: Record<string, { color: string; tag: string; specificKeys: string[] }>;
    commonKeys: string[];
}

export interface XycTomeMeta {
    tiers?: string[];
    currentTier: string;
    maxLevel: number;
    minLevel: number;
    books: Record<string, { bookName: string; color: string }>;
}

export interface XycTomeCardData {
    rules?: XycRules;
    meta?: XycTomeMeta;
    initialBeast?: string;
    initialHero?: boolean;
    initialLevel?: number;
}

export interface XycTomeDetailCardProps {
    cardData?: XycTomeCardData;
    className?: string;
}

const BEAST_ORDER = ['青龙', '白虎', '朱雀', '玄武'] as const;
type BeastName = (typeof BEAST_ORDER)[number];

function fmtNum(val: number, unit = ''): string {
    const s = Number.isInteger(val) ? val.toString() : val.toFixed(2).replace(/\.?0+$/, '');
    return `${s}${unit}`;
}

/** 属性名直接用数据表里的游戏原生叫法（固定攻击 / 致命一击率 …），不再做「%→百分比」拼接 */

export const XycTomeDetailCard: React.FC<XycTomeDetailCardProps> = ({ cardData, className }) => {
    const rules = cardData?.rules;
    const meta = cardData?.meta;

    const initialBeast = (BEAST_ORDER as readonly string[]).includes(cardData?.initialBeast || '')
        ? (cardData!.initialBeast as BeastName)
        : '青龙';

    const [beast, setBeast] = useState<BeastName>(initialBeast);
    const [isHero, setIsHero] = useState<boolean>(cardData?.initialHero ?? true);
    const [level, setLevel] = useState<number>(() => {
        const min = meta?.minLevel ?? 1;
        const max = meta?.maxLevel ?? 20;
        const lv = cardData?.initialLevel;
        return typeof lv === 'number' ? Math.min(max, Math.max(min, lv)) : min;
    });
    const [stars, setStars] = useState<number>(3);

    const maxLevel = meta?.maxLevel ?? 20;
    const minLevel = meta?.minLevel ?? 1;
    const book = meta?.books?.[beast];

    const attrRows = useMemo(() => {
        if (!rules) return [];
        const pool = (isHero ? rules.hero : rules.standard) || {};
        const build = (key: string, specific: boolean) => {
            const rule = pool[key];
            if (!rule) return null;
            const unit = rule.unit || '';
            const curMin = rule.min + rule.gain * level;
            const curMax = rule.max + rule.gain * level;
            return {
                key,
                name: rule.name,
                specific,
                rangeStr: `${fmtNum(curMin, unit)} - ${fmtNum(curMax, unit)}`,
                gainStr: `+${fmtNum(rule.gain, unit)}/级`,
            };
        };
        // 通用属性在前，四系专属属性压到最下方
        const common = (rules.commonKeys || []).map((k) => build(k, false)).filter(Boolean) as NonNullable<ReturnType<typeof build>>[];
        const specificKeys = rules.beasts?.[beast]?.specificKeys || [];
        const specific = specificKeys.map((k) => build(k, true)).filter(Boolean) as NonNullable<ReturnType<typeof build>>[];
        return [...common, ...specific];
    }, [rules, isHero, beast, level]);

    if (!rules || !meta || attrRows.length === 0) return null;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 四系切换（对齐旧天缘：青色选中、无圆点）+ 普通/英雄版本切换 */}
            <div className="relative flex items-center bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 gap-1.5 w-full min-w-0">
                <div className="flex flex-1 items-center gap-1.5 min-w-0">
                    {BEAST_ORDER.map((name) => {
                        const isActive = name === beast;
                        return (
                            <button
                                key={name}
                                type="button"
                                onClick={() => setBeast(name)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent',
                                )}
                            >
                                {name}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 1. 主体卡：游戏 tooltip 版式 */}
            <div
                data-xyc-card="1"
                data-xyc-beast={beast}
                data-xyc-hero={isHero ? '1' : '0'}
                data-xyc-level={level}
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 flex flex-col gap-2 w-max min-w-[min(320px,100%)] max-w-[min(100%,36rem)]"
                style={{
                    fontFamily: FONT_SONG,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px',
                }}
            >
                {/* 头部：书名（含等级）+ 品阶星级 + 等级步进 */}
                <div className="pb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 标题行：书名（普通/英雄切换已下移到等级步进同一行） */}
                    <div className="font-bold text-[14px] sm:text-[15px] leading-snug break-words" style={{ color: '#ffd272' }}>
                        <span data-xyc-beast-name style={{ color: '#ffd272' }}>{beast}</span>
                        <span>&lt;{book?.bookName || '策'}&gt;</span>
                        {/* 「·英雄版」继承书名颜色（不再用金色，与青龙同色） */}
                        {isHero && <span>·英雄版</span>}
                    </div>

                    {/* 普通/英雄（左）+ 等级步进（右）：两枚按钮同规格 */}
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1 shrink-0">
                            {[false, true].map((hero) => (
                                <button
                                    key={String(hero)}
                                    type="button"
                                    onClick={() => setIsHero(hero)}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                        isHero === hero
                                            ? 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white',
                                    )}
                                >
                                    {hero ? '英雄' : '普通'}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setLevel((prev) => Math.max(minLevel, prev - 1))}
                                disabled={level <= minLevel}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    level <= minLevel
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white',
                                )}
                            >
                                等级 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setLevel((prev) => Math.min(maxLevel, prev + 1))}
                                disabled={level >= maxLevel}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    level >= maxLevel
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white',
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* 品阶 + 星级：紧贴「等级 N」上方，用与属性一致的游戏蓝（星级仍为金色） */}
                <div className="text-[13px] leading-[22px] flex items-baseline gap-1.5">
                    <span style={{ color: GAME_COLORS.STAT_BLUE }}>{meta.currentTier}</span>
                    <span
                        className="tracking-[1px] whitespace-nowrap cursor-pointer"
                        style={{ color: GAME_COLORS.GOLD_AMBER }}
                        title="点击切换星级（3–5 星，展示用）"
                        onClick={() => setStars((prev) => (prev >= 5 ? 3 : prev + 1))}
                    >
                        {'★'.repeat(stars)}
                    </span>
                </div>

                {/* 等级行：白字，随等级加减实时变化（对齐游戏 tooltip 的「等级 N」单独一行） */}
                <div className="text-[13px] leading-[22px]" style={{ color: GAME_COLORS.WHITE }}>
                    等级 {level}
                </div>

                {/* 属性池：通用 8 条在前，四系专属 4 条压底。
                    移动端不换行：内容超宽时整块左右滑动（外层 overflow-x-auto + 内层 min-w-max），
                    不再用 truncate 截断（「减免致命一击伤害 5.8% - 11…」） */}
                <div className="overflow-x-auto no-scrollbar">
                <div className="w-full min-w-max py-1 space-y-1">
                    {attrRows.map((row) => (
                        <div key={row.key} className="flex items-baseline gap-2 text-[13px] leading-[22px] whitespace-nowrap">
                            <span style={{ color: row.specific ? SPECIAL_ATTR_COLOR : GAME_COLORS.STAT_BLUE }}>
                                · {row.name} {row.rangeStr}
                                {/* 每级增益紧跟在属性范围后面（不再右对齐到卡片边缘） */}
                                <span className="text-[11px] font-sans ml-1.5" style={{ color: GAME_COLORS.MINT_GREEN }}>
                                    {row.gainStr}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>
                </div>
            </div>
        </div>
    );
};

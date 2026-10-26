import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

/**
 * 佩章·九纹琅信息卡（1~40 级）
 *
 * 数据口径：`public/game_data/jiuwenlang.json`（由 `scripts/build_jiuwenlang_data.mjs` 生成）
 * - levels：1~40 级十项属性（1~20 官方表 / 21~30 官方表续页 / 31~40 论坛整理表）
 * - upgradeCosts：2~40 级三套升级配方所需材料
 *
 * 版式基准：本卡既有版式（宋体 + 经典属性蓝 + 金色标题）
 */

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

export interface JiuwenlangMaterialItem {
    key: string;
    name: string;
    count: number;
    /** 材料自身的等级（九纹琅·属性、九纹灵魄 有该字段） */
    itemLevel?: number;
}

export interface JiuwenlangRecipeMeta {
    id: 'recipe1' | 'recipe2' | 'recipe3';
    name: string;
    title?: string;
    summary?: string;
}

export interface JiuwenlangUpgradeCost {
    level: number;
    recipe1?: JiuwenlangMaterialItem[];
    recipe2?: JiuwenlangMaterialItem[];
    recipe3?: JiuwenlangMaterialItem[];
}

export interface JiuwenlangData {
    systemName?: string;
    category?: string;
    source?: string;
    maxLevel?: number;
    description?: string;
    levels?: JiuwenlangLevelData[];
    recipes?: JiuwenlangRecipeMeta[];
    upgradeCosts?: JiuwenlangUpgradeCost[];
}

export interface JiuwenlangDetailCardProps {
    cardData?: {
        data?: JiuwenlangData;
        initialLevel?: number;
    };
    className?: string;
}

/** 数据文件缺失时的兜底（与 jiuwenlang.json 同值，仅保证离线也能看） */
const DEFAULT_LEVELS: JiuwenlangLevelData[] = [
    { level: 1, hp: 12000, mp: 12000, skillAccuracy: 5, skillDodge: 5, critReduction: 1, critDamageReduction: 5, resistImmortal: 1, resistBuddha: 1, resistDemon: 1, damageReduction: 1 },
    { level: 2, hp: 12600, mp: 12600, skillAccuracy: 5.5, skillDodge: 5.5, critReduction: 1.2, critDamageReduction: 6, resistImmortal: 1.2, resistBuddha: 1.2, resistDemon: 1.2, damageReduction: 1.2 },
    { level: 3, hp: 13200, mp: 13200, skillAccuracy: 6, skillDodge: 6, critReduction: 1.4, critDamageReduction: 7, resistImmortal: 1.4, resistBuddha: 1.4, resistDemon: 1.4, damageReduction: 1.4 },
    { level: 4, hp: 13800, mp: 13800, skillAccuracy: 6.5, skillDodge: 6.5, critReduction: 1.6, critDamageReduction: 8, resistImmortal: 1.6, resistBuddha: 1.6, resistDemon: 1.6, damageReduction: 1.6 },
    { level: 5, hp: 14400, mp: 14400, skillAccuracy: 7, skillDodge: 7, critReduction: 1.8, critDamageReduction: 9, resistImmortal: 1.8, resistBuddha: 1.8, resistDemon: 1.8, damageReduction: 1.8 },
    { level: 6, hp: 15000, mp: 15000, skillAccuracy: 7.5, skillDodge: 7.5, critReduction: 2, critDamageReduction: 10, resistImmortal: 2, resistBuddha: 2, resistDemon: 2, damageReduction: 2 },
    { level: 7, hp: 15600, mp: 15600, skillAccuracy: 8, skillDodge: 8, critReduction: 2.2, critDamageReduction: 11, resistImmortal: 2.2, resistBuddha: 2.2, resistDemon: 2.2, damageReduction: 2.2 },
    { level: 8, hp: 16200, mp: 16200, skillAccuracy: 8.5, skillDodge: 8.5, critReduction: 2.4, critDamageReduction: 12, resistImmortal: 2.4, resistBuddha: 2.4, resistDemon: 2.4, damageReduction: 2.4 },
    { level: 9, hp: 16800, mp: 16800, skillAccuracy: 9, skillDodge: 9, critReduction: 2.6, critDamageReduction: 13, resistImmortal: 2.6, resistBuddha: 2.6, resistDemon: 2.6, damageReduction: 2.6 },
    { level: 10, hp: 17400, mp: 17400, skillAccuracy: 9.5, skillDodge: 9.5, critReduction: 2.8, critDamageReduction: 14, resistImmortal: 2.8, resistBuddha: 2.8, resistDemon: 2.8, damageReduction: 2.8 },
    { level: 11, hp: 18000, mp: 18000, skillAccuracy: 10, skillDodge: 10, critReduction: 3, critDamageReduction: 15, resistImmortal: 3, resistBuddha: 3, resistDemon: 3, damageReduction: 3 },
    { level: 12, hp: 18600, mp: 18600, skillAccuracy: 10.5, skillDodge: 10.5, critReduction: 3.2, critDamageReduction: 16, resistImmortal: 3.2, resistBuddha: 3.2, resistDemon: 3.2, damageReduction: 3.2 },
    { level: 13, hp: 19200, mp: 19200, skillAccuracy: 11, skillDodge: 11, critReduction: 3.4, critDamageReduction: 17, resistImmortal: 3.4, resistBuddha: 3.4, resistDemon: 3.4, damageReduction: 3.4 },
    { level: 14, hp: 19800, mp: 19800, skillAccuracy: 11.5, skillDodge: 11.5, critReduction: 3.6, critDamageReduction: 18, resistImmortal: 3.6, resistBuddha: 3.6, resistDemon: 3.6, damageReduction: 3.6 },
    { level: 15, hp: 20400, mp: 20400, skillAccuracy: 12, skillDodge: 12, critReduction: 3.8, critDamageReduction: 19, resistImmortal: 3.8, resistBuddha: 3.8, resistDemon: 3.8, damageReduction: 3.8 },
    { level: 16, hp: 21000, mp: 21000, skillAccuracy: 12.5, skillDodge: 12.5, critReduction: 4, critDamageReduction: 20, resistImmortal: 4, resistBuddha: 4, resistDemon: 4, damageReduction: 4 },
    { level: 17, hp: 21600, mp: 21600, skillAccuracy: 13, skillDodge: 13, critReduction: 4.2, critDamageReduction: 21, resistImmortal: 4.2, resistBuddha: 4.2, resistDemon: 4.2, damageReduction: 4.2 },
    { level: 18, hp: 22200, mp: 22200, skillAccuracy: 13.5, skillDodge: 13.5, critReduction: 4.4, critDamageReduction: 22, resistImmortal: 4.4, resistBuddha: 4.4, resistDemon: 4.4, damageReduction: 4.4 },
    { level: 19, hp: 22800, mp: 22800, skillAccuracy: 14, skillDodge: 14, critReduction: 4.6, critDamageReduction: 23, resistImmortal: 4.6, resistBuddha: 4.6, resistDemon: 4.6, damageReduction: 4.6 },
    { level: 20, hp: 24000, mp: 24000, skillAccuracy: 15, skillDodge: 15, critReduction: 5, critDamageReduction: 25, resistImmortal: 5, resistBuddha: 5, resistDemon: 5, damageReduction: 5 },
    { level: 21, hp: 25920, mp: 25920, skillAccuracy: 15.8, skillDodge: 15.8, critReduction: 5.2, critDamageReduction: 27, resistImmortal: 5.4, resistBuddha: 5.4, resistDemon: 5.4, damageReduction: 5.2 },
    { level: 22, hp: 27840, mp: 27840, skillAccuracy: 16.6, skillDodge: 16.6, critReduction: 5.4, critDamageReduction: 29, resistImmortal: 5.8, resistBuddha: 5.8, resistDemon: 5.8, damageReduction: 5.4 },
    { level: 23, hp: 29760, mp: 29760, skillAccuracy: 17.4, skillDodge: 17.4, critReduction: 5.6, critDamageReduction: 31, resistImmortal: 6.2, resistBuddha: 6.2, resistDemon: 6.2, damageReduction: 5.6 },
    { level: 24, hp: 31680, mp: 31680, skillAccuracy: 18.3, skillDodge: 18.3, critReduction: 5.9, critDamageReduction: 33, resistImmortal: 6.6, resistBuddha: 6.6, resistDemon: 6.6, damageReduction: 5.9 },
    { level: 25, hp: 33600, mp: 33600, skillAccuracy: 19.2, skillDodge: 19.2, critReduction: 6.2, critDamageReduction: 35, resistImmortal: 7, resistBuddha: 7, resistDemon: 7, damageReduction: 6.2 },
    { level: 26, hp: 36480, mp: 36480, skillAccuracy: 20.1, skillDodge: 20.1, critReduction: 6.5, critDamageReduction: 38, resistImmortal: 7.6, resistBuddha: 7.6, resistDemon: 7.6, damageReduction: 6.5 },
    { level: 27, hp: 39360, mp: 39360, skillAccuracy: 21, skillDodge: 21, critReduction: 6.8, critDamageReduction: 41, resistImmortal: 8.2, resistBuddha: 8.2, resistDemon: 8.2, damageReduction: 6.8 },
    { level: 28, hp: 42240, mp: 42240, skillAccuracy: 22, skillDodge: 22, critReduction: 7.2, critDamageReduction: 44, resistImmortal: 8.8, resistBuddha: 8.8, resistDemon: 8.8, damageReduction: 7.2 },
    { level: 29, hp: 45120, mp: 45120, skillAccuracy: 23, skillDodge: 23, critReduction: 7.6, critDamageReduction: 47, resistImmortal: 9.4, resistBuddha: 9.4, resistDemon: 9.4, damageReduction: 7.6 },
    { level: 30, hp: 48000, mp: 48000, skillAccuracy: 24, skillDodge: 24, critReduction: 8, critDamageReduction: 50, resistImmortal: 10, resistBuddha: 10, resistDemon: 10, damageReduction: 8 },
    { level: 31, hp: 50880, mp: 50880, skillAccuracy: 24.8, skillDodge: 24.8, critReduction: 8.2, critDamageReduction: 52, resistImmortal: 10.6, resistBuddha: 10.6, resistDemon: 10.6, damageReduction: 8.2 },
    { level: 32, hp: 53760, mp: 53760, skillAccuracy: 25.6, skillDodge: 25.6, critReduction: 8.4, critDamageReduction: 54, resistImmortal: 11.2, resistBuddha: 11.2, resistDemon: 11.2, damageReduction: 8.4 },
    { level: 33, hp: 56640, mp: 56640, skillAccuracy: 26.4, skillDodge: 26.4, critReduction: 8.6, critDamageReduction: 56, resistImmortal: 11.8, resistBuddha: 11.8, resistDemon: 11.8, damageReduction: 8.6 },
    { level: 34, hp: 59860, mp: 59860, skillAccuracy: 27.3, skillDodge: 27.3, critReduction: 8.9, critDamageReduction: 58, resistImmortal: 12.5, resistBuddha: 12.5, resistDemon: 12.5, damageReduction: 8.9 },
    { level: 35, hp: 63080, mp: 63080, skillAccuracy: 28.2, skillDodge: 28.2, critReduction: 9.2, critDamageReduction: 60, resistImmortal: 13.2, resistBuddha: 13.2, resistDemon: 13.2, damageReduction: 9.2 },
    { level: 36, hp: 66300, mp: 66300, skillAccuracy: 29.1, skillDodge: 29.1, critReduction: 9.5, critDamageReduction: 63, resistImmortal: 13.9, resistBuddha: 13.9, resistDemon: 13.9, damageReduction: 9.5 },
    { level: 37, hp: 69520, mp: 69520, skillAccuracy: 30, skillDodge: 30, critReduction: 9.8, critDamageReduction: 66, resistImmortal: 14.6, resistBuddha: 14.6, resistDemon: 14.6, damageReduction: 9.8 },
    { level: 38, hp: 73680, mp: 73680, skillAccuracy: 31, skillDodge: 31, critReduction: 10.2, critDamageReduction: 69, resistImmortal: 15.4, resistBuddha: 15.4, resistDemon: 15.4, damageReduction: 10.2 },
    { level: 39, hp: 77840, mp: 77840, skillAccuracy: 32, skillDodge: 32, critReduction: 10.6, critDamageReduction: 72, resistImmortal: 16.2, resistBuddha: 16.2, resistDemon: 16.2, damageReduction: 10.6 },
    { level: 40, hp: 82000, mp: 82000, skillAccuracy: 33, skillDodge: 33, critReduction: 11, critDamageReduction: 75, resistImmortal: 17, resistBuddha: 17, resistDemon: 17, damageReduction: 11 },
];

const DEFAULT_RECIPES: JiuwenlangRecipeMeta[] = [
    { id: 'recipe1', name: '配方1' },
    { id: 'recipe2', name: '配方2' },
    { id: 'recipe3', name: '配方3' },
];

/** 配方主色：三条路线一眼可分 */
const RECIPE_ACCENT: Record<string, string> = {
    recipe1: '#ffb86b',
    recipe2: '#7dd3fc',
    recipe3: '#86efac',
};

/** 材料配色：按道具大类区分（琅=金、残魄=紫、铸灵/衍神=蓝粉、灵魄=绿、宝玉=橙） */
const MATERIAL_COLOR: Record<string, string> = {
    jiuwen_canpo: '#c4b5fd',
    jiuwen_zhuling: '#7dd3fc',
    jiuwen_yanshen: '#f9a8d4',
    jiuwen_lingpo: '#86efac',
    jiuwenlang_attr: '#ffd272',
    yanyang_baoyu: '#fbbf24',
    cuixiu_xianyu: '#34d399',
    zixu_shenyu: '#a78bfa',
    bitao_xianyu: '#22d3ee',
};

/** 整数原样、小数最多两位且去尾零（8.20 → 8.2，10.60 → 10.6，5.0 → 5） */
function fmtNum(val: number): string {
    if (!Number.isFinite(val)) return '0';
    return Number.isInteger(val) ? String(val) : String(Number(val.toFixed(2)));
}

function materialLabel(item: JiuwenlangMaterialItem): string {
    return item.itemLevel ? `${item.name}（${item.itemLevel}级）` : item.name;
}

export const JiuwenlangDetailCard: React.FC<JiuwenlangDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const levels = data?.levels?.length ? data.levels : DEFAULT_LEVELS;
    const maxLevel = Math.min(data?.maxLevel ?? levels[levels.length - 1]?.level ?? 40, levels[levels.length - 1]?.level ?? 40);

    const recipes = data?.recipes?.length ? data.recipes : DEFAULT_RECIPES;
    const upgradeCosts = data?.upgradeCosts ?? [];
    const hasCosts = upgradeCosts.length > 0;

    const [currentLevel, setCurrentLevel] = useState<number>(() => {
        const init = cardData?.initialLevel;
        return typeof init === 'number' && init >= 1 ? Math.min(maxLevel, Math.floor(init)) : maxLevel;
    });
    const [showMaterials, setShowMaterials] = useState(true);

    const activeItem = useMemo(() => {
        return levels.find((l) => l.level === currentLevel) || levels[levels.length - 1];
    }, [levels, currentLevel]);

    /** 属性行 + 「升到下一级的增量」绿色括号（满级时没有下一级，不显示括号） */
    const attrRows = useMemo(() => {
        const next = levels.find((l) => l.level === currentLevel + 1) || null;
        const d = (cur: number, nxt: number | undefined, fmt: (v: number) => string): string | undefined =>
            next && typeof nxt === 'number' && nxt > cur ? `+${fmt(nxt - cur)}` : undefined;
        const plain = (v: number) => fmtNum(v);
        const comma = (v: number) => v.toLocaleString();
        return [
            { key: 'hp', label: '基础气血', value: `＋${activeItem.hp.toLocaleString()}`, gain: d(activeItem.hp, next?.hp, comma) },
            { key: 'mp', label: '基础真气', value: `＋${activeItem.mp.toLocaleString()}`, gain: d(activeItem.mp, next?.mp, comma) },
            { key: 'hit', label: '增加技能命中', value: fmtNum(activeItem.skillAccuracy), gain: d(activeItem.skillAccuracy, next?.skillAccuracy, plain) },
            { key: 'dodge', label: '增加技能躲闪', value: fmtNum(activeItem.skillDodge), gain: d(activeItem.skillDodge, next?.skillDodge, plain) },
            { key: 'critRed', label: '被致命一击的概率减少', value: `${fmtNum(activeItem.critReduction)}%`, gain: d(activeItem.critReduction, next?.critReduction, (v) => `${plain(v)}%`) },
            { key: 'critDmgRed', label: '减免暴伤', value: `＋${fmtNum(activeItem.critDamageReduction)}%`, gain: d(activeItem.critDamageReduction, next?.critDamageReduction, (v) => `${plain(v)}%`) },
            { key: 'immortal', label: '御仙', value: `＋${fmtNum(activeItem.resistImmortal)}%`, gain: d(activeItem.resistImmortal, next?.resistImmortal, (v) => `${plain(v)}%`) },
            { key: 'buddha', label: '御佛', value: `＋${fmtNum(activeItem.resistBuddha)}%`, gain: d(activeItem.resistBuddha, next?.resistBuddha, (v) => `${plain(v)}%`) },
            { key: 'demon', label: '御魔', value: `＋${fmtNum(activeItem.resistDemon)}%`, gain: d(activeItem.resistDemon, next?.resistDemon, (v) => `${plain(v)}%`) },
            { key: 'dmgRed', label: '减免伤害', value: `＋${fmtNum(activeItem.damageReduction)}%`, gain: d(activeItem.damageReduction, next?.damageReduction, (v) => `${plain(v)}%`) },
        ];
    }, [activeItem, levels, currentLevel]);

    /** 升到当前等级所需材料（1 级为初始等级，无材料） */
    const currentCost = useMemo(() => {
        if (!hasCosts) return null;
        return upgradeCosts.find((c) => c.level === currentLevel) || null;
    }, [upgradeCosts, currentLevel, hasCosts]);

    /**
     * 当前等级可用的配方（31 级起配方3 不再提供，只剩两行）。
     * 每条配方独占一行，材料在行内横向铺开。
     */
    const activeRecipes = useMemo(() => {
        if (!currentCost) return [] as JiuwenlangRecipeMeta[];
        return recipes.filter((r) => (currentCost[r.id]?.length ?? 0) > 0);
    }, [currentCost, recipes]);

    /** 消耗材料测算：选一段等级区间，按配方汇总该区间内所有材料（与法宝经验测算同款交互） */
    const [showCalc, setShowCalc] = useState(false);
    const [calcStart, setCalcStart] = useState(1);
    const [calcTarget, setCalcTarget] = useState(() => Math.max(2, maxLevel));

    const calcResult = useMemo(() => {
        const from = Math.min(calcStart, calcTarget - 1);
        const range = upgradeCosts.filter((c) => c.level > from && c.level <= calcTarget);
        return recipes
            .map((recipe) => {
                // 按材料 key 合并（九纹琅·属性 每级对应不同等级的材料，逐条列会拉出几十行）
                const map = new Map<string, { key: string; name: string; lvMin: number; lvMax: number; count: number }>();
                let any = false;
                for (const cost of range) {
                    for (const item of cost[recipe.id] ?? []) {
                        any = true;
                        const hit = map.get(item.key);
                        const lv = item.itemLevel ?? 0;
                        if (hit) {
                            hit.count += item.count;
                            hit.lvMin = Math.min(hit.lvMin || lv, lv);
                            hit.lvMax = Math.max(hit.lvMax, lv);
                        } else {
                            map.set(item.key, { key: item.key, name: item.name, lvMin: lv, lvMax: lv, count: item.count });
                        }
                    }
                }
                return { recipe, items: [...map.values()], any };
            })
            .filter((r) => r.any);
    }, [calcStart, calcTarget, upgradeCosts, recipes]);

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 1. 下方核心信息卡：限制宽度 max-w-xl */}
            <div
                data-jwl-card="1"
                data-jwl-level={currentLevel}
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
                                上限 {maxLevel} 级
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
                                onClick={() => setCurrentLevel((prev) => Math.min(maxLevel, prev + 1))}
                                disabled={currentLevel >= maxLevel}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    currentLevel >= maxLevel
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    </div>
                </div>

                {/* 类似装备卡的属性逐行展示：经典游戏蓝（#8080ff）+ 宋体。
                    每行尾部带「(升级 +N)」绿色括号（与天缘/轩辕策信息卡同款），N = 升到下一级的增量 */}
                <div className="py-1 space-y-1">
                    {attrRows.map((r) => (
                        <div
                            key={r.key}
                            style={{ color: GAME_COLORS.STAT_BLUE }}
                            className="flex items-baseline gap-2 whitespace-nowrap"
                        >
                            <span>
                                · {r.label} {r.value}
                                {r.gain && (
                                    <span className="text-emerald-400 text-[11px] font-sans ml-1.5 font-medium">
                                        (升级 {r.gain})
                                    </span>
                                )}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 2. 升级材料：材料作行、配方作列（横向对照，窄屏不再反复换行） */}
                {hasCosts && (
                    <div className="mt-1 pt-2 border-t border-[#1f293d]/80 font-sans">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-baseline gap-1.5 min-w-0">
                                <span className="text-[12px] font-bold" style={{ color: GAME_COLORS.GOLD_AMBER }}>
                                    升级材料
                                </span>
                                <span className="text-[11px] text-slate-400 truncate">
                                    {currentLevel > 1 ? `Lv.${currentLevel - 1} → Lv.${currentLevel}` : '初始等级'}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowMaterials((prev) => !prev)}
                                className="text-[11px] text-cyan-400 hover:underline cursor-pointer shrink-0"
                            >
                                {showMaterials ? '收起 ▲' : '展开 ▼'}
                            </button>
                        </div>

                        {showMaterials && (
                            currentCost ? (
                                <>
                                    <div className="mt-1 space-y-1" data-jwl-cost-level={currentCost.level}>
                                        {activeRecipes.map((recipe) => (
                                            <div
                                                key={recipe.id}
                                                data-jwl-recipe={recipe.id}
                                                title={recipe.summary}
                                                className="flex items-start gap-1.5"
                                            >
                                                <span
                                                    className="w-[38px] shrink-0 whitespace-nowrap text-[11px] font-bold leading-[16px]"
                                                    style={{ color: RECIPE_ACCENT[recipe.id] || '#cbd5e1' }}
                                                >
                                                    {recipe.name}
                                                </span>
                                                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                                    {(currentCost[recipe.id] ?? []).map((item, idx) => (
                                                        <span
                                                            key={`${item.key}-${item.itemLevel ?? 0}-${idx}`}
                                                            className="whitespace-nowrap text-[11px] leading-[16px]"
                                                        >
                                                            <span style={{ color: MATERIAL_COLOR[item.key] || '#cbd5e1' }}>
                                                                {materialLabel(item)}
                                                            </span>
                                                            <span className="ml-0.5 text-amber-200/90">
                                                                ×{item.count.toLocaleString()}
                                                            </span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-1 text-[10.5px] text-slate-500 leading-4">
                                        {activeRecipes.length} 套配方任选其一即可升级，材料数量随等级递增
                                    </div>
                                </>
                            ) : (
                                <div className="mt-1.5 text-[11.5px] text-slate-500 leading-4">
                                    1 级为初始等级，无需升级材料；升到 2 级起才消耗材料。
                                </div>
                            )
                        )}
                    </div>
                )}

                {/* 3. 消耗材料测算：选等级区间 → 按配方汇总区间内全部材料 */}
                {hasCosts && (
                    <div className="mt-1 pt-2 border-t border-[#1f293d]/80 font-sans">
                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                            <span className="text-[12px] font-bold" style={{ color: GAME_COLORS.GOLD_AMBER }}>
                                消耗材料测算
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowCalc((v) => !v)}
                                className="px-2 py-0.5 rounded text-[11px] text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/40 transition-colors cursor-pointer whitespace-nowrap"
                            >
                                {showCalc ? '收起测算' : '自定义测算'}
                            </button>
                        </div>

                        {showCalc && (
                            <div className="mt-1.5 p-2 rounded bg-black/40 border border-[#1e293b] space-y-1.5">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                                    <span className="text-slate-400">升级区间：</span>
                                    <select
                                        value={calcStart}
                                        onChange={(e) => {
                                            const v = Number(e.target.value);
                                            setCalcStart(v);
                                            if (v >= calcTarget) setCalcTarget(Math.min(maxLevel, v + 1));
                                        }}
                                        className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                                    >
                                        {levels
                                            .map((l) => l.level)
                                            .filter((lv) => lv < maxLevel)
                                            .map((lv) => (
                                                <option key={lv} value={lv}>
                                                    {lv} 级
                                                </option>
                                            ))}
                                    </select>
                                    <span className="text-slate-500">→</span>
                                    <select
                                        value={calcTarget}
                                        onChange={(e) => setCalcTarget(Number(e.target.value))}
                                        className="bg-[#111827] border border-slate-700 rounded px-1 py-0.5 text-slate-200 outline-none"
                                    >
                                        {levels
                                            .map((l) => l.level)
                                            .filter((lv) => lv > calcStart)
                                            .map((lv) => (
                                                <option key={lv} value={lv}>
                                                    {lv} 级
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                <div className="text-[11px] text-slate-300">
                                    从 <span className="text-cyan-300 font-bold">{Math.min(calcStart, calcTarget - 1)}级</span> 升至{' '}
                                    <span className="text-cyan-300 font-bold">{calcTarget}级</span>
                                </div>

                                {calcResult.length === 0 ? (
                                    <div className="text-[11px] text-slate-500">该区间没有可用材料数据</div>
                                ) : (
                                    calcResult.map(({ recipe, items }) => (
                                        <div key={recipe.id} className="flex items-start gap-1.5">
                                            <span
                                                className="w-[38px] shrink-0 whitespace-nowrap text-[11px] font-bold leading-[16px]"
                                                style={{ color: RECIPE_ACCENT[recipe.id] || '#cbd5e1' }}
                                            >
                                                {recipe.name}
                                            </span>
                                            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                                                {items.map((item, idx) => (
                                                    <span
                                                        key={`${item.key}-${idx}`}
                                                        className="whitespace-nowrap text-[11px] leading-[16px]"
                                                    >
                                                        <span style={{ color: MATERIAL_COLOR[item.key] || '#cbd5e1' }}>
                                                            {item.name}
                                                            {item.lvMax > 0 &&
                                                                (item.lvMin === item.lvMax
                                                                    ? `（${item.lvMax}级）`
                                                                    : `（${item.lvMin}~${item.lvMax}级）`)}
                                                        </span>
                                                        <span className="ml-0.5 text-amber-200/90">
                                                            ×{item.count.toLocaleString()}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div className="text-[10.5px] text-slate-500 leading-4">
                                    每套配方任选其一即可，数量为该区间内逐级累加值
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 底部：已按用户要求去掉「已绑定；已锁定；不会掉落；不可卖店」一行 */}
            </div>
        </div>
    );
};

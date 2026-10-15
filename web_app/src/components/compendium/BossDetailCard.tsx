import React from 'react';
import { ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import type { Dungeon, Monster } from '../../types';
import { formatNumber } from '../../utils/format';

export interface BossDetailCardProps {
    monster: Monster | any;
    dungeon?: Dungeon | { DungeonID: string; DungeonName: string; difficulty?: string };
    categoryLabel?: string;
    onBringToCalculator?: (dungeonId: string, monsterId: string) => void;
    className?: string;
}

export const BossDetailCard: React.FC<BossDetailCardProps> = ({
    monster,
    dungeon,
    categoryLabel: _categoryLabel,
    onBringToCalculator,
    className,
}) => {
    const mods = monster.MonsterAttributeModifiers || {};
    const displayAttrs = monster.displayAttributes || {};

    // 气血数据解析
    const health = displayAttrs.health ?? mods.MonsterHealth;
    const healthBars = displayAttrs.healthBars ?? 1;
    const hasHealthBars = Boolean(displayAttrs.health && displayAttrs.healthBars && displayAttrs.healthBars > 1);

    interface MatrixItem {
        label: string;
        value: string;
        highlight?: boolean;
    }

    const matrixItems: MatrixItem[] = [];

    // 属性顺序（与全景资料库完全一致）：
    // 总气血、单条气血、气血条数、减暴击、减爆伤、防御、暴击率、暴击伤害、攻击、无视减免、技能躲闪、减免伤害、伤害压缩
    const critRateRed = displayAttrs.critRateReduction ?? mods.MonsterCriticalHitRateReduction;
    const critDmgRedRaw = mods.MonsterCriticalDamagePercentReduction ?? displayAttrs.critDamageReduction;
    const defense = displayAttrs.defense ?? mods.MonsterDefense;
    const attack = displayAttrs.attack;
    const critRate = displayAttrs.critRate;
    const critDamage = displayAttrs.critDamage;
    const ignoreReduction = displayAttrs.ignoreReduction;
    const damageReduction = displayAttrs.damageReduction;
    const skillDodge = displayAttrs.skillDodge;
    const dmgComp = displayAttrs.damageCompression ?? mods.DamageCompressionPercent;

    // 1. 气血（核心指标，桔黄字体高亮）
    if (health) {
        if (hasHealthBars) {
            matrixItems.push({ label: '总气血', value: formatNumber(health * healthBars), highlight: true });
            matrixItems.push({ label: '单条气血', value: formatNumber(health), highlight: true });
            matrixItems.push({ label: '气血条数', value: `${healthBars} 条` });
        } else {
            matrixItems.push({ label: '总气血', value: formatNumber(health), highlight: true });
        }
    }

    // 2. 按指定顺序依次追加（有值才显示，减爆伤桔黄字体高亮）
    if (critRateRed !== undefined && critRateRed !== null) {
        matrixItems.push({ label: '减暴击', value: `${critRateRed}%` });
    }
    if (critDmgRedRaw !== undefined && critDmgRedRaw !== null) {
        matrixItems.push({ label: '减爆伤', value: `${critDmgRedRaw}%`, highlight: true });
    }
    if (defense !== undefined && defense !== null) {
        matrixItems.push({ label: '防御', value: formatNumber(defense) });
    }
    if (critRate !== undefined && critRate !== null) {
        matrixItems.push({ label: '暴击率', value: `${critRate}%` });
    }
    if (critDamage !== undefined && critDamage !== null) {
        matrixItems.push({ label: '暴击伤害', value: `${critDamage}%` });
    }
    if (attack !== undefined && attack !== null) {
        matrixItems.push({ label: '攻击', value: formatNumber(attack) });
    }
    if (ignoreReduction !== undefined && ignoreReduction !== null) {
        matrixItems.push({ label: '无视减免', value: `${ignoreReduction}%` });
    }
    if (skillDodge !== undefined && skillDodge !== null) {
        matrixItems.push({ label: '技能躲闪', value: `${skillDodge}` });
    }
    if (damageReduction !== undefined && damageReduction !== null) {
        matrixItems.push({ label: '减免伤害', value: `${damageReduction}` });
    }
    if (dmgComp !== undefined && dmgComp !== null) {
        matrixItems.push({ label: '伤害压缩', value: `${dmgComp}%` });
    }

    const isBoss = (monster as any).role !== 'add';
    const dungeonName = dungeon?.DungeonName || '';
    const dungeonId = dungeon?.DungeonID || '';
    const bossLevel = displayAttrs.level || (monster as any).MonsterLevel;

    return (
        <div className={clsx(
            "rounded-xl p-3.5 sm:p-4 transition-all duration-200 border border-cyan-500/20 bg-[#121824] flex flex-col justify-start gap-3 shadow-md w-full max-w-xl",
            className
        )}>
            {/* 1. 头部：分行式布局，第一行名称与操作，第二行副本与关卡等级 */}
            <div className="flex flex-col border-b border-white/5 pb-3 gap-2">
                {/* 第 1 行：BOSS 名称 + 角色标签 与 右侧 带入计算器 按钮 */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-4 bg-cyan-400 rounded-full shrink-0"></span>
                        <h4 className="text-[15px] font-black text-slate-100 tracking-wide truncate">
                            {monster.MonsterName}
                        </h4>
                        <span
                            className={clsx(
                                'px-1.5 py-0.2 rounded text-[11px] font-bold border shrink-0',
                                isBoss
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                    : 'bg-slate-700/40 border-slate-600/40 text-slate-400'
                            )}
                        >
                            {isBoss ? 'BOSS' : '小怪'}
                        </span>
                    </div>

                    {onBringToCalculator && dungeonId && (
                        <button
                            type="button"
                            onClick={() => onBringToCalculator(dungeonId, monster.MonsterID)}
                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-all shadow-sm"
                            title="将此 BOSS 带入战力计算器测算技能伤害"
                        >
                            <span>带入计算器</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* 第 2 行：所属副本微标 + 关卡 + 等级（统一采用装备卡同款微标胶囊风格） */}
                {(dungeonName || monster.DungeonLevel || bossLevel) && (
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0 pl-3.5 text-[11px] font-sans">
                        {dungeonName && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300/90 border border-cyan-500/30 whitespace-nowrap">
                                {dungeonName}
                            </span>
                        )}
                        {monster.DungeonLevel ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                第 {monster.DungeonLevel} 关
                            </span>
                        ) : null}
                        {bossLevel ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 whitespace-nowrap font-mono">
                                Lv.{bossLevel}
                            </span>
                        ) : null}
                    </div>
                )}
            </div>

            {/* 2. 属性矩阵网格 (3 列整齐单元格，统一边框底色，核心指标桔黄字体高亮) */}
            {matrixItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                    {matrixItems.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border bg-black/40 border-white/5 transition-colors"
                        >
                            <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0 mr-1.5">
                                {item.label}
                            </span>
                            <span
                                className={clsx(
                                    'font-mono font-bold text-xs shrink-0 whitespace-nowrap',
                                    item.highlight ? 'text-amber-300' : 'text-slate-200'
                                )}
                            >
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-3 py-2 rounded-lg bg-black/40 border border-white/5 text-center text-xs text-slate-500 font-mono">
                    BOSS其他实战抗性数据录入中
                </div>
            )}
        </div>
    );
};

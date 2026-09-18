import React, { useState, useMemo, useEffect } from 'react';
import { Search, Clock, Zap, RotateCcw, Infinity as InfinityIcon } from 'lucide-react';
import clsx from 'clsx';
import { chipCls, chipCountCls } from '../ui/chipStyles';
import { BonusValue } from '../ui/BonusValue';
import {
    ATTR_GRID,
    ATTR_CELL,
    ATTR_CELL_INLINE,
    ATTR_CELL_STACK,
    ATTR_CELL_BADGE,
    ATTR_LABEL,
    ATTR_LABEL_STACK,
    ATTR_VALUE,
    ATTR_VALUE_STACK,
    NOTE_BLOCK,
    NOTE_ROW,
    NOTE_LABEL,
    NOTE_TEXT,
    NOTE_LINK,
    NOTE_PARAGRAPH
} from './skillCardStyles';
import { pinyin } from 'pinyin-pro';
import { DataService } from '../../services/DataService';
import { formatBonusValue, isPerHitArray, hasBonusValue, bonusScalar } from '../../utils/skillBonusFormat';
import type { SearchTarget } from '../GlobalSearch';

interface SkillBonusAttributes {
    SkillAttackPercentBonus?: number | number[];
    SkillAttackFixedBonus?: number | number[];
    SkillHealthPercentBonus?: number | number[];
    SkillManaPercentBonus?: number | number[];
    SkillDefensePercentBonus?: number | number[];
    SkillCriticalDamagePercentBonus?: number | number[];
    SkillDamageBonus?: number | number[];
    MultiHitConfig?: {
        HitCount?: number;
        ScalingAttribute?: string;
        ScalingStartValue?: number;
        ScalingEndValue?: number;
        DamageMultiplierPerHit?: number;
        DamageCap?: number;
        PerHitCharacterBonus?: {
            CharacterMaxAttackPercent?: number;
            CharacterHealthPercent?: number;
            CharacterManaPercent?: number;
        };
    };
}

interface AppliedEffectItem {
    EffectId?: string;
    EffectName?: string;
    Target?: string;
    Duration?: number;
    ExclusiveGroup?: string;
    ExclusivePolicy?: string;
    EffectPower?: number;
    BuffEffects?: Record<string, any>;
    DynamicScalingAttribute?: string;
    DynamicScalingMultiplier?: number;
    DynamicTargetField?: string;
}

interface MultiPhaseItem {
    PhaseIndex: number;
    Duration: number;
    AutoTransition?: boolean;
    AppliesEffects: AppliedEffectItem[];
}

interface SkillItem {
    SkillID: string;
    SkillName: string;
    RequiredClass: string;
    Faction: string;
    SkillImportanceWeight?: number;
    SkillFrequency?: number;
    Cooldown: number;
    CastTime: number;
    IsAOE?: boolean;
    ActionType?: string;
    MaxCharges?: number;
    ChargeReplenishTime?: number;
    Description?: string;
    SkillBonusAttributes?: SkillBonusAttributes;
    CooldownResets?: Array<{ TargetSkillId: string; TargetSkillName?: string; ResetType?: string }>;
    AppliesEffects?: AppliedEffectItem[];
    MultiPhaseConfig?: {
        ManualActivationAllowed?: boolean;
        Phases: MultiPhaseItem[];
    };
    BuffDurationExtensionSeconds?: number;
    FourthGenSlot?: 'XUAN_ZHU' | 'CHI_WU';
    FourthGenPresets?: Record<string, any>;
    FourthGenGrants?: Record<string, Array<{ TargetSkillIds: string[]; Override: any }>>;
    ZaoHuaGrants?: Array<{ TargetSkillIds: string[]; Override: any }>;
    FourthGenInitialEffects?: Record<string, any>;
    Variant?: string;
}

const CLASS_ORDER = [
    { id: 'ZHU_SHUANG', name: '逐霜' },
    { id: 'NIE_YU', name: '涅羽' },
    { id: 'TAI_HAO', name: '太昊' },
    { id: 'GUI_WANG', name: '鬼王' },
    { id: 'TIAN_YIN', name: '天音' },
    { id: 'FEN_XIANG', name: '焚香' },
    { id: 'ZHAO_MING', name: '昭冥' },
    { id: 'YING_ZHAO', name: '英招' },
    { id: 'TIAN_HUA', name: '天华' },
    { id: 'SHI_LUO', name: '释罗' },
    { id: 'GUI_YUN', name: '归云' },
];

const FACTIONS = [
    { id: 'ALL', name: '全部阵营' },
    { id: 'XIAN', name: '仙' },
    { id: 'FO', name: '佛' },
    { id: 'MO', name: '魔' },
];

interface AttributeItem {
    label: string;
    value: string;
    isPrimary?: boolean;
    wrap?: boolean;   // 长文本行（四代三品质说明）：跨整行、纵向排列并允许换行，避免溢出卡片
    fullRow?: boolean; // 每段数组：跨整行显示，避免逐段序列被挤断（标量仍走三列紧凑布局）
}

interface UnifiedSkillData {
    badgeText: string;
    badgeTheme: 'damage' | 'buff' | 'debuff' | 'utility';
    attributes: AttributeItem[];
    mechanicNote: string | null;
}

/**
 * 统合处理技能的属性、加成与机制：
 * 彻底消除花哨杂乱的层层套盒，无论是输出技能还是增益/减益技能，均归一化为高对比度、清晰宁静的属性条
 */
const FG_QUALITIES: Array<{ key: string; label: string }> = [
    { key: 'YING_JU', label: '莹炬' },
    { key: 'HAO_YUE', label: '皓月' },
    { key: 'XI_RI', label: '曦日' }
];

/** 把四代 Override 翻译为简洁中文增量描述 */
function describeFourthGenOverride(override: any): string[] {
    if (!override || typeof override !== 'object') return [];
    const out: string[] = [];
    const sb = override.SkillBonusAttributes;
    if (sb) {
        // 支持标量与「每段数组」：数组走统一格式化，避免整条增量文案消失
        const pushBonus = (label: string, value: unknown, unit = '%') => {
            const text = formatBonusValue(value as number | number[] | undefined, unit);
            if (text) out.push(label + text);
        };
        pushBonus('附加攻击比', sb.SkillAttackPercentBonus);
        pushBonus('附加固定攻击', sb.SkillAttackFixedBonus, '');
        pushBonus('附加气血比', sb.SkillHealthPercentBonus);
        pushBonus('附加真气比', sb.SkillManaPercentBonus);
        pushBonus('附加爆伤', sb.SkillCriticalDamagePercentBonus);
        pushBonus('附加防御比', sb.SkillDefensePercentBonus);
    }
    if (typeof override.CooldownReduction === 'number') out.push('冷却减' + override.CooldownReduction + 's');
    if (typeof override.Cooldown === 'number') out.push('冷却' + override.Cooldown + 's');
    if (typeof override.ChargeReplenishTime === 'number') out.push('充能恢复' + override.ChargeReplenishTime + 's');
    if (typeof override.CastTime === 'number') out.push('施法' + override.CastTime + 's');
    const ae = override.AppliesEffects;
    if (ae && typeof ae === 'object') {
        for (const eff of Object.values(ae) as any[]) {
            if (!eff) continue;
            const be = eff.BuffEffects;
            if (be) {
                if (typeof be.BuffSpeedPercentEffect === 'number') out.push('施法速度+' + be.BuffSpeedPercentEffect + '%');
                if (typeof be.BuffManaPercentEffect === 'number') out.push('真气上限+' + be.BuffManaPercentEffect + '%');
                if (typeof be.BuffAttackPercentEffect === 'number') out.push('攻击+' + be.BuffAttackPercentEffect + '%');
                if (typeof be.BuffMonsterCriticalDamagePercentEffect === 'number') out.push('绿点+' + be.BuffMonsterCriticalDamagePercentEffect + '%');
            }
            if (typeof eff.Duration === 'number') out.push('持续' + eff.Duration + 's');
        }
    }
    return out;
}

/** 四代被动：按目标技能名聚合三品质增量；同名技能合并、同品质多 grant 累加去重，三品质同值合并、异值分列 */
function buildFourthGenAttributes(skill: SkillItem, idToNameMap: Record<string, string>): AttributeItem[] {
    const grants = skill.FourthGenGrants;
    if (!grants) return [];
    const nameOrder: string[] = [];
    const byName: Record<string, Record<string, string[]>> = {};
    const addDesc = (name: string, qKey: string, desc: string[]) => {
        if (!byName[name]) { byName[name] = {}; nameOrder.push(name); }
        if (!byName[name][qKey]) byName[name][qKey] = [];
        for (const d of desc) {
            if (byName[name][qKey].indexOf(d) === -1) byName[name][qKey].push(d);
        }
    };
    for (const q of FG_QUALITIES) {
        const list = grants[q.key] || [];
        for (const g of list) {
            const desc = describeFourthGenOverride(g.Override);
            for (const tid of g.TargetSkillIds) {
                addDesc(idToNameMap[tid] || tid, q.key, desc);
            }
        }
    }
    const rows: AttributeItem[] = [];
    for (const name of nameOrder) {
        const perQ = byName[name];
        const y = (perQ.YING_JU || []).join('、');
        const h = (perQ.HAO_YUE || []).join('、');
        const x = (perQ.XI_RI || []).join('、');
        let value: string;
        if (y === h && h === x) value = x || '—';
        else value = '莹炬:' + (y || '—') + '｜皓月:' + (h || '—') + '｜曦日:' + (x || '—');
        rows.push({ label: name, value, isPrimary: true, wrap: true });
    }
    return rows;
}

/** 是否为「常驻 grant 被动」条目：造化被动（造化技能 II）与心法被动共用 ZaoHuaGrants 机制 */
function isGrantPassiveEntry(skill: SkillItem): boolean {
    return skill.ActionType === 'ZAO_HUA_PASSIVE' || skill.ActionType === 'XIN_FA_PASSIVE';
}

/** 常驻 grant 被动：按目标技能名聚合 ZaoHuaGrants 增量（同名技能多条 grant 合并去重） */
function buildZaoHuaAttributes(skill: SkillItem, idToNameMap: Record<string, string>): AttributeItem[] {
    const grants = skill.ZaoHuaGrants;
    if (!grants || grants.length === 0) return [];
    const nameOrder: string[] = [];
    const byName: Record<string, string[]> = {};
    for (const g of grants) {
        const desc = describeFourthGenOverride(g.Override);
        for (const tid of g.TargetSkillIds) {
            const name = idToNameMap[tid] || tid;
            if (!byName[name]) { byName[name] = []; nameOrder.push(name); }
            for (const d of desc) {
                if (byName[name].indexOf(d) === -1) byName[name].push(d);
            }
        }
    }
    return nameOrder.map(name => ({
        label: name,
        value: byName[name].join('、') || '—',
        isPrimary: true,
        wrap: true
    }));
}

function getUnifiedSkillData(skill: SkillItem, idToNameMap: Record<string, string>): UnifiedSkillData {
    const bonus = skill.SkillBonusAttributes || {};

    // 0a. 常驻被动（造化技能被动 ZAO_HUA_PASSIVE / 心法被动 XIN_FA_PASSIVE）：
    //     不占四代玄烛/赤乌槽位、无需佩戴，学习后常驻生效；逐条列出对各目标技能的增量。
    if (isGrantPassiveEntry(skill)) {
        const isXinFa = skill.ActionType === 'XIN_FA_PASSIVE';
        const passiveAttrs: AttributeItem[] = [
            { label: '生效方式', value: '常驻·无需佩戴', isPrimary: true },
            ...buildZaoHuaAttributes(skill, idToNameMap)
        ];
        let passiveNote: string | null = null;
        if (skill.Description && skill.Description.trim() !== '暂无详细机制说明') {
            passiveNote = skill.Description.trim();
        } else if (passiveAttrs.length > 1) {
            passiveNote = (isXinFa ? '心法被动' : '门派造化被动')
                + '，学习后常驻生效：不占四代玄烛/赤乌槽位、无需佩戴，自动强化上述技能的属性与冷却。';
        }
        return { badgeText: isXinFa ? '心法被动' : '造化被动', badgeTheme: 'utility', attributes: passiveAttrs, mechanicNote: passiveNote };
    }

    // 0. 四代被动（玄烛/赤乌）：槽位 + 按品质列出对其他技能的影响，说明走 Description
    if (skill.ActionType === 'FOURTH_GEN_PASSIVE') {
        const slotLabel = skill.FourthGenSlot === 'CHI_WU' ? '赤乌' : '玄烛';
        const fgAttrs: AttributeItem[] = [
            { label: '槽位', value: slotLabel, isPrimary: true },
            ...buildFourthGenAttributes(skill, idToNameMap)
        ];
        let fgNote: string | null = null;
        if (skill.Description && skill.Description.trim() !== '暂无详细机制说明') fgNote = skill.Description.trim();
        return { badgeText: slotLabel + '·四代被动', badgeTheme: 'utility', attributes: fgAttrs, mechanicNote: fgNote };
    }

    const multiHit = bonus.MultiHitConfig;
    const isUtility = skill.ActionType === 'UTILITY';
    const isBuffType = skill.ActionType === 'BUFF' || skill.ActionType === 'DEBUFF';
    const hasEffects = Array.isArray(skill.AppliesEffects) && skill.AppliesEffects.length > 0;
    const hasPhases = Boolean(skill.MultiPhaseConfig && skill.MultiPhaseConfig.Phases?.length);

    // 1. 战术辅助技能（如鹰扬折冲）
    if (isUtility && skill.CooldownResets && skill.CooldownResets.length > 0) {
        const targetNames = skill.CooldownResets.map(r => idToNameMap[r.TargetSkillId] || r.TargetSkillName || r.TargetSkillId).join('、');
        return {
            badgeText: '战术联动',
            badgeTheme: 'utility',
            attributes: [
                { label: '刷新目标', value: targetNames, isPrimary: true },
                { label: '重置效果', value: '充能恢复至满层' },
                ...(skill.SkillFrequency !== undefined ? [{ label: '频率', value: String(skill.SkillFrequency) }] : [])
            ],
            mechanicNote: '战术辅助状态，释放后重置目标技能充能计数，启动新一轮爆发循环。'
        };
    }

    // 2. 状态增益 / 减益技能（自身爆发、团队增益、敌怪易伤等）
    if (isBuffType || (hasEffects && skill.ActionType !== 'DAMAGE')) {
        let target = '自身';
        let maxDur = 0;
        const stats: AttributeItem[] = [];

        // 多阶段技能（如昭冥 日月弘光）
        if (hasPhases && skill.MultiPhaseConfig) {
            const phaseDescs: string[] = [];
            for (const p of skill.MultiPhaseConfig.Phases) {
                const pParts: string[] = [];
                if (p.AppliesEffects) {
                    for (const eff of p.AppliesEffects) {
                        if (eff.BuffEffects) {
                            for (const [k, v] of Object.entries(eff.BuffEffects)) {
                                if (k === 'BuffFocusPercentEffect' && v) pParts.push(`专注 +${v}%`);
                                if (k === 'BuffHolyWrathPercentEffect' && v) pParts.push(`神圣伤害 +${v}%`);
                            }
                        }
                    }
                }
                phaseDescs.push(`第${p.PhaseIndex}阶段(${p.Duration}s): ${pParts.join('、')}`);
            }
            return {
                badgeText: '团队增益',
                badgeTheme: 'buff',
                attributes: [
                    { label: '持续时间', value: '两阶段', isPrimary: true },
                    ...phaseDescs.map((desc, idx) => ({ label: `阶段${idx + 1}`, value: desc, isPrimary: idx === 1 }))
                ],
                mechanicNote: '多阶段自动流转增益技能，二段增益大幅强化神圣伤害与团队专注。'
            };
        }

        if (skill.AppliesEffects) {
            for (const eff of skill.AppliesEffects) {
                if (eff.Target === 'TEAM') target = '全队';
                else if (eff.Target === 'ALLY') target = '单体队友';
                else if (eff.Target === 'ENEMY') target = '目标敌怪';

                if (eff.Duration && eff.Duration > maxDur) maxDur = eff.Duration;

                if (eff.BuffEffects) {
                    for (const [k, v] of Object.entries(eff.BuffEffects)) {
                        if (v === 0 && (k === 'BuffDefenseFixedEffect' || k === 'BuffMonsterCriticalDamagePercentEffect')) {
                            if (k === 'BuffMonsterCriticalDamagePercentEffect') stats.push({ label: '绿点', value: '翻倍', isPrimary: true });
                            if (k === 'BuffDefenseFixedEffect' && eff.DynamicScalingAttribute) stats.push({ label: '破防', value: '攻击力等值缩放', isPrimary: true });
                            continue;
                        }
                        if (v === 0) continue;

                        if (k === 'BuffCriticalHitRatePercentEffect') stats.push({ label: '暴击率', value: `+${v}%`, isPrimary: true });
                        else if (k === 'BuffCriticalDamagePercentEffect') stats.push({ label: '附加暴击伤害', value: `+${v}%`, isPrimary: true });
                        else if (k === 'BuffFocusPercentEffect') stats.push({ label: '专注', value: `+${v}%` });
                        else if (k === 'BuffSpeedPercentEffect') stats.push({ label: '施法速度', value: `+${v}%` });
                        else if (k === 'BuffAttackPercentEffect') stats.push({ label: '附加攻击百分比', value: `+${v}%`, isPrimary: true });
                        else if (k === 'BuffAttackFixedEffect') stats.push({ label: '附加固定攻击', value: `+${v.toLocaleString()}` });
                        else if (k === 'BuffHealthPercentEffect') stats.push({ label: '附加气血百分比', value: `+${v}%` });
                        else if (k === 'BuffHealthFixedEffect') stats.push({ label: '附加固定气血', value: `+${v.toLocaleString()}` });
                        else if (k === 'BuffManaPercentEffect') stats.push({ label: '附加真气百分比', value: `+${v}%` });
                        else if (k === 'BuffDefensePercentEffect') stats.push({ label: '附加防御百分比', value: `+${v}%` });
                        else if (k === 'BuffDefenseFixedEffect') stats.push({ label: '破防', value: v < 0 ? String(v.toLocaleString()) : `+${v.toLocaleString()}`, isPrimary: true });
                        else if (k === 'BuffMonsterHarmedPercentEffect') stats.push({ label: '易伤', value: `+${v}%`, isPrimary: true });
                        else if (k === 'BuffMonsterCriticalDamagePercentEffect') stats.push({ label: '绿点', value: `+${v}%`, isPrimary: true });
                        else if (k === 'BuffMonsterCritRateIncreaseEffect') stats.push({ label: '被暴率', value: `+${v}%` });
                    }
                }
            }
        }

        // 描述文本加成提取补充
        if (skill.Description) {
            const critRateMatch = skill.Description.match(/(\d+)%\s*暴击率/);
            if (critRateMatch && !stats.some(x => x.label === '暴击率')) stats.push({ label: '暴击率', value: `+${critRateMatch[1]}%`, isPrimary: true });
            const critDmgMatch = skill.Description.match(/(\d+)%\s*(?:暴击伤害|暴伤)/);
            if (critDmgMatch && !stats.some(x => x.label === '附加暴击伤害')) stats.push({ label: '附加暴击伤害', value: `+${critDmgMatch[1]}%`, isPrimary: true });
            const focusMatch = skill.Description.match(/(\d+)%\s*专注/);
            if (focusMatch && !stats.some(x => x.label === '专注')) stats.push({ label: '专注', value: `+${focusMatch[1]}%` });
            const speedMatch = skill.Description.match(/(\d+)%\s*施法速度/);
            if (speedMatch && !stats.some(x => x.label === '施法速度')) stats.push({ label: '施法速度', value: `+${speedMatch[1]}%` });
            const atkMatch = skill.Description.match(/(\d+)%\s*攻击(?:力)?/);
            if (atkMatch && !stats.some(x => x.label === '附加攻击百分比')) stats.push({ label: '附加攻击百分比', value: `+${atkMatch[1]}%`, isPrimary: true });
            const hpMatch = skill.Description.match(/(\d+)%\s*气血/);
            if (hpMatch && !stats.some(x => x.label === '附加气血百分比')) stats.push({ label: '附加气血百分比', value: `+${hpMatch[1]}%` });
        }

        if (skill.SkillFrequency !== undefined) {
            stats.push({ label: '频率', value: String(skill.SkillFrequency) });
        }

        // 持续时间作为一个单独的框出现！
        if (maxDur === 0 && skill.Description) {
            const durMatch = skill.Description.match(/持续时间\s*(\d+)\s*(?:秒|s)/);
            if (durMatch) maxDur = parseInt(durMatch[1], 10);
        }
        if (maxDur > 0) {
            const durText = maxDur >= 3600 || (maxDur >= 600 && skill.Cooldown === 0) ? '常驻' : `${maxDur} 秒`;
            stats.unshift({ label: '持续时间', value: durText, isPrimary: true });
        }

        // 机制类型简练命名，绝不换行
        let targetLabel = '自身增益';
        if (skill.ActionType === 'DEBUFF' || target === '目标敌怪') targetLabel = '目标敌怪';
        else if (target === '全队') targetLabel = '团队增益';
        else if (target === '单体队友') targetLabel = '单体队友';
        else targetLabel = '自身增益';

        // 保留完整的机制/技能说明文本
        let mechanicText: string | null = null;
        if (skill.Description && skill.Description.trim() !== '暂无详细机制说明') {
            mechanicText = skill.Description.trim();
        }

        return {
            badgeText: targetLabel,
            badgeTheme: skill.ActionType === 'DEBUFF' ? 'debuff' : 'buff',
            attributes: stats,
            mechanicNote: mechanicText
        };
    }

    // 3. 输出伤害技能（纯伤害/单体/群体）
    const stats: AttributeItem[] = [];
    let hitCount = multiHit?.HitCount;
    if (!hitCount && skill.SkillName.includes('未名斩')) {
        hitCount = 6;
    }

    if (hitCount) {
        stats.push({ label: '段数', value: `${hitCount}段`, isPrimary: true });
    } else if (skill.ActionType === 'DAMAGE') {
        stats.push({ label: '段数', value: '单段' });
    }

    const atkPercentText = formatBonusValue(bonus.SkillAttackPercentBonus, '%');
    if (atkPercentText) {
        stats.push({ label: '附加攻击百分比', value: atkPercentText, isPrimary: true, fullRow: isPerHitArray(bonus.SkillAttackPercentBonus) });
    }
    const atkFixedText = formatBonusValue(bonus.SkillAttackFixedBonus, '');
    if (atkFixedText) {
        stats.push({ label: '附加固定攻击', value: atkFixedText, fullRow: isPerHitArray(bonus.SkillAttackFixedBonus) });
    }
    if (hasBonusValue(bonus.SkillHealthPercentBonus)) {
        const isScaling = multiHit?.ScalingAttribute === 'SkillHealthPercentBonus';
        stats.push({
            label: '附加气血百分比',
            value: isScaling
                ? `${multiHit.ScalingStartValue}%→${multiHit.ScalingEndValue}%`
                : (formatBonusValue(bonus.SkillHealthPercentBonus, '%') as string),
            fullRow: isPerHitArray(bonus.SkillHealthPercentBonus)
        });
    }
    if (hasBonusValue(bonus.SkillManaPercentBonus)) {
        const isScaling = multiHit?.ScalingAttribute === 'SkillManaPercentBonus';
        stats.push({
            label: '附加真气百分比',
            value: isScaling
                ? `${multiHit.ScalingStartValue}%→${multiHit.ScalingEndValue}%`
                : (formatBonusValue(bonus.SkillManaPercentBonus, '%') as string),
            fullRow: isPerHitArray(bonus.SkillManaPercentBonus)
        });
    }
    const defPercentText = formatBonusValue(bonus.SkillDefensePercentBonus, '%');
    if (defPercentText) {
        stats.push({ label: '附加防御百分比', value: defPercentText, fullRow: isPerHitArray(bonus.SkillDefensePercentBonus) });
    }
    const critPercentText = formatBonusValue(bonus.SkillCriticalDamagePercentBonus, '%');
    if (critPercentText) {
        stats.push({ label: '附加暴击伤害', value: critPercentText, isPrimary: true, fullRow: isPerHitArray(bonus.SkillCriticalDamagePercentBonus) });
    }
    const dmgBonusScalar = bonusScalar(bonus.SkillDamageBonus);
    if (dmgBonusScalar !== undefined && dmgBonusScalar > 1) {
        const v = dmgBonusScalar > 10 ? dmgBonusScalar : dmgBonusScalar * 100;
        stats.push({ label: '增伤', value: `+${v}%` });
    }
    if (multiHit?.DamageMultiplierPerHit) {
        stats.push({ label: '递增', value: `${multiHit.DamageMultiplierPerHit}x/击` });
    }
    if (skill.SkillFrequency !== undefined) {
        stats.push({ label: '频率', value: String(skill.SkillFrequency) });
    }

    // 保留输出技能的机制说明
    let mechanicText: string | null = null;
    if (skill.Description && skill.Description.trim() !== '暂无详细机制说明') {
        mechanicText = skill.Description.trim();
    }

    return {
        badgeText: skill.IsAOE ? '群体伤害' : '单体伤害',
        badgeTheme: 'damage',
        attributes: stats,
        mechanicNote: mechanicText
    };
}

/** 将文本中的关键词高亮，使用克制轻柔的色系，告别刺眼杂乱 */
function renderQuietDescription(desc: string) {
    if (!desc) return null;

    const regex = /(\+?\d+(?:\.\d+)?%?(?:攻击力|暴击伤害|暴伤|暴击率|专注|神圣伤害|施法速度)?|\d+秒|\d+s|龙怒|充能恢复|充能|鹰扬折冲|刷新|满层|四代被动|真气上限|法宝\+1)/g;
    const parts = desc.split(regex);

    return (
        <span>
            {parts.map((part, idx) => {
                if (!part) return null;
                if (regex.test(part)) {
                    if (part.includes('秒') || part.includes('s')) {
                        return (
                            <span key={idx} className="text-amber-300/90 font-mono px-0.5">
                                {part}
                            </span>
                        );
                    }
                    return (
                        <span key={idx} className="text-cyan-300 font-medium px-0.5">
                            {part}
                        </span>
                    );
                }
                return <span key={idx}>{part}</span>;
            })}
        </span>
    );
}

interface SkillsViewProps {
    searchNav?: SearchTarget | null;
    onSearchConsumed?: () => void;
    onNavigateHome?: () => void;
    /** 用户切换门派/阵营时回调（回写 URL 的 ?class=/?faction=）；只在用户点击时触发，不由 searchNav 回灌 */
    onFilterChange?: (classId: string, faction: string) => void;
}

export const SkillsView: React.FC<SkillsViewProps> = ({ searchNav, onSearchConsumed, onFilterChange }) => {
    const [selectedClass, setSelectedClass] = useState<string>('ZHU_SHUANG');
    const [selectedFaction, setSelectedFaction] = useState<string>('ALL');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [highlightedSkillId, setHighlightedSkillId] = useState<string | null>(null);

    const allSkillsData = useMemo(() => {
        return DataService.getInstance().getAllSkills();
    }, []);

    // 构建全局 SkillID -> 中文技能名映射表及元数据
    const { skillIdToNameMap, skillMetaMap } = useMemo(() => {
        const idToName: Record<string, string> = {};
        const meta: Record<string, { name: string; classId: string; faction: string }> = {};
        if (!allSkillsData) return { skillIdToNameMap: idToName, skillMetaMap: meta };

        for (const classKey of Object.keys(allSkillsData)) {
            const classObj = allSkillsData[classKey];
            if (!classObj || typeof classObj !== 'object') continue;
            for (const factionKey of Object.keys(classObj)) {
                const list = classObj[factionKey];
                if (Array.isArray(list)) {
                    for (const sk of list) {
                        if (sk.SkillID && sk.SkillName) {
                            idToName[sk.SkillID] = sk.SkillName;
                            meta[sk.SkillID] = {
                                name: sk.SkillName,
                                classId: sk.RequiredClass || classKey,
                                faction: sk.Faction || factionKey,
                            };
                        }
                    }
                }
            }
        }
        return { skillIdToNameMap: idToName, skillMetaMap: meta };
    }, [allSkillsData]);

    // 四代 Grants 反向索引：普通技能ID -> 来源四代（取曦日最高品质），用于普通技能卡反向说明
    const fourthGenReverseMap = useMemo(() => {
        const map: Record<string, Array<{ sourceId: string; sourceName: string; slot: string; text: string }>> = {};
        if (!allSkillsData) return map;
        for (const classKey of Object.keys(allSkillsData)) {
            const classObj = allSkillsData[classKey];
            if (!classObj) continue;
            for (const factionKey of Object.keys(classObj)) {
                const list = classObj[factionKey];
                if (!Array.isArray(list)) continue;
                for (const sk of list as unknown as SkillItem[]) {
                    if (isGrantPassiveEntry(sk) && sk.ZaoHuaGrants) {
                        for (const g of sk.ZaoHuaGrants) {
                            const text = describeFourthGenOverride(g.Override).join('、');
                            for (const tid of g.TargetSkillIds) {
                                if (!map[tid]) map[tid] = [];
                                map[tid].push({ sourceId: sk.SkillID, sourceName: sk.SkillName, slot: 'ZAO_HUA', text });
                            }
                        }
                        continue;
                    }
                    if (sk.ActionType !== 'FOURTH_GEN_PASSIVE' || !sk.FourthGenGrants) continue;
                    const grantsXi = sk.FourthGenGrants['XI_RI'] || [];
                    for (const g of grantsXi) {
                        const text = describeFourthGenOverride(g.Override).join('、');
                        for (const tid of g.TargetSkillIds) {
                            if (!map[tid]) map[tid] = [];
                            map[tid].push({ sourceId: sk.SkillID, sourceName: sk.SkillName, slot: sk.FourthGenSlot || 'XUAN_ZHU', text });
                        }
                    }
                }
            }
        }
        return map;
    }, [allSkillsData]);

    // 统计各门派技能数量
    const classSkillCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        if (!allSkillsData) return counts;
        for (const cls of CLASS_ORDER) {
            const classObj = allSkillsData[cls.id] || {};
            let count = 0;
            for (const f of ['XIAN', 'FO', 'MO', 'COMMON']) {
                const list = classObj[f];
                if (Array.isArray(list)) count += list.length;
            }
            counts[cls.id] = count;
        }
        return counts;
    }, [allSkillsData]);

    // 技能点击跳转联动
    const handleNavigateToSkill = (targetSkillId: string) => {
        const meta = skillMetaMap[targetSkillId];
        if (meta) {
            if (meta.classId !== selectedClass) {
                setSelectedClass(meta.classId);
            }
            if (selectedFaction !== 'ALL' && selectedFaction !== meta.faction) {
                setSelectedFaction('ALL');
            }
        }
        setHighlightedSkillId(targetSkillId);
        setTimeout(() => {
            const el = document.getElementById(`skill-${targetSkillId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-cyan-400', 'shadow-[0_0_25px_rgba(6,182,212,0.4)]');
                setTimeout(() => {
                    el.classList.remove('ring-2', 'ring-cyan-400', 'shadow-[0_0_25px_rgba(6,182,212,0.4)]');
                }, 2500);
            }
        }, 150);
    };

    // 搜索跳转与高亮处理
    useEffect(() => {
        if (!searchNav || searchNav.tab !== 'compendium' || (searchNav as any).sub !== 'skills') return;
        const target = searchNav as any;
        if (target.classId) {
            setSelectedClass(target.classId);
        }
        if (target.faction) {
            setSelectedFaction(target.faction);
        } else {
            setSelectedFaction('ALL');
        }
        if (target.skillId || target.skillName) {
            const sid = target.skillId || target.skillName;
            setHighlightedSkillId(sid);
            setTimeout(() => {
                const el = document.getElementById(`skill-${sid}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-400', 'shadow-[0_0_25px_rgba(6,182,212,0.4)]');
                    setTimeout(() => {
                        el.classList.remove('ring-2', 'ring-cyan-400', 'shadow-[0_0_25px_rgba(6,182,212,0.4)]');
                    }, 2500);
                }
            }, 150);
        }
        onSearchConsumed?.();
    }, [searchNav, onSearchConsumed]);

    // 获取当前筛选后的技能列表
    const filteredSkills = useMemo(() => {
        if (!allSkillsData) return [];
        const classObj = allSkillsData[selectedClass] || {};
        let list: SkillItem[] = [];

        const factionsToInclude = selectedFaction === 'ALL' ? ['XIAN', 'FO', 'MO', 'COMMON'] : [selectedFaction, 'COMMON'];
        for (const f of factionsToInclude) {
            const arr = classObj[f];
            if (Array.isArray(arr)) {
                list = list.concat(arr as unknown as SkillItem[]);
            }
        }

        if (!searchKeyword.trim()) return list;

        const kw = searchKeyword.trim().toLowerCase();
        return list.filter((sk) => {
            const name = sk.SkillName.toLowerCase();
            const desc = (sk.Description || '').toLowerCase();
            if (name.includes(kw) || desc.includes(kw)) return true;
            const py = pinyin(sk.SkillName, { toneType: 'none', type: 'array' }) as string[];
            const pyFull = py.join('').toLowerCase();
            const pyInitials = py.map((s) => s[0]).join('').toLowerCase();
            return pyFull.includes(kw) || pyInitials.includes(kw);
        });
    }, [allSkillsData, selectedClass, selectedFaction, searchKeyword]);

    return (
        <div className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 pb-12 animate-in fade-in duration-300">
            {/* 筛选面板：职业 Ribbon + 阵营筛选 + 技能搜索。
                两行之间 gap-3(12px)，与「职业状态一览」的减益/增益组保持同一密度 */}
            <div className="flex flex-col gap-3 mb-5 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                <div className="flex flex-wrap gap-1.5">
                    {CLASS_ORDER.map((cls) => {
                        const isSelected = selectedClass === cls.id;
                        const count = classSkillCounts[cls.id] || 0;
                        return (
                            <button
                                key={cls.id}
                                onClick={() => {
                                    setSelectedClass(cls.id);
                                    setHighlightedSkillId(null);
                                    onFilterChange?.(cls.id, selectedFaction);
                                }}
                                className={chipCls(isSelected)}
                            >
                                <span>{cls.name}</span>
                                <span className={chipCountCls(isSelected)}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                        {FACTIONS.map((f) => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    setSelectedFaction(f.id);
                                    onFilterChange?.(selectedClass, f.id);
                                }}
                                className={chipCls(selectedFaction === f.id)}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="在当前职业搜索技能名或机制..."
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs md:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* 技能网格 (响应式3列紧凑布局) */}
            {filteredSkills.length === 0 ? (
                <div className="zx-card p-12 text-center text-slate-500">
                    <p className="text-base">没有找到匹配的技能</p>
                    <p className="text-xs text-slate-600 mt-1">请尝试更换阵营或清空搜索关键词</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 lg:gap-5">
                    {filteredSkills.map((sk) => (
                        <SkillCard
                            key={sk.SkillID}
                            skill={sk}
                            isHighlighted={highlightedSkillId === sk.SkillID}
                            skillIdToNameMap={skillIdToNameMap}
                            onNavigateToSkill={handleNavigateToSkill}
                            fourthGenReverse={fourthGenReverseMap[sk.SkillID] || []}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

/** 单个技能卡片组件：方案 B（结构化矩阵数据表） */
interface FourthGenReverseItem { sourceId: string; sourceName: string; slot: string; text: string; }

const SkillCard: React.FC<{
    skill: SkillItem;
    isHighlighted?: boolean;
    skillIdToNameMap: Record<string, string>;
    onNavigateToSkill: (skillId: string) => void;
    fourthGenReverse?: FourthGenReverseItem[];
}> = ({ skill, isHighlighted, skillIdToNameMap, onNavigateToSkill, fourthGenReverse = [] }) => {
    // 阵营 Badge
    const factionBadge = useMemo(() => {
        if (skill.Faction === 'COMMON') {
            return <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-slate-500/15 text-slate-300 border border-slate-500/30 shrink-0">通用</span>;
        }
        if (skill.Faction === 'XIAN') {
            return <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">仙</span>;
        }
        if (skill.Faction === 'FO') {
            return <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">佛</span>;
        }
        if (skill.Faction === 'MO') {
            return <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">魔</span>;
        }
        return null;
    }, [skill.Faction]);

    // 统合计算属性与机制
    const unifiedData = useMemo(() => {
        return getUnifiedSkillData(skill, skillIdToNameMap);
    }, [skill, skillIdToNameMap]);

    // 重置技能解析列表
    const resets = useMemo(() => {
        if (!skill.CooldownResets || skill.CooldownResets.length === 0) return [];
        return skill.CooldownResets.map(r => ({
            id: r.TargetSkillId,
            name: skillIdToNameMap[r.TargetSkillId] || r.TargetSkillName || r.TargetSkillId
        }));
    }, [skill.CooldownResets, skillIdToNameMap]);

    const isPassiveEntry = skill.ActionType === 'FOURTH_GEN_PASSIVE' || isGrantPassiveEntry(skill);

    const slotLabel = (slot?: string) => slot === 'ZAO_HUA' ? '造化增益' : slot === 'CHI_WU' ? '赤乌增益' : '玄烛增益';

    return (
        <div
            id={`skill-${skill.SkillID}`}
            className={clsx(
                'group rounded-xl p-4 transition-all duration-200 border bg-slate-900/85 hover:border-cyan-500/40 hover:bg-slate-900/95 flex flex-col justify-start gap-3.5 shadow-md',
                isHighlighted
                    ? 'border-cyan-400 bg-cyan-950/25 ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                    : 'border-slate-800/80'
            )}
        >
            {/* 1. 卡片头部：技能名 + 阵营 + 冷却/施法/充能 */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="w-1.5 h-4.5 bg-cyan-400 rounded-full shrink-0"></span>
                    <h3 className="text-[15px] font-black text-slate-100 tracking-wide group-hover:text-cyan-300 transition-colors truncate">
                        {skill.SkillName}
                    </h3>
                    {factionBadge}
                    {skill.SkillImportanceWeight !== undefined && skill.SkillImportanceWeight > 0 && (
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                            权重{skill.SkillImportanceWeight}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 text-xs font-mono shrink-0 flex-wrap justify-end">
                    {isPassiveEntry && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-cyan-950/50 text-cyan-300 border border-cyan-800/60 flex items-center gap-1">
                            <InfinityIcon className="w-3 h-3 text-cyan-400" />
                            常驻生效
                        </span>
                    )}
                    {!isPassiveEntry && (
                    <span className="px-2 py-0.5 rounded-md font-medium bg-slate-800/70 text-slate-200 border border-slate-700/60 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        {skill.Cooldown > 0 ? `${skill.Cooldown}s 冷却` : '0s 冷却'}
                    </span>
                    )}

                    {!isPassiveEntry && (
                    <span className="px-2 py-0.5 rounded-md text-slate-300 bg-slate-800/70 border border-slate-700/60">
                        {skill.CastTime > 0 ? `${skill.CastTime}s 施法` : '瞬发'}
                    </span>
                    )}

                    {skill.MaxCharges && skill.MaxCharges > 1 && (
                        <span className="px-2 py-0.5 rounded-md font-bold bg-purple-950/60 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                            <Zap className="w-3 h-3 text-purple-400" />
                            {skill.MaxCharges}层充能 ({skill.ChargeReplenishTime ? `${skill.ChargeReplenishTime}s恢复` : `${skill.Cooldown}s`})
                        </span>
                    )}
                </div>
            </div>

            {/* 2. 技能规格属性矩阵 (方案 B: 结构化矩阵数据表) */}
            {unifiedData.attributes.length > 0 && (
                <div className={ATTR_GRID}>
                    {/* 第一项：技能类型/机制归类标签 */}
                    {unifiedData.badgeText && (
                        <div className={ATTR_CELL_BADGE}>
                            <span className={ATTR_LABEL}>机制类型</span>
                            <span
                                className={clsx(
                                    'text-[11px] font-bold px-1.5 py-0.2 rounded border shrink-0 whitespace-nowrap',
                                    unifiedData.badgeTheme === 'damage' && 'bg-slate-800/60 text-slate-300 border-slate-700/60',
                                    unifiedData.badgeTheme === 'buff' && 'bg-cyan-950/40 text-cyan-300 border-cyan-800/50',
                                    unifiedData.badgeTheme === 'debuff' && 'bg-rose-950/40 text-rose-300 border-rose-800/50',
                                    unifiedData.badgeTheme === 'utility' && 'bg-sky-950/40 text-sky-300 border-sky-800/50'
                                )}
                            >
                                {unifiedData.badgeText}
                            </span>
                        </div>
                    )}

                    {/* 各属性规格键值对 */}
                    {unifiedData.attributes.map((attr, aIdx) => (
                        <div
                            key={aIdx}
                            className={clsx(
                                ATTR_CELL,
                                attr.wrap
                                    ? ATTR_CELL_STACK
                                    : clsx(ATTR_CELL_INLINE, attr.fullRow && 'col-span-2 sm:col-span-3')
                            )}
                        >
                            <span className={attr.wrap ? ATTR_LABEL_STACK : ATTR_LABEL}>{attr.label || '属性'}</span>
                            <span
                                className={attr.wrap
                                    ? ATTR_VALUE_STACK
                                    : clsx(
                                        ATTR_VALUE,
                                        attr.isPrimary
                                            ? 'text-cyan-300'
                                            : unifiedData.badgeTheme === 'debuff'
                                            ? 'text-rose-300'
                                            : 'text-slate-200'
                                    )}
                            >
                                <BonusValue value={attr.value} />
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* 3. 特殊战斗机制说明 (仅保留实质性机制，排版整洁) */}
            {unifiedData.mechanicNote && (
                <p className={NOTE_PARAGRAPH}>
                    {renderQuietDescription(unifiedData.mechanicNote)}
                </p>
            )}

            {/* 四代玄烛/赤乌反向增益：普通技能卡提示受哪个四代影响、加了多少，可点击跳转 */}
            {skill.ActionType !== "FOURTH_GEN_PASSIVE" && fourthGenReverse.length > 0 && (
                <div className={NOTE_BLOCK}>
                    {fourthGenReverse.map((fg, fgIdx) => (
                        <div key={fgIdx} className={NOTE_ROW}>
                            <span className={NOTE_LABEL}>{slotLabel(fg.slot)}</span>
                            <button
                                type="button"
                                onClick={() => onNavigateToSkill(fg.sourceId)}
                                className={clsx(NOTE_LINK, NOTE_TEXT, 'flex-1')}
                                title={"点击查看 " + fg.sourceName}
                            >
                                受《{fg.sourceName}》{fg.text}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* 4. 战术重置胶囊 */}
            {skill.ActionType !== 'UTILITY' && resets.length > 0 && (
                <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <RotateCcw className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span>充能刷新:</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {resets.map((r, rIdx) => (
                            <button
                                key={rIdx}
                                onClick={() => onNavigateToSkill(r.id)}
                                className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold transition-colors"
                                title={`点击查看 ${r.name}`}
                            >
                                {r.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

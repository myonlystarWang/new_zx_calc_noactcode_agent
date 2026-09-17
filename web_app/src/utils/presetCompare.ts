/**
 * Step 12.1：A/B 方案对比的计算层（纯函数，无 React 依赖）
 *
 * 口径：
 * - 技能表 = `buildSingleCalcSkills`（理论满配，含峰值变体）
 * - 技能值 = **单段伤害**：多段/步进技能（如苍龙啸·龙怒）只取 `hits[]` 的**最后一段**，不做各段累加
 * - BOSS 值 = 该 BOSS 全部输出技能的**值之和**
 * - 副本值 = 该副本内全部 BOSS 的均值
 *   ⚠️ 与计算器页的「综合战力」（技能加权和）**不是同一口径**，页面上已注明。
 *
 * 技能行取「两侧技能 ID 的并集」：同门派同阵营时为一一对应；跨门派/阵营时
 * 只有重叠技能两侧都有值，其余单侧显示，用「占比」辅助横向阅读。
 *
 * 对比只读 preset 数据、不 loadPreset，因此不会污染计算器当前配置。
 */
import { DataService } from '../services/DataService';
import { buildSingleCalcSkills, calculateDamage } from './calculator';
import { defaultAttributes } from '../context/AppContext';
import type { Buff, CharacterAttributes, Skill } from '../types';
import type { Preset } from '../hooks/usePresets';

/** 属性对比行（顺序与计算器页 AttributePanel 一致） */
export const ATTRIBUTE_ROWS: { key: keyof CharacterAttributes; label: string }[] = [
    { key: 'CharacterMinAttack', label: '最小攻击' },
    { key: 'CharacterMaxAttack', label: '最大攻击' },
    { key: 'CharacterHealth', label: '气血' },
    { key: 'CharacterMana', label: '真气' },
    { key: 'CharacterDefense', label: '防御' },
    { key: 'CharacterCriticalHitDamagePercent', label: '暴击伤害' },
    { key: 'CharacterMonsterDamageIncreasePercent', label: '对怪增伤' },
];

/**
 * 副本分类与排序。
 * ⚠️ 与 `BossCompendiumView` 内的 DUNGEON_SHORT_LABELS / DUNGEON_ORDER_MAP 同源（用户拍板的展示顺序），
 * 该文件未导出这些常量，为避免改动既有页面在此复刻一份；两处如需同时调整请一并改。
 */
export type DungeonCategory = 'tben' | 'tuanben' | 'trials';

export const DUNGEON_CATEGORY_LABELS: Record<DungeonCategory, string> = {
    tben: 'T 本',
    tuanben: '团本',
    trials: '历练与试炼',
};

export const DUNGEON_CATEGORY_ORDER: DungeonCategory[] = ['tben', 'tuanben', 'trials'];

const DUNGEON_ORDER_MAP: Record<string, number> = {
    HUIMENG_LINGYUN_T16: 10,
    HUIMENG_LINGYUN_T17: 20,
    HUIMENG_LINGYUN_T18: 30,
    ZHENHAI_DUANLANG_T19: 40,
    ZHENHAI_DUANLANG_T20: 50,
    ZHENHAI_DUANLANG_T21: 60,
    SHOUSHEN_JIANGLIN_HARD: 110,
    JIEQI_KONGSANG_NORMAL: 120,
    JIEQI_KONGSANG_HARD: 130,
    TIANDI_BAOKU_NORMAL: 140,
    TIANDI_BAOKU_MEDIUM: 150,
    TIANDI_BAOKU_HARD: 160,
    LIU_BO_JING_BIAN_CHUSHI: 170,
    LIU_BO_JING_BIAN_HARD: 180,
    SIXIANG_QI: 210,
    XUANYELIN_QIWEI_WUGONG: 220,
};

export const getDungeonCategory = (dungeonId: string): DungeonCategory => {
    if (dungeonId.startsWith('HUIMENG_LINGYUN') || dungeonId.startsWith('ZHENHAI_DUANLANG')) return 'tben';
    if (
        dungeonId.startsWith('TIANDI_BAOKU') ||
        dungeonId.startsWith('LIU_BO_JING_BIAN') ||
        dungeonId.startsWith('JIEQI_KONGSANG') ||
        dungeonId.startsWith('SHOUSHEN_JIANGLIN')
    ) return 'tuanben';
    return 'trials';
};

export interface AttributeCompareRow {
    key: string;
    label: string;
    a: number;
    b: number;
    delta: number;
    /** B 相对 A 的变化率（A 为 0 时无意义，置 null） */
    deltaPercent: number | null;
}

export interface BuffCompareRow {
    buffId: string;
    name: string;
    /** 未启用时为 null（页面上显示「未启用」） */
    a: number | null;
    b: number | null;
    unit: string;
    delta: number | null;
    deltaPercent: number | null;
}

export interface SkillCompareRow {
    skillId: string;
    name: string;
    a: number | null;
    b: number | null;
    /** 占该侧 BOSS 总伤的百分比 */
    shareA: number | null;
    shareB: number | null;
    delta: number | null;
    deltaPercent: number | null;
}

export interface MonsterCompareRow {
    monsterId: string;
    name: string;
    a: number;
    b: number;
    deltaPercent: number | null;
    skills: SkillCompareRow[];
}

export interface DungeonCompareRow {
    dungeonId: string;
    name: string;
    category: DungeonCategory;
    a: number;
    b: number;
    deltaPercent: number | null;
    monsters: MonsterCompareRow[];
}

export interface CompareResult {
    /** 两侧门派与阵营都一致（技能表完全相同，技能行可一一对应） */
    identicalBuild: boolean;
    attributes: AttributeCompareRow[];
    buffs: BuffCompareRow[];
    dungeons: DungeonCompareRow[];
}

/** 某套方案在全部副本上的伤害画像 */
interface SideProfile {
    /** 副本 → BOSS 总伤均值 */
    avgByDungeon: Map<string, number>;
    /** BOSS → { 总伤, 逐技能 } */
    byMonster: Map<string, { total: number; skills: { skill: Skill; avg: number }[] }>;
}

const percentChange = (base: number, next: number): number | null => {
    if (!base || !isFinite(base)) return null;
    return ((next - base) / Math.abs(base)) * 100;
};

/** 安全取属性：损坏/旧版快照缺字段时用站点基线补齐，避免算出 NaN */
const safeAttributes = (attrs: CharacterAttributes | undefined): CharacterAttributes => ({
    ...defaultAttributes,
    ...(attrs || {}),
});

function computeProfile(preset: Preset, buffs: Buff[]): SideProfile {
    const service = DataService.getInstance();
    const skills = buildSingleCalcSkills(service.getSkills(preset.classId), preset.faction);
    const attributes = safeAttributes(preset.attributes);

    const activeIds = new Set(preset.activeBuffIds || []);
    const activeBuffs = buffs.filter((b) => activeIds.has(b.BuffID));
    const buffValues = preset.buffValues || {};

    const avgByDungeon = new Map<string, number>();
    const byMonster = new Map<string, { total: number; skills: { skill: Skill; avg: number }[] }>();

    for (const dungeon of service.getDungeons()) {
        const monsters = dungeon.Monsters || [];
        if (monsters.length === 0) {
            avgByDungeon.set(dungeon.DungeonID, 0);
            continue;
        }
        let dungeonTotal = 0;
        for (const monster of monsters) {
            const perSkill = skills.map((skill) => {
                const dmg = calculateDamage(attributes, skill, monster, activeBuffs, buffValues);
                // 用户拍板：技能行只取**单段伤害**；多段/步进技能（如苍龙啸·龙怒）只取**最后一段**，
                // 不把各段累加（累加值会把步进技能的成长段重复计入，横向对比失真）。
                const last = dmg.hits && dmg.hits.length > 0 ? dmg.hits[dmg.hits.length - 1] : null;
                return { skill, avg: last ? last.avgFinalDamage : dmg.avgFinalDamage };
            });
            const total = perSkill.reduce((s, item) => s + item.avg, 0);
            byMonster.set(monster.MonsterID, { total, skills: perSkill });
            dungeonTotal += total;
        }
        avgByDungeon.set(dungeon.DungeonID, dungeonTotal / monsters.length);
    }

    return { avgByDungeon, byMonster };
}

/** 增益一行：未启用的一侧为 null；数值取用户设定值，缺省用 buff 默认值 */
function compareBuffs(presetA: Preset, presetB: Preset, buffs: Buff[]): BuffCompareRow[] {
    const setA = new Set(presetA.activeBuffIds || []);
    const setB = new Set(presetB.activeBuffIds || []);
    const valuesA = presetA.buffValues || {};
    const valuesB = presetB.buffValues || {};

    return buffs.map((buff) => {
        const activeA = setA.has(buff.BuffID);
        const activeB = setB.has(buff.BuffID);
        const a = activeA ? Number(valuesA[buff.BuffID] ?? buff.DefaultEffectValue ?? 0) : null;
        const b = activeB ? Number(valuesB[buff.BuffID] ?? buff.DefaultEffectValue ?? 0) : null;
        const effectKey = Object.keys(buff.BuffEffects || {})[0] || '';
        const bothNumbers = a !== null && b !== null;
        return {
            buffId: buff.BuffID,
            name: buff.BuffName,
            a,
            b,
            unit: effectKey.includes('Percent') ? '%' : '',
            delta: bothNumbers ? (b as number) - (a as number) : null,
            deltaPercent: bothNumbers ? percentChange(a as number, b as number) : null,
        };
    });
}

/** 主入口：两套方案 → 对比结果 */
export function comparePresets(presetA: Preset, presetB: Preset, buffs: Buff[]): CompareResult {
    const service = DataService.getInstance();
    const profileA = computeProfile(presetA, buffs);
    const profileB = computeProfile(presetB, buffs);

    const attrA = safeAttributes(presetA.attributes);
    const attrB = safeAttributes(presetB.attributes);
    const attributes: AttributeCompareRow[] = ATTRIBUTE_ROWS.map(({ key, label }) => {
        const a = Number(attrA[key] ?? 0);
        const b = Number(attrB[key] ?? 0);
        return { key, label, a, b, delta: b - a, deltaPercent: percentChange(a, b) };
    });

    const dungeons: DungeonCompareRow[] = [...service.getDungeons()]
        .sort((left, right) => (DUNGEON_ORDER_MAP[left.DungeonID] ?? 999) - (DUNGEON_ORDER_MAP[right.DungeonID] ?? 999))
        .map((dungeon) => {
            const a = profileA.avgByDungeon.get(dungeon.DungeonID) ?? 0;
            const b = profileB.avgByDungeon.get(dungeon.DungeonID) ?? 0;

            const monsters: MonsterCompareRow[] = (dungeon.Monsters || []).map((monster) => {
                const sideA = profileA.byMonster.get(monster.MonsterID);
                const sideB = profileB.byMonster.get(monster.MonsterID);
                const totalA = sideA?.total ?? 0;
                const totalB = sideB?.total ?? 0;

                // 技能 ID 并集（保持 A 的顺序，B 独有的追加在后），再按「较大的那侧伤害」降序
                const mapA = new Map((sideA?.skills || []).map((s) => [s.skill.SkillID, s]));
                const mapB = new Map((sideB?.skills || []).map((s) => [s.skill.SkillID, s]));
                const ids: string[] = [
                    ...(sideA?.skills || []).map((s) => s.skill.SkillID),
                    ...(sideB?.skills || []).map((s) => s.skill.SkillID).filter((id) => !mapA.has(id)),
                ];

                const skills: SkillCompareRow[] = ids
                    .map((id) => {
                        const sa = mapA.get(id);
                        const sb = mapB.get(id);
                        const va = sa ? sa.avg : null;
                        const vb = sb ? sb.avg : null;
                        const both = va !== null && vb !== null;
                        return {
                            skillId: id,
                            name: sa?.skill.SkillName || sb?.skill.SkillName || id,
                            a: va,
                            b: vb,
                            shareA: va !== null && totalA > 0 ? (va / totalA) * 100 : null,
                            shareB: vb !== null && totalB > 0 ? (vb / totalB) * 100 : null,
                            delta: both ? (vb as number) - (va as number) : null,
                            deltaPercent: both ? percentChange(va as number, vb as number) : null,
                        };
                    })
                    .sort((left, right) => Math.max(right.a ?? 0, right.b ?? 0) - Math.max(left.a ?? 0, left.b ?? 0));

                return {
                    monsterId: monster.MonsterID,
                    name: monster.MonsterName,
                    a: totalA,
                    b: totalB,
                    deltaPercent: percentChange(totalA, totalB),
                    skills,
                };
            });

            return {
                dungeonId: dungeon.DungeonID,
                name: dungeon.DungeonName,
                category: getDungeonCategory(dungeon.DungeonID),
                a,
                b,
                deltaPercent: percentChange(a, b),
                monsters,
            };
        });

    return {
        identicalBuild: presetA.classId === presetB.classId && presetA.faction === presetB.faction,
        attributes,
        buffs: compareBuffs(presetA, presetB, buffs),
        dungeons,
    };
}

import type {
  Skill,
  PlayerSkillOverride,
  EquippedFourthGen,
  FourthGenQuality,
  SkillBonusAttributes,
  AppliedEffectConfig,
  FourthGenGrant
} from './types.js';
import { addPerHitField, type PerHitField } from './per_hit.js';

/**
 * 四代技能（玄烛·xxx / 赤乌·xxx）佩戴效果应用。
 * - 作用本技能：四代实体自带 FourthGenPresets[quality]，按"覆盖"语义应用到实体自身（与历史方式A/B一致）。
 * - 作用其他技能：四代实体的 FourthGenGrants[quality] 指向目标技能，SkillBonusAttributes 数值字段"相加"，
 *   顶层字段覆盖；多个四代作用同一技能时增量累加。
 * 本模块为纯函数，不依赖 Actor，便于单测与未来单次计算路径复用。
 */

const VALID_QUALITIES: FourthGenQuality[] = ['YING_JU', 'HAO_YUE', 'XI_RI'];

/** SkillBonusAttributes 中按"增量相加"处理的数值字段；其余（MultiHitConfig）按覆盖处理 */
const ADDITIVE_BONUS_FIELDS: PerHitField[] = [
  'SkillAttackPercentBonus',
  'SkillAttackFixedBonus',
  'SkillDefensePercentBonus',
  'SkillHealthPercentBonus',
  'SkillManaPercentBonus',
  'SkillCriticalDamagePercentBonus',
  'SkillDamageBonus'
];

/** 合并 AppliesEffects：按 EffectId 覆盖，BuffEffects 浅合并（与 Actor 内历史逻辑保持一致） */
function mergeEffectOverridesLocal(
  skill: Skill,
  overrides: Record<string, Partial<AppliedEffectConfig>>
): void {
  if (!skill.AppliesEffects) return;
  skill.AppliesEffects = skill.AppliesEffects.map((effect) => {
    const override = overrides[effect.EffectId];
    if (!override) return effect;
    return {
      ...effect,
      ...override,
      BuffEffects: {
        ...effect.BuffEffects,
        ...(override.BuffEffects || {})
      }
    };
  });
}

/**
 * 覆盖式叠加：顶层字段覆盖、SkillBonusAttributes 同名字段覆盖。
 * 用于"作用本技能"的 FourthGenPresets（预设是该品质下的完整值）。
 */
export function applyOverrideCover(skill: Skill, ovr: Partial<PlayerSkillOverride>): void {
  const { AppliesEffects, SkillBonusAttributes: bonusAttrs, ...topLevel } = ovr;
  Object.assign(skill, topLevel);
  if (bonusAttrs) {
    skill.SkillBonusAttributes = { ...skill.SkillBonusAttributes, ...bonusAttrs };
  }
  if (AppliesEffects) mergeEffectOverridesLocal(skill, AppliesEffects);
}

/**
 * 加法叠加：SkillBonusAttributes 数值字段在原值上累加、MultiHitConfig 覆盖；顶层字段覆盖。
 * 用于"作用其他技能"的 FourthGenGrants（如未名斩真气攻击力 +10）。
 */
export function applyOverrideAdditive(skill: Skill, ovr: Partial<PlayerSkillOverride>): void {
  const { AppliesEffects, SkillBonusAttributes: bonusAttrs, CooldownReduction, ...topLevel } = ovr;
  Object.assign(skill, topLevel);
  // 冷却减少量：相对当前 Cooldown 相减（与顶层 Cooldown 绝对覆盖区分，便于多源叠加）
  if (typeof CooldownReduction === 'number') {
    const base = typeof skill.Cooldown === 'number' ? skill.Cooldown : 0;
    skill.Cooldown = base - CooldownReduction;
  }
  if (bonusAttrs) {
    const merged: SkillBonusAttributes = { ...skill.SkillBonusAttributes };
    for (const key of ADDITIVE_BONUS_FIELDS) {
      const inc = bonusAttrs[key];
      if (inc === undefined) continue;
      // 标量广播到每一段、数组逐段相加（每段显式数组见 per_hit.ts）
      addPerHitField(merged, key, inc, `grant->${skill.SkillID}`);
    }
    if (bonusAttrs.MultiHitConfig !== undefined) {
      merged.MultiHitConfig = bonusAttrs.MultiHitConfig;
    }
    skill.SkillBonusAttributes = merged;
  }
  if (AppliesEffects) mergeEffectOverridesLocal(skill, AppliesEffects);
}

/** 是否为不进入输出循环的四代被动条目 */
export const isFourthGenPassive = (skill: Skill): boolean => skill.ActionType === 'FOURTH_GEN_PASSIVE';

/** 是否为不进入输出循环的造化技能被动条目（带 II 的造化技能，常驻生效） */
export const isClassPassive = (skill: Skill): boolean => skill.ActionType === 'ZAO_HUA_PASSIVE';

/** 把一条 Grant 的 Override 应用到它的全部目标技能（静默跳过不存在的目标） */
export function applyGrantToTargets(skillMap: Record<string, Skill>, grant: FourthGenGrant): void {
  for (const targetId of grant.TargetSkillIds) {
    const target = skillMap[targetId];
    if (!target) continue;
    applyOverrideAdditive(target, grant.Override);
  }
}

/**
 * 在已深拷贝的技能集合上应用门派"造化被动"（常驻、不占四代槽位、无需佩戴）。
 * 遍历集合内所有带 ZaoHuaGrants 的技能，按 FourthGenGrant 结构以"加法叠加"应用到每个目标技能。
 * 与 applyEquippedFourthGen 的 Grants 分支语义一致，只是来源是学习者本身而非佩戴的四代实体。
 *
 * 两趟排序：先应用"绝对覆盖类" grant（如玄烛把九刃齐歌 CD 覆盖为 32），再应用"冷却减少类"
 * grant（CooldownReduction），保证多源冷却叠加与遍历顺序无关。
 */
export function applyClassPassives(skillMap: Record<string, Skill>): Record<string, Skill> {
  const grants: FourthGenGrant[] = [];
  for (const skill of Object.values(skillMap)) {
    if (skill.ZaoHuaGrants && skill.ZaoHuaGrants.length > 0) grants.push(...skill.ZaoHuaGrants);
  }
  // 第一趟：无 CooldownReduction 的 grant（绝对覆盖 + 加成）
  for (const grant of grants) {
    if (grant.Override && grant.Override.CooldownReduction != null) continue;
    applyGrantToTargets(skillMap, grant);
  }
  // 第二趟：带 CooldownReduction 的 grant（最后相减，叠加在绝对覆盖之上）
  for (const grant of grants) {
    if (!grant.Override || grant.Override.CooldownReduction == null) continue;
    applyGrantToTargets(skillMap, grant);
  }
  return skillMap;
}

/** 取四代实体在指定品质下的初始效果模板（佩戴后场景开始时施加，空数组兜底） */
export function getFourthGenInitialEffects(fg: Skill, quality: FourthGenQuality): AppliedEffectConfig[] {
  return fg.FourthGenInitialEffects?.[quality] ?? [];
}

/**
 * 佩戴槽位硬校验：玄烛≤3、赤乌≤1、总数≤4；超限抛错。
 * 佩戴了技能表中不存在 / 缺少槽位标记的实体时仅告警并跳过（不中断计算）。
 */
export function validateEquippedFourthGen(
  equipped: EquippedFourthGen[],
  skillMap: Record<string, Skill>
): void {
  let xuanZhu = 0;
  let chiWu = 0;
  for (const item of equipped) {
    const fg = skillMap[item.skillId];
    if (!fg) {
      console.warn(`[fourth_gen] equipped fourth-gen skill not found, ignored: ${item.skillId}`);
      continue;
    }
    if (!fg.FourthGenSlot) {
      console.warn(`[fourth_gen] skill has no FourthGenSlot, ignored: ${item.skillId}`);
      continue;
    }
    if (fg.FourthGenSlot === 'XUAN_ZHU') xuanZhu += 1;
    else if (fg.FourthGenSlot === 'CHI_WU') chiWu += 1;
  }
  if (xuanZhu > 3) {
    throw new Error(`[fourth_gen] at most 3 XUAN_ZHU fourth-gen skills allowed, got ${xuanZhu}`);
  }
  if (chiWu > 1) {
    throw new Error(`[fourth_gen] at most 1 CHI_WU fourth-gen skill allowed, got ${chiWu}`);
  }
  if (equipped.length > 4) {
    throw new Error(`[fourth_gen] at most 4 fourth-gen skills allowed, got ${equipped.length}`);
  }
}

/**
 * 在已深拷贝的技能集合上应用玩家佩戴的四代技能（原地修改并返回同一 skillMap）。
 * 不传 / 空数组时直接原样返回，保证零回归。
 */
export function applyEquippedFourthGen(
  skillMap: Record<string, Skill>,
  equipped?: EquippedFourthGen[]
): Record<string, Skill> {
  if (!equipped || equipped.length === 0) return skillMap;
  validateEquippedFourthGen(equipped, skillMap);

  for (const item of equipped) {
    if (!VALID_QUALITIES.includes(item.quality)) {
      console.warn(`[fourth_gen] invalid quality "${String(item.quality)}", ignored: ${item.skillId}`);
      continue;
    }
    const fg = skillMap[item.skillId];
    if (!fg || !fg.FourthGenSlot) continue; // 已在 validate 中告警

    // 1) 作用本技能：该品质预设覆盖到四代实体自身
    const selfPreset = fg.FourthGenPresets?.[item.quality];
    if (selfPreset) applyOverrideCover(fg, selfPreset);

    // 2) 作用其他技能：Grants 以加法叠加到每个目标技能
    const grants = fg.FourthGenGrants?.[item.quality];
    if (grants) {
      for (const grant of grants) {
        for (const targetId of grant.TargetSkillIds) {
          const target = skillMap[targetId];
          if (!target) {
            // COMMON 通用四代的 Grants 一次性列出所有阵营目标，当前玩家只持有本阵营技能，命中不到其他阵营属预期，静默跳过
            if (fg.Faction !== 'COMMON') {
              console.warn(
                `[fourth_gen] grant target not found, ignored: ${item.skillId} -> ${targetId}`
              );
            }
            continue;
          }
          applyOverrideAdditive(target, grant.Override);
        }
      }
    }
  }
  return skillMap;
}

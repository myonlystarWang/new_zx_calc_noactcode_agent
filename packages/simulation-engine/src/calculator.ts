import type {
  CharacterAttributes,
  Skill,
  Monster,
  Buff,
  DamageResult,
  HitDamageResult,
  BuffEffects,
  AttributeCapsConfig,
  HitDamageFormulaTrace,
  SkillBonusAttributes
} from './types.js';
import { resolveEffectiveCharacterAttributes, sumBuffEffectsFromBuffs } from './attributes.js';

interface DamageContext {
  uncappedAttributes: CharacterAttributes;
  effectiveAttributes: CharacterAttributes;
  buffTotals: BuffEffects;
  ybjhGreenMultiplierActive: boolean;
  buffMonsterCriticalDamagePercentBeforeCap: number;
  buffMonsterCriticalDamagePercent: number;
  buffMonsterHarmedPercentBeforeCap: number;
  buffMonsterHarmedPercent: number;
}

interface ResolvedHitDamage {
  damage: HitDamageResult;
  trace: HitDamageFormulaTrace;
}

export const DEFAULT_ATTRIBUTE_CAPS: Required<AttributeCapsConfig> = {
  EnableCaps: true,
  CapHealth: 4000000,
  CapMana: 6000000,
  CapAttack: 750000,
  CapDefense: 500000,
  CapCriticalDamage: 3000,
  CapGreenPoints: 900,
  CapMonsterHarmed: 120
};

export const resolveHitDamage = (
  character: CharacterAttributes,
  skill: Skill,
  monster: Monster,
  activeBuffs: Buff[],
  hitIndex: number, // 1-indexed
  buffValues: Record<string, number> = {},
  caps?: AttributeCapsConfig
): HitDamageResult => {
  return resolveHitDamageWithTrace(character, skill, monster, activeBuffs, hitIndex, buffValues, caps).damage;
};

export const resolveHitDamageWithTrace = (
  character: CharacterAttributes,
  skill: Skill,
  monster: Monster,
  activeBuffs: Buff[],
  hitIndex: number, // 1-indexed
  buffValues: Record<string, number> = {},
  caps?: AttributeCapsConfig
): ResolvedHitDamage => {
  const effectiveCaps = resolveAttributeCaps(caps);
  const context = resolveDamageContext(character, activeBuffs, buffValues, caps);
  const { effectiveAttributes, buffTotals } = context;
  const effMinAttack = effectiveAttributes.CharacterMinAttack;
  const effMaxAttack = effectiveAttributes.CharacterMaxAttack;
  const effHealth = effectiveAttributes.CharacterHealth;
  const effMana = effectiveAttributes.CharacterMana;
  const effDefense = effectiveAttributes.CharacterDefense;
  const buffMonCritDmg = context.buffMonsterCriticalDamagePercent;
  const buffMonHarmed = context.buffMonsterHarmedPercent;

  const buffFocus = buffTotals.BuffFocusPercentEffect ?? 0;
  const buffHolyWrath = buffTotals.BuffHolyWrathPercentEffect ?? 0;

  const baseSkillBonus = skill.SkillBonusAttributes;
  const multiHit = baseSkillBonus.MultiHitConfig;
  const hitCount = multiHit ? multiHit.HitCount : 1;

  const currentSkillBonus: SkillBonusAttributes = { ...baseSkillBonus };
  if (
    multiHit &&
    multiHit.ScalingAttribute &&
    multiHit.ScalingStartValue !== undefined &&
    multiHit.ScalingEndValue !== undefined
  ) {
    const start = multiHit.ScalingStartValue;
    const end = multiHit.ScalingEndValue;
    const step = hitCount > 1 ? (end - start) / (hitCount - 1) : 0;
    (currentSkillBonus as Record<string, unknown>)[multiHit.ScalingAttribute] = start + step * (hitIndex - 1);
  }

  const minBaseDamage =
    effMinAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) +
    (currentSkillBonus.SkillAttackFixedBonus || 0) +
    (effHealth * (currentSkillBonus.SkillHealthPercentBonus || 0)) / 100 +
    (effMana * (currentSkillBonus.SkillManaPercentBonus || 0)) / 100 +
    (effDefense * (currentSkillBonus.SkillDefensePercentBonus || 0)) / 100;

  const maxBaseDamage =
    effMaxAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) +
    (currentSkillBonus.SkillAttackFixedBonus || 0) +
    (effHealth * (currentSkillBonus.SkillHealthPercentBonus || 0)) / 100 +
    (effMana * (currentSkillBonus.SkillManaPercentBonus || 0)) / 100 +
    (effDefense * (currentSkillBonus.SkillDefensePercentBonus || 0)) / 100;

  const baseCritDmgBeforeCap = effectiveAttributes.CharacterCriticalHitDamagePercent + (currentSkillBonus.SkillCriticalDamagePercentBonus || 0);
  let baseCritDmg = baseCritDmgBeforeCap;
  if (effectiveCaps) {
    baseCritDmg = Math.min(baseCritDmg, effectiveCaps.CapCriticalDamage);
  }

  const monsterCriticalDamageReduction = monster.MonsterAttributeModifiers.MonsterCriticalDamagePercentReduction;
  const critDmgTotal =
    baseCritDmg +
    buffMonCritDmg -
    monsterCriticalDamageReduction;

  const critMultiplier = Math.max(1, critDmgTotal / 100);
  const damageBonusMultiplier =
    currentSkillBonus.SkillDamageBonus !== undefined ? currentSkillBonus.SkillDamageBonus : 1;
  const charMonDmgInc = 1 + effectiveAttributes.CharacterMonsterDamageIncreasePercent / 100;
  const monHarmedMultiplier = 1 + buffMonHarmed / 100;
  const focusMultiplier = 1 + buffFocus / 100;
  const holyWrathMultiplier = 1 + buffHolyWrath / 100;

  const finalMultipliers =
    critMultiplier *
    damageBonusMultiplier *
    charMonDmgInc *
    monHarmedMultiplier *
    focusMultiplier *
    holyWrathMultiplier;

  let minFinal = minBaseDamage * finalMultipliers;
  let maxFinal = maxBaseDamage * finalMultipliers;

  if (multiHit && multiHit.DamageMultiplierPerHit) {
    const multiplier = Math.pow(multiHit.DamageMultiplierPerHit, hitIndex - 1);
    minFinal *= multiplier;
    maxFinal *= multiplier;
  }

  if (multiHit && multiHit.DamageCap) {
    minFinal = Math.min(minFinal, multiHit.DamageCap);
    maxFinal = Math.min(maxFinal, multiHit.DamageCap);
  }

  const avgFinal = (minFinal + maxFinal) / 2;

  const damage = {
    hitIndex,
    minFinalDamage: minFinal,
    maxFinalDamage: maxFinal,
    avgFinalDamage: avgFinal
  };

  return {
    damage,
    trace: {
      hitIndex,
      skillBonusAttributes: currentSkillBonus,
      uncappedAttributes: { ...context.uncappedAttributes },
      effectiveAttributes: { ...effectiveAttributes },
      combinedBuffTotals: { ...buffTotals },
      ybjhGreenMultiplierActive: context.ybjhGreenMultiplierActive,
      buffMonsterCriticalDamagePercentBeforeCap: context.buffMonsterCriticalDamagePercentBeforeCap,
      buffMonsterCriticalDamagePercentAfterCap: buffMonCritDmg,
      buffMonsterHarmedPercentBeforeCap: context.buffMonsterHarmedPercentBeforeCap,
      buffMonsterHarmedPercentAfterCap: buffMonHarmed,
      baseCriticalDamageBeforeCap: baseCritDmgBeforeCap,
      baseCriticalDamageAfterCap: baseCritDmg,
      monsterCriticalDamageReduction,
      criticalDamageTotal: critDmgTotal,
      minBaseDamage,
      maxBaseDamage,
      minFinalDamageBeforeCompression: minFinal,
      maxFinalDamageBeforeCompression: maxFinal,
      avgFinalDamageBeforeCompression: avgFinal,
      multipliers: {
        critMultiplier,
        skillDamageBonusMultiplier: damageBonusMultiplier,
        characterMonsterDamageIncreaseMultiplier: charMonDmgInc,
        monsterHarmedMultiplier: monHarmedMultiplier,
        focusMultiplier,
        holyWrathMultiplier,
        combinedBeforeCompression: finalMultipliers
      }
    }
  };
};

export const calculateDamage = (
  character: CharacterAttributes,
  skill: Skill,
  monster: Monster,
  activeBuffs: Buff[],
  buffValues: Record<string, number> = {},
  caps?: AttributeCapsConfig
): DamageResult => {
  const baseSkillBonus = skill.SkillBonusAttributes;
  const multiHit = baseSkillBonus.MultiHitConfig;
  const hitCount = multiHit ? multiHit.HitCount : 1;
  const context = resolveDamageContext(character, activeBuffs, buffValues, caps);

  let totalMinFinalDamage = 0;
  let totalMaxFinalDamage = 0;
  let totalAvgFinalDamage = 0;
  const hits: HitDamageResult[] = [];
  let firstHitMinBaseDamage = 0;
  let firstHitMaxBaseDamage = 0;

  for (let i = 1; i <= hitCount; i += 1) {
    const hitRes = resolveHitDamage(character, skill, monster, activeBuffs, i, buffValues, caps);
    
    if (i === 1) {
      const currentSkillBonus = { ...baseSkillBonus };
      if (
        multiHit &&
        multiHit.ScalingAttribute &&
        multiHit.ScalingStartValue !== undefined &&
        multiHit.ScalingEndValue !== undefined
      ) {
        (currentSkillBonus as Record<string, unknown>)[multiHit.ScalingAttribute] = multiHit.ScalingStartValue;
      }

      firstHitMinBaseDamage =
        context.effectiveAttributes.CharacterMinAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) +
        (currentSkillBonus.SkillAttackFixedBonus || 0) +
        (context.effectiveAttributes.CharacterHealth * (currentSkillBonus.SkillHealthPercentBonus || 0)) / 100 +
        (context.effectiveAttributes.CharacterMana * (currentSkillBonus.SkillManaPercentBonus || 0)) / 100 +
        (context.effectiveAttributes.CharacterDefense * (currentSkillBonus.SkillDefensePercentBonus || 0)) / 100;

      firstHitMaxBaseDamage =
        context.effectiveAttributes.CharacterMaxAttack * (1 + (currentSkillBonus.SkillAttackPercentBonus || 0) / 100) +
        (currentSkillBonus.SkillAttackFixedBonus || 0) +
        (context.effectiveAttributes.CharacterHealth * (currentSkillBonus.SkillHealthPercentBonus || 0)) / 100 +
        (context.effectiveAttributes.CharacterMana * (currentSkillBonus.SkillManaPercentBonus || 0)) / 100 +
        (context.effectiveAttributes.CharacterDefense * (currentSkillBonus.SkillDefensePercentBonus || 0)) / 100;
    }

    totalMinFinalDamage += hitRes.minFinalDamage;
    totalMaxFinalDamage += hitRes.maxFinalDamage;
    totalAvgFinalDamage += hitRes.avgFinalDamage;

    hits.push(hitRes);
  }

  return {
    minBaseDamage: firstHitMinBaseDamage,
    maxBaseDamage: firstHitMaxBaseDamage,
    minFinalDamage: totalMinFinalDamage,
    maxFinalDamage: totalMaxFinalDamage,
    avgFinalDamage: totalAvgFinalDamage,
    hits: multiHit ? hits : undefined
  };
};

const resolveDamageContext = (
  character: CharacterAttributes,
  activeBuffs: Buff[],
  buffValues: Record<string, number>,
  caps?: AttributeCapsConfig
): DamageContext => {
  const buffTotals = sumBuffEffectsFromBuffs(activeBuffs, buffValues);
  const uncappedAttributes = resolveEffectiveCharacterAttributes(character, buffTotals);
  const effectiveAttributes: CharacterAttributes = { ...uncappedAttributes };
  let buffMonsterCriticalDamagePercent = buffTotals.BuffMonsterCriticalDamagePercentEffect ?? 0;
  let buffMonsterHarmedPercent = buffTotals.BuffMonsterHarmedPercentEffect ?? 0;
  const ybjhGreenMultiplierActive = activeBuffs.some(buff => buff.EffectId === 'FX_DEBUFF_YBJH_GREEN');

  if (ybjhGreenMultiplierActive) {
    buffMonsterCriticalDamagePercent *= 2;
  }

  const buffMonsterCriticalDamagePercentBeforeCap = buffMonsterCriticalDamagePercent;
  const buffMonsterHarmedPercentBeforeCap = buffMonsterHarmedPercent;

  const effectiveCaps = resolveAttributeCaps(caps);
  if (effectiveCaps) {
    effectiveAttributes.CharacterMinAttack = Math.min(effectiveAttributes.CharacterMinAttack, effectiveCaps.CapAttack);
    effectiveAttributes.CharacterMaxAttack = Math.min(effectiveAttributes.CharacterMaxAttack, effectiveCaps.CapAttack);
    effectiveAttributes.CharacterHealth = Math.min(effectiveAttributes.CharacterHealth, effectiveCaps.CapHealth);
    effectiveAttributes.CharacterMana = Math.min(effectiveAttributes.CharacterMana, effectiveCaps.CapMana);
    effectiveAttributes.CharacterDefense = Math.min(effectiveAttributes.CharacterDefense, effectiveCaps.CapDefense);
    buffMonsterCriticalDamagePercent = Math.min(buffMonsterCriticalDamagePercent, effectiveCaps.CapGreenPoints);
    buffMonsterHarmedPercent = Math.min(buffMonsterHarmedPercent, effectiveCaps.CapMonsterHarmed);
  }

  return {
    uncappedAttributes,
    effectiveAttributes,
    buffTotals,
    ybjhGreenMultiplierActive,
    buffMonsterCriticalDamagePercentBeforeCap,
    buffMonsterCriticalDamagePercent,
    buffMonsterHarmedPercentBeforeCap,
    buffMonsterHarmedPercent
  };
};

const resolveAttributeCaps = (caps?: AttributeCapsConfig): Required<AttributeCapsConfig> | undefined => {
  if (caps?.EnableCaps === false) return undefined;
  return {
    ...DEFAULT_ATTRIBUTE_CAPS,
    ...caps,
    EnableCaps: true
  };
};

export const calculateMonsterPower = (
  character: CharacterAttributes,
  skills: Skill[],
  monster: Monster,
  activeBuffs: Buff[],
  buffValues: Record<string, number> = {}
): number => {
  let totalPower = 0;
  skills.forEach((skill) => {
    const damage = calculateDamage(character, skill, monster, activeBuffs, buffValues);
    totalPower += damage.avgFinalDamage * skill.SkillImportanceWeight;
  });
  return totalPower;
};

export const calculateDungeonPower = (
  character: CharacterAttributes,
  skills: Skill[],
  monsters: Monster[],
  activeBuffs: Buff[],
  buffValues: Record<string, number> = {}
): number => {
  if (monsters.length === 0) return 0;
  let totalMonsterPower = 0;
  monsters.forEach((monster) => {
    totalMonsterPower += calculateMonsterPower(character, skills, monster, activeBuffs, buffValues);
  });
  return totalMonsterPower / monsters.length;
};

export const calculateTotalPower = (
  dungeonPowers: number[],
  weights: number[]
): number => {
  if (dungeonPowers.length === 0) return 0;
  let totalWeightedPower = 0;
  let totalWeight = 0;
  dungeonPowers.forEach((power, index) => {
    const weight = weights[index] || 1;
    totalWeightedPower += power * weight;
    totalWeight += weight;
  });
  if (totalWeight === 0) return 0;
  return totalWeightedPower / totalWeight;
};

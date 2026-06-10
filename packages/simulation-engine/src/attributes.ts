import type { Buff, BuffEffects, CharacterAttributes } from './types.js';

interface BuffEffectSource {
  BuffEffects: BuffEffects;
}

export const sumBuffEffects = (effectsList: readonly BuffEffects[]): BuffEffects => {
  const totals: BuffEffects = {};
  for (const effects of effectsList) {
    for (const [key, value] of Object.entries(effects) as [keyof BuffEffects, number | undefined][]) {
      if (value !== undefined) {
        totals[key] = (totals[key] ?? 0) + value;
      }
    }
  }
  return totals;
};

export const sumBuffEffectsFromBuffs = (
  buffs: readonly Buff[],
  buffValues: Record<string, number> = {}
): BuffEffects => {
  const totals: BuffEffects = {};
  for (const buff of buffs) {
    const overrideValue = buffValues[buff.BuffID];
    for (const [key, value] of Object.entries(buff.BuffEffects) as [keyof BuffEffects, number | undefined][]) {
      if (value !== undefined) {
        totals[key] = (totals[key] ?? 0) + (overrideValue !== undefined ? overrideValue : value);
      }
    }
  }
  return totals;
};

export const resolveEffectiveCharacterAttributes = (
  base: CharacterAttributes,
  totals: BuffEffects
): CharacterAttributes => ({
  CharacterMinAttack:
    base.CharacterMinAttack +
    resolvePercentBonus(base.CharacterMinAttack, totals.BuffAttackPercentEffect, base.CharacterOnePercentAttack) +
    (totals.BuffAttackFixedEffect ?? 0),
  CharacterMaxAttack:
    base.CharacterMaxAttack +
    resolvePercentBonus(base.CharacterMaxAttack, totals.BuffAttackPercentEffect, base.CharacterOnePercentAttack) +
    (totals.BuffAttackFixedEffect ?? 0),
  CharacterDefense:
    base.CharacterDefense +
    resolvePercentBonus(base.CharacterDefense, totals.BuffDefensePercentEffect, base.CharacterOnePercentDefense) +
    (totals.BuffDefenseFixedEffect ?? 0),
  CharacterHealth:
    base.CharacterHealth +
    resolvePercentBonus(base.CharacterHealth, totals.BuffHealthPercentEffect, base.CharacterOnePercentHealth) +
    (totals.BuffHealthFixedEffect ?? 0),
  CharacterMana:
    base.CharacterMana +
    resolvePercentBonus(base.CharacterMana, totals.BuffManaPercentEffect, base.CharacterOnePercentMana) +
    (totals.BuffManaFixedEffect ?? 0),
  CharacterCriticalHitDamagePercent:
    base.CharacterCriticalHitDamagePercent + (totals.BuffCriticalDamagePercentEffect ?? 0),
  CharacterCriticalHitRatePercent:
    (base.CharacterCriticalHitRatePercent ?? 0) + (totals.BuffCriticalHitRatePercentEffect ?? 0),
  CharacterMonsterDamageIncreasePercent:
    base.CharacterMonsterDamageIncreasePercent + (totals.BuffMonsterDamageIncreaseEffect ?? 0),
  CharacterOnePercentAttack: base.CharacterOnePercentAttack,
  CharacterOnePercentDefense: base.CharacterOnePercentDefense,
  CharacterOnePercentHealth: base.CharacterOnePercentHealth,
  CharacterOnePercentMana: base.CharacterOnePercentMana
});

export const resolveEffectiveCharacterAttributesFromEffects = (
  base: CharacterAttributes,
  activeEffects: readonly BuffEffectSource[] = []
): CharacterAttributes => resolveEffectiveCharacterAttributes(base, sumBuffEffects(activeEffects.map(effect => effect.BuffEffects)));

export const resolveEffectiveCharacterAttributesFromBuffs = (
  base: CharacterAttributes,
  buffs: readonly Buff[],
  buffValues: Record<string, number> = {}
): CharacterAttributes => resolveEffectiveCharacterAttributes(base, sumBuffEffectsFromBuffs(buffs, buffValues));

const resolvePercentBonus = (
  baseValue: number,
  percent: number | undefined,
  onePercentValue: number | undefined
): number => {
  const pct = percent ?? 0;
  if (onePercentValue !== undefined && onePercentValue > 0) {
    return pct * onePercentValue;
  }
  return baseValue * (pct / 100);
};

import type { BuffEffects, CharacterAttributes } from './types.js';

export const CHARACTER_ATTRIBUTE_KEYS = [
  'CharacterMinAttack',
  'CharacterMaxAttack',
  'CharacterDefense',
  'CharacterHealth',
  'CharacterMana',
  'CharacterCriticalHitDamagePercent',
  'CharacterCriticalHitRatePercent',
  'CharacterMonsterDamageIncreasePercent',
  'CharacterOnePercentAttack',
  'CharacterOnePercentDefense',
  'CharacterOnePercentHealth',
  'CharacterOnePercentMana'
] as const satisfies readonly (keyof CharacterAttributes)[];

export const BUFF_EFFECT_KEYS = [
  'BuffAttackPercentEffect',
  'BuffAttackFixedEffect',
  'BuffDefensePercentEffect',
  'BuffDefenseFixedEffect',
  'BuffHealthPercentEffect',
  'BuffHealthFixedEffect',
  'BuffManaPercentEffect',
  'BuffManaFixedEffect',
  'BuffCriticalDamagePercentEffect',
  'BuffCriticalHitRatePercentEffect',
  'BuffFocusPercentEffect',
  'BuffMonsterDamageIncreaseEffect',
  'BuffHolyWrathPercentEffect',
  'BuffMonsterCriticalDamagePercentEffect',
  'BuffMonsterHarmedPercentEffect',
  'BuffMonsterCritRateIncreaseEffect',
  'BuffSpeedPercentEffect'
] as const satisfies readonly (keyof BuffEffects)[];

const CHARACTER_ATTRIBUTE_KEY_SET = new Set<string>(CHARACTER_ATTRIBUTE_KEYS);
const BUFF_EFFECT_KEY_SET = new Set<string>(BUFF_EFFECT_KEYS);

export const isCharacterAttributeKey = (value: unknown): value is keyof CharacterAttributes => {
  return typeof value === 'string' && CHARACTER_ATTRIBUTE_KEY_SET.has(value);
};

export const isBuffEffectKey = (value: unknown): value is keyof BuffEffects => {
  return typeof value === 'string' && BUFF_EFFECT_KEY_SET.has(value);
};

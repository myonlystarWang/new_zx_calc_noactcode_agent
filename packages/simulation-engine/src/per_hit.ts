import type { SkillBonusAttributes } from './types.js';

/**
 * 多段技能「每段显式数值」支持。
 *
 * 语义：SkillBonusAttributes 的数值字段可以是标量（每段同值），也可以是数组
 * （第 k 段取 arr[k-1]）。用于表达"每段数值不同且非等差"的技能，例如：
 *   铁马冰河II 4 段附加攻击比 30/50/70/110
 *   皓凝霜雪III 4 段附加攻击比 585/465/385/325
 *   穿林打叶 6 段附加攻击比 104/114/124/124/124/124
 *
 * 两条计算路径（单次计算 calculateDamage / 战斗模拟 combat_loop）在算术之前
 * 统一调用 resolvePerHitFieldsInPlace，把数组解析成本段标量，因此下游公式完全不需要
 * 感知数组——现有全是标量的数据行为逐位不变。
 *
 * Grant / 峰值变体合并则走 addPerHitField：标量广播到每一段、数组逐段相加。
 */

/** 允许"每段取值"的数值字段 */
export type PerHitField =
  | 'SkillAttackPercentBonus'
  | 'SkillAttackFixedBonus'
  | 'SkillDefensePercentBonus'
  | 'SkillHealthPercentBonus'
  | 'SkillManaPercentBonus'
  | 'SkillCriticalDamagePercentBonus'
  | 'SkillDamageBonus';

/** 全部每段字段（顺序与 SkillBonusAttributes 声明一致，便于阅读） */
export const PER_HIT_FIELDS: PerHitField[] = [
  'SkillAttackPercentBonus',
  'SkillAttackFixedBonus',
  'SkillDefensePercentBonus',
  'SkillHealthPercentBonus',
  'SkillManaPercentBonus',
  'SkillCriticalDamagePercentBonus',
  'SkillDamageBonus'
];

/** 单字段取值形态 */
export type PerHitValue = number | number[] | undefined;

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 该字段是否写成了数组（即"每段不同值"） */
export const isPerHitArray = (value: PerHitValue): value is number[] => Array.isArray(value);

/**
 * 取第 hitIndex（1-indexed）段应使用的标量值。
 * - 数组：取 arr[hitIndex-1]；越界回退末段（validator 已保证长度与 HitCount 一致，此处仅容错）
 * - 标量：原样返回（语义=每段同值）
 * - undefined / 非有限数：返回 undefined
 */
export function pickPerHit(value: PerHitValue, hitIndex: number): number | undefined {
  if (Array.isArray(value)) {
    if (value.length === 0) return undefined;
    const raw = Number.isFinite(hitIndex) ? Math.floor(hitIndex) : 1;
    const idx = Math.min(Math.max(raw - 1, 0), value.length - 1);
    const picked = value[idx];
    return isFiniteNumber(picked) ? picked : undefined;
  }
  return isFiniteNumber(value) ? value : undefined;
}

/**
 * 把属性里的数组型字段就地解析成"本段标量"。
 * 只改写传入对象（调用方传的是副本），不触碰原始技能数据里的数组。
 */
export function resolvePerHitFieldsInPlace(
  attrs: SkillBonusAttributes | undefined,
  hitIndex: number
): void {
  if (!attrs) return;
  const rec = attrs as unknown as Record<string, PerHitValue>;
  for (const field of PER_HIT_FIELDS) {
    const value = rec[field];
    if (!Array.isArray(value)) continue;
    const picked = pickPerHit(value, hitIndex);
    rec[field] = picked === undefined ? 0 : picked;
  }
}

/**
 * 有序相加（Grant 叠加 / 峰值变体增量合并用），就地写回 attrs[field]：
 * - number  + number   → 直接相加
 * - number[]+ number   → 每一段都加该标量（即"对每段 +X"，如岁寒II 给铁马冰河II 每段 +10 气血）
 * - number  + number[] → 目标原为标量，视为"每段同值"，逐段加 inc 数组
 * - number[]+ number[] → 逐段相加；长度不等时按 0 补齐并告警
 *
 * @param context 仅用于告警信息（如来源技能 ID）
 */
export function addPerHitField(
  attrs: SkillBonusAttributes,
  field: PerHitField,
  inc: PerHitValue,
  context?: string
): void {
  const rec = attrs as unknown as Record<string, PerHitValue>;
  const current = rec[field];
  const curArr = Array.isArray(current) ? current : undefined;
  const incArr = Array.isArray(inc) ? inc : undefined;

  // 1) 双向标量
  if (!curArr && !incArr) {
    const base = isFiniteNumber(current) ? current : 0;
    const add = isFiniteNumber(inc) ? inc : 0;
    rec[field] = base + add;
    return;
  }

  // 2) 数组 + 标量 → 每段加该标量
  if (curArr && !incArr) {
    const add = isFiniteNumber(inc) ? inc : 0;
    rec[field] = curArr.map((v) => (isFiniteNumber(v) ? v : 0) + add);
    return;
  }

  // 3) 标量 + 数组 → 标量视为每段同值，逐段加
  if (!curArr && incArr) {
    const base = isFiniteNumber(current) ? current : 0;
    rec[field] = incArr.map((v) => base + (isFiniteNumber(v) ? v : 0));
    return;
  }

  // 4) 数组 + 数组 → 逐段相加
  const a = curArr as number[];
  const b = incArr as number[];
  if (a.length !== b.length) {
    console.warn(
      `[per_hit] ${field} 数组长度不一致（目标 ${a.length} vs 增量 ${b.length}），按 0 补齐${
        context ? ` @ ${context}` : ''
      }`
    );
  }
  const len = Math.max(a.length, b.length);
  rec[field] = Array.from({ length: len }, (_, i) => {
    const x = isFiniteNumber(a[i]) ? a[i] : 0;
    const y = isFiniteNumber(b[i]) ? b[i] : 0;
    return x + y;
  });
}

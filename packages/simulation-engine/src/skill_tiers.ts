import type { Skill } from './types.js';
import { applyOverrideCover } from './fourth_gen.js';

/**
 * 技能自身档次（三代技能 1/2/3 级）解析与套用。
 *
 * 与四代/造化（独立被动条目 Grants/Presets 作用他技）不同，三代档次是**伤害技能自身**的属性，
 * 按所选等级用"覆盖"语义套到技能本体 SkillBonusAttributes / 顶层字段。
 *
 * 次序约定（与单次/模拟两条路径一致）：三代本体档位 → 四代/造化 Grants（加法叠加在已定档位基线之上）。
 */

/**
 * 解析技能应选用的档位等级：
 * 1. forcePeak=true（单次计算"理论峰值"路径）→ 直接取 SkillTiers 最高键，忽略一切显式等级；
 * 2. 显式 selected 命中 SkillTiers → 用 selected；
 * 3. 否则若技能自身 SkillLevel（来自 profile 覆盖通道）命中 → 用 SkillLevel；
 * 4. 否则取 SkillTiers 最高键（峰值）。
 * 无 SkillTiers → 返回 undefined（调用方按原样处理）。
 */
export function resolveSkillTierLevel(skill: Skill, selected?: number, forcePeak = false): number | undefined {
  const tiers = skill.SkillTiers;
  if (!tiers || Object.keys(tiers).length === 0) return undefined;
  if (!forcePeak) {
    if (typeof selected === 'number' && tiers[selected]) return selected;
    if (typeof skill.SkillLevel === 'number' && tiers[skill.SkillLevel]) return skill.SkillLevel;
  }
  const keys = Object.keys(tiers).map(Number).filter((n) => Number.isFinite(n));
  if (keys.length === 0) return undefined;
  return Math.max(...keys);
}

/**
 * 把选定档位覆盖到技能本体（覆盖语义）。无档位则原样返回。
 * @param forcePeak 单次计算路径传 true → 恒取最高档（峰值）
 */
export function applySelectedSkillTier(skill: Skill, selected?: number, forcePeak = false): void {
  const level = resolveSkillTierLevel(skill, selected, forcePeak);
  if (level === undefined) return;
  const tier = skill.SkillTiers?.[level];
  if (!tier) return;
  applyOverrideCover(skill, tier);
}

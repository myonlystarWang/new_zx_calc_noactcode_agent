import type { Skill } from './types.js';

/**
 * 逐霜（流波惊变技改）专属规则：龙怒叠层附加、鹰扬折冲等级、苍龙啸刷新判定。
 * 同时供战斗模拟（combat_loop）与单次满配计算（single_calc）复用，保证两条路径同一事实源。
 */

/** 仙·苍龙啸（普通）技能ID——命中后 30% 概率刷新鹰扬折冲的判定对象 */
export const isXianCangLongXiaoSkill = (skillId: string): boolean =>
  skillId === 'ZS_XIAN_SKILL_CLX';

/** 普通鹰扬折冲满级 9，法宝+1 可到 10（经 PlayerSkillOverride.SkillLevel 传入）；战斗模拟缺省按 9 级。 */
export const ZS_LONGNU_DEFAULT_YYZC_LEVEL = 9;

/** 单次"满配/峰值"路径固定按法宝+1 的 10 级鹰扬取龙怒峰值。 */
export const ZS_LONGNU_PEAK_YYZC_LEVEL = 10;

/** 读取普通鹰扬折冲等级（玄/煞不决定等级），缺失或非法时回落到默认 9 级。 */
export const getZhuShuangYyzcLevel = (skills: Record<string, Skill>): number => {
  const yyzc = skills['ZS_XIAN_SKILL_YYZC'] ?? skills['ZS_MO_SKILL_YYZC'];
  const level = yyzc?.SkillLevel;
  return typeof level === 'number' && level > 0 ? level : ZS_LONGNU_DEFAULT_YYZC_LEVEL;
};

/**
 * 龙怒每段附加攻击比（%）：
 * 仙（苍龙啸 / 苍龙啸·玄）= 20%*等级 + 100（怒龙吞海II 满级固定）；
 * 魔（苍龙啸 / 煞）、佛（禅）= 20%*等级。
 */
export const getZhuShuangLongNuBonus = (skillId: string, yyzcLevel: number): number => {
  const perLevelBonus = 20 * yyzcLevel;
  const isXianCangLong = skillId === 'ZS_XIAN_SKILL_CLX' || skillId === 'ZS_XIAN_SKILL_CLXX';
  return isXianCangLong ? perLevelBonus + 100 : perLevelBonus;
};

/** 需要在单次满配路径生成"·龙怒"峰值变体的逐霜苍龙技能ID。 */
export const ZS_LONGNU_PEAK_SKILL_IDS: ReadonlyArray<string> = [
  'ZS_XIAN_SKILL_CLX',
  'ZS_XIAN_SKILL_CLXX',
  'ZS_MO_SKILL_CLX',
  'ZS_MO_SKILL_CLXS',
  'ZS_FO_SKILL_CLXC'
];

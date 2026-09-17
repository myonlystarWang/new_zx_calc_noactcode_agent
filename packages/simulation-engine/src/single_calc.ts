import type { Skill, SkillBonusAttributes, FourthGenGrant } from './types.js';
import { applyOverrideAdditive, applyOverrideCover, applyGrantToTargets } from './fourth_gen.js';
import {
  getZhuShuangLongNuBonus,
  ZS_LONGNU_PEAK_YYZC_LEVEL,
  ZS_LONGNU_PEAK_SKILL_IDS
} from './zhu_shuang.js';

/**
 * 单次计算路径（网页"属性/战力计算器"、agent_tool 单次 CLI）专用的技能装配。
 * 与战斗模拟路径的区别：不跑时间轴、不做 3玄烛1赤乌 的佩戴槽位校验，
 * 而是按"理论满配"——所有四代均以最高品质（曦日）生效——给出每个输出技能能达到的静态峰值，
 * 并为登记的技能额外生成"战斗满状态峰值变体"（如苍龙啸·龙怒）。
 */

/** 一个职业按阵营分组的技能表，键为 XIAN / FO / MO / COMMON（COMMON 为三阵营通用四代） */
export type ClassFactionSkills = Record<string, Skill[] | undefined>;

/** 单次满配统一取曦日（最高品质） */
const PEAK_QUALITY = 'XI_RI' as const;

const cloneSkill = (skill: Skill): Skill => JSON.parse(JSON.stringify(skill)) as Skill;

/**
 * 峰值变体规则表：登记"哪些源技能要额外生成一个满状态变体"，以及叠加什么增量。
 * 四代满配（Grants/Presets）是全职业通用的，无需登记；只有"依赖战斗过程的满状态"
 * （如逐霜龙怒：命中耗层、按鹰扬等级逐段附加）无法靠四代静态表达，才在此登记。
 * 后续其他职业有同类机制时，往这里加一条规则即可，引擎其余部分保持通用。
 */
interface PeakVariantRule {
  match: (skillId: string) => boolean;
  /** 变体名后缀 */
  suffix: string;
  /** 在本体（已含四代满配）基础上按"相加"叠加的 SkillBonusAttributes 增量 */
  buildIncrement: (source: Skill) => Partial<SkillBonusAttributes>;
  /** 变体标记，写入 Skill.Variant，便于识别与测试 */
  variantTag: string;
}

const PEAK_VARIANT_RULES: PeakVariantRule[] = [
  {
    variantTag: 'LONGNU',
    suffix: '·龙怒',
    match: (id) => (ZS_LONGNU_PEAK_SKILL_IDS as ReadonlyArray<string>).includes(id),
    // 龙怒按法宝+1 的 10 级鹰扬、满层（9 段全附加）取峰值：仙 +300、魔/佛 +200
    buildIncrement: (source) => ({
      SkillAttackPercentBonus: getZhuShuangLongNuBonus(source.SkillID, ZS_LONGNU_PEAK_YYZC_LEVEL)
    })
  }
];

/** 判断是否为直接输出技能（与单次/模拟一致：无 ActionType 或 DAMAGE；四代/造化被动不计入） */
const isDamageSkill = (skill: Skill): boolean =>
  !skill.ActionType || skill.ActionType === 'DAMAGE';

/**
 * 把技能池内全部四代被动按曦日"理论满配"应用到技能映射：
 * 作用本技能走 Presets（覆盖）、作用其他技能走 Grants（数值相加）。
 * 不做佩戴槽位校验——单次是逐技能取理论最高值，不同技能的最优四代本就不必是同一组佩戴。
 */
const applyPeakFourthGen = (skillMap: Record<string, Skill>, pool: Skill[]): void => {
  for (const fg of pool) {
    if (fg.ActionType !== 'FOURTH_GEN_PASSIVE' || !fg.FourthGenSlot) continue;
    const fgInMap = skillMap[fg.SkillID];
    if (!fgInMap) continue;

    const selfPreset = fgInMap.FourthGenPresets?.[PEAK_QUALITY];
    if (selfPreset) applyOverrideCover(fgInMap, selfPreset);

    const grants = fgInMap.FourthGenGrants?.[PEAK_QUALITY];
    if (grants) {
      for (const grant of grants) {
        for (const targetId of grant.TargetSkillIds) {
          const target = skillMap[targetId];
          // COMMON 四代一次性列出三阵营目标，当前阵营缺失属预期，静默跳过
          if (!target) continue;
          applyOverrideAdditive(target, grant.Override);
        }
      }
    }
  }

  // 造化技能被动（带 II 的造化技能）：常驻生效，无品质分级，直接按 FourthGenGrant 加法叠加到目标技能。
  // 两趟：绝对覆盖类（如玄烛把九刃齐歌 CD 覆盖为 32）先于冷却减少类（CooldownReduction）执行，保证叠加顺序无关。
  const zaoGrants: FourthGenGrant[] = [];
  for (const skill of pool) {
    if (skill.ZaoHuaGrants && skill.ZaoHuaGrants.length > 0) zaoGrants.push(...skill.ZaoHuaGrants);
  }
  for (const grant of zaoGrants) {
    if (grant.Override && grant.Override.CooldownReduction != null) continue;
    applyGrantToTargets(skillMap, grant);
  }
  for (const grant of zaoGrants) {
    if (!grant.Override || grant.Override.CooldownReduction == null) continue;
    applyGrantToTargets(skillMap, grant);
  }
};

/** 基于本体（已含四代满配）克隆一个峰值变体，并把规则增量按"相加"叠上去 */
const buildPeakVariant = (source: Skill, rule: PeakVariantRule): Skill => {
  const variant = cloneSkill(source);
  variant.SkillID = `${source.SkillID}__PEAK_${rule.variantTag}`;
  variant.SkillName = `${source.SkillName}${rule.suffix}`;
  variant.Variant = rule.variantTag;

  const increment = rule.buildIncrement(source);
  const merged = { ...(variant.SkillBonusAttributes ?? {}) } as Record<string, number>;
  for (const [key, value] of Object.entries(increment)) {
    if (typeof value !== 'number') continue;
    merged[key] = (typeof merged[key] === 'number' ? merged[key] : 0) + value;
  }
  variant.SkillBonusAttributes = merged as SkillBonusAttributes;
  return variant;
};

/**
 * 构建单次计算路径使用的输出技能列表：
 * 1. 合并本阵营 + COMMON 通用技能，深拷贝后应用四代曦日满配；
 * 2. 只保留本阵营直接输出技能（其数值已含四代 Grants/Presets）；
 * 3. 每个登记了峰值变体规则的本体后面，紧跟其"满状态峰值变体"（如苍龙啸·龙怒）。
 *
 * @param classFactionSkills 某职业的全阵营技能表（DataService.getSkills(classId) 或 data.skills[classId]）
 * @param faction 当前阵营 XIAN / FO / MO
 */
export const buildSingleCalcSkills = (
  classFactionSkills: ClassFactionSkills | null | undefined,
  faction: string
): Skill[] => {
  if (!classFactionSkills) return [];
  const own = classFactionSkills[faction] ?? [];
  const common = classFactionSkills['COMMON'] ?? [];
  const pool = [...own, ...common];
  if (own.length === 0) return [];

  const skillMap: Record<string, Skill> = {};
  for (const item of pool) skillMap[item.SkillID] = cloneSkill(item);

  applyPeakFourthGen(skillMap, pool);

  const result: Skill[] = [];
  for (const raw of own) {
    const full = skillMap[raw.SkillID];
    if (!full || !isDamageSkill(full)) continue;
    result.push(full);

    const rule = PEAK_VARIANT_RULES.find((r) => r.match(full.SkillID));
    if (rule) result.push(buildPeakVariant(full, rule));
  }
  return result;
};

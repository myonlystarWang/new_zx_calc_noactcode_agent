import { calculateDamage } from './calculator.js';
import { loadGameData } from './data.js';
import { normalizeRequest } from './normalize.js';
import type { AgentCalcInput, AttributeCapsConfig, DamageResult, Skill } from './types.js';

const round = (value: number): number => Math.round(value);

const formatWanYi = (value: number): string => {
  if (value >= 100000000) return `${(value / 100000000).toFixed(3)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(3)}万`;
  return `${Math.round(value)}`;
};

const serializeDamage = (skill: Skill, damage: DamageResult) => ({
  skillId: skill.SkillID,
  skillName: skill.SkillName,
  minBaseDamage: round(damage.minBaseDamage),
  maxBaseDamage: round(damage.maxBaseDamage),
  minFinalDamage: round(damage.minFinalDamage),
  maxFinalDamage: round(damage.maxFinalDamage),
  avgFinalDamage: round(damage.avgFinalDamage),
  hits: damage.hits?.map((hit) => ({
    hitIndex: hit.hitIndex,
    minFinalDamage: round(hit.minFinalDamage),
    maxFinalDamage: round(hit.maxFinalDamage),
    avgFinalDamage: round(hit.avgFinalDamage)
  }))
});

export const calculateFromInput = async (input: AgentCalcInput) => {
  const data = await loadGameData();
  const normalized = normalizeRequest(input, data);
  if ('issues' in normalized) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        issues: normalized.issues
      }
    };
  }

  // 按职业差异化的属性上限：DEFAULT < 职业(classInfo) < profile.attributeCaps
  const effectiveCaps: AttributeCapsConfig = {
    EnableCaps: true,
    ...(normalized.classInfo?.CapHealth != null ? { CapHealth: normalized.classInfo.CapHealth } : {}),
    ...(normalized.classInfo?.CapMana != null ? { CapMana: normalized.classInfo.CapMana } : {}),
    ...(normalized.attributeCaps || {}),
  };

  // 过滤直伤技能：排除辅助/状态技能（BUFF/UTILITY/DEBUFF），避免产生无伤害技能的普攻伪伤害
  const damageSkills = normalized.skills.filter(
    (skill) => !skill.ActionType || skill.ActionType === 'DAMAGE'
  );

  const bossResults = normalized.selectedMonsters.map((monster) => {
    const skills = damageSkills.map((skill) => {
      const damage = calculateDamage(
        normalized.attributes,
        skill,
        monster,
        normalized.activeBuffs,
        normalized.buffValues,
        effectiveCaps
      );
      return serializeDamage(skill, damage);
    });

    return {
      bossId: monster.MonsterID,
      bossName: monster.MonsterName,
      dungeonLevel: monster.DungeonLevel,
      monsterAttributeModifiers: monster.MonsterAttributeModifiers,
      skills
    };
  });

  const firstBoss = bossResults[0];
  const summaryLines = firstBoss
    ? firstBoss.skills.map((skill) => `${skill.skillName}: 平均 ${formatWanYi(skill.avgFinalDamage)}`)
    : [];

  return {
    ok: true,
    resolved: {
      classId: normalized.classInfo.ClassID,
      className: normalized.classInfo.ClassName,
      faction: normalized.faction,
      factionName: normalized.factionName,
      dungeonId: normalized.dungeon.DungeonID,
      dungeonName: normalized.dungeon.DungeonName,
      attributes: normalized.attributes,
      activeBuffs: normalized.activeBuffs.map((buff) => ({
        buffId: buff.BuffID,
        buffName: buff.BuffName,
        value: normalized.buffValues[buff.BuffID]
      }))
    },
    bosses: bossResults,
    wechatSummary: firstBoss
      ? `${normalized.classInfo.ClassName}/${normalized.factionName}/${normalized.dungeon.DungeonName}/${firstBoss.bossName}，各技能平均伤害如下：\n${summaryLines.join('\n')}`
      : `${normalized.classInfo.ClassName}/${normalized.factionName}/${normalized.dungeon.DungeonName} 没有匹配到 boss。`
  };
};

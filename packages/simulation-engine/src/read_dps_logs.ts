import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assembleScenario } from './scenario_assembler.js';
import { runSimulation } from './combat_loop.js';
import type { AllSkills, Monster, AssembleScenarioInput } from './types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const gameDataDir = resolve(currentDir, '..', '..', '..', 'web_app', 'public', 'game_data');

const loadJson = (filename: string) => {
  const text = readFileSync(resolve(gameDataDir, filename), 'utf8');
  return JSON.parse(text);
};

const skillsData = loadJson('skills.json') as any;
const gameData = {
  skills: skillsData as AllSkills,
  monstersByDungeon: loadJson('dungeons_monsters.json') as Record<string, Monster[]>
};
const meta = skillsData._meta;

const moRecommendedSkillIds = [
  'ZS_MO_SKILL_ZGDD',
  'ZS_MO_SKILL_QXHS',
  'ZS_MO_SKILL_LZYY',
  'ZS_MO_SKILL_SY2',
  'ZS_MO_SKILL_SY3',
  'ZS_MO_SKILL_CLX',
  'ZS_MO_SKILL_YYZC',
  'ZS_MO_SKILL_CLXS',
  'ZS_MO_SKILL_YLXB',
  'ZS_MO_SKILL_YYZC_SHA',
  'ZS_MO_SKILL_LYLZ'
] as const;

const dpsSkillOverrides = Object.fromEntries(
  moRecommendedSkillIds.map(skillId => [skillId, { FourthGenQuality: 'XI_RI' as const }])
);

const dpsAttributes = meta.defaultDpsAttributes;

const supportAttributes = meta.defaultSupportAttributes;

const input: AssembleScenarioInput = {
  scenarioId: 'real-6person-zhushuang',
  maxTimeMs: 300000,
  dungeonId: 'ZHENHAI_DUANLANG_T20',
  bossId: 'CHI_SUO_T20',
  randomSeed: 20260609,
  damageAudit: {
    enabled: true,
    actorId: 'zhushuang_dps',
    maxRecords: 600
  },
  dpsActor: {
    actorId: 'zhushuang_dps',
    classId: 'ZHU_SHUANG',
    faction: 'MO',
    profileAttributes: dpsAttributes,
    skillOverrides: dpsSkillOverrides,
    strategy: {
      type: 'SKILL_BAR' as const,
      skillIds: [...moRecommendedSkillIds],
      startTimeMs: meta.dpsStartDelayMs,
      scanMode: 'FROM_FIRST_EACH_DECISION' as const,
      skillExpiryMs: {
        ZS_MO_SKILL_ZGDD: 0,
        ZS_MO_SKILL_QXHS: 16000
      }
    }
  },
  dpsCommonEffects: {
    sanwanFocus: true
  },
  dungeonEffects: {
    greenPoint150: true
  },
  supports: [
    { actorId: 'tianyin_sup', classId: 'TIAN_YIN', faction: 'FO', profileAttributes: supportAttributes, skillOverrides: meta.supportOverrides?.tianyin_sup },
    { actorId: 'fenxiang_sup', classId: 'FEN_XIANG', faction: 'FO', profileAttributes: supportAttributes, skillOverrides: meta.supportOverrides?.fenxiang_sup },
    { actorId: 'zhaoming_sup', classId: 'ZHAO_MING', faction: 'FO', profileAttributes: supportAttributes, skillOverrides: meta.supportOverrides?.zhaoming_sup },
    { actorId: 'yingzhao_sup', classId: 'YING_ZHAO', faction: 'FO', profileAttributes: supportAttributes, skillOverrides: meta.supportOverrides?.yingzhao_sup },
    { actorId: 'tianhua_sup', classId: 'TIAN_HUA', faction: 'FO', profileAttributes: supportAttributes, skillOverrides: meta.supportOverrides?.tianhua_sup }
  ]
};

const scenario = assembleScenario(input, gameData);
const result = runSimulation(scenario);

console.log('=== Detailed Hit Records ===');
for (const hit of result.hitRecords.slice(0, 15)) {
  console.log(`[${hit.TimeMs}ms] ${hit.SkillName} hit ${hit.HitIndex}/${hit.HitCount} done:`);
  console.log(`  Damage: ${hit.DamageApplied.toLocaleString()} (AvgRaw: ${hit.RawAvgDamage.toLocaleString()})`);
  console.log(`  Active Buffs: ${hit.ActiveEffectIds.join(', ')}`);
}

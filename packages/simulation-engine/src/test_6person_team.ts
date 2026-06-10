import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { assembleScenario } from './scenario_assembler.js';
import { runSimulation } from './combat_loop.js';
import type {
  AllSkills,
  AssembleScenarioGameData,
  AssembleScenarioInput,
  CharacterAttributes,
  Monster
} from './types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const gameDataDir = resolve(currentDir, '..', '..', '..', 'web_app', 'public', 'game_data');
const disabledSupportSkillIds = new Set([
  'TY_FO_SKILL_DCB',
  'TY_FO_SKILL_MKXJ',
  'ZM_FO_SKILL_FGSL',
  'YZ_FO_SKILL_TGFM',
  'YZ_FO_SKILL_WXBG',
  'TH_FO_SKILL_MQYY',
  'TH_FO_SKILL_YSYY2',
  'TH_FO_SKILL_JLS',
  'TH_FO_SKILL_FQH'
]);

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

const loadJson = <T>(filename: string): T => {
  const text = readFileSync(resolve(gameDataDir, filename), 'utf8');
  return JSON.parse(text) as T;
};

const main = () => {
  console.log('=== 启动 6人真实团队仿真 ===');

  const defaultOverrides = loadJson<any>('default_overrides.json');

  // 1. 加载真实游戏数据
  const gameData: AssembleScenarioGameData = {
    skills: loadJson<AllSkills>('skills.json'),
    monstersByDungeon: loadJson<Record<string, Monster[]>>('dungeons_monsters.json')
  };

  // 2. 玩家属性配置
  const dpsAttributes: CharacterAttributes = defaultOverrides.dpsAttributes;

  const supportAttributes: CharacterAttributes = {
    CharacterMinAttack: 200000,
    CharacterMaxAttack: 220000,
    CharacterDefense: 300000,
    CharacterHealth: 3000000,
    CharacterMana: 4000000,
    CharacterCriticalHitDamagePercent: 800,
    CharacterMonsterDamageIncreasePercent: 25,
    CharacterOnePercentAttack: 1000,
    CharacterOnePercentDefense: 1500,
    CharacterOnePercentHealth: 20000,
    CharacterOnePercentMana: 30000
  };

  // 3. 构建装配输入
  const input: AssembleScenarioInput = {
    scenarioId: 'real-6person-zhushuang',
    maxTimeMs: 300000, // 300秒上限，默认团队应跑到击杀点
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
        type: 'SKILL_BAR',
        skillIds: [...moRecommendedSkillIds],
        startTimeMs: defaultOverrides.dpsStartDelayMs,
        scanMode: 'FROM_FIRST_EACH_DECISION',
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
      {
        actorId: 'tianyin_sup',
        classId: 'TIAN_YIN',
        faction: 'FO',
        profileAttributes: supportAttributes,
        skillOverrides: defaultOverrides.supportOverrides?.tianyin_sup
      },
      {
        actorId: 'fenxiang_sup',
        classId: 'FEN_XIANG',
        faction: 'FO',
        profileAttributes: supportAttributes,
        skillOverrides: defaultOverrides.supportOverrides?.fenxiang_sup
      },
      {
        actorId: 'zhaoming_sup',
        classId: 'ZHAO_MING',
        faction: 'FO',
        profileAttributes: supportAttributes,
        skillOverrides: defaultOverrides.supportOverrides?.zhaoming_sup
      },
      {
        actorId: 'yingzhao_sup',
        classId: 'YING_ZHAO',
        faction: 'FO',
        profileAttributes: supportAttributes,
        skillOverrides: defaultOverrides.supportOverrides?.yingzhao_sup
      },
      {
        actorId: 'tianhua_sup',
        classId: 'TIAN_HUA',
        faction: 'FO',
        profileAttributes: supportAttributes,
        skillOverrides: defaultOverrides.supportOverrides?.tianhua_sup
      }
    ]
  };

  // 4. 装配场景
  const scenario = assembleScenario(input, gameData);
  console.log(`- 成功装配场景: ${scenario.scenarioId}`);
  console.log(`- 参与模拟 Actor 数量: ${scenario.actors.length}`);
  console.log(`- Boss 目标: ${scenario.boss.MonsterName} (HP: ${scenario.boss.MonsterAttributeModifiers.MonsterHealth})`);
  const loadedDisabledSkills = scenario.actors.flatMap(actor =>
    actor.baseSkills.filter(skill => disabledSupportSkillIds.has(skill.SkillID)).map(skill => skill.SkillID)
  );
  assert.deepEqual(loadedDisabledSkills, [], '当前阶段暂禁用辅助技能不应进入默认团队仿真。');

  // 5. 运行模拟
  const result = runSimulation(scenario);

  // 6. 输出分析报告
  console.log('\n=== 仿真计算结果汇总 ===');
  console.log(`总输出伤害: ${result.summary.TotalDamage.toLocaleString()} (单次平均: ${Math.round(result.summary.AverageDps).toLocaleString()} DPS)`);
  console.log(`战斗时长: ${(result.summary.DpsDurationMs / 1000).toFixed(2)} 秒`);
  assert.ok(result.boss.killedAtMs !== undefined, '默认 6 人团队应在 300 秒内击杀 Boss。');
  console.log(`击杀时间: ${(result.boss.killedAtMs / 1000).toFixed(2)} 秒`);
  assert.ok((result.damageAuditRecords?.length ?? 0) > 0, '启用伤害审计时应输出逐段审计记录。');
  const firstAuditRecord = result.damageAuditRecords![0]!;
  assert.equal(firstAuditRecord.ActorId, 'zhushuang_dps');
  assert.ok(firstAuditRecord.EffectiveAttributes.CharacterMaxAttack <= 750000, '审计记录应包含 cap 后有效属性。');
  console.log(`审计记录: ${result.damageAuditRecords!.length} 条`);

  console.log('\n[技能占比详情]');
  result.summary.SkillBreakdown.forEach(item => {
    const share = ((item.TotalDamage / result.summary.TotalDamage) * 100).toFixed(2);
    console.log(`- ${item.SkillName} (${item.SkillId}): 释放 ${item.HitCount} 次, 伤害 ${item.TotalDamage.toLocaleString()} (${share}%)`);
  });
  const failedEvents = result.events.filter(e => e.status === 'FAILED');
  if (failedEvents.length > 0) {
    console.warn(`\n[警告] 发现 ${failedEvents.length} 个失败事件:`);
    failedEvents.slice(0, 5).forEach(e => {
      console.warn(`- [${e.timeMs}ms] ${e.type} (${e.skillId}): ${e.message}`);
    });
  } else {
    console.log('\n- 所有事件流水全部正常运行！ [SUCCESS]');
  }
};

main();

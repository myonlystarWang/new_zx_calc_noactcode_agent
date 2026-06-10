import assert from 'node:assert/strict';
import { assembleScenario } from './scenario_assembler.js';
import { runSimulation } from './combat_loop.js';
import { validateSkillsData } from './validator.js';
import type {
  AllSkills,
  AssembleScenarioGameData,
  AssembleScenarioInput,
  CharacterAttributes,
  Monster,
  Skill
} from './types.js';

const dpsAttributes: CharacterAttributes = {
  CharacterMinAttack: 100,
  CharacterMaxAttack: 100,
  CharacterDefense: 0,
  CharacterHealth: 1000,
  CharacterMana: 1000,
  CharacterCriticalHitDamagePercent: 100,
  CharacterMonsterDamageIncreasePercent: 0
};

const supportAttributes: CharacterAttributes = {
  ...dpsAttributes,
  CharacterMinAttack: 50,
  CharacterMaxAttack: 50
};

const damageSkill = (id: string, damage: number, cooldown = 1): Skill => ({
  SkillID: id,
  SkillName: id,
  RequiredClass: 'TEST_DPS',
  Faction: 'XIAN',
  SkillImportanceWeight: 1,
  SkillFrequency: 1,
  Cooldown: cooldown,
  CastTime: 0,
  IsAOE: false,
  ActionType: 'DAMAGE',
  SkillBonusAttributes: {
    SkillAttackPercentBonus: 0,
    SkillAttackFixedBonus: damage - 100,
    SkillDamageBonus: 1
  }
});

const teamBuffSkill: Skill = {
  SkillID: 'TEAM_ATTACK_BUFF',
  SkillName: '团队攻击增益',
  RequiredClass: 'TEST_SUPPORT',
  Faction: 'FO',
  SkillImportanceWeight: 0,
  SkillFrequency: 0,
  Cooldown: 30,
  CastTime: 0,
  IsAOE: false,
  ActionType: 'BUFF',
  SkillBonusAttributes: {
    SkillDamageBonus: 1
  },
  AppliesEffects: [
    {
      EffectId: 'TEAM_ATTACK_UP',
      EffectName: '团队攻击提升',
      Target: 'TEAM',
      Duration: 2,
      RefreshOnReapply: true,
      BuffEffects: {
        BuffAttackPercentEffect: 100
      }
    }
  ]
};

const allyDynamicBuffSkill: Skill = {
  SkillID: 'ALLY_DYNAMIC_HEALTH',
  SkillName: '队友动态气血',
  RequiredClass: 'TEST_SUPPORT',
  Faction: 'FO',
  SkillImportanceWeight: 0,
  SkillFrequency: 0,
  Cooldown: 30,
  CastTime: 0,
  IsAOE: false,
  ActionType: 'BUFF',
  SkillBonusAttributes: {
    SkillDamageBonus: 1
  },
  AppliesEffects: [
    {
      EffectId: 'ALLY_DYNAMIC_HEALTH_UP',
      EffectName: '队友动态气血提升',
      Target: 'ALLY',
      Duration: 10,
      RefreshOnReapply: true,
      BuffEffects: {
        BuffHealthFixedEffect: 1
      },
      DynamicScalingAttribute: 'CharacterMaxAttack',
      DynamicScalingMultiplier: 2,
      DynamicTargetField: 'BuffHealthFixedEffect'
    }
  ]
};

const supportDamageSkill: Skill = {
  ...damageSkill('SUPPORT_DAMAGE_SHOULD_NOT_LOAD', 999),
  RequiredClass: 'TEST_SUPPORT',
  Faction: 'FO',
  ActionType: 'DAMAGE'
};

const baseBoss: Monster = {
  MonsterID: 'ASSEMBLER_BOSS',
  MonsterName: '装配测试木桩',
  DungeonLevel: 1,
  MonsterAttributeModifiers: {
    MonsterCriticalDamagePercentReduction: 0,
    MonsterHealth: 5000
  }
};

const makeGameData = (): AssembleScenarioGameData => ({
  skills: {
    TEST_DPS: {
      XIAN: [
        damageSkill('DPS_HIT_A', 1000),
        damageSkill('DPS_HIT_B', 2000, 3)
      ],
      COMMON: [
        {
          ...damageSkill('DPS_COMMON_HIT', 500, 5),
          Faction: 'COMMON'
        }
      ]
    },
    TEST_SUPPORT: {
      FO: [
        teamBuffSkill,
        allyDynamicBuffSkill,
        supportDamageSkill
      ]
    }
  },
  monstersByDungeon: {
    TEST_DUNGEON_A: [baseBoss],
    TEST_DUNGEON_B: [
      {
        ...baseBoss,
        MonsterName: '同 ID 另一副本木桩'
      }
    ]
  }
});

const makeInput = (): AssembleScenarioInput => ({
  scenarioId: 'assembled-basic',
  maxTimeMs: 5000,
  dungeonId: 'TEST_DUNGEON_A',
  bossId: 'ASSEMBLER_BOSS',
  dpsActor: {
    actorId: 'dps',
    classId: 'TEST_DPS',
    faction: 'XIAN',
    profileAttributes: dpsAttributes,
    strategy: {
      type: 'FIXED_ROTATION',
      skillIds: ['DPS_HIT_A', 'DPS_HIT_B'],
      startTimeMs: 500
    }
  },
  supports: [
    {
      actorId: 'support',
      classId: 'TEST_SUPPORT',
      faction: 'FO',
      profileAttributes: supportAttributes
    }
  ],
  attributeCaps: {
    EnableCaps: true,
    CapAttack: 100000
  },
  dpsCommonEffects: {
    sanwanFocus: true
  },
  dungeonEffects: {
    greenPoint150: true
  }
});

const testAssembledScenarioRuns = () => {
  const gameData = makeGameData();
  const skillIssues = validateSkillsData(gameData.skills as AllSkills).filter(issue => issue.severity === 'ERROR');
  assert.equal(skillIssues.length, 0);

  const scenario = assembleScenario(makeInput(), gameData);

  assert.equal(scenario.scenarioId, 'assembled-basic');
  assert.equal(scenario.dpsActorId, 'dps');
  assert.equal(scenario.attributeCaps?.CapAttack, 100000);
  assert.equal(scenario.initialEffects?.length, 2);
  assert.equal(scenario.boss.MonsterName, '装配测试木桩');
  assert.equal(scenario.actors.length, 2);

  const dps = scenario.actors.find(actor => actor.actorId === 'dps');
  assert.ok(dps);
  assert.deepEqual(
    dps.baseSkills.map(skill => skill.SkillID),
    ['DPS_HIT_A', 'DPS_HIT_B', 'DPS_COMMON_HIT']
  );

  const support = scenario.actors.find(actor => actor.actorId === 'support');
  assert.ok(support);
  assert.equal(support.strategy?.type, 'CAST_ON_READY');
  assert.deepEqual(
    support.baseSkills.map(skill => skill.SkillID),
    ['TEAM_ATTACK_BUFF', 'ALLY_DYNAMIC_HEALTH']
  );
  assert.equal(support.baseSkills.some(skill => skill.SkillID === 'SUPPORT_DAMAGE_SHOULD_NOT_LOAD'), false);
  assert.equal(support.strategy.type === 'CAST_ON_READY' ? support.strategy.targetActorId : undefined, 'dps');

  const result = runSimulation(scenario);
  assert.ok(result.hitRecords.length > 0);
  assert.equal(result.events.some(event => event.status === 'FAILED'), false);
  assert.equal(
    result.events.find(event => event.type === 'CAST_START' && event.actorId === 'dps')?.timeMs,
    500
  );
  assert.equal(
    result.events.some(event => event.type === 'BUFF_APPLY' && event.skillId === 'COMMON_SKILL_SANWAN' && event.status === 'PROCESSED'),
    true
  );
  assert.equal(
    result.events.some(event => event.type === 'BUFF_APPLY' && event.skillId === 'DUNGEON_EFFECT_GREEN_150' && event.status === 'PROCESSED'),
    true
  );
};

const testBossAmbiguityRequiresDungeonId = () => {
  const input = makeInput();
  delete input.dungeonId;

  assert.throws(
    () => assembleScenario(input, makeGameData()),
    /exists in multiple dungeons/
  );
};

const testDungeonScopedBossResolution = () => {
  const input = makeInput();
  input.dungeonId = 'TEST_DUNGEON_B';
  const scenario = assembleScenario(input, makeGameData());
  assert.equal(scenario.boss.MonsterName, '同 ID 另一副本木桩');
};

const testDynamicSupportRequiresAttributes = () => {
  const input = makeInput();
  input.supports = [
    {
      actorId: 'support',
      classId: 'TEST_SUPPORT',
      faction: 'FO'
    }
  ];

  assert.throws(
    () => assembleScenario(input, makeGameData()),
    /requires profileAttributes/
  );
};

const testUnknownSkillFailsEarly = () => {
  const input = makeInput();
  input.dpsActor.strategy = {
    type: 'FIXED_ROTATION',
    skillIds: ['DPS_HIT_A', 'MISSING_SKILL']
  };

  assert.throws(
    () => assembleScenario(input, makeGameData()),
    /references unknown skill/
  );
};

const main = () => {
  console.log('=== 启动 Phase E 自动场景装配测试 ===');
  testAssembledScenarioRuns();
  console.log('- 组装 DPS、辅助、默认策略并运行模拟 [SUCCESS]');
  testBossAmbiguityRequiresDungeonId();
  console.log('- Boss 全局重名时要求 dungeonId 消歧 [SUCCESS]');
  testDungeonScopedBossResolution();
  console.log('- Boss 按 dungeonId 精确解析 [SUCCESS]');
  testDynamicSupportRequiresAttributes();
  console.log('- 动态缩放辅助缺少 profileAttributes 时提前失败 [SUCCESS]');
  testUnknownSkillFailsEarly();
  console.log('- 策略引用未知技能时提前失败 [SUCCESS]');
  console.log('=== Phase E 自动场景装配测试通过！ ===');
};

main();

import assert from 'node:assert/strict';
import { EffectManager } from './effects.js';
import { runSimulation } from './combat_loop.js';
import { calculateDamage } from './calculator.js';
import { Timeline } from './timeline.js';
import type {
  AppliedEffectConfig,
  CharacterAttributes,
  Monster,
  SimulationScenario,
  Skill
} from './types.js';

const baseAttributes: CharacterAttributes = {
  CharacterMinAttack: 100,
  CharacterMaxAttack: 100,
  CharacterDefense: 0,
  CharacterHealth: 1000,
  CharacterMana: 1000,
  CharacterCriticalHitDamagePercent: 100,
  CharacterMonsterDamageIncreasePercent: 0
};

const baseBoss = (health: number, compression = 0): Monster => ({
  MonsterID: `TEST_BOSS_${health}_${compression}`,
  MonsterName: '测试木桩',
  DungeonLevel: 1,
  MonsterAttributeModifiers: {
    MonsterCriticalDamagePercentReduction: 0,
    MonsterHealth: health,
    DamageCompressionPercent: compression
  }
});

const damageSkill = (id: string, damage = 100, cooldown = 0, castTime = 0): Skill => ({
  SkillID: id,
  SkillName: id,
  RequiredClass: 'TEST_DPS',
  Faction: 'COMMON',
  SkillImportanceWeight: 1,
  SkillFrequency: 1,
  Cooldown: cooldown,
  CastTime: castTime,
  IsAOE: false,
  ActionType: 'DAMAGE',
  SkillBonusAttributes: {
    SkillAttackPercentBonus: 0,
    SkillAttackFixedBonus: damage - 100,
    SkillDamageBonus: 1
  }
});

const multiHitSkill: Skill = {
  ...damageSkill('MULTI_HIT', 100, 10, 3),
  SkillBonusAttributes: {
    SkillAttackPercentBonus: 0,
    SkillDamageBonus: 1,
    MultiHitConfig: {
      HitCount: 9
    }
  },
  HitTiming: {
    Mode: 'EVENLY_DURING_CAST'
  }
};

const teamBuffSkill: Skill = {
  SkillID: 'TEAM_ATTACK_BUFF',
  SkillName: '团队攻击增益',
  RequiredClass: 'TEST_SUPPORT',
  Faction: 'COMMON',
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
      Duration: 1,
      RefreshOnReapply: true,
      BuffEffects: {
        BuffAttackPercentEffect: 100
      }
    }
  ]
};

const runManualBuffWindowScenario = () => {
  const scenario: SimulationScenario = {
    scenarioId: 'manual-buff-window',
    maxTimeMs: 5000,
    boss: baseBoss(100000),
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseSkills: [teamBuffSkill],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            {
              timeMs: 0,
              skillId: 'TEAM_ATTACK_BUFF'
            }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [multiHitSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            {
              timeMs: 0,
              skillId: 'MULTI_HIT',
              onUnavailable: 'FAIL'
            }
          ]
        }
      }
    ]
  };

  return runSimulation(scenario);
};

const testTimelinePriority = () => {
  const timeline = new Timeline();
  timeline.schedule({ timeMs: 1000, type: 'HIT', actorId: 'dps' });
  timeline.schedule({ timeMs: 1000, type: 'BUFF_EXPIRE', targetId: 'dps' });
  timeline.schedule({ timeMs: 1000, type: 'BUFF_APPLY', targetId: 'dps' });

  assert.equal(timeline.next()?.type, 'BUFF_EXPIRE');
  assert.equal(timeline.next()?.type, 'BUFF_APPLY');
  assert.equal(timeline.next()?.type, 'HIT');
};

const testEffectExclusiveAndStaleExpiry = () => {
  const manager = new EffectManager('boss');
  const lowEffect: AppliedEffectConfig = {
    EffectId: 'LOW_HARM',
    EffectName: '低易伤',
    Target: 'ENEMY',
    Duration: 1,
    ExclusiveGroup: 'MONSTER_HARMED',
    ExclusivePolicy: 'HIGHEST_EFFECT_VALUE',
    EffectPower: 10,
    BuffEffects: {
      BuffMonsterHarmedPercentEffect: 10
    }
  };
  const highEffect: AppliedEffectConfig = {
    ...lowEffect,
    EffectId: 'HIGH_HARM',
    EffectName: '高易伤',
    Duration: 2,
    EffectPower: 30,
    BuffEffects: {
      BuffMonsterHarmedPercentEffect: 30
    }
  };

  const low = manager.applyEffect(lowEffect, 0, 'support-a', 'skill-a').applied;
  assert.ok(low);

  const high = manager.applyEffect(highEffect, 500, 'support-b', 'skill-b');
  assert.equal(high.ignored, false);
  assert.equal(high.replaced[0]?.EffectId, 'LOW_HARM');
  assert.equal(manager.getActiveEffects()[0]?.EffectId, 'HIGH_HARM');

  const staleExpired = manager.expireEffect(low.InstanceId);
  assert.equal(staleExpired, false);
  assert.equal(manager.getActiveEffects()[0]?.EffectId, 'HIGH_HARM');

  const ignoredLow = manager.applyEffect(lowEffect, 600, 'support-a', 'skill-a');
  assert.equal(ignoredLow.ignored, true);
  assert.equal(manager.getActiveEffects()[0]?.EffectId, 'HIGH_HARM');
};

const testSameSkillEffectReplacementRules = () => {
  const manager = new EffectManager('boss');
  const baseEffect: AppliedEffectConfig = {
    EffectId: 'SAME_SKILL_HARM',
    EffectName: '同技能易伤',
    Target: 'ENEMY',
    Duration: 10,
    EffectPower: 20,
    BuffEffects: {
      BuffMonsterHarmedPercentEffect: 20
    }
  };

  const first = manager.applyEffect(baseEffect, 0, 'support-a', 'shared-skill');
  assert.ok(first.applied);

  const weaker = manager.applyEffect(
    {
      ...baseEffect,
      Duration: 20,
      EffectPower: 15,
      BuffEffects: {
        BuffMonsterHarmedPercentEffect: 15
      }
    },
    1000,
    'support-b',
    'shared-skill'
  );
  assert.equal(weaker.ignored, true);
  assert.equal(manager.getActiveEffects()[0]?.SourceActorId, 'support-a');

  const shorter = manager.applyEffect(
    {
      ...baseEffect,
      Duration: 5,
      EffectPower: 25,
      BuffEffects: {
        BuffMonsterHarmedPercentEffect: 25
      }
    },
    1000,
    'support-b',
    'shared-skill'
  );
  assert.equal(shorter.ignored, true);
  assert.equal(manager.getActiveEffects()[0]?.SourceActorId, 'support-a');

  const replacement = manager.applyEffect(
    {
      ...baseEffect,
      Duration: 10,
      EffectPower: 25,
      BuffEffects: {
        BuffMonsterHarmedPercentEffect: 25
      }
    },
    1000,
    'support-b',
    'shared-skill'
  );
  assert.equal(replacement.ignored, false);
  assert.equal(replacement.replaced[0]?.SourceActorId, 'support-a');
  assert.equal(manager.getActiveEffects()[0]?.SourceActorId, 'support-b');
  assert.equal(manager.getActiveEffects().length, 1);
};

const testManualTimelineMultiHitAndBuffExpiry = () => {
  const result = runManualBuffWindowScenario();
  assert.equal(result.hitRecords.length, 9);
  assert.deepEqual(
    result.hitRecords.map(record => record.TimeMs),
    [333, 667, 1000, 1333, 1667, 2000, 2333, 2667, 3000]
  );
  assert.equal(result.hitRecords[0]?.AvgDamage, 200);
  assert.equal(result.hitRecords[1]?.AvgDamage, 200);
  assert.equal(result.hitRecords[2]?.AvgDamage, 100);
  assert.equal(result.summary.TotalDamage, 1100);
};

const testFixedRotation = () => {
  const skillA = damageSkill('FIXED_A', 100, 0, 0);
  const skillB = damageSkill('FIXED_B', 200, 0, 0);
  const result = runSimulation({
    scenarioId: 'fixed-rotation',
    maxTimeMs: 1000,
    boss: baseBoss(300),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [skillA, skillB],
        gcdMs: 100,
        strategy: {
          type: 'FIXED_ROTATION',
          skillIds: ['FIXED_A', 'FIXED_B']
        }
      }
    ]
  });

  assert.equal(result.boss.killedAtMs, 100);
  assert.deepEqual(result.hitRecords.map(record => record.SkillId), ['FIXED_A', 'FIXED_B']);
  assert.equal(result.summary.TotalDamage, 300);
};

const testSkillBarAndBossDeathTruncation = () => {
  const first = damageSkill('BAR_FIRST', 50, 1, 0);
  const second = damageSkill('BAR_SECOND', 100, 0, 0);
  const result = runSimulation({
    scenarioId: 'skill-bar',
    maxTimeMs: 1000,
    boss: baseBoss(150),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [first, second],
        gcdMs: 100,
        strategy: {
          type: 'SKILL_BAR',
          skillIds: ['BAR_FIRST', 'BAR_SECOND'],
          scanMode: 'FROM_FIRST_EACH_DECISION'
        }
      }
    ]
  });

  assert.equal(result.boss.killedAtMs, 100);
  assert.deepEqual(result.hitRecords.map(record => record.SkillId), ['BAR_FIRST', 'BAR_SECOND']);
  assert.equal(result.hitRecords.length, 2);
};

const testSkillExpirySkipsRecentCast = () => {
  const first = damageSkill('EXPIRY_FIRST', 50, 0, 0);
  const second = damageSkill('EXPIRY_SECOND', 50, 0, 0);
  const result = runSimulation({
    scenarioId: 'skill-expiry',
    maxTimeMs: 450,
    boss: baseBoss(1000),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [first, second],
        gcdMs: 100,
        strategy: {
          type: 'SKILL_BAR',
          skillIds: ['EXPIRY_FIRST', 'EXPIRY_SECOND'],
          scanMode: 'FROM_FIRST_EACH_DECISION',
          skillExpiryMs: {
            EXPIRY_FIRST: 500
          }
        }
      }
    ]
  });

  assert.deepEqual(
    result.hitRecords.map(record => record.SkillId),
    ['EXPIRY_FIRST', 'EXPIRY_SECOND', 'EXPIRY_SECOND', 'EXPIRY_SECOND', 'EXPIRY_SECOND']
  );
};

const testDamageCompression = () => {
  const result = runSimulation({
    scenarioId: 'damage-compression',
    maxTimeMs: 100,
    boss: baseBoss(1000, 97),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [damageSkill('COMPRESSED_HIT', 100, 10, 0)],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            {
              timeMs: 0,
              skillId: 'COMPRESSED_HIT'
            }
          ]
        }
      }
    ]
  });

  assert.equal(result.hitRecords.length, 1);
  assert.equal(Math.round(result.hitRecords[0]!.AvgDamage), 3);
  assert.equal(Math.round(result.hitRecords[0]!.DamageApplied), 3);
};

const testChargesAndRecovery = () => {
  const charged = {
    ...damageSkill('CHARGED_HIT', 100, 0.2, 0),
    MaxCharges: 2,
    ChargeReplenishTime: 0.2
  };
  const result = runSimulation({
    scenarioId: 'charges',
    maxTimeMs: 1000,
    boss: baseBoss(400),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [charged],
        gcdMs: 50,
        strategy: {
          type: 'FIXED_ROTATION',
          skillIds: ['CHARGED_HIT']
        }
      }
    ]
  });

  assert.deepEqual(result.hitRecords.map(record => record.TimeMs), [0, 50, 200, 400]);
  assert.equal(result.boss.killedAtMs, 400);
};

const testCooldownResetRefreshesCharges = () => {
  const charged = {
    ...damageSkill('RESET_TARGET', 100, 10, 0),
    MaxCharges: 2,
    ChargeReplenishTime: 10
  };
  const resetSkill: Skill = {
    ...damageSkill('REFRESH_CHARGES', 0, 10, 0),
    ActionType: 'UTILITY',
    CooldownResets: [
      {
        TargetSkillId: 'RESET_TARGET',
        ResetType: 'REFRESH_CHARGES',
        Charges: 2
      }
    ]
  };
  const result = runSimulation({
    scenarioId: 'cooldown-reset',
    maxTimeMs: 1000,
    boss: baseBoss(300),
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [charged, resetSkill],
        gcdMs: 50,
        strategy: {
          type: 'FIXED_ROTATION',
          skillIds: ['RESET_TARGET', 'RESET_TARGET', 'REFRESH_CHARGES', 'RESET_TARGET']
        }
      }
    ]
  });

  assert.deepEqual(result.hitRecords.map(record => record.TimeMs), [0, 50, 150]);
  assert.equal(result.boss.killedAtMs, 150);
};

const testAutoPhaseTransition = () => {
  const phaseBuffSkill: Skill = {
    SkillID: 'PHASE_BUFF',
    SkillName: '阶段增益',
    RequiredClass: 'TEST_SUPPORT',
    Faction: 'COMMON',
    SkillImportanceWeight: 0,
    SkillFrequency: 0,
    Cooldown: 30,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {
      SkillDamageBonus: 1
    },
    MultiPhaseConfig: {
      ManualActivationAllowed: false,
      Phases: [
        {
          PhaseIndex: 1,
          Duration: 1,
          AutoTransition: true,
          AppliesEffects: [
            {
              EffectId: 'PHASE_ONE_ATTACK',
              EffectName: '一段攻击',
              Target: 'TEAM',
              Duration: 1,
              RefreshOnReapply: true,
              BuffEffects: {
                BuffAttackPercentEffect: 100
              }
            }
          ]
        },
        {
          PhaseIndex: 2,
          Duration: 1,
          AutoTransition: false,
          AppliesEffects: [
            {
              EffectId: 'PHASE_TWO_ATTACK',
              EffectName: '二段攻击',
              Target: 'TEAM',
              Duration: 1,
              RefreshOnReapply: true,
              BuffEffects: {
                BuffAttackPercentEffect: 200
              }
            }
          ]
        }
      ]
    }
  };
  const singleHit = damageSkill('PHASE_TEST_HIT', 100, 0, 0);
  const result = runSimulation({
    scenarioId: 'phase-transition',
    maxTimeMs: 3000,
    boss: baseBoss(1000),
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseSkills: [phaseBuffSkill],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            {
              timeMs: 0,
              skillId: 'PHASE_BUFF'
            }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [singleHit],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            {
              timeMs: 500,
              skillId: 'PHASE_TEST_HIT'
            },
            {
              timeMs: 1500,
              skillId: 'PHASE_TEST_HIT'
            }
          ]
        }
      }
    ]
  });

  assert.equal(result.hitRecords[0]?.AvgDamage, 200);
  assert.equal(result.hitRecords[1]?.AvgDamage, 300);
};

const testFourthGenDynamicScalingAffectsDamage = () => {
  const supportAttributes: CharacterAttributes = {
    ...baseAttributes,
    CharacterMinAttack: 50,
    CharacterMaxAttack: 50
  };
  const dynamicHealthBuff: Skill = {
    SkillID: 'DYNAMIC_HEALTH_BUFF',
    SkillName: '动态气血增益',
    RequiredClass: 'TEST_SUPPORT',
    Faction: 'COMMON',
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
        EffectId: 'DYNAMIC_HEALTH_UP',
        EffectName: '动态气血提升',
        Target: 'ALLY',
        Duration: 10,
        RefreshOnReapply: true,
        BuffEffects: {
          BuffHealthFixedEffect: 500000
        }
      }
    ],
    FourthGenPresets: {
      XI_RI: {
        AppliesEffects: {
          DYNAMIC_HEALTH_UP: {
            DynamicScalingAttribute: 'CharacterMaxAttack',
            DynamicScalingMultiplier: 8,
            DynamicTargetField: 'BuffHealthFixedEffect'
          }
        }
      }
    }
  };
  const healthDamageSkill: Skill = {
    ...damageSkill('HEALTH_DAMAGE_HIT', 0, 0, 0),
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 0,
      SkillAttackFixedBonus: -100,
      SkillHealthPercentBonus: 100,
      SkillDamageBonus: 1
    }
  };

  const result = runSimulation({
    scenarioId: 'fourth-gen-dynamic-scaling',
    maxTimeMs: 1000,
    boss: baseBoss(100000),
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseAttributes: supportAttributes,
        baseSkills: [dynamicHealthBuff],
        skillOverrides: {
          DYNAMIC_HEALTH_BUFF: {
            FourthGenQuality: 'XI_RI'
          }
        },
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            {
              timeMs: 0,
              skillId: 'DYNAMIC_HEALTH_BUFF',
              targetActorId: 'dps'
            }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes,
        baseSkills: [healthDamageSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            {
              timeMs: 0,
              skillId: 'HEALTH_DAMAGE_HIT'
            }
          ]
        }
      }
    ]
  });

  assert.equal(result.hitRecords.length, 1);
  assert.equal(result.hitRecords[0]?.AvgDamage, 1400);
  assert.equal(result.hitRecords[0]?.ActiveEffectIds.length, 1);
};

const testMissingBossHealthFailsClearly = () => {
  const bossWithoutHealth: Monster = {
    MonsterID: 'NO_HP',
    MonsterName: '无血量 Boss',
    DungeonLevel: 1,
    MonsterAttributeModifiers: {
      MonsterCriticalDamagePercentReduction: 0
    }
  };

  assert.throws(
    () =>
      runSimulation({
        maxTimeMs: 100,
        boss: bossWithoutHealth,
        actors: []
      }),
    /missing a positive MonsterHealth/
  );
};

const testYanBingJiuHunDynamicDoubler = () => {
  const ybjhSkill: Skill = {
    SkillID: 'YBJH_SKILL',
    SkillName: '炎兵灸魂',
    RequiredClass: 'FEN_XIANG',
    Faction: 'FO',
    SkillImportanceWeight: 0,
    SkillFrequency: 0,
    Cooldown: 6,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'DEBUFF',
    SkillBonusAttributes: { SkillDamageBonus: 1 },
    AppliesEffects: [
      {
        EffectId: 'FX_DEBUFF_YBJH_GREEN',
        EffectName: '炎兵灸魂令怪物受到的绿点翻倍',
        Target: 'ENEMY',
        Duration: 20,
        BuffEffects: {
          BuffMonsterCriticalDamagePercentEffect: 0
        }
      }
    ]
  };

  const envGreenPoints: Skill = {
    SkillID: 'ENV_GREEN_SKILL',
    SkillName: '环境绿点',
    RequiredClass: 'TEST_SUPPORT',
    Faction: 'COMMON',
    SkillImportanceWeight: 0,
    SkillFrequency: 0,
    Cooldown: 0,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'DEBUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'ENV_GREEN',
        EffectName: '绿点增益',
        Target: 'ENEMY',
        Duration: 100,
        BuffEffects: {
          BuffMonsterCriticalDamagePercentEffect: 900
        }
      }
    ]
  };

  const dpsSkill = damageSkill('CRIT_HIT', 100);

  const resultBase = runSimulation({
    maxTimeMs: 2000,
    boss: baseBoss(100000),
    attributeCaps: {
      EnableCaps: false
    },
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseSkills: [envGreenPoints],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            {
              timeMs: 0,
              skillId: 'ENV_GREEN_SKILL',
              targetActorId: 'boss'
            }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes: {
          ...baseAttributes,
          CharacterCriticalHitDamagePercent: 500
        },
        baseSkills: [dpsSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [{ timeMs: 1000, skillId: 'CRIT_HIT' }]
        }
      }
    ]
  });

  const resultDoubled = runSimulation({
    maxTimeMs: 2000,
    boss: baseBoss(100000),
    attributeCaps: {
      EnableCaps: false
    },
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseSkills: [envGreenPoints],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            {
              timeMs: 0,
              skillId: 'ENV_GREEN_SKILL',
              targetActorId: 'boss'
            }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes: {
          ...baseAttributes,
          CharacterCriticalHitDamagePercent: 500
        },
        baseSkills: [dpsSkill, ybjhSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            { timeMs: 0, skillId: 'YBJH_SKILL', targetActorId: 'boss' },
            { timeMs: 1000, skillId: 'CRIT_HIT' }
          ]
        }
      }
    ]
  });

  assert.equal(resultBase.hitRecords[0]?.AvgDamage, 1400);
  assert.equal(resultDoubled.hitRecords[0]?.AvgDamage, 2300);
};

const testAttributeCaps = () => {
  const dpsSkill = damageSkill('HIT_UNDER_CAPS', 100);
  const result = runSimulation({
    maxTimeMs: 100,
    boss: baseBoss(100000),
    attributeCaps: {
      EnableCaps: true,
      CapAttack: 500
    },
    actors: [
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes: {
          ...baseAttributes,
          CharacterMinAttack: 1000,
          CharacterMaxAttack: 1000
        },
        baseSkills: [dpsSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [{ timeMs: 0, skillId: 'HIT_UNDER_CAPS' }]
        }
      }
    ]
  });

  assert.equal(result.hitRecords[0]?.AvgDamage, 500);

  const capStressSkill: Skill = {
    ...damageSkill('DEFAULT_CAP_STRESS', 100),
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 0,
      SkillHealthPercentBonus: 100,
      SkillManaPercentBonus: 100,
      SkillDefensePercentBonus: 100,
      SkillDamageBonus: 1
    }
  };
  const highAttributes: CharacterAttributes = {
    ...baseAttributes,
    CharacterMinAttack: 1000000,
    CharacterMaxAttack: 1000000,
    CharacterDefense: 600000,
    CharacterHealth: 5000000,
    CharacterMana: 7000000,
    CharacterCriticalHitDamagePercent: 5000
  };
  const cappedDamage = calculateDamage(highAttributes, capStressSkill, baseBoss(100000), []);
  assert.equal(cappedDamage.avgFinalDamage, 337500000);

  const uncappedDamage = calculateDamage(highAttributes, capStressSkill, baseBoss(100000), [], {}, { EnableCaps: false });
  assert.equal(uncappedDamage.avgFinalDamage, 680000000);

  const overCapDebuffs = [
    {
      BuffID: 'OVER_GREEN',
      BuffName: '超额绿点',
      IsDefaultActive: true,
      BuffEffects: {
        BuffMonsterCriticalDamagePercentEffect: 1200
      }
    },
    {
      BuffID: 'OVER_HARMED',
      BuffName: '超额易伤',
      IsDefaultActive: true,
      BuffEffects: {
        BuffMonsterHarmedPercentEffect: 200
      }
    }
  ];
  const debuffCappedDamage = calculateDamage(baseAttributes, dpsSkill, baseBoss(100000), overCapDebuffs);
  assert.equal(debuffCappedDamage.avgFinalDamage, 2200);
};

const testOnePercentAttributesAffectDamageBuffs = () => {
  const onePercentAttributes: CharacterAttributes = {
    ...baseAttributes,
    CharacterMinAttack: 1000,
    CharacterMaxAttack: 1000,
    CharacterOnePercentAttack: 50
  };
  const attackBuff = {
    BuffID: 'ONE_PERCENT_ATTACK_BUFF',
    BuffName: '一分攻击测试 Buff',
    IsDefaultActive: true,
    BuffEffects: {
      BuffAttackPercentEffect: 10
    }
  };
  const dpsSkill = damageSkill('ONE_PERCENT_HIT', 100);

  const staticDamage = calculateDamage(onePercentAttributes, dpsSkill, baseBoss(100000), [attackBuff]);
  assert.equal(staticDamage.avgFinalDamage, 1500);
  assert.equal(staticDamage.minBaseDamage, 1500);

  const supportBuffSkill: Skill = {
    SkillID: 'ONE_PERCENT_TEAM_BUFF',
    SkillName: '一分属性团队增益',
    RequiredClass: 'TEST_SUPPORT',
    Faction: 'COMMON',
    SkillImportanceWeight: 0,
    SkillFrequency: 0,
    Cooldown: 30,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'ONE_PERCENT_TEAM_ATTACK_UP',
        EffectName: '一分属性团队攻击提升',
        Target: 'TEAM',
        Duration: 10,
        BuffEffects: {
          BuffAttackPercentEffect: 10
        }
      }
    ]
  };

  const result = runSimulation({
    maxTimeMs: 100,
    boss: baseBoss(100000),
    actors: [
      {
        actorId: 'support',
        classId: 'TEST_SUPPORT',
        role: 'SUPPORT',
        baseSkills: [supportBuffSkill],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [{ timeMs: 0, skillId: 'ONE_PERCENT_TEAM_BUFF' }]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes: onePercentAttributes,
        baseSkills: [dpsSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [{ timeMs: 10, skillId: 'ONE_PERCENT_HIT' }]
        }
      }
    ]
  });

  assert.equal(result.hitRecords[0]?.AvgDamage, 1500);
};

const testZhaoMingSkills = () => {
  const zhaoMingAttributes: CharacterAttributes = {
    CharacterMinAttack: 10000,
    CharacterMaxAttack: 10000,
    CharacterDefense: 2000,
    CharacterHealth: 100000,
    CharacterMana: 2000000,
    CharacterCriticalHitDamagePercent: 400,
    CharacterCriticalHitRatePercent: 260,
    CharacterMonsterDamageIncreasePercent: 10
  };

  const tynfSkill: Skill = {
    SkillID: 'ZM_FO_SKILL_TYNF',
    SkillName: '停云凝风',
    RequiredClass: 'ZHAO_MING',
    Faction: 'FO',
    SkillImportanceWeight: 0.8,
    SkillFrequency: 0.8,
    Cooldown: 135,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'UTILITY',
    SkillBonusAttributes: {},
    BuffDurationExtensionSeconds: 0,
    FourthGenPresets: {
      XI_RI: {
        BuffDurationExtensionSeconds: 14
      }
    }
  };

  const ryhgSkill: Skill = {
    SkillID: 'ZM_FO_SKILL_RYHG',
    SkillName: '日月弘光',
    RequiredClass: 'ZHAO_MING',
    Faction: 'FO',
    SkillImportanceWeight: 0.9,
    SkillFrequency: 0.9,
    Cooldown: 35,
    CastTime: 0,
    IsAOE: true,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    MultiPhaseConfig: {
      ManualActivationAllowed: false,
      Phases: [
        {
          PhaseIndex: 1,
          Duration: 1,
          AutoTransition: true,
          AppliesEffects: [
            {
              EffectId: 'ZM_BUFF_RYHG_PHASE_1',
              EffectName: '日月弘光一段',
              Target: 'TEAM',
              Duration: 1,
              BuffEffects: {
                BuffFocusPercentEffect: 45,
                BuffHolyWrathPercentEffect: 7.5
              }
            }
          ]
        },
        {
          PhaseIndex: 2,
          Duration: 1,
          AutoTransition: false,
          AppliesEffects: [
            {
              EffectId: 'ZM_BUFF_RYHG_PHASE_2',
              EffectName: '日月弘光二段',
              Target: 'TEAM',
              Duration: 1,
              BuffEffects: {
                BuffFocusPercentEffect: 60,
                BuffHolyWrathPercentEffect: 22.5
              }
            }
          ]
        }
      ]
    }
  };

  const fgslSkill: Skill = {
    SkillID: 'ZM_FO_SKILL_FGSL',
    SkillName: '跗骨生灵',
    RequiredClass: 'ZHAO_MING',
    Faction: 'FO',
    SkillImportanceWeight: 1.0,
    SkillFrequency: 1.0,
    Cooldown: 0,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'ZM_BUFF_FGSL',
        EffectName: '跗骨生灵',
        Target: 'ALLY',
        Duration: 10,
        BuffEffects: {
          BuffHealthFixedEffect: 0,
          BuffManaFixedEffect: 0,
          BuffAttackFixedEffect: 0,
          BuffCriticalDamagePercentEffect: 0,
          BuffCriticalHitRatePercentEffect: 0,
          BuffMonsterDamageIncreaseEffect: 0
        }
      }
    ]
  };

  const dpsSkill = damageSkill('ZM_TEST_HIT', 100);

  const result = runSimulation({
    maxTimeMs: 4000,
    boss: baseBoss(1000000),
    actors: [
      {
        actorId: 'support',
        classId: 'ZHAO_MING',
        role: 'SUPPORT',
        baseAttributes: zhaoMingAttributes,
        baseSkills: [tynfSkill, ryhgSkill, fgslSkill],
        skillOverrides: {
          ZM_FO_SKILL_TYNF: {
            FourthGenQuality: 'XI_RI'
          }
        },
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            { timeMs: 0, skillId: 'ZM_FO_SKILL_FGSL', targetActorId: 'dps' },
            { timeMs: 500, skillId: 'ZM_FO_SKILL_RYHG' },
            { timeMs: 1200, skillId: 'ZM_FO_SKILL_TYNF', targetActorId: 'dps' }
          ]
        }
      },
      {
        actorId: 'dps',
        classId: 'TEST_DPS',
        role: 'DPS',
        baseAttributes: {
          ...baseAttributes,
          CharacterMinAttack: 1000,
          CharacterMaxAttack: 1000,
          CharacterHealth: 10000,
          CharacterMana: 10000,
          CharacterCriticalHitDamagePercent: 100,
          CharacterMonsterDamageIncreasePercent: 0
        },
        baseSkills: [dpsSkill],
        strategy: {
          type: 'MANUAL_TIMELINE',
          actions: [
            { timeMs: 100, skillId: 'ZM_TEST_HIT' },
            { timeMs: 800, skillId: 'ZM_TEST_HIT' },
            { timeMs: 2000, skillId: 'ZM_TEST_HIT' }
          ]
        }
      }
    ]
  });

  assert.equal(result.events.some(e => e.status === 'FAILED'), false);
  const fuguApplyEvent = result.events.find(
    event => event.type === 'BUFF_APPLY' && event.skillId === 'ZM_FO_SKILL_FGSL' && event.targetId === 'dps'
  );
  const fuguEffect = fuguApplyEvent?.data?.effect as AppliedEffectConfig | undefined;
  assert.equal(fuguEffect?.BuffEffects.BuffCriticalHitRatePercentEffect, undefined);

  assert.ok(result.hitRecords[0]);
  console.log('hit0 average damage:', Math.round(result.hitRecords[0].AvgDamage));
  assert.equal(Math.round(result.hitRecords[0].AvgDamage), 1000);

  assert.ok(result.hitRecords[1]);
  console.log('hit1 average damage:', Math.round(result.hitRecords[1].AvgDamage));
  assert.equal(Math.round(result.hitRecords[1].AvgDamage), 1559);

  assert.ok(result.hitRecords[2]);
  console.log('hit2 active buffs:', result.hitRecords[2].ActiveEffectIds);
  console.log('hit2 average damage:', Math.round(result.hitRecords[2].AvgDamage));
  assert.equal(Math.round(result.hitRecords[2].AvgDamage), 2665);

  const ryhgShortCooldown: Skill = {
    ...ryhgSkill,
    Cooldown: 0.1
  };
  const ryhgCooldownResult = runSimulation({
    maxTimeMs: 3000,
    boss: baseBoss(1000000),
    actors: [
      {
        actorId: 'support',
        classId: 'ZHAO_MING',
        role: 'SUPPORT',
        baseAttributes: zhaoMingAttributes,
        baseSkills: [ryhgShortCooldown],
        strategy: {
          type: 'SETUP_PHASE',
          actions: [
            { timeMs: 0, skillId: 'ZM_FO_SKILL_RYHG' },
            { timeMs: 1500, skillId: 'ZM_FO_SKILL_RYHG', onUnavailable: 'SKIP' },
            { timeMs: 2200, skillId: 'ZM_FO_SKILL_RYHG' }
          ]
        }
      }
    ]
  });
  const ryhgCastTimes = ryhgCooldownResult.events
    .filter(event => event.type === 'CAST_START' && event.status === 'PROCESSED' && event.skillId === 'ZM_FO_SKILL_RYHG')
    .map(event => event.timeMs);
  assert.deepEqual(ryhgCastTimes, [0, 2200]);
  assert.ok(ryhgCooldownResult.events.some(
    event => event.type === 'CAST_START'
      && event.status === 'SKIPPED'
      && event.skillId === 'ZM_FO_SKILL_RYHG'
      && event.timeMs === 1500
  ));
};

const testTianHuaSkills = () => {
  const tianHuaAttributes: CharacterAttributes = {
    CharacterMinAttack: 50000,
    CharacterMaxAttack: 50000,
    CharacterDefense: 2000,
    CharacterHealth: 100000,
    CharacterMana: 1000000,
    CharacterCriticalHitDamagePercent: 400,
    CharacterCriticalHitRatePercent: 260,
    CharacterMonsterDamageIncreasePercent: 10
  };

  const mqyySkill: Skill = {
    SkillID: 'TH_FO_SKILL_MQYY',
    SkillName: '鸣泉雅韵',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 1.0,
    SkillFrequency: 1.0,
    Cooldown: 12,
    CastTime: 0,
    IsAOE: true,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_MQYY',
        EffectName: '鸣泉雅韵增加攻击百分比',
        Target: 'TEAM',
        Duration: 1800,
        BuffEffects: {
          BuffAttackPercentEffect: 0
        }
      }
    ]
  };

  const jskwSkill: Skill = {
    SkillID: 'TH_FO_SKILL_JSKW',
    SkillName: '金蛇狂舞',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 1.0,
    SkillFrequency: 1.0,
    Cooldown: 0,
    CastTime: 0,
    IsAOE: true,
    ActionType: 'BUFF',
    SkillLevel: 1,
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_JSKW',
        EffectName: '金蛇狂舞团队增益',
        Target: 'TEAM',
        Duration: 3600,
        BuffEffects: {
          BuffAttackPercentEffect: 40,
          BuffCriticalDamagePercentEffect: 60,
          BuffCriticalHitRatePercentEffect: 23,
          BuffFocusPercentEffect: 18
        }
      }
    ]
  };

  const qsyySkill: Skill = {
    SkillID: 'TH_FO_SKILL_QSYY',
    SkillName: '秋声雅韵',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 0.8,
    SkillFrequency: 0.8,
    Cooldown: 80,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillLevel: 1,
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_QSYY',
        EffectName: '秋声雅韵主输出增益',
        Target: 'ALLY',
        Duration: 25,
        BuffEffects: {
          BuffFocusPercentEffect: 0,
          BuffDefenseFixedEffect: 0,
          BuffCriticalDamagePercentEffect: 0
        }
      }
    ],
    FourthGenPresets: {
      YING_JU: {
        Cooldown: 60,
        AppliesEffects: {
          TH_BUFF_QSYY: {
            Duration: 28
          }
        }
      },
      HAO_YUE: {
        Cooldown: 45,
        AppliesEffects: {
          TH_BUFF_QSYY: {
            Duration: 31
          }
        }
      },
      XI_RI: {
        Cooldown: 30,
        AppliesEffects: {
          TH_BUFF_QSYY: {
            Duration: 34
          }
        }
      }
    }
  };

  const ysyy2Skill: Skill = {
    SkillID: 'TH_FO_SKILL_YSYY2',
    SkillName: '云水雅韵II',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 0.7,
    SkillFrequency: 0.7,
    Cooldown: 60,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_YSYY2_HEALTH',
        EffectName: '云水雅韵II气血增益',
        Target: 'ALLY',
        Duration: 30,
        ExclusiveGroup: 'HP_OVERRIDE_GROUP',
        ExclusivePolicy: 'NO_OVERWRITE',
        BuffEffects: {
          BuffHealthFixedEffect: 0
        }
      },
      {
        EffectId: 'TH_BUFF_YSYY2_MANA',
        EffectName: '云水雅韵II真气增益',
        Target: 'ALLY',
        Duration: 30,
        BuffEffects: {
          BuffManaFixedEffect: 0
        }
      },
      {
        EffectId: 'TH_BUFF_YSYY2_ATTACK',
        EffectName: '云水雅韵II攻击增益',
        Target: 'ALLY',
        Duration: 30,
        BuffEffects: {
          BuffAttackFixedEffect: 0
        }
      }
    ]
  };

  const jlsSkill: Skill = {
    SkillID: 'TH_FO_SKILL_JLS',
    SkillName: '净莲生',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 0.6,
    SkillFrequency: 0.6,
    Cooldown: 240,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_YSYY2_HEALTH',
        EffectName: '净莲生-云水气血增益',
        Target: 'ALLY',
        Duration: 30,
        ExclusiveGroup: 'HP_OVERRIDE_GROUP',
        ExclusivePolicy: 'NO_OVERWRITE',
        BuffEffects: {
          BuffHealthFixedEffect: 0
        }
      },
      {
        EffectId: 'TH_BUFF_YSYY2_MANA',
        EffectName: '净莲生-云水真气增益',
        Target: 'ALLY',
        Duration: 30,
        BuffEffects: {
          BuffManaFixedEffect: 0
        }
      },
      {
        EffectId: 'TH_BUFF_YSYY2_ATTACK',
        EffectName: '净莲生-云水攻击增益',
        Target: 'ALLY',
        Duration: 30,
        BuffEffects: {
          BuffAttackFixedEffect: 0
        }
      },
      {
        EffectId: 'TH_BUFF_QSYY',
        EffectName: '净莲生-秋声主输出增益',
        Target: 'ALLY',
        Duration: 26,
        BuffEffects: {
          BuffFocusPercentEffect: 0,
          BuffDefenseFixedEffect: 0,
          BuffCriticalDamagePercentEffect: 0
        }
      }
    ]
  };

  const fqhSkill: Skill = {
    SkillID: 'TH_FO_SKILL_FQH',
    SkillName: '凤求凰',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 0.6,
    SkillFrequency: 0.6,
    Cooldown: 120,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_BUFF_FQH',
        EffectName: '凤求凰爆伤增益',
        Target: 'ALLY',
        Duration: 30,
        BuffEffects: {
          BuffCriticalDamagePercentEffect: 0
        }
      }
    ]
  };

  const ygsdSkill: Skill = {
    SkillID: 'TH_FO_SKILL_YGSD_CHAN',
    SkillName: '阳关三叠·禅',
    RequiredClass: 'TIAN_HUA',
    Faction: 'FO',
    SkillImportanceWeight: 0.8,
    SkillFrequency: 0.8,
    Cooldown: 6,
    CastTime: 0,
    IsAOE: false,
    ActionType: 'DEBUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TH_DEBUFF_YGSD_CHAN',
        EffectName: '阳关三叠·禅破防',
        Target: 'ENEMY',
        Duration: 20,
        BuffEffects: {
          BuffDefenseFixedEffect: -10000
        },
        DynamicScalingAttribute: 'CharacterMaxAttack',
        DynamicScalingMultiplier: -1.0,
        DynamicTargetField: 'BuffDefenseFixedEffect'
      }
    ]
  };

  // Tianyin Mo Ke Xin Jing for HP exclusivity check
  const tyMkxjSkill: Skill = {
    SkillID: 'TY_FO_SKILL_MKXJ',
    SkillName: '摩柯心经',
    RequiredClass: 'TIAN_YIN',
    Faction: 'FO',
    SkillImportanceWeight: 0.6,
    SkillFrequency: 0.6,
    Cooldown: 180,
    CastTime: 1.0,
    IsAOE: false,
    ActionType: 'BUFF',
    SkillBonusAttributes: {},
    AppliesEffects: [
      {
        EffectId: 'TY_BUFF_MKXJ_HEALTH',
        EffectName: '摩柯心经增加气血固定值',
        Target: 'ALLY',
        Duration: 25,
        ExclusiveGroup: 'HP_OVERRIDE_GROUP',
        ExclusivePolicy: 'NO_OVERWRITE',
        BuffEffects: {
          BuffHealthFixedEffect: 500000
        }
      }
    ]
  };

  const dpsSkill = damageSkill('TH_TEST_HIT', 100);

  // 1. Verify Tianhua skill dynamic calculations (MQYY, QSYY, YSYY2, YGSD)
  {
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          gcdMs: 0,
          baseAttributes: tianHuaAttributes,
          baseSkills: [mqyySkill, jskwSkill, qsyySkill, ysyy2Skill, ygsdSkill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 0, skillId: 'TH_FO_SKILL_MQYY' },
              { timeMs: 200, skillId: 'TH_FO_SKILL_JSKW' },
              { timeMs: 400, skillId: 'TH_FO_SKILL_QSYY', targetActorId: 'dps' },
              { timeMs: 600, skillId: 'TH_FO_SKILL_YSYY2', targetActorId: 'dps' },
              { timeMs: 800, skillId: 'TH_FO_SKILL_YGSD_CHAN' }
            ]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseAttributes: baseAttributes,
          baseSkills: [dpsSkill],
          strategy: {
            type: 'MANUAL_TIMELINE',
            actions: [{ timeMs: 1000, skillId: 'TH_TEST_HIT' }]
          }
        }
      ]
    });

    assert.equal(result.events.some(e => e.status === 'FAILED'), false);

    // Verify MQYY
    const mqyyApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_MQYY');
    const mqyyEff = mqyyApply?.data?.effect as AppliedEffectConfig;
    assert.equal(mqyyEff.BuffEffects.BuffAttackPercentEffect, undefined);

    // Verify JSKW
    const jskwApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_JSKW');
    const jskwEff = jskwApply?.data?.effect as AppliedEffectConfig;
    assert.equal(jskwEff.BuffEffects.BuffAttackPercentEffect, undefined);
    assert.equal(jskwEff.BuffEffects.BuffCriticalDamagePercentEffect, undefined);
    assert.equal(jskwEff.BuffEffects.BuffFocusPercentEffect, 20);

    // Verify QSYY (with MQYY and JSKW active, support max attack is 50000 since MQYY is disabled, so no buff boost)
    const qsyyApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_QSYY');
    const qsyyEff = qsyyApply?.data?.effect as AppliedEffectConfig;
    assert.equal(qsyyEff.BuffEffects.BuffFocusPercentEffect, 32); // 22 + min(20, 50000/5000) = 32
    assert.equal(qsyyEff.BuffEffects.BuffDefenseFixedEffect, undefined);
    assert.equal(qsyyEff.BuffEffects.BuffCriticalDamagePercentEffect, undefined);

    // Verify YSYY2 HP/MP/ATTACK
    const ysyy2HpApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_YSYY2' && (e.data as any)?.effect?.EffectId === 'TH_BUFF_YSYY2_HEALTH');
    const ysyy2HpEff = ysyy2HpApply?.data?.effect as AppliedEffectConfig;
    assert.equal(ysyy2HpEff.BuffEffects.BuffHealthFixedEffect, undefined);

    const ysyy2MpApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_YSYY2' && (e.data as any)?.effect?.EffectId === 'TH_BUFF_YSYY2_MANA');
    const ysyy2MpEff = ysyy2MpApply?.data?.effect as AppliedEffectConfig;
    assert.equal(ysyy2MpEff.BuffEffects.BuffManaFixedEffect, undefined);

    const ysyy2AtkApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_YSYY2' && (e.data as any)?.effect?.EffectId === 'TH_BUFF_YSYY2_ATTACK');
    const ysyy2AtkEff = ysyy2AtkApply?.data?.effect as AppliedEffectConfig;
    assert.equal(ysyy2AtkEff.BuffEffects.BuffAttackFixedEffect, undefined);

    // Verify YGSD boss debuff (support max attack is 50000 because MQYY is disabled!)
    const ygsdApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_YGSD_CHAN');
    const ygsdEff = ygsdApply?.data?.effect as AppliedEffectConfig;
    assert.equal(ygsdEff.BuffEffects.BuffDefenseFixedEffect, -50000); // -1.0 * 50000 = -50000
  }

  // 2. Verify HP exclusivity comparison logic (Yun Shui II vs. Mo Ke)
  // Use TEST_ prefixed effect IDs to test the exclusivity comparison engine feature
  // since production ones are disabled.
  const testYsyy2Skill: Skill = {
    ...ysyy2Skill,
    AppliesEffects: [
      {
        ...ysyy2Skill.AppliesEffects![0],
        EffectId: 'TEST_TH_BUFF_YSYY2_HEALTH'
      },
      ysyy2Skill.AppliesEffects![1],
      ysyy2Skill.AppliesEffects![2]
    ]
  };

  const testTyMkxjSkill: Skill = {
    ...tyMkxjSkill,
    AppliesEffects: [
      {
        ...tyMkxjSkill.AppliesEffects![0],
        EffectId: 'TEST_TY_BUFF_MKXJ_HEALTH'
      }
    ]
  };

  // Case A: Yun Shui II replaces Mo Ke (Yun Shui II HP=750k, dur=30s vs. Mo Ke HP=500k, dur=25s)
  {
    const strongTianHuaAttributes = { ...tianHuaAttributes, CharacterMaxAttack: 300000 };
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support_ty',
          classId: 'TIAN_YIN',
          role: 'SUPPORT',
          baseSkills: [testTyMkxjSkill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TY_FO_SKILL_MKXJ', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'support_th',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseAttributes: strongTianHuaAttributes,
          baseSkills: [testYsyy2Skill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 200, skillId: 'TH_FO_SKILL_YSYY2', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const thApplyEvent = result.events.find(e => e.type === 'BUFF_APPLY' && e.actorId === 'support_th' && (e.data as any)?.effect?.EffectId === 'TEST_TH_BUFF_YSYY2_HEALTH');
    assert.equal(thApplyEvent?.status, 'PROCESSED');
  }

  // Case B: Yun Shui II does NOT replace Mo Ke because HP is lower (Yun Shui II HP=250k, dur=30s vs. Mo Ke HP=500k, dur=25s)
  {
    const weakTianHuaAttributes = { ...tianHuaAttributes, CharacterMaxAttack: 100000 };
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support_ty',
          classId: 'TIAN_YIN',
          role: 'SUPPORT',
          baseSkills: [testTyMkxjSkill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TY_FO_SKILL_MKXJ', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'support_th',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseAttributes: weakTianHuaAttributes,
          baseSkills: [testYsyy2Skill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 200, skillId: 'TH_FO_SKILL_YSYY2', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const thApplyEvent = result.events.find(e => e.type === 'BUFF_APPLY' && e.actorId === 'support_th' && (e.data as any)?.effect?.EffectId === 'TEST_TH_BUFF_YSYY2_HEALTH');
    assert.equal(thApplyEvent?.status, 'SKIPPED');
  }

  // 3. Verify Jing Lian Sheng (JLS) level filters
  const testJlsSkill: Skill = {
    ...jlsSkill,
    SkillID: 'TEST_TH_FO_SKILL_JLS'
  };

  const testFqhSkill: Skill = {
    ...fqhSkill,
    SkillID: 'TEST_TH_FO_SKILL_FQH',
    AppliesEffects: [
      {
        ...fqhSkill.AppliesEffects![0],
        EffectId: 'TEST_TH_BUFF_FQH'
      }
                ]
  };

  // Level 1: YSYY2 only
  {
    const result = runSimulation({
      maxTimeMs: 1000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseSkills: [testJlsSkill],
          skillOverrides: {
            TEST_TH_FO_SKILL_JLS: { SkillLevel: 1 }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TEST_TH_FO_SKILL_JLS', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const appliedIds = result.events
      .filter(e => e.type === 'BUFF_APPLY' && e.actorId === 'support')
      .map(e => (e.data as any)?.effect?.EffectId);
    assert.ok(appliedIds.includes('TH_BUFF_YSYY2_HEALTH'));
    assert.ok(!appliedIds.includes('TH_BUFF_QSYY'));
  }

  // Level 2: QSYY only
  {
    const result = runSimulation({
      maxTimeMs: 1000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseSkills: [testJlsSkill],
          skillOverrides: {
            TEST_TH_FO_SKILL_JLS: { SkillLevel: 2 }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TEST_TH_FO_SKILL_JLS', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const appliedIds = result.events
      .filter(e => e.type === 'BUFF_APPLY' && e.actorId === 'support')
      .map(e => (e.data as any)?.effect?.EffectId);
    assert.ok(!appliedIds.includes('TH_BUFF_YSYY2_HEALTH'));
    assert.ok(appliedIds.includes('TH_BUFF_QSYY'));
  }

  // Level 3: both
  {
    const result = runSimulation({
      maxTimeMs: 1000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseSkills: [testJlsSkill],
          skillOverrides: {
            TEST_TH_FO_SKILL_JLS: { SkillLevel: 3 }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TEST_TH_FO_SKILL_JLS', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const appliedIds = result.events
      .filter(e => e.type === 'BUFF_APPLY' && e.actorId === 'support')
      .map(e => (e.data as any)?.effect?.EffectId);
    assert.ok(appliedIds.includes('TH_BUFF_YSYY2_HEALTH'));
    assert.ok(appliedIds.includes('TH_BUFF_QSYY'));
  }

  // 4. Verify Feng Qiu Huang (FQH) variant durations and crit damage baselines
  // Variant HAO: duration 20s, base crit damage 150.
  // Final crit damage = 150 + floor(1000000/30000) = 150 + 33 = 183
  {
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseAttributes: tianHuaAttributes,
          baseSkills: [testFqhSkill],
          skillOverrides: {
            TEST_TH_FO_SKILL_FQH: { Variant: 'HAO' }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TEST_TH_FO_SKILL_FQH', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const fqhApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TEST_TH_FO_SKILL_FQH');
    const fqhEff = fqhApply?.data?.effect as AppliedEffectConfig;
    assert.equal(fqhEff.Duration, 20);
    assert.equal(fqhEff.BuffEffects.BuffCriticalDamagePercentEffect, 183);
  }

  // Variant HUA: duration 40s, base crit damage 100
  // Final crit damage = 100 + floor(1000000/30000) = 100 + 33 = 133
  {
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseAttributes: tianHuaAttributes,
          baseSkills: [testFqhSkill],
          skillOverrides: {
            TEST_TH_FO_SKILL_FQH: { Variant: 'HUA' }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [{ timeMs: 0, skillId: 'TEST_TH_FO_SKILL_FQH', targetActorId: 'dps' }]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const fqhApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TEST_TH_FO_SKILL_FQH');
    const fqhEff = fqhApply?.data?.effect as AppliedEffectConfig;
    assert.equal(fqhEff.Duration, 40);
    assert.equal(fqhEff.BuffEffects.BuffCriticalDamagePercentEffect, 133);
  }

  // 5. Verify production JLS and FQH are disabled
  {
    const result = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          baseAttributes: tianHuaAttributes,
          baseSkills: [jlsSkill, fqhSkill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 0, skillId: 'TH_FO_SKILL_JLS', targetActorId: 'dps' },
              { timeMs: 500, skillId: 'TH_FO_SKILL_FQH', targetActorId: 'dps' }
            ]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    // Verify JLS applies empty effects
    const jlsApplies = result.events.filter(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_JLS');
    assert.equal(jlsApplies.length, 0); // Completely disabled in scheduleSkillEffects

    // Verify FQH applies empty BuffEffects
    const fqhApply = result.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_FQH');
    assert.ok(fqhApply);
    const fqhEff = fqhApply.data?.effect as AppliedEffectConfig;
    assert.deepEqual(fqhEff.BuffEffects, {}); // Disabled in resolveDynamicEffect
  }

  // 6. Verify Talisman +1 and Level 0 scaling dynamically (JSKW, QSYY, CHFY)
  {
    const baseJskw: Skill = { ...jskwSkill, SkillLevel: undefined };
    const baseQsyy: Skill = { ...qsyySkill, SkillLevel: 0 };
    const chfySkill: Skill = {
      SkillID: 'TY_FO_SKILL_CHFY',
      SkillName: '慈航法愿',
      RequiredClass: 'TIAN_YIN',
      Faction: 'FO',
      SkillImportanceWeight: 1,
      SkillFrequency: 1,
      Cooldown: 0,
      CastTime: 1,
      IsAOE: true,
      ActionType: 'BUFF',
      SkillBonusAttributes: {},
      AppliesEffects: [
        {
          EffectId: 'TY_BUFF_CHFY_FOCUS',
          EffectName: '慈航法愿专注',
          Target: 'TEAM',
          Duration: 3600,
          BuffEffects: {
            BuffFocusPercentEffect: 18
          }
        }
      ]
    };

    const result0 = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          gcdMs: 0,
          baseAttributes: tianHuaAttributes,
          baseSkills: [baseJskw, baseQsyy],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 0, skillId: 'TH_FO_SKILL_JSKW' },
              { timeMs: 200, skillId: 'TH_FO_SKILL_QSYY', targetActorId: 'dps' }
            ]
          }
        },
        {
          actorId: 'support_ty',
          classId: 'TIAN_YIN',
          role: 'SUPPORT',
          gcdMs: 0,
          baseSkills: [chfySkill],
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 400, skillId: 'TY_FO_SKILL_CHFY' }
            ]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const jskwApply0 = result0.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_JSKW');
    const jskwEff0 = jskwApply0?.data?.effect as AppliedEffectConfig;
    assert.equal(jskwEff0.BuffEffects.BuffFocusPercentEffect, 18);

    const qsyyApply0 = result0.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_QSYY');
    const qsyyEff0 = qsyyApply0?.data?.effect as AppliedEffectConfig;
    assert.equal(qsyyEff0.BuffEffects.BuffFocusPercentEffect, 29); // 19 + min(20, 50000/5000) = 29
    assert.equal(qsyyEff0.Duration, 25);

    const chfyApply0 = result0.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TY_FO_SKILL_CHFY');
    const chfyEff0 = chfyApply0?.data?.effect as AppliedEffectConfig;
    assert.equal(chfyEff0.BuffEffects.BuffFocusPercentEffect, 18);

    const result1 = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(1000000),
      actors: [
        {
          actorId: 'support',
          classId: 'TIAN_HUA',
          role: 'SUPPORT',
          gcdMs: 0,
          baseAttributes: tianHuaAttributes,
          baseSkills: [jskwSkill, qsyySkill], // already have SkillLevel: 1
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 0, skillId: 'TH_FO_SKILL_JSKW' },
              { timeMs: 200, skillId: 'TH_FO_SKILL_QSYY', targetActorId: 'dps' }
            ]
          }
        },
        {
          actorId: 'support_ty',
          classId: 'TIAN_YIN',
          role: 'SUPPORT',
          gcdMs: 0,
          baseSkills: [chfySkill],
          skillOverrides: {
            TY_FO_SKILL_CHFY: { SkillLevel: 1 }
          },
          strategy: {
            type: 'SETUP_PHASE',
            actions: [
              { timeMs: 400, skillId: 'TY_FO_SKILL_CHFY' }
            ]
          }
        },
        {
          actorId: 'dps',
          classId: 'TEST_DPS',
          role: 'DPS',
          baseSkills: [dpsSkill],
          strategy: { type: 'MANUAL_TIMELINE', actions: [] }
        }
      ]
    });

    const jskwApply1 = result1.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_JSKW');
    const jskwEff1 = jskwApply1?.data?.effect as AppliedEffectConfig;
    assert.equal(jskwEff1.BuffEffects.BuffFocusPercentEffect, 20);

    const qsyyApply1 = result1.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TH_FO_SKILL_QSYY');
    const qsyyEff1 = qsyyApply1?.data?.effect as AppliedEffectConfig;
    assert.equal(qsyyEff1.BuffEffects.BuffFocusPercentEffect, 32); // 22 + min(20, 50000/5000) = 32
    assert.equal(qsyyEff1.Duration, 26); // duration base 25 + 1 = 26

    const chfyApply1 = result1.events.find(e => e.type === 'BUFF_APPLY' && e.skillId === 'TY_FO_SKILL_CHFY');
    const chfyEff1 = chfyApply1?.data?.effect as AppliedEffectConfig;
    assert.equal(chfyEff1.BuffEffects.BuffFocusPercentEffect, 20);
  }
};

const testZhuShuangSkills = () => {
  const clxxSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_CLXX',
    SkillName: '苍龙啸·玄',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.9,
    SkillFrequency: 0.4,
    Cooldown: 18,
    CastTime: 3,
    IsAOE: false,
    ActionType: 'DAMAGE',
    MaxCharges: 3,
    ChargeReplenishTime: 18,
    HitTiming: { Mode: 'EVENLY_DURING_CAST' },
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 240,
      SkillAttackFixedBonus: 4000,
      MultiHitConfig: { HitCount: 9 }
    }
  };

  const clxSkill: Skill = {
    ...clxxSkill,
    SkillID: 'ZS_XIAN_SKILL_CLX',
    SkillName: '苍龙啸'
  };

  const yyzxXuanSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_YYZC_XUAN',
    SkillName: '鹰扬折冲·玄',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.8,
    SkillFrequency: 0.5,
    Cooldown: 90,
    CastTime: 0.5,
    IsAOE: false,
    ActionType: 'UTILITY',
    CooldownResets: [
      {
        TargetSkillId: 'ZS_XIAN_SKILL_CLXX',
        ResetType: 'REFRESH_CHARGES'
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  const lylzSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_LYLZ',
    SkillName: '临渊敛爪',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.4,
    SkillFrequency: 0.7,
    Cooldown: 0,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'DAMAGE',
    HitTiming: { Mode: 'EVENLY_DURING_CAST' },
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_LONG_NU',
        EffectName: '龙怒',
        Target: 'SELF',
        Duration: 15,
        Stackable: true,
        MaxStacks: 9,
        RefreshOnReapply: true,
        BuffEffects: {}
      }
    ],
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 158,
      SkillAttackFixedBonus: 600,
      MultiHitConfig: { HitCount: 3 }
    }
  };

  const lzyySkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_LZYY',
    SkillName: '龙战于野',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 40,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'BUFF',
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_LZYY_SPEED',
        EffectName: '龙战于野施法速度增益',
        Target: 'SELF',
        Duration: 60,
        BuffEffects: {
          BuffSpeedPercentEffect: 36
        }
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  const zgddSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_ZGDD',
    SkillName: '枕戈待旦',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 60,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'BUFF',
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_ZGDD_SPEED',
        EffectName: '枕戈待旦施法速度增益',
        Target: 'SELF',
        Duration: 24,
        ExclusiveGroup: 'ZS_HASTE_GROUP',
        ExclusivePolicy: 'HIGHEST_EFFECT_VALUE',
        EffectPower: 50,
        BuffEffects: {
          BuffSpeedPercentEffect: 50
        }
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  const qxhsSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_QXHS',
    SkillName: '清啸横朔',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 6,
    CastTime: 1.4,
    IsAOE: false,
    ActionType: 'BUFF',
    FourthGenPresets: {
      "YING_JU": {
        "AppliesEffects": {
          "ZS_BUFF_QXHS_SPEED": {
            "EffectPower": 28,
            "BuffEffects": {
              "BuffSpeedPercentEffect": 28
            }
          }
        }
      },
      "XI_RI": {
        "AppliesEffects": {
          "ZS_BUFF_QXHS_SPEED": {
            "EffectPower": 44,
            "BuffEffects": {
              "BuffSpeedPercentEffect": 44
            }
          }
        }
      }
    },
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_QXHS_SPEED',
        EffectName: '清啸横朔施法速度增益',
        Target: 'SELF',
        Duration: 16,
        ExclusiveGroup: 'ZS_HASTE_GROUP',
        ExclusivePolicy: 'HIGHEST_EFFECT_VALUE',
        EffectPower: 20,
        BuffEffects: {
          BuffSpeedPercentEffect: 20
        }
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  const yzxwSkill: Skill = {
    SkillID: 'ZS_XIAN_SKILL_YZXW',
    SkillName: '云蒸霞蔚',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'XIAN',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 60,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'BUFF',
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_YZXW_MANA',
        EffectName: '云蒸霞蔚真气比例增益',
        Target: 'SELF',
        Duration: 120,
        BuffEffects: {
          BuffManaPercentEffect: 30
        }
      },
      {
        EffectId: 'ZS_BUFF_YZXW_CRIT_DMG',
        EffectName: '云蒸霞蔚爆伤与持续时间增益',
        Target: 'SELF',
        Duration: 20,
        BuffEffects: {
          BuffCriticalDamagePercentEffect: 50
        }
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  // Mo specific skills
  const moLylzSkill: Skill = {
    SkillID: 'ZS_MO_SKILL_LYLZ',
    SkillName: '临渊敛爪',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'MO',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 0,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'DAMAGE',
    HitTiming: { Mode: 'EVENLY_DURING_CAST' },
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 158,
      SkillAttackFixedBonus: 600,
      MultiHitConfig: { HitCount: 3 }
    }
  };

  const moSy2Skill: Skill = {
    SkillID: 'ZS_MO_SKILL_SY2',
    SkillName: '山雨欲来II',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'MO',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 6,
    CastTime: 2,
    IsAOE: false,
    ActionType: 'DAMAGE',
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 400,
      MultiHitConfig: { HitCount: 6 }
    }
  };

  const moClxsSkill: Skill = {
    SkillID: 'ZS_MO_SKILL_CLXS',
    SkillName: '苍龙啸·煞',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'MO',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 18,
    CastTime: 3,
    IsAOE: false,
    ActionType: 'DAMAGE',
    MaxCharges: 3,
    ChargeReplenishTime: 18,
    HitTiming: { Mode: 'EVENLY_DURING_CAST' },
    SkillBonusAttributes: {
      SkillAttackPercentBonus: 240,
      MultiHitConfig: { HitCount: 9 }
    }
  };

  const moClxSkill: Skill = {
    ...moClxsSkill,
    SkillID: 'ZS_MO_SKILL_CLX',
    SkillName: '苍龙啸'
  };

  const moYzxwSkill: Skill = {
    SkillID: 'ZS_MO_SKILL_YZXW',
    SkillName: '云蒸霞蔚',
    RequiredClass: 'ZHU_SHUANG',
    Faction: 'MO',
    SkillImportanceWeight: 0.5,
    SkillFrequency: 0.5,
    Cooldown: 60,
    CastTime: 1,
    IsAOE: false,
    ActionType: 'BUFF',
    AppliesEffects: [
      {
        EffectId: 'ZS_BUFF_YZXW_MANA',
        EffectName: '云蒸霞蔚真气比例增益',
        Target: 'SELF',
        Duration: 120,
        BuffEffects: {
          BuffManaPercentEffect: 30
        }
      }
    ],
    SkillBonusAttributes: { SkillDamageBonus: 1 }
  };

  const baseAttr: CharacterAttributes = {
    CharacterMinAttack: 10000,
    CharacterMaxAttack: 10000,
    CharacterDefense: 2000,
    CharacterHealth: 100000,
    CharacterMana: 100000,
    CharacterCriticalHitDamagePercent: 300,
    CharacterMonsterDamageIncreasePercent: 10,
    CharacterOnePercentMana: 1200
  };

  // Test 1: Charge consumption & Ying Yang Zhe Chong refresh charges
  {
    const originalRandom = Math.random;
    try {
      Math.random = () => 1;
      const result = runSimulation({
        maxTimeMs: 26000,
        boss: baseBoss(100000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [clxxSkill, yyzxXuanSkill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 3 -> 2
                { timeMs: 3500, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 2 -> 1
                { timeMs: 7000, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 1 -> 0
                { timeMs: 10500, skillId: 'ZS_XIAN_SKILL_CLXX', onUnavailable: 'SKIP' }, // 0 charges, should skip.
                { timeMs: 11000, skillId: 'ZS_XIAN_SKILL_YYZC_XUAN' }, // resets charges to 3
                { timeMs: 12000, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 3 -> 2, starts a new recharge timer.
                { timeMs: 15500, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 2 -> 1.
                { timeMs: 19000, skillId: 'ZS_XIAN_SKILL_CLXX' }, // charges 1 -> 0.
                { timeMs: 22500, skillId: 'ZS_XIAN_SKILL_CLXX', onUnavailable: 'SKIP' } // Old pre-reset recharge must not refill this.
              ]
            }
          }
        ]
      });

      const casts = result.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_XIAN_SKILL_CLXX');
      assert.equal(casts.length, 6); // 0s, 3.5s, 7s, 12s, 15.5s, 19s. The 10.5s and 22.5s casts are skipped.
      assert.ok(result.events.some(e => e.type === 'COOLDOWN_READY' && e.status === 'SKIPPED' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 18000));
    } finally {
      Math.random = originalRandom;
    }
  }

  // Test 1b: Xian Cang Long Xiao Xuan does not use the 30% self-refresh rule
  {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.1;
      const result = runSimulation({
        maxTimeMs: 12000,
        boss: baseBoss(10000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [clxxSkill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_XIAN_SKILL_CLXX' },
                { timeMs: 3500, skillId: 'ZS_XIAN_SKILL_CLXX' },
                { timeMs: 7000, skillId: 'ZS_XIAN_SKILL_CLXX' },
                { timeMs: 10500, skillId: 'ZS_XIAN_SKILL_CLXX', onUnavailable: 'SKIP' }
              ]
            }
          }
        ]
      });

      const casts = result.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_XIAN_SKILL_CLXX');
      assert.equal(casts.length, 3);
      assert.ok(result.events.some(e => e.type === 'CAST_START' && e.status === 'SKIPPED' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 10500));
    } finally {
      Math.random = originalRandom;
    }
  }

  // Test 1c: Xian Cang Long Xiao has a 30% chance to refresh itself on cast complete
  {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.1;
      const result = runSimulation({
        maxTimeMs: 12000,
        boss: baseBoss(10000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [clxSkill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_XIAN_SKILL_CLX' },
                { timeMs: 3500, skillId: 'ZS_XIAN_SKILL_CLX' },
                { timeMs: 7000, skillId: 'ZS_XIAN_SKILL_CLX' },
                { timeMs: 10500, skillId: 'ZS_XIAN_SKILL_CLX', onUnavailable: 'SKIP' }
              ]
            }
          }
        ]
      });

      const casts = result.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_XIAN_SKILL_CLX');
      assert.equal(casts.length, 4);
    } finally {
      Math.random = originalRandom;
    }
  }

  // Test 2: Haste calculation, swift exclusivity and Long Zhan multiplier
  {
    const result = runSimulation({
      maxTimeMs: 10000,
      boss: baseBoss(10000000),
      actors: [
        {
          actorId: 'dps',
          classId: 'ZHU_SHUANG',
          role: 'DPS',
          baseAttributes: baseAttr,
          baseSkills: [clxxSkill, lzyySkill, zgddSkill, qxhsSkill],
          skillOverrides: {
            ZS_XIAN_SKILL_QXHS: { FourthGenQuality: 'XI_RI' }
          },
          strategy: {
            type: 'MANUAL_TIMELINE',
            actions: [
              { timeMs: 0, skillId: 'ZS_XIAN_SKILL_LZYY' }, // independent +36% speed multiplier
              { timeMs: 1500, skillId: 'ZS_XIAN_SKILL_ZGDD' }, // swift locked at +50%. Cast time: 3000 / (1.5 * 1.36) = 1471ms
              { timeMs: 3000, skillId: 'ZS_XIAN_SKILL_CLXX' }, // Cast 1
              { timeMs: 5000, skillId: 'ZS_XIAN_SKILL_QXHS' }, // lower swift does not overwrite ZGDD. Cast time remains 1471ms
              { timeMs: 6500, skillId: 'ZS_XIAN_SKILL_CLXX' } // Cast 2
            ]
          }
        }
      ]
    });

    const cast1Start = result.events.find(e => e.type === 'CAST_START' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 3000);
    const cast1End = result.events.find(e => e.type === 'CAST_COMPLETE' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs > 3000);
    assert.ok(cast1Start && cast1End);
    assert.equal(cast1End.timeMs - cast1Start.timeMs, 1471);

    const cast2Start = result.events.find(e => e.type === 'CAST_START' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 6500);
    const cast2End = result.events.find(e => e.type === 'CAST_COMPLETE' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs > 6500);
    assert.ok(cast2Start && cast2End);
    assert.equal(cast2End.timeMs - cast2Start.timeMs, 1471);
  }

  // Test 2b: Xi Ri QXHS swift stacks multiplicatively with Long Zhan when ZGDD is absent
  {
    const result = runSimulation({
      maxTimeMs: 8000,
      boss: baseBoss(10000000),
      actors: [
        {
          actorId: 'dps',
          classId: 'ZHU_SHUANG',
          role: 'DPS',
          baseAttributes: baseAttr,
          baseSkills: [clxxSkill, lzyySkill, qxhsSkill],
          skillOverrides: {
            ZS_XIAN_SKILL_QXHS: { FourthGenQuality: 'XI_RI' }
          },
          strategy: {
            type: 'MANUAL_TIMELINE',
            actions: [
              { timeMs: 0, skillId: 'ZS_XIAN_SKILL_LZYY' },
              { timeMs: 1500, skillId: 'ZS_XIAN_SKILL_QXHS' },
              { timeMs: 3000, skillId: 'ZS_XIAN_SKILL_CLXX' }
            ]
          }
        }
      ]
    });

    const castStart = result.events.find(e => e.type === 'CAST_START' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 3000);
    const castEnd = result.events.find(e => e.type === 'CAST_COMPLETE' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs > 3000);
    assert.ok(castStart && castEnd);
    assert.equal(castEnd.timeMs - castStart.timeMs, 1532);
  }

  // Test 3: LYLZ + Long Nu (Xian)
  {
    const originalRandom = Math.random;
    try {
      // Mock Math.random to return 0.1, making 30% check succeed
      Math.random = () => 0.1;

      const result = runSimulation({
        maxTimeMs: 10000,
        boss: baseBoss(10000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [clxxSkill, lylzSkill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_XIAN_SKILL_LYLZ' }, // adds Long Nu
                { timeMs: 1500, skillId: 'ZS_XIAN_SKILL_CLXX' } // consumes Long Nu on hit, damage +300% attack pct
              ]
            }
          }
        ]
      });

      const castClxx = result.events.find(e => e.type === 'CAST_START' && e.skillId === 'ZS_XIAN_SKILL_CLXX' && e.timeMs === 1500);
      assert.ok(castClxx);
      const finalState = result.events.find(e => e.type === 'CAST_COMPLETE' && e.skillId === 'ZS_XIAN_SKILL_CLXX');
      assert.ok(finalState);

      const hitRecords = result.hitRecords.filter(r => r.SkillId === 'ZS_XIAN_SKILL_CLXX');
      assert.equal(hitRecords.length, 9);
      // Hit 1 should have high damage (>= 204000) because of the +300% attack percent bonus
      assert.ok(hitRecords[0].AvgDamage >= 204000);
      // Hit 2 should have much lower damage (< 150000) since there was only 1 stack of Long Nu and it got consumed by hit 1
      assert.ok(hitRecords[1].AvgDamage < 150000);
    } finally {
      Math.random = originalRandom;
    }
  }

  // Test 4: Mo LYLZ + SY2 add one charge to ordinary Cang Long Xiao only (Mo)
  {
    const originalRandom = Math.random;
    try {
      Math.random = () => 0.05;

      const clxResult = runSimulation({
        maxTimeMs: 25000,
        boss: baseBoss(10000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [moClxSkill, moLylzSkill, moSy2Skill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_MO_SKILL_CLX' }, // charges: 3 -> 2
                { timeMs: 3500, skillId: 'ZS_MO_SKILL_SY2' }, // Cast starts at 3500, completes at 5500. Charges: 2 -> 3 (SY2 completes)
                { timeMs: 6000, skillId: 'ZS_MO_SKILL_CLX' }, // charges: 3 -> 2
                { timeMs: 9500, skillId: 'ZS_MO_SKILL_CLX' }, // charges: 2 -> 1
                { timeMs: 13000, skillId: 'ZS_MO_SKILL_LYLZ' }, // Cast starts at 13000, hit 3 at 14000. 15% chance succeeds, charges: 1 -> 2
                { timeMs: 15000, skillId: 'ZS_MO_SKILL_CLX' }, // charges: 2 -> 1
                { timeMs: 18500, skillId: 'ZS_MO_SKILL_CLX' }, // charges: 1 -> 0
                { timeMs: 22000, skillId: 'ZS_MO_SKILL_CLX', onUnavailable: 'SKIP' }, // waits for the 6000ms recharge at 24000ms
                { timeMs: 23000, skillId: 'ZS_MO_SKILL_CLX', onUnavailable: 'SKIP' } // should be skipped! charges: 0
              ]
            }
          }
        ]
      });
      const clxCasts = clxResult.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_MO_SKILL_CLX');
      assert.equal(clxCasts.length, 5); // 0s, 6s, 9.5s, 15s, 18.5s
      assert.ok(clxResult.events.some(e => e.type === 'CAST_START' && e.status === 'SKIPPED' && e.skillId === 'ZS_MO_SKILL_CLX' && e.timeMs === 22000));
      const sy2Casts = clxResult.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_MO_SKILL_SY2');
      assert.equal(sy2Casts.length, 1);
      const moLylzHits = clxResult.hitRecords.filter(record => record.SkillId === 'ZS_MO_SKILL_LYLZ');
      assert.equal(moLylzHits.length, 3);
      assert.ok(moLylzHits[2].AvgDamage > moLylzHits[1].AvgDamage);

      const clxsResult = runSimulation({
        maxTimeMs: 18000,
        boss: baseBoss(10000000),
        actors: [
          {
            actorId: 'dps',
            classId: 'ZHU_SHUANG',
            role: 'DPS',
            baseAttributes: baseAttr,
            baseSkills: [moClxsSkill, moLylzSkill, moSy2Skill],
            strategy: {
              type: 'MANUAL_TIMELINE',
              actions: [
                { timeMs: 0, skillId: 'ZS_MO_SKILL_CLXS' },
                { timeMs: 3500, skillId: 'ZS_MO_SKILL_SY2' },
                { timeMs: 6000, skillId: 'ZS_MO_SKILL_CLXS' },
                { timeMs: 9500, skillId: 'ZS_MO_SKILL_CLXS' },
                { timeMs: 13000, skillId: 'ZS_MO_SKILL_LYLZ' },
                { timeMs: 15000, skillId: 'ZS_MO_SKILL_CLXS', onUnavailable: 'SKIP' }
              ]
            }
          }
        ]
      });
      const clxsCasts = clxsResult.events.filter(e => e.type === 'CAST_START' && e.status === 'PROCESSED' && e.skillId === 'ZS_MO_SKILL_CLXS');
      assert.equal(clxsCasts.length, 3);
      assert.ok(clxsResult.events.some(e => e.type === 'CAST_START' && e.status === 'SKIPPED' && e.skillId === 'ZS_MO_SKILL_CLXS' && e.timeMs === 15000));
    } finally {
      Math.random = originalRandom;
    }
  }

  // Test 5: YZXW Mana and Crit Damage Dynamic Scaling
  {
    const resultXianXiRi = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(10000000),
      actors: [
        {
          actorId: 'dps',
          classId: 'ZHU_SHUANG',
          role: 'DPS',
          baseAttributes: baseAttr,
          baseSkills: [yzxwSkill],
          skillOverrides: {
            ZS_XIAN_SKILL_YZXW: { FourthGenQuality: 'XI_RI' }
          },
          strategy: {
            type: 'MANUAL_TIMELINE',
            actions: [{ timeMs: 0, skillId: 'ZS_XIAN_SKILL_YZXW' }]
          }
        }
      ]
    });

    const applyMana = resultXianXiRi.events.find(e => e.type === 'BUFF_APPLY' && (e.data as any)?.effect?.EffectId === 'ZS_BUFF_YZXW_MANA');
    const applyCrit = resultXianXiRi.events.find(e => e.type === 'BUFF_APPLY' && (e.data as any)?.effect?.EffectId === 'ZS_BUFF_YZXW_CRIT_DMG');
    assert.ok(applyMana && applyCrit);
    assert.equal((applyMana.data as any).effect.BuffEffects.BuffManaPercentEffect, 90);
    assert.equal((applyCrit.data as any).effect.Duration, 40);

    const resultMoHaoYue = runSimulation({
      maxTimeMs: 2000,
      boss: baseBoss(10000000),
      actors: [
        {
          actorId: 'dps',
          classId: 'ZHU_SHUANG',
          role: 'DPS',
          baseAttributes: baseAttr,
          baseSkills: [moYzxwSkill],
          skillOverrides: {
            ZS_MO_SKILL_YZXW: { FourthGenQuality: 'HAO_YUE' }
          },
          strategy: {
            type: 'MANUAL_TIMELINE',
            actions: [{ timeMs: 0, skillId: 'ZS_MO_SKILL_YZXW' }]
          }
        }
      ]
    });

    const applyManaMo = resultMoHaoYue.events.find(e => e.type === 'BUFF_APPLY' && (e.data as any)?.effect?.EffectId === 'ZS_BUFF_YZXW_MANA');
    const applyCritMo = resultMoHaoYue.events.find(e => e.type === 'BUFF_APPLY' && (e.data as any)?.effect?.EffectId === 'ZS_BUFF_YZXW_CRIT_DMG');
    assert.ok(applyManaMo);
    assert.ok(!applyCritMo);
    assert.equal((applyManaMo.data as any).effect.BuffEffects.BuffManaPercentEffect, 60);
  }
};

const main = () => {
  console.log('=== 启动 阶段C 自动测试 ===');
  testTimelinePriority();
  console.log('- Timeline 同毫秒事件优先级 [SUCCESS]');
  testEffectExclusiveAndStaleExpiry();
  console.log('- EffectManager 互斥覆盖与旧过期事件校验 [SUCCESS]');
  testSameSkillEffectReplacementRules();
  console.log('- 同技能同效果跨施法者覆盖规则 [SUCCESS]');
  testManualTimelineMultiHitAndBuffExpiry();
  console.log('- 手动时间轴、多段命中、Buff 过期卡段 [SUCCESS]');
  testFixedRotation();
  console.log('- 固定技能循环 [SUCCESS]');
  testSkillBarAndBossDeathTruncation();
  console.log('- 法宝栏策略与 Boss 死亡截断 [SUCCESS]');
  testSkillExpirySkipsRecentCast();
  console.log('- 技能判定过期时间跳过最近释放技能 [SUCCESS]');
  testDamageCompression();
  console.log('- Boss 伤害压缩 [SUCCESS]');
  testChargesAndRecovery();
  console.log('- 充能扣减与恢复 [SUCCESS]');
  testCooldownResetRefreshesCharges();
  console.log('- 功能技能刷新充能 [SUCCESS]');
  testAutoPhaseTransition();
  console.log('- 自动多阶段状态流转 [SUCCESS]');
  testFourthGenDynamicScalingAffectsDamage();
  console.log('- 四代动态缩放字段参与运行时结算 [SUCCESS]');
  testYanBingJiuHunDynamicDoubler();
  console.log('- 炎兵灸魂动态绿点翻倍结算 [SUCCESS]');
  testAttributeCaps();
  console.log('- 角色属性数据上限截断结算 [SUCCESS]');
  testOnePercentAttributesAffectDamageBuffs();
  console.log('- 1% 属性折算参与静态与时间轴伤害结算 [SUCCESS]');
  testZhaoMingSkills();
  console.log('- 昭冥技能（停云凝风时间延长、日月弘光自动流转、跗骨生灵暂禁用占位） [SUCCESS]');
  testTianHuaSkills();
  console.log('- 天华技能（鸣泉、秋声、云水II、净莲生不同等级、凤求凰多变体及与摩柯心经互斥判定） [SUCCESS]');
  testZhuShuangSkills();
  console.log('- 逐霜技能（充能、重置、迅疾压缩、龙怒附加攻击、苍龙啸概率刷新、魔临渊敛爪与山雨II联动、云蒸霞蔚动态缩放） [SUCCESS]');
  testMissingBossHealthFailsClearly();
  console.log('- 缺失 Boss 血量明确报错 [SUCCESS]');
  console.log('=== 阶段C 所有测试项目均顺利通过验证！ ===');
};

main();

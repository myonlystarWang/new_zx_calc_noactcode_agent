import type {
  AllSkills,
  Skill,
  AppliedEffectConfig,
  Monster,
  PlayerSkillOverride
} from './types.js';
import { BUFF_EFFECT_KEYS, CHARACTER_ATTRIBUTE_KEYS, isBuffEffectKey, isCharacterAttributeKey } from './field_keys.js';

export interface SchemaValidationIssue {
  field: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
}

export function validateSkillsData(allSkills: AllSkills): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  const skillIds = new Set<string>();

  // 1. Gather all skill IDs first for reference checks
  for (const [classId, classSkills] of Object.entries(allSkills)) {
    for (const [faction, skills] of Object.entries(classSkills)) {
      if (!Array.isArray(skills)) {
        issues.push({
          field: `skills.${classId}.${faction}`,
          message: `技能列表应为数组`,
          severity: 'ERROR'
        });
        continue;
      }
      skills.forEach(skill => {
        if (skill && skill.SkillID) {
          if (skillIds.has(skill.SkillID)) {
            issues.push({
              field: `skills.${skill.SkillID}`,
              message: `重复的技能 ID: ${skill.SkillID}`,
              severity: 'ERROR'
            });
          }
          skillIds.add(skill.SkillID);
        }
      });
    }
  }

  // 2. Validate each skill in detail
  for (const [classId, classSkills] of Object.entries(allSkills)) {
    for (const [faction, skills] of Object.entries(classSkills)) {
      if (!Array.isArray(skills)) continue;

      skills.forEach((skill, idx) => {
        const skillEffectIds = new Set<string>();
        const path = `skills.${classId}.${faction}[${idx}]`;

        if (!skill.SkillID) {
          issues.push({
            field: `${path}.SkillID`,
            message: `缺少 SkillID`,
            severity: 'ERROR'
          });
          return;
        }

        const skillPath = `skills.${skill.SkillID} (${skill.SkillName || '未知'})`;

        if (!skill.SkillName) {
          issues.push({
            field: `${skillPath}.SkillName`,
            message: `缺少 SkillName`,
            severity: 'WARNING'
          });
        }

        if (skill.Cooldown === undefined || skill.Cooldown < 0) {
          issues.push({
            field: `${skillPath}.Cooldown`,
            message: `CD (${skill.Cooldown}) 应为非负数`,
            severity: 'ERROR'
          });
        }

        if (skill.CastTime === undefined || skill.CastTime < 0) {
          issues.push({
            field: `${skillPath}.CastTime`,
            message: `施法时间 (${skill.CastTime}) 应为非负数`,
            severity: 'ERROR'
          });
        }

        validateOptionalNonNegativeNumber(
          skill.BuffDurationExtensionSeconds,
          `${skillPath}.BuffDurationExtensionSeconds`,
          'BuffDurationExtensionSeconds 应为非负数',
          issues
        );

        // Validate ActionType
        if (skill.ActionType) {
          const validTypes = ['DAMAGE', 'BUFF', 'DEBUFF', 'UTILITY'];
          if (!validTypes.includes(skill.ActionType)) {
            issues.push({
              field: `${skillPath}.ActionType`,
              message: `未知的 ActionType: "${skill.ActionType}"，应为: DAMAGE, BUFF, DEBUFF, UTILITY 之一`,
              severity: 'ERROR'
            });
          }
        }

        // Validate HitTimingConfig
        if (skill.HitTiming) {
          const timing = skill.HitTiming;
          if (timing.Mode === 'CUSTOM' && (!timing.Offsets || timing.Offsets.length === 0)) {
            issues.push({
              field: `${skillPath}.HitTiming.Offsets`,
              message: `CUSTOM 模式下必须配置 Offsets 秒数偏移数组`,
              severity: 'ERROR'
            });
          }
        }

        // Validate AppliesEffects
        if (skill.AppliesEffects) {
          if (!Array.isArray(skill.AppliesEffects)) {
            issues.push({
              field: `${skillPath}.AppliesEffects`,
              message: `AppliesEffects 应为数组`,
              severity: 'ERROR'
            });
          } else {
            skill.AppliesEffects.forEach((effect, eIdx) => {
              validateAppliedEffect(effect, `${skillPath}.AppliesEffects[${eIdx}]`, skillEffectIds, issues);
            });
          }
        }

        // Validate CooldownResets
        if (skill.CooldownResets) {
          if (!Array.isArray(skill.CooldownResets)) {
            issues.push({
              field: `${skillPath}.CooldownResets`,
              message: `CooldownResets 应为数组`,
              severity: 'ERROR'
            });
          } else {
            skill.CooldownResets.forEach((reset, rIdx) => {
              const resetPath = `${skillPath}.CooldownResets[${rIdx}]`;
              if (!reset.TargetSkillId) {
                issues.push({
                  field: `${resetPath}.TargetSkillId`,
                  message: `缺少 TargetSkillId`,
                  severity: 'ERROR'
                });
              } else if (!skillIds.has(reset.TargetSkillId)) {
                issues.push({
                  field: `${resetPath}.TargetSkillId`,
                  message: `重置的目标技能不存在: "${reset.TargetSkillId}"`,
                  severity: 'WARNING'
                });
              }

              if (reset.ResetType !== 'REFRESH_CHARGES' && reset.ResetType !== 'REDUCE_COOLDOWN') {
                issues.push({
                  field: `${resetPath}.ResetType`,
                  message: `无效的 ResetType: "${reset.ResetType}"`,
                  severity: 'ERROR'
                });
              }
            });
          }
        }

        // Validate MultiPhaseConfig
        if (skill.MultiPhaseConfig) {
          const mp = skill.MultiPhaseConfig;
          if (!mp.Phases || !Array.isArray(mp.Phases) || mp.Phases.length === 0) {
            issues.push({
              field: `${skillPath}.MultiPhaseConfig.Phases`,
              message: `Phases 应为非空阶段数组`,
              severity: 'ERROR'
            });
          } else {
            mp.Phases.forEach((phase, pIdx) => {
              const phasePath = `${skillPath}.MultiPhaseConfig.Phases[${pIdx}]`;
              if (phase.PhaseIndex !== pIdx + 1) {
                issues.push({
                  field: `${phasePath}.PhaseIndex`,
                  message: `PhaseIndex (${phase.PhaseIndex}) 应为 1-indexed 并按顺序升序，预期为 ${pIdx + 1}`,
                  severity: 'WARNING'
                });
              }
              if (phase.Duration <= 0) {
                issues.push({
                  field: `${phasePath}.Duration`,
                  message: `阶段持续时间 (${phase.Duration}) 应大于 0`,
                  severity: 'ERROR'
                });
              }
              if (!phase.AppliesEffects || !Array.isArray(phase.AppliesEffects) || phase.AppliesEffects.length === 0) {
                issues.push({
                  field: `${phasePath}.AppliesEffects`,
                  message: `阶段挂载效果 AppliesEffects 应为非空数组`,
                  severity: 'ERROR'
                });
              } else {
                phase.AppliesEffects.forEach((effect, peIdx) => {
                  validateAppliedEffect(effect, `${phasePath}.AppliesEffects[${peIdx}]`, skillEffectIds, issues);
                });
              }
            });
          }
        }

        validateFourthGenPresets(skill, skillPath, issues);
      });
    }
  }

  return issues;
}

export function validateMonstersData(monstersByDungeon: Record<string, Monster[]>): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  if (!isRecord(monstersByDungeon)) {
    issues.push({
      field: 'monstersByDungeon',
      message: 'Boss 数据应为按 DungeonID 索引的对象',
      severity: 'ERROR'
    });
    return issues;
  }

  for (const [dungeonId, monsters] of Object.entries(monstersByDungeon)) {
    const dungeonPath = `monstersByDungeon.${dungeonId}`;
    if (!Array.isArray(monsters)) {
      issues.push({
        field: dungeonPath,
        message: '副本 Boss 列表应为数组',
        severity: 'ERROR'
      });
      continue;
    }

    const monsterIds = new Set<string>();
    monsters.forEach((monster, idx) => {
      const path = `${dungeonPath}[${idx}]`;
      validateMonster(monster, path, monsterIds, issues);
    });
  }

  return issues;
}

function validateAppliedEffect(
  effect: AppliedEffectConfig,
  effectPath: string,
  effectIds: Set<string>,
  issues: SchemaValidationIssue[]
) {
  if (!effect.EffectId) {
    issues.push({
      field: `${effectPath}.EffectId`,
      message: `缺少 EffectId`,
      severity: 'ERROR'
    });
    return;
  }

  const path = `${effectPath} (${effect.EffectId})`;

  if (effectIds.has(effect.EffectId)) {
    issues.push({
      field: `${path}.EffectId`,
      message: `重复的 EffectId: "${effect.EffectId}"`,
      severity: 'ERROR'
    });
  }
  effectIds.add(effect.EffectId);

  if (!effect.EffectName) {
    issues.push({
      field: `${path}.EffectName`,
      message: `缺少 EffectName`,
      severity: 'WARNING'
    });
  }

  const validTargets = ['SELF', 'ALLY', 'TEAM', 'ENEMY'];
  if (!effect.Target || !validTargets.includes(effect.Target)) {
    issues.push({
      field: `${path}.Target`,
      message: `无效的目标 Target: "${effect.Target}"，必须为 SELF, ALLY, TEAM, ENEMY 之一`,
      severity: 'ERROR'
    });
  }

  if (effect.Duration === undefined || effect.Duration <= 0) {
    issues.push({
      field: `${path}.Duration`,
      message: `状态持续时间 (${effect.Duration}) 应为正数`,
      severity: 'ERROR'
    });
  }

  // Validate Exclusivity
  if (effect.ExclusiveGroup) {
    const validPolicies = ['MANUAL_PRIORITY', 'HIGHEST_EFFECT_VALUE', 'NO_OVERWRITE'];
    if (!effect.ExclusivePolicy || !validPolicies.includes(effect.ExclusivePolicy)) {
      issues.push({
        field: `${path}.ExclusivePolicy`,
        message: `挂载了互斥组但缺少或配置了非法的 ExclusivePolicy: "${effect.ExclusivePolicy}"`,
        severity: 'ERROR'
      });
    } else {
      if (effect.ExclusivePolicy === 'MANUAL_PRIORITY' && effect.Priority === undefined) {
        issues.push({
          field: `${path}.Priority`,
          message: `MANUAL_PRIORITY 互斥策略下缺少必填的 Priority 优先级权重`,
          severity: 'ERROR'
        });
      }
      if (effect.ExclusivePolicy === 'HIGHEST_EFFECT_VALUE' && effect.EffectPower === undefined) {
        issues.push({
          field: `${path}.EffectPower`,
          message: `HIGHEST_EFFECT_VALUE 互斥策略下缺少必填的 EffectPower 效果强弱数值`,
          severity: 'ERROR'
        });
      }
    }
  }

  if (!effect.BuffEffects || typeof effect.BuffEffects !== 'object') {
    issues.push({
      field: `${path}.BuffEffects`,
      message: `缺少具体属性增益字段 BuffEffects 对象`,
      severity: 'ERROR'
    });
  } else {
    validateBuffEffects(effect.BuffEffects, `${path}.BuffEffects`, issues);
  }

  validateDynamicScalingFields(effect, path, issues);
}

function validateMonster(
  monster: Monster,
  path: string,
  monsterIds: Set<string>,
  issues: SchemaValidationIssue[]
) {
  if (!isRecord(monster)) {
    issues.push({
      field: path,
      message: 'Boss 条目应为对象',
      severity: 'ERROR'
    });
    return;
  }

  if (!monster.MonsterID) {
    issues.push({
      field: `${path}.MonsterID`,
      message: '缺少 MonsterID',
      severity: 'ERROR'
    });
  } else if (monsterIds.has(monster.MonsterID)) {
    issues.push({
      field: `${path}.MonsterID`,
      message: `同一副本内重复的 MonsterID: "${monster.MonsterID}"`,
      severity: 'ERROR'
    });
  } else {
    monsterIds.add(monster.MonsterID);
  }

  if (!monster.MonsterName) {
    issues.push({
      field: `${path}.MonsterName`,
      message: '缺少 MonsterName',
      severity: 'WARNING'
    });
  }

  validateRequiredNonNegativeNumber(
    monster.DungeonLevel,
    `${path}.DungeonLevel`,
    'DungeonLevel 应为非负数',
    issues
  );

  if (!isRecord(monster.MonsterAttributeModifiers)) {
    issues.push({
      field: `${path}.MonsterAttributeModifiers`,
      message: 'MonsterAttributeModifiers 应为对象',
      severity: 'ERROR'
    });
    return;
  }

  const attrs = monster.MonsterAttributeModifiers;
  validateRequiredNonNegativeNumber(
    attrs.MonsterCriticalDamagePercentReduction,
    `${path}.MonsterAttributeModifiers.MonsterCriticalDamagePercentReduction`,
    'MonsterCriticalDamagePercentReduction 应为非负数',
    issues
  );
  validateOptionalPercentRangeNumber(
    attrs.DamageCompressionPercent,
    `${path}.MonsterAttributeModifiers.DamageCompressionPercent`,
    'DamageCompressionPercent 应为 0 到 100 之间的数字',
    issues
  );
  validateOptionalNonNegativeNumber(
    attrs.MonsterAttack,
    `${path}.MonsterAttributeModifiers.MonsterAttack`,
    'MonsterAttack 应为非负数',
    issues
  );
  validateOptionalNonNegativeNumber(
    attrs.MonsterDefense,
    `${path}.MonsterAttributeModifiers.MonsterDefense`,
    'MonsterDefense 应为非负数',
    issues
  );
  validateOptionalPositiveNumber(
    attrs.MonsterHealth,
    `${path}.MonsterAttributeModifiers.MonsterHealth`,
    'MonsterHealth 应大于 0',
    issues
  );
  validateOptionalNonNegativeNumber(
    attrs.MonsterCriticalHitRateReduction,
    `${path}.MonsterAttributeModifiers.MonsterCriticalHitRateReduction`,
    'MonsterCriticalHitRateReduction 应为非负数',
    issues
  );
}

function validateFourthGenPresets(
  skill: Skill,
  skillPath: string,
  issues: SchemaValidationIssue[]
) {
  if (skill.FourthGenPresets === undefined) return;

  if (!isRecord(skill.FourthGenPresets)) {
    issues.push({
      field: `${skillPath}.FourthGenPresets`,
      message: `FourthGenPresets 应为四代品质预设对象`,
      severity: 'ERROR'
    });
    return;
  }

  const validQualities = new Set(['YING_JU', 'HAO_YUE', 'XI_RI']);
  const baseEffectIds = new Set((skill.AppliesEffects ?? []).map(effect => effect.EffectId).filter(Boolean));

  for (const [quality, presetValue] of Object.entries(skill.FourthGenPresets)) {
    const presetPath = `${skillPath}.FourthGenPresets.${quality}`;
    if (!validQualities.has(quality)) {
      issues.push({
        field: presetPath,
        message: `未知四代品质 "${quality}"，应为 YING_JU, HAO_YUE, XI_RI 之一`,
        severity: 'ERROR'
      });
    }

    if (!isRecord(presetValue)) {
      issues.push({
        field: presetPath,
        message: `四代品质预设应为对象`,
        severity: 'ERROR'
      });
      continue;
    }

    const preset = presetValue as Partial<PlayerSkillOverride>;
    validateOptionalNonNegativeNumber(preset.Cooldown, `${presetPath}.Cooldown`, '四代预设 Cooldown 应为非负数', issues);
    validateOptionalNonNegativeNumber(preset.CastTime, `${presetPath}.CastTime`, '四代预设施法时间应为非负数', issues);
    validateOptionalPositiveNumber(preset.MaxCharges, `${presetPath}.MaxCharges`, '四代预设 MaxCharges 应大于 0', issues);
    validateOptionalNonNegativeNumber(
      preset.ChargeReplenishTime,
      `${presetPath}.ChargeReplenishTime`,
      '四代预设 ChargeReplenishTime 应为非负数',
      issues
    );
    validateOptionalNonNegativeNumber(
      preset.BuffDurationExtensionSeconds,
      `${presetPath}.BuffDurationExtensionSeconds`,
      '四代预设 BuffDurationExtensionSeconds 应为非负数',
      issues
    );

    if (preset.FourthGenQuality !== undefined) {
      issues.push({
        field: `${presetPath}.FourthGenQuality`,
        message: `FourthGenQuality 应配置在玩家 profile 覆盖中，不应嵌套在 FourthGenPresets 内`,
        severity: 'WARNING'
      });
    }

    if (preset.AppliesEffects === undefined) continue;

    if (!isRecord(preset.AppliesEffects)) {
      issues.push({
        field: `${presetPath}.AppliesEffects`,
        message: `四代预设 AppliesEffects 应为按 EffectId 索引的对象`,
        severity: 'ERROR'
      });
      continue;
    }

    for (const [effectId, effectOverride] of Object.entries(preset.AppliesEffects)) {
      const effectOverridePath = `${presetPath}.AppliesEffects.${effectId}`;

      if (!baseEffectIds.has(effectId)) {
        issues.push({
          field: effectOverridePath,
          message: `四代预设引用了不存在的基础 EffectId: "${effectId}"`,
          severity: 'ERROR'
        });
      }

      if (!isRecord(effectOverride)) {
        issues.push({
          field: effectOverridePath,
          message: `四代预设的效果覆盖应为对象`,
          severity: 'ERROR'
        });
        continue;
      }

      const partialEffect = effectOverride as Partial<AppliedEffectConfig>;
      if (partialEffect.BuffEffects !== undefined) {
        validateBuffEffects(partialEffect.BuffEffects, `${effectOverridePath}.BuffEffects`, issues);
      }
      validateDynamicScalingFields(partialEffect, effectOverridePath, issues);
    }
  }
}

function validateBuffEffects(
  effects: unknown,
  path: string,
  issues: SchemaValidationIssue[]
) {
  if (!isRecord(effects)) {
    issues.push({
      field: path,
      message: `BuffEffects 应为对象`,
      severity: 'ERROR'
    });
    return;
  }

  for (const [key, value] of Object.entries(effects)) {
    if (!isBuffEffectKey(key)) {
      issues.push({
        field: `${path}.${key}`,
        message: `未知 BuffEffects 字段 "${key}"，应为: ${BUFF_EFFECT_KEYS.join(', ')}`,
        severity: 'ERROR'
      });
      continue;
    }

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({
        field: `${path}.${key}`,
        message: `BuffEffects 字段 "${key}" 应为有限数字`,
        severity: 'ERROR'
      });
    }
  }
}

function validateDynamicScalingFields(
  effect: Partial<AppliedEffectConfig>,
  path: string,
  issues: SchemaValidationIssue[]
) {
  const hasDynamicScaling =
    effect.DynamicScalingAttribute !== undefined ||
    effect.DynamicScalingMultiplier !== undefined ||
    effect.DynamicTargetField !== undefined;

  if (!hasDynamicScaling) return;

  if (!isCharacterAttributeKey(effect.DynamicScalingAttribute)) {
    issues.push({
      field: `${path}.DynamicScalingAttribute`,
      message: `DynamicScalingAttribute 缺失或非法，应为: ${CHARACTER_ATTRIBUTE_KEYS.join(', ')}`,
      severity: 'ERROR'
    });
  }

  if (typeof effect.DynamicScalingMultiplier !== 'number' || !Number.isFinite(effect.DynamicScalingMultiplier)) {
    issues.push({
      field: `${path}.DynamicScalingMultiplier`,
      message: `DynamicScalingMultiplier 缺失或不是有限数字`,
      severity: 'ERROR'
    });
  }

  if (!isBuffEffectKey(effect.DynamicTargetField)) {
    issues.push({
      field: `${path}.DynamicTargetField`,
      message: `DynamicTargetField 缺失或非法，应为: ${BUFF_EFFECT_KEYS.join(', ')}`,
      severity: 'ERROR'
    });
  }
}

function validateOptionalNonNegativeNumber(
  value: unknown,
  field: string,
  message: string,
  issues: SchemaValidationIssue[]
) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    issues.push({
      field,
      message,
      severity: 'ERROR'
    });
  }
}

function validateRequiredNonNegativeNumber(
  value: unknown,
  field: string,
  message: string,
  issues: SchemaValidationIssue[]
) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    issues.push({
      field,
      message,
      severity: 'ERROR'
    });
  }
}

function validateOptionalPositiveNumber(
  value: unknown,
  field: string,
  message: string,
  issues: SchemaValidationIssue[]
) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) {
    issues.push({
      field,
      message,
      severity: 'ERROR'
    });
  }
}

function validateOptionalPercentRangeNumber(
  value: unknown,
  field: string,
  message: string,
  issues: SchemaValidationIssue[]
) {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)) {
    issues.push({
      field,
      message,
      severity: 'ERROR'
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

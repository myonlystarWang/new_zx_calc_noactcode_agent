import type {
  AllSkills,
  AssembleScenarioGameData,
  AssembleScenarioInput,
  AssemblerSupportActorInput,
  AppliedEffectConfig,
  DpsStrategyConfig,
  InitialEffectConfig,
  Monster,
  PlayerSkillOverride,
  SimulationActorConfig,
  SimulationScenario,
  Skill,
  SkillActionType,
  SupportStrategyConfig,
  ManualTimelineAction
} from './types.js';

const COMMON_FACTION = 'COMMON';
const SUPPORT_ACTION_TYPES = new Set<SkillActionType>(['BUFF', 'DEBUFF', 'UTILITY']);
const CURRENT_PHASE_DISABLED_SUPPORT_SKILL_IDS = new Set<string>([
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

export function assembleScenario(
  input: AssembleScenarioInput,
  gameData: AssembleScenarioGameData
): SimulationScenario {
  assertPositiveInteger(input.maxTimeMs, 'maxTimeMs');
  assertNonEmptyString(input.bossId, 'bossId');

  const dpsActor = assembleDpsActor(input, gameData.skills);
  const supportActors = (input.supports ?? []).map(support =>
    assembleSupportActor(support, gameData.skills, input.dpsActor.actorId)
  );
  assertUniqueActorIds([dpsActor, ...supportActors]);

  return {
    scenarioId: input.scenarioId,
    maxTimeMs: input.maxTimeMs,
    boss: resolveBoss(input, gameData.monstersByDungeon),
    bossHealthOverride: input.bossHealthOverride,
    actors: [dpsActor, ...supportActors],
    dpsActorId: input.dpsActor.actorId,
    gcdMs: input.gcdMs,
    attributeCaps: clone(input.attributeCaps),
    damageAudit: clone(input.damageAudit),
    initialEffects: buildInitialEffects(input),
    randomSeed: input.randomSeed
  };
}

const buildInitialEffects = (input: AssembleScenarioInput): InitialEffectConfig[] => {
  const initialEffects: InitialEffectConfig[] = [];

  if (input.dpsCommonEffects?.sanwanFocus) {
    initialEffects.push({
      timeMs: 0,
      targetId: input.dpsActor.actorId,
      sourceActorId: input.dpsActor.actorId,
      sourceSkillId: 'COMMON_SKILL_SANWAN',
      effect: {
        EffectId: 'COMMON_BUFF_SANWAN_FOCUS',
        EffectName: '三碗不过岗专注增益',
        Target: 'SELF',
        Duration: 3600,
        BuffEffects: {
          BuffFocusPercentEffect: 20
        }
      }
    });
  }

  if (input.dungeonEffects?.greenPoint150) {
    initialEffects.push({
      timeMs: 0,
      targetId: 'boss',
      sourceActorId: 'dungeon',
      sourceSkillId: 'DUNGEON_EFFECT_GREEN_150',
      effect: {
        EffectId: 'DUNGEON_DEBUFF_GREEN_150',
        EffectName: '副本绿点增益',
        Target: 'ENEMY',
        Duration: 3600,
        BuffEffects: {
          BuffMonsterCriticalDamagePercentEffect: 150
        }
      }
    });
  }

  return [
    ...initialEffects,
    ...clone(input.initialEffects ?? [])
  ];
};

const assembleDpsActor = (
  input: AssembleScenarioInput,
  allSkills: AllSkills
): SimulationActorConfig => {
  const actor = input.dpsActor;
  assertNonEmptyString(actor.actorId, 'dpsActor.actorId');
  assertNonEmptyString(actor.classId, 'dpsActor.classId');

  const skillPool = getFactionSkillPool(allSkills, actor.classId, actor.faction);
  const requiredSkillIds = getStrategySkillIds(actor.strategy);
  const selectedSkills = selectSkills({
    actorPath: `dpsActor(${actor.actorId})`,
    skillPool,
    preferredSkillIds: actor.skillIds,
    requiredSkillIds,
    overrideSkillIds: Object.keys(actor.skillOverrides ?? {}),
    includeByDefault: skill => !skill.ActionType || skill.ActionType === 'DAMAGE'
  });

  return {
    actorId: actor.actorId,
    classId: actor.classId,
    role: 'DPS',
    baseAttributes: clone(actor.profileAttributes),
    baseSkills: selectedSkills,
    skillOverrides: clone(actor.skillOverrides),
    strategy: clone(actor.strategy),
    gcdMs: actor.gcdMs
  };
};

const assembleSupportActor = (
  support: AssemblerSupportActorInput,
  allSkills: AllSkills,
  dpsActorId: string
): SimulationActorConfig => {
  assertNonEmptyString(support.actorId, `support(${support.actorId}).actorId`);
  assertNonEmptyString(support.classId, `support(${support.actorId}).classId`);

  const skillPool = getFactionSkillPool(allSkills, support.classId, support.faction);
  const explicitStrategySkillIds = support.strategy ? getStrategySkillIds(support.strategy) : [];
  const selectedSkills = selectSkills({
    actorPath: `support(${support.actorId})`,
    skillPool,
    preferredSkillIds: support.skillIds,
    requiredSkillIds: explicitStrategySkillIds,
    overrideSkillIds: Object.keys(support.skillOverrides ?? {}),
    includeByDefault: skill =>
      skill.ActionType !== undefined &&
      SUPPORT_ACTION_TYPES.has(skill.ActionType) &&
      !CURRENT_PHASE_DISABLED_SUPPORT_SKILL_IDS.has(skill.SkillID)
  });
  assertSupportSkills(selectedSkills, support.actorId);
  assertSupportAttributesWhenNeeded(support, selectedSkills);

  const strategy = support.strategy
    ? clone(support.strategy)
    : createDefaultSupportStrategy(selectedSkills, dpsActorId, support.actorId);

  return {
    actorId: support.actorId,
    classId: support.classId,
    role: 'SUPPORT',
    baseAttributes: clone(support.profileAttributes),
    baseSkills: selectedSkills,
    skillOverrides: clone(support.skillOverrides),
    strategy,
    gcdMs: support.gcdMs
  };
};

const createDefaultSupportStrategy = (
  skills: Skill[],
  dpsActorId: string,
  actorId: string
): SupportStrategyConfig => {
  if (actorId === 'zhaoming_sup') {
    const skillIds = new Set(skills.map(s => s.SkillID));
    const actions: ManualTimelineAction[] = [];
    if (skillIds.has('ZM_FO_SKILL_RYHG')) {
      actions.push({ timeMs: 1000, skillId: 'ZM_FO_SKILL_RYHG' });
    }
    if (skillIds.has('ZM_FO_SKILL_TYNF')) {
      actions.push({ timeMs: 8000, skillId: 'ZM_FO_SKILL_TYNF', targetActorId: dpsActorId });
    }
    return {
      type: 'SETUP_PHASE',
      actions
    };
  }
  return {
    type: 'CAST_ON_READY',
    skillIds: skills.map(skill => skill.SkillID),
    targetActorId: dpsActorId
  };
};

const selectSkills = (config: {
  actorPath: string;
  skillPool: Skill[];
  preferredSkillIds?: string[];
  requiredSkillIds: string[];
  overrideSkillIds: string[];
  includeByDefault: (skill: Skill) => boolean;
}): Skill[] => {
  const byId = new Map(config.skillPool.map(skill => [skill.SkillID, skill]));
  const selectedIds = new Set<string>();

  if (config.preferredSkillIds) {
    for (const skillId of config.preferredSkillIds) {
      requireKnownSkill(config.actorPath, byId, skillId);
      selectedIds.add(skillId);
    }
  } else {
    for (const skill of config.skillPool) {
      if (config.includeByDefault(skill)) {
        selectedIds.add(skill.SkillID);
      }
    }
  }

  for (const skillId of [...config.requiredSkillIds, ...config.overrideSkillIds]) {
    requireKnownSkill(config.actorPath, byId, skillId);
    selectedIds.add(skillId);
  }

  if (selectedIds.size === 0) {
    throw new Error(`${config.actorPath} did not resolve any usable skills.`);
  }

  return config.skillPool
    .filter(skill => selectedIds.has(skill.SkillID))
    .map(skill => clone(skill));
};

const getFactionSkillPool = (
  allSkills: AllSkills,
  classId: string,
  faction: string
): Skill[] => {
  const classSkills = allSkills[classId];
  if (!classSkills) {
    throw new Error(`Unknown classId "${classId}" in skills data.`);
  }

  const factionSkills = classSkills[faction] ?? [];
  const commonSkills = classSkills[COMMON_FACTION] ?? [];
  if (factionSkills.length === 0 && commonSkills.length === 0) {
    throw new Error(`No skills found for class "${classId}" faction "${faction}".`);
  }

  const deduped = new Map<string, Skill>();
  for (const skill of factionSkills) {
    deduped.set(skill.SkillID, skill);
  }
  for (const skill of commonSkills) {
    if (!deduped.has(skill.SkillID)) {
      deduped.set(skill.SkillID, skill);
    }
  }
  return [...deduped.values()];
};

const resolveBoss = (
  input: AssembleScenarioInput,
  monstersByDungeon: Record<string, Monster[]>
): Monster => {
  const matches: { dungeonId: string; monster: Monster }[] = [];

  if (input.dungeonId) {
    const dungeonMonsters = monstersByDungeon[input.dungeonId];
    if (!dungeonMonsters) {
      throw new Error(`Unknown dungeonId "${input.dungeonId}" in monsters data.`);
    }

    for (const monster of dungeonMonsters) {
      if (monster.MonsterID === input.bossId) {
        matches.push({ dungeonId: input.dungeonId, monster });
      }
    }

    if (matches.length > 1) {
      throw new Error(`Duplicate bossId "${input.bossId}" under dungeon "${input.dungeonId}".`);
    }
    if (matches.length === 0) {
      throw new Error(`Boss "${input.bossId}" was not found under dungeon "${input.dungeonId}".`);
    }
    return clone(matches[0]!.monster);
  }

  for (const [dungeonId, monsters] of Object.entries(monstersByDungeon)) {
    for (const monster of monsters) {
      if (monster.MonsterID === input.bossId) {
        matches.push({ dungeonId, monster });
      }
    }
  }

  if (matches.length === 0) {
    throw new Error(`Boss "${input.bossId}" was not found in monsters data.`);
  }
  if (matches.length > 1) {
    const dungeonIds = matches.map(match => match.dungeonId).join(', ');
    throw new Error(`Boss "${input.bossId}" exists in multiple dungeons (${dungeonIds}); provide dungeonId.`);
  }

  return clone(matches[0]!.monster);
};

const getStrategySkillIds = (
  strategy: DpsStrategyConfig | SupportStrategyConfig
): string[] => {
  if (strategy.type === 'FIXED_ROTATION' || strategy.type === 'SKILL_BAR' || strategy.type === 'CAST_ON_READY') {
    return strategy.skillIds;
  }
  return strategy.actions.map(action => action.skillId);
};

const assertSupportSkills = (skills: Skill[], actorId: string) => {
  const invalid = skills.find(skill => !skill.ActionType || !SUPPORT_ACTION_TYPES.has(skill.ActionType));
  if (invalid) {
    throw new Error(`Support actor "${actorId}" cannot include non-support skill "${invalid.SkillID}".`);
  }
};

const assertSupportAttributesWhenNeeded = (
  support: AssemblerSupportActorInput,
  skills: Skill[]
) => {
  if (support.profileAttributes) return;
  const dynamicSkill = skills.find(skill => skillNeedsSourceAttributes(skill, support.skillOverrides?.[skill.SkillID]));
  if (dynamicSkill) {
    throw new Error(
      `Support actor "${support.actorId}" uses dynamic scaling skill "${dynamicSkill.SkillID}" and requires profileAttributes.`
    );
  }
};

const skillNeedsSourceAttributes = (
  skill: Skill,
  override: PlayerSkillOverride | undefined
): boolean => {
  if (skill.AppliesEffects?.some(hasDynamicScaling)) return true;
  if (skill.MultiPhaseConfig?.Phases.some(phase => phase.AppliesEffects.some(hasDynamicScaling))) return true;
  if (override?.AppliesEffects && Object.values(override.AppliesEffects).some(hasDynamicScaling)) return true;

  const quality = override?.FourthGenQuality;
  const preset = quality ? skill.FourthGenPresets?.[quality] : undefined;
  if (preset?.AppliesEffects && Object.values(preset.AppliesEffects).some(hasDynamicScaling)) return true;

  return false;
};

const hasDynamicScaling = (effect: Partial<AppliedEffectConfig>): boolean => {
  return (
    effect.DynamicScalingAttribute !== undefined ||
    effect.DynamicScalingMultiplier !== undefined ||
    effect.DynamicTargetField !== undefined
  );
};

const requireKnownSkill = (
  actorPath: string,
  byId: Map<string, Skill>,
  skillId: string
) => {
  if (!byId.has(skillId)) {
    throw new Error(`${actorPath} references unknown skill "${skillId}".`);
  }
};

const assertUniqueActorIds = (actors: SimulationActorConfig[]) => {
  const seen = new Set<string>();
  for (const actor of actors) {
    if (seen.has(actor.actorId)) {
      throw new Error(`Duplicate actorId "${actor.actorId}" in assembled scenario.`);
    }
    seen.add(actor.actorId);
  }
};

const assertNonEmptyString = (value: unknown, field: string) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string.`);
  }
};

const assertPositiveInteger = (value: unknown, field: string) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
};

const clone = <T>(value: T): T => {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
};

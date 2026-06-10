import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assembleScenario } from '../packages/simulation-engine/src/scenario_assembler.ts';
import { runSimulation } from '../packages/simulation-engine/src/combat_loop.ts';
import { DEFAULT_ATTRIBUTE_CAPS } from '../packages/simulation-engine/src/calculator.ts';
import { Actor } from '../packages/simulation-engine/src/actor.ts';
import { StrategyController } from '../packages/simulation-engine/src/strategies.ts';

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    return [key, value] as const;
  })
);

const timelineSeconds = Number(args.get('timeline-seconds') ?? 50);
const auditSeconds = Number(args.get('audit-seconds') ?? 12);
const includeAblation = args.get('ablation') !== 'false';
const bossTier = (args.get('tier') ?? 'T20').toUpperCase();
const hitOutput = args.get('hit-output') ?? 'both';
const dpsStartDelayMs = Number(args.get('dps-start-delay-ms') ?? 5000);
const enableSanwanFocus = args.get('sanwan') !== 'false';
const enableDungeonGreen150 = args.get('dungeon-green150') !== 'false';
const auditSkillFilter = new Set(
  (args.get('audit-skills') ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
);
const dungeonId = `ZHENHAI_DUANLANG_${bossTier}`;
const bossId = `CHI_SUO_${bossTier}`;

const gameDataDir = resolve('web_app/public/game_data');
const loadJson = <T>(filename: string): T => JSON.parse(readFileSync(resolve(gameDataDir, filename), 'utf8')) as T;

const dpsSkillIds = [
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
  dpsSkillIds.map(skillId => [skillId, { FourthGenQuality: 'XI_RI' as const }])
);

let dpsAttributes = {
  CharacterMinAttack: 300000,
  CharacterMaxAttack: 352000,
  CharacterDefense: 500000,
  CharacterHealth: 4000000,
  CharacterMana: 5490000,
  CharacterCriticalHitDamagePercent: 2821,
  CharacterMonsterDamageIncreasePercent: 43.8,
  CharacterOnePercentAttack: 1500,
  CharacterOnePercentDefense: 2000,
  CharacterOnePercentHealth: 25000,
  CharacterOnePercentMana: 35000
};

const profilePath = args.get('profile');
if (profilePath) {
  const profileJson = JSON.parse(readFileSync(resolve(profilePath), 'utf8'));
  const profileAttrs = profileJson.attributes ?? {};
  dpsAttributes = {
    ...dpsAttributes,
    CharacterMinAttack: profileAttrs.minAttack ?? dpsAttributes.CharacterMinAttack,
    CharacterMaxAttack: profileAttrs.maxAttack ?? dpsAttributes.CharacterMaxAttack,
    CharacterDefense: profileAttrs.defense ?? dpsAttributes.CharacterDefense,
    CharacterCriticalHitDamagePercent: profileAttrs.critDamage ?? dpsAttributes.CharacterCriticalHitDamagePercent,
    CharacterMana: profileAttrs.mana ?? dpsAttributes.CharacterMana,
    CharacterHealth: profileAttrs.health ?? dpsAttributes.CharacterHealth,
    CharacterMonsterDamageIncreasePercent: profileAttrs.monsterDamageIncrease ?? dpsAttributes.CharacterMonsterDamageIncreasePercent
  };
}


const supportAttributes = {
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

const supportCatalog = {
  tianyin_sup: {
    classId: 'TIAN_YIN',
    faction: 'FO',
    skills: ['TY_FO_SKILL_CHFY', 'TY_FO_SKILL_WLZY', 'TY_FO_SKILL_WLZY_CHAN', 'TY_FO_SKILL_TWBL']
  },
  fenxiang_sup: {
    classId: 'FEN_XIANG',
    faction: 'FO',
    skills: ['FX_FO_SKILL_ZRZD2', 'FX_FO_SKILL_YBJH', 'FX_FO_SKILL_JQS', 'FX_FO_SKILL_SWZH', 'FX_FO_SKILL_NWTH']
  },
  zhaoming_sup: {
    classId: 'ZHAO_MING',
    faction: 'FO',
    skills: ['ZM_FO_SKILL_TYNF', 'ZM_FO_SKILL_RYHG']
  },
  yingzhao_sup: {
    classId: 'YING_ZHAO',
    faction: 'FO',
    skills: ['YZ_FO_SKILL_BS', 'YZ_FO_SKILL_GJ', 'YZ_FO_SKILL_JT']
  },
  tianhua_sup: {
    classId: 'TIAN_HUA',
    faction: 'FO',
    skills: ['TH_FO_SKILL_JSKW', 'TH_FO_SKILL_QSYY', 'TH_FO_SKILL_YGSD_CHAN']
  }
} as const;

const gameData = {
  skills: loadJson('skills.json'),
  monstersByDungeon: loadJson('dungeons_monsters.json')
};

interface SupportMode {
  none?: boolean;
  only?: Set<string>;
  exclude?: Set<string>;
}

const buildSupports = (mode: SupportMode = {}) => {
  if (mode.none) return [];

  return Object.entries(supportCatalog)
    .map(([actorId, config]) => {
      let skillIds = [...config.skills];
      if (mode.only) {
        skillIds = skillIds.filter(skillId => mode.only!.has(skillId));
      }
      if (mode.exclude) {
        skillIds = skillIds.filter(skillId => !mode.exclude!.has(skillId));
      }
      if (skillIds.length === 0) return undefined;
      return {
        actorId,
        classId: config.classId,
        faction: config.faction,
        profileAttributes: supportAttributes,
        skillIds
      };
    })
    .filter(Boolean);
};

const buildScenario = (mode: SupportMode = {}, selectedDungeonId = dungeonId, selectedBossId = bossId) => assembleScenario(
  {
    scenarioId: `phase-h-diagnostics-${selectedBossId}`,
    maxTimeMs: 300000,
    dungeonId: selectedDungeonId,
    bossId: selectedBossId,
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
        skillIds: [...dpsSkillIds],
        startTimeMs: dpsStartDelayMs,
        scanMode: 'FROM_FIRST_EACH_DECISION',
        skillExpiryMs: {
          ZS_MO_SKILL_ZGDD: 0,
          ZS_MO_SKILL_QXHS: 16000
        }
      }
    },
    dpsCommonEffects: {
      sanwanFocus: enableSanwanFocus
    },
    dungeonEffects: {
      greenPoint150: enableDungeonGreen150
    },
    supports: buildSupports(mode)
  },
  gameData
);

const effectKeys = [
  'BuffFocusPercentEffect',
  'BuffHolyWrathPercentEffect',
  'BuffCriticalDamagePercentEffect',
  'BuffAttackPercentEffect',
  'BuffManaPercentEffect',
  'BuffMonsterCriticalDamagePercentEffect',
  'BuffMonsterHarmedPercentEffect',
  'BuffMonsterCritRateIncreaseEffect',
  'BuffDefenseFixedEffect',
  'BuffSpeedPercentEffect'
] as const;

const fmtTime = (timeMs: number) => `${(timeMs / 1000).toFixed(3)}s`;
const fmtState = (actor: Actor, skillId: string) => {
  const state = actor.SkillStates[skillId];
  if (!state) return 'n/a';
  return `${state.charges}/${state.maxCharges}@${fmtTime(state.cooldownReadyAtMs)}`;
};
const fmtClxState = (actor: Actor) => `CLX ${fmtState(actor, 'ZS_MO_SKILL_CLX')} CLXS ${fmtState(actor, 'ZS_MO_SKILL_CLXS')}`;
const fmtEffects = (effects: Record<string, number | undefined>) => effectKeys
  .map(key => effects[key] !== undefined ? `${key}=${effects[key]}` : '')
  .filter(Boolean)
  .join(', ') || '{}';

const scalar = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
};

const getBuffValue = (effects: Record<string, number | undefined>, key: string): number => effects[key] ?? 0;

const shouldIncludeAuditRecord = (record: { TimeMs: number; SkillId: string }): boolean => (
  record.TimeMs <= auditSeconds * 1000 &&
  (auditSkillFilter.size === 0 || auditSkillFilter.has(record.SkillId))
);

const getDamageAuditTsvColumns = () => [
  'timeMs',
  'timeSec',
  'skillId',
  'skillName',
  'hitIndex',
  'hitCount',
  'damageApplied',
  'bossHpBefore',
  'bossHpAfter',
  'bossMonsterCriticalDamageReduction',
  'bossDefense',
  'bossHealth',
  'bossDamageCompressionPercent',
  'baseMinAttack',
  'baseMaxAttack',
  'effectiveMinAttack',
  'effectiveMaxAttack',
  'effectiveDefense',
  'effectiveHealth',
  'effectiveMana',
  'effectiveCriticalDamagePercent',
  'characterMonsterDamageIncreasePercent',
  'skillAttackPercentBonus',
  'skillAttackFixedBonus',
  'skillHealthPercentBonus',
  'skillManaPercentBonus',
  'skillDefensePercentBonus',
  'skillCriticalDamagePercentBonus',
  'skillDamageBonus',
  'actorFocus',
  'actorHolyWrath',
  'actorCriticalDamageBuff',
  'actorAttackPercentBuff',
  'actorManaPercentBuff',
  'bossGreenDisplayed',
  'bossHarmedDisplayed',
  'bossGreenInFormula',
  'bossHarmedInFormula',
  'combinedFocus',
  'combinedHolyWrath',
  'combinedGreenRaw',
  'combinedHarmedRaw',
  'ybjhGreenMultiplierActive',
  'greenBeforeCap',
  'greenAfterCap',
  'harmedBeforeCap',
  'harmedAfterCap',
  'baseCriticalDamageBeforeCap',
  'baseCriticalDamageAfterCap',
  'criticalDamageTotal',
  'minBaseDamage',
  'maxBaseDamage',
  'minFinalDamageBeforeCompression',
  'maxFinalDamageBeforeCompression',
  'avgFinalDamageBeforeCompression',
  'critMultiplier',
  'skillDamageBonusMultiplier',
  'characterMonsterDamageIncreaseMultiplier',
  'monsterHarmedMultiplier',
  'focusMultiplier',
  'holyWrathMultiplier',
  'combinedBeforeCompression',
  'damageCompressionMultiplier',
  'combinedAfterCompression'
];

const buildDamageAuditTsvRow = (record: any) => {
  const formula = record.Formula;
  const skillBonus = formula.skillBonusAttributes ?? {};
  const monster = mainScenario.boss.MonsterAttributeModifiers;
  const row: Record<string, unknown> = {
    timeMs: record.TimeMs,
    timeSec: record.TimeMs / 1000,
    skillId: record.SkillId,
    skillName: record.SkillName,
    hitIndex: record.HitIndex,
    hitCount: record.HitCount,
    damageApplied: record.DamageApplied,
    bossHpBefore: record.BossHpBefore,
    bossHpAfter: record.BossHpAfter,
    bossMonsterCriticalDamageReduction: monster.MonsterCriticalDamagePercentReduction,
    bossDefense: monster.MonsterDefense,
    bossHealth: monster.MonsterHealth,
    bossDamageCompressionPercent: monster.DamageCompressionPercent ?? 0,
    baseMinAttack: record.BaseAttributes.CharacterMinAttack,
    baseMaxAttack: record.BaseAttributes.CharacterMaxAttack,
    effectiveMinAttack: record.EffectiveAttributes.CharacterMinAttack,
    effectiveMaxAttack: record.EffectiveAttributes.CharacterMaxAttack,
    effectiveDefense: record.EffectiveAttributes.CharacterDefense,
    effectiveHealth: record.EffectiveAttributes.CharacterHealth,
    effectiveMana: record.EffectiveAttributes.CharacterMana,
    effectiveCriticalDamagePercent: record.EffectiveAttributes.CharacterCriticalHitDamagePercent,
    characterMonsterDamageIncreasePercent: record.EffectiveAttributes.CharacterMonsterDamageIncreasePercent,
    skillAttackPercentBonus: skillBonus.SkillAttackPercentBonus ?? 0,
    skillAttackFixedBonus: skillBonus.SkillAttackFixedBonus ?? 0,
    skillHealthPercentBonus: skillBonus.SkillHealthPercentBonus ?? 0,
    skillManaPercentBonus: skillBonus.SkillManaPercentBonus ?? 0,
    skillDefensePercentBonus: skillBonus.SkillDefensePercentBonus ?? 0,
    skillCriticalDamagePercentBonus: skillBonus.SkillCriticalDamagePercentBonus ?? 0,
    skillDamageBonus: skillBonus.SkillDamageBonus ?? 1,
    actorFocus: getBuffValue(record.ActorBuffTotals, 'BuffFocusPercentEffect'),
    actorHolyWrath: getBuffValue(record.ActorBuffTotals, 'BuffHolyWrathPercentEffect'),
    actorCriticalDamageBuff: getBuffValue(record.ActorBuffTotals, 'BuffCriticalDamagePercentEffect'),
    actorAttackPercentBuff: getBuffValue(record.ActorBuffTotals, 'BuffAttackPercentEffect'),
    actorManaPercentBuff: getBuffValue(record.ActorBuffTotals, 'BuffManaPercentEffect'),
    bossGreenDisplayed: getBuffValue(record.BossDebuffTotalsDisplayed, 'BuffMonsterCriticalDamagePercentEffect'),
    bossHarmedDisplayed: getBuffValue(record.BossDebuffTotalsDisplayed, 'BuffMonsterHarmedPercentEffect'),
    bossGreenInFormula: getBuffValue(record.BossDebuffTotalsInFormula, 'BuffMonsterCriticalDamagePercentEffect'),
    bossHarmedInFormula: getBuffValue(record.BossDebuffTotalsInFormula, 'BuffMonsterHarmedPercentEffect'),
    combinedFocus: getBuffValue(record.CombinedBuffTotals, 'BuffFocusPercentEffect'),
    combinedHolyWrath: getBuffValue(record.CombinedBuffTotals, 'BuffHolyWrathPercentEffect'),
    combinedGreenRaw: getBuffValue(record.CombinedBuffTotals, 'BuffMonsterCriticalDamagePercentEffect'),
    combinedHarmedRaw: getBuffValue(record.CombinedBuffTotals, 'BuffMonsterHarmedPercentEffect'),
    ybjhGreenMultiplierActive: formula.ybjhGreenMultiplierActive,
    greenBeforeCap: formula.buffMonsterCriticalDamagePercentBeforeCap,
    greenAfterCap: formula.buffMonsterCriticalDamagePercentAfterCap,
    harmedBeforeCap: formula.buffMonsterHarmedPercentBeforeCap,
    harmedAfterCap: formula.buffMonsterHarmedPercentAfterCap,
    baseCriticalDamageBeforeCap: formula.baseCriticalDamageBeforeCap,
    baseCriticalDamageAfterCap: formula.baseCriticalDamageAfterCap,
    criticalDamageTotal: formula.criticalDamageTotal,
    minBaseDamage: formula.minBaseDamage,
    maxBaseDamage: formula.maxBaseDamage,
    minFinalDamageBeforeCompression: formula.minFinalDamageBeforeCompression,
    maxFinalDamageBeforeCompression: formula.maxFinalDamageBeforeCompression,
    avgFinalDamageBeforeCompression: formula.avgFinalDamageBeforeCompression,
    critMultiplier: formula.multipliers.critMultiplier,
    skillDamageBonusMultiplier: formula.multipliers.skillDamageBonusMultiplier,
    characterMonsterDamageIncreaseMultiplier: formula.multipliers.characterMonsterDamageIncreaseMultiplier,
    monsterHarmedMultiplier: formula.multipliers.monsterHarmedMultiplier,
    focusMultiplier: formula.multipliers.focusMultiplier,
    holyWrathMultiplier: formula.multipliers.holyWrathMultiplier,
    combinedBeforeCompression: formula.multipliers.combinedBeforeCompression,
    damageCompressionMultiplier: formula.multipliers.damageCompressionMultiplier ?? 1,
    combinedAfterCompression: formula.multipliers.combinedAfterCompression ?? formula.multipliers.combinedBeforeCompression
  };
  return getDamageAuditTsvColumns().map(column => scalar(row[column])).join('\t');
};

const buildCalculatorInputJson = (record: any) => {
  const formula = record.Formula;
  const monster = mainScenario.boss.MonsterAttributeModifiers;
  const compressionMultiplier = formula.multipliers.damageCompressionMultiplier ?? 1;
  return {
    timeMs: record.TimeMs,
    timeSec: record.TimeMs / 1000,
    actorId: record.ActorId,
    skillId: record.SkillId,
    skillName: record.SkillName,
    hitIndex: record.HitIndex,
    hitCount: record.HitCount,
    boss: {
      monsterId: mainScenario.boss.MonsterID,
      monsterName: mainScenario.boss.MonsterName,
      monsterCriticalDamagePercentReduction: monster.MonsterCriticalDamagePercentReduction,
      monsterDefense: monster.MonsterDefense,
      monsterHealth: monster.MonsterHealth,
      monsterCriticalHitRateReduction: monster.MonsterCriticalHitRateReduction,
      damageCompressionPercent: monster.DamageCompressionPercent ?? 0
    },
    attributeCaps: {
      effective: {
        ...DEFAULT_ATTRIBUTE_CAPS,
        ...mainScenario.attributeCaps,
        EnableCaps: mainScenario.attributeCaps?.EnableCaps ?? DEFAULT_ATTRIBUTE_CAPS.EnableCaps
      }
    },
    attributes: {
      base: record.BaseAttributes,
      uncapped: record.UncappedAttributes,
      effective: record.EffectiveAttributes
    },
    skillBonusAttributesForThisHit: formula.skillBonusAttributes,
    buffTotals: {
      actor: record.ActorBuffTotals,
      bossDisplayed: record.BossDebuffTotalsDisplayed,
      bossInFormula: record.BossDebuffTotalsInFormula,
      combinedInFormula: record.CombinedBuffTotals
    },
    formulaInputs: {
      ybjhGreenMultiplierActive: formula.ybjhGreenMultiplierActive,
      buffMonsterCriticalDamagePercentBeforeCap: formula.buffMonsterCriticalDamagePercentBeforeCap,
      buffMonsterCriticalDamagePercentAfterCap: formula.buffMonsterCriticalDamagePercentAfterCap,
      buffMonsterHarmedPercentBeforeCap: formula.buffMonsterHarmedPercentBeforeCap,
      buffMonsterHarmedPercentAfterCap: formula.buffMonsterHarmedPercentAfterCap,
      baseCriticalDamageBeforeCap: formula.baseCriticalDamageBeforeCap,
      baseCriticalDamageAfterCap: formula.baseCriticalDamageAfterCap,
      monsterCriticalDamageReduction: formula.monsterCriticalDamageReduction,
      criticalDamageTotal: formula.criticalDamageTotal,
      minBaseDamage: formula.minBaseDamage,
      maxBaseDamage: formula.maxBaseDamage
    },
    multipliers: {
      ...formula.multipliers,
      damageCompressionMultiplier: compressionMultiplier,
      combinedAfterCompression: formula.multipliers.combinedAfterCompression ?? formula.multipliers.combinedBeforeCompression * compressionMultiplier
    },
    damageResult: {
      minFinalDamageBeforeCompression: formula.minFinalDamageBeforeCompression,
      maxFinalDamageBeforeCompression: formula.maxFinalDamageBeforeCompression,
      avgFinalDamageBeforeCompression: formula.avgFinalDamageBeforeCompression,
      avgFinalDamageAfterCompression: formula.avgFinalDamageBeforeCompression * compressionMultiplier,
      damageApplied: record.DamageApplied,
      bossHpBefore: record.BossHpBefore,
      bossHpAfter: record.BossHpAfter
    },
    activeEffectsInFormula: record.ActiveEffects.filter((effect: any) => effect.IncludedInDamageFormula),
    activeSpeedEffects: record.ActiveEffects.filter((effect: any) => effect.BuffEffects.BuffSpeedPercentEffect !== undefined)
  };
};

const inspectSkillBar = (actor: Actor, strategy: any, timeMs: number) => {
  return strategy.skillIds.map((skillId: string, index: number) => {
    const skill = actor.Skills[skillId];
    const state = actor.SkillStates[skillId];
    const expiryMs = strategy.skillExpiryMs?.[skillId] ?? 0;
    const lastCast = actor.LastCastStartMs[skillId];
    const expiryReadyAt = lastCast === undefined ? 0 : lastCast + expiryMs;
    const expiryBlocked = expiryMs > 0 && lastCast !== undefined && timeMs < expiryReadyAt;
    const usable = actor.isSkillUsable(skillId, timeMs);
    const nextUsable = actor.getNextUsableTimeMs(skillId, timeMs);
    let status = 'READY';
    if (expiryBlocked) {
      status = `expiry_until=${fmtTime(expiryReadyAt)}`;
    } else if (!usable) {
      status = state?.maxCharges && state.maxCharges > 1
        ? `no_charge_until=${fmtTime(nextUsable)}`
        : `cd_until=${fmtTime(nextUsable)}`;
    }
    return {
      index,
      skillId,
      name: skill?.SkillName ?? skillId,
      status,
      state: state ? `${state.charges}/${state.maxCharges}` : 'n/a',
      cdReady: state ? fmtTime(state.cooldownReadyAtMs) : 'n/a',
      lastCast: lastCast === undefined ? '-' : fmtTime(lastCast)
    };
  });
};

const mainScenario = buildScenario();
const effectiveDpsConfig = mainScenario.actors.find(actor => actor.actorId === 'zhushuang_dps');
if (!effectiveDpsConfig) {
  throw new Error('zhushuang_dps not found in assembled scenario.');
}
const effectiveDpsActor = new Actor(
  effectiveDpsConfig.actorId,
  effectiveDpsConfig.classId,
  effectiveDpsConfig.baseSkills,
  effectiveDpsConfig.skillOverrides,
  effectiveDpsConfig.baseAttributes,
  effectiveDpsConfig.gcdMs
);

let captureEnabled = true;
let sequence = 0;
const timelineRows: { timeMs: number; sequence: number; text: string; details?: string[] }[] = [];
const pushTimeline = (timeMs: number, text: string, details?: string[]) => {
  if (timeMs > timelineSeconds * 1000) return;
  timelineRows.push({ timeMs, sequence: ++sequence, text, details });
};

const originalSelect = StrategyController.prototype.selectNextAction;
StrategyController.prototype.selectNextAction = function patchedSelect(actor, strategy, timeMs) {
  if (!captureEnabled || actor.ActorId !== 'zhushuang_dps' || strategy?.type !== 'SKILL_BAR') {
    return originalSelect.call(this, actor, strategy, timeMs);
  }

  const scan = inspectSkillBar(actor, strategy, timeMs);
  const decision = originalSelect.call(this, actor, strategy, timeMs);
  const selected = decision.skillId
    ? `${actor.Skills[decision.skillId]?.SkillName ?? decision.skillId} (${decision.skillId})`
    : `WAIT ${decision.waitUntilMs !== undefined ? fmtTime(decision.waitUntilMs) : ''}`;
  const details = scan.map(item =>
    `  [${item.index}] ${item.name} ${item.skillId} ${item.status} state=${item.state} cdReady=${item.cdReady} last=${item.lastCast}`
  );
  pushTimeline(timeMs, `DECISION selected=${selected}`, details);
  return decision;
};

const originalBeginCast = Actor.prototype.beginCast;
Actor.prototype.beginCast = function patchedBeginCast(skillId, timeMs, actualCastTimeMs, skipChargeConsumption) {
  if (!captureEnabled || this.ActorId !== 'zhushuang_dps') {
    return originalBeginCast.call(this, skillId, timeMs, actualCastTimeMs, skipChargeConsumption);
  }

  const before = fmtClxState(this);
  const result = originalBeginCast.call(this, skillId, timeMs, actualCastTimeMs, skipChargeConsumption);
  const skill = this.Skills[skillId];
  const ready = result.map(item => `${fmtTime(item.timeMs)}${item.rechargeToken !== undefined ? `#${item.rechargeToken}` : ''}`).join(',') || '-';
  pushTimeline(
    timeMs,
    `CAST ${skill?.SkillName ?? skillId} (${skillId}) cast=${actualCastTimeMs ?? Math.round((skill?.CastTime ?? 0) * 1000)}ms cd=${skill?.Cooldown ?? 0}s ready=${ready} ${before}->${fmtClxState(this)}`
  );
  return result;
};

const originalApplyReady = Actor.prototype.applyCooldownReady;
Actor.prototype.applyCooldownReady = function patchedApplyReady(skillId, timeMs, rechargeToken) {
  if (!captureEnabled || this.ActorId !== 'zhushuang_dps') {
    return originalApplyReady.call(this, skillId, timeMs, rechargeToken);
  }

  const before = fmtClxState(this);
  const result = originalApplyReady.call(this, skillId, timeMs, rechargeToken);
  if (skillId === 'ZS_MO_SKILL_CLX' || skillId === 'ZS_MO_SKILL_CLXS') {
    const skill = this.Skills[skillId];
    const next = result.nextReady ? `${fmtTime(result.nextReady.timeMs)}#${result.nextReady.rechargeToken}` : '-';
    pushTimeline(
      timeMs,
      `READY ${skill?.SkillName ?? skillId} (${skillId}) applied=${result.applied} token=${rechargeToken ?? '-'} next=${next} ${before}->${fmtClxState(this)}`
    );
  }
  return result;
};

const originalApplyReset = Actor.prototype.applyCooldownReset;
Actor.prototype.applyCooldownReset = function patchedApplyReset(reset, timeMs) {
  if (!captureEnabled || this.ActorId !== 'zhushuang_dps') {
    return originalApplyReset.call(this, reset, timeMs);
  }

  const before = fmtClxState(this);
  const result = originalApplyReset.call(this, reset, timeMs);
  if (reset.TargetSkillId === 'ZS_MO_SKILL_CLX' || reset.TargetSkillId === 'ZS_MO_SKILL_CLXS') {
    const skill = this.Skills[reset.TargetSkillId];
    pushTimeline(
      timeMs,
      `RESET ${skill?.SkillName ?? reset.TargetSkillId} (${reset.TargetSkillId}) ${reset.ResetType} ${before}->${fmtClxState(this)}`
    );
  }
  return result;
};

const result = runSimulation(mainScenario);
captureEnabled = false;

console.log(`PHASE_H_DIAGNOSTICS tier=${bossTier} timelineSeconds=${timelineSeconds} auditSeconds=${auditSeconds} dpsStartDelayMs=${dpsStartDelayMs} sanwan=${enableSanwanFocus} dungeonGreen150=${enableDungeonGreen150}`);
console.log('INITIAL_EFFECTS');
for (const initialEffect of mainScenario.initialEffects ?? []) {
  console.log(`${fmtTime(initialEffect.timeMs ?? 0)}\t${initialEffect.sourceActorId}\t${initialEffect.sourceSkillId}\t->${initialEffect.targetId}\t${initialEffect.effect.EffectId}\t${initialEffect.effect.EffectName}\t${fmtEffects(initialEffect.effect.BuffEffects ?? {})}`);
}
console.log('SKILL_CDS');
for (const skillId of dpsSkillIds) {
  const skill = effectiveDpsActor.Skills[skillId];
  const speed = skill.AppliesEffects?.find(effect =>
    effect.EffectId === 'ZS_BUFF_QXHS_SPEED' || effect.EffectId === 'ZS_BUFF_LZYY_SPEED'
  )?.BuffEffects.BuffSpeedPercentEffect;
  console.log(`${skillId}\t${skill.SkillName}\tcd=${skill.Cooldown}s\tcast=${skill.CastTime}s\tcharges=${skill.MaxCharges ?? 1}\trecharge=${skill.ChargeReplenishTime ?? skill.Cooldown}s\tspeed=${speed ?? ''}\texpiry=${mainScenario.actors[0]?.strategy?.type === 'SKILL_BAR' ? mainScenario.actors[0].strategy.skillExpiryMs?.[skillId] ?? 0 : 0}ms`);
}

console.log('LOADED_ACTOR_SKILLS');
for (const actor of mainScenario.actors) {
  console.log(`${actor.actorId}\t${actor.classId}\t${actor.role}\t${actor.baseSkills.length}`);
  for (const skill of actor.baseSkills) {
    const effects = (skill.AppliesEffects ?? [])
      .map(effect => `${effect.EffectId}:${fmtEffects(effect.BuffEffects)}`)
      .join(' | ');
    console.log(`  ${skill.SkillID}\t${skill.SkillName}\t${skill.ActionType ?? 'DAMAGE'}\tcd=${skill.Cooldown}\tcast=${skill.CastTime}\t${effects}`);
  }
}

console.log('SUMMARY');
console.log(`boss=${result.boss.monsterName} hp=${result.boss.startingHealth}`);
console.log(`killed=${result.boss.killedAtMs !== undefined ? fmtTime(result.boss.killedAtMs) : 'NO'} duration=${fmtTime(result.summary.DpsDurationMs)} audit=${result.damageAuditRecords?.length ?? 0} avgDps=${Math.round(result.summary.AverageDps)}`);
for (const item of result.summary.SkillBreakdown) {
  console.log(`${item.SkillId}\t${item.SkillName}\thits=${item.HitCount}\tdamage=${Math.round(item.TotalDamage)}\tshare=${((item.TotalDamage / result.summary.TotalDamage) * 100).toFixed(2)}%`);
}

console.log(`TIMELINE_FULL_SCAN_FIRST_${timelineSeconds}s`);
for (const row of timelineRows.sort((a, b) => a.timeMs - b.timeMs || a.sequence - b.sequence)) {
  console.log(`${fmtTime(row.timeMs)}\t${row.text}`);
  row.details?.forEach(detail => console.log(detail));
}

console.log(`BUFF_APPLY_FIRST_${auditSeconds}s`);
for (const event of result.events.filter(event =>
  event.type === 'BUFF_APPLY' &&
  event.timeMs <= auditSeconds * 1000 &&
  event.status === 'PROCESSED'
)) {
  const data = event.data ?? {};
  const effect = (data.effect ?? {}) as any;
  console.log(`${fmtTime(event.timeMs)}\t${event.actorId}\t${event.skillId}\t->${event.targetId}\t${effect.EffectId}\t${effect.EffectName}\t${fmtEffects(effect.BuffEffects ?? {})}\tend=${fmtTime(data.appliedEndTimeMs ?? 0)}\treplaced=${(data.replacedInstanceIds ?? []).join(',')}`);
}

console.log(`AUDIT_SNAPSHOTS_FIRST_${auditSeconds}s`);
for (const record of (result.damageAuditRecords ?? []).filter(record =>
  record.TimeMs <= auditSeconds * 1000 &&
  (record.HitIndex === 1 || record.HitIndex === record.HitCount)
)) {
  console.log(`[${fmtTime(record.TimeMs)}] ${record.SkillName} hit=${record.HitIndex}/${record.HitCount} dmg=${Math.round(record.DamageApplied)}`);
  console.log(`  ATTR baseAtk=${record.BaseAttributes.CharacterMinAttack}-${record.BaseAttributes.CharacterMaxAttack} effectiveAtk=${Math.round(record.EffectiveAttributes.CharacterMinAttack)}-${Math.round(record.EffectiveAttributes.CharacterMaxAttack)} hp=${Math.round(record.EffectiveAttributes.CharacterHealth)} mana=${Math.round(record.EffectiveAttributes.CharacterMana)} critDmg=${record.Formula.baseCriticalDamageAfterCap}`);
  console.log(`  TOTALS ${fmtEffects(record.CombinedBuffTotals)} greenBefore=${record.Formula.buffMonsterCriticalDamagePercentBeforeCap} greenAfter=${record.Formula.buffMonsterCriticalDamagePercentAfterCap} harmBefore=${record.Formula.buffMonsterHarmedPercentBeforeCap} harmAfter=${record.Formula.buffMonsterHarmedPercentAfterCap} critMult=${record.Formula.multipliers.critMultiplier.toFixed(3)} allMult=${record.Formula.multipliers.combinedBeforeCompression.toFixed(3)}`);
  for (const effect of record.ActiveEffects.filter(effect =>
    effect.IncludedInDamageFormula || effect.BuffEffects.BuffSpeedPercentEffect !== undefined
  )) {
    console.log(`    ${effect.TargetId}\t${effect.SourceActorId}\t${effect.SourceSkillId}\t${effect.EffectId}\t${effect.EffectName}\t${fmtEffects(effect.BuffEffects)}\tremain=${fmtTime(effect.RemainingMs)}\tinFormula=${effect.IncludedInDamageFormula}`);
  }
}

const includedDamageAuditRecords = (result.damageAuditRecords ?? []).filter(shouldIncludeAuditRecord);
if (hitOutput === 'tsv' || hitOutput === 'both') {
  console.log(`DAMAGE_HIT_TSV_FIRST_${auditSeconds}s${auditSkillFilter.size > 0 ? `_SKILLS_${[...auditSkillFilter].join(',')}` : ''}`);
  console.log(getDamageAuditTsvColumns().join('\t'));
  for (const record of includedDamageAuditRecords) {
    console.log(buildDamageAuditTsvRow(record));
  }
}

if (hitOutput === 'jsonl' || hitOutput === 'both') {
  console.log(`CALCULATOR_INPUT_JSONL_FIRST_${auditSeconds}s${auditSkillFilter.size > 0 ? `_SKILLS_${[...auditSkillFilter].join(',')}` : ''}`);
  for (const record of includedDamageAuditRecords) {
    console.log(JSON.stringify(buildCalculatorInputJson(record)));
  }
}

if (includeAblation) {
  const formulaBuffs = new Set(['TY_FO_SKILL_CHFY', 'FX_FO_SKILL_ZRZD2', 'ZM_FO_SKILL_RYHG', 'TH_FO_SKILL_JSKW', 'TH_FO_SKILL_QSYY']);
  const formulaDebuffs = new Set(['TY_FO_SKILL_WLZY', 'TY_FO_SKILL_WLZY_CHAN', 'FX_FO_SKILL_YBJH', 'FX_FO_SKILL_JQS', 'FX_FO_SKILL_SWZH', 'YZ_FO_SKILL_BS', 'YZ_FO_SKILL_JT']);
  const runCase = (name: string, mode: SupportMode, selectedDungeonId = dungeonId, selectedBossId = bossId) => {
    const scenario = buildScenario(mode, selectedDungeonId, selectedBossId);
    const caseResult = runSimulation(scenario);
    const first = caseResult.damageAuditRecords?.[0];
    console.log(`${name}\tkilled=${caseResult.boss.killedAtMs !== undefined ? fmtTime(caseResult.boss.killedAtMs) : 'NO'}\tduration=${fmtTime(caseResult.summary.DpsDurationMs)}\tavgDps=${Math.round(caseResult.summary.AverageDps)}\tremain=${Math.round(caseResult.boss.currentHealth)}\tfirstFocus=${first?.CombinedBuffTotals.BuffFocusPercentEffect ?? 0}\tholy=${first?.CombinedBuffTotals.BuffHolyWrathPercentEffect ?? 0}\tgreen=${first?.Formula.buffMonsterCriticalDamagePercentAfterCap ?? 0}\tharm=${first?.Formula.buffMonsterHarmedPercentAfterCap ?? 0}\tmult=${(first?.Formula.multipliers.combinedBeforeCompression ?? 0).toFixed(1)}`);
  };

  console.log('ABLATION');
  runCase('A_all_current', {});
  runCase('B_dps_only', { none: true });
  runCase('C_formula_buffs_only', { only: formulaBuffs });
  runCase('D_formula_debuffs_only', { only: formulaDebuffs });
  runCase('E_no_RYHG', { exclude: new Set(['ZM_FO_SKILL_RYHG', 'ZM_FO_SKILL_TYNF']) });
  runCase('F_no_QSYY', { exclude: new Set(['TH_FO_SKILL_QSYY']) });
  runCase('G_no_BS', { exclude: new Set(['YZ_FO_SKILL_BS']) });
  runCase('H_no_YBJH', { exclude: new Set(['FX_FO_SKILL_YBJH']) });
  runCase('I_no_big_harmed_FX', { exclude: new Set(['FX_FO_SKILL_JQS', 'FX_FO_SKILL_SWZH']) });
  runCase('J_no_support_formula_debuffs', { exclude: formulaDebuffs });
  runCase('K_no_support_formula_buffs', { exclude: formulaBuffs });
  runCase('L_all_current_T21_hp', {}, 'ZHENHAI_DUANLANG_T21', 'CHI_SUO_T21');
}

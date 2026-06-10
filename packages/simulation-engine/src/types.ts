export interface CharacterClass {
  ClassID: string;
  ClassName: string;
  Description: string;
  Race: string;
}

export interface CharacterAttributes {
  CharacterMinAttack: number;
  CharacterMaxAttack: number;
  CharacterDefense: number;
  CharacterHealth: number;
  CharacterMana: number;
  CharacterCriticalHitDamagePercent: number;
  CharacterCriticalHitRatePercent?: number;
  CharacterMonsterDamageIncreasePercent: number;
  CharacterOnePercentAttack?: number;
  CharacterOnePercentDefense?: number;
  CharacterOnePercentHealth?: number;
  CharacterOnePercentMana?: number;
}

export interface UserCharacter {
  UserID: string;
  CharacterID: string;
  CharacterName: string;
  ClassID: string;
  Faction: 'XIAN' | 'FO' | 'MO';
  Level: number;
  BaseAttributes: CharacterAttributes;
}

export interface MultiHitConfig {
  HitCount: number;
  DamageMultiplierPerHit?: number; // 每段伤害的倍增系数（基于第1段），例如1.3代表1.3^n
  DamageCap?: number; // 每段伤害的最高上限
  ScalingAttribute?: keyof SkillBonusAttributes; // 随段数线性递增的属性名
  ScalingStartValue?: number; // 第1段的属性值
  ScalingEndValue?: number; // 最后1段的属性值
}

export interface SkillBonusAttributes {
  SkillAttackPercentBonus?: number;
  SkillAttackFixedBonus?: number;
  SkillDefensePercentBonus?: number;
  SkillHealthPercentBonus?: number;
  SkillManaPercentBonus?: number;
  SkillCriticalDamagePercentBonus?: number;
  SkillDamageBonus?: number; // 伤害增加倍数
  MultiHitConfig?: MultiHitConfig; // 多段伤害配置
}

export interface Skill {
  SkillID: string;
  SkillName: string;
  RequiredClass: string;
  Faction: string; // 'XIAN' | 'FO' | 'MO'
  SkillImportanceWeight: number;
  SkillFrequency: number;
  Cooldown: number;
  CastTime: number;
  IsAOE: boolean;
  SkillBonusAttributes: SkillBonusAttributes;
  Description?: string;

  // --- v1.1 Simulation Extensions (Section 3.1) ---
  ActionType?: SkillActionType;
  HitTiming?: HitTimingConfig;
  MaxCharges?: number;
  ChargeReplenishTime?: number;
  CooldownResets?: CooldownResetEffect[];
  AppliesEffects?: AppliedEffectConfig[];
  MultiPhaseConfig?: MultiPhaseConfig;
  FourthGenPresets?: Partial<Record<'YING_JU' | 'HAO_YUE' | 'XI_RI', Partial<PlayerSkillOverride>>>;
  BuffDurationExtensionSeconds?: number;
  SkillLevel?: number;
  Variant?: string;
  FourthGenQuality?: 'YING_JU' | 'HAO_YUE' | 'XI_RI';
  RyhgPhase2DelaySeconds?: number;
}

export interface ClassSkills {
  [faction: string]: Skill[]; // Key is Faction ID (XIAN, FO, MO)
}

export interface AllSkills {
  [classID: string]: ClassSkills;
}

export interface MonsterAttributeModifiers {
  MonsterCriticalDamagePercentReduction: number;
  DamageCompressionPercent?: number;
  MonsterAttack?: number;
  MonsterDefense?: number;
  MonsterHealth?: number;
  MonsterCriticalHitRateReduction?: number;
}

export interface Monster {
  MonsterID: string;
  MonsterName: string;
  DungeonLevel: number;
  MonsterAttributeModifiers: MonsterAttributeModifiers;
}

export interface DungeonMeta {
  DungeonID: string;
  DungeonName: string;
  Description?: string;
  difficulty?: string;
  DungeonImportanceWeight?: number;
}

export interface Dungeon extends DungeonMeta {
  Monsters: Monster[];
}

export interface BuffEffects {
  BuffAttackPercentEffect?: number;
  BuffAttackFixedEffect?: number;
  BuffDefensePercentEffect?: number;
  BuffDefenseFixedEffect?: number;
  BuffHealthPercentEffect?: number;
  BuffHealthFixedEffect?: number;
  BuffManaPercentEffect?: number;
  BuffManaFixedEffect?: number;
  BuffCriticalDamagePercentEffect?: number;
  BuffCriticalHitRatePercentEffect?: number;
  BuffFocusPercentEffect?: number;
  BuffMonsterDamageIncreaseEffect?: number;
  BuffHolyWrathPercentEffect?: number;
  BuffMonsterCriticalDamagePercentEffect?: number;
  BuffMonsterHarmedPercentEffect?: number;
  BuffMonsterCritRateIncreaseEffect?: number;
  BuffSpeedPercentEffect?: number;
}

export interface Buff {
  BuffID: string;
  BuffName: string;
  IsDefaultActive: boolean;
  IsEditable?: boolean;
  DefaultEffectValue?: number;
  BuffEffects: BuffEffects;
  EffectId?: string;
}

export interface GameData {
  classes: CharacterClass[];
  skills: AllSkills;
  dungeons: DungeonMeta[];
  monstersByDungeon: Record<string, Monster[]>;
  buffs: Buff[];
}

export interface AgentCalcInput {
  classId?: string;
  className?: string;
  faction?: string;
  factionName?: string;
  attributes?: Record<string, unknown>;
  buffs?: unknown;
  target?: Record<string, unknown>;
}

export interface HitDamageResult {
  hitIndex: number;
  minFinalDamage: number;
  maxFinalDamage: number;
  avgFinalDamage: number;
}

export interface DamageMultiplierBreakdown {
  critMultiplier: number;
  skillDamageBonusMultiplier: number;
  characterMonsterDamageIncreaseMultiplier: number;
  monsterHarmedMultiplier: number;
  focusMultiplier: number;
  holyWrathMultiplier: number;
  combinedBeforeCompression: number;
  damageCompressionMultiplier?: number;
  combinedAfterCompression?: number;
}

export interface HitDamageFormulaTrace {
  hitIndex: number;
  skillBonusAttributes: SkillBonusAttributes;
  uncappedAttributes: CharacterAttributes;
  effectiveAttributes: CharacterAttributes;
  combinedBuffTotals: BuffEffects;
  ybjhGreenMultiplierActive: boolean;
  buffMonsterCriticalDamagePercentBeforeCap: number;
  buffMonsterCriticalDamagePercentAfterCap: number;
  buffMonsterHarmedPercentBeforeCap: number;
  buffMonsterHarmedPercentAfterCap: number;
  baseCriticalDamageBeforeCap: number;
  baseCriticalDamageAfterCap: number;
  monsterCriticalDamageReduction: number;
  criticalDamageTotal: number;
  minBaseDamage: number;
  maxBaseDamage: number;
  minFinalDamageBeforeCompression: number;
  maxFinalDamageBeforeCompression: number;
  avgFinalDamageBeforeCompression: number;
  multipliers: DamageMultiplierBreakdown;
}

export interface DamageResult {
  minBaseDamage: number;
  maxBaseDamage: number;
  minFinalDamage: number;
  maxFinalDamage: number;
  avgFinalDamage: number;
  hits?: HitDamageResult[];
}

export interface ValidationIssue {
  field: string;
  message: string;
}

// --- v1.1 Simulation Schemas (Section 3.1) ---

export type SkillActionType = 'DAMAGE' | 'BUFF' | 'DEBUFF' | 'UTILITY';
export type FactionId = 'XIAN' | 'FO' | 'MO';

export interface MultiPhaseConfig {
  Phases: {
    PhaseIndex: number;            // 阶段序号（从 1 开始）
    Duration: number;              // 本阶段持续时间（秒）
    AutoTransition: boolean;       // 时间到后是否自动进入下一阶段
    AppliesEffects: AppliedEffectConfig[]; // 本阶段挂载的状态，复用统一 Buff/Debuff 规则
  }[];
  ManualActivationAllowed: boolean; // 是否允许玩家点击提前激活下一阶段
}

export interface CooldownResetEffect {
  TargetSkillId: string;           // 目标技能 ID
  ResetType: 'REFRESH_CHARGES' | 'REDUCE_COOLDOWN'; // 刷新充能或减少 CD
  Charges?: number;                // 刷新层数
  ReductionSeconds?: number;       // 减少的 CD 秒数
}

export interface AppliedEffectConfig {
  EffectId: string;
  EffectName: string;
  Target: 'SELF' | 'ALLY' | 'TEAM' | 'ENEMY'; // 自身、指定队友、全队、Boss
  Duration: number;              // 持续时间（秒）
  Stackable?: boolean;           // 是否允许叠加
  MaxStacks?: number;            // 最大叠加层数
  RefreshOnReapply?: boolean;    // 重复施放时是否刷新持续时间
  ExclusiveGroup?: string;       // 互斥组，例如阵法、同类易伤；只有同组才互斥，不按属性字段自动互斥
  ExclusivePolicy?: 'MANUAL_PRIORITY' | 'HIGHEST_EFFECT_VALUE' | 'NO_OVERWRITE';
  Priority?: number;             // MANUAL_PRIORITY 模式下的手工覆盖优先级
  EffectPower?: number;          // HIGHEST_EFFECT_VALUE 模式下用于比较强弱的效果强度
  BuffEffects: BuffEffects;      // 具体属性数值，Debuff 也复用此结构描述对 Boss 的影响
  DynamicScalingAttribute?: string;   // 动态缩放参考属性，例如 "CharacterMaxAttack"
  DynamicScalingMultiplier?: number;  // 动态缩放倍数，例如 -1.0 (减防 100%) 或 8.0 (加血 8 倍)
  DynamicTargetField?: keyof BuffEffects; // 动态缩放作用的 BuffEffects 属性字段
}

export interface HitTimingConfig {
  Mode: 'EVENLY_DURING_CAST' | 'ON_CAST_COMPLETE' | 'CUSTOM';
  Offsets?: number[];            // CUSTOM 模式下每段命中相对 CAST_START 的秒数
}

export interface RankConfig {
  Rank: string;
  Threshold: number;
  Color: string;
  Shadow: string;
  Border: string;
  TextColor: string;
  Glow: string;
}

export interface PlayerSkillOverride {
  Cooldown?: number;                 // 玩家特定缩减后的 CD (秒)
  CastTime?: number;                 // 玩家特定缩减后的施法动作时间 (秒)
  MaxCharges?: number;
  ChargeReplenishTime?: number;
  HitTiming?: HitTimingConfig;
  SkillBonusAttributes?: Partial<SkillBonusAttributes>;
  AppliesEffects?: Record<string, Partial<AppliedEffectConfig>>; // 按 EffectId 覆盖持续时间或效果数值
  MultiPhaseConfig?: Partial<MultiPhaseConfig>;
  FourthGenQuality?: 'YING_JU' | 'HAO_YUE' | 'XI_RI';
  BuffDurationExtensionSeconds?: number;
  SkillLevel?: number;
  Variant?: string;
  RyhgPhase2DelaySeconds?: number;
}

// --- Phase C: Discrete Event Simulation Core ---

export type SimEventType =
  | 'CAST_START'
  | 'CAST_COMPLETE'
  | 'HIT'
  | 'BUFF_APPLY'
  | 'BUFF_EXPIRE'
  | 'BUFF_EXTEND'
  | 'COOLDOWN_READY'
  | 'PHASE_TRANSITION'
  | 'BOSS_DEAD'
  | 'ACTOR_DECISION';

export interface SimEvent {
  timeMs: number;
  type: SimEventType;
  actorId?: string;
  targetId?: string;
  skillId?: string;
  sequence?: number;
  data?: Record<string, unknown>;
}

export interface SimEventLog extends SimEvent {
  sequence: number;
  status: 'PROCESSED' | 'SKIPPED' | 'FAILED';
  message?: string;
}

export interface HitDamageRecord {
  TimeMs: number;
  ActorId: string;
  SkillId: string;
  SkillName: string;
  HitIndex: number;
  HitCount: number;
  MinDamage: number;
  MaxDamage: number;
  AvgDamage: number;
  RawAvgDamage: number;
  DamageApplied: number;
  ActiveEffectIds: string[];
  BossHpBefore: number;
  BossHpAfter: number;
}

export interface DamageAuditEffectSnapshot {
  InstanceId: string;
  EffectId: string;
  EffectName: string;
  SourceActorId: string;
  SourceSkillId: string;
  TargetId: string;
  RemainingMs: number;
  StackCount: number;
  BuffEffects: BuffEffects;
  IncludedInDamageFormula: boolean;
}

export interface DamageAuditRecord {
  TimeMs: number;
  ActorId: string;
  SkillId: string;
  SkillName: string;
  HitIndex: number;
  HitCount: number;
  BossHpBefore: number;
  BossHpAfter: number;
  DamageApplied: number;
  BaseAttributes: CharacterAttributes;
  UncappedAttributes: CharacterAttributes;
  EffectiveAttributes: CharacterAttributes;
  ActorBuffTotals: BuffEffects;
  BossDebuffTotalsDisplayed: BuffEffects;
  BossDebuffTotalsInFormula: BuffEffects;
  CombinedBuffTotals: BuffEffects;
  Formula: HitDamageFormulaTrace;
  ActiveEffects: DamageAuditEffectSnapshot[];
}

export interface DamageAuditConfig {
  enabled: boolean;
  maxRecords?: number;
  actorId?: string;
  skillIds?: string[];
}

export interface InitialEffectConfig {
  timeMs?: number;
  targetId: string;
  sourceActorId: string;
  sourceSkillId: string;
  effect: AppliedEffectConfig;
}

export interface DpsCommonEffectsConfig {
  sanwanFocus?: boolean;
  jiuhuaCriticalDamage?: boolean;
  shenbaoAttack?: boolean;
  fozunAttack?: boolean;
  familyStats?: boolean;
  artifactEffects?: boolean;
}

export interface DungeonEffectsConfig {
  greenPoint150?: boolean;
  attack?: boolean;
  criticalDamage?: boolean;
  purplePoint?: boolean;
  harmed?: boolean;
}

export type ActorRole = 'DPS' | 'SUPPORT';

export interface ManualTimelineAction {
  timeMs: number;
  skillId: string;
  targetActorId?: string;
  onUnavailable?: 'SKIP' | 'WAIT' | 'FAIL';
}

export interface SkillAction {
  skillId: string;
  targetActorId?: string;
}

export type DpsStrategyConfig =
  | {
      type: 'MANUAL_TIMELINE';
      actions: ManualTimelineAction[];
    }
  | {
      type: 'FIXED_ROTATION';
      skillIds: string[];
      startTimeMs?: number;
      skillExpiryMs?: Record<string, number>;
      waitMs?: number;
    }
  | {
      type: 'SKILL_BAR';
      skillIds: string[];
      startTimeMs?: number;
      scanMode?: 'FROM_FIRST_EACH_DECISION' | 'CONTINUE_POINTER';
      skillExpiryMs?: Record<string, number>;
      waitMs?: number;
    };

export type SupportStrategyConfig =
  | {
      type: 'SETUP_PHASE';
      actions: ManualTimelineAction[];
    }
  | {
      type: 'CAST_ON_READY';
      skillIds: string[];
      startTimeMs?: number;
      waitMs?: number;
      targetActorId?: string;
    }
  | {
      type: 'TIMESTAMPED_ACTIONS';
      actions: ManualTimelineAction[];
    };

export type ActorStrategyConfig = DpsStrategyConfig | SupportStrategyConfig;

export interface SimulationActorConfig {
  actorId: string;
  classId: string;
  role: ActorRole;
  baseAttributes?: CharacterAttributes;
  baseSkills: Skill[];
  skillOverrides?: Record<string, PlayerSkillOverride>;
  strategy?: ActorStrategyConfig;
  gcdMs?: number;
}

export interface AttributeCapsConfig {
  EnableCaps: boolean;               // 是否启用数据上限开关；未传入时默认启用，显式 false 才关闭
  CapHealth?: number;                // 气血上限，默认 4000000
  CapMana?: number;                  // 真气上限，默认 6000000
  CapAttack?: number;                // 攻击上限（最小/最大），默认 750000
  CapDefense?: number;               // 防御上限，默认 500000
  CapCriticalDamage?: number;        // 爆伤百分比加成上限，默认 3000
  CapGreenPoints?: number;           // 绿点（对怪爆伤）上限，默认 900
  CapMonsterHarmed?: number;         // 受到伤害增加上限，默认 120
}

export interface AssemblerDpsActorInput {
  actorId: string;
  classId: string;
  faction: FactionId;
  profileAttributes: CharacterAttributes;
  skillOverrides?: Record<string, PlayerSkillOverride>;
  strategy: DpsStrategyConfig;
  skillIds?: string[];
  gcdMs?: number;
}

export interface AssemblerSupportActorInput {
  actorId: string;
  classId: string;
  faction: FactionId;
  profileAttributes?: CharacterAttributes;
  strategy?: SupportStrategyConfig;
  skillOverrides?: Record<string, PlayerSkillOverride>;
  skillIds?: string[];
  gcdMs?: number;
}

export interface AssembleScenarioInput {
  scenarioId?: string;
  maxTimeMs: number;
  dungeonId?: string;
  bossId: string;
  bossHealthOverride?: number;
  dpsActor: AssemblerDpsActorInput;
  supports?: AssemblerSupportActorInput[];
  attributeCaps?: AttributeCapsConfig;
  damageAudit?: DamageAuditConfig;
  dpsCommonEffects?: DpsCommonEffectsConfig;
  dungeonEffects?: DungeonEffectsConfig;
  initialEffects?: InitialEffectConfig[];
  randomSeed?: number;
  gcdMs?: number;
}

export interface AssembleScenarioGameData {
  skills: AllSkills;
  monstersByDungeon: Record<string, Monster[]>;
}

export interface SimulationScenario {
  scenarioId?: string;
  maxTimeMs: number;
  boss: Monster;
  bossHealthOverride?: number;
  actors: SimulationActorConfig[];
  dpsActorId?: string;
  gcdMs?: number;
  attributeCaps?: AttributeCapsConfig; // 数据上限配置
  damageAudit?: DamageAuditConfig;
  initialEffects?: InitialEffectConfig[];
  randomSeed?: number;
}

export interface SkillBreakdown {
  SkillId: string;
  SkillName: string;
  HitCount: number;
  TotalDamage: number;
}

export interface SimulationSummary {
  TotalDamage: number;
  DpsStartMs?: number;
  DpsDurationMs: number;
  AverageDps: number;
  SkillBreakdown: SkillBreakdown[];
}

export interface SimulationResult {
  scenarioId?: string;
  events: SimEventLog[];
  hitRecords: HitDamageRecord[];
  damageAuditRecords?: DamageAuditRecord[];
  boss: {
    monsterId: string;
    monsterName: string;
    startingHealth: number;
    currentHealth: number;
    killedAtMs?: number;
  };
  summary: SimulationSummary;
}

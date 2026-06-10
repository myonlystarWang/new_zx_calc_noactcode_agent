import { Actor } from './actor.js';
import { resolveHitDamageWithTrace } from './calculator.js';
import { EffectManager, type EffectInstance } from './effects.js';
import { sumBuffEffectsFromBuffs } from './attributes.js';
import { isBuffEffectKey, isCharacterAttributeKey } from './field_keys.js';
import { StrategyController } from './strategies.js';
import { Timeline } from './timeline.js';
import type {
  ActorStrategyConfig,
  AppliedEffectConfig,
  Buff,
  BuffEffects,
  DamageAuditEffectSnapshot,
  DamageAuditRecord,
  HitDamageRecord,
  ManualTimelineAction,
  Monster,
  SimEvent,
  SimEventLog,
  SimulationActorConfig,
  SimulationResult,
  SimulationScenario,
  Skill,
  SkillBreakdown
} from './types.js';

const BOSS_TARGET_ID = 'boss';
const BOSS_DAMAGE_EFFECT_FIELDS = new Set<keyof BuffEffects>([
  'BuffMonsterCriticalDamagePercentEffect',
  'BuffMonsterHarmedPercentEffect'
]);

const ACTOR_DAMAGE_EFFECT_FIELDS = new Set<keyof BuffEffects>([
  'BuffAttackPercentEffect',
  'BuffAttackFixedEffect',
  'BuffDefensePercentEffect',
  'BuffDefenseFixedEffect',
  'BuffHealthPercentEffect',
  'BuffHealthFixedEffect',
  'BuffManaPercentEffect',
  'BuffManaFixedEffect',
  'BuffCriticalDamagePercentEffect',
  'BuffFocusPercentEffect',
  'BuffMonsterDamageIncreaseEffect',
  'BuffHolyWrathPercentEffect'
]);

interface RuntimeActor {
  config: SimulationActorConfig;
  actor: Actor;
}

interface DynamicEffectResolution {
  effect?: AppliedEffectConfig;
  error?: string;
}

export class SimulationEngine {
  private readonly timeline = new Timeline();
  private readonly strategyController = new StrategyController();
  private readonly actors = new Map<string, RuntimeActor>();
  private readonly effects = new Map<string, EffectManager>();
  private readonly events: SimEventLog[] = [];
  private readonly hitRecords: HitDamageRecord[] = [];
  private readonly damageAuditRecords: DamageAuditRecord[] = [];
  private readonly boss: Monster;
  private readonly startingBossHealth: number;
  private bossHealth: number;
  private bossKilledAtMs: number | undefined;
  private randomState: number | undefined;

  public constructor(private readonly scenario: SimulationScenario) {
    this.boss = scenario.boss;
    const health = scenario.bossHealthOverride ?? scenario.boss.MonsterAttributeModifiers.MonsterHealth;
    if (health === undefined || health <= 0) {
      throw new Error(`Boss "${scenario.boss.MonsterID}" is missing a positive MonsterHealth value.`);
    }

    this.startingBossHealth = health;
    this.bossHealth = health;
    if (typeof scenario.randomSeed === 'number' && Number.isFinite(scenario.randomSeed)) {
      this.randomState = scenario.randomSeed >>> 0;
    }
    this.effects.set(BOSS_TARGET_ID, new EffectManager(BOSS_TARGET_ID));

    for (const actorConfig of scenario.actors) {
      const actor = new Actor(
        actorConfig.actorId,
        actorConfig.classId,
        actorConfig.baseSkills,
        actorConfig.skillOverrides ?? {},
        actorConfig.baseAttributes,
        actorConfig.gcdMs ?? scenario.gcdMs ?? 500
      );
      this.actors.set(actorConfig.actorId, { config: actorConfig, actor });
      this.effects.set(actorConfig.actorId, new EffectManager(actorConfig.actorId));
    }
  }

  public run(): SimulationResult {
    this.scheduleInitialEvents();

    while (!this.timeline.isEmpty()) {
      const event = this.timeline.next();
      if (!event) break;
      if (event.timeMs > this.scenario.maxTimeMs) break;

      this.processEvent(event);
      if (this.bossKilledAtMs !== undefined) break;
    }

    return this.buildResult();
  }

  private scheduleInitialEvents(): void {
    for (const initialEffect of this.scenario.initialEffects ?? []) {
      this.timeline.schedule({
        timeMs: initialEffect.timeMs ?? 0,
        type: 'BUFF_APPLY',
        actorId: initialEffect.sourceActorId,
        targetId: initialEffect.targetId,
        skillId: initialEffect.sourceSkillId,
        data: {
          effect: initialEffect.effect,
          sourceActorId: initialEffect.sourceActorId,
          sourceSkillId: initialEffect.sourceSkillId
        }
      });
    }

    for (const runtime of this.actors.values()) {
      const strategy = runtime.config.strategy;
      if (!strategy) continue;

      if (strategy.type === 'MANUAL_TIMELINE' || strategy.type === 'SETUP_PHASE' || strategy.type === 'TIMESTAMPED_ACTIONS') {
        for (const action of strategy.actions) {
          this.timeline.schedule({
            timeMs: action.timeMs,
            type: 'CAST_START',
            actorId: runtime.config.actorId,
            targetId: action.targetActorId,
            skillId: action.skillId,
            data: {
              onUnavailable: action.onUnavailable ?? 'SKIP',
              scheduledBy: strategy.type
            }
          });
        }
        continue;
      }

      const startTimeMs = 'startTimeMs' in strategy ? strategy.startTimeMs ?? 0 : 0;
      this.timeline.schedule({
        timeMs: startTimeMs,
        type: 'ACTOR_DECISION',
        actorId: runtime.config.actorId
      });
    }
  }

  private processEvent(event: SimEvent): void {
    switch (event.type) {
      case 'ACTOR_DECISION':
        this.handleActorDecision(event);
        return;
      case 'CAST_START':
        this.handleCastStart(event);
        return;
      case 'CAST_COMPLETE':
        this.handleCastComplete(event);
        return;
      case 'HIT':
        this.handleHit(event);
        return;
      case 'BUFF_APPLY':
        this.handleBuffApply(event);
        return;
      case 'BUFF_EXPIRE':
        this.handleBuffExpire(event);
        return;
      case 'COOLDOWN_READY':
        this.handleCooldownReady(event);
        return;
      case 'PHASE_TRANSITION':
        this.handlePhaseTransition(event);
        return;
      case 'BOSS_DEAD':
        this.bossKilledAtMs = event.timeMs;
        this.logEvent(event, 'PROCESSED', 'Boss defeated.');
        return;
      default:
        this.logEvent(event, 'SKIPPED', `Unhandled event type: ${event.type}`);
    }
  }

  private handleActorDecision(event: SimEvent): void {
    const runtime = this.getRuntimeActor(event.actorId);
    if (!runtime) {
      this.logEvent(event, 'FAILED', 'Unknown actor for ACTOR_DECISION.');
      return;
    }

    const nextActionTimeMs = runtime.actor.getNextActionTimeMs(event.timeMs);
    if (nextActionTimeMs > event.timeMs) {
      this.timeline.schedule({
        timeMs: nextActionTimeMs,
        type: 'ACTOR_DECISION',
        actorId: runtime.config.actorId
      });
      this.logEvent(event, 'SKIPPED', 'Actor is locked; decision rescheduled.');
      return;
    }

    const decision = this.strategyController.selectNextAction(runtime.actor, runtime.config.strategy, event.timeMs);
    if (decision.skillId) {
      this.timeline.schedule({
        timeMs: event.timeMs,
        type: 'CAST_START',
        actorId: runtime.config.actorId,
        targetId: decision.targetActorId,
        skillId: decision.skillId,
        data: {
          onUnavailable: 'WAIT',
          scheduledBy: 'ACTOR_DECISION'
        }
      });
      this.logEvent(event, 'PROCESSED', `Selected skill ${decision.skillId}.`);
      return;
    }

    if (decision.waitUntilMs !== undefined && decision.waitUntilMs <= this.scenario.maxTimeMs) {
      this.timeline.schedule({
        timeMs: decision.waitUntilMs,
        type: 'ACTOR_DECISION',
        actorId: runtime.config.actorId
      });
    }
    this.logEvent(event, 'SKIPPED', decision.reason ?? 'No action selected.');
  }

  private handleCastStart(event: SimEvent): void {
    const runtime = this.getRuntimeActor(event.actorId);
    const skill = this.getSkill(runtime, event.skillId);
    if (!runtime || !skill || !event.skillId) {
      this.logEvent(event, 'FAILED', 'Unknown actor or skill for CAST_START.');
      return;
    }

    const unavailableUntilMs = Math.max(
      runtime.actor.getNextActionTimeMs(event.timeMs),
      runtime.actor.getNextUsableTimeMs(event.skillId, event.timeMs)
    );
    const canCast = unavailableUntilMs <= event.timeMs && runtime.actor.isSkillUsable(event.skillId, event.timeMs);
    if (!canCast) {
      const policy = event.data?.onUnavailable ?? 'SKIP';
      if (policy === 'WAIT') {
        this.timeline.schedule({
          timeMs: unavailableUntilMs,
          type: 'CAST_START',
          actorId: event.actorId,
          targetId: event.targetId,
          skillId: event.skillId,
          data: event.data
        });
        this.logEvent(event, 'SKIPPED', `Skill unavailable; cast delayed to ${unavailableUntilMs}ms.`);
        return;
      }

      this.logEvent(event, policy === 'FAIL' ? 'FAILED' : 'SKIPPED', `Skill ${event.skillId} unavailable.`);
      return;
    }

    const actualCastTimeMs = this.getActualCastTimeMs(runtime.config.actorId, skill, event.timeMs);
    const cooldownReadyTimes = runtime.actor.beginCast(event.skillId, event.timeMs, actualCastTimeMs);
    for (const ready of cooldownReadyTimes) {
      this.timeline.schedule({
        timeMs: ready.timeMs,
        type: 'COOLDOWN_READY',
        actorId: runtime.config.actorId,
        skillId: event.skillId,
        data: ready.rechargeToken !== undefined ? { rechargeToken: ready.rechargeToken } : undefined
      });
    }

    this.applyCooldownResets(runtime.actor, skill, event.timeMs);
    this.applyBuffDurationExtensions(skill, event.timeMs, event.targetId);
    this.scheduleSkillEffects(runtime.config.actorId, skill, event.timeMs, event.targetId);
    this.scheduleSkillHits(runtime.config.actorId, skill, event.timeMs, actualCastTimeMs);
    this.schedulePhaseTransitions(runtime.config.actorId, skill, event.timeMs);

    this.timeline.schedule({
      timeMs: event.timeMs + actualCastTimeMs,
      type: 'CAST_COMPLETE',
      actorId: runtime.config.actorId,
      skillId: event.skillId
    });

    this.logEvent(event, 'PROCESSED', `Cast started for ${event.skillId}.`);
  }

  private handleCastComplete(event: SimEvent): void {
    const runtime = this.getRuntimeActor(event.actorId);
    if (!runtime) {
      this.logEvent(event, 'FAILED', 'Unknown actor for CAST_COMPLETE.');
      return;
    }

    runtime.actor.completeCast(event.timeMs);

    if (event.skillId === 'ZS_MO_SKILL_SY2' && runtime.actor.Skills.ZS_MO_SKILL_CLX) {
      runtime.actor.applyCooldownReady('ZS_MO_SKILL_CLX', event.timeMs);
    }

    if (event.skillId && isXianCangLongXiaoSkill(event.skillId) && this.nextRandom() < 0.30) {
      runtime.actor.applyCooldownReady(event.skillId, event.timeMs);
    }

    if (this.shouldAutoDecide(runtime.config.strategy)) {
      this.timeline.schedule({
        timeMs: Math.max(event.timeMs, runtime.actor.getNextActionTimeMs(event.timeMs)),
        type: 'ACTOR_DECISION',
        actorId: runtime.config.actorId
      });
    }
    this.logEvent(event, 'PROCESSED', 'Cast completed.');
  }

  private handleHit(event: SimEvent): void {
    if (this.bossKilledAtMs !== undefined || this.bossHealth <= 0) {
      this.logEvent(event, 'SKIPPED', 'Boss already defeated.');
      return;
    }

    const runtime = this.getRuntimeActor(event.actorId);
    const skill = this.getSkill(runtime, event.skillId);
    if (!runtime || !skill || !runtime.actor.BaseAttributes) {
      this.logEvent(event, 'FAILED', 'Unknown actor, skill, or base attributes for HIT.');
      return;
    }

    const hitIndex = asNumber(event.data?.hitIndex, 1);
    const hitCount = asNumber(event.data?.hitCount, 1);
    const actorEffectManager = this.effects.get(runtime.config.actorId);
    const bossEffectManager = this.effects.get(BOSS_TARGET_ID);
    const actorEffectInstances = actorEffectManager?.getActiveEffects() ?? [];
    const bossEffectInstances = bossEffectManager?.getActiveEffects() ?? [];
    const actorEffects = actorEffectManager?.toBuffs() ?? [];
    const bossEffectsDisplayed = bossEffectManager?.toBuffs() ?? [];
    const bossEffects = filterBossDamageBuffs(bossEffectsDisplayed);
    const activeBuffs = [...actorEffects, ...bossEffects];
    const activeEffectIds = [
      ...(actorEffectManager?.getActiveEffectIds() ?? []),
      ...(bossEffectManager?.getActiveEffectIds() ?? [])
    ];

    const isClxSkill = event.skillId && event.skillId.startsWith('ZS_') && (
      event.skillId.endsWith('_CLX') ||
      event.skillId.endsWith('_CLXX') ||
      event.skillId.endsWith('_CLXC') ||
      event.skillId.endsWith('_CLXS')
    );

    let hasLongNuStack = false;
    if (isClxSkill) {
      const effectManager = actorEffectManager;
      if (effectManager) {
        const active = effectManager.getActiveEffects();
        const lnIdx = active.findIndex(e => e.EffectId === 'ZS_BUFF_LONG_NU');
        if (lnIdx !== -1) {
          const lnEff = active[lnIdx];
          if (lnEff.StackCount > 1) {
            lnEff.StackCount -= 1;
          } else {
            effectManager.expireEffect(lnEff.InstanceId);
          }
          hasLongNuStack = true;
        }
      }
    }

    let skillToUse = skill;
    if (hasLongNuStack) {
      skillToUse = {
        ...skill,
        SkillBonusAttributes: {
          ...skill.SkillBonusAttributes,
          SkillAttackPercentBonus: (skill.SkillBonusAttributes.SkillAttackPercentBonus ?? 0) + 300
        }
      };
    }

    if (event.skillId === 'ZS_MO_SKILL_LYLZ' && hitIndex === hitCount) {
      skillToUse = {
        ...skillToUse,
        SkillBonusAttributes: {
          ...skillToUse.SkillBonusAttributes,
          SkillManaPercentBonus: (skillToUse.SkillBonusAttributes.SkillManaPercentBonus ?? 0) + 10
        }
      };
    }

    const resolvedDamage = resolveHitDamageWithTrace(
      runtime.actor.BaseAttributes,
      skillToUse,
      this.boss,
      activeBuffs,
      hitIndex,
      {},
      this.scenario.attributeCaps
    );
    const damage = resolvedDamage.damage;
    const compressionMultiplier = getDamageCompressionMultiplier(this.boss);
    const minDamage = damage.minFinalDamage * compressionMultiplier;
    const maxDamage = damage.maxFinalDamage * compressionMultiplier;
    const avgDamage = damage.avgFinalDamage * compressionMultiplier;
    const bossHpBefore = this.bossHealth;
    const damageApplied = Math.min(avgDamage, this.bossHealth);
    this.bossHealth = Math.max(0, this.bossHealth - damageApplied);

    this.hitRecords.push({
      TimeMs: event.timeMs,
      ActorId: runtime.config.actorId,
      SkillId: skill.SkillID,
      SkillName: skill.SkillName,
      HitIndex: hitIndex,
      HitCount: hitCount,
      MinDamage: minDamage,
      MaxDamage: maxDamage,
      AvgDamage: avgDamage,
      RawAvgDamage: damage.avgFinalDamage,
      DamageApplied: damageApplied,
      ActiveEffectIds: activeEffectIds,
      BossHpBefore: bossHpBefore,
      BossHpAfter: this.bossHealth
    });

    if (this.shouldRecordDamageAudit(runtime.config.actorId, skill.SkillID)) {
      this.damageAuditRecords.push({
        TimeMs: event.timeMs,
        ActorId: runtime.config.actorId,
        SkillId: skill.SkillID,
        SkillName: skill.SkillName,
        HitIndex: hitIndex,
        HitCount: hitCount,
        BossHpBefore: bossHpBefore,
        BossHpAfter: this.bossHealth,
        DamageApplied: damageApplied,
        BaseAttributes: { ...runtime.actor.BaseAttributes },
        UncappedAttributes: { ...resolvedDamage.trace.uncappedAttributes },
        EffectiveAttributes: { ...resolvedDamage.trace.effectiveAttributes },
        ActorBuffTotals: sumBuffEffectsFromBuffs(actorEffects),
        BossDebuffTotalsDisplayed: sumBuffEffectsFromBuffs(bossEffectsDisplayed),
        BossDebuffTotalsInFormula: sumBuffEffectsFromBuffs(bossEffects),
        CombinedBuffTotals: { ...resolvedDamage.trace.combinedBuffTotals },
        Formula: {
          ...resolvedDamage.trace,
          multipliers: {
            ...resolvedDamage.trace.multipliers,
            damageCompressionMultiplier: compressionMultiplier,
            combinedAfterCompression: resolvedDamage.trace.multipliers.combinedBeforeCompression * compressionMultiplier
          }
        },
        ActiveEffects: [
          ...actorEffectInstances.map(effect => toDamageAuditEffectSnapshot(effect, event.timeMs, isActorEffectIncludedInDamageFormula(effect))),
          ...bossEffectInstances.map(effect => toDamageAuditEffectSnapshot(effect, event.timeMs, isBossEffectIncludedInDamageFormula(effect)))
        ]
      });
    }

    if (event.skillId === 'ZS_MO_SKILL_LYLZ' && hitIndex === 3) {
      if (this.nextRandom() < 0.15) {
        if (runtime.actor.Skills.ZS_MO_SKILL_CLX) {
          runtime.actor.applyCooldownReady('ZS_MO_SKILL_CLX', event.timeMs);
        }
      }
    }

    if (this.bossHealth <= 0) {
      this.timeline.schedule({
        timeMs: event.timeMs,
        type: 'BOSS_DEAD',
        actorId: runtime.config.actorId,
        skillId: skill.SkillID
      });
    }

    this.logEvent(event, 'PROCESSED', `Hit ${hitIndex}/${hitCount} resolved.`);
  }

  private handleBuffApply(event: SimEvent): void {
    const effect = event.data?.effect as AppliedEffectConfig | undefined;
    const sourceActorId = asString(event.data?.sourceActorId, event.actorId ?? '');
    const sourceSkillId = asString(event.data?.sourceSkillId, event.skillId ?? '');
    const targetId = event.targetId ?? BOSS_TARGET_ID;
    const manager = this.effects.get(targetId);

    if (!effect || !manager || !sourceActorId || !sourceSkillId) {
      this.logEvent(event, 'FAILED', 'Invalid BUFF_APPLY payload.');
      return;
    }

    const dynamicResolution = this.resolveDynamicEffect(effect, sourceActorId, sourceSkillId);
    if (!dynamicResolution.effect) {
      this.logEvent(event, 'FAILED', dynamicResolution.error ?? 'Failed to resolve dynamic effect.');
      return;
    }

    const effectToApply = this.filterBuffEffects(dynamicResolution.effect);
    const result = manager.applyEffect(effectToApply, event.timeMs, sourceActorId, sourceSkillId);
    if (result.applied) {
      this.timeline.schedule({
        timeMs: result.applied.EndTimeMs,
        type: 'BUFF_EXPIRE',
        targetId: targetId,
        skillId: sourceSkillId,
        data: {
          instanceId: result.applied.InstanceId,
          effectId: result.applied.EffectId
        }
      });
    }

    const loggedEvent: SimEvent = {
      ...event,
      data: {
        ...event.data,
        effect: effectToApply,
        appliedInstanceId: result.applied?.InstanceId,
        appliedEffectId: result.applied?.EffectId,
        appliedEndTimeMs: result.applied?.EndTimeMs,
        replacedInstanceIds: result.replaced.map(item => item.InstanceId),
        replacedEffectIds: result.replaced.map(item => item.EffectId),
        ignored: result.ignored
      }
    };

    this.logEvent(
      loggedEvent,
      result.ignored ? 'SKIPPED' : 'PROCESSED',
      result.reason ?? `Effect ${effectToApply.EffectId} applied.`
    );
  }

  private filterBuffEffects(effect: AppliedEffectConfig): AppliedEffectConfig {
    const effectId = effect.EffectId;
    let newBuffEffects = { ...effect.BuffEffects };

    // 1. Completely disabled static buffs:
    const disabledEffectIds = new Set([
      'TY_BUFF_DCB_HEALTH_PCT',
      'TY_BUFF_MKXJ_HEALTH',
      'YZ_BUFF_TGFM_ATTACK_PCT',
      'YZ_BUFF_WXBG_DEFENSE_PCT'
    ]);

    if (disabledEffectIds.has(effectId)) {
      newBuffEffects = {};
    }

    // 2. Partially used static buffs:
    // JSKW (金蛇狂舞): only focus is kept (BuffFocusPercentEffect)
    if (effectId === 'TH_BUFF_JSKW') {
      newBuffEffects = {
        BuffFocusPercentEffect: newBuffEffects.BuffFocusPercentEffect
      };
    }

    // ZGDD_STATS (枕戈待旦): only focus is kept. Speed is in ZGDD_SPEED.
    if (effectId === 'ZS_BUFF_ZGDD_STATS') {
      newBuffEffects = {
        BuffFocusPercentEffect: newBuffEffects.BuffFocusPercentEffect
      };
    }

    // QXHS_STATS (清啸横朔): only focus is kept. Speed is in QXHS_SPEED.
    if (effectId === 'ZS_BUFF_QXHS_STATS') {
      newBuffEffects = {
        BuffFocusPercentEffect: newBuffEffects.BuffFocusPercentEffect
      };
    }

    // LZYY_STATS (龙战于野): only focus is kept. Speed is in LZYY_SPEED.
    if (effectId === 'ZS_BUFF_LZYY_STATS') {
      newBuffEffects = {
        BuffFocusPercentEffect: newBuffEffects.BuffFocusPercentEffect
      };
    }

    return {
      ...effect,
      BuffEffects: newBuffEffects
    };
  }

  private handleBuffExpire(event: SimEvent): void {
    const targetId = event.targetId ?? BOSS_TARGET_ID;
    const manager = this.effects.get(targetId);
    const instanceId = asString(event.data?.instanceId, '');
    if (!manager || !instanceId) {
      this.logEvent(event, 'FAILED', 'Invalid BUFF_EXPIRE payload.');
      return;
    }

    const effectInstance = manager.getEffectInstance(instanceId);
    if (effectInstance && effectInstance.EndTimeMs > event.timeMs) {
      this.timeline.schedule({
        timeMs: effectInstance.EndTimeMs,
        type: 'BUFF_EXPIRE',
        targetId: targetId,
        skillId: event.skillId,
        data: {
          instanceId: effectInstance.InstanceId,
          effectId: effectInstance.EffectId
        }
      });
      this.logEvent(event, 'SKIPPED', `Effect ${effectInstance.EffectId} expiry postponed to ${effectInstance.EndTimeMs}ms.`);
      return;
    }

    const expired = manager.expireEffect(instanceId);
    this.logEvent(event, expired ? 'PROCESSED' : 'SKIPPED', expired ? 'Effect expired.' : 'Stale expiry ignored.');
  }

  private handleCooldownReady(event: SimEvent): void {
    const runtime = this.getRuntimeActor(event.actorId);
    if (!runtime || !event.skillId) {
      this.logEvent(event, 'FAILED', 'Invalid COOLDOWN_READY payload.');
      return;
    }

    const rechargeToken = typeof event.data?.rechargeToken === 'number'
      ? event.data.rechargeToken
      : undefined;
    const readyResult = runtime.actor.applyCooldownReady(event.skillId, event.timeMs, rechargeToken);
    if (!readyResult.applied) {
      this.logEvent(event, 'SKIPPED', `Stale cooldown ready ignored for ${event.skillId}.`);
      return;
    }
    if (readyResult.nextReady) {
      this.timeline.schedule({
        timeMs: readyResult.nextReady.timeMs,
        type: 'COOLDOWN_READY',
        actorId: runtime.config.actorId,
        skillId: event.skillId,
        data: readyResult.nextReady.rechargeToken !== undefined
          ? { rechargeToken: readyResult.nextReady.rechargeToken }
          : undefined
      });
    }
    if (this.shouldAutoDecide(runtime.config.strategy)) {
      this.timeline.schedule({
        timeMs: Math.max(event.timeMs, runtime.actor.getNextActionTimeMs(event.timeMs)),
        type: 'ACTOR_DECISION',
        actorId: runtime.config.actorId
      });
    }
    this.logEvent(event, 'PROCESSED', `Cooldown ready for ${event.skillId}.`);
  }

  private handlePhaseTransition(event: SimEvent): void {
    const runtime = this.getRuntimeActor(event.actorId);
    const skill = this.getSkill(runtime, event.skillId);
    const phaseIndex = asNumber(event.data?.phaseIndex, 0);
    const phase = skill?.MultiPhaseConfig?.Phases.find(item => item.PhaseIndex === phaseIndex);
    if (!runtime || !skill || !phase) {
      this.logEvent(event, 'FAILED', 'Invalid PHASE_TRANSITION payload.');
      return;
    }

    for (const effect of phase.AppliesEffects) {
      for (const targetId of this.resolveEffectTargets(runtime.config.actorId, effect.Target, undefined)) {
        this.timeline.schedule({
          timeMs: event.timeMs,
          type: 'BUFF_APPLY',
          actorId: runtime.config.actorId,
          targetId,
          skillId: skill.SkillID,
          data: {
            effect,
            sourceActorId: runtime.config.actorId,
            sourceSkillId: skill.SkillID
          }
        });
      }
    }

    if (phase.AutoTransition) {
      const nextPhase = skill.MultiPhaseConfig?.Phases.find(item => item.PhaseIndex === phaseIndex + 1);
      if (nextPhase) {
        this.timeline.schedule({
          timeMs: event.timeMs + Math.round(phase.Duration * 1000),
          type: 'PHASE_TRANSITION',
          actorId: runtime.config.actorId,
          skillId: skill.SkillID,
          data: {
            phaseIndex: nextPhase.PhaseIndex
          }
        });
      }
    }

    this.logEvent(event, 'PROCESSED', `Phase ${phaseIndex} applied for ${skill.SkillID}.`);
  }

  private scheduleSkillEffects(sourceActorId: string, skill: Skill, timeMs: number, targetActorId?: string): void {
    let effectsToApply = skill.AppliesEffects ?? [];
    if (skill.SkillID === 'TH_FO_SKILL_JLS') {
      effectsToApply = [];
    } else if (skill.SkillID === 'TEST_TH_FO_SKILL_JLS') {
      const level = skill.SkillLevel ?? 0;
      if (level === 0) {
        effectsToApply = [];
      } else if (level === 1) {
        effectsToApply = effectsToApply.filter(e => e.EffectId.startsWith('TH_BUFF_YSYY2_'));
      } else if (level === 2) {
        effectsToApply = effectsToApply.filter(e => e.EffectId === 'TH_BUFF_QSYY');
      } else if (level === 3) {
        effectsToApply = effectsToApply.filter(e => e.EffectId.startsWith('TH_BUFF_YSYY2_') || e.EffectId === 'TH_BUFF_QSYY');
      }
    }

    for (const effect of effectsToApply) {
      for (const targetId of this.resolveEffectTargets(sourceActorId, effect.Target, targetActorId)) {
        this.timeline.schedule({
          timeMs,
          type: 'BUFF_APPLY',
          actorId: sourceActorId,
          targetId,
          skillId: skill.SkillID,
          data: {
            effect,
            sourceActorId,
            sourceSkillId: skill.SkillID
          }
        });
      }
    }

    const firstPhase = skill.MultiPhaseConfig?.Phases.find(phase => phase.PhaseIndex === 1);
    if (firstPhase) {
      for (const effect of firstPhase.AppliesEffects) {
        for (const targetId of this.resolveEffectTargets(sourceActorId, effect.Target, targetActorId)) {
          this.timeline.schedule({
            timeMs,
            type: 'BUFF_APPLY',
            actorId: sourceActorId,
            targetId,
            skillId: skill.SkillID,
            data: {
              effect,
              sourceActorId,
              sourceSkillId: skill.SkillID
            }
          });
        }
      }
    }
  }

  private scheduleSkillHits(actorId: string, skill: Skill, castStartMs: number, actualCastTimeMs?: number): void {
    if (skill.ActionType && skill.ActionType !== 'DAMAGE') return;

    const hitCount = skill.SkillBonusAttributes.MultiHitConfig?.HitCount ?? 1;
    const offsets = getHitOffsetsMs(skill, hitCount, actualCastTimeMs);
    offsets.forEach((offsetMs, index) => {
      this.timeline.schedule({
        timeMs: castStartMs + offsetMs,
        type: 'HIT',
        actorId,
        skillId: skill.SkillID,
        data: {
          hitIndex: index + 1,
          hitCount
        }
      });
    });
  }

  private schedulePhaseTransitions(actorId: string, skill: Skill, castStartMs: number): void {
    const firstPhase = skill.MultiPhaseConfig?.Phases.find(phase => phase.PhaseIndex === 1);
    const secondPhase = skill.MultiPhaseConfig?.Phases.find(phase => phase.PhaseIndex === 2);
    if (!firstPhase?.AutoTransition || !secondPhase) return;

    this.timeline.schedule({
      timeMs: castStartMs + Math.round(firstPhase.Duration * 1000),
      type: 'PHASE_TRANSITION',
      actorId,
      skillId: skill.SkillID,
      data: {
        phaseIndex: secondPhase.PhaseIndex
      }
    });
  }

  private applyCooldownResets(actor: Actor, skill: Skill, timeMs: number): void {
    for (const reset of skill.CooldownResets ?? []) {
      actor.applyCooldownReset(reset, timeMs);
    }
  }

  private applyBuffDurationExtensions(skill: Skill, timeMs: number, targetActorId?: string): void {
    if (skill.BuffDurationExtensionSeconds && skill.BuffDurationExtensionSeconds > 0) {
      const extMs = Math.round(skill.BuffDurationExtensionSeconds * 1000);
      const targetId = targetActorId ?? BOSS_TARGET_ID;
      const targetManager = this.effects.get(targetId);
      if (targetManager) {
        targetManager.extendActiveEffectsDuration(extMs);
      }
    }
  }

  private resolveDynamicEffect(
    effect: AppliedEffectConfig,
    sourceActorId: string,
    sourceSkillId?: string
  ): DynamicEffectResolution {
    const sourceRuntime = this.getRuntimeActor(sourceActorId);
    const skill = sourceSkillId ? sourceRuntime?.actor.getSkill(sourceSkillId) : undefined;

    if (effect.EffectId === 'ZS_BUFF_YZXW_MANA') {
      const quality = skill?.FourthGenQuality || 'OTHER';
      let manaPct = 30;
      if (quality === 'YING_JU') {
        manaPct = 30;
      } else if (quality === 'HAO_YUE') {
        manaPct = 60;
      } else if (quality === 'XI_RI') {
        manaPct = 90;
      }
      return {
        effect: {
          ...effect,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffManaPercentEffect: manaPct
          }
        }
      };
    }

    if (effect.EffectId === 'ZS_BUFF_YZXW_CRIT_DMG') {
      const quality = skill?.FourthGenQuality || 'OTHER';
      let duration = 20;
      if (quality === 'YING_JU') {
        duration = 20 + 10;
      } else if (quality === 'HAO_YUE') {
        duration = 20 + 15;
      } else if (quality === 'XI_RI') {
        duration = 20 + 20;
      }
      return {
        effect: {
          ...effect,
          Duration: duration,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffCriticalDamagePercentEffect: 50
          }
        }
      };
    }

    if (effect.EffectId === 'ZM_BUFF_FGSL') {
      return {
        effect: {
          ...effect,
          BuffEffects: {}
        }
      };
    }

    if (effect.EffectId === 'TY_BUFF_CHFY_FOCUS') {
      const level = skill?.SkillLevel ?? 0;
      const focusPct = level >= 1 ? 20 : 18;
      return {
        effect: {
          ...effect,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffFocusPercentEffect: focusPct
          }
        }
      };
    }

    if (effect.EffectId === 'TH_BUFF_JSKW') {
      const level = skill?.SkillLevel ?? 0;
      const focusPct = level >= 1 ? 20 : 18;
      const critRatePct = level >= 1 ? 25 : 23;
      return {
        effect: {
          ...effect,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffFocusPercentEffect: focusPct,
            BuffCriticalHitRatePercentEffect: critRatePct
          }
        }
      };
    }

    if (
      effect.EffectId === 'TH_BUFF_MQYY' ||
      effect.EffectId === 'TH_BUFF_QSYY' ||
      effect.EffectId === 'TH_BUFF_YSYY2_HEALTH' ||
      effect.EffectId === 'TH_BUFF_YSYY2_MANA' ||
      effect.EffectId === 'TH_BUFF_YSYY2_ATTACK' ||
      effect.EffectId === 'TH_BUFF_FQH'
    ) {
      if (!sourceRuntime?.actor.BaseAttributes) {
        return {
          error: `Dynamic effect ${effect.EffectId} requires base attributes on source actor ${sourceActorId}.`
        };
      }
      const sourceActiveEffects = this.effects.get(sourceActorId)?.getActiveEffects() ?? [];
      const sourceAttributes = sourceRuntime.actor.getCurrentAttributes(sourceActiveEffects);

      if (effect.EffectId === 'TH_BUFF_MQYY') {
        return {
          effect: {
            ...effect,
            BuffEffects: {}
          }
        };
      }

      if (effect.EffectId === 'TH_BUFF_QSYY') {
        const level = skill?.SkillLevel ?? 0;
        const baseFocus = level >= 1 ? 22 : 19;
        const focusPct = baseFocus + Math.min(20, Math.floor(sourceAttributes.CharacterMaxAttack / 5000));
        const duration = (effect.Duration ?? 25) + (level >= 1 ? 1 : 0);
        return {
          effect: {
            ...effect,
            Duration: duration,
            BuffEffects: {
              BuffFocusPercentEffect: focusPct
            }
          }
        };
      }

      if (effect.EffectId === 'TH_BUFF_YSYY2_HEALTH') {
        return {
          effect: {
            ...effect,
            BuffEffects: {}
          }
        };
      }

      if (effect.EffectId === 'TH_BUFF_YSYY2_MANA') {
        return {
          effect: {
            ...effect,
            BuffEffects: {}
          }
        };
      }

      if (effect.EffectId === 'TH_BUFF_YSYY2_ATTACK') {
        return {
          effect: {
            ...effect,
            BuffEffects: {}
          }
        };
      }

      if (effect.EffectId === 'TH_BUFF_FQH') {
        return {
          effect: {
            ...effect,
            BuffEffects: {}
          }
        };
      }
    }

    if (effect.EffectId === 'TEST_TH_BUFF_YSYY2_HEALTH') {
      if (!sourceRuntime?.actor.BaseAttributes) {
        return {
          error: `Dynamic effect ${effect.EffectId} requires base attributes on source actor ${sourceActorId}.`
        };
      }
      const sourceActiveEffects = this.effects.get(sourceActorId)?.getActiveEffects() ?? [];
      const sourceAttributes = sourceRuntime.actor.getCurrentAttributes(sourceActiveEffects);
      const healthAdd = 2.5 * sourceAttributes.CharacterMaxAttack;
      return {
        effect: {
          ...effect,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffHealthFixedEffect: healthAdd
          }
        }
      };
    }

    if (effect.EffectId === 'TEST_TH_BUFF_FQH') {
      if (!sourceRuntime?.actor.BaseAttributes) {
        return {
          error: `Dynamic effect ${effect.EffectId} requires base attributes on source actor ${sourceActorId}.`
        };
      }
      const sourceActiveEffects = this.effects.get(sourceActorId)?.getActiveEffects() ?? [];
      const sourceAttributes = sourceRuntime.actor.getCurrentAttributes(sourceActiveEffects);
      const variant = skill?.Variant || 'OTHER';
      let baseCritDmg = 100;
      let duration = 30;
      if (variant === 'HUA') {
        duration = 40;
        baseCritDmg = 100;
      } else if (variant === 'HAO') {
        duration = 20;
        baseCritDmg = 150;
      } else if (variant === 'LIE') {
        duration = 30;
        baseCritDmg = 130;
      } else {
        duration = 30;
        baseCritDmg = 100;
      }
      const critDmgAdd = baseCritDmg + Math.floor(sourceAttributes.CharacterMana / 30000);
      return {
        effect: {
          ...effect,
          Duration: duration,
          BuffEffects: {
            ...effect.BuffEffects,
            BuffCriticalDamagePercentEffect: critDmgAdd
          }
        }
      };
    }

    const hasDynamicScaling =
      effect.DynamicScalingAttribute !== undefined ||
      effect.DynamicScalingMultiplier !== undefined ||
      effect.DynamicTargetField !== undefined;

    if (!hasDynamicScaling) {
      return { effect };
    }

    if (!isCharacterAttributeKey(effect.DynamicScalingAttribute)) {
      return {
        error: `Invalid DynamicScalingAttribute for effect ${effect.EffectId}: ${String(effect.DynamicScalingAttribute)}.`
      };
    }

    if (typeof effect.DynamicScalingMultiplier !== 'number' || !Number.isFinite(effect.DynamicScalingMultiplier)) {
      return {
        error: `Invalid DynamicScalingMultiplier for effect ${effect.EffectId}: ${String(effect.DynamicScalingMultiplier)}.`
      };
    }

    if (!isBuffEffectKey(effect.DynamicTargetField)) {
      return {
        error: `Invalid DynamicTargetField for effect ${effect.EffectId}: ${String(effect.DynamicTargetField)}.`
      };
    }

    if (!sourceRuntime?.actor.BaseAttributes) {
      return {
        error: `Dynamic effect ${effect.EffectId} requires base attributes on source actor ${sourceActorId}.`
      };
    }

    const sourceActiveEffects = this.effects.get(sourceActorId)?.getActiveEffects() ?? [];
    const sourceAttributes = sourceRuntime.actor.getCurrentAttributes(sourceActiveEffects);
    const sourceValue = sourceAttributes[effect.DynamicScalingAttribute] ?? 0;
    const dynamicValue = sourceValue * effect.DynamicScalingMultiplier;

    return {
      effect: {
        ...effect,
        BuffEffects: {
          ...effect.BuffEffects,
          [effect.DynamicTargetField]: dynamicValue
        }
      }
    };
  }

  private resolveEffectTargets(sourceActorId: string, target: AppliedEffectConfig['Target'], targetActorId?: string): string[] {
    if (target === 'SELF') return [sourceActorId];
    if (target === 'ALLY') return targetActorId ? [targetActorId] : [];
    if (target === 'TEAM') return [...this.actors.keys()];
    return [BOSS_TARGET_ID];
  }

  private shouldAutoDecide(strategy: ActorStrategyConfig | undefined): boolean {
    return strategy?.type === 'FIXED_ROTATION' || strategy?.type === 'SKILL_BAR' || strategy?.type === 'CAST_ON_READY';
  }

  private getRuntimeActor(actorId: string | undefined): RuntimeActor | undefined {
    return actorId ? this.actors.get(actorId) : undefined;
  }

  private getSkill(runtime: RuntimeActor | undefined, skillId: string | undefined): Skill | undefined {
    if (!runtime || !skillId) return undefined;
    return runtime.actor.getSkill(skillId);
  }

  private logEvent(event: SimEvent, status: SimEventLog['status'], message?: string): void {
    this.events.push({
      ...event,
      sequence: event.sequence ?? 0,
      status,
      message
    });
  }

  private buildResult(): SimulationResult {
    const totalDamage = this.hitRecords.reduce((total, record) => total + record.DamageApplied, 0);
    const dpsStartMs = this.hitRecords[0]?.TimeMs;
    const endMs = this.bossKilledAtMs ?? this.hitRecords[this.hitRecords.length - 1]?.TimeMs ?? 0;
    const dpsDurationMs = dpsStartMs === undefined ? 0 : Math.max(0, endMs - dpsStartMs);
    const averageDps = dpsDurationMs > 0 ? totalDamage / (dpsDurationMs / 1000) : 0;

    return {
      scenarioId: this.scenario.scenarioId,
      events: this.events,
      hitRecords: this.hitRecords,
      boss: {
        monsterId: this.boss.MonsterID,
        monsterName: this.boss.MonsterName,
        startingHealth: this.startingBossHealth,
        currentHealth: this.bossHealth,
        killedAtMs: this.bossKilledAtMs
      },
      summary: {
        TotalDamage: totalDamage,
        DpsStartMs: dpsStartMs,
        DpsDurationMs: dpsDurationMs,
        AverageDps: averageDps,
        SkillBreakdown: buildSkillBreakdown(this.hitRecords)
      },
      ...(this.scenario.damageAudit?.enabled ? { damageAuditRecords: this.damageAuditRecords } : {})
    };
  }

  private getActualCastTimeMs(actorId: string, skill: Skill, timeMs: number): number {
    const baseCastTimeMs = Math.round(skill.CastTime * 1000);
    if (skill.RequiredClass !== 'ZHU_SHUANG') {
      return baseCastTimeMs;
    }

    const activeEffects = this.effects.get(actorId)?.getActiveEffects() ?? [];
    let dragonSpeedPercent = 0;
    let swiftSpeedPercent = 0;
    let hasZgddSwift = false;

    for (const effect of activeEffects) {
      const speedPercent = effect.BuffEffects.BuffSpeedPercentEffect ?? 0;
      if (effect.EffectId === 'ZS_BUFF_LZYY_SPEED') {
        dragonSpeedPercent = Math.max(dragonSpeedPercent, speedPercent);
      } else if (effect.EffectId === 'ZS_BUFF_ZGDD_SPEED') {
        hasZgddSwift = true;
      } else if (effect.EffectId === 'ZS_BUFF_QXHS_SPEED') {
        swiftSpeedPercent = Math.max(swiftSpeedPercent, speedPercent);
      }
    }

    if (hasZgddSwift) {
      swiftSpeedPercent = 50;
    }

    const swiftMultiplier = 1 + swiftSpeedPercent / 100;
    const dragonMultiplier = 1 + dragonSpeedPercent / 100;
    return Math.round(baseCastTimeMs / (swiftMultiplier * dragonMultiplier));
  }

  private shouldRecordDamageAudit(actorId: string, skillId: string): boolean {
    const config = this.scenario.damageAudit;
    if (!config?.enabled) return false;
    if (config.maxRecords !== undefined && this.damageAuditRecords.length >= config.maxRecords) return false;
    if (config.actorId && config.actorId !== actorId) return false;
    if (config.skillIds && config.skillIds.length > 0 && !config.skillIds.includes(skillId)) return false;
    return true;
  }

  private nextRandom(): number {
    if (this.randomState === undefined) return Math.random();
    this.randomState = (Math.imul(1664525, this.randomState) + 1013904223) >>> 0;
    return this.randomState / 0x100000000;
  }
}

export const runSimulation = (scenario: SimulationScenario): SimulationResult => {
  const engine = new SimulationEngine(scenario);
  return engine.run();
};

const getHitOffsetsMs = (skill: Skill, hitCount: number, actualCastTimeMs?: number): number[] => {
  const castTimeMs = actualCastTimeMs !== undefined ? actualCastTimeMs : Math.round(skill.CastTime * 1000);
  if (skill.HitTiming?.Mode === 'CUSTOM') {
    return (skill.HitTiming.Offsets ?? []).map(offset => Math.round(offset * 1000));
  }

  if (skill.HitTiming?.Mode === 'ON_CAST_COMPLETE') {
    return Array.from({ length: hitCount }, () => castTimeMs);
  }

  if (hitCount <= 1) return [castTimeMs];
  const interval = castTimeMs / hitCount;
  return Array.from({ length: hitCount }, (_, index) => Math.round(interval * (index + 1)));
};

const getDamageCompressionMultiplier = (monster: Monster): number => {
  const compressionPercent = monster.MonsterAttributeModifiers.DamageCompressionPercent ?? 0;
  return Math.max(0, 1 - compressionPercent / 100);
};

const isXianCangLongXiaoSkill = (skillId: string): boolean => (
  skillId === 'ZS_XIAN_SKILL_CLX'
);

const filterBossDamageBuffs = (buffs: Buff[]): Buff[] => {
  return buffs
    .map(buff => {
      const filteredEffects: BuffEffects = {};
      for (const [key, value] of Object.entries(buff.BuffEffects) as [keyof BuffEffects, number | undefined][]) {
        if (value !== undefined && BOSS_DAMAGE_EFFECT_FIELDS.has(key)) {
          filteredEffects[key] = value;
        }
      }

      return {
        ...buff,
        BuffEffects: filteredEffects
      };
    })
    .filter(buff => Object.keys(buff.BuffEffects).length > 0);
};

const toDamageAuditEffectSnapshot = (
  effect: EffectInstance,
  timeMs: number,
  includedInDamageFormula: boolean
): DamageAuditEffectSnapshot => ({
  InstanceId: effect.InstanceId,
  EffectId: effect.EffectId,
  EffectName: effect.EffectName,
  SourceActorId: effect.SourceActorId,
  SourceSkillId: effect.SourceSkillId,
  TargetId: effect.TargetId,
  RemainingMs: Math.max(0, effect.EndTimeMs - timeMs),
  StackCount: effect.StackCount,
  BuffEffects: { ...effect.BuffEffects },
  IncludedInDamageFormula: includedInDamageFormula
});

const isBossEffectIncludedInDamageFormula = (effect: EffectInstance): boolean => (
  Object.entries(effect.BuffEffects).some(([key, value]) =>
    value !== undefined && BOSS_DAMAGE_EFFECT_FIELDS.has(key as keyof BuffEffects)
  )
);

const isActorEffectIncludedInDamageFormula = (effect: EffectInstance): boolean => (
  Object.entries(effect.BuffEffects).some(([key, value]) =>
    value !== undefined && ACTOR_DAMAGE_EFFECT_FIELDS.has(key as keyof BuffEffects)
  )
);

const buildSkillBreakdown = (records: HitDamageRecord[]): SkillBreakdown[] => {
  const bySkill = new Map<string, SkillBreakdown>();
  for (const record of records) {
    const existing = bySkill.get(record.SkillId);
    if (existing) {
      existing.HitCount += 1;
      existing.TotalDamage += record.DamageApplied;
    } else {
      bySkill.set(record.SkillId, {
        SkillId: record.SkillId,
        SkillName: record.SkillName,
        HitCount: 1,
        TotalDamage: record.DamageApplied
      });
    }
  }
  return [...bySkill.values()];
};

const asNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' ? value : fallback;
};

const asString = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback;
};

import type {
  Skill,
  AppliedEffectConfig,
  PlayerSkillOverride,
  CharacterAttributes,
  CooldownResetEffect
} from './types.js';
import type { EffectInstance } from './effects.js';
import { resolveEffectiveCharacterAttributesFromEffects } from './attributes.js';

export interface SkillRuntimeState {
  cooldownReadyAtMs: number;
  charges: number;
  maxCharges: number;
  chargeReplenishMs: number;
  rechargeToken: number;
}

export interface CooldownReadySchedule {
  timeMs: number;
  rechargeToken?: number;
}

export interface CooldownReadyResult {
  applied: boolean;
  nextReady?: CooldownReadySchedule;
}

export function mergeEffectOverrides(
  skill: Skill,
  overrides: Record<string, Partial<AppliedEffectConfig>>
): void {
  if (!skill.AppliesEffects) return;
  skill.AppliesEffects = skill.AppliesEffects.map(effect => {
    const override = overrides[effect.EffectId];
    if (!override) return effect;
    
    return {
      ...effect,
      ...override,
      BuffEffects: {
        ...effect.BuffEffects,
        ...(override.BuffEffects || {})
      }
    };
  });
}

export class Actor {
  public ActorId: string;
  public ClassId: string;
  public Skills: Record<string, Skill> = {};
  public BaseAttributes?: CharacterAttributes;
  public CastLockUntilMs = 0;
  public GCDLockUntilMs = 0;
  public GcdMs: number;
  public SkillStates: Record<string, SkillRuntimeState> = {};
  public LastCastStartMs: Record<string, number> = {};

  constructor(
    actorId: string,
    classId: string,
    baseSkills: Skill[],
    customizations: Record<string, PlayerSkillOverride> = {},
    baseAttributes?: CharacterAttributes,
    gcdMs = 500
  ) {
    this.ActorId = actorId;
    this.ClassId = classId;
    this.BaseAttributes = baseAttributes;
    this.GcdMs = gcdMs;

    const applySingleOverride = (skillInstance: Skill, ovr: Partial<PlayerSkillOverride>) => {
      const { AppliesEffects, SkillBonusAttributes: bonusAttrs, ...topLevelOverride } = ovr;
      
      // 覆盖顶层字段（如 Cooldown, CastTime, MaxCharges, ChargeReplenishTime, HitTiming, MultiPhaseConfig, FourthGenQuality）
      Object.assign(skillInstance, topLevelOverride);
      
      // 覆盖 SkillBonusAttributes
      if (bonusAttrs) {
        skillInstance.SkillBonusAttributes = {
          ...skillInstance.SkillBonusAttributes,
          ...bonusAttrs
        };
      }
      
      // 覆盖 AppliesEffects
      if (AppliesEffects) {
        mergeEffectOverrides(skillInstance, AppliesEffects);
      }
    };

    baseSkills.forEach(skill => {
      // 1. 深拷贝白板技能数据，避免污染全局 JSON 缓存
      const runSkill = JSON.parse(JSON.stringify(skill)) as Skill;
      
      // 2. 检索该玩家 Profile 下的个性化覆盖数据
      const override = customizations[skill.SkillID];
      
      // A. 首先，如果玩家在 profile 中指定了四代品质，并且白板技能定义了该品质预设，先融合预设
      if (override?.FourthGenQuality && runSkill.FourthGenPresets?.[override.FourthGenQuality]) {
        const preset = runSkill.FourthGenPresets[override.FourthGenQuality];
        if (preset) {
          applySingleOverride(runSkill, preset);
        }
      }

      // B. 其次，应用常规的自定义覆盖（这会覆盖预设值，从而实现最高自由度）
      if (override) {
        applySingleOverride(runSkill, override);
      }
      
      this.Skills[skill.SkillID] = runSkill;
      this.SkillStates[skill.SkillID] = {
        cooldownReadyAtMs: 0,
        charges: runSkill.MaxCharges ?? 1,
        maxCharges: runSkill.MaxCharges ?? 1,
        chargeReplenishMs: Math.round((runSkill.ChargeReplenishTime ?? runSkill.Cooldown) * 1000),
        rechargeToken: 0
      };
    });
  }

  public getSkill(skillId: string): Skill | undefined {
    return this.Skills[skillId];
  }

  public isActionLocked(timeMs: number): boolean {
    return timeMs < this.CastLockUntilMs || timeMs < this.GCDLockUntilMs;
  }

  public isSkillUsable(skillId: string, timeMs: number): boolean {
    const skill = this.Skills[skillId];
    const state = this.SkillStates[skillId];
    if (!skill || !state) return false;

    if (state.maxCharges > 1) {
      return state.charges > 0;
    }

    return timeMs >= state.cooldownReadyAtMs;
  }

  public getNextUsableTimeMs(skillId: string, timeMs: number): number {
    const state = this.SkillStates[skillId];
    if (!state) return Number.POSITIVE_INFINITY;

    if (state.maxCharges > 1) {
      return state.charges > 0 ? timeMs : state.cooldownReadyAtMs;
    }

    return Math.max(timeMs, state.cooldownReadyAtMs);
  }

  public getNextActionTimeMs(timeMs: number): number {
    return Math.max(timeMs, this.CastLockUntilMs, this.GCDLockUntilMs);
  }

  public beginCast(skillId: string, timeMs: number, actualCastTimeMs?: number, skipChargeConsumption?: boolean): CooldownReadySchedule[] {
    const skill = this.Skills[skillId];
    const state = this.SkillStates[skillId];
    if (!skill || !state) {
      throw new Error(`Unknown skill "${skillId}" for actor "${this.ActorId}".`);
    }

    const castTimeMs = actualCastTimeMs !== undefined ? actualCastTimeMs : Math.round(skill.CastTime * 1000);
    this.LastCastStartMs[skillId] = timeMs;
    this.CastLockUntilMs = Math.max(this.CastLockUntilMs, timeMs + castTimeMs);
    this.GCDLockUntilMs = Math.max(this.GCDLockUntilMs, timeMs + this.GcdMs);

    if (state.maxCharges > 1) {
      const wasFull = state.charges === state.maxCharges;
      if (!skipChargeConsumption) {
        state.charges = Math.max(0, state.charges - 1);
      }
      if (skipChargeConsumption) {
        return [];
      }
      if (wasFull && state.charges < state.maxCharges) {
        return [this.startChargeRecharge(state, timeMs)];
      }
      return [];
    }

    if (skill.SkillID === 'ZM_FO_SKILL_RYHG') {
      state.cooldownReadyAtMs = Number.POSITIVE_INFINITY;
      return [];
    }

    if (skill.Cooldown === 0 && (skill.ActionType === 'BUFF' || skill.ActionType === 'DEBUFF' || skill.ActionType === 'UTILITY')) {
      state.cooldownReadyAtMs = Number.POSITIVE_INFINITY;
      return [];
    }

    const phaseCooldownDelayMs = getPhaseCooldownDelayMs(skill);
    const readyAt = timeMs + phaseCooldownDelayMs + Math.round(skill.Cooldown * 1000);
    state.cooldownReadyAtMs = readyAt;
    return [{ timeMs: readyAt }];
  }

  public completeCast(timeMs: number): void {
    this.CastLockUntilMs = Math.max(this.CastLockUntilMs, timeMs);
  }

  public applyCooldownReady(skillId: string, timeMs: number, rechargeToken?: number): CooldownReadyResult {
    const state = this.SkillStates[skillId];
    if (!state) return { applied: false };

    if (state.maxCharges > 1) {
      const isNaturalRecharge = rechargeToken !== undefined;
      if (isNaturalRecharge && rechargeToken !== state.rechargeToken) {
        return { applied: false };
      }
      if (state.charges >= state.maxCharges) {
        return { applied: false };
      }
      state.charges = Math.min(state.maxCharges, state.charges + 1);
      if (state.charges >= state.maxCharges) {
        state.cooldownReadyAtMs = timeMs;
        state.rechargeToken += 1;
        return { applied: true };
      }
      if (isNaturalRecharge) {
        return { applied: true, nextReady: this.startChargeRecharge(state, timeMs) };
      }
      return { applied: true };
    }

    state.cooldownReadyAtMs = Math.min(state.cooldownReadyAtMs, timeMs);
    return { applied: true };
  }

  public applyCooldownReset(reset: CooldownResetEffect, timeMs: number): void {
    const state = this.SkillStates[reset.TargetSkillId];
    if (!state) return;

    if (reset.ResetType === 'REFRESH_CHARGES') {
      state.charges = Math.min(state.maxCharges, reset.Charges ?? state.maxCharges);
      state.cooldownReadyAtMs = timeMs;
      state.rechargeToken += 1;
      return;
    }

    if (reset.ReductionSeconds !== undefined) {
      state.cooldownReadyAtMs = Math.max(timeMs, state.cooldownReadyAtMs - Math.round(reset.ReductionSeconds * 1000));
    }
  }

  public getCurrentAttributes(activeEffects: EffectInstance[] = []): CharacterAttributes {
    if (!this.BaseAttributes) {
      throw new Error(`Actor "${this.ActorId}" does not have base attributes.`);
    }

    return resolveEffectiveCharacterAttributesFromEffects(this.BaseAttributes, activeEffects);
  }

  private startChargeRecharge(state: SkillRuntimeState, timeMs: number): CooldownReadySchedule {
    state.rechargeToken += 1;
    const readyAt = timeMs + state.chargeReplenishMs;
    state.cooldownReadyAtMs = readyAt;
    return {
      timeMs: readyAt,
      rechargeToken: state.rechargeToken
    };
  }
}

const getPhaseCooldownDelayMs = (skill: Skill): number => {
  const phases = skill.MultiPhaseConfig?.Phases ?? [];
  if (phases.length === 0) return 0;
  return phases.reduce((total, phase) => total + Math.round((phase.Duration ?? 0) * 1000), 0);
};

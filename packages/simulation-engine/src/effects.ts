import type { AppliedEffectConfig, Buff, BuffEffects } from './types.js';

export interface EffectInstance {
  InstanceId: string;
  EffectId: string;
  EffectName: string;
  SourceActorId: string;
  SourceSkillId: string;
  TargetId: string;
  Target: AppliedEffectConfig['Target'];
  ExclusiveGroup?: string;
  ExclusivePolicy?: AppliedEffectConfig['ExclusivePolicy'];
  Priority?: number;
  EffectPower?: number;
  AppliedAtMs: number;
  EndTimeMs: number;
  StackCount: number;
  BuffEffects: BuffEffects;
}

export interface ApplyEffectResult {
  applied?: EffectInstance;
  replaced: EffectInstance[];
  ignored: boolean;
  reason?: string;
}

let nextEffectInstanceId = 1;

const createInstanceId = (): string => {
  const id = `effect-${nextEffectInstanceId}`;
  nextEffectInstanceId += 1;
  return id;
};

export class EffectManager {
  private activeEffects: EffectInstance[] = [];

  public constructor(private readonly targetId: string) {}

  public applyEffect(
    effect: AppliedEffectConfig,
    currentTimeMs: number,
    sourceActorId: string,
    sourceSkillId: string
  ): ApplyEffectResult {
    if (effect.Stackable) {
      return this.applyStackableEffect(effect, currentTimeMs, sourceActorId, sourceSkillId);
    }

    const sameSkillEffectIndex = this.activeEffects.findIndex(active =>
      active.EffectId === effect.EffectId &&
      active.SourceSkillId === sourceSkillId
    );

    if (sameSkillEffectIndex !== -1) {
      const existing = this.activeEffects[sameSkillEffectIndex]!;
      if (!this.shouldReplaceSameSkillEffect(existing, effect, currentTimeMs)) {
        return {
          replaced: [],
          ignored: true,
          reason: `Effect ${effect.EffectId} from skill ${sourceSkillId} did not replace active same-skill effect.`
        };
      }

      const replaced = this.activeEffects.splice(sameSkillEffectIndex, 1);
      const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
      return { applied, replaced, ignored: false };
    }

    if (!effect.ExclusiveGroup) {
      const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
      return { applied, replaced: [], ignored: false };
    }

    const existingIndex = this.activeEffects.findIndex(active => active.ExclusiveGroup === effect.ExclusiveGroup);
    if (existingIndex === -1) {
      const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
      return { applied, replaced: [], ignored: false };
    }

    const existing = this.activeEffects[existingIndex];
    if (!this.shouldReplace(existing, effect)) {
      return {
        replaced: [],
        ignored: true,
        reason: `Effect ${effect.EffectId} did not replace active exclusive effect ${existing.EffectId}.`
      };
    }

    const replaced = this.activeEffects.splice(existingIndex, 1);
    const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
    return { applied, replaced, ignored: false };
  }

  public expireEffect(instanceId: string): boolean {
    const before = this.activeEffects.length;
    this.activeEffects = this.activeEffects.filter(effect => effect.InstanceId !== instanceId);
    return this.activeEffects.length !== before;
  }

  public getEffectInstance(instanceId: string): EffectInstance | undefined {
    return this.activeEffects.find(effect => effect.InstanceId === instanceId);
  }

  public extendActiveEffectsDuration(extensionMs: number): void {
    for (const effect of this.activeEffects) {
      effect.EndTimeMs += extensionMs;
    }
  }

  public getActiveEffects(): EffectInstance[] {
    return [...this.activeEffects];
  }

  public getActiveEffectIds(): string[] {
    return this.activeEffects.map(effect => effect.InstanceId);
  }

  public toBuffs(): Buff[] {
    return this.activeEffects.map(effect => ({
      BuffID: effect.InstanceId,
      BuffName: effect.EffectName,
      IsDefaultActive: true,
      BuffEffects: multiplyBuffEffects(effect.BuffEffects, effect.StackCount),
      EffectId: effect.EffectId
    }));
  }

  private applyStackableEffect(
    effect: AppliedEffectConfig,
    currentTimeMs: number,
    sourceActorId: string,
    sourceSkillId: string
  ): ApplyEffectResult {
    const sameEffectIndexes = this.activeEffects
      .map((active, index) => ({ active, index }))
      .filter(item => item.active.EffectId === effect.EffectId);
    const maxStacks = effect.MaxStacks ?? Number.POSITIVE_INFINITY;

    if (sameEffectIndexes.length >= maxStacks) {
      const oldest = sameEffectIndexes.reduce((prev, curr) =>
        curr.active.AppliedAtMs < prev.active.AppliedAtMs ? curr : prev
      );
      const replaced = this.activeEffects.splice(oldest.index, 1);
      const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
      return { applied, replaced, ignored: false };
    }

    const applied = this.addRawEffect(effect, currentTimeMs, sourceActorId, sourceSkillId, 1);
    return { applied, replaced: [], ignored: false };
  }

  private shouldReplace(existing: EffectInstance, incoming: AppliedEffectConfig): boolean {
    if (incoming.ExclusiveGroup === 'HP_OVERRIDE_GROUP' && existing.ExclusiveGroup === 'HP_OVERRIDE_GROUP') {
      const incomingHp = incoming.BuffEffects.BuffHealthFixedEffect ?? 0;
      const existingHp = existing.BuffEffects.BuffHealthFixedEffect ?? 0;
      const incomingDuration = (incoming.Duration ?? 0) * 1000;
      const existingDuration = existing.EndTimeMs - existing.AppliedAtMs;
      return incomingHp > existingHp && incomingDuration > existingDuration;
    }

    const policy = incoming.ExclusivePolicy || existing.ExclusivePolicy || 'MANUAL_PRIORITY';
    if (policy === 'NO_OVERWRITE') return false;

    if (policy === 'HIGHEST_EFFECT_VALUE') {
      return (incoming.EffectPower ?? 0) > (existing.EffectPower ?? 0);
    }

    return (incoming.Priority ?? 0) >= (existing.Priority ?? 0);
  }

  private shouldReplaceSameSkillEffect(
    existing: EffectInstance,
    incoming: AppliedEffectConfig,
    currentTimeMs: number
  ): boolean {
    const incomingDurationMs = Math.round(incoming.Duration * 1000);
    const existingRemainingMs = Math.max(0, existing.EndTimeMs - currentTimeMs);
    return (
      incomingDurationMs >= existingRemainingMs &&
      isIncomingAtLeastAsStrong(existing, incoming)
    );
  }

  private addRawEffect(
    effect: AppliedEffectConfig,
    currentTimeMs: number,
    sourceActorId: string,
    sourceSkillId: string,
    stackCount: number
  ): EffectInstance {
    const activeEffect: EffectInstance = {
      InstanceId: createInstanceId(),
      EffectId: effect.EffectId,
      EffectName: effect.EffectName,
      SourceActorId: sourceActorId,
      SourceSkillId: sourceSkillId,
      TargetId: this.targetId,
      Target: effect.Target,
      ExclusiveGroup: effect.ExclusiveGroup,
      ExclusivePolicy: effect.ExclusivePolicy,
      Priority: effect.Priority,
      EffectPower: effect.EffectPower,
      AppliedAtMs: currentTimeMs,
      EndTimeMs: currentTimeMs + Math.round(effect.Duration * 1000),
      StackCount: stackCount,
      BuffEffects: { ...effect.BuffEffects }
    };

    this.activeEffects.push(activeEffect);
    return activeEffect;
  }
}

const multiplyBuffEffects = (effects: BuffEffects, multiplier: number): BuffEffects => {
  const multiplied: BuffEffects = {};
  for (const [key, value] of Object.entries(effects) as [keyof BuffEffects, number | undefined][]) {
    if (value !== undefined) {
      multiplied[key] = value * multiplier;
    }
  }
  return multiplied;
};

const isIncomingAtLeastAsStrong = (existing: EffectInstance, incoming: AppliedEffectConfig): boolean => {
  if (typeof existing.EffectPower === 'number' && typeof incoming.EffectPower === 'number') {
    return incoming.EffectPower >= existing.EffectPower;
  }

  const fields = new Set<keyof BuffEffects>([
    ...(Object.keys(existing.BuffEffects) as (keyof BuffEffects)[]),
    ...(Object.keys(incoming.BuffEffects) as (keyof BuffEffects)[])
  ]);

  for (const field of fields) {
    const existingValue = existing.BuffEffects[field] ?? 0;
    const incomingValue = incoming.BuffEffects[field] ?? 0;
    if (existingValue === 0 && incomingValue === 0) continue;

    if (existingValue < 0 || incomingValue < 0) {
      if (incomingValue > existingValue) return false;
    } else if (incomingValue < existingValue) {
      return false;
    }
  }

  return true;
};

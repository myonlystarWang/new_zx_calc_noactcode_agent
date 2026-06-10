import { Actor } from './actor.js';
import type { ActorStrategyConfig, DpsStrategyConfig, SkillAction, SupportStrategyConfig } from './types.js';

export interface StrategyDecision {
  skillId?: string;
  targetActorId?: string;
  waitUntilMs?: number;
  reason?: string;
}

interface StrategyPointer {
  fixedRotationIndex: number;
  skillBarIndex: number;
}

export class StrategyController {
  private pointers = new Map<string, StrategyPointer>();

  public selectNextAction(actor: Actor, strategy: ActorStrategyConfig | undefined, timeMs: number): StrategyDecision {
    if (!strategy) {
      return { waitUntilMs: timeMs + 50, reason: 'Actor has no strategy.' };
    }

    if (strategy.type === 'MANUAL_TIMELINE' || strategy.type === 'SETUP_PHASE' || strategy.type === 'TIMESTAMPED_ACTIONS') {
      return { reason: `${strategy.type} is scheduled by absolute timestamp.` };
    }

    if (strategy.type === 'FIXED_ROTATION') {
      return this.selectFromFixedRotation(actor, strategy, timeMs);
    }

    if (strategy.type === 'SKILL_BAR') {
      return this.selectFromSkillBar(actor, strategy, timeMs);
    }

    return this.selectFromCastOnReady(actor, strategy, timeMs);
  }

  public getTimestampedActions(strategy: ActorStrategyConfig | undefined): SkillAction[] {
    if (!strategy) return [];
    if (strategy.type === 'MANUAL_TIMELINE' || strategy.type === 'SETUP_PHASE' || strategy.type === 'TIMESTAMPED_ACTIONS') {
      return strategy.actions;
    }
    return [];
  }

  private selectFromFixedRotation(actor: Actor, strategy: Extract<DpsStrategyConfig, { type: 'FIXED_ROTATION' }>, timeMs: number): StrategyDecision {
    if (strategy.skillIds.length === 0) {
      return { waitUntilMs: timeMs + (strategy.waitMs ?? 50), reason: 'Fixed rotation has no skills.' };
    }

    const pointer = this.getPointer(actor.ActorId);
    let bestWait = Number.POSITIVE_INFINITY;

    for (let offset = 0; offset < strategy.skillIds.length; offset += 1) {
      const index = (pointer.fixedRotationIndex + offset) % strategy.skillIds.length;
      const skillId = strategy.skillIds[index];
      if (this.isWithinSkillExpiry(actor, skillId, strategy.skillExpiryMs, timeMs)) {
        bestWait = Math.min(bestWait, this.getSkillExpiryReadyMs(actor, skillId, strategy.skillExpiryMs));
        continue;
      }
      if (actor.isSkillUsable(skillId, timeMs)) {
        pointer.fixedRotationIndex = (index + 1) % strategy.skillIds.length;
        return { skillId };
      }
      bestWait = Math.min(bestWait, actor.getNextUsableTimeMs(skillId, timeMs));
    }

    return {
      waitUntilMs: normalizeWait(timeMs, bestWait, strategy.waitMs),
      reason: 'No fixed rotation skill is currently usable.'
    };
  }

  private selectFromSkillBar(actor: Actor, strategy: Extract<DpsStrategyConfig, { type: 'SKILL_BAR' }>, timeMs: number): StrategyDecision {
    if (strategy.skillIds.length === 0) {
      return { waitUntilMs: timeMs + (strategy.waitMs ?? 50), reason: 'Skill bar has no skills.' };
    }

    const pointer = this.getPointer(actor.ActorId);
    const fromFirst = strategy.scanMode !== 'CONTINUE_POINTER';
    const startIndex = fromFirst ? 0 : pointer.skillBarIndex;
    let bestWait = Number.POSITIVE_INFINITY;

    for (let offset = 0; offset < strategy.skillIds.length; offset += 1) {
      const index = (startIndex + offset) % strategy.skillIds.length;
      const skillId = strategy.skillIds[index];
      if (this.isWithinSkillExpiry(actor, skillId, strategy.skillExpiryMs, timeMs)) {
        bestWait = Math.min(bestWait, this.getSkillExpiryReadyMs(actor, skillId, strategy.skillExpiryMs));
        continue;
      }
      if (actor.isSkillUsable(skillId, timeMs)) {
        pointer.skillBarIndex = (index + 1) % strategy.skillIds.length;
        return { skillId };
      }
      bestWait = Math.min(bestWait, actor.getNextUsableTimeMs(skillId, timeMs));
    }

    return {
      waitUntilMs: normalizeWait(timeMs, bestWait, strategy.waitMs),
      reason: 'No skill bar skill is currently usable.'
    };
  }

  private selectFromCastOnReady(actor: Actor, strategy: Extract<SupportStrategyConfig, { type: 'CAST_ON_READY' }>, timeMs: number): StrategyDecision {
    if (strategy.skillIds.length === 0) {
      return { waitUntilMs: timeMs + (strategy.waitMs ?? 50), reason: 'CAST_ON_READY has no skills.' };
    }

    let bestWait = Number.POSITIVE_INFINITY;
    for (const skillId of strategy.skillIds) {
      if (actor.isSkillUsable(skillId, timeMs)) {
        return { skillId, targetActorId: strategy.targetActorId };
      }
      bestWait = Math.min(bestWait, actor.getNextUsableTimeMs(skillId, timeMs));
    }

    return {
      waitUntilMs: normalizeWait(timeMs, bestWait, strategy.waitMs),
      reason: 'No support skill is currently usable.'
    };
  }

  private getPointer(actorId: string): StrategyPointer {
    const existing = this.pointers.get(actorId);
    if (existing) return existing;

    const created = {
      fixedRotationIndex: 0,
      skillBarIndex: 0
    };
    this.pointers.set(actorId, created);
    return created;
  }

  private isWithinSkillExpiry(
    actor: Actor,
    skillId: string,
    skillExpiryMs: Record<string, number> | undefined,
    timeMs: number
  ): boolean {
    const expiryMs = skillExpiryMs?.[skillId] ?? 0;
    if (expiryMs <= 0) return false;
    const lastCastStartMs = actor.LastCastStartMs[skillId];
    return lastCastStartMs !== undefined && timeMs < lastCastStartMs + expiryMs;
  }

  private getSkillExpiryReadyMs(
    actor: Actor,
    skillId: string,
    skillExpiryMs: Record<string, number> | undefined
  ): number {
    const expiryMs = skillExpiryMs?.[skillId] ?? 0;
    const lastCastStartMs = actor.LastCastStartMs[skillId];
    return lastCastStartMs === undefined ? Number.POSITIVE_INFINITY : lastCastStartMs + expiryMs;
  }
}

const normalizeWait = (timeMs: number, bestWait: number, configuredWait?: number): number => {
  if (Number.isFinite(bestWait) && bestWait > timeMs) return bestWait;
  return timeMs + (configuredWait ?? 50);
};

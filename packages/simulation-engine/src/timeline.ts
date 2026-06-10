import type { SimEvent, SimEventType } from './types.js';

const EVENT_PRIORITY: Record<SimEventType, number> = {
  BOSS_DEAD: 0,
  BUFF_EXPIRE: 10,
  BUFF_APPLY: 20,
  BUFF_EXTEND: 25,
  CAST_START: 30,
  HIT: 40,
  CAST_COMPLETE: 50,
  COOLDOWN_READY: 60,
  PHASE_TRANSITION: 70,
  ACTOR_DECISION: 80
};

export class Timeline {
  private queue: SimEvent[] = [];
  private nextSequence = 1;

  public schedule(event: Omit<SimEvent, 'sequence'>): SimEvent {
    if (!Number.isInteger(event.timeMs) || event.timeMs < 0) {
      throw new Error(`Timeline event timeMs must be a non-negative integer. Received: ${event.timeMs}`);
    }

    const scheduled: SimEvent = {
      ...event,
      sequence: this.nextSequence
    };
    this.nextSequence += 1;

    const insertIndex = this.findInsertIndex(scheduled);
    this.queue.splice(insertIndex, 0, scheduled);
    return scheduled;
  }

  public next(): SimEvent | undefined {
    return this.queue.shift();
  }

  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  private findInsertIndex(event: SimEvent): number {
    let low = 0;
    let high = this.queue.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.compare(this.queue[mid], event) <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  private compare(a: SimEvent, b: SimEvent): number {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;

    const priorityDiff = EVENT_PRIORITY[a.type] - EVENT_PRIORITY[b.type];
    if (priorityDiff !== 0) return priorityDiff;

    return (a.sequence ?? 0) - (b.sequence ?? 0);
  }
}

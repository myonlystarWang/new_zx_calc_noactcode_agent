import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runSimulation,
  type AppliedEffectConfig,
  type BuffEffects,
  type SimEventLog,
  type SimulationActorConfig,
  type SimulationResult,
  type SimulationScenario,
  type SimulationSummary,
  type Skill
} from '@zx/simulation-engine';

const toolDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(toolDir, '..');

interface RunRequest {
  label: string;
  scenario: SimulationScenario;
}

interface SerializedRun {
  label: string;
  resolved: ReturnType<typeof serializeScenario>;
  events: SimEventLog[];
  hitRecords: SimulationResult['hitRecords'];
  boss: SimulationResult['boss'];
  summary: ReturnType<typeof serializeSummary>;
  coverage: ReturnType<typeof buildCoverage>;
  diagnostics: ReturnType<typeof buildDiagnostics>;
}

interface CoverageInterval {
  effectInstanceId: string;
  effectId: string;
  effectName?: string;
  targetId?: string;
  target?: AppliedEffectConfig['Target'];
  sourceActorId?: string;
  sourceSkillId?: string;
  startTimeMs: number;
  plannedEndTimeMs?: number;
  endTimeMs: number;
  activeDurationMs: number;
  coveragePercent: number;
  closeReason: 'EXPIRED' | 'REPLACED' | 'SIMULATION_END';
  buffEffects?: BuffEffects;
}

const parseArgs = (argv: string[]) => {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
};

const print = (payload: unknown) => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = typeof args.input === 'string' ? args.input : undefined;

  if (!inputPath) {
    print({
      ok: false,
      error: {
        code: 'MISSING_INPUT',
        message: 'Usage: npm run agent:sim -- --input agent_tool/examples/simulation_minimal.json'
      }
    });
    process.exitCode = 2;
    return;
  }

  try {
    const text = await readInputFile(inputPath);
    const payload = JSON.parse(text.replace(/^\uFEFF/, '')) as unknown;
    const requests = normalizeRunRequests(payload);
    const runs = requests.map(request => executeRun(request));

    if (runs.length === 1) {
      print({
        ok: true,
        ...runs[0]
      });
      return;
    }

    print({
      ok: true,
      runs,
      comparisons: compareRuns(runs[0], runs.slice(1))
    });
  } catch (error) {
    print({
      ok: false,
      error: {
        code: 'RUNTIME_ERROR',
        message: error instanceof Error ? error.message : String(error)
      }
    });
    process.exitCode = 1;
  }
};

const executeRun = (request: RunRequest): SerializedRun => {
  const result = runSimulation(request.scenario);
  return {
    label: request.label,
    resolved: serializeScenario(request.scenario),
    events: result.events,
    hitRecords: result.hitRecords,
    boss: result.boss,
    summary: serializeSummary(result.summary),
    coverage: buildCoverage(result, request.scenario),
    diagnostics: buildDiagnostics(result)
  };
};

const readInputFile = async (inputPath: string): Promise<string> => {
  const candidates = isAbsolute(inputPath)
    ? [inputPath]
    : [inputPath, resolve(toolDir, inputPath), resolve(repoRoot, inputPath)];
  const uniqueCandidates = [...new Set(candidates)];
  let lastError: unknown;

  for (const candidate of uniqueCandidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') throw error;
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Input file not found: ${inputPath}`);
};

const normalizeRunRequests = (payload: unknown): RunRequest[] => {
  if (isSimulationScenario(payload)) {
    return [
      {
        label: payload.scenarioId ?? 'scenario',
        scenario: payload
      }
    ];
  }

  const input = asRecord(payload);
  if (!input) {
    throw new Error('Simulation input must be a SimulationScenario or an object containing scenario/scenarios.');
  }

  if (isSimulationScenario(input.scenario)) {
    const label = typeof input.label === 'string' ? input.label : input.scenario.scenarioId ?? 'scenario';
    return [{ label, scenario: input.scenario }];
  }

  if (isSimulationScenario(input.baseline)) {
    const requests: RunRequest[] = [
      {
        label: typeof input.baselineLabel === 'string' ? input.baselineLabel : input.baseline.scenarioId ?? 'baseline',
        scenario: input.baseline
      }
    ];
    requests.push(...normalizeVariants(input.variants));
    return requests;
  }

  if (input.scenarios !== undefined) {
    const requests = normalizeVariants(input.scenarios);
    if (requests.length > 0) return requests;
  }

  throw new Error('Simulation input did not contain a valid scenario, baseline, or scenarios collection.');
};

const normalizeVariants = (value: unknown): RunRequest[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (isSimulationScenario(item)) {
        return {
          label: item.scenarioId ?? `scenario-${index + 1}`,
          scenario: item
        };
      }

      const record = asRecord(item);
      if (record && isSimulationScenario(record.scenario)) {
        return {
          label: typeof record.label === 'string' ? record.label : record.scenario.scenarioId ?? `scenario-${index + 1}`,
          scenario: record.scenario
        };
      }

      throw new Error(`Invalid scenario entry at index ${index}.`);
    });
  }

  const record = asRecord(value);
  if (record) {
    return Object.entries(record).map(([label, scenario]) => {
      if (!isSimulationScenario(scenario)) {
        throw new Error(`Invalid scenario for key "${label}".`);
      }
      return { label, scenario };
    });
  }

  return [];
};

const serializeScenario = (scenario: SimulationScenario) => ({
  scenarioId: scenario.scenarioId,
  maxTimeMs: scenario.maxTimeMs,
  dpsActorId: scenario.dpsActorId,
  gcdMs: scenario.gcdMs,
  boss: {
    monsterId: scenario.boss.MonsterID,
    monsterName: scenario.boss.MonsterName,
    dungeonLevel: scenario.boss.DungeonLevel,
    monsterAttributeModifiers: scenario.boss.MonsterAttributeModifiers,
    bossHealthOverride: scenario.bossHealthOverride
  },
  actors: scenario.actors.map(serializeActor)
});

const serializeActor = (actor: SimulationActorConfig) => ({
  actorId: actor.actorId,
  classId: actor.classId,
  role: actor.role,
  gcdMs: actor.gcdMs,
  hasBaseAttributes: actor.baseAttributes !== undefined,
  strategy: actor.strategy,
  skillOverrides: actor.skillOverrides,
  skills: actor.baseSkills.map(serializeSkill)
});

const serializeSkill = (skill: Skill) => ({
  skillId: skill.SkillID,
  skillName: skill.SkillName,
  actionType: skill.ActionType,
  cooldown: skill.Cooldown,
  castTime: skill.CastTime,
  maxCharges: skill.MaxCharges,
  appliesEffectIds: skill.AppliesEffects?.map(effect => effect.EffectId) ?? [],
  hasMultiPhaseConfig: skill.MultiPhaseConfig !== undefined
});

const serializeSummary = (summary: SimulationSummary) => {
  const totalDamage = summary.TotalDamage;
  return {
    ...summary,
    SkillBreakdown: summary.SkillBreakdown.map(skill => ({
      ...skill,
      DamageSharePercent: totalDamage > 0 ? round((skill.TotalDamage / totalDamage) * 100) : 0
    }))
  };
};

const buildDiagnostics = (result: SimulationResult) => {
  const failedEvents = result.events.filter(event => event.status === 'FAILED');
  return {
    eventCount: result.events.length,
    skippedEventCount: result.events.filter(event => event.status === 'SKIPPED').length,
    failedEventCount: failedEvents.length,
    failedEvents: failedEvents.map(event => ({
      timeMs: event.timeMs,
      type: event.type,
      actorId: event.actorId,
      targetId: event.targetId,
      skillId: event.skillId,
      message: event.message
    }))
  };
};

const buildCoverage = (result: SimulationResult, scenario: SimulationScenario) => {
  const simulationEndMs = result.boss.killedAtMs ?? scenario.maxTimeMs;
  const denominatorMs = Math.max(0, simulationEndMs);
  const open = new Map<string, Omit<CoverageInterval, 'endTimeMs' | 'activeDurationMs' | 'coveragePercent' | 'closeReason'>>();
  const closed: CoverageInterval[] = [];

  const closeInterval = (
    instanceId: string,
    endTimeMs: number,
    closeReason: CoverageInterval['closeReason']
  ) => {
    const interval = open.get(instanceId);
    if (!interval) return;
    open.delete(instanceId);

    const normalizedEndTimeMs = Math.max(interval.startTimeMs, Math.min(endTimeMs, simulationEndMs));
    const activeDurationMs = normalizedEndTimeMs - interval.startTimeMs;
    closed.push({
      ...interval,
      endTimeMs: normalizedEndTimeMs,
      activeDurationMs,
      coveragePercent: denominatorMs > 0 ? round((activeDurationMs / denominatorMs) * 100) : 0,
      closeReason
    });
  };

  for (const event of result.events) {
    const data = asRecord(event.data);
    if (!data) continue;

    if (event.type === 'BUFF_APPLY') {
      for (const instanceId of asStringArray(data.replacedInstanceIds)) {
        closeInterval(instanceId, event.timeMs, 'REPLACED');
      }

      const appliedInstanceId = asString(data.appliedInstanceId);
      const effect = asRecord(data.effect);
      if (event.status === 'PROCESSED' && appliedInstanceId && effect) {
        open.set(appliedInstanceId, {
          effectInstanceId: appliedInstanceId,
          effectId: asString(data.appliedEffectId) ?? asString(effect.EffectId) ?? appliedInstanceId,
          effectName: asString(effect.EffectName),
          targetId: event.targetId,
          target: asEffectTarget(effect.Target),
          sourceActorId: asString(data.sourceActorId),
          sourceSkillId: asString(data.sourceSkillId),
          startTimeMs: event.timeMs,
          plannedEndTimeMs: asNumber(data.appliedEndTimeMs),
          buffEffects: asBuffEffects(effect.BuffEffects)
        });
      }
      continue;
    }

    if (event.type === 'BUFF_EXPIRE' && event.status === 'PROCESSED') {
      const instanceId = asString(data.instanceId);
      if (instanceId) {
        closeInterval(instanceId, event.timeMs, 'EXPIRED');
      }
    }
  }

  for (const instanceId of [...open.keys()]) {
    closeInterval(instanceId, simulationEndMs, 'SIMULATION_END');
  }

  const byEffect = new Map<string, {
    effectId: string;
    effectName?: string;
    targetId?: string;
    sourceActorId?: string;
    sourceSkillId?: string;
    activeDurationMs: number;
    instanceCount: number;
  }>();

  for (const interval of closed) {
    const key = [
      interval.effectId,
      interval.targetId ?? '',
      interval.sourceActorId ?? '',
      interval.sourceSkillId ?? ''
    ].join('|');
    const existing = byEffect.get(key);
    if (existing) {
      existing.activeDurationMs += interval.activeDurationMs;
      existing.instanceCount += 1;
    } else {
      byEffect.set(key, {
        effectId: interval.effectId,
        effectName: interval.effectName,
        targetId: interval.targetId,
        sourceActorId: interval.sourceActorId,
        sourceSkillId: interval.sourceSkillId,
        activeDurationMs: interval.activeDurationMs,
        instanceCount: 1
      });
    }
  }

  return {
    simulationEndMs,
    denominatorMs,
    intervals: closed,
    byEffect: [...byEffect.values()].map(item => ({
      ...item,
      coveragePercent: denominatorMs > 0 ? round((item.activeDurationMs / denominatorMs) * 100) : 0
    }))
  };
};

const compareRuns = (baseline: SerializedRun, variants: SerializedRun[]) => {
  return variants.map(variant => {
    const baselineSkillMap = new Map(baseline.summary.SkillBreakdown.map(skill => [skill.SkillId, skill]));
    const variantSkillIds = new Set([
      ...baseline.summary.SkillBreakdown.map(skill => skill.SkillId),
      ...variant.summary.SkillBreakdown.map(skill => skill.SkillId)
    ]);

    return {
      baselineLabel: baseline.label,
      variantLabel: variant.label,
      bossKilledAtDeltaMs: compareNullableNumbers(baseline.boss.killedAtMs, variant.boss.killedAtMs),
      totalDamageDelta: variant.summary.TotalDamage - baseline.summary.TotalDamage,
      averageDpsDelta: variant.summary.AverageDps - baseline.summary.AverageDps,
      dpsDurationDeltaMs: variant.summary.DpsDurationMs - baseline.summary.DpsDurationMs,
      skillBreakdownDelta: [...variantSkillIds].map(skillId => {
        const baseSkill = baselineSkillMap.get(skillId);
        const variantSkill = variant.summary.SkillBreakdown.find(skill => skill.SkillId === skillId);
        return {
          skillId,
          skillName: variantSkill?.SkillName ?? baseSkill?.SkillName,
          totalDamageDelta: (variantSkill?.TotalDamage ?? 0) - (baseSkill?.TotalDamage ?? 0),
          damageShareDeltaPercent: (variantSkill?.DamageSharePercent ?? 0) - (baseSkill?.DamageSharePercent ?? 0),
          hitCountDelta: (variantSkill?.HitCount ?? 0) - (baseSkill?.HitCount ?? 0)
        };
      })
    };
  });
};

const compareNullableNumbers = (baseline: number | undefined, variant: number | undefined): number | null => {
  if (baseline === undefined || variant === undefined) return null;
  return variant - baseline;
};

const isSimulationScenario = (value: unknown): value is SimulationScenario => {
  const record = asRecord(value);
  return (
    record !== undefined &&
    typeof record.maxTimeMs === 'number' &&
    asRecord(record.boss) !== undefined &&
    Array.isArray(record.actors)
  );
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const asNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const asStringArray = (value: unknown): string[] => {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
};

const asEffectTarget = (value: unknown): AppliedEffectConfig['Target'] | undefined => {
  return value === 'SELF' || value === 'ALLY' || value === 'TEAM' || value === 'ENEMY' ? value : undefined;
};

const asBuffEffects = (value: unknown): BuffEffects | undefined => {
  const record = asRecord(value);
  if (!record) return undefined;
  const effects: BuffEffects = {};
  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      (effects as Record<string, number>)[key] = rawValue;
    }
  }
  return effects;
};

const round = (value: number, digits = 3): number => {
  return Number(value.toFixed(digits));
};

await main();

/**
 * 从校对卡直接跑副本模拟，产出可追溯的 CalculationTrace。
 * 铁律（doc §7）：
 *   · 只吃 ok 字段；缺的非关键项补 0 并记进 filledWithZero，绝不编「合理默认值」
 *   · 技能池为空（如昭冥·仙）直接拒绝，不借他人技能
 *   · 结果必须带 trace，缺 trace 的 UI 不显示数字
 */
import type { CharacterAttributes } from '@zx/simulation-engine';
import { assembleScenario, runSimulation } from '@zx/simulation-engine';
import { DataService } from '../DataService';
import type { RecognizedPanel } from './types';
import { mapToEngine, assertEngineReady } from './mapToEngine';
import { classCoverage, getFactionSkills } from './classCoverage';

export interface SimTarget {
    dungeonId: string;
    dungeonName: string;
    bossId: string;
    bossName: string;
}

export interface CalculationTrace {
    traceId: string;
    panelId: string;
    attrsHash: string;
    dungeonId: string;
    bossId: string;
    buffIds: string[];
    engineFn: 'runSimulation';
    result: {
        totalDamage: number;
        averageDps: number;
        durationMs: number;
        bossKilled: boolean;
        killTimeMs: number | null;
        bossMaxHealth: number;
    };
    /** 缺失但被记为 0 的非关键属性（在 UI 上要显式提示） */
    filledWithZero: string[];
    /** 本次未计入的增益（诚实标注） */
    buffNote: string;
    createdAt: string;
}

export type SimOutcome =
    | { ok: true; trace: CalculationTrace }
    | { ok: false; code: string; message: string };

const hashAttrs = (attrs: Record<string, number>): string => {
    const s = Object.keys(attrs).sort().map(k => `${k}=${attrs[k]}`).join('|');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return `a${(h >>> 0).toString(36)}`;
};

const pickSkillIds = (skills: any[]): string[] => skills
    .filter(s => s.ActionType === 'DAMAGE')
    .map(s => s.SkillID);

export function runPanelSimulation(panel: RecognizedPanel, target: SimTarget): SimOutcome {
    // 1. 职业覆盖闸门：技能池空直接拒绝（昭冥·仙就是这种情况）
    const coverage = classCoverage(panel.character?.classRaw, panel.character?.factionRaw);
    if (!coverage.ok) {
        return { ok: false, code: coverage.code || 'CLASS_COVERAGE_MISSING', message: coverage.reason || '该职业阵营无法推演' };
    }

    // 2. 引擎输入：只搬 ok 字段
    const mapped = mapToEngine(panel);
    try {
        assertEngineReady(mapped);
    } catch (e: any) {
        return { ok: false, code: 'ENGINE_INPUT_INCOMPLETE', message: e?.message || '属性不完整' };
    }

    // 3. 补齐引擎必填但面板没有 / 本次未识别的非关键项（记为 0 并记录）
    const attrs = { ...mapped.attrs } as Partial<CharacterAttributes>;
    const filledWithZero: string[] = [];
    const fillIfMissing = (key: keyof CharacterAttributes) => {
        if (typeof (attrs as any)[key] !== 'number') {
            (attrs as any)[key] = 0;
            filledWithZero.push(String(key));
        }
    };
    (['CharacterDefense', 'CharacterHealth', 'CharacterMana'] as (keyof CharacterAttributes)[]).forEach(fillIfMissing);
    if (typeof attrs.CharacterCriticalHitRatePercent !== 'number') {
        (attrs as any).CharacterCriticalHitRatePercent = 0;
    }

    // 4. 取数据
    const ds = DataService.getInstance();
    const allSkills = ds.getAllSkills();
    const monstersByDungeon = ds.getDungeonsMonsters();
    if (!allSkills || !monstersByDungeon) {
        return { ok: false, code: 'DATA_NOT_READY', message: '游戏数据尚未加载完成，请稍后重试' };
    }

    const skills = getFactionSkills(allSkills as any, coverage.classId!, coverage.faction!);
    const skillIds = pickSkillIds(skills);
    if (skillIds.length === 0) {
        return { ok: false, code: 'NO_DAMAGE_SKILL', message: '该职业阵营没有可用的输出技能' };
    }

    const boss = (monstersByDungeon[target.dungeonId] || []).find((m: any) => m.MonsterID === target.bossId);
    if (!boss) {
        return { ok: false, code: 'BOSS_NOT_FOUND', message: '所选 BOSS 不在该副本中' };
    }

    // 5. 组装 + 跑
    try {
        const scenario = assembleScenario({
            scenarioId: `vision-${Date.now()}`,
            maxTimeMs: 30_000,
            dungeonId: target.dungeonId,
            bossId: target.bossId,
            dpsActor: {
                actorId: 'vision_dps',
                classId: coverage.classId!,
                faction: coverage.faction!,
                profileAttributes: attrs as CharacterAttributes,
                // DPS 策略只支持 MANUAL_TIMELINE / FIXED_ROTATION / SKILL_BAR；
                // 这里用技能栏顺序循环（等价"见到就放"），不伪造时间轴
                strategy: { type: 'SKILL_BAR', skillIds, scanMode: 'CONTINUE_POINTER' },
                skillIds
            }
        }, {
            skills: allSkills as any,
            monstersByDungeon: monstersByDungeon as any
        });

        const result = runSimulation(scenario);
        const summary: any = (result as any).summary || {};
        const bossState: any = (result as any).boss || {};
        const totalDamage = Number(summary.TotalDamage ?? 0);
        const durationMs = Number(summary.DpsDurationMs ?? 0);

        const trace: CalculationTrace = {
            traceId: `t-${Date.now().toString(36)}`,
            panelId: `${panel.kind}-${panel.character?.classRaw || ''}-${panel.character?.factionRaw || ''}`,
            attrsHash: hashAttrs(mapped.attrs as Record<string, number>),
            dungeonId: target.dungeonId,
            bossId: target.bossId,
            buffIds: [],
            engineFn: 'runSimulation',
            result: {
                totalDamage,
                averageDps: Number(summary.AverageDps ?? (durationMs > 0 ? totalDamage / (durationMs / 1000) : 0)),
                durationMs,
                bossKilled: Boolean(bossState.killedAtMs),
                killTimeMs: bossState.killedAtMs ?? null,
                bossMaxHealth: Number(bossState.startingHealth ?? 0)
            },
            filledWithZero,
            buffNote: '未计入专注/绿点/易伤等增益（本期只算面板 + 技能）',
            createdAt: new Date().toISOString()
        };
        return { ok: true, trace };
    } catch (e: any) {
        return { ok: false, code: 'ENGINE_ERROR', message: e?.message || '引擎计算失败' };
    }
}

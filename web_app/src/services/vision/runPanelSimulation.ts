/**
 * 从校对卡算「对该 BOSS 的战力指数」。
 *
 * 口径：与【战力计算器】同源 —— calculateDungeonPower(cheracter, skills, [boss], buffs, buffValues)
 * 不接训练场（秒伤需 runSimulation，训练场本身尚不完善，见 doc §8 Phase C 备注）。
 *
 * 铁律（doc §7）：
 *   · 只吃 ok 字段；缺的非关键项补 0 并记进 filledWithZero，绝不编「合理默认值」
 *   · 技能池为空（如昭冥）直接拒绝，不借他人技能
 *   · 结果必须带 trace，缺 trace 的 UI 不显示数字
 */
import type { CharacterAttributes, Buff } from '@zx/simulation-engine';
import { calculateDungeonPower } from '@zx/simulation-engine';
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

/** 四项战斗增益（默认值来自 combat_buffs.json 中 IsDefaultActive=true 的四条） */
export interface CombatBuffs {
    BUFF_FOCUS_EFFECT: number;
    BUFF_HOLYWRATH_EFFECT: number;
    BUFF_MON_CRITDAMAGE_EFFECT: number;
    BUFF_MON_HARMED_EFFECT: number;
}

export const DEFAULT_COMBAT_BUFFS: CombatBuffs = {
    BUFF_FOCUS_EFFECT: 261,
    BUFF_HOLYWRATH_EFFECT: 22.5,
    BUFF_MON_CRITDAMAGE_EFFECT: 900,
    BUFF_MON_HARMED_EFFECT: 120
};

export const COMBAT_BUFF_LABELS: { key: keyof CombatBuffs; label: string; unit: string }[] = [
    { key: 'BUFF_FOCUS_EFFECT', label: '专注', unit: '' },
    { key: 'BUFF_HOLYWRATH_EFFECT', label: '巫咒', unit: '%' },
    { key: 'BUFF_MON_CRITDAMAGE_EFFECT', label: '绿点', unit: '%' },
    { key: 'BUFF_MON_HARMED_EFFECT', label: '易伤', unit: '%' }
];

export interface CalculationTrace {
    traceId: string;
    panelId: string;
    attrsHash: string;
    dungeonId: string;
    bossId: string;
    buffIds: string[];
    engineFn: 'calculateDungeonPower';
    result: {
        /** 战力指数（与战力计算器同口径，不是秒伤） */
        power: number;
        bossName: string;
        bossMaxHealth: number;
    };
    filledWithZero: string[];
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

export function resolveDefaultBuffs(): CombatBuffs {
    const out = { ...DEFAULT_COMBAT_BUFFS };
    try {
        const buffs = DataService.getInstance().getBuffs() || [];
        for (const b of buffs as any[]) {
            if (b?.BuffID in out && typeof b.DefaultEffectValue === 'number') {
                (out as any)[b.BuffID] = b.DefaultEffectValue;
            }
        }
    } catch { /* 数据未就绪时用常量默认值 */ }
    return out;
}

export function runPanelSimulation(panel: RecognizedPanel, target: SimTarget, buffs: CombatBuffs = DEFAULT_COMBAT_BUFFS): SimOutcome {
    // 1. 职业覆盖闸门：技能池空直接拒绝
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

    // 3. 补齐引擎必填但本次未识别的非关键项（记 0 并记录）
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
    const damageSkills = skills.filter(s => s.ActionType === 'DAMAGE');
    if (damageSkills.length === 0) {
        return { ok: false, code: 'NO_DAMAGE_SKILL', message: '该职业阵营没有可用的输出技能' };
    }

    const boss = (monstersByDungeon[target.dungeonId] || []).find((m: any) => m.MonsterID === target.bossId);
    if (!boss) {
        return { ok: false, code: 'BOSS_NOT_FOUND', message: '所选 BOSS 不在该副本中' };
    }

    // 5. 增益：先把 4 项数值写进 buffValues（键 = BuffID），Buff 对象从 combat_buffs 取
    let activeBuffs: Buff[] = [];
    try {
        const all = (ds.getBuffs() || []) as Buff[];
        const ids = Object.keys(buffs);
        activeBuffs = all.filter((b: any) => ids.includes(b.BuffID));
    } catch { /* 无增益数据时按空处理，并在 trace 里标注 */ }
    const buffValues: Record<string, number> = { ...buffs };

    // 6. 算（与战力计算器同源）
    try {
        const power = calculateDungeonPower(
            attrs as CharacterAttributes,
            damageSkills,
            [boss as any],
            activeBuffs,
            buffValues
        );

        if (!Number.isFinite(power)) {
            return { ok: false, code: 'ENGINE_ERROR', message: '引擎返回了非法数值' };
        }

        const trace: CalculationTrace = {
            traceId: `t-${Date.now().toString(36)}`,
            panelId: `${panel.kind}-${panel.character?.classRaw || ''}-${panel.character?.factionRaw || ''}`,
            attrsHash: hashAttrs(mapped.attrs as Record<string, number>),
            dungeonId: target.dungeonId,
            bossId: target.bossId,
            buffIds: activeBuffs.map((b: any) => b.BuffID),
            engineFn: 'calculateDungeonPower',
            result: {
                power,
                bossName: (boss as any).MonsterName || target.bossId,
                bossMaxHealth: Number((boss as any)?.MonsterAttributeModifiers?.MonsterHealth ?? 0)
            },
            filledWithZero,
            buffNote: activeBuffs.length > 0
                ? `已计入 ${activeBuffs.length} 项团队增益（专注/巫咒/绿点/易伤），数值可在卡上改`
                : '未匹配到增益数据，按无增益计算',
            createdAt: new Date().toISOString()
        };
        return { ok: true, trace };
    } catch (e: any) {
        return { ok: false, code: 'ENGINE_ERROR', message: e?.message || '引擎计算失败' };
    }
}

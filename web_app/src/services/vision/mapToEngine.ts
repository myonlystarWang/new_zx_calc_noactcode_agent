/**
 * RecognizedPanel → CharacterAttributes 的唯一适配层。
 * 铁律（doc §7）：只搬运 status==='ok' 且有源头的值；缺项留空，绝不补默认值、绝不 *0.9。
 */
import type { CharacterAttributes } from '@zx/simulation-engine';
import type { RecognizedPanel } from './types';
import { ENGINE_REQUIRED, fieldDef } from './fieldRegistry';

export interface MappedEngine {
    attrs: Partial<CharacterAttributes>;
    missingRequired: string[];
    mappedFrom: Record<string, string>;
}

export function mapToEngine(panel: RecognizedPanel): MappedEngine {
    const attrs: Record<string, number> = {};
    const mappedFrom: Record<string, string> = {};

    for (const cell of panel.fields) {
        if (!cell.engine) continue;
        if (cell.status !== 'ok' && cell.status !== 'low_confidence') continue;
        if (cell.value === null || cell.value === '') continue;
        const n = typeof cell.value === 'number' ? cell.value : Number(cell.value);
        if (!Number.isFinite(n)) continue;
        const def = fieldDef(panel.kind, cell.key);
        if (!def?.engineKey) continue;
        attrs[def.engineKey] = n;
        mappedFrom[def.engineKey] = cell.key;
    }

    // 最小攻不得大于最大攻（抄串行的典型症状）
    if (
        typeof attrs.CharacterMinAttack === 'number' &&
        typeof attrs.CharacterMaxAttack === 'number' &&
        attrs.CharacterMinAttack > attrs.CharacterMaxAttack
    ) {
        delete attrs.CharacterMinAttack;
    }

    const missingRequired = ENGINE_REQUIRED.filter(k => typeof (attrs as any)[k] !== 'number');

    return {
        attrs: attrs as Partial<CharacterAttributes>,
        missingRequired,
        mappedFrom
    };
}

/** 进引擎前的硬校验：NaN / 负数 / 缺必填 → 抛结构化错误，不静默兜底 */
export function assertEngineReady(mapped: MappedEngine): void {
    if (mapped.missingRequired.length > 0) {
        throw new Error(`引擎必填项缺失：${mapped.missingRequired.join('、')}`);
    }
    for (const [k, v] of Object.entries(mapped.attrs)) {
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
            throw new Error(`字段非法：${k}=${v}`);
        }
    }
}

/**
 * 分享快照 ⇄ 紧凑串（Step 10）
 *
 * 设计要点：
 * - 直接复用 `usePresets.ts` 的 `Preset` 字段名（classId/faction/attributes/activeBuffIds/buffValues），
 *   不另造平行结构，避免两处字段漂移。
 * - **只编码与基线的差分**：属性与 `AppContext.defaultAttributes` 比、buff 勾选与「默认激活集」比，
 *   用户通常只改 5-10 个字段 → 链接能压到 200 字符以内。
 * - buff 用「索引」而非完整 ID 传输（`b`/`bv`），并用 `bx`（激活 buff 名单的哈希）做映射校验：
 *   若 `buffs.json` 调整导致索引指向别的 buff，校验失败 → 丢弃 buff 恢复（属性照常恢复），不会静默错配。
 * - `class` / `faction` / `d` 沿用 Step 8 既有 query 键，本模块不再重复编码。
 */
import { DataService } from '../services/DataService';
import { defaultAttributes } from '../context/AppContext';
import { buildPathFromTarget } from '../routes';
import type { CharacterAttributes, Buff } from '../types';

/** 版本号：payload 前缀 + URL 的 `v` 参数（解码以 payload 前缀为准） */
export const SHARE_VERSION = '1';
const PAYLOAD_PREFIX = `${SHARE_VERSION}:`;

export interface ShareSnapshot {
    classId: string;
    faction: 'XIAN' | 'FO' | 'MO';
    attributes: CharacterAttributes;
    activeBuffIds: string[];
    buffValues: Record<string, number>;
}

/** 解码结果：null 表示「该字段本次无需恢复」（payload 里没带） */
export interface DecodedShare {
    attributes: CharacterAttributes | null;
    activeBuffIds: string[] | null;
    buffValues: Record<string, number> | null;
    /** buff 块存在但未能还原（校验哈希不符 / 索引越界）：属性照常恢复，由上层给出提示 */
    buffsSkipped?: boolean;
}

/** 属性字段 ⇄ 短键（顺序即编码顺序） */
const ATTR_FIELDS: Array<[keyof CharacterAttributes, string]> = [
    ['CharacterMinAttack', 'mn'],
    ['CharacterMaxAttack', 'mx'],
    ['CharacterDefense', 'df'],
    ['CharacterHealth', 'hp'],
    ['CharacterMana', 'mp'],
    ['CharacterCriticalHitDamagePercent', 'cd'],
    ['CharacterMonsterDamageIncreasePercent', 'md'],
    ['CharacterCriticalHitRatePercent', 'cr'],
];

const SHORT_TO_KEY: Record<string, keyof CharacterAttributes> = ATTR_FIELDS.reduce(
    (acc, [key, short]) => {
        acc[short] = key;
        return acc;
    },
    {} as Record<string, keyof CharacterAttributes>,
);

export const FACTION_LABELS: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔' };

/** FNV-1a 32bit → 8 位 hex；用于校验「索引 → buff」映射未漂移 */
function fnv1a32(input: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        h ^= input.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
}

function hashBuffIds(ids: string[]): string {
    return fnv1a32([...ids].sort().join('|'));
}

function currentBuffs(): Buff[] {
    return DataService.getInstance().getBuffs() || [];
}

/** 基线 buff 集：与 AppContext.initData 的默认激活逻辑保持一致 */
export function baselineBuffIds(buffs: Buff[] = currentBuffs()): string[] {
    return buffs.filter((b) => b.IsDefaultActive).map((b) => b.BuffID);
}

function sameNumberArray(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
}

function isValidNumber(v: unknown, min: number, max: number): v is number {
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

interface RawPayload {
    a?: Record<string, number>;
    b?: number[];
    bx?: string;
    bv?: Record<string, number>;
}

/** 生成紧凑 payload（无 lz-string 时的内容，便于测试与调试） */
export function buildRawPayload(snapshot: Pick<ShareSnapshot, 'attributes' | 'activeBuffIds' | 'buffValues'>): RawPayload {
    const payload: RawPayload = {};

    const a: Record<string, number> = {};
    for (const [key, short] of ATTR_FIELDS) {
        const value = snapshot.attributes?.[key];
        const base = defaultAttributes[key];
        if (typeof value === 'number' && Number.isFinite(value) && value !== base) {
            a[short] = Math.round(value);
        }
    }
    if (Object.keys(a).length > 0) payload.a = a;

    const buffs = currentBuffs();
    const indexOf = new Map<string, number>();
    buffs.forEach((b, i) => indexOf.set(b.BuffID, i));

    const activeIds = snapshot.activeBuffIds || [];
    const activeIdx = activeIds
        .map((id) => indexOf.get(id))
        .filter((i): i is number => typeof i === 'number')
        .sort((x, y) => x - y);
    const baseIdx = baselineBuffIds(buffs)
        .map((id) => indexOf.get(id))
        .filter((i): i is number => typeof i === 'number')
        .sort((x, y) => x - y);

    const bv: Record<string, number> = {};
    for (const [id, value] of Object.entries(snapshot.buffValues || {})) {
        const idx = indexOf.get(id);
        if (typeof idx !== 'number') continue;
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        bv[String(idx)] = value;
    }

    const buffsDiffer = !sameNumberArray(activeIdx, baseIdx);
    if (buffsDiffer) payload.b = activeIdx;
    if (Object.keys(bv).length > 0) payload.bv = bv;
    if (buffsDiffer || Object.keys(bv).length > 0) {
        // 只有真的依赖「索引 → buff」映射时才带校验哈希
        payload.bx = hashBuffIds(activeIds);
    }

    return payload;
}

/** 快照 → `p` 参数值（含版本前缀）。内容为空时返回 null（无需带 p） */
export async function encodeSharePayload(
    snapshot: Pick<ShareSnapshot, 'attributes' | 'activeBuffIds' | 'buffValues'>,
): Promise<string | null> {
    const payload = buildRawPayload(snapshot);
    if (Object.keys(payload).length === 0) return null;
    const { default: LZString } = await import('lz-string');
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
    if (!compressed) return null;
    return `${PAYLOAD_PREFIX}${compressed}`;
}

/**
 * 解码 `p` 参数 → 待恢复字段。
 * 任何异常（前缀不符 / 压缩串损坏 / 字段越界 / buff 映射漂移）都安全降级，不抛异常。
 */
export async function decodeSharePayload(raw: string | null | undefined): Promise<DecodedShare | null> {
    if (!raw || !raw.startsWith(PAYLOAD_PREFIX)) return null;
    const body = raw.slice(PAYLOAD_PREFIX.length);
    if (!body) return null;

    let payload: RawPayload;
    try {
        const { default: LZString } = await import('lz-string');
        const json = LZString.decompressFromEncodedURIComponent(body);
        if (!json) return null;
        const parsed = JSON.parse(json) as unknown;
        if (!parsed || typeof parsed !== 'object') return null;
        payload = parsed as RawPayload;
    } catch {
        return null;
    }

    // 属性：以基线为底，叠加 payload 中的字段
    let attributes: CharacterAttributes | null = null;
    if (payload.a && typeof payload.a === 'object') {
        const merged: CharacterAttributes = { ...defaultAttributes };
        let touched = false;
        for (const [short, value] of Object.entries(payload.a)) {
            const key = SHORT_TO_KEY[short];
            if (!key) continue;
            if (!isValidNumber(value, 0, 1e12)) return null;
            (merged as unknown as Record<string, number>)[key] = value;
            touched = true;
        }
        if (touched) attributes = merged;
    }

    // buff：索引 → ID，必须通过 `bx` 校验，否则整块丢弃（宁可不恢复 buff，也不错配）
    let activeBuffIds: string[] | null = null;
    let buffValues: Record<string, number> | null = null;
    let buffsSkipped = false;
    const needsBuffs = payload.b !== undefined || payload.bv !== undefined;
    if (needsBuffs) {
        const buffs = currentBuffs();
        const ids = buffs.map((b) => b.BuffID);

        const resolveIdx = (list: unknown): string[] | null => {
            if (!Array.isArray(list)) return null;
            const out: string[] = [];
            for (const item of list) {
                if (!Number.isInteger(item) || (item as number) < 0 || (item as number) >= ids.length) return null;
                out.push(ids[item as number]);
            }
            return out;
        };

        const resolved = payload.b === undefined ? baselineBuffIds(buffs) : resolveIdx(payload.b);
        if (resolved && typeof payload.bx === 'string' && hashBuffIds(resolved) === payload.bx) {
            if (payload.b !== undefined) activeBuffIds = resolved;

            if (payload.bv && typeof payload.bv === 'object') {
                const values: Record<string, number> = {};
                let ok = true;
                for (const [key, value] of Object.entries(payload.bv)) {
                    const idx = Number(key);
                    if (!Number.isInteger(idx) || idx < 0 || idx >= ids.length) { ok = false; break; }
                    if (!isValidNumber(value, -1e9, 1e9)) { ok = false; break; }
                    values[ids[idx]] = value;
                }
                if (ok) buffValues = values;
            }
        } else {
            buffsSkipped = true;
        }
    }

    if (!attributes && !activeBuffIds && !buffValues) return null;
    return { attributes, activeBuffIds, buffValues, buffsSkipped };
}

/**
 * 生成分享 URL：`class`/`faction`/`d` 复用 Step 8 的既有键，另带 `v` / `p`。
 * 无需带 payload 时退化为纯深链。
 */
export async function buildShareUrl(
    snapshot: ShareSnapshot,
    dungeonId?: string | null,
): Promise<string> {
    const path = buildPathFromTarget({
        tab: 'calculator',
        classId: snapshot.classId,
        faction: snapshot.faction,
        dungeonId: dungeonId || undefined,
    });
    const payload = await encodeSharePayload(snapshot);
    const extra = payload ? `v=${SHARE_VERSION}&p=${payload}` : '';
    const sep = path.includes('?') ? '&' : '?';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/#${path}${extra ? `${sep}${extra}` : ''}`;
}

/** 可粘贴的配置文本（微信群里比链接更易读） */
export function buildConfigText(snapshot: ShareSnapshot, buffs: Buff[]): string {
    const className = DataService.getInstance().getClasses()?.find((c) => c.ClassID === snapshot.classId)?.ClassName
        || snapshot.classId;
    const faction = FACTION_LABELS[snapshot.faction] || snapshot.faction;
    const a = snapshot.attributes || ({} as CharacterAttributes);
    const fmt = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '-');

    const attrText = [
        `攻 ${fmt(a.CharacterMinAttack)}-${fmt(a.CharacterMaxAttack)}`,
        `气血 ${fmt(a.CharacterHealth)}`,
        `真气 ${fmt(a.CharacterMana)}`,
        `防御 ${fmt(a.CharacterDefense)}`,
        `爆伤 ${fmt(a.CharacterCriticalHitDamagePercent)}%`,
        `对怪增伤 ${fmt(a.CharacterMonsterDamageIncreasePercent)}%`,
    ].join(' · ');

    const buffText = buffs
        .filter((b) => snapshot.activeBuffIds.includes(b.BuffID))
        .map((b) => {
            const value = snapshot.buffValues[b.BuffID] ?? b.DefaultEffectValue ?? 0;
            return value ? `${b.BuffName} +${value}` : b.BuffName;
        })
        .join('、');

    return [
        `${className} · ${faction}`,
        attrText,
        `增益：${buffText || '无'}`,
    ].join('\n');
}

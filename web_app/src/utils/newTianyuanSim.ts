/**
 * 新版天缘（上玄佑万辰须弥）模拟引擎
 *
 * 数据口径：elements.data v183 idx425（官方配置）
 *  - 条数概率：3 条 60% / 4 条 30% / 5 条 10%
 *  - 天命触发率：3 条 60% / 4 条 80% / 5 条 100%
 *  - +3/+6/+9/+10 分别触发 3/3/3/1 次天命，每次随机落一条已有属性
 *  - 天命点加成 = 每级成长 × 累计系数（1/3/7/11/17/23/29/35/41/47）
 *
 * 精炼成功率官方未公布，作为可调参数（默认 50%）；失败掉 1 级，+3/+6/+9 保底。
 */

export interface TianyuanAttrDef {
    id: number;
    name: string;
    group: string;
    /** 初始值下限（原始单位，百分比为小数） */
    min: number;
    /** 初始值上限（原始单位） */
    max: number;
    /** 每级成长（原始单位） */
    perLevel: number;
    /** 出现权重（0~1） */
    weight: number;
    unit: string;
    /** 展示倍率：百分比 100，固定值 1 */
    displayScale: number;
    decimals: number;
}

export interface TianyuanPiece {
    key: string;
    name: string;
    shortName: string;
    slot: string;
    attributes: TianyuanAttrDef[];
}

export interface TianyuanRefineConfig {
    maxLevel: number;
    safeLevels: number[];
    triggerLevels: number[];
    triggerPoints: Record<string, number>;
    costGold: number;
    defaultSuccessRate: number;
    ruixiangLevels: number[];
    ruixiangPoints: number;
}

export interface TianyuanData {
    version: number;
    countProbabilities: { count: number; probability: number }[];
    triggerProbabilities: { count: number; probability: number }[];
    destinyCoeffs: number[];
    destinyCumulative: number[];
    refine: TianyuanRefineConfig;
    pieces: TianyuanPiece[];
}

export interface RolledAttr {
    def: TianyuanAttrDef;
    /** 初始随机值（原始单位） */
    base: number;
    /** 该条已获得的天命点数（0~10） */
    destinyPoints: number;
}

export interface TianyuanItem {
    pieceKey: string;
    level: number;
    attrs: RolledAttr[];
    /** 已判定过的天命档位，避免反复上下级重复抽签 */
    settled: Record<number, boolean>;
    /** 瑞祥符每件只能使用一次 */
    ruixiangUsed: boolean;
}

export interface RefineResult {
    success: boolean;
    from: number;
    to: number;
    /** 本次新增天命点（0 表示未触发） */
    destinyGain: number;
    /** 天命点落点属性下标 */
    destinyHits: number[];
    /** 本次结算的天命档位 */
    triggerLevel?: number;
}

export type Rng = () => number;

export const defaultRng: Rng = Math.random;

// ---------------- 基础工具 ----------------

export function pickWeighted<T>(items: T[], weightOf: (item: T) => number, rng: Rng = defaultRng): T | null {
    const total = items.reduce((s, it) => s + Math.max(0, weightOf(it)), 0);
    if (total <= 0) return null;
    let r = rng() * total;
    for (const it of items) {
        r -= Math.max(0, weightOf(it));
        if (r <= 0) return it;
    }
    return items[items.length - 1] ?? null;
}

/** 展示值（含天缘等级与天命加成） */
export function attrDisplayValue(attr: RolledAttr, level: number, cumulative: number[]): number {
    const destiny = attr.destinyPoints > 0
        ? attr.def.perLevel * (cumulative[Math.min(attr.destinyPoints, cumulative.length) - 1] ?? 0)
        : 0;
    return (attr.base + level * attr.def.perLevel + destiny) * attr.def.displayScale;
}

/** 只算天命部分带来的展示增量 */
export function attrDestinyBonus(attr: RolledAttr, cumulative: number[]): number {
    if (attr.destinyPoints <= 0) return 0;
    return attr.def.perLevel * (cumulative[Math.min(attr.destinyPoints, cumulative.length) - 1] ?? 0) * attr.def.displayScale;
}

export function formatAttrValue(def: TianyuanAttrDef, value: number): string {
    const fixed = value.toFixed(def.decimals);
    // 百分比固定保留 1 位（游戏内 15.0%），固定值取整
    return `${fixed}${def.unit}`;
}

export function totalDestiny(item: TianyuanItem): number {
    return item.attrs.reduce((s, a) => s + a.destinyPoints, 0);
}

// ---------------- 开箱生成 ----------------

export function rollItem(piece: TianyuanPiece, countProbs: { count: number; probability: number }[], rng: Rng = defaultRng): TianyuanItem {
    const countPick = pickWeighted(countProbs, (c) => c.probability, rng);
    const targetCount = countPick ? countPick.count : 3;

    // 按属性名分组：同一属性有高低两档，只能出现其中一条
    const groups = new Map<string, TianyuanAttrDef[]>();
    for (const def of piece.attributes) {
        const list = groups.get(def.group) ?? [];
        list.push(def);
        groups.set(def.group, list);
    }

    const groupList = [...groups.entries()].map(([name, defs]) => ({
        name,
        defs,
        weight: defs.reduce((s, d) => s + d.weight, 0),
    }));

    // 无放回抽组
    const remaining = [...groupList];
    const picked: RolledAttr[] = [];
    const want = Math.min(targetCount, remaining.length);
    for (let i = 0; i < want; i++) {
        const g = pickWeighted(remaining, (x) => x.weight, rng);
        if (!g) break;
        const idx = remaining.findIndex((x) => x.name === g.name);
        if (idx >= 0) remaining.splice(idx, 1);

        const def = pickWeighted(g.defs, (d) => d.weight, rng) ?? g.defs[0];
        if (!def) continue;
        const base = def.min + rng() * Math.max(0, def.max - def.min);
        picked.push({ def, base, destinyPoints: 0 });
    }

    // 展示顺序沿用配置里的首次出现位置，读起来更像游戏面板
    const order = new Map<string, number>();
    piece.attributes.forEach((d, i) => {
        if (!order.has(d.group)) order.set(d.group, i);
    });
    picked.sort((a, b) => (order.get(a.def.group) ?? 0) - (order.get(b.def.group) ?? 0));

    return {
        pieceKey: piece.key,
        level: 0,
        attrs: picked,
        settled: {},
        ruixiangUsed: false,
    };
}

// ---------------- 精炼 ----------------

export function triggerProbabilityFor(count: number, probs: { count: number; probability: number }[]): number {
    const hit = probs.find((p) => p.count === count);
    return hit ? hit.probability : count >= 5 ? 1 : 0;
}

/** 判定并分配某一档天命 */
function settleDestiny(
    item: TianyuanItem,
    level: number,
    data: TianyuanData,
    rng: Rng,
): { gain: number; hits: number[] } {
    if (item.settled[level]) return { gain: 0, hits: [] };
    item.settled[level] = true;

    const p = triggerProbabilityFor(item.attrs.length, data.triggerProbabilities);
    if (rng() >= p) return { gain: 0, hits: [] };

    const times = data.refine.triggerPoints[String(level)] ?? 0;
    const hits: number[] = [];
    for (let i = 0; i < times; i++) {
        if (item.attrs.length === 0) break;
        const idx = Math.floor(rng() * item.attrs.length);
        const target = item.attrs[idx];
        if (!target) continue;
        if (totalDestiny(item) >= 10) break;
        target.destinyPoints = Math.min(10, target.destinyPoints + 1);
        hits.push(idx);
    }
    return { gain: hits.length, hits };
}

export function refineOnce(
    item: TianyuanItem,
    data: TianyuanData,
    successRate: number,
    rng: Rng = defaultRng,
): RefineResult {
    const max = data.refine.maxLevel;
    if (item.level >= max) {
        return { success: false, from: item.level, to: item.level, destinyGain: 0, destinyHits: [] };
    }
    const from = item.level;
    const success = rng() < successRate;
    if (success) {
        item.level = Math.min(max, from + 1);
    } else {
        // 新版天缘：失败不掉级（官方无回退），只有成功才 +1
        item.level = from;
    }

    let destinyGain = 0;
    let destinyHits: number[] = [];
    let triggerLevel: number | undefined;
    if (success && data.refine.triggerLevels.includes(item.level)) {
        triggerLevel = item.level;
        const res = settleDestiny(item, item.level, data, rng);
        destinyGain = res.gain;
        destinyHits = res.hits;
    }

    return { success, from, to: item.level, destinyGain, destinyHits, triggerLevel };
}

/** 瑞祥符：+2/+5/+8 时可指定一条属性必定获得 3 点天命（每件一次） */
export function applyRuixiang(
    item: TianyuanItem,
    attrIndex: number,
    data: TianyuanData,
): { ok: boolean; reason?: string; gain: number } {
    if (item.ruixiangUsed) return { ok: false, reason: '本件已用过瑞祥符', gain: 0 };
    if (!data.refine.ruixiangLevels.includes(item.level)) {
        return { ok: false, reason: `仅在 +${data.refine.ruixiangLevels.join('/+')} 时可使用`, gain: 0 };
    }
    const attr = item.attrs[attrIndex];
    if (!attr) return { ok: false, reason: '无效属性', gain: 0 };

    let gain = 0;
    for (let i = 0; i < data.refine.ruixiangPoints; i++) {
        if (totalDestiny(item) >= 10) break;
        attr.destinyPoints = Math.min(10, attr.destinyPoints + 1);
        gain++;
    }
    item.ruixiangUsed = true;
    return { ok: true, gain };
}

export function resetItem(item: TianyuanItem): TianyuanItem {
    return {
        ...item,
        level: 0,
        attrs: item.attrs.map((a) => ({ ...a, destinyPoints: 0 })),
        settled: {},
        // 重置 = 重来一轮，瑞祥符状态一并复原
        ruixiangUsed: false,
    };
}

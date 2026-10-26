/**
 * 轩辕策洗练模拟 —— 纯计算层（零 UI 依赖）
 *
 * 数据口径：`public/game_data/xyc_refine.json`（由 `scripts/build_xyc_refine_data.mjs` 从客户端
 * `elements.data` 表 213 / 214 / 215 直接解出，脚本内含 Σ=1 自检）。
 *
 * 关键规则（官方 221025info + 客户端字段）：
 * - 洗练不改变「属性条数」（只有鉴定决定；六品固定 5 条，一~五品 2/3/4/5 条按概率）；
 * - 三种道具：大衍奇术=只洗属性 / 一元道契=只洗技能 / 太乙宝函=属性+技能；
 * - 技能只可能出现在青龙、白虎，且要求 品阶≥3 且 条数≥4；朱雀、玄武一定没有技能；
 * - 属性数值：先掷一个「五档品质档」，全部属性数值落在该档的 1/5 区间内随机。
 */

export type XycBeast = '青龙' | '白虎' | '朱雀' | '玄武';
export type XycVersion = '普通' | '典藏' | '英雄';
export type XycWashMode = 'attr' | 'skill' | 'both';

export interface XycAttrDef {
    name: string;
    unit: string;
    pct: boolean;
    scope: 'common' | XycBeast;
}

export interface XycPoolAttr {
    id: number;
    min: number;
    max: number;
    step: number;
    prob: number;
}

export interface XycPool {
    poolId: number;
    bookName: string;
    washMax: number;
    attrCountProbs: Record<string, number>;
    skillProb: number;
    tierProbs: number[];
    attrs: XycPoolAttr[];
}

export interface XycSkillDef {
    id: number;
    name: string;
    variant: string;
    replace: string;
    desc: string;
}

export interface XycRefineData {
    meta: {
        versions: XycVersion[];
        gradeNames: string[];
        maxLevel: number;
        baseWashMax: number;
        washMaxWithItem: number;
        heroWashMaxWithItem: number;
        skillNeedGrade: number;
        skillNeedAttrCount: number;
        skillBeasts: string[];
    };
    attrs: Record<string, XycAttrDef>;
    books: Record<string, { bookName: string; color: string }>;
    pools: Record<string, Record<string, Record<string, XycPool>>>;
    skill: {
        levelProbsLow: number[];
        levelProbsHigh: number[];
        variantProbs: Record<string, number>;
        pool: Record<string, XycSkillDef[]>;
    };
}

export interface XycAttrRoll {
    /** 属性类型 id（对应 data.attrs） */
    id: number;
    /** 0 级基准值（客户端存小数，百分比属性 0.035 = 3.5%） */
    base: number;
}

export interface XycSkillRoll {
    id: number;
    name: string;
    variant: string;
    level: number;
    replace: string;
}

export interface XycBook {
    version: XycVersion;
    beast: XycBeast;
    grade: number;
    level: number;
    attrCount: number;
    tier: number;
    attrs: XycAttrRoll[];
    skill: XycSkillRoll | null;
    washUsed: number;
    washMax: number;
    /** 累计洗练次数（含超过上限后继续的，仅统计用） */
    washTotal: number;
}

export type Rng = () => number;

/** 确定性随机（mulberry32），保证「重放同一次种子结果一致」 */
export function makeRng(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function getPool(data: XycRefineData, version: XycVersion, beast: XycBeast, grade: number): XycPool | null {
    return data?.pools?.[version]?.[beast]?.[String(grade)] ?? null;
}

/** 该版本/系别在游戏里是否存在（典藏版已下线；英雄版四系均已开放，仅限六品） */
export function versionSupports(_version: XycVersion, _beast: XycBeast): boolean {
    return true;
}

export function canRollSkill(data: XycRefineData, beast: XycBeast, grade: number, attrCount: number): boolean {
    const meta = data?.meta;
    if (!meta) return false;
    if (!meta.skillBeasts.includes(beast)) return false;
    return grade >= meta.skillNeedGrade && attrCount >= meta.skillNeedAttrCount;
}

/** 技能等级概率：三/四品只出 1~2 级，五/六品可出 1~3 级 */
export function getSkillLevelProbs(data: XycRefineData, grade: number): number[] {
    return grade >= 5 ? data.skill.levelProbsHigh : data.skill.levelProbsLow;
}

function pickWeighted<T>(items: T[], weight: (item: T) => number, rng: Rng): T | null {
    const total = items.reduce((acc, it) => acc + Math.max(0, weight(it)), 0);
    if (total <= 0) return null;
    let r = rng() * total;
    for (const it of items) {
        r -= Math.max(0, weight(it));
        if (r <= 0) return it;
    }
    return items[items.length - 1] ?? null;
}

function pickIndexByProbs(probs: number[], rng: Rng): number {
    const total = probs.reduce((a, c) => a + c, 0);
    if (total <= 0) return 0;
    let r = rng() * total;
    for (let i = 0; i < probs.length; i++) {
        r -= probs[i];
        if (r <= 0) return i;
    }
    return probs.length - 1;
}

/** 属性条数分布（按品阶/版本） */
export function getAttrCountOptions(pool: XycPool): Array<{ count: number; prob: number }> {
    return Object.entries(pool.attrCountProbs)
        .map(([count, prob]) => ({ count: Number(count), prob }))
        .filter((x) => x.prob > 0)
        .sort((a, b) => a.count - b.count);
}

export function rollAttrCount(pool: XycPool, rng: Rng): number {
    const opts = getAttrCountOptions(pool);
    const idx = pickIndexByProbs(opts.map((o) => o.prob), rng);
    return opts[idx]?.count ?? 2;
}

/** 五档品质档（0 = 最低 20% 区间） */
export function rollTier(pool: XycPool, rng: Rng): number {
    return pickIndexByProbs(pool.tierProbs, rng);
}

function rollOneValue(attr: XycPoolAttr, tier: number, rng: Rng): number {
    const span = attr.max - attr.min;
    const lo = attr.min + (span * tier) / 5;
    const hi = attr.min + (span * (tier + 1)) / 5;
    return lo + (hi - lo) * rng();
}

/** 按出现概率不放回抽 count 条属性，数值统一落在同一档区间 */
export function rollAttrs(pool: XycPool, count: number, tier: number, rng: Rng): XycAttrRoll[] {
    const remain = [...pool.attrs];
    const out: XycAttrRoll[] = [];
    for (let i = 0; i < count && remain.length > 0; i++) {
        const picked = pickWeighted(remain, (a) => a.prob, rng);
        if (!picked) break;
        out.push({ id: picked.id, base: rollOneValue(picked, tier, rng) });
        remain.splice(remain.indexOf(picked), 1);
    }
    return out;
}

export function rollSkill(data: XycRefineData, occ: string, grade: number, rng: Rng): XycSkillRoll | null {
    const raw = data.skill.pool?.[occ];
    if (!raw || raw.length === 0) return null;
    // 兜底：客户端技能表里混有占位/被动条目（名字后面拼了效果描述，如「…《英雄》攻击怪物减少冷却」），
    // 正常技能名一定止于 《变体》/触发/（协同攻击）
    const clean = raw.filter((s) => /(《[^》]+》|触发|）)$/.test(s.name));
    const list = clean.length > 0 ? clean : raw;
    const def = list[Math.floor(rng() * list.length)] ?? list[0];
    const probs = getSkillLevelProbs(data, grade);
    const level = pickIndexByProbs(probs, rng) + 1;
    return { id: def.id, name: def.name, variant: def.variant, level, replace: def.replace };
}

export interface IdentifyOptions {
    version: XycVersion;
    beast: XycBeast;
    grade: number;
    level?: number;
    occ?: string;
}

export function identifyBook(data: XycRefineData, opts: IdentifyOptions, rng: Rng): XycBook | null {
    const pool = getPool(data, opts.version, opts.beast, opts.grade);
    if (!pool) return null;
    // 六品固定 5 条属性（普通/英雄一致）；一~五品仍按客户端条数概率表
    const attrCount = opts.grade >= 6 ? 5 : rollAttrCount(pool, rng);
    const tier = rollTier(pool, rng);
    const attrs = rollAttrs(pool, attrCount, tier, rng);
    const hasSkillSlot = canRollSkill(data, opts.beast, opts.grade, attrCount);
    const skill = hasSkillSlot && rng() < pool.skillProb ? rollSkill(data, opts.occ || '鬼王', opts.grade, rng) : null;
    return {
        version: opts.version,
        beast: opts.beast,
        grade: opts.grade,
        level: opts.level ?? 1,
        attrCount,
        tier,
        attrs,
        skill,
        washUsed: 0,
        washMax: pool.washMax || data.meta.baseWashMax,
        washTotal: 0,
    };
}

export interface WashResult {
    book: XycBook;
    /** 变化摘要，供 UI 高亮 */
    changed: Array<{ kind: 'attr'; id: number; before: number | null; after: number | null } | { kind: 'skill'; before: string | null; after: string | null }>;
    gotSkill: boolean;
    lostSkill: boolean;
}

/**
 * 执行一次洗练。
 * - attr：重掷「属性条目组合 + 数值」，条数不变
 * - skill：只重掷技能槽（按技能出现概率，可能洗空）
 * - both：两者都重掷
 */
export function wash(data: XycRefineData, book: XycBook, mode: XycWashMode, occ: string, rng: Rng): WashResult {
    const pool = getPool(data, book.version, book.beast, book.grade);
    if (!pool) return { book, changed: [], gotSkill: false, lostSkill: false };

    let next: XycBook = { ...book, attrs: [...book.attrs], skill: book.skill };
    const changed: WashResult['changed'] = [];

    if (mode === 'attr' || mode === 'both') {
        const tier = rollTier(pool, rng);
        const attrs = rollAttrs(pool, book.attrCount, tier, rng);
        next = { ...next, tier, attrs };

        const beforeById = new Map(book.attrs.map((a) => [a.id, a.base]));
        const afterById = new Map(attrs.map((a) => [a.id, a.base]));
        const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
        for (const id of ids) {
            const b = beforeById.get(id) ?? null;
            const a = afterById.get(id) ?? null;
            if (b !== null && a !== null && Math.abs(b - a) < 1e-9) continue;
            changed.push({ kind: 'attr', id, before: b, after: a });
        }
    }

    if (mode === 'skill' || mode === 'both') {
        const eligible = canRollSkill(data, book.beast, book.grade, book.attrCount);
        const hit = eligible && rng() < pool.skillProb;
        const nextSkill = hit ? rollSkill(data, occ, book.grade, rng) : null;
        next = { ...next, skill: nextSkill };
        const beforeName = book.skill ? `${book.skill.name} ${book.skill.level}级` : null;
        const afterName = nextSkill ? `${nextSkill.name} ${nextSkill.level}级` : null;
        if (beforeName !== afterName) changed.push({ kind: 'skill', before: beforeName, after: afterName });
    }

    next.washUsed = book.washUsed + 1;
    next.washTotal = book.washTotal + 1;
    return {
        book: next,
        changed,
        gotSkill: !book.skill && Boolean(next.skill),
        lostSkill: Boolean(book.skill) && !next.skill,
    };
}

/* ────────────────────────── 展示格式化 ────────────────────────── */

/** 某条属性在当前等级的实际数值（客户端：显示值 = 基准值 + 每级增益 × 等级） */
export function attrValueAt(pool: XycPool, roll: XycAttrRoll, level: number): number {
    const def = pool.attrs.find((a) => a.id === roll.id);
    const step = def?.step ?? 0;
    return roll.base + step * level;
}

export function formatAttrValue(data: XycRefineData, id: number, raw: number): string {
    const def = data.attrs[String(id)];
    if (!def) return String(raw);
    if (def.pct) return `${(raw * 100).toFixed(1)}%`;
    return String(Math.round(raw));
}

/** 数值所处的五档品质（0 最低） */
export function tierOfValue(pool: XycPool, id: number, raw: number): number {
    const def = pool.attrs.find((a) => a.id === id);
    if (!def || def.max <= def.min) return 0;
    const ratio = (raw - def.min) / (def.max - def.min);
    return Math.max(0, Math.min(4, Math.floor(ratio * 5)));
}

export const TIER_NAMES = ['白', '绿', '蓝', '紫', '橙'] as const;
export const TIER_COLORS = ['#ffffff', '#4fbc3c', '#3aa6f9', '#b446ff', '#ff9a3c'] as const;

/** 洗练道具（= 游戏里的大衍奇术 / 一元道契 / 太乙宝函） */
export const WASH_ITEMS: Array<{ mode: XycWashMode; name: string; short: string; desc: string }> = [
    {
        mode: 'attr',
        name: '大衍奇术',
        short: '只洗属性',
        desc: '改变附加属性（条目组合与数值），不改变属性条数与技能。四系通用。',
    },
    {
        mode: 'skill',
        name: '一元道契',
        short: '只洗技能',
        desc: '只重掷进阶技能。仅青龙、白虎且 品阶≥3、属性≥4 条时生效；朱雀、玄武无效。',
    },
    {
        mode: 'both',
        name: '太乙宝函',
        short: '属性+技能',
        desc: '同时重掷属性与技能。技能可能换等级、换系别，也可能被洗掉。四系通用，朱雀、玄武只洗属性。',
    },
];

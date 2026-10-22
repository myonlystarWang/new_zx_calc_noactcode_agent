/**
 * yunlingSim.ts
 * 神隐装备「蕴灵」模拟核心：概率模型 / 期望推导 / 蒙特卡洛
 *
 * ── 官方口径（完美官方概率表）────────────────────────────
 * 实际成功率 = 基础概率 × (1 + 装备幸运值增益 + 个人幸运值增益)
 * 基础概率是一个区间（如 +11 为 6.67% ~ 100%），官方未公开取值规则。
 *
 * ── 客户端实证（doc/神隐蕴灵_月德符消耗与幸运值实证_20261021.md）──
 * · 月德符消耗：表 280 三套曲线（通用 1962 / 腰带 4422 / 袖甲 6069），+1~+15 逐级递增。
 *   腰带、袖甲仅「修武 / 昭武」吃折扣曲线，彰武回落通用表。
 * · 幸运值：表 281 两张阶梯表（个人 1963 / 装备 1988），幸运值达到阈值才拿到对应加成，
 *   不是线性换算。个人最高 2000 点 → +15%；装备最高 1200 点 → +40%。
 * · 基础成功率**不在客户端**（服务端下发），只能由官方概率区间与实测反推。
 *
 * ── 本模拟器的设计口径（社区实测反推，非官方）────────────
 * 1) 基础概率默认取区间下限（baseMode='floor'）。
 *    依据：按「区间内均匀随机」模拟 +11 平均不到 2 手（社区实测 1.8 手），
 *    +13 的手数长尾能拖到 500 手以上，与实际体感、论坛晒的消耗量级都不符。
 * 2) 幸运值按客户端阶梯表查档：个人 / 装备分别查表后**相加**，再乘到基础概率上。
 * 3) 累积幸运：每次失败 +N 点，成功后归零 —— 即游戏内「蕴灵失败幸运值 +1」的软保底，
 *    跨越阈值时才抬升加成。默认计入**装备幸运值**档（封顶 1200 → +40%，与游戏内/信息卡表现一致），
 *    可用 `luckGainTarget: 'person'` 改为计入个人档（封顶 2000 → +15%）。
 * 4) 可选强化收敛（默认关闭，供对照）：
 *    converge > 0 按连续失败手数追加补偿，把几何分布长尾削平；
 *    pity > 0 连续失败达到 N 手必成（硬保底）。
 */

export interface YunlingRate {
    level: number;
    /** 区间下限（%），即本模拟器默认基础概率 */
    min: number;
    /** 区间上限（%） */
    max: number;
}

/** 官方概率表（%）。+1 ~ +11 上限 100%，+12 起上限收敛到 42% / 32% / 16% / 14% */
export const YUNLING_RATES: YunlingRate[] = [
    { level: 1, min: 100, max: 100 },
    { level: 2, min: 80, max: 100 },
    { level: 3, min: 66.67, max: 100 },
    { level: 4, min: 57.14, max: 100 },
    { level: 5, min: 50, max: 100 },
    { level: 6, min: 40, max: 100 },
    { level: 7, min: 33.33, max: 100 },
    { level: 8, min: 20, max: 100 },
    { level: 9, min: 12.5, max: 100 },
    { level: 10, min: 10, max: 100 },
    { level: 11, min: 6.67, max: 100 },
    { level: 12, min: 2, max: 42 },
    { level: 13, min: 1.52, max: 32 },
    { level: 14, min: 0.8, max: 16 },
    { level: 15, min: 0.67, max: 14 },
];

export const YUNLING_MAX = 15;

/** 基础概率取值口径 */
export type BaseMode = 'floor' | 'random' | 'ceil' | 'calibrated';

export const BASE_MODE_LABEL: Record<BaseMode, string> = {
    floor: '实测口径（取下限）',
    random: '区间均匀随机',
    ceil: '乐观口径（取上限）',
    calibrated: '实测校准（手数反推）',
};

/**
 * 实测校准倍率（2026-10-22）：官方下限 × k。
 * 依据玩家实测手数反推：+13 基本 80~120、+14 120~150、+15 150~190 手。
 * 反推脚本 scripts/yunling_calibrate.ts，结论见 doc/蕴灵概率校准_实测反推_20261022.md。
 */
export const CALIBRATED_K: Record<number, number> = {
    13: 0.43,
    14: 0.61,
    15: 0.59,
};

/**
 * 校准口径的软保底窗口 [S, C]：S 手起成功率向 100% 抬升、C 手必成。
 * 窗口由实测手数上沿反推（+13 100~150、+14 135~203、+15 170~255），
 * 其余等级沿用 250 / 300。
 */
export const CALIBRATED_CAPS: Record<number, [number, number]> = {
    13: [100, 150],
    14: [135, 203],
    15: [170, 255],
};

// ── 幸运值阶梯表（客户端 表 281 实证）────────────────────────

export interface LuckTier {
    /** 幸运值达到该阈值即获得对应加成 */
    threshold: number;
    /** 相对加成，0.05 = +5% */
    bonus: number;
}

/** 个人幸运值（配置 1963）：25/50/100/200/550/1000/2000 → 2% ~ 15% */
export const PERSON_LUCK_TIERS: LuckTier[] = [
    { threshold: 25, bonus: 0.02 },
    { threshold: 50, bonus: 0.03 },
    { threshold: 100, bonus: 0.05 },
    { threshold: 200, bonus: 0.08 },
    { threshold: 550, bonus: 0.1 },
    { threshold: 1000, bonus: 0.12 },
    { threshold: 2000, bonus: 0.15 },
];

/** 个人幸运值封顶档：≥2000 点加成恒为 +15%，再往上加无任何增益（UI 上限给到 4000 只为便于验证这一点） */
export const PERSON_LUCK_CAP = 2000;

/** 装备幸运值（配置 1988）：5/10/25/50/100/200/350/550/800/1200 → 3% ~ 40% */
export const EQUIP_LUCK_TIERS: LuckTier[] = [
    { threshold: 5, bonus: 0.03 },
    { threshold: 10, bonus: 0.05 },
    { threshold: 25, bonus: 0.08 },
    { threshold: 50, bonus: 0.1 },
    { threshold: 100, bonus: 0.12 },
    { threshold: 200, bonus: 0.15 },
    { threshold: 350, bonus: 0.18 },
    { threshold: 550, bonus: 0.2 },
    { threshold: 800, bonus: 0.3 },
    { threshold: 1200, bonus: 0.4 },
];

/** 装备幸运值封顶档：≥1200 点加成恒为 +40%（游戏内该档已满） */
export const EQUIP_LUCK_CAP = 1200;

/** 失败累积的幸运值计入哪一档 */
export type LuckGainTarget = 'equip' | 'person';

/** 按阶梯表查当前幸运值对应的加成（未达首档为 0） */
export function luckBonus(tiers: LuckTier[], points: number): number {
    let bonus = 0;
    for (const t of tiers) {
        if (points >= t.threshold) bonus = t.bonus;
        else break;
    }
    return bonus;
}

/** 下一档还差多少点（已满档返回 null） */
export function nextLuckTier(tiers: LuckTier[], points: number): LuckTier | null {
    for (const t of tiers) {
        if (points < t.threshold) return t;
    }
    return null;
}

/**
 * 当前幸运值所处的档位区间 [lo, hi)，用于「距下一档」的进度条。
 * 满档时 lo = hi = 最高阈值。
 */
export function luckTierRange(tiers: LuckTier[], points: number): { lo: number; hi: number } {
    let lo = 0;
    let hi = tiers[0]?.threshold ?? 0;
    for (const t of tiers) {
        if (points < t.threshold) break;
        lo = t.threshold;
    }
    // hi = 比 lo 大的下一个阈值；满档时 hi = lo
    const next = tiers.find((t) => t.threshold > lo);
    hi = next ? next.threshold : lo;
    return { lo, hi: hi > lo ? hi : lo };
}

// ── 月德符消耗（客户端 表 280 实证）──────────────────────────

export type CostCurve = 'general' | 'belt' | 'cuff';

export const COST_CURVE_LABEL: Record<CostCurve, string> = {
    general: '通用曲线',
    belt: '腰带曲线',
    cuff: '袖甲曲线',
};

/** +1 ~ +15 每手消耗的月德符数量 */
export const COST_CURVES: Record<CostCurve, number[]> = {
    general: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 40, 60, 90, 120, 150],
    belt: [1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 30, 45, 70, 95, 120],
    cuff: [1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 30, 40, 45, 60, 75],
};

/** 冲到 level 级时「每一手」的月德符消耗（level 取 1~15） */
export function costForTarget(level: number, curve: CostCurve): number {
    const arr = COST_CURVES[curve];
    const idx = Math.max(0, Math.min(arr.length - 1, Math.round(level) - 1));
    return arr[idx];
}

/** 部位 + 品质 → 消耗曲线（只有腰带 / 袖甲的修武、昭武吃折扣表） */
export function curveForEquip(slot?: string, quality?: string): CostCurve {
    const discounted = quality === '修武' || quality === '昭武';
    if (discounted && slot === '腰带') return 'belt';
    if (discounted && slot === '袖甲') return 'cuff';
    return 'general';
}

/** 累计消耗（+1 冲到 +15 全买齐的固定成本，不含失败重试） */
export function totalCurveCost(curve: CostCurve): number {
    return COST_CURVES[curve].reduce((s, v) => s + v, 0);
}

// ── 配置 ─────────────────────────────────────────────────────

export interface YunlingConfig {
    baseMode: BaseMode;
    /** 装备自带幸运值（固定，< 1200） */
    equipLuck: number;
    /** 个人幸运值（面板固定值，< 2000） */
    personLuck: number;
    /** 每次失败累积的幸运值（成功归零） */
    luckGainPerFail: number;
    /**
     * 失败累积的幸运值计入哪一档：
     * 'equip' = 装备幸运值（封顶 1200 → +40%，与信息卡/游戏内表现一致，默认）
     * 'person' = 个人幸运值（封顶 2000 → +15%）
     */
    luckGainTarget?: LuckGainTarget;
    /** 长尾收敛强度（0 = 关闭） */
    converge: number;
    /** 硬保底：连续失败 N 手必成（0 = 关闭） */
    pity: number;
    /** 月德符消耗曲线 */
    costCurve: CostCurve;
}

export const DEFAULT_CONFIG: YunlingConfig = {
    baseMode: 'calibrated',
    equipLuck: 0,
    personLuck: 100,
    luckGainPerFail: 1,
    luckGainTarget: 'equip',
    converge: 0,
    pity: 0,
    costCurve: 'general',
};

export function rateOf(level: number): YunlingRate {
    const lv = Math.max(1, Math.min(YUNLING_MAX, Math.round(level)));
    return YUNLING_RATES[lv - 1];
}

/** 展示用基础概率（%）：随机口径取区间中值，仅用于面板读数 */
export function baseProbPct(level: number, mode: BaseMode): number {
    const r = rateOf(level);
    if (mode === 'floor') return r.min;
    if (mode === 'ceil') return r.max;
    if (mode === 'calibrated') return r.min * (CALIBRATED_K[level] ?? 1);
    return (r.min + r.max) / 2;
}

/** 某次判定的基础概率（%）：随机口径每手重掷 */
function drawBasePct(level: number, mode: BaseMode, rnd: () => number): number {
    const r = rateOf(level);
    if (mode === 'floor') return r.min;
    if (mode === 'ceil') return r.max;
    if (mode === 'calibrated') return r.min * (CALIBRATED_K[level] ?? 1);
    return r.min + rnd() * (r.max - r.min);
}

/** 幸运值增益拆解：装备档 + 个人档 + 累积档 */
export interface LuckBreakdown {
    equipPoints: number;
    personPoints: number;
    equipBonus: number;
    personBonus: number;
    /** 合计相对增益，0.15 = +15% */
    total: number;
}

export function luckBreakdown(cfg: YunlingConfig, failStreak: number): LuckBreakdown {
    const gain = failStreak * cfg.luckGainPerFail;
    // 累积幸运按 cfg.luckGainTarget 计入装备档或个人档，各自封顶（装备 1200→+40%、个人 2000→+15%）
    const target = cfg.luckGainTarget ?? 'equip';
    const equipPoints = Math.min(EQUIP_LUCK_CAP, cfg.equipLuck + (target === 'equip' ? gain : 0));
    const personPoints = Math.min(PERSON_LUCK_CAP, cfg.personLuck + (target === 'person' ? gain : 0));
    const equipBonus = luckBonus(EQUIP_LUCK_TIERS, equipPoints);
    const personBonus = luckBonus(PERSON_LUCK_TIERS, personPoints);
    return {
        equipPoints,
        personPoints,
        equipBonus,
        personBonus,
        total: equipBonus + personBonus,
    };
}

/**
 * 由基础概率（0~1）+ 幸运增益推导最终成功率（0~1），随机重掷不参与。
 *
 * 实际成功率 = 基础概率 × (1 + 装备档加成 + 个人档加成)。
 * 公式来源为官方原文，非本工具假设：「神隐蕴灵实际成功率 = 基础概率 ×（1 + 装备幸运值增益 +
 * 个人幸运值增益）；装备幸运值与个人幸运值为动态叠加」。两档**相加**，不是各自乘算。
 * 详见 doc/神隐蕴灵_概率消耗全口径整合_20261021.md §4.3、doc/神隐蕴灵_月德符消耗与幸运值实证_20261021.md §4.4。
 * converge / pity 默认 0（关闭），默认行为严格等于该公式。
 */
function probFromBase(base: number, gain: number, failStreak: number, cfg: YunlingConfig): number {
    if (cfg.pity > 0 && failStreak >= cfg.pity) return 1;
    let p = base * (1 + gain);
    // 长尾收敛：连续失败越久补偿越强（按「几何分布期望手数」归一化）
    if (cfg.converge > 0) {
        const expTries = 1 / Math.max(p, 0.0005);
        p *= 1 + cfg.converge * (failStreak / expTries);
    }
    return Math.max(0, Math.min(1, p));
}

/**
 * 第 failStreak 次连续失败之后这一手的实际成功率（0~1）
 */
/** 单级手数软上限：250 手起概率随机抬升，第 300 手必成 */
export const LEVEL_SOFT_START = 250;
export const LEVEL_ATTEMPT_CAP = 300;

/**
 * 软保底：同一级打到 S 手后，成功率按「距 C 的剩余比例」向 100% 收敛，第 C 手必成。
 * 默认窗口 250~300；校准口径下 +13/+14/+15 使用 CALIBRATED_CAPS 的更紧窗口。
 */
export function capWindow(level: number, mode: BaseMode): [number, number] {
    if (mode === 'calibrated') {
        const w = CALIBRATED_CAPS[Math.round(level)];
        if (w) return w;
    }
    return [LEVEL_SOFT_START, LEVEL_ATTEMPT_CAP];
}

export function softCapProb(
    p: number,
    attemptsInLevel: number,
    window: [number, number] = [LEVEL_SOFT_START, LEVEL_ATTEMPT_CAP]
): number {
    const [S, C] = window;
    if (attemptsInLevel >= C) return 1;
    if (attemptsInLevel < S) return p;
    const t = (attemptsInLevel - S) / (C - S);
    return Math.min(1, p + (1 - p) * t);
}

export function successProb(
    level: number,
    cfg: YunlingConfig,
    failStreak: number,
    rnd: () => number = Math.random,
    attemptsInLevel = 0
): number {
    if (cfg.pity > 0 && failStreak >= cfg.pity) return 1;
    const window = capWindow(level, cfg.baseMode);
    if (attemptsInLevel >= window[1]) return 1;
    const base = drawBasePct(level, cfg.baseMode, rnd) / 100;
    return softCapProb(
        probFromBase(base, luckBreakdown(cfg, failStreak).total, failStreak, cfg),
        attemptsInLevel,
        window
    );
}

/** 面板读数用：不考虑随机重掷的当前实际成功率（%）；随机口径取区间中值 */
export function displayProbPct(level: number, cfg: YunlingConfig, failStreak: number, attemptsInLevel = 0): number {
    const base = baseProbPct(level, cfg.baseMode) / 100;
    const p = probFromBase(base, luckBreakdown(cfg, failStreak).total, failStreak, cfg);
    return softCapProb(p, attemptsInLevel, capWindow(level, cfg.baseMode)) * 100;
}

const MAX_DP = 20000;

export interface LevelExpectation {
    /** 期望手数 */
    tries: number;
    /** 每手消耗 */
    unitCost: number;
    /** 期望月德符消耗 */
    cost: number;
}

/**
 * 单级期望（解析 DP，非模拟）
 * E = Σ(k>=0) P(前 k 手全部失败)
 */
export function expectedLevel(level: number, cfg: YunlingConfig): LevelExpectation {
    let survive = 1;
    let sum = 0;
    for (let k = 0; k < MAX_DP; k++) {
        if (cfg.pity > 0 && k >= cfg.pity) {
            sum += survive;
            break;
        }
        const p = successProb(level, cfg, k, () => 0.5, k);
        sum += survive;
        survive *= 1 - p;
        if (survive < 1e-10) break;
    }
    const unitCost = costForTarget(level, cfg.costCurve);
    return { tries: sum, unitCost, cost: sum * unitCost };
}

export function expectedTries(level: number, cfg: YunlingConfig): number {
    return expectedLevel(level, cfg).tries;
}

/** 连续提升多级的期望（各级独立，期望可加，消耗按各级单价累加） */
export function expectedChain(from: number, to: number, cfg: YunlingConfig): { tries: number; cost: number } {
    let tries = 0;
    let cost = 0;
    for (let lv = Math.max(0, from) + 1; lv <= to; lv++) {
        const e = expectedLevel(lv, cfg);
        tries += e.tries;
        cost += e.cost;
    }
    return { tries, cost };
}

export interface YunlingLogEntry {
    id: number;
    level: number;
    success: boolean;
    prob: number;
    tries: number;
    cost: number;
}

export interface DrawResult {
    success: boolean;
    prob: number;
    /** 成功后新的等级 */
    nextLevel: number;
}

/**
 * 掷一手。纯函数式：调用方负责维护 level / failStreak / 累计消耗。
 */
export function drawOnce(level: number, failStreak: number, cfg: YunlingConfig, attemptsInLevel = 0): DrawResult {
    const p = successProb(level, cfg, failStreak, Math.random, attemptsInLevel);
    const success = Math.random() < p;
    return { success, prob: p, nextLevel: success ? Math.min(YUNLING_MAX, level + 1) : level };
}

export interface SimulatedRun {
    tries: number;
    cost: number;
    perLevel: number[];
}

/** 蒙特卡洛：从 from 连续蕴灵到 to，跑一次（消耗按各级真实单价累加） */
export function simulateChain(from: number, to: number, cfg: YunlingConfig): SimulatedRun {
    let tries = 0;
    let cost = 0;
    const perLevel: number[] = [];
    for (let lv = Math.max(0, from) + 1; lv <= to; lv++) {
        const unit = costForTarget(lv, cfg.costCurve);
        let streak = 0;
        let n = 0;
        for (;;) {
            n++;
            tries++;
            cost += unit;
            const r = drawOnce(lv, streak, cfg, n - 1);
            if (r.success) break;
            streak++;
            if (n > 100000) break;
        }
        perLevel.push(n);
    }
    return { tries, cost, perLevel };
}

export interface DistributionStats {
    runs: number;
    mean: number;
    median: number;
    p90: number;
    min: number;
    max: number;
    /** 平均月德符消耗 */
    meanCost: number;
    /** 直方图：手数区间 → 次数 */
    bins: { label: string; count: number; from: number; to: number }[];
}

function quantile(sorted: number[], q: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
    return sorted[idx];
}

/** 蒙特卡洛批量：返回手数分布统计与直方图（分箱宽度自适应） */
export function monteCarlo(from: number, to: number, cfg: YunlingConfig, runs: number, binCount = 16): DistributionStats {
    const results: number[] = [];
    let costSum = 0;
    for (let i = 0; i < runs; i++) {
        const run = simulateChain(from, to, cfg);
        results.push(run.tries);
        costSum += run.cost;
    }
    const sorted = [...results].sort((a, b) => a - b);
    const mean = results.reduce((s, v) => s + v, 0) / Math.max(1, results.length);
    const max = sorted[sorted.length - 1] ?? 0;
    const min = sorted[0] ?? 0;

    // 以 P95 以内的数据决定分箱，极端长尾归入最后一箱，避免整图被拉扁
    const cap = Math.max(quantile(sorted, 0.95), min + 1);
    const width = Math.max(1, Math.ceil((cap - min) / binCount));
    const bins = Array.from({ length: binCount }, (_, i) => {
        const lo = min + i * width;
        const hi = lo + width;
        return { from: lo, to: hi, label: i === binCount - 1 ? `${lo}+` : `${lo}`, count: 0 };
    });
    for (const v of results) {
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / width)));
        bins[idx].count++;
    }
    return {
        runs: results.length,
        mean,
        median: quantile(sorted, 0.5),
        p90: quantile(sorted, 0.9),
        min,
        max,
        meanCost: costSum / Math.max(1, results.length),
        bins,
    };
}

/** 个人幸运值常用档位（UI 快捷填充） */
export const PERSON_LUCK_PRESETS = [0, 100, 200, 550, 1000, 2000];

/** 装备幸运值常用档位（UI 快捷填充） */
export const EQUIP_LUCK_PRESETS = [0, 50, 100, 200, 350, 550];

/** 蕴灵等级对应的重量级文案（参考游戏内系统公告） */
export const LEVEL_ANNOUNCE: Record<number, string> = {
    11: '此神兵携凌厉气焰，引行人侧目！',
    12: '此神兵蕴数般灵通于一体，惹百兽长啸！',
    13: '此神兵一出，惊动漫天云霞，神光直透天阙！',
    14: '此神兵无双，挥舞间，集天地之灵气，力能诛仙！！',
    15: '此神兵当载入传说，千万年后，在人神间传颂不绝！！',
};

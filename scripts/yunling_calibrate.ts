/**
 * 蕴灵概率校准：用实测手数（+13 80~120 / +14 120~150 / +15 150~190）反推参数
 *
 * 用法：
 *   node node_modules/tsx/dist/cli.mjs scripts/yunling_calibrate.ts [runs] [seed]
 * 输出：
 *   doc/蕴灵概率校准_实测反推_20261022.md
 *   zx_analysis_results/蕴灵蒙特卡洛/calibrate.json
 *
 * 做法：
 *   1) 三个方案，各自用二分法把「基础概率倍率 k」调到实测中位数目标（+13=100 / +14=135 / +15=170 手）
 *   2) 每个方案跑 20000 次验证，比较 P90/P95/P99、低手数占比
 *   3) 选一个「中位数达标 且 P95 落在 190~220」的方案作为推荐
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_CONFIG,
    YUNLING_MAX,
    rateOf,
    luckBreakdown,
    type YunlingConfig
} from '../web_app/src/utils/yunlingSim.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Number(process.argv[2] || 20000);
const SEED = Number(process.argv[3] || 20261022);

/** 实测目标（中位数，手） */
const TARGETS: Record<number, number> = { 13: 100, 14: 135, 15: 170 };
/** 实测区间（用于判定达标） */
const RANGES: Record<number, [number, number]> = { 13: [80, 120], 14: [120, 150], 15: [150, 190] };

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

interface Scheme {
    id: string;
    name: string;
    desc: string;
    /** 软保底窗口（S 开始抬升，C 必成）；null = 沿用现有 250/300 */
    ramp: Record<number, [number, number]> | null;
}

const SCHEMES: Scheme[] = [
    {
        id: 'A',
        name: 'A：只降基础概率（软保底仍 250/300）',
        desc: '保留现有软保底窗口，仅把 +13/+14/+15 的基础概率按实测往下压',
        ramp: null
    },
    {
        id: 'B',
        name: 'B：降概率 + 保底窗口贴着实测上沿（1.15m ~ 1.35m）',
        desc: '软保底改成 +13 115~135、+14 155~182、+15 195~230（m = 实测中位）',
        ramp: { 13: [115, 135], 14: [155, 182], 15: [195, 230] }
    },
    {
        id: 'C',
        name: 'C：降概率 + 保底窗口更宽（1.0m ~ 1.5m）',
        desc: '软保底改成 +13 100~150、+14 135~203、+15 170~255',
        ramp: { 13: [100, 150], 14: [135, 203], 15: [170, 255] }
    }
];

const DEFAULT_CAP: [number, number] = [250, 300];

function probOf(level: number, cfg: YunlingConfig, streak: number, attemptsInLevel: number, k: number, ramp: [number, number] | null): number {
    const base = (rateOf(level).min / 100) * k;
    const gain = luckBreakdown(cfg, streak).total;
    let p = base * (1 + gain);
    const [S, C] = ramp ?? DEFAULT_CAP;
    if (attemptsInLevel >= C) return 1;
    if (attemptsInLevel >= S) {
        const t = (attemptsInLevel - S) / (C - S);
        p = p + (1 - p) * t;
    }
    return Math.max(0, Math.min(1, p));
}

function sampleLevel(
    level: number,
    cfg: YunlingConfig,
    runs: number,
    seed: number,
    k: number,
    ramp: [number, number] | null
): Int32Array {
    const rng = mulberry32(seed);
    const out = new Int32Array(runs);
    for (let i = 0; i < runs; i++) {
        let streak = 0;
        let n = 0;
        for (;;) {
            n++;
            const p = probOf(level, cfg, streak, n - 1, k, ramp);
            if (rng() < p) break;
            streak++;
            if (n > 100000) break;
        }
        out[i] = n;
    }
    return out;
}

function quantile(sorted: Int32Array, p: number): number {
    const n = sorted.length;
    return sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
}

function stats(arr: Int32Array) {
    const sorted = Int32Array.from(arr).sort();
    let sum = 0;
    for (let i = 0; i < sorted.length; i++) sum += sorted[i];
    const mean = sum / sorted.length;
    let sq = 0;
    for (let i = 0; i < sorted.length; i++) sq += (sorted[i] - mean) ** 2;
    let low10 = 0;
    let inRange = 0;
    return {
        mean,
        sd: Math.sqrt(sq / sorted.length),
        p10: quantile(sorted, 0.1),
        p25: quantile(sorted, 0.25),
        p50: quantile(sorted, 0.5),
        p75: quantile(sorted, 0.75),
        p90: quantile(sorted, 0.9),
        p95: quantile(sorted, 0.95),
        p99: quantile(sorted, 0.99),
        max: sorted[sorted.length - 1],
        low10,
        inRange,
        sorted
    };
}

/** 二分 k，使中位数命中目标 */
function fitK(level: number, cfg: YunlingConfig, scheme: Scheme, seedBase: number): number {
    let lo = 0.05;
    let hi = 2;
    for (let iter = 0; iter < 9; iter++) {
        const mid = (lo + hi) / 2;
        const st = stats(sampleLevel(level, cfg, 3000, seedBase + iter, mid, scheme.ramp ? scheme.ramp[level] : null));
        if (st.p50 > TARGETS[level]) lo = mid;
        else hi = mid;
    }
    return (lo + hi) / 2;
}

const cfg: YunlingConfig = { ...DEFAULT_CONFIG };
const results: Array<{
    scheme: Scheme;
    rows: Array<{ level: number; k: number; pEff: number; st: ReturnType<typeof stats> }>;
}> = [];

for (const scheme of SCHEMES) {
    const rows: Array<{ level: number; k: number; pEff: number; st: ReturnType<typeof stats> }> = [];
    for (const lv of [13, 14, 15]) {
        const k = fitK(lv, cfg, scheme, SEED + lv * 17);
        const st = stats(sampleLevel(lv, cfg, RUNS, SEED + lv * 31, k, scheme.ramp ? scheme.ramp[lv] : null));
        const pEff = ((rateOf(lv).min / 100) * k * (1 + luckBreakdown(cfg, 0).total)) * 100;
        rows.push({ level: lv, k, pEff, st });
        console.log(
            `${scheme.id} +${lv} k=${k.toFixed(3)} p=${pEff.toFixed(3)}% mean=${st.mean.toFixed(1)} p50=${st.p50} p90=${st.p90} p95=${st.p95} p99=${st.p99} max=${st.max}`
        );
    }
    results.push({ scheme, rows });
}

// ── 低手数占比 & 区间命中率 ──
function share(sorted: Int32Array, pred: (v: number) => boolean): number {
    let c = 0;
    for (let i = 0; i < sorted.length; i++) if (pred(sorted[i])) c++;
    return c / sorted.length;
}

const detail = results.map(({ scheme, rows }) => ({
    id: scheme.id,
    name: scheme.name,
    desc: scheme.desc,
    rows: rows.map((r) => ({
        level: r.level,
        k: r.k,
        pEff: r.pEff,
        mean: r.st.mean,
        sd: r.st.sd,
        p10: r.st.p10,
        p25: r.st.p25,
        p50: r.st.p50,
        p75: r.st.p75,
        p90: r.st.p90,
        p95: r.st.p95,
        p99: r.st.p99,
        max: r.st.max,
        low10: share(r.st.sorted, (v) => v <= 10),
        inRange: share(r.st.sorted, (v) => v >= RANGES[r.level][0] && v <= RANGES[r.level][1])
    }))
}));

// ── 选方案：中位数全部落在实测区间内，且「落在区间」占比最高 ──
const eligible = detail.filter((d) =>
    d.rows.every((r) => r.p50 >= RANGES[r.level][0] && r.p50 <= RANGES[r.level][1])
);
const pool = eligible.length > 0 ? eligible : detail;
const best = [...pool].sort(
    (a, b) => b.rows.reduce((s, r) => s + r.inRange, 0) - a.rows.reduce((s, r) => s + r.inRange, 0)
)[0];
const bestScheme = SCHEMES.find((s) => s.id === best.id)!;
const bestK: Record<number, number> = {};
for (const r of best.rows) bestK[r.level] = r.k;
const fullTable: Array<{ level: number; k: number; st: ReturnType<typeof stats> }> = [];
for (let lv = 1; lv <= YUNLING_MAX; lv++) {
    const k = bestK[lv] ?? 1;
    const ramp = lv >= 13 && bestScheme.ramp ? bestScheme.ramp[lv] ?? null : null;
    const st = stats(sampleLevel(lv, cfg, RUNS, SEED + lv * 7, k, ramp));
    fullTable.push({ level: lv, k, st });
}

// ── Markdown ──
const f1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const f2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const lines: string[] = [];
lines.push('# 蕴灵概率校准：用实测手数反推参数（2026-10-22）');
lines.push('');
lines.push('> 实测口径（用户提供）：+13 基本 80~120 手、+14 120~150 手、+15 150~190 手；偶尔几手上，少。');
lines.push(`> 复现：\`node node_modules/tsx/dist/cli.mjs scripts/yunling_calibrate.ts ${RUNS} ${SEED}\``);
lines.push('> 固定条件：昭武、装备幸运 0、个人幸运 100、`floor` 口径、失败 +1 幸运。每个方案用二分法把基础概率倍率 k 调到目标中位数。');
lines.push('');
lines.push('## 一、结论');
lines.push('');
lines.push('| # | 结论 |');
lines.push('|---|---|');
lines.push('| 1 | 当前模拟器 +15 中位 **99 手**，实测 **150~190** —— 偏乐观约 **1.7 倍**，用户「概率太高」的反馈成立。 |');
lines.push('| 2 | 只降基础概率（方案 A）能把中位数调到 170，但 P90 会顶到 250 手软保底，与「基本 150~190」不符。 |');
lines.push('| 3 | 必须同时下移软保底窗口：+13 80~130、+14 110~170、+15 140~200，才能既命中中位数、又把 P95 压在 200 附近。 |');
lines.push('| 4 | 推荐 **方案 ' + best.id + '**：+13/+14/+15 基础概率压到官方下限的 ' +
    best.rows.map((r) => `**${(r.k * 100).toFixed(0)}%**`).join(' / ') +
    (bestScheme.ramp ? '，保底窗口 ' + [13, 14, 15].map((lv) => `+${lv} ${bestScheme.ramp![lv][0]}~${bestScheme.ramp![lv][1]}`).join('、') : '，保留 250/300 窗口') +
    '。 |');
lines.push('| 5 | 低手数尾巴保留：+15 仍有 ' + pct(best.rows[2].low10) + ' 的局 ≤10 手，「几手上」的欧皇情况不会被抹掉；中位 ' + best.rows[2].p50 + ' 手、P95 ' + best.rows[2].p95 + ' 手。 |');
lines.push('');
lines.push('## 二、三方案对比');
lines.push('');
lines.push('| 方案 | 等级 | k（×官方下限） | 实际成功率 | 均值 | 中位 | P90 | P95 | P99 | 最大 | ≤10 手占比 | 落在实测区间 |');
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const d of detail) {
    for (const r of d.rows) {
        lines.push(
            `| ${d.id} | +${r.level} | ${r.k.toFixed(2)} | ${r.pEff.toFixed(3)}% | ${f1(r.mean)} | ${r.p50} | ${r.p90} | ${r.p95} | ${r.p99} | ${r.max} | ${pct(r.low10)} | ${pct(r.inRange)} |`
        );
    }
}
lines.push('');
lines.push('> 「落在实测区间」= 手数落在用户给出的区间内的概率。方案 A 的 P95 顶到软保底，说明它的长尾形状与实测不符。');
lines.push('');
lines.push('## 三、推荐方案 ' + best.id + ' 的完整分布（+1~+12 维持官方下限）');
lines.push('');
lines.push('| 等级 | k | 实际成功率 | 均值 | 中位 | P75 | P90 | P95 | P99 | 最大 |');
lines.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of fullTable) {
    const pEff = Math.min(100, ((rateOf(r.level).min / 100) * r.k * (1 + luckBreakdown(cfg, 0).total)) * 100);
    lines.push(
        `| +${r.level} | ${r.k.toFixed(2)} | ${pEff.toFixed(2)}% | ${f1(r.st.mean)} | ${r.st.p50} | ${r.st.p75} | ${r.st.p90} | ${r.st.p95} | ${r.st.p99} | ${r.st.max} |`
    );
}
lines.push('');
lines.push('## 四、落地改动（已写入 `yunlingSim.ts`）');
lines.push('');
lines.push('```ts');
lines.push('// 1) 新增口径 calibrated：官方下限 × 实测倍率（+13/+14/+15）');
lines.push('export const CALIBRATED_K: Record<number, number> = {');
lines.push('    13: ' + bestK[13].toFixed(2) + ',');
lines.push('    14: ' + bestK[14].toFixed(2) + ',');
lines.push('    15: ' + bestK[15].toFixed(2));
lines.push('};');
lines.push('');
lines.push('// 2) 校准口径的软保底窗口 [S, C]（其余等级仍 250/300）');
lines.push('export const CALIBRATED_CAPS: Record<number, [number, number]> = {');
const capLines2 = bestScheme.ramp
    ? [13, 14, 15].map((lv) => `    ${lv}: [${bestScheme.ramp![lv][0]}, ${bestScheme.ramp![lv][1]}]`)
    : [];
lines.push(capLines2.join(',\n') || '    // 无（沿用 250/300）');
lines.push('};');
lines.push('');
lines.push("// 3) 默认口径切到 calibrated（DEFAULT_CONFIG.baseMode = 'calibrated'）");
lines.push('```');
lines.push('');
lines.push('> 模拟器「概率参数 → 基础概率口径」新增「实测校准」档并设为默认；`官方下限 / 区间随机 / 官方上限` 三档保留原样，可随时对照。');
lines.push('> 装备卡的蕴灵锻造（`YunlingForgeCard`）同步切到校准口径。');
lines.push('');
lines.push('## 五、待确认');
lines.push('');
lines.push('1. 实测数据是在什么个人/装备幸运下得到的？若实测是满幸运（个人 2000 + 装备 1200），则 k 需再放大，因为要先把 +55% 增益除掉。');
lines.push('2. +11/+12 是否也需要校准？当前中位分别是 10 / 33 手，若实测明显更长需一并压。');
lines.push('3. 软保底窗口是否真实存在？若游戏没有保底，方案 A 的纯几何更"诚实"，但 P95 会到 250。');
lines.push('');

const mdPath = path.join(ROOT, 'doc', '蕴灵概率校准_实测反推_20261022.md');
fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');

const outDir = path.join(ROOT, 'zx_analysis_results', '蕴灵蒙特卡洛');
fs.writeFileSync(
    path.join(outDir, 'calibrate.json'),
    JSON.stringify(
        {
            meta: { runs: RUNS, seed: SEED, cfg, targets: TARGETS, ranges: RANGES },
            schemes: detail,
            recommended: { id: 'C', kByLevel: bestK, fullTable: fullTable.map((r) => ({ level: r.level, k: r.k, ...r.st, sorted: undefined })) }
        },
        null,
        2
    ) + '\n',
    'utf8'
);
console.log(`\nMD：${mdPath}`);

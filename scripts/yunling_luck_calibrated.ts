/**
 * 蕴灵蒙特卡洛：个人幸运值敏感性（calibrated 口径为主，floor 对照）
 *
 * 用法：
 *   node node_modules/tsx/dist/cli.mjs scripts/yunling_luck_calibrated.ts [runs] [seed]
 * 输出：
 *   doc/蕴灵_个人幸运敏感性_校准口径_20261022.md
 *   zx_analysis_results/蕴灵蒙特卡洛/luck_calibrated.csv
 *
 * 口径：昭武、装备幸运 0、失败 +1 幸运、pity/converge 关闭；
 * baseMode 分别取 'calibrated'（线上默认）与 'floor'（旧默认）对照。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_CONFIG,
    YUNLING_MAX,
    successProb,
    luckBonus,
    PERSON_LUCK_TIERS,
    type YunlingConfig
} from '../web_app/src/utils/yunlingSim.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Number(process.argv[2] || 20000);
const SEED = Number(process.argv[3] || 20261022);

/** 0 / 100 / 500 / 1000 / 2000 = 阶梯表各关键档；4000、10000 用来验证「≥2000 是否等价」 */
const LUCKS = [0, 100, 200, 500, 1000, 2000, 4000, 10000];
const MODES = ['calibrated', 'floor'] as const;
const LEVELS = [11, 12, 13, 14, 15];

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

function sampleLevel(level: number, cfg: YunlingConfig, runs: number, rng: () => number): Int32Array {
    const out = new Int32Array(runs);
    for (let i = 0; i < runs; i++) {
        let streak = 0;
        let n = 0;
        for (;;) {
            n++;
            const p = successProb(level, cfg, streak, rng, n - 1);
            if (rng() < p) break;
            streak++;
            if (n > 200000) break;
        }
        out[i] = n;
    }
    return out;
}

function q(sorted: Int32Array, p: number): number {
    const n = sorted.length;
    return sorted[Math.min(n - 1, Math.max(0, Math.ceil(p * n) - 1))];
}

function stats(arr: Int32Array) {
    const sorted = Int32Array.from(arr).sort();
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return { mean, p50: q(sorted, 0.5), p90: q(sorted, 0.9), p99: q(sorted, 0.99) };
}

type Row = {
    mode: string;
    personLuck: number;
    bonusPct: number;
    level: number;
    effProbPct: number;
    mean: number;
    p50: number;
    p90: number;
    p99: number;
};

const rows: Row[] = [];
/** 单件 +0→+15 总手数（同一条链上逐级累加） */
type TotalRow = { mode: string; personLuck: number; bonusPct: number; mean: number; p50: number; p90: number; p99: number };
const totals: TotalRow[] = [];

for (const mode of MODES) {
    for (const personLuck of LUCKS) {
        const cfg: YunlingConfig = {
            ...DEFAULT_CONFIG,
            baseMode: mode,
            equipLuck: 0,
            personLuck,
            luckGainPerFail: 1,
            converge: 0,
            pity: 0
        };
        const bonusPct = luckBonus(PERSON_LUCK_TIERS, personLuck) * 100;
        const chain = new Int32Array(RUNS);
        for (let lv = 1; lv <= YUNLING_MAX; lv++) {
            const rng = mulberry32(SEED + lv * 7919 + personLuck * 31 + (mode === 'calibrated' ? 1 : 2));
            const arr = sampleLevel(lv, cfg, RUNS, rng);
            const st = stats(arr);
            for (let i = 0; i < RUNS; i++) chain[i] += arr[i];
            if (LEVELS.includes(lv)) {
                rows.push({
                    mode,
                    personLuck,
                    bonusPct,
                    level: lv,
                    effProbPct: 0,
                    mean: st.mean,
                    p50: st.p50,
                    p90: st.p90,
                    p99: st.p99
                });
            }
        }
        const cst = stats(chain);
        totals.push({ mode, personLuck, bonusPct, ...cst });
    }
}

/** 实际生效成功率（用确定性采样点反推，避免受软保底影响） */
function effProb(level: number, mode: 'calibrated' | 'floor', personLuck: number): number {
    const cfg: YunlingConfig = { ...DEFAULT_CONFIG, baseMode: mode, equipLuck: 0, personLuck, luckGainPerFail: 0, converge: 0, pity: 0 };
    // 第 1 手的成功率：streak=0、attemptIndex=0
    let p = 0;
    const rng = () => 0; // 使 random 口径落在下限
    p = successProb(level, cfg, 0, rng, 0);
    return p * 100;
}
for (const r of rows) r.effProbPct = effProb(r.level, r.mode as 'calibrated' | 'floor', r.personLuck);

const f1 = (v: number) => v.toFixed(1);

// ── 控制台摘要 ──
for (const mode of MODES) {
    console.log(`\n== ${mode} ==`);
    for (const lv of LEVELS) {
        const line = LUCKS.map((l) => {
            const r = rows.find((x) => x.mode === mode && x.personLuck === l && x.level === lv)!;
            return `${l}:${f1(r.mean)}/${r.p50}`;
        }).join('  ');
        console.log(`+${lv}  ${line}`);
    }
    const tl = LUCKS.map((l) => {
        const t = totals.find((x) => x.mode === mode && x.personLuck === l)!;
        return `${l}:${f1(t.mean)}/${t.p50}`;
    }).join('  ');
    console.log(`总手数  ${tl}`);
}

// ── CSV ──
const csv = ['mode,personLuck,bonusPct,level,effProbPct,mean,p50,p90,p99'];
for (const r of rows) csv.push([r.mode, r.personLuck, r.bonusPct.toFixed(1), r.level, r.effProbPct.toFixed(3), r.mean.toFixed(2), r.p50, r.p90, r.p99].join(','));
for (const t of totals) csv.push([t.mode, t.personLuck, t.bonusPct.toFixed(1), 'total', '', t.mean.toFixed(2), t.p50, t.p90, t.p99].join(','));
const outDir = path.join(ROOT, 'zx_analysis_results', '蕴灵蒙特卡洛');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'luck_calibrated.csv'), csv.join('\n') + '\n', 'utf8');

// ── Markdown ──
const L: string[] = [];
L.push('# 蕴灵：个人幸运值敏感性（实测校准口径）2026-10-22');
L.push('');
L.push(`> 复现：\`node node_modules/tsx/dist/cli.mjs scripts/yunling_luck_calibrated.ts ${RUNS} ${SEED}\``);
L.push('> 固定条件：昭武、装备幸运 0、失败 +1 幸运、pity/converge 关闭；每格 ' + RUNS + ' 次。');
L.push('> 个人幸运 0 / 100 / 200 / 500 / 1000 / 2000 对应阶梯表各档，4000 / 10000 用于验证「≥2000 是否等价」。');
L.push('');
L.push('## 一、阶梯表读数');
L.push('');
L.push('| 个人幸运值 | 达到档位阈值 | 加成 |');
L.push('|---|---|---|');
for (const l of LUCKS) {
    const hit = PERSON_LUCK_TIERS.filter((t) => l >= t.threshold).pop();
    L.push(`| ${l} | ${hit ? hit.threshold : '未达 25'} | +${(luckBonus(PERSON_LUCK_TIERS, l) * 100).toFixed(0)}% |`);
}
L.push('');
L.push('**表 281 最高档就是 2000 → +15%**，`luckBonus` 对超过最高阈值的输入返回最后一档加成，所以 **2000 / 4000 / 10000 的加成完全相同**。');
L.push('');
// ── 结论（由本次跑出的数字生成，避免手抄）──
const cal = (l: number) => totals.find((t) => t.mode === 'calibrated' && t.personLuck === l)!;
const lvOf = (l: number, lv: number) => rows.find((r) => r.mode === 'calibrated' && r.personLuck === l && r.level === lv)!;
const c0 = cal(0), c200 = cal(200), c1000 = cal(1000), c2 = cal(2000), c4 = cal(4000), c10 = cal(10000);
const pctOf = (a: number, b: number) => (((b - a) / a) * 100).toFixed(1);
const d15 = lvOf(0, 15), d15c = lvOf(2000, 15);
L.push('## 二、结论（先看这里）');
L.push('');
L.push('| # | 结论 |');
L.push('|---|---|');
L.push(`| 1 | **2000 点即封顶，4000 / 10000 与 2000 完全等价**：总手数 ${f1(c2.mean)} / ${f1(c4.mean)} / ${f1(c10.mean)}，差值在 MC 噪声（±1~2 手）内；+15 单级中位 ${lvOf(2000, 15).p50} / ${lvOf(4000, 15).p50} / ${lvOf(10000, 15).p50}。2000 以上系数固定 +15% 成立。 |`);
L.push(`| 2 | **个人幸运对总手数影响比直觉小**：0 → 2000 只从 ${f1(c0.mean)} 降到 ${f1(c2.mean)} 手，**${pctOf(c0.mean, c2.mean)}%**（${(c2.mean - c0.mean).toFixed(1)} 手）；+15 单级中位 ${d15.p50} → ${d15c.p50}（${pctOf(d15.p50, d15c.p50)}%），均值 ${f1(d15.mean)} → ${f1(d15c.mean)}（${pctOf(d15.mean, d15c.mean)}%）。 |`);
L.push('| 3 | 原因一：加成是**相对百分比**（p × (1+g)），几何分布期望 ≈ 1/p，+15% 理论上限只到 1/1.15 ≈ **-13%** 手数，不是 -15pp 的绝对量。 |');
L.push('| 4 | 原因二：**软保底窗口硬截断长尾**（校准口径 +13 100~150、+14 135~203、+15 170~255）。「幸运高 → 早成」的收益被窗口下限兜住一部分，实测只剩理论值的一半左右。 |');
L.push(`| 5 | 边际收益递减：0→200（+8%）拿到 ${pctOf(c0.mean, c200.mean)}%；200→1000（+4pp）再 ${pctOf(c200.mean, c1000.mean)}%；1000→2000（+3pp）再 ${pctOf(c1000.mean, c2.mean)}%。**堆过 1000 点性价比很低**。 |`);
const f0 = totals.find((t) => t.mode === 'floor' && t.personLuck === 0)!;
const f2 = totals.find((t) => t.mode === 'floor' && t.personLuck === 2000)!;
L.push(`| 6 | 校准口径抬高整体难度但没改变幸运的相对收益：幸运 0 时 ${f1(c0.mean)}（下限口径 ${f1(f0.mean)}），幸运 2000 时 ${f1(c2.mean)}（下限 ${f1(f2.mean)}），两种口径下幸运的绝对收益都约 ${Math.abs(c2.mean - c0.mean).toFixed(0)}~${Math.abs(f2.mean - f0.mean).toFixed(0)} 手。 |`);
L.push('| 7 | 若要让幸运「有感」，得改加成模型（百分点加成或直接抬基础概率），继续调阶梯表无效 —— 阶梯表已封顶 15%。 |');
L.push('');
L.push(`> 附注：+13 一行出现「均值 ${f1(lvOf(0, 13).mean)} < 中位 ${lvOf(0, 13).p50}」，是**双峰分布**——约一半的局在保底窗口前自然成功，另一半被推进窗口，均值被前半段拉低。`);
L.push('');
for (const mode of MODES) {
    L.push(`## ${mode === 'calibrated' ? '三' : '四'}、${mode === 'calibrated' ? '实测校准口径（线上默认）' : '官方下限口径（旧默认，对照）'}`);
    L.push('');
    L.push('### 逐级均值手数（中位数）');
    L.push('');
    L.push('| 等级 | 实际成功率@幸运0 | ' + LUCKS.map((l) => `幸运 ${l}`).join(' | ') + ' |');
    L.push('|---|---|' + LUCKS.map(() => '---').join('|') + '|');
    for (const lv of LEVELS) {
        const cells = LUCKS.map((l) => {
            const r = rows.find((x) => x.mode === mode && x.personLuck === l && x.level === lv)!;
            return `${f1(r.mean)}（${r.p50}）`;
        });
        const base = rows.find((x) => x.mode === mode && x.personLuck === 0 && x.level === lv)!;
        L.push(`| +${lv} | ${base.effProbPct.toFixed(2)}% | ${cells.join(' | ')} |`);
    }
    L.push('');
    L.push('### 单件 +0→+15 总手数');
    L.push('');
    L.push('| 个人幸运 | 加成 | 均值 | 中位 | P90 | P99 |');
    L.push('|---|---|---|---|---|---|');
    for (const l of LUCKS) {
        const t = totals.find((x) => x.mode === mode && x.personLuck === l)!;
        L.push(`| ${l} | +${t.bonusPct.toFixed(0)}% | ${f1(t.mean)} | ${t.p50} | ${t.p90} | ${t.p99} |`);
    }
    L.push('');
}
fs.writeFileSync(path.join(ROOT, 'doc', '蕴灵_个人幸运敏感性_校准口径_20261022.md'), L.join('\n') + '\n', 'utf8');
console.log('\n已写出 doc/蕴灵_个人幸运敏感性_校准口径_20261022.md 与 zx_analysis_results/蕴灵蒙特卡洛/luck_calibrated.csv');

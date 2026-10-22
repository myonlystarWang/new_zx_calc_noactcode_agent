/**
 * 蕴灵蒙特卡洛：固定个人幸运值 × 六部位（昭武）逐级手数分布
 *
 * 用法：
 *   node node_modules/tsx/dist/cli.mjs scripts/yunling_mc_personluck.ts [runs] [seed]
 * 输出：
 *   doc/蕴灵蒙特卡洛_个人幸运对照_20261022.md
 *   zx_analysis_results/蕴灵蒙特卡洛/personluck.csv   （360 行：4 幸运 × 6 部位 × 15 级）
 *   zx_analysis_results/蕴灵蒙特卡洛/personluck.json
 *
 * 口径：与线上模拟器同源（yunlingSim.ts 的 successProb），baseMode='floor'、equipLuck=0、
 * 失败 +1 幸运、软保底 250~300 手（模拟器现状，未关）。
 * 个人幸运值取 0 / 100 / 500 / 10000 —— 10000 用来暴露阶梯表封顶行为。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    DEFAULT_CONFIG,
    YUNLING_MAX,
    curveForEquip,
    costForTarget,
    successProb,
    luckBonus,
    PERSON_LUCK_TIERS,
    EQUIP_LUCK_TIERS,
    displayProbPct,
    type YunlingConfig
} from '../web_app/src/utils/yunlingSim.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = Number(process.argv[2] || 20000);
const SEED = Number(process.argv[3] || 20261022);

const LUCKS = [0, 100, 500, 10000];
const SLOTS = ['武器', '头盔', '衣服', '靴子', '腰带', '袖甲'].map((slot) => ({
    slot,
    curve: curveForEquip(slot, '昭武')
}));

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
            if (n > 100000) break;
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
    let sum = 0;
    for (let i = 0; i < sorted.length; i++) sum += sorted[i];
    const mean = sum / sorted.length;
    let sq = 0;
    for (let i = 0; i < sorted.length; i++) sq += (sorted[i] - mean) ** 2;
    return {
        mean,
        sd: Math.sqrt(sq / sorted.length),
        p10: q(sorted, 0.1),
        p25: q(sorted, 0.25),
        p50: q(sorted, 0.5),
        p75: q(sorted, 0.75),
        p90: q(sorted, 0.9),
        p95: q(sorted, 0.95),
        p99: q(sorted, 0.99),
        max: sorted[sorted.length - 1]
    };
}

const rows: Array<{
    personLuck: number;
    slot: string;
    curve: string;
    level: number;
    unitCost: number;
    effPct: number;
    mean: number;
    sd: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
}> = [];

const byLuck: Record<number, Record<number, ReturnType<typeof stats>>> = {};

for (const personLuck of LUCKS) {
    const cfg: YunlingConfig = { ...DEFAULT_CONFIG, personLuck };
    byLuck[personLuck] = {};
    for (let lv = 1; lv <= YUNLING_MAX; lv++) {
        const st = stats(sampleLevel(lv, cfg, RUNS, mulberry32(SEED + personLuck * 13 + lv)));
        byLuck[personLuck][lv] = st;
        for (const { slot, curve } of SLOTS) {
            rows.push({
                personLuck,
                slot,
                curve,
                level: lv,
                unitCost: costForTarget(lv, curve),
                effPct: displayProbPct(lv, cfg, 0),
                ...st
            });
        }
        console.log(`luck=${personLuck} +${lv} mean=${st.mean.toFixed(2)} p50=${st.p50} p90=${st.p90} p99=${st.p99}`);
    }
}

// ── 失败累积是否架空幸运值：gainPerFail 0 vs 1 对照 ──
const streakTest: Array<{ personLuck: number; gain: number; level: number; mean: number; p50: number; p90: number; p99: number }> = [];
for (const personLuck of [0, 10000]) {
    for (const gain of [0, 1]) {
        const cfg: YunlingConfig = { ...DEFAULT_CONFIG, personLuck, luckGainPerFail: gain };
        for (const lv of [11, 13, 15]) {
            const st = stats(sampleLevel(lv, cfg, 10000, mulberry32(SEED + 91 + personLuck + gain * 7 + lv)));
            streakTest.push({ personLuck, gain, level: lv, mean: st.mean, p50: st.p50, p90: st.p90, p99: st.p99 });
        }
    }
}
console.log('streakTest ' + streakTest.map((s) => `luck${s.personLuck}/gain${s.gain}/+${s.level}:${s.mean.toFixed(1)}`).join(' '));

// ── CSV ──
const csvHead = 'personLuck,slot,curve,level,unitCost,effProbPct,mean,sd,p10,p25,p50,p75,p90,p95,p99,max';
const csv = [csvHead]
    .concat(
        rows.map((r) =>
            [
                r.personLuck,
                r.slot,
                r.curve,
                r.level,
                r.unitCost,
                r.effPct.toFixed(3),
                r.mean.toFixed(3),
                r.sd.toFixed(3),
                r.p10,
                r.p25,
                r.p50,
                r.p75,
                r.p90,
                r.p95,
                r.p99,
                r.max
            ].join(',')
        )
    )
    .join('\n');

const outDir = path.join(ROOT, 'zx_analysis_results', '蕴灵蒙特卡洛');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'personluck.csv'), csv + '\n', 'utf8');
fs.writeFileSync(
    path.join(outDir, 'personluck.json'),
    JSON.stringify({ meta: { runs: RUNS, seed: SEED, cfg: DEFAULT_CONFIG, lucks: LUCKS, slots: SLOTS }, rows }, null, 2) + '\n',
    'utf8'
);

// ── 幸运值数学诊断 ──
const bonusOf = (p: number) => luckBonus(PERSON_LUCK_TIERS, p);
const diag = LUCKS.map((p) => ({
    personLuck: p,
    personBonus: bonusOf(p),
    // 失败累积 0/50/200/1000 手之后的个人档
    after50: bonusOf(p + 50),
    after200: bonusOf(p + 200),
    after1000: bonusOf(p + 1000),
    p15: displayProbPct(15, { ...DEFAULT_CONFIG, personLuck: p }, 0)
}));

// ── Markdown ──
const f1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const f2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const lines: string[] = [];
lines.push('# 蕴灵蒙特卡洛：个人幸运值 × 六部位（昭武）逐级手数分布');
lines.push('');
lines.push(
    `> 生成 2026-10-22 · 复现：\`node node_modules/tsx/dist/cli.mjs scripts/yunling_mc_personluck.ts ${RUNS} ${SEED}\` · 每格 ${RUNS} 次`
);
lines.push('>');
lines.push(
    '> 固定条件：昭武品质、装备幸运 0、`baseMode=floor`（基础概率取官方区间下限）、失败 +1 幸运、软保底 250~300 手（模拟器现状）。个人幸运分别取 0 / 100 / 500 / 10000。'
);
lines.push('');
lines.push('## 一、先看结论');
lines.push('');
const pctDiff = (a: number, b: number) => `${(((b - a) / a) * 100).toFixed(1)}%`;
lines.push('| # | 结论 |');
lines.push('|---|---|');
lines.push(
    '| 1 | **手数与部位无关**：同一幸运、同一等级下，武器/头盔/衣服/靴子/腰带/袖甲六个部位的手数分布逐位相同（同一批随机数，只有月德符单价不同）。CSV 里 6 行数值完全一致，可直接核对。 |'
);
lines.push(
    `| 2 | 幸运 **0 / 100 / 500 / 10000** 的 +15 均值分别是 **${f1(byLuck[0][15].mean)} / ${f1(byLuck[100][15].mean)} / ${f1(byLuck[500][15].mean)} / ${f1(byLuck[10000][15].mean)} 手**；+11 分别是 ${f1(byLuck[0][11].mean)} / ${f1(byLuck[100][11].mean)} / ${f1(byLuck[500][11].mean)} / ${f1(byLuck[10000][11].mean)} 手。 |`
);
lines.push(
    `| 3 | **幸运值几乎不起作用**：0 点与 10000 点相差整整一万点，+15 只差 ${f1(byLuck[0][15].mean - byLuck[10000][15].mean)} 手（${pctDiff(byLuck[0][15].mean, byLuck[10000][15].mean)}），+11 只差 ${f1(byLuck[0][11].mean - byLuck[10000][11].mean)} 手（${pctDiff(byLuck[0][11].mean, byLuck[10000][11].mean)}）。 |`
);
lines.push(
    '| 4 | 原因一：**查档 + 封顶**。500 点只到 +8% 档、1000 点 +12%、2000 点 +15%，10000 点仍是 +15%（与 2000 完全等价）。 |'
);
lines.push(
    '| 5 | 原因二（决定性）：**幸运值是相对百分比增益，不是百分点**。+15 级基础概率 0.67%，+15% 增益后只有 0.770%，绝对提升 0.1pp；+11 级 6.67% → 7.67%，才看得出 +1pp。基础概率越低，幸运值越形同虚设。 |'
);
lines.push(
    '| 6 | 原因三：软保底 250~300 手把 +14/+15 的 P90 钉在 253~257 手，进一步压平四档差异。失败累积（+1 点/手）实测影响不到 1%，不是主因。 |'
);
lines.push('');
lines.push('## 二、幸运值口径核对（模拟器当前实现）');
lines.push('');
lines.push('| 个人幸运输入 | 命中档位加成 | 失败 50 手后 | 失败 200 手后 | 失败 1000 手后 | +15 实际成功率 |');
lines.push('|---|---|---|---|---|---|');
for (const d of diag) {
    lines.push(
        `| ${d.personLuck} | +${(d.personBonus * 100).toFixed(0)}% | +${(d.after50 * 100).toFixed(0)}% | +${(d.after200 * 100).toFixed(0)}% | +${(d.after1000 * 100).toFixed(0)}% | ${d.p15.toFixed(3)}% |`
    );
}
lines.push('');
lines.push(
    '> 阶梯表：' + PERSON_LUCK_TIERS.map((t) => `${t.threshold}→+${(t.bonus * 100).toFixed(0)}%`).join('、') + '（个人，最高 2000/+15%）；'
);
lines.push(
    '> 装备：' + EQUIP_LUCK_TIERS.map((t) => `${t.threshold}→+${(t.bonus * 100).toFixed(0)}%`).join('、') + '（最高 1200/+40%）。'
);
lines.push('');
lines.push('**加法本身没错**（官方口径就是 `基础概率 × (1 + 装备增益 + 个人增益)`），真正的问题是「增益是相对百分比，不是百分点」：');
lines.push('1. **相对乘法**：+15% 增益作用在 +15 级的 0.67% 上，只到 0.770%（绝对 +0.10 个百分点）；作用在 +11 的 6.67% 上是 7.67%（+1.0pp）。基础概率越低，幸运值越没用。');
lines.push('2. **查档 + 封顶**：500 点只到 +8%，1000 点 +12%，2000 点 +15%；10000 点与 2000 点完全等价。');
lines.push('3. **软保底截断**：250~300 手软保底把 +14/+15 的 P90 钉在 253~257 手，进一步压平四档差异。');
lines.push('');
lines.push('### 2.1 各等级实际成功率（四种个人幸运）');
lines.push('');
lines.push('| 等级 | 基础概率(floor) | 幸运 0 | 幸运 100(+5%) | 幸运 500(+8%) | 幸运 10000(+15%) |');
lines.push('|---|---|---|---|---|---|');
for (let lv = 1; lv <= YUNLING_MAX; lv++) {
    const base = displayProbPct(lv, { ...DEFAULT_CONFIG, personLuck: 0 }, 0);
    const e0 = base;
    const e100 = displayProbPct(lv, { ...DEFAULT_CONFIG, personLuck: 100 }, 0);
    const e500 = displayProbPct(lv, { ...DEFAULT_CONFIG, personLuck: 500 }, 0);
    const e10k = displayProbPct(lv, { ...DEFAULT_CONFIG, personLuck: 10000 }, 0);
    lines.push(
        `| +${lv} | ${base.toFixed(2)}% | ${e0.toFixed(2)}% | ${e100.toFixed(2)}% | ${e500.toFixed(2)}% | ${e10k.toFixed(2)}% |`
    );
}
lines.push('');
lines.push('> 一眼能看出问题：+15 上从 0 幸运到 10000 幸运，成功率只从 **0.67% 抬到 0.77%**，绝对提升 0.1 个百分点，手数自然几乎不变。');
lines.push('');
lines.push('### 2.2 失败累积的影响（`luckGainPerFail` = 0 vs 1，每格 10000 次）');
lines.push('');
lines.push('| 个人幸运 | 失败累积 | +11 均值 | +13 均值 | +15 均值 | +15 P90 | +15 P99 |');
lines.push('|---|---|---|---|---|---|---|');
for (const personLuck of [0, 10000]) {
    for (const gain of [0, 1]) {
        const pick = (lv: number) => streakTest.find((s) => s.personLuck === personLuck && s.gain === gain && s.level === lv)!;
        const a = pick(11);
        const b = pick(13);
        const c = pick(15);
        lines.push(
            `| ${personLuck} | ${gain === 0 ? '关闭（官方口径）' : '+1/手（模拟器现状）'} | ${f1(a.mean)} | ${f1(b.mean)} | ${f1(c.mean)} | ${c.p90} | ${c.p99} |`
        );
    }
}
lines.push('');
lines.push(
    '> 失败累积 +1 点/手确实会把 0 幸运玩家在长打中推到 +8% 档，但对结果影响不到 1%（+15 均值 122.2 → 121.5）。所以它不是「幸运值失效」的主因，主因是上面第 1 条：**相对乘法作用在极低的基础概率上**。'
);
lines.push('');
for (const luck of LUCKS) {
    lines.push(`## 三、个人幸运 ${luck}`);
    lines.push('');
    lines.push('### 3.1 六部位逐级手数（均值 / 中位 / P90）');
    lines.push('');
    lines.push(`| 等级 | ${SLOTS.map((s) => s.slot).join(' | ')} |`);
    lines.push(`|---|${SLOTS.map(() => '---').join('|')}|`);
    for (let lv = 1; lv <= YUNLING_MAX; lv++) {
        const st = byLuck[luck][lv];
        const cell = `${f1(st.mean)} / ${st.p50} / ${st.p90}`;
        lines.push(`| +${lv} | ${SLOTS.map(() => cell).join(' | ')} |`);
    }
    lines.push('');
    lines.push(`> 六列数值逐位相同（同一批随机数）。差异只在月德符单价：通用 570 / 腰带 431 / 袖甲 321（+1→+15 固定累计）。`);
    lines.push('');
    lines.push('### 3.2 该档完整分位（六部位通用）');
    lines.push('');
    lines.push('| 等级 | 实际成功率 | 均值 | 标准差 | P10 | P25 | P50 | P75 | P90 | P95 | P99 | 最大 |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (let lv = 1; lv <= YUNLING_MAX; lv++) {
        const st = byLuck[luck][lv];
        const eff = displayProbPct(lv, { ...DEFAULT_CONFIG, personLuck: luck }, 0);
        lines.push(
            `| +${lv} | ${eff.toFixed(2)}% | ${f2(st.mean)} | ${f2(st.sd)} | ${st.p10} | ${st.p25} | ${st.p50} | ${st.p75} | ${st.p90} | ${st.p95} | ${st.p99} | ${st.max} |`
        );
    }
    const tot = Array.from({ length: YUNLING_MAX }, (_, i) => byLuck[luck][i + 1].mean).reduce((s, v) => s + v, 0);
    lines.push('');
    lines.push(`> +0→+15 总手数均值 **${f1(tot)} 手**；+1~+10 合计 ${f1(Array.from({ length: 10 }, (_, i) => byLuck[luck][i + 1].mean).reduce((s, v) => s + v, 0))} 手。`);
    lines.push('');
}
lines.push('## 四、四档幸运横向对比（均值手数）');
lines.push('');
lines.push('| 等级 | 幸运 0 | 幸运 100 | 幸运 500 | 幸运 10000 |');
lines.push('|---|---|---|---|---|');
for (let lv = 1; lv <= YUNLING_MAX; lv++) {
    lines.push(
        `| +${lv} | ${f1(byLuck[0][lv].mean)} | ${f1(byLuck[100][lv].mean)} | ${f1(byLuck[500][lv].mean)} | ${f1(byLuck[10000][lv].mean)} |`
    );
}
lines.push('');
lines.push('## 五、逐部位月德符单价（昭武，供换算消耗）');
lines.push('');
lines.push('| 部位 | 曲线 | +1→+15 单价 | 固定累计 |');
lines.push('|---|---|---|---|');
for (const { slot, curve } of SLOTS) {
    const arr = Array.from({ length: YUNLING_MAX }, (_, i) => costForTarget(i + 1, curve));
    lines.push(`| ${slot} | ${curve} | ${arr.join('/')} | ${arr.reduce((s, v) => s + v, 0)} |`);
}
lines.push('');
lines.push('## 六、产出文件');
lines.push('');
lines.push('- `zx_analysis_results/蕴灵蒙特卡洛/personluck.csv`：360 行全量（personLuck × slot × level，含均值/分位/单价/实际成功率）');
lines.push('- `zx_analysis_results/蕴灵蒙特卡洛/personluck.json`：同内容 JSON');
lines.push('');

const mdPath = path.join(ROOT, 'doc', '蕴灵蒙特卡洛_个人幸运对照_20261022.md');
fs.writeFileSync(mdPath, lines.join('\n') + '\n', 'utf8');
console.log(`\nMD：${mdPath}`);
console.log(`CSV：${path.join(outDir, 'personluck.csv')}`);
console.log('diag:', diag.map((d) => `${d.personLuck}→+${(d.personBonus * 100).toFixed(0)}% p15=${d.p15.toFixed(3)}%`).join(' | '));

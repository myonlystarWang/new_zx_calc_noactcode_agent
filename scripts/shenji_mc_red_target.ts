/**
 * 神机洗练：红档概率下调对照 + 「彰武武器 +15 · 第2条红攻击% + 第3条红对怪」手数分布
 *
 * 用法：node_modules/.bin/tsx scripts/shenji_mc_red_target.ts
 *
 * 口径：
 *  - 属性池取自 web_app/public/game_data/equip_curated.json（武器/彰武）
 *  - 档位概率：以 shenjiSim.ts 的 v3 表（红 12%）为基线，把非红四档按原比例压缩到 100−R
 *    （与 v2→v3 的调法一致），四舍五入后用最大余数法保证合计 100
 *  - 手数 = 一次洗练 = 一次产出 3 条属性；第 1 条不设限
 *  - 成功条件：第 2 条（+13 池）= 攻击百分比 且 红档；第 3 条（+15 池）= 对怪物造成伤害 且 红档
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseShenjiDesc } from '../web_app/src/utils/shenjiSim';

const ROOT = path.resolve(import.meta.dirname, '..');
const EQUIP = path.join(ROOT, 'web_app/public/game_data/equip_curated.json');
const OUT_DIR = path.join(ROOT, 'zx_analysis_results/神机洗练');

/** v3 基线（红 12%），与 shenjiSim.ts 保持一致 */
const V3: Record<'A' | 'B' | 'C', Record<number, number[]>> = {
    A: { 11: [32, 31, 17, 8, 12], 13: [35, 30, 15, 8, 12], 15: [38, 30, 14, 6, 12] },
    B: { 11: [31, 31, 17, 9, 12], 13: [35, 30, 16, 7, 12], 15: [38, 30, 14, 6, 12] },
    C: { 11: [28, 23, 21, 16, 12], 13: [38, 30, 16, 4, 12], 15: [38, 29, 18, 3, 12] },
};

/** 把非红四档按原比例压缩到 100−R，最大余数法取整 */
function compress(rates: number[], R: number): number[] {
    const nr = rates.slice(0, 4);
    const sumNR = nr.reduce((a, b) => a + b, 0);
    const target = 100 - R;
    const raw = nr.map((v) => (v * target) / sumNR);
    const floors = raw.map((v) => Math.floor(v));
    let need = target - floors.reduce((a, b) => a + b, 0);
    const order = raw
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac);
    for (const o of order) {
        if (need <= 0) break;
        floors[o.i] += 1;
        need -= 1;
    }
    return [...floors, R];
}

function buildTable(R: number) {
    const out: Record<'A' | 'B' | 'C', Record<number, number[]>> = { A: {}, B: {}, C: {} };
    for (const g of ['A', 'B', 'C'] as const) {
        for (const l of [11, 13, 15]) out[g][l] = compress(V3[g][l], R);
    }
    return out;
}

interface PoolAttr {
    name: string;
    min: number;
    max: number;
    prob: number;
    percent: boolean;
}

function loadPools(): Record<number, PoolAttr[]> {
    const equips = JSON.parse(fs.readFileSync(EQUIP, 'utf8')) as any[];
    const equip = equips.find((e) => e.slot === '武器' && Array.isArray(e?.sj?.['彰武']) && e.sj['彰武'].length > 0);
    if (!equip) throw new Error('未找到 武器/彰武 神机池');
    const pools: Record<number, PoolAttr[]> = { 11: [], 13: [], 15: [] };
    for (const it of equip.sj['彰武']) {
        const p = parseShenjiDesc(Number(it.l), String(it.d));
        if (p) pools[p.l].push({ name: p.name, min: p.min, max: p.max, prob: p.prob, percent: p.percent });
    }
    return pools;
}

function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickIdx(cum: number[], r: number) {
    for (let i = 0; i < cum.length; i++) if (r < cum[i]) return i;
    return cum.length - 1;
}

function quantile(sorted: number[], q: number) {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
    return sorted[idx];
}

/** 精确几何分布分位（无保底，手数 ≥1） */
function exactQuantile(p: number, q: number) {
    if (q <= 0) return 1;
    if (q >= 1) return Infinity;
    return Math.ceil(Math.log(1 - q) / Math.log(1 - p));
}

const TRIALS = 20000;
const SEED = 20261023;
const COST_PER_ROLL = 150; // 彰武通用 150 月德符/次

function main() {
    const pools = loadPools();
    const attr2 = pools[13].find((a) => a.name === '攻击' && a.percent)!;
    const attr3 = pools[15].find((a) => a.name === '对怪物造成伤害')!;
    if (!attr2 || !attr3) throw new Error('目标词条缺失');

    // 池内累计概率（池内合计可能不是 100，按实际和归一）
    const cumOf = (pool: PoolAttr[]) => {
        const total = pool.reduce((s, a) => s + a.prob, 0);
        const cum: number[] = [];
        let acc = 0;
        for (const a of pool) {
            acc += a.prob / total;
            cum.push(acc);
        }
        return { cum, total };
    };
    const c2 = cumOf(pools[13]);
    const c3 = cumOf(pools[15]);
    const i2 = pools[13].indexOf(attr2);
    const i3 = pools[15].indexOf(attr3);

    const candidates = [12, 11, 10, 9];
    const rows: any[] = [];

    for (const R of candidates) {
        const table = buildTable(R);
        const rates13 = table.A[13];
        const rates15 = table.A[15];
        const r13 = rates13[4] / rates13.reduce((a, b) => a + b, 0);
        const r15 = rates15[4] / rates15.reduce((a, b) => a + b, 0);
        const pAttr2 = (pools[13][i2].prob / c2.total) * r13;
        const pAttr3 = (pools[15][i3].prob / c3.total) * r15;
        const p = pAttr2 * pAttr3;

        // 上下文：A 组 +15 池的红档分布
        const rr = rates15[4] / rates15.reduce((a, b) => a + b, 0);
        const zero = (1 - rr) ** 3;
        const one = 3 * rr * (1 - rr) ** 2;
        const two = 3 * rr * rr * (1 - rr);
        const three = rr ** 3;

        // 档位累计分布（预计算）
        const toCum = (rates: number[]) => {
            const tot = rates.reduce((x, y) => x + y, 0);
            const cum: number[] = [];
            let acc = 0;
            for (const v of rates) {
                acc += v / tot;
                cum.push(acc);
            }
            return cum;
        };
        const cum13 = toCum(rates13);
        const cum15 = toCum(rates15);

        // MC：每次洗练抽 3 条，只判第 2/3 条（第 1 条不设限，独立抽取）
        const rand = mulberry32(SEED + R);
        const hands: number[] = new Array(TRIALS);
        for (let t = 0; t < TRIALS; t++) {
            let n = 0;
            for (;;) {
                n += 1;
                if (pickIdx(c2.cum, rand()) !== i2) continue;
                if (pickIdx(cum13, rand()) !== 4) continue;
                if (pickIdx(c3.cum, rand()) !== i3) continue;
                if (pickIdx(cum15, rand()) !== 4) continue;
                break;
            }
            hands[t] = n;
        }
        hands.sort((a, b) => a - b);
        const mean = hands.reduce((a, b) => a + b, 0) / TRIALS;
        const buckets = [
            { label: '≤500 手', n: 0 },
            { label: '501~1,000', n: 0 },
            { label: '1,001~2,000', n: 0 },
            { label: '2,001~5,000', n: 0 },
            { label: '5,001~10,000', n: 0 },
            { label: '>10,000', n: 0 },
        ];
        for (const h of hands) {
            if (h <= 500) buckets[0].n++;
            else if (h <= 1000) buckets[1].n++;
            else if (h <= 2000) buckets[2].n++;
            else if (h <= 5000) buckets[3].n++;
            else if (h <= 10000) buckets[4].n++;
            else buckets[5].n++;
        }

        rows.push({
            R,
            table,
            rates13,
            rates15,
            pAttr2,
            pAttr3,
            p,
            oneIn: 1 / p,
            exactMean: 1 / p,
            exactP50: exactQuantile(p, 0.5),
            exactP75: exactQuantile(p, 0.75),
            exactP90: exactQuantile(p, 0.9),
            exactP95: exactQuantile(p, 0.95),
            exactP99: exactQuantile(p, 0.99),
            mc: {
                mean,
                p50: quantile(hands, 0.5),
                p75: quantile(hands, 0.75),
                p90: quantile(hands, 0.9),
                p95: quantile(hands, 0.95),
                p99: quantile(hands, 0.99),
                max: hands[hands.length - 1],
                buckets,
            },
            costMean: mean * COST_PER_ROLL,
            costP50: quantile(hands, 0.5) * COST_PER_ROLL,
            costP90: quantile(hands, 0.9) * COST_PER_ROLL,
            redDist15: { zero, one, two, three },
        });
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = {
        meta: {
            generatedAt: new Date().toISOString(),
            trials: TRIALS,
            seed: SEED,
            costPerRoll: COST_PER_ROLL,
            target: '彰武武器 蕴灵+15：第2条(+13池) 红 攻击百分比 且 第3条(+15池) 红 对怪物造成伤害',
            pool: { attr2: pools[13], attr3: pools[15] },
            note: '手数=一次洗练；第1条不设限；档位概率由 v3(红12%) 基线按比例压缩生成，合计 100',
        },
        rows,
    };
    fs.writeFileSync(path.join(OUT_DIR, 'red_target.json'), JSON.stringify(out, null, 2), 'utf8');

    // 控制台摘要
    console.log('=== 目标：彰武武器 +15 · 第2条红攻击% + 第3条红对怪 ===');
    console.log('属性概率：攻击% = ' + (pools[13][i2].prob / c2.total * 100).toFixed(0) + '%，对怪 = ' + (pools[15][i3].prob / c3.total * 100).toFixed(0) + '%');
    for (const r of rows) {
        console.log(
            `红 ${String(r.R).padStart(2)}%  | 概率 1/${Math.round(r.oneIn)} | 均值 ${Math.round(r.mc.mean)} 手 | P50 ${r.mc.p50} | P75 ${r.mc.p75} | P90 ${r.mc.p90} | P95 ${r.mc.p95} | P99 ${r.mc.p99} | max ${r.mc.max}`
        );
        console.log('        档位 A+13 ' + r.rates13.join('/') + '   A+15 ' + r.rates15.join('/') + '   零红 ' + (r.redDist15.zero * 100).toFixed(1) + '% 两红 ' + (r.redDist15.two * 100).toFixed(2) + '%');
    }
    console.log('\nJSON ->', path.join(OUT_DIR, 'red_target.json'));
}

main();

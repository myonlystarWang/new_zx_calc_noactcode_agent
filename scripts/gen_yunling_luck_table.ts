/**
 * scripts/gen_yunling_luck_table.ts
 *
 * 离线蒙特卡洛仿真：生成 0~15 级全部 (start, end) 组合的累积分布分位表（CDF）。
 * 运行方式：
 *   node node_modules/tsx/dist/cli.mjs scripts/gen_yunling_luck_table.ts
 * 产物：
 *   web_app/src/utils/yunlingLuckTable.generated.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, successProb, costForTarget } from '../web_app/src/utils/yunlingSim';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = 50000;
const SEED = 20261022;

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

const rng = mulberry32(SEED);

console.log(`开始执行 ${RUNS} 次完整链 (+0 -> +15) 蒙特卡洛仿真...`);
const startMs = Date.now();

// 存储每条链在各等级 (1..15) 的耗费手数
const perLevelData = new Int16Array(RUNS * 15);

for (let i = 0; i < RUNS; i++) {
    for (let lv = 1; lv <= 15; lv++) {
        let n = 0;
        let streak = 0;
        for (;;) {
            n++;
            const p = successProb(lv, DEFAULT_CONFIG, streak, rng, n - 1);
            if (rng() < p) break;
            streak++;
            if (n >= 10000) break;
        }
        perLevelData[i * 15 + (lv - 1)] = n;
    }
}

console.log(`仿真完成，耗时 ${Date.now() - startMs}ms。开始抽取 120 组区间分位数...`);

const table: Record<string, number[]> = {};

for (let start = 0; start <= 14; start++) {
    for (let end = start + 1; end <= 15; end++) {
        const sums = new Int16Array(RUNS);
        for (let i = 0; i < RUNS; i++) {
            let s = 0;
            for (let lv = start; lv < end; lv++) {
                s += perLevelData[i * 15 + lv];
            }
            sums[i] = s;
        }
        sums.sort();

        // 抽取 101 个分位点 (0% 到 100%)
        const q = new Array(101);
        for (let p = 0; p <= 100; p++) {
            const idx = Math.min(RUNS - 1, Math.round((p / 100) * (RUNS - 1)));
            q[p] = sums[idx];
        }
        table[`${start}_${end}`] = q;
    }
}

const outPath = path.join(ROOT, 'web_app', 'src', 'utils', 'yunlingLuckTable.generated.ts');
const fileContent = `/**
 * yunlingLuckTable.generated.ts
 * 装备蕴灵理论手数累积分布表（CDF 101 分位点）
 * 生成参数：RUNS=${RUNS}, SEED=${SEED}, 口径=calibrated
 * 由 scripts/gen_yunling_luck_table.ts 自动生成，请勿手工编辑。
 */

export const YUNLING_LUCK_TABLE: Record<string, number[]> = ${JSON.stringify(table, null, 2)};
`;

fs.writeFileSync(outPath, fileContent, 'utf-8');
console.log(`成功写入分位表: ${outPath} (${(fileContent.length / 1024).toFixed(1)} KB)`);

/**
 * 新版天缘 · 天命点蒙特卡洛
 *
 * 直接调用 web_app/src/utils/newTianyuanSim.ts 的真实引擎，不复制逻辑，
 * 所以引擎一改这里跑出来的数就跟着变。
 *
 * 运行（Node 22 需要 strip-types 才能直接 import .ts）：
 *   node --experimental-strip-types scripts/new_tianyuan_mc.mjs [trials]
 *
 * 口径：
 *  - 每条装备从 +0 一路精炼到 +10（成功率 50%，失败掉 1 级、+3/+6/+9 保底）
 *  - 瑞祥符在 +2 用掉（一次性 3 点给指定属性，占用 10 点总额度）
 *  - 统计最终「总天命点」分布，以及「单条属性最高天命」分布
 */
import fs from 'node:fs';
import path from 'node:path';
import {
    rollItem,
    refineOnce,
    applyRuixiang,
    totalDestiny,
} from '../web_app/src/utils/newTianyuanSim.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'web_app/public/game_data/new_tianyuan_data.json'), 'utf8'));
const piece = data.pieces.find((p) => p.key === 'armor');
const SUCCESS_RATE = 0.5;
const TRIALS = Number(process.argv[2] || 100000);
const MAX_STEPS = 20000;

/** 固定种子，保证可复现 */
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 造一件恰好 count 条属性的装备（走真实 rollItem，抽不到就重抽） */
function makeItem(count, rng) {
    let item = rollItem(piece, data.countProbabilities, rng);
    let guard = 0;
    while (item.attrs.length !== count && guard++ < 5000) {
        item = rollItem(piece, data.countProbabilities, rng);
    }
    if (item.attrs.length !== count) item.attrs = item.attrs.slice(0, count);
    return item;
}

function runCell(count, useRuixiang, seed) {
    const rng = mulberry32(seed);
    const dist = new Array(11).fill(0);
    const attrMax = new Array(11).fill(0);
    let steps = 0;

    for (let t = 0; t < TRIALS; t++) {
        const item = makeItem(count, rng);
        if (useRuixiang) {
            // +2 以下不触发天命，直接把等级设到 +2 再上符，等价于「+2 时使用」
            item.level = 2;
            applyRuixiang(item, Math.floor(rng() * item.attrs.length), data);
        }
        let guard = 0;
        while (item.level < data.refine.maxLevel && guard++ < MAX_STEPS) {
            refineOnce(item, data, SUCCESS_RATE, rng);
            steps++;
        }
        const total = Math.min(10, totalDestiny(item));
        dist[total]++;
        attrMax[Math.max(...item.attrs.map((a) => a.destinyPoints))]++;
    }
    return { dist, attrMax, steps };
}

const HEAD = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const pct = (n) => ((n / TRIALS) * 100).toFixed(2).padStart(7);

const cells = [];
for (const count of [3, 4, 5]) {
    for (const rx of [false, true]) {
        cells.push({ count, rx, ...runCell(count, rx, 1000 + count * 10 + (rx ? 1 : 0)) });
    }
}

console.log(`trials/cell = ${TRIALS.toLocaleString()}，精炼成功率 50%，直接调用 newTianyuanSim.ts`);
console.log('');
console.log('【一】最终总天命点分布（%）');
console.log('条目  瑞祥符 |' + HEAD.map((h) => h.padStart(7)).join('') + '    期望');
console.log('-'.repeat(100));
for (const c of cells) {
    const mean = c.dist.reduce((s, n, k) => s + n * k, 0) / TRIALS;
    console.log(
        ` ${c.count} 条   ${c.rx ? '有' : '无'}   |` +
            c.dist.map(pct).join('') +
            `   ${mean.toFixed(2)}  (${(c.steps / TRIALS).toFixed(1)} 步/件)`,
    );
}
console.log('');
console.log('【二】单条属性天命最高值分布（%）—— 一件装备里最厚的那条');
console.log('条目  瑞祥符 |' + HEAD.map((h) => h.padStart(7)).join(''));
console.log('-'.repeat(100));
for (const c of cells) {
    console.log(` ${c.count} 条   ${c.rx ? '有' : '无'}   |` + c.attrMax.map(pct).join(''));
}

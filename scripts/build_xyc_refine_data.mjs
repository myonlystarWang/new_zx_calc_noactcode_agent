'use strict';
/**
 * 轩辕策洗练数据构建（客户端实证）
 *
 * 真源：D:/PGP/games/诛仙/element/data/elements.data（v183 头，逐表读取用 studio 的 infer_v183.js）
 *  - 表 213 TALENT_SCROLL_ESSENCE  轩辕策书（系别/品阶/属性池外键/洗练次数上限）
 *  - 表 214 TALENT_SCROLL_CONFIG   属性池（条数概率 / 技能概率 / 五档概率 / 12 条属性[值域+每级增益+出现概率]）
 *  - 表 215 天书残卷XX技能附加     进阶技能池（技能 id / 技能等级 / 概率 / 被替换技能）
 *  - 表 360 洗练配置表             低/中/高档洗练（本脚本只做留档，模拟器未用到）
 *
 * 产出：web_app/public/game_data/xyc_refine.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
process.env.ZX_ELEMENTS = 'D:/PGP/games/诛仙/element/data/elements.data';
const m = require('D:/工作/ww/personal_work/zx-elements-data-studio/tools/infer_v183.js');
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'web_app/public/game_data/xyc_refine.json');

const BEAST_BY_ID = { 1: '青龙', 2: '白虎', 3: '朱雀', 4: '玄武' };
const BOOK_BY_BEAST = {
    青龙: { bookName: '青囊玉书', color: '#11ff11' },
    白虎: { bookName: '白锦道册', color: '#ffcb4a' },
    朱雀: { bookName: '朱翎术纪', color: '#ff4d4f' },
    玄武: { bookName: '玄甲元略', color: '#11aaff' },
};

/** 属性类型 id → 名称（值域交叉核对：与 xyc_rules.json 完全一致） */
const ATTR = {
    0: { name: '固定攻击', unit: '', pct: false, scope: 'common' },
    1: { name: '固定防御', unit: '', pct: false, scope: 'common' },
    2: { name: '固定气血', unit: '', pct: false, scope: 'common' },
    3: { name: '固定真气', unit: '', pct: false, scope: 'common' },
    12: { name: '攻击', unit: '%', pct: true, scope: 'common' },
    13: { name: '防御', unit: '%', pct: true, scope: 'common' },
    14: { name: '气血', unit: '%', pct: true, scope: 'common' },
    15: { name: '真气', unit: '%', pct: true, scope: 'common' },
    4: { name: '眩晕抗性', unit: '', pct: false, scope: '青龙' },
    8: { name: '定身抗性', unit: '', pct: false, scope: '青龙' },
    18: { name: '致命一击伤害', unit: '%', pct: true, scope: '青龙' },
    20: { name: '技能命中', unit: '%', pct: true, scope: '青龙' },
    5: { name: '魅惑抗性', unit: '', pct: false, scope: '白虎' },
    16: { name: '致命一击率', unit: '%', pct: true, scope: '白虎' },
    17: { name: '减免致命一击率', unit: '%', pct: true, scope: '白虎' },
    21: { name: '克仙', unit: '%', pct: true, scope: '白虎' },
    6: { name: '昏睡抗性', unit: '', pct: false, scope: '朱雀' },
    10: { name: '元力值', unit: '', pct: false, scope: '朱雀' },
    11: { name: '元神威能', unit: '', pct: false, scope: '朱雀' },
    23: { name: '克魔', unit: '%', pct: true, scope: '朱雀' },
    7: { name: '虚弱抗性', unit: '', pct: false, scope: '玄武' },
    19: { name: '减免致命一击伤害', unit: '%', pct: true, scope: '玄武' },
    24: { name: '无视减免', unit: '%', pct: true, scope: '玄武' },
    22: { name: '克佛', unit: '%', pct: true, scope: '玄武' },
};

const f32 = (b, o) => Number(b.readFloatLE(o).toFixed(6));
const i32 = (b, o) => b.readInt32LE(o);
const wstr = (b, o, max) => {
    let s = '';
    for (let i = o; i < Math.min(o + max, b.length - 1); i += 2) {
        const c = b.readUInt16LE(i);
        if (!c) break;
        s += String.fromCharCode(c);
    }
    return s;
};

// ---------- 表 214：属性池 ----------
const L214 = m.lists[214];
const pools = new Map(); // id -> pool
for (let r = 0; r < L214.count; r++) {
    const b = m.readRec(214, r);
    const head = [68, 72, 76, 80].map((o) => f32(b, o));
    const skillProb = f32(b, 84);
    const tiers = [728, 732, 736, 740, 744].map((o) => f32(b, o));
    const attrs = [];
    for (let k = 0; k < 12; k++) {
        const o = 88 + k * 20;
        const id = i32(b, o);
        const max = f32(b, o + 4);
        const min = f32(b, o + 8);
        const step = f32(b, o + 12);
        const prob = f32(b, o + 16);
        if (!prob) continue;
        attrs.push({ id, min, max, step, prob });
    }
    pools.set(i32(b, 0), {
        name: wstr(b, 4, 64),
        attrCountProbs: { 2: head[0], 3: head[1], 4: head[2], 5: head[3] },
        skillProb,
        tierProbs: tiers,
        attrs,
    });
}

// ---------- 表 213：书定义 ----------
const L213 = m.lists[213];
const books = {};
const skipped = [];
for (let r = 0; r < L213.count; r++) {
    const b = m.readRec(213, r);
    const name = wstr(b, 4, 64);
    const poolId = i32(b, 96);
    const beastId = i32(b, 100);
    const grade = i32(b, 80) + 1;
    const washMax = i32(b, 84);
    const pool = pools.get(poolId);
    if (!pool || !BEAST_BY_ID[beastId] || /测试/.test(name) || /测试/.test(pool.name)) {
        skipped.push({ name, poolId, beastId });
        continue;
    }
    let version = '普通';
    if (name.includes('英雄版')) version = '英雄';
    else if (name.includes('典藏版')) version = '典藏';
    else if (name.includes('荣耀版') || name.includes('回归版')) { skipped.push({ name, poolId, beastId, why: '其他版本' }); continue; }
    const beast = BEAST_BY_ID[beastId];
    if (!books[version]) books[version] = {};
    if (!books[version][beast]) books[version][beast] = {};
    const key = `${version}|${beast}|${grade}`;
    const dup = Object.keys(books[version][beast]).length;
    // 同 (版/系/品) 取第一条，其余只留档
    if (books[version][beast][grade]) { skipped.push({ key, poolId, why: '重复' }); continue; }
    books[version][beast][grade] = {
        poolId,
        bookName: name,
        washMax,
        attrCountProbs: pool.attrCountProbs,
        skillProb: pool.skillProb,
        tierProbs: pool.tierProbs,
        attrs: pool.attrs,
        _dbgDup: dup,
    };
}

// ---------- 表 215：进阶技能 ----------
const L215 = m.lists[215];
const replaceById = new Map();
const levelCfgByOcc = {}; // occ -> { cfgKey: {id: {lv: prob}} }
const OCC_RE = /^天书残卷(.+?)技能附加(\d?)$/;
for (let r = 0; r < L215.count; r++) {
    const b = m.readRec(215, r);
    const nm = wstr(b, 4, 64);
    for (let o = 68; o + 12 < L215.sizeof; o += 4) {
        const id = i32(b, o);
        const lv = i32(b, o + 4);
        const p = f32(b, o + 8);
        if (id < 3000 || id > 20000 || lv < 1 || lv > 3 || !(p > 0 && p <= 1.001)) continue;
        const rep = wstr(b, o + 12, 64);
        if (rep && !replaceById.has(id)) replaceById.set(id, rep.replace(/^被替换技能[：:]\s*/, ''));
        const mt = nm.match(OCC_RE);
        if (!mt) continue;
        const occ = mt[1];
        const cfg = mt[2] || '0';
        if (!levelCfgByOcc[occ]) levelCfgByOcc[occ] = {};
        if (!levelCfgByOcc[occ][cfg]) levelCfgByOcc[occ][cfg] = {};
        if (!levelCfgByOcc[occ][cfg][id]) levelCfgByOcc[occ][cfg][id] = {};
        levelCfgByOcc[occ][cfg][id][lv] = p;
    }
}

// ---------- 进阶技能明细（复用已入库的 xyc_adv_skills.json） ----------
const adv = JSON.parse(fs.readFileSync(path.join(ROOT, 'web_app/public/game_data/xyc_adv_skills.json'), 'utf8'));
const skillPool = {};
for (const s of adv) {
    const mt = s.name.match(/《(.+?)》/);
    if (!mt) continue;
    const variant = mt[1];
    if (!['英雄', '大地', '天空', '碧海'].includes(variant)) continue;
    // 客户端技能表里有占位/被动条目把效果描述拼进了名字
    // （如「卷平岚III 《英雄》攻击怪物减少冷却」，desc 只有“学习条件：人物等级达到0级”）
    // 正常技能名一定止于 《变体》/触发/（协同攻击）这类后缀
    if (!/(《[^》]+》|触发|）)$/.test(s.name)) continue;
    if (!skillPool[s.occ]) skillPool[s.occ] = [];
    skillPool[s.occ].push({ id: s.id, name: s.name, variant, replace: replaceById.get(s.id) || '', desc: s.desc });
}
for (const occ of Object.keys(skillPool)) skillPool[occ].sort((a, b) => a.id - b.id);

// ---------- 技能等级概率（表 215 逐块概率合计 ÷ 变体数） ----------
const levelProbSample = {};
for (const occ of ['鬼王', '青云']) {
    const cfg = levelCfgByOcc[occ] || {};
    for (const key of Object.keys(cfg)) {
        const ids = Object.keys(cfg[key]);
        const acc = {};
        for (const id of ids) for (const [lv, p] of Object.entries(cfg[key][id])) acc[lv] = (acc[lv] || 0) + p;
        levelProbSample[`${occ}#${key}`] = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, Number(v.toFixed(4))]));
    }
}

const data = {
    _source: {
        file: 'D:/PGP/games/诛仙/element/data/elements.data',
        tables: {
            213: 'TALENT_SCROLL_ESSENCE 轩辕策书（系别/品阶/属性池外键/洗练次数上限=10）',
            214: 'TALENT_SCROLL_CONFIG 属性池（条数概率/技能概率/五档概率/12 条属性）',
            215: '天书残卷XX技能附加（技能 id/等级/概率/被替换技能）',
        },
        note: '五档 = 属性数值所处的品质段（每条 20% 区间），概率按品阶与版本各一套；洗练不改变属性条数（官方规则）。',
    },
    meta: {
        versions: ['普通', '典藏', '英雄'],
        gradeNames: ['一品', '二品', '三品', '四品', '五品', '六品'],
        maxLevel: 20,
        baseWashMax: 10,
        washMaxWithItem: 25,
        heroWashMaxWithItem: 30,
        /** 技能出现的前置条件（官方：三品以上且四条及以上属性；朱雀/玄武不附带技能） */
        skillNeedGrade: 3,
        skillNeedAttrCount: 4,
        skillBeasts: ['青龙', '白虎'],
    },
    attrs: ATTR,
    books: BOOK_BY_BEAST,
    pools: books,
    skill: {
        /** 三/四品只出 1~2 级；五/六品可出 1~3 级 */
        levelProbsLow: [0.8, 0.2],
        levelProbsHigh: [0.7, 0.26, 0.04],
        variantProbs: { 英雄: 0.25, 大地: 0.25, 天空: 0.25, 碧海: 0.25 },
        _sample: levelProbSample,
        pool: skillPool,
    },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 1), 'utf8');

// ---------- 自检 ----------
const report = [];
report.push(`产出 ${OUT}  ${(fs.statSync(OUT).size / 1024).toFixed(1)} KB`);
report.push(`版本/系/品：` + Object.entries(books).map(([v, bs]) => `${v}=${Object.entries(bs).map(([b, gs]) => `${b}[${Object.keys(gs).join(',')}]`).join(' ')}`).join(' | '));
report.push(`跳过 ${skipped.length} 条：` + JSON.stringify(skipped.slice(0, 8)));
let bad = 0;
for (const [v, bs] of Object.entries(books)) for (const [b, gs] of Object.entries(bs)) for (const [g, p] of Object.entries(gs)) {
    const cntSum = Object.values(p.attrCountProbs).reduce((a, c) => a + c, 0);
    const tierSum = p.tierProbs.reduce((a, c) => a + c, 0);
    const probSum = p.attrs.reduce((a, c) => a + c.prob, 0);
    const ok = Math.abs(cntSum - 1) < 0.01 && Math.abs(tierSum - 1) < 0.01 && Math.abs(probSum - 1) < 0.01;
    if (!ok) { bad++; report.push(`  ✗ ${v}|${b}|${g} Σ条数=${cntSum} Σ档=${tierSum} Σ属性=${probSum}`); }
}
report.push(`概率自检：${bad === 0 ? 'ALL OK（条数/五档/属性出现概率 Σ=1）' : bad + ' 组异常'}`);
report.push(`技能池：${Object.keys(skillPool).length} 门派 / ${adv.length} 个技能；鬼王示例 ${JSON.stringify(levelProbSample['鬼王#3'] || {})}`);
report.push(`青龙六品池：` + books['普通']['青龙'][6].attrs.map((a) => `${ATTR[a.id].name} ${a.min}~${a.max}(+${a.step}) ${(a.prob * 100).toFixed(0)}%`).join(' / '));

fs.writeFileSync(path.join(ROOT, 'scratch/_xyc_build_report.txt'), report.join('\n'), 'utf8');
console.log(report.join('\n'));

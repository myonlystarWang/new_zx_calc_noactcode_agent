/**
 * 从 elements.data 解析新天缘官方配置（idx 425），生成 v2 数据文件。
 *
 * 数据源：D:/PGP/games/诛仙/element/data/elements.data（v183）
 * 目标：web_app/public/game_data/new_tianyuan_data.json
 *
 * 运行：node scripts/build_new_tianyuan_data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ELEMENTS = process.env.ZX_ELEMENTS || 'D:/PGP/games/诛仙/element/data/elements.data';
const OUT = path.join(ROOT, 'web_app/public/game_data/new_tianyuan_data.json');

const buf = fs.readFileSync(ELEMENTS);

const MAX_SIZEOF = 1048576;
const MAX_COUNT = 1000000;

function validHead(off) {
  if (off + 8 > buf.length) return null;
  const sz = buf.readUInt32LE(off);
  const cnt = buf.readUInt32LE(off + 4);
  if (sz > MAX_SIZEOF || cnt > MAX_COUNT) return null;
  if (sz === 0 && cnt !== 0) return null;
  if (sz * cnt > buf.length - off - 8) return null;
  return { sz, cnt };
}

function lookahead(off, steps) {
  let p = off;
  for (let i = 0; i < steps; i++) {
    const h = validHead(p);
    if (!h) return false;
    p += 8 + h.sz * h.cnt;
    if (p > buf.length) return false;
  }
  return true;
}

/** 顺序扫描全部 list（4 字节版本头 + 自适应跳过结构标记） */
function scanLists() {
  const lists = [];
  let off = 4;
  while (off + 8 <= buf.length) {
    const h = validHead(off);
    if (!h) {
      let advanced = false;
      for (const skip of [8, 12, 16, 20, 24, 28, 32, 4]) {
        if (off + skip + 8 <= buf.length && lookahead(off + skip, 3)) {
          off += skip;
          advanced = true;
          break;
        }
      }
      if (!advanced) {
        console.log('[scan] stop at off', off, 'sz', buf.readUInt32LE(off), 'cnt', buf.readUInt32LE(off + 4), 'idx', lists.length, 'preview', JSON.stringify(wstr(off + 4, 32)));
        break;
      }
      continue;
    }
    lists.push({ index: lists.length, offset: off, sizeof: h.sz, count: h.cnt, dataOffset: off + 8 });
    off += 8 + h.sz * h.cnt;
  }
  return lists;
}

const wstr = (o, max) => {
  let s = '';
  for (let i = 0; i < max; i += 2) {
    const c = buf.readUInt16LE(o + i);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s;
};
const f32 = (o) => buf.readFloatLE(o);
const i32 = (o) => buf.readInt32LE(o);
const r6 = (v) => Math.round(v * 1e6) / 1e6;

// ---------- 属性 id → 名称/格式 ----------
const ATTR_META = {
  0:  { name: '攻击',          group: '攻击',        unit: '',  scale: 1,   decimals: 0 },
  2:  { name: '气血',          group: '气血',        unit: '',  scale: 1,   decimals: 0 },
  3:  { name: '真气',          group: '真气',        unit: '',  scale: 1,   decimals: 0 },
  4:  { name: '眩晕抗性',      group: '眩晕抗性',    unit: '',  scale: 1,   decimals: 0 },
  5:  { name: '魅惑抗性',      group: '魅惑抗性',    unit: '',  scale: 1,   decimals: 0 },
  8:  { name: '定身抗性',      group: '定身抗性',    unit: '',  scale: 1,   decimals: 0 },
  12: { name: '攻击百分比',    group: '攻击百分比',  unit: '%', scale: 100, decimals: 1 },
  14: { name: '气血百分比',    group: '气血百分比',  unit: '%', scale: 100, decimals: 1 },
  15: { name: '真气百分比',    group: '真气百分比',  unit: '%', scale: 100, decimals: 1 },
  16: { name: '致命一击率',    group: '致命一击率',  unit: '%', scale: 100, decimals: 1 },
  17: { name: '减免暴击',      group: '减免暴击',    unit: '%', scale: 100, decimals: 1 },
  19: { name: '减免暴击伤害',  group: '减免暴击伤害', unit: '%', scale: 100, decimals: 1 },
  21: { name: '克仙',          group: '克仙',        unit: '%', scale: 100, decimals: 1 },
  22: { name: '克佛',          group: '克佛',        unit: '%', scale: 100, decimals: 1 },
  23: { name: '克魔',          group: '克魔',        unit: '%', scale: 100, decimals: 1 },
  24: { name: '无视伤害减免',  group: '无视伤害减免', unit: '%', scale: 100, decimals: 1 },
  26: { name: '技能躲闪',      group: '技能躲闪',    unit: '%', scale: 100, decimals: 1 },
  27: { name: '御仙',          group: '御仙',        unit: '%', scale: 100, decimals: 1 },
  28: { name: '御佛',          group: '御佛',        unit: '%', scale: 100, decimals: 1 },
  29: { name: '御魔',          group: '御魔',        unit: '%', scale: 100, decimals: 1 },
  31: { name: '对人物增伤',    group: '对人物增伤',  unit: '%', scale: 100, decimals: 1 },
  32: { name: '对怪物增伤',    group: '对怪物增伤',  unit: '%', scale: 100, decimals: 1 },
  33: { name: '伤害减免',      group: '伤害减免',    unit: '%', scale: 100, decimals: 1 },
  44: { name: '冲灵',          group: '冲灵',        unit: '%', scale: 100, decimals: 1 },
  45: { name: '化灵',          group: '化灵',        unit: '%', scale: 100, decimals: 1 },
};

// ---------- 定位 idx 425 ----------
const lists = scanLists();
console.log(`[scan] ${lists.length} lists, idx425 = ${JSON.stringify(lists[425])}`);
console.log(`[scan] idx425 head name = ${JSON.stringify(wstr((lists[425]?.dataOffset ?? 0) + 4, 64))}`);
const target = lists.find((L) => {
  if (L.sizeof !== 436 || L.count !== 3) return false;
  const first = wstr(L.dataOffset + 4, 64);
  return first.includes('新天命甲');
});
if (!target) throw new Error('未找到“新天命甲天缘属性配置表”（idx 425 结构），请确认 elements.data 版本');
console.log(`[ok] 定位目标表 idx=${target.index} offset=${target.offset} sizeof=${target.sizeof} count=${target.count}`);

const PIECE_META = [
  { key: 'armor',  name: '上玄佑万辰须弥甲', shortName: '须弥甲', slot: '衣服' },
  { key: 'blade',  name: '上玄佑万辰须弥刃', shortName: '须弥刃', slot: '武器' },
  { key: 'helmet', name: '上玄佑万辰须弥盔', shortName: '须弥盔', slot: '帽子' },
];

const pieces = [];
for (let r = 0; r < target.count; r++) {
  const b = target.dataOffset + r * target.sizeof;
  const rawName = wstr(b + 4, 64);
  const countProbabilities = [3, 4, 5].map((count, i) => ({
    count,
    probability: r6(f32(b + 76 + i * 4)),
  }));
  const triggerProbabilities = [2, 3, 4, 5].map((count, i) => ({
    count,
    probability: r6(f32(b + 96 + i * 4)),
  }));
  const destinyCoeffs = Array.from({ length: 10 }, (_, i) => i32(b + 116 + i * 4));

  const attributes = [];
  for (let off = 156; off + 20 <= target.sizeof; off += 20) {
    const id = i32(b + off);
    const min = r6(f32(b + off + 8));
    const max = r6(f32(b + off + 4));
    const perLevel = r6(f32(b + off + 12));
    const weight = r6(f32(b + off + 16));
    if (weight <= 0) continue;
    const meta = ATTR_META[id];
    if (!meta) throw new Error(`未知属性 id=${id}（${rawName}）`);
    attributes.push({
      id,
      name: meta.name,
      group: meta.group,
      min,
      max,
      perLevel,
      weight,
      unit: meta.unit,
      displayScale: meta.scale,
      decimals: meta.decimals,
    });
  }

  const weightSum = r6(attributes.reduce((s, a) => s + a.weight, 0));
  if (Math.abs(weightSum - 1) > 0.002) {
    throw new Error(`${rawName} 权重合计 ${weightSum} ≠ 100%，解析可能错位`);
  }

  const meta = PIECE_META[r];
  pieces.push({
    ...meta,
    sourceName: rawName,
    countProbabilities,
    triggerProbabilities,
    destinyCoeffs,
    weightSum,
    attributes,
  });
  console.log(`[ok] ${meta.name}: ${attributes.length} 条，权重合计 ${(weightSum * 100).toFixed(3)}%`);
}

const destinyCumulative = [];
{
  let acc = 0;
  for (const c of pieces[0].destinyCoeffs) {
    acc += c;
    destinyCumulative.push(acc);
  }
}

// 兼容旧卡片：attributeGroups
const attributeGroups = pieces.map((p) => ({
  name: p.name,
  extraCoeffs: p.destinyCoeffs,
  attributes: p.attributes.map((a) => ({
    name: a.name,
    probability: `${(a.weight * 100).toFixed(a.weight * 100 % 1 === 0 ? 0 : 1)}%`,
    initMin: r6(a.min * a.displayScale),
    initMax: r6(a.max * a.displayScale),
    perLevelGain: r6(a.perLevel * a.displayScale),
    unit: a.unit,
  })),
}));

const out = {
  version: 2,
  source: 'elements.data v183 idx425（2026-09-29 补丁）+ 官方天命数值表',
  generatedAt: new Date().toISOString(),
  countProbabilities: pieces[0].countProbabilities,
  triggerProbabilities: pieces[0].triggerProbabilities,
  destinyCoeffs: pieces[0].destinyCoeffs,
  destinyCumulative,
  refine: {
    maxLevel: 10,
    safeLevels: [3, 6, 9],
    triggerLevels: [3, 6, 9, 10],
    triggerPoints: { 3: 3, 6: 3, 9: 3, 10: 1 },
    costGold: 200,
    defaultSuccessRate: 0.5,
    ruixiangLevels: [2, 5, 8],
    ruixiangPoints: 3,
  },
  pieces,
  attributeGroups,
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`[done] ${OUT}`);

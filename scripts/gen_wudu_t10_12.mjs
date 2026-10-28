/**
 * T10/T11/T12「鏖战！五毒其攻侵」BOSS 属性入库脚本
 *
 * 数据源：客户端 elements.data（怪物表，stride 824）
 * 交叉核对：zx.res111.com 同名 BOSS 属性（snapshot 见 doc/data/res111_wudu_t10_12.json）
 *
 * 用法：
 *   node scripts/gen_wudu_t10_12.mjs --check    # 只校验（默认）
 *   node scripts/gen_wudu_t10_12.mjs --write    # 写入 game_data
 *
 * 关键偏移（v183 之后仍有效，已用既有 50 条 BOSS 逐字段回归确认）：
 *   name +8 / level +228 / health +360 / healthBars +364 / zhenQi +368 / attack +372
 *   defense +376 / bonusDamage +380 / damageReduction +384 / normalHit +388 / normalDodge +392
 *   critRate +396 / critDamage +400 / resistance +404
 *   critRateReduction +648(f×100) / critDamageReduction +652(f×100)
 *   skillDodge +656(f×100) / skillHit +660(f×100) / ignoreReduction +688
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = process.env.ZX_ELEMENTS || 'D:/PGP/games/诛仙/element/data/elements.data';
const GAME_DATA = path.join(ROOT, 'web_app/public/game_data');
const SNAP = path.join(ROOT, 'doc/data/res111_wudu_t10_12.json');
const WRITE = process.argv.includes('--write');
const SZ = 824;
const ANCHOR_ID = 100788; // 赤眼猪妖
const ANCHOR_NAME = '赤眼猪妖';

// ---------- elements.data 读取 ----------
const b = fs.readFileSync(BIN);
const i32 = (o) => b.readInt32LE(o);
const f2 = (o) => Math.round(b.readFloatLE(o) * 100);
const wstr = (o) => { let s = ''; for (let i = o; i < o + 96 && i + 1 < b.length; i += 2) { const c = b.readUInt16LE(i); if (!c) break; s += String.fromCharCode(c); } return s; };

function findAnchor() {
  const needle = Buffer.from(ANCHOR_NAME, 'utf16le');
  let i = b.indexOf(needle);
  while (i !== -1) {
    const off = i - 8;
    if (off >= 0 && i32(off) === ANCHOR_ID) return off;
    i = b.indexOf(needle, i + 1);
  }
  throw new Error('锚点记录未找到：' + ANCHOR_NAME + '/' + ANCHOR_ID);
}

const ANCHOR = findAnchor();
const index = new Map();
for (let k = 0; k < 14000; k++) {
  for (const o of [ANCHOR + k * SZ, ANCHOR - k * SZ]) {
    if (o < 0 || o + SZ > b.length) continue;
    const id = i32(o), nm = wstr(o + 8);
    if (id > 0 && id < 300000 && nm && !index.has(id)) index.set(id, o);
  }
}

function rec(id) {
  const o = index.get(id);
  if (o == null) return null;
  return {
    id, name: wstr(o + 8),
    level: i32(o + 228), health: i32(o + 360), healthBars: i32(o + 364), zhenQi: i32(o + 368),
    attack: i32(o + 372), defense: i32(o + 376), bonusDamage: i32(o + 380), damageReduction: i32(o + 384),
    normalHit: i32(o + 388), normalDodge: i32(o + 392), critRate: i32(o + 396), critDamage: i32(o + 400),
    resistance: i32(o + 404),
    critRateReduction: f2(o + 648), critDamageReduction: f2(o + 652),
    skillDodge: f2(o + 656), skillHit: f2(o + 660), ignoreReduction: i32(o + 688),
  };
}

// ---------- 第 1 步：用既有 BOSS 回归字段映射 ----------
const monstersPath = path.join(GAME_DATA, 'dungeons_monsters.json');
const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

const FIELD_MAP = {
  level: 'level', health: 'health', healthBars: 'healthBars', attack: 'attack', defense: 'defense',
  bonusDamage: 'bonusDamage', damageReduction: 'damageReduction', normalHit: 'normalHit',
  normalDodge: 'normalDodge', critRate: 'critRate', critDamage: 'critDamage', resistance: 'resistance',
  critRateReduction: 'critRateReduction', critDamageReduction: 'critDamageReduction',
  skillDodge: 'skillDodge', skillHit: 'skillHit', ignoreReduction: 'ignoreReduction',
};

const byNameHealth = new Map();
for (const [id, off] of index) {
  const r = rec(id);
  byNameHealth.set(r.name + '|' + r.health, r);
}

let checked = 0, match = 0;
const zhenQiRatios = new Set();
const mismatch = [];
for (const [dk, list] of Object.entries(monsters)) {
  if (dk.endsWith('_ADDS')) continue;
  for (const m of list) {
    const d = m.displayAttributes || {};
    const r = byNameHealth.get(m.MonsterName + '|' + d.health);
    if (!r) continue;
    checked++;
    let ok = true;
    for (const [jk, bk] of Object.entries(FIELD_MAP)) {
      if (d[jk] === undefined) continue;
      if (d[jk] !== r[bk]) { ok = false; mismatch.push(`${dk}/${m.MonsterName}.${jk}: json=${d[jk]} bin=${r[bk]}`); }
    }
    if (d.zhenQi !== undefined) zhenQiRatios.add(d.zhenQi === 0 ? '0' : String(d.zhenQi / (r.zhenQi || 1)));
    if (ok) match++;
  }
}
console.log(`[回归] 既有 BOSS 比对 ${checked} 条，全字段一致 ${match} 条；zhenQi 系数集 = ${[...zhenQiRatios].join(',')}`);
if (mismatch.length) console.log('[回归] 差异示例：\n  ' + mismatch.slice(0, 8).join('\n  '));

// ---------- 第 2 步：五毒 15 条 ----------
const BOSSES = [
  { pin: 'CHI', name: '痴', ids: [76576, 76577, 76578] },
  { pin: 'YUAN', name: '怨', ids: [76579, 76580, 76581] },
  { pin: 'TAN', name: '贪', ids: [76582, 76583, 76584] },
  { pin: 'CHEN', name: '嗔', ids: [76585, 76586, 76587] },
  { pin: 'YI', name: '疑', ids: [76588, 76589, 76590] },
];
const TIERS = [
  { tag: 'T10', difficulty: '简单', desc: '【鏖战！五毒其攻侵】系列日常团队副本之一，低级难度。' },
  { tag: 'T11', difficulty: '中等', desc: '【鏖战！五毒其攻侵】系列日常团队副本之一，中级难度。' },
  { tag: 'T12', difficulty: '较难', desc: '【鏖战！五毒其攻侵】系列日常团队副本之一，高级难度。' },
];

const snapshot = fs.existsSync(SNAP) ? JSON.parse(fs.readFileSync(SNAP, 'utf8')) : {};
const ZQ = 1; // 真气系数：既有数据里同名同值（202775302）的 BOSS 一律存原始值，故此处不放大

function buildEntry(boss, id, tierIdx) {
  const r = rec(id);
  if (!r) throw new Error('怪物不存在: ' + id);
  if (r.name !== boss.name) throw new Error(`名称不符 ${id}: 期望 ${boss.name} 实得 ${r.name}`);
  const tier = TIERS[tierIdx];
  const snap = (snapshot[String(id)] || {});
  const snaps = { level: '等级', health: '气血', healthBars: '血条', zhenQi: '真气', attack: '攻击', defense: '防御',
    bonusDamage: '附加伤害', damageReduction: '减免伤害', normalHit: '普攻命中', normalDodge: '普攻躲闪',
    critRate: '暴击率', critDamage: '暴击伤害', resistance: '抗性' };
  const diff = [];
  for (const [bk, sk] of Object.entries(snaps)) {
    if (snap[sk] === undefined) continue;
    if (Number(snap[sk]) !== r[bk]) diff.push(`${bk}: res111=${snap[sk]} bin=${r[bk]}`);
  }
  for (const [bk, sk] of [['critRateReduction', '减免暴击'], ['critDamageReduction', '减免暴伤'],
    ['skillDodge', '技能躲闪'], ['skillHit', '技能命中'], ['ignoreReduction', '无视减免']]) {
    if (snap[sk] === undefined) continue;
    if (Math.round(Number(snap[sk])) !== r[bk]) diff.push(`${bk}: res111=${snap[sk]} bin=${r[bk]}`);
  }
  if (diff.length) console.log(`  [核对差异] ${id} ${boss.name}${tier.tag}: ` + diff.join('; '));

  return {
    MonsterID: `${boss.pin}_${tier.tag}`,
    MonsterName: boss.name,
    DungeonLevel: BOSSES.findIndex(x => x.pin === boss.pin) + 1,
    MonsterAttributeModifiers: {
      MonsterCriticalDamagePercentReduction: r.critDamageReduction,
      MonsterDefense: r.defense,
      MonsterHealth: r.health * r.healthBars,
      MonsterCriticalHitRateReduction: r.critRateReduction,
    },
    role: 'boss',
    displayAttributes: {
      level: r.level,
      health: r.health,
      healthBars: r.healthBars,
      zhenQi: r.zhenQi * ZQ,
      attack: r.attack,
      defense: r.defense,
      bonusDamage: r.bonusDamage,
      damageReduction: r.damageReduction,
      normalHit: r.normalHit,
      normalDodge: r.normalDodge,
      critRate: r.critRate,
      critDamage: r.critDamage,
      resistance: r.resistance,
      critRateReduction: r.critRateReduction,
      critDamageReduction: r.critDamageReduction,
      skillDodge: r.skillDodge,
      skillHit: r.skillHit,
      ignoreReduction: r.ignoreReduction,
    },
  };
}

console.log('\n[生成] 五毒 T10-T12：');
const built = {};
TIERS.forEach((tier, ti) => {
  const key = `WUDU_QIGONGQIN_${tier.tag}`;
  built[key] = BOSSES.map(boss => buildEntry(boss, boss.ids[ti], ti));
  const hp = built[key].map(e => e.displayAttributes.health);
  console.log(`  ${key}: ${built[key].length} 条，气血 ${hp.join(' / ')}，抗性 ${built[key].map(e => e.displayAttributes.resistance).join('/')}`);
});

if (!WRITE) {
  console.log('\n[check] 未写入。加 --write 落盘。');
  process.exit(0);
}

// ---------- 第 3 步：写盘 ----------
const dungeonsPath = path.join(GAME_DATA, 'dungeons.json');
const dungeons = JSON.parse(fs.readFileSync(dungeonsPath, 'utf8'));
const existingIds = new Set(dungeons.map(d => d.DungeonID));
let addedDungeon = 0, addedMonster = 0, replacedMonster = 0;

TIERS.forEach((tier) => {
  const id = `WUDU_QIGONGQIN_${tier.tag}`;
  if (!existingIds.has(id)) {
    dungeons.push({ DungeonID: id, DungeonName: `鏖战！五毒其攻侵（${tier.tag}）`, Description: tier.desc, difficulty: tier.difficulty, DungeonImportanceWeight: 1 });
    addedDungeon++;
  }
  if (monsters[id]) replacedMonster++; else addedMonster++;
  monsters[id] = built[id];
});

fs.writeFileSync(dungeonsPath, JSON.stringify(dungeons, null, 2) + '\n', 'utf8');
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n', 'utf8');
console.log(`\n[write] dungeons.json +${addedDungeon}；dungeons_monsters.json +${addedMonster} / 覆盖 ${replacedMonster}`);

/**
 * 副本 BOSS 属性入库脚本（读 doc/data/dungeon_boss_sources.json 的清单）
 *
 * 数据源：客户端 elements.data 怪物表（stride 824，锚点 id 100788 赤眼猪妖）
 * 交叉核对：doc/data/res111_*.json（zx.res111.com 原始接口快照）
 *
 * 用法：
 *   node scripts/gen_dungeon_bosses.mjs --check    # 只校验（默认）
 *   node scripts/gen_dungeon_bosses.mjs --write    # 写入 game_data
 *
 * 已覆盖：鏖战！五毒其攻侵 T10-T12、问天！幻月自缥缈 T13-T15
 *
 * 关键偏移（v183 之后仍有效，已用既有 BOSS 逐字段回归确认）：
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
const SOURCES = path.join(ROOT, 'doc/data/dungeon_boss_sources.json');
const WRITE = process.argv.includes('--write');
const SZ = 824;
const ANCHOR_ID = 100788;
const ANCHOR_NAME = '赤眼猪妖';
/** 真气系数：既有数据里同名同值的 BOSS 一律存原始值，故不放大 */
const ZQ = 1;

const config = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));

// ---------- elements.data ----------
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
  throw new Error(`锚点记录未找到：${ANCHOR_NAME}/${ANCHOR_ID}`);
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

const SNAP_FIELDS = {
  level: '等级', health: '气血', healthBars: '血条', zhenQi: '真气', attack: '攻击', defense: '防御',
  bonusDamage: '附加伤害', damageReduction: '减免伤害', normalHit: '普攻命中', normalDodge: '普攻躲闪',
  critRate: '暴击率', critDamage: '暴击伤害', resistance: '抗性',
  critRateReduction: '减免暴击', critDamageReduction: '减免暴伤', skillDodge: '技能躲闪',
  skillHit: '技能命中', ignoreReduction: '无视减免',
};

function buildEntry(dungeon, tier, boss, tierIdx) {
  const id = boss.ids[tierIdx];
  const r = rec(id);
  if (!r) throw new Error(`怪物不存在: ${id}（${boss.name} ${tier.tag}）`);
  if (r.name !== boss.name) throw new Error(`名称不符 ${id}: 期望 ${boss.name} 实得 ${r.name}`);

  // 与 res111 快照逐字段对拍（快照缺失不算错，但会提示）
  const snapFile = path.join(ROOT, dungeon.snapshot);
  if (fs.existsSync(snapFile)) {
    const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'))[String(id)];
    if (snap) {
      const diff = [];
      for (const [bk, sk] of Object.entries(SNAP_FIELDS)) {
        if (snap[sk] === undefined) continue;
        if (Math.round(Number(snap[sk])) !== r[bk]) diff.push(`${bk}: res111=${snap[sk]} bin=${r[bk]}`);
      }
      if (diff.length) console.log(`  [核对差异] ${id} ${boss.name}${tier.tag}: ` + diff.join('; '));
    } else {
      console.log(`  [快照缺失] ${id} 不在 ${dungeon.snapshot}`);
    }
  }

  return {
    MonsterID: `${boss.pin}_${tier.tag}`,
    MonsterName: boss.name,
    DungeonLevel: boss.level,
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

const dungeonsPath = path.join(GAME_DATA, 'dungeons.json');
const monstersPath = path.join(GAME_DATA, 'dungeons_monsters.json');
const dungeons = JSON.parse(fs.readFileSync(dungeonsPath, 'utf8'));
const monsters = JSON.parse(fs.readFileSync(monstersPath, 'utf8'));

let addedDungeon = 0, addedGroup = 0, replacedGroup = 0;
const built = {};

for (const dungeon of config.dungeons) {
  dungeon.tiers.forEach((tier, ti) => {
    const key = `${dungeon.dungeonId}_${tier.tag}`;
    built[key] = dungeon.bosses.map((boss) => buildEntry(dungeon, tier, boss, ti));
    const hp = built[key].map((e) => e.displayAttributes.health);
    console.log(`[生成] ${key}: ${built[key].length} 条，气血 ${hp.join(' / ')}，抗性 ${built[key].map((e) => e.displayAttributes.resistance).join('/')}`);
  });
}

if (!WRITE) {
  console.log('\n[check] 未写入。加 --write 落盘。');
  process.exit(0);
}

for (const dungeon of config.dungeons) {
  for (const tier of dungeon.tiers) {
    const id = `${dungeon.dungeonId}_${tier.tag}`;
    if (!dungeons.some((d) => d.DungeonID === id)) {
      dungeons.push({
        DungeonID: id,
        DungeonName: `${dungeon.dungeonName}（${tier.tag}）`,
        Description: tier.desc,
        difficulty: tier.difficulty,
        DungeonImportanceWeight: 1,
      });
      addedDungeon++;
    }
    if (monsters[id]) replacedGroup++; else addedGroup++;
    monsters[id] = built[id];
  }
}

fs.writeFileSync(dungeonsPath, JSON.stringify(dungeons, null, 2) + '\n', 'utf8');
fs.writeFileSync(monstersPath, JSON.stringify(monsters, null, 2) + '\n', 'utf8');
console.log(`\n[write] dungeons.json +${addedDungeon}；dungeons_monsters.json +${addedGroup} 组 / 覆盖 ${replacedGroup} 组`);

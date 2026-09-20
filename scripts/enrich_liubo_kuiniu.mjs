/**
 * enrich_liubo_kuiniu.mjs —— 为「流波惊变」补录第 4 关 boss「夔牛」，并修正关次
 *
 * ── 为什么做这件事（2026-09-20）────────────────────────────────────────────
 * dungeons_monsters.json 里流波惊变两档的数据原本是**用户截图手工录入**的
 * （见 doc/change_log.md [1.0.5]：「来源：用户截图」），关次被记成了
 * 1 / 2 / 3 / 4 / 6（关 5 只有小怪），是全部 19 组副本里**唯一**不连续的一组。
 * 对照客户端内部命名后，真实关次是 1–5 连续，且**第 4 关的 boss 是夔牛**。
 *
 * ── 关次证据（全部来自 elements.data 的小怪命名，非猜测）──────────────────
 *   Boss1-     保护旗帜 / 旋转飞刀 2-4 / Boss树苗 2-3          ⇒ 关1 年老大
 *   Boss2-     循环总控 / 踩圈怪 / 踩塔控制怪 / 外·内场透明怪   ⇒ 关2 玉阳子
 *   Boss3-     青龙技能目标透明怪 ×4、幽姬分身用火球怪、
 *              幽姬位移位置 1-5                                ⇒ 关3 青龙 + 幽姬
 *   Boss4-     总控 / 屏障 ×8 / 鼎透明怪 ×8 / 收台子 / 起飞 /
 *              简单-困龙绳黄圈                                  ⇒ 关4 夔牛
 *   Boss5-     总控                                             ⇒ 关5 苍松
 *   旁证：青龙与幽姬的血/攻/防/爆伤几乎同值（同档），其余各关 boss 数值明显不同档；
 *         苍松之后紧跟「入魔的龙首峰弟子」「魔教之人」，与炼血堂小怪同关。
 *
 * ── 取值口径（已逐位验证）────────────────────────────────────────────────
 * 用现有 10 条 boss（5 只 × 2 难度）对 JSON.displayAttributes 与 MONSTER_ESSENCE
 * 字段做逐位比对，10 字段全 ✓（含 float ÷100 的 4 个减免类）：
 *   health@360  healthBars@364  zhenQi@368  attack@372  defense@376
 *   bonusDamage@380  damageReduction@384  normalHit@388  normalDodge@392
 *   critRate@396  critDamage@400  resistance@404
 *   critRateReduction@648÷100  critDamageReduction@652÷100
 *   skillDodge@656÷100  skillHit@660÷100  ignoreReduction@688
 *   MonsterAttributeModifiers.MonsterHealth = displayAttributes.health × healthBars
 *
 * 夔牛的定位规则：取**离本难度「青龙」记录 id 最近**的那条「夔牛」记录
 *   （初识 青龙 @127519 → 夔牛 @127522；困难 青龙 @126916 → 夔牛 @126919）
 *
 * ── 用法 ─────────────────────────────────────────────────────────────────
 *   node scripts/enrich_liubo_kuiniu.mjs           # 预演：只打印 diff，不写盘
 *   node scripts/enrich_liubo_kuiniu.mjs --write   # 落盘
 *   ZX_ELEMENTS=D:/elements.data node scripts/...  # 指定 elements.data
 *
 * 注：只改 web_app/public/game_data/dungeons_monsters.json（源文件）。
 *     web_app/dist/ 是构建产物，需 `npm run web:build` 重新生成。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const JSON_PATH = path.join(ROOT, 'web_app/public/game_data/dungeons_monsters.json');
const ELEMENTS = process.env.ZX_ELEMENTS || 'D:/elements.data';
const WRITE = process.argv.includes('--write');

// MONSTER_ESSENCE（表 21）在该 elements.data 中的位置；来自 elements_tables_v183.json
const T = { dataOffset: 37033344, sizeof: 824, count: 14383 };

// 每档的锚点：青龙记录 id（用于定位夔牛）＋ JSON 顶层键
const TIERS = [
  { key: 'LIU_BO_JING_BIAN_CHUSHI', qinglongId: 127519, yi: '初识' },
  { key: 'LIU_BO_JING_BIAN_HARD', qinglongId: 126916, yi: '困难' },
];

// 关次修正：幽姬 4→3，苍松 6→5
const LEVEL_FIX = [
  { name: '幽姬', from: 4, to: 3 },
  { name: '苍松', from: 6, to: 5 },
];

const buf = fs.readFileSync(ELEMENTS);
const ws = (o, n) => buf.toString('utf16le', o, o + n).replace(/\u0000[\s\S]*$/, '');
const i32 = (o) => buf.readInt32LE(o);
const f100 = (o) => Math.round(buf.readFloatLE(o) * 100);
const recBase = (r) => T.dataOffset + r * T.sizeof;

// 扫全表，按名字索引
const byName = new Map();
for (let r = 0; r < T.count; r++) {
  const b = recBase(r);
  const nm = ws(b + 8, 64);
  if (!nm) continue;
  if (!byName.has(nm)) byName.set(nm, []);
  byName.get(nm).push({ r, id: i32(b) });
}
const find = (nm, id) => (byName.get(nm) || []).find((x) => x.id === id);

// 从一条记录读出 JSON 的 displayAttributes / MonsterAttributeModifiers
function readMonster(r) {
  const b = recBase(r);
  const d = {
    level: i32(b + 228),
    health: i32(b + 360),
    healthBars: i32(b + 364),
    zhenQi: i32(b + 368),
    attack: i32(b + 372),
    defense: i32(b + 376),
    bonusDamage: i32(b + 380),
    damageReduction: i32(b + 384),
    normalHit: i32(b + 388),
    normalDodge: i32(b + 392),
    critRate: i32(b + 396),
    critDamage: i32(b + 400),
    resistance: i32(b + 404),
    critRateReduction: f100(b + 648),
    critDamageReduction: f100(b + 652),
    skillDodge: f100(b + 656),
    skillHit: f100(b + 660),
    ignoreReduction: i32(b + 688),
  };
  return {
    name: ws(b + 8, 64),
    id: i32(b),
    displayAttributes: d,
    MonsterAttributeModifiers: {
      MonsterCriticalDamagePercentReduction: d.critDamageReduction,
      MonsterDefense: d.defense,
      MonsterHealth: d.health * d.healthBars,
      MonsterCriticalHitRateReduction: d.critRateReduction,
    },
  };
}

console.log(`elements.data: ${ELEMENTS}`);
console.log(`MONSTER_ESSENCE: ${T.count} 条 × ${T.sizeof}B @ ${T.dataOffset}\n`);

// 解析 JSON（CRLF、2 空格、无尾换行 —— 已验证可无损往返）
const raw = fs.readFileSync(JSON_PATH, 'utf8');
const db = JSON.parse(raw);
const serialize = (o) => JSON.stringify(o, null, 2).replace(/\n/g, '\r\n');

const diff = [];
for (const tier of TIERS) {
  const arr = db[tier.key];
  if (!arr) throw new Error(`缺少顶层键 ${tier.key}`);
  const ql = find('青龙', tier.qinglongId);
  if (!ql) throw new Error(`${tier.yi}：找不到青龙记录 id=${tier.qinglongId}`);
  const kuis = (byName.get('夔牛') || []).slice().sort(
    (a, b) => Math.abs(a.id - tier.qinglongId) - Math.abs(b.id - tier.qinglongId),
  );
  if (!kuis.length) throw new Error('MONSTER_ESSENCE 中没有名为「夔牛」的记录');
  const kn = kuis[0];
  const km = readMonster(kn.r);
  console.log(`【${tier.yi}】青龙 id=${tier.qinglongId} (rec${ql.r}) → 采用夔牛 id=${kn.id} (rec${kn.r}, 距离 ${Math.abs(kn.id - tier.qinglongId)})`);
  console.log(`        夔牛属性：血 ${km.displayAttributes.health} × ${km.displayAttributes.healthBars} 条 = ${km.MonsterAttributeModifiers.MonsterHealth}` +
    `｜攻 ${km.displayAttributes.attack}｜防 ${km.displayAttributes.defense}｜爆伤 ${km.displayAttributes.critDamage}｜无视 ${km.displayAttributes.ignoreReduction}`);

  // 1) 关次修正
  for (const fx of LEVEL_FIX) {
    const e = arr.find((x) => x.MonsterName === fx.name);
    if (!e) throw new Error(`${tier.yi}：找不到 ${fx.name}`);
    if (e.DungeonLevel === fx.from) {
      diff.push(`${tier.key}  ${fx.name}  DungeonLevel ${fx.from} → ${fx.to}`);
      e.DungeonLevel = fx.to;
    } else if (e.DungeonLevel !== fx.to) {
      throw new Error(`${tier.yi}：${fx.name} 关次意外为 ${e.DungeonLevel}（期望 ${fx.from} 或 ${fx.to}）`);
    }
  }

  // 2) 插入夔牛（第 4 关），位置：幽姬之后
  if (arr.some((x) => x.MonsterName === '夔牛')) {
    console.log(`        （已存在夔牛条目，跳过插入）`);
  } else {
    const yiTag = tier.key.endsWith('CHUSHI') ? 'CHUSHI' : 'HARD';
    const entry = {
      MonsterID: `KUINIU_${yiTag}`,
      MonsterName: '夔牛',
      DungeonLevel: 4,
      MonsterAttributeModifiers: km.MonsterAttributeModifiers,
      role: 'boss',
      displayAttributes: km.displayAttributes,
    };
    const afterYouji = arr.findIndex((x) => x.MonsterName === '幽姬');
    arr.splice(afterYouji + 1, 0, entry);
    diff.push(`${tier.key}  + 夔牛  MonsterID=KUINIU_${yiTag}  DungeonLevel=4  (插在幽姬之后)`);
  }
  console.log(`        关次：${JSON.stringify(arr.map((x) => x.DungeonLevel).sort((a, b) => a - b))}`);
}

const out = serialize(db);
console.log('\n── 变更清单 ──');
diff.forEach((d) => console.log('  ' + d));
console.log(`\n文件字节数：${raw.length} → ${out.length}`);

if (!WRITE) {
  console.log('\n[预演] 未写盘。加 --write 落盘。');
  process.exit(0);
}
fs.writeFileSync(JSON_PATH, out);
console.log(`\n[已写盘] ${JSON_PATH}`);

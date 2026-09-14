/**
 * homepage_demo 构建脚本：
 * 从 web_app/public/game_data 的真实游戏数据生成搜索索引（含拼音首字母/全拼），
 * 注入 index.template.html 的 /*__DATA__*\/ 占位，输出单文件 index.html。
 * 运行：node build_demo.cjs（在 homepage_demo 目录下）
 */
const { pinyin } = require('pinyin-pro');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'web_app', 'public', 'game_data');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));

const skillsDoc = readJson('skills.json');
const dungeons = readJson('dungeons.json');
const monstersByDungeon = readJson('dungeons_monsters.json');
const buffs = readJson('combat_buffs.json');
const guide = readJson('attribute_ceiling_guide.json');
const lists = readJson('stat_source_lists.json');

const classLabels = skillsDoc._meta.classLabels;
const factions = skillsDoc._meta.factions;
const aliases = skillsDoc._meta.searchAliases || {};

/** 与 GlobalSearch.toPinyin 一致：中文 -> 无声调全拼 + 首字母；英文原样保留 */
function toPy(text) {
  const arr = pinyin(text, { toneType: 'none', type: 'array' });
  const syl = arr.filter((t) => /^[a-z0-9]+$/i.test(t));
  return {
    i: syl.map((s) => s[0]).join('').toLowerCase(),
    f: syl.join('').toLowerCase(),
  };
}

/**
 * 索引条目：{ l:名称, g:分组, c:分类, i:首字母, f:全拼 }
 * c: page 功能 | dungeon 副本 | monster Boss | skill 技能 | buff 增益 | role 职业评级 | guide 攻略
 */
const out = [];
function E(label, group, cat, keywords, target) {
  const kw = keywords || [];
  const p = toPy(label + ' ' + kw.join(' '));
  out.push({ l: label, g: group, c: cat, i: p.i, f: p.f, k: kw, t: target });
}

// ---------- 1. 四大功能入口 ----------
E('属性战力计算器', '功能入口', 'page', ['战力', '计算器', '属性计算'], { type: 'calc' });
E('副本模拟训练场', '功能入口', 'page', ['模拟', '训练场', '战斗模拟', 'arena'], { type: 'arena' });
E('资料图鉴', '功能入口', 'page', ['图鉴', '攻略', '资料', '专注值', '增益'], { type: 'compendium' });
E('职业技能速查', '功能入口', 'page', ['技能', '速查', '技能库', '门派技能'], { type: 'skills' });

// ---------- 2. 副本入口（别名取 _meta.searchAliases，内部 ID 不入索引避免噪声） ----------
for (const d of dungeons) {
  E(d.DungeonName, '副本入口 · 属性战力计算器', 'dungeon', aliases[d.DungeonID] || [], { type: 'dungeon', dungeonId: d.DungeonID });
}

// ---------- 3. Boss / 小怪（仅副本卡片存在的） ----------
const dungeonIds = new Set(dungeons.map((d) => d.DungeonID));
for (const [dungeonId, list] of Object.entries(monstersByDungeon)) {
  if (!dungeonIds.has(dungeonId)) continue; // 跳过 _ADDS 等无卡片键
  const dName = dungeons.find((d) => d.DungeonID === dungeonId).DungeonName;
  for (const m of list) {
    const name = m.MonsterName || m.name;
    if (!name) continue;
    const role = m.role === 'add' ? '小怪' : 'Boss';
    E(name, `${dName} · ${role}`, 'monster', [dName, ...(aliases[m.MonsterID] || [])], {
      type: 'monster',
      dungeonId,
      monsterId: m.MonsterID,
    });
  }
}

// ---------- 4. 技能（职业门派核心技能） ----------
for (const [classId, byFaction] of Object.entries(skillsDoc)) {
  if (classId === '_meta') continue;
  const className = classLabels[classId] || classId;
  for (const [factionId, skillList] of Object.entries(byFaction)) {
    const factionName = factions[factionId] || factionId;
    for (const sk of skillList) {
      const kw = [className, factionName, ...(aliases[sk.SkillID] || [])];
      E(sk.SkillName, `${className}·${factionName} · 技能`, 'skill', kw, {
        type: 'skill',
        classId,
        faction: factionId,
        skillId: sk.SkillID,
        skillName: sk.SkillName,
      });
    }
  }
}

// ---------- 5. 战斗增益 Buff（显示到各职业状态 · 专注值参考下方） ----------
const buffAliases = {
  BUFF_FOCUS_EFFECT: ['专注', 'zhuanzhu', 'zz', '增益', '专注增益'],
  BUFF_HOLYWRATH_EFFECT: ['巫咒', 'wuzhou', 'wz', '增益', '巫咒增益'],
  BUFF_MON_CRITDAMAGE_EFFECT: ['绿点', 'lvdian', 'ld', '暴伤', '增益', '绿点增益'],
  BUFF_MON_HARMED_EFFECT: ['易伤', 'yishang', 'ys', '增益', '易伤增益'],
  BUFF_ATT_PERCENT_EFFECT: ['攻击比', 'gongjibi', 'gjb', '增益', '攻击比增益'],
};
for (const b of buffs) {
  E(b.BuffName, '各职业状态 · 专注值与战斗增益参考', 'guide', buffAliases[b.BuffID] || [], {
    type: 'compendium',
    sub: 'support',
    buffId: b.BuffID,
    item: b.BuffName,
  });
}

// ---------- 6. 资料图鉴：攻略子页 ----------
const SUB_PAGES = [
  ['极致无视攻略', 'ignore', ['无视', '易伤', '无视减免']],
  ['极致减免伤害攻略', 'reduction', ['减免', '减伤']],
  ['极致减暴击攻略', 'critReduction', ['减暴', '暴击减免', '减暴击']],
  ['极致怪增攻略', 'monsterDamageBonus', ['怪增', '怪物增伤', '增伤']],
  ['极致躲闪攻略', 'dodge', ['躲闪', '闪避']],
  ['各职业状态', 'support', ['职业', '辅助', '专注值', '专注']],
];
for (const [name, subKey, kw] of SUB_PAGES) {
  E(name, '资料图鉴 · 攻略', 'guide', kw, { type: 'guide', sub: subKey });
}

// ---------- 7. 职业评级 ----------
const roles = skillsDoc._meta.supportRoles;
if (roles) {
  for (const r of roles.roles) {
    E(r.name, `各职业状态 · ${r.faction} · ${r.rating === '输出' ? '输出' : '辅助'}`, 'role', [
      r.faction,
      r.rating,
    ], { type: 'role', roleName: r.name });
  }
}

// ---------- 8. 专注值参考 ----------
const focusRef = skillsDoc._meta.focusReference;
if (focusRef) {
  for (const g of focusRef.general || []) {
    E(g.name, '各职业状态 · 专注值参考', 'guide', ['专注', '通用'], { type: 'focus', focusName: g.name });
  }
}

// ---------- 9. 极致属性攻略明细行 ----------
const guideMap = {
  ignore: '极致无视攻略',
  reduction: '极致减免攻略',
  critReduction: '极致减暴击攻略',
};
for (const [key, section] of Object.entries(guide.sections)) {
  const gName = guideMap[key];
  if (!gName) continue;
  for (const row of section.rows) E(row.item, `${gName} · 明细`, 'guide', [], { type: 'guide', sub: key, item: row.item });
}
const listMap = {
  monsterDamageBonus: '极致怪增攻略',
  dodge: '极致躲闪攻略',
};
for (const [key, section] of Object.entries(lists.sections)) {
  const gName = listMap[key];
  if (!gName) continue;
  for (const row of section.sources || []) E(row.item, `${gName} · 属性来源`, 'guide', [], { type: 'guide', sub: key, item: row.item });
  for (const row of section.conditionals || []) E(row.item, `${gName} · 条件来源`, 'guide', [], { type: 'guide', sub: key, item: row.item });
}

// ---------- 统计 ----------
const stats = {
  dungeons: dungeons.length,
  monsters: out.filter((x) => x.c === 'monster').length,
  skills: out.filter((x) => x.c === 'skill').length,
  buffs: buffs.length,
  roles: roles ? roles.roles.length : 0,
  guides: out.filter((x) => x.c === 'guide').length,
};

// ---------- 过滤技能纯数据 ----------
const cleanSkills = {};
for (const [classId, byFaction] of Object.entries(skillsDoc)) {
  if (classId === '_meta') continue;
  cleanSkills[classId] = {};
  for (const [factionId, skillList] of Object.entries(byFaction)) {
    cleanSkills[classId][factionId] = skillList;
  }
}

// ---------- 注入模板 ----------
const tplPath = path.join(__dirname, 'index.template.html');
let tpl = fs.readFileSync(tplPath, 'utf8');
const payload = [
  'const SEARCH_DATA = ' + JSON.stringify(out) + ';',
  'const STATS = ' + JSON.stringify(stats) + ';',
  'const SKILLS_DATA = ' + JSON.stringify(cleanSkills) + ';',
  'const BUFFS_DATA = ' + JSON.stringify(buffs) + ';',
  'const CLASS_LABELS = ' + JSON.stringify(classLabels) + ';',
  'const FACTIONS = ' + JSON.stringify(factions) + ';',
].join('\n');
tpl = tpl.replace('/*__DATA__*/', payload);
fs.writeFileSync(path.join(__dirname, 'index.html'), tpl, 'utf8');

console.log('index entries:', out.length);
console.log('stats:', stats);


/**
 * 批量生成副本相关夹具（幂等：同 id 覆盖写）
 *
 * 覆盖三类：
 *   1. auto-tier-<tag>    每个带 T 编号的副本，大写 T13 + 小写 t13 两种写法
 *   2. auto-series-<slug> 同系列多难度（如 问天！幻月自缥缈 T13-T15），一次出全套
 *   3. auto-boss-<slug>   各副本关底 BOSS（跨副本重名的按同一关底统计）
 *
 * 期望值**从数据推导**（不抄运行结果）：候选数 = 命中该副本/该 BOSS 名 的副本数，
 * 首条 = 数据顺序里的第一个命中项。与实现不一致时 `l1_intent_fixture` 会直接报断言失败。
 *
 * 用法：node scripts/gen_dungeon_fixtures.mjs            # 只打印将写入的条目
 *       node scripts/gen_dungeon_fixtures.mjs --write    # 落盘（随后需跑 --golden 收录）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GD = path.join(ROOT, 'web_app/public/game_data');
const CASES = path.join(ROOT, 'regression_test/l1_intent_cases.json');
const WRITE = process.argv.includes('--write');

const dungeons = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons.json'), 'utf8'));
const monsters = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons_monsters.json'), 'utf8'));

/** getDungeons() 的等价展开：_ADDS 并入母副本 */
const expanded = dungeons.map((d) => ({
    ...d,
    Monsters: [...(monsters[d.DungeonID] || []), ...(monsters[`${d.DungeonID}_ADDS`] || [])],
}));

const out = [];
const push = (c) => out.push(c);

// ---------- 1. 单档副本：大写/小写 ----------
for (const d of expanded) {
    const m = d.DungeonName.match(/T(\d+)/);
    if (!m) continue;
    const n = m[1];
    for (const input of [`T${n}`, `t${n}`]) {
        push({
            id: `auto-tier-t${n}-${input === input.toUpperCase() ? 'upper' : 'lower'}`,
            input,
            expect: {
                cardType: 'boss_candidates',
                'cardData.dungeonName': d.DungeonName,
                'cardData.candidates.length': d.Monsters.length,
                ...(d.Monsters[0] ? { 'cardData.candidates.0.id': `${d.DungeonID}_${d.Monsters[0].MonsterID}` } : {}),
            },
            tags: ['standard', 'dungeon', 'auto'],
            assert: 'strong',
        });
    }
}

// ---------- 2. 多难度系列 ----------
const series = new Map();
for (const d of expanded) {
    const base = d.DungeonName.replace(/[（(]T\d+[）)]$/, '').trim();
    if (!/T\d+/.test(d.DungeonName)) continue;
    if (!series.has(base)) series.set(base, []);
    series.get(base).push(d);
}
for (const [base, list] of series) {
    if (list.length < 2) continue;
    const bossTotal = list.reduce((s, d) => s + d.Monsters.length, 0);
    push({
        id: `auto-series-${list[0].DungeonID.split('_').slice(0, -1).join('-').toLowerCase()}`,
        input: base,
        expect: {
            cardType: 'boss_candidates',
            'cardData.seriesName': base,
            'cardData.candidates.length': bossTotal,
        },
        tags: ['standard', 'dungeon', 'auto'],
        assert: 'strong',
    });
}

// ---------- 3. 关底 BOSS 名 ----------
// 复刻 matchLocalIntent 的 BOSS 匹配规则：mName === q 或（q 长度≥2 且 mName 包含 q）或反向包含
const norm = (s) => String(s || '').trim().toLowerCase();
function bossHits(qRaw) {
    const q = norm(qRaw);
    const hits = [];
    for (const d of expanded) {
        for (const mm of d.Monsters) {
            const n = norm(mm.MonsterName);
            if (n === q || (q.length >= 2 && n.includes(q)) || (n.length >= 2 && q.includes(n))) {
                hits.push({ dungeonId: d.DungeonID, monsterId: mm.MonsterID, name: mm.MonsterName });
            }
        }
    }
    return hits;
}

/** 名字里带这些词时会被副本/系列/大类先截胡，不走 BOSS 分支，故不生成 BOSS 用例 */
const DUNGEON_WORDS = ['兽神', '天道', '流波', '空桑', '天帝', '幻月', '问天', '五毒', '鏖战',
    '凌云', '断浪', '四象', '悬夜', '玄天', '副本', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16', 'T17', 'T18', 'T19', 'T20', 'T21'];
const usedBoss = new Set();
for (const d of expanded) {
    const bosses = d.Monsters.filter((x) => x.role === 'boss');
    const last = bosses[bosses.length - 1];
    if (!last || last.MonsterName.length < 2) continue;
    if (usedBoss.has(last.MonsterName)) continue;
    if (DUNGEON_WORDS.some((w) => last.MonsterName.includes(w))) continue;
    // 带「·」的名字（七尾蜈蚣·雄 / 罪·玄晔）匹配规则与普通名不同，单独手写用例，不自动生成
    if (last.MonsterName.includes('·')) continue;
    usedBoss.add(last.MonsterName);
    const hits = bossHits(last.MonsterName);
    if (hits.length === 0) continue;
    push({
        id: `auto-boss-${last.MonsterName.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, '').slice(0, 12)}`,
        input: last.MonsterName,
        // 唯一命中走「单 BOSS 卡」（cardType=boss），多条命中走候选列表
        expect: hits.length === 1
            ? { cardType: 'boss', 'cardData.monsterId': hits[0].monsterId, 'cardData.dungeonId': hits[0].dungeonId }
            : {
                cardType: 'boss_candidates',
                'cardData.candidates.length': hits.length,
                'cardData.candidates.0.id': `${hits[0].dungeonId}_${hits[0].monsterId}`,
            },
        tags: ['standard', 'dungeon', 'auto'],
        assert: 'strong',
    });
}

let cases = JSON.parse(fs.readFileSync(CASES, 'utf8'));
const genIds = new Set(out.map((c) => c.id));
// 清理：上轮自动生成、这轮不再生成的用例（数据/规则变化后会残留）
const stale = cases.filter((c) => c.tags?.includes('auto') && !genIds.has(c.id));
if (stale.length) {
    cases = cases.filter((c) => !stale.includes(c));
    console.log(`清理过期的自动用例 ${stale.length} 条：${stale.map((c) => c.id).join(', ')}`);
}
const byId = new Map(cases.map((c) => [c.id, c]));
let added = 0, updated = 0;
for (const c of out) {
    if (byId.has(c.id)) { Object.assign(byId.get(c.id), c); updated++; } else { cases.push(c); added++; }
}

console.log(`生成 ${out.length} 条（新增 ${added} / 覆盖 ${updated}），用例总数 ${cases.length}`);
console.log(out.slice(0, 8).map((c) => `  ${c.id} ← "${c.input}"`).join('\n'));

if (!WRITE) { console.log('\n未写入。加 --write 落盘。'); process.exit(0); }
fs.writeFileSync(CASES, JSON.stringify(cases, null, 2) + '\n', 'utf8');
console.log('已写入 regression_test/l1_intent_cases.json');

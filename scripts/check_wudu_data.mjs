/**
 * T10/T11/T12「鏖战！五毒其攻侵」数据回归（纯数据，不依赖 elements.data / 浏览器）
 *
 * 断言四类：
 *   1. 副本条目：3 个，名称/难度/DungeonID 正确，且都登记进 dungeonMeta 的顺序表
 *   2. BOSS 条目：每组 5 个，名称 痴→怨→贪→嗔→疑，关序 1~5，role=boss
 *   3. 字段自洽：MonsterHealth == health × healthBars，抗性随档位 2000/2200/2400，
 *      同一 BOSS 三档气血/攻击单调递增
 *   4. 与数据源一致：逐字段对拍 doc/data/res111_wudu_t10_12.json（站点原始快照）
 *
 * 用法：node scripts/check_wudu_data.mjs        # 失败即非零退出
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GD = path.join(ROOT, 'web_app/public/game_data');
const SNAP = path.join(ROOT, 'doc/data/res111_wudu_t10_12.json');
const META = path.join(ROOT, 'web_app/src/data/dungeonMeta.ts');

const dungeons = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons.json'), 'utf8'));
const monsters = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons_monsters.json'), 'utf8'));
const snapshot = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
const metaSrc = fs.readFileSync(META, 'utf8');

const TIERS = ['T10', 'T11', 'T12'];
const BOSSES = ['痴', '怨', '贪', '嗔', '疑'];
const SOURCE_IDS = {
    T10: [76576, 76579, 76582, 76585, 76588],
    T11: [76577, 76580, 76583, 76586, 76589],
    T12: [76578, 76581, 76584, 76587, 76590],
};
const EXPECT = {
    T10: { difficulty: '简单', resistance: 2000 },
    T11: { difficulty: '中等', resistance: 2200 },
    T12: { difficulty: '较难', resistance: 2400 },
};

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// ---------- 1. 副本条目 ----------
for (const tier of TIERS) {
    const id = `WUDU_QIGONGQIN_${tier}`;
    const d = dungeons.find((x) => x.DungeonID === id);
    ok(!!d, `dungeons.json 缺 ${id}`);
    if (!d) continue;
    ok(d.DungeonName === `鏖战！五毒其攻侵（${tier}）`, `${id} 名称错误: ${d.DungeonName}`);
    ok(d.difficulty === EXPECT[tier].difficulty, `${id} 难度错误: ${d.difficulty}`);
    ok(metaSrc.includes(`${id}:`), `dungeonMeta.ts 未登记 ${id}（顺序/短名/标签会缺）`);
}

// ---------- 2. BOSS 条目 ----------
const need = ['level', 'health', 'healthBars', 'zhenQi', 'attack', 'defense', 'bonusDamage', 'damageReduction',
    'normalHit', 'normalDodge', 'critRate', 'critDamage', 'resistance', 'critRateReduction',
    'critDamageReduction', 'skillDodge', 'skillHit', 'ignoreReduction'];

for (const tier of TIERS) {
    const list = monsters[`WUDU_QIGONGQIN_${tier}`];
    ok(Array.isArray(list), `dungeons_monsters.json 缺 WUDU_QIGONGQIN_${tier}`);
    if (!Array.isArray(list)) continue;
    ok(list.length === 5, `${tier} BOSS 数应为 5，实际 ${list.length}`);
    list.forEach((m, i) => {
        ok(m.MonsterName === BOSSES[i], `${tier}#${i} 名称应为 ${BOSSES[i]}，实际 ${m.MonsterName}`);
        ok(m.DungeonLevel === i + 1, `${tier}/${m.MonsterName} 关序应为 ${i + 1}，实际 ${m.DungeonLevel}`);
        ok(m.role === 'boss', `${tier}/${m.MonsterName} role 应为 boss`);
        ok(m.MonsterID === `${m.MonsterID.split('_')[0]}_${tier}`, `${tier}/${m.MonsterName} MonsterID 档位后缀不符: ${m.MonsterID}`);
        const miss = need.filter((k) => m.displayAttributes?.[k] === undefined);
        ok(miss.length === 0, `${tier}/${m.MonsterName} 缺字段: ${miss.join(',')}`);
        const a = m.displayAttributes || {};
        ok(m.MonsterAttributeModifiers?.MonsterHealth === a.health * a.healthBars,
            `${tier}/${m.MonsterName} MonsterHealth ≠ health×healthBars`);
        ok(m.MonsterAttributeModifiers?.MonsterDefense === a.defense, `${tier}/${m.MonsterName} MonsterDefense ≠ defense`);
        ok(m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction === a.critRateReduction,
            `${tier}/${m.MonsterName} MonsterCriticalHitRateReduction ≠ critRateReduction`);
        ok(m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction === a.critDamageReduction,
            `${tier}/${m.MonsterName} MonsterCriticalDamagePercentReduction ≠ critDamageReduction`);
        ok(a.resistance === EXPECT[tier].resistance, `${tier}/${m.MonsterName} 抗性应为 ${EXPECT[tier].resistance}，实际 ${a.resistance}`);
    });
}

// ---------- 3. 档位单调性 ----------
BOSSES.forEach((name, bi) => {
    const hp = TIERS.map((t) => monsters[`WUDU_QIGONGQIN_${t}`]?.[bi]?.displayAttributes?.health ?? 0);
    const atk = TIERS.map((t) => monsters[`WUDU_QIGONGQIN_${t}`]?.[bi]?.displayAttributes?.attack ?? 0);
    ok(hp[0] < hp[1] && hp[1] < hp[2], `${name} 气血未随档位递增: ${hp.join(' < ')}`);
    ok(atk[0] < atk[1] && atk[1] < atk[2], `${name} 攻击未随档位递增: ${atk.join(' < ')}`);
});

// ---------- 4. 与 res111 原始快照对拍 ----------
const SNAP_MAP = {
    level: '等级', health: '气血', healthBars: '血条', zhenQi: '真气', attack: '攻击', defense: '防御',
    bonusDamage: '附加伤害', damageReduction: '减免伤害', normalHit: '普攻命中', normalDodge: '普攻躲闪',
    critRate: '暴击率', critDamage: '暴击伤害', resistance: '抗性',
    critRateReduction: '减免暴击', critDamageReduction: '减免暴伤', skillDodge: '技能躲闪',
    skillHit: '技能命中', ignoreReduction: '无视减免',
};
TIERS.forEach((tier, ti) => {
    BOSSES.forEach((name, bi) => {
        const snap = snapshot[String(SOURCE_IDS[tier][bi])];
        const m = monsters[`WUDU_QIGONGQIN_${tier}`]?.[bi];
        if (!snap || !m) { fails.push(`${tier}/${name} 快照或入库缺失`); return; }
        for (const [jk, sk] of Object.entries(SNAP_MAP)) {
            const s = Math.round(Number(snap[sk]));
            const v = m.displayAttributes[jk];
            if (s !== v) fails.push(`${tier}/${name}.${jk}: 快照=${s} 入库=${v}`);
        }
    });
});

// ---------- 输出 ----------
// 默认落点回归：用户拍板默认 T17（新增 T10-T12 不得顶掉它）
ok(metaSrc.includes("DEFAULT_DUNGEON_ID = 'HUIMENG_LINGYUN_T17'"), 'dungeonMeta.ts 默认副本应为 T17');

const total = TIERS.length * BOSSES.length;
if (fails.length) {
    console.error(`✗ 五毒数据回归失败 ${fails.length} 条：`);
    fails.slice(0, 20).forEach((f) => console.error('  - ' + f));
    if (fails.length > 20) console.error(`  ... 还有 ${fails.length - 20} 条`);
    process.exit(1);
}
console.log(`✓ 五毒数据回归通过：3 副本 / ${total} BOSS；字段自洽 + 档位单调 + 与 res111 快照逐字段一致`);

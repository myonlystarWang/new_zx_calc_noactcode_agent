/**
 * 副本 BOSS 数据回归（纯数据：不依赖 elements.data，也不起浏览器）
 *
 * 读 doc/data/dungeon_boss_sources.json 的清单，断言五类：
 *   1. 副本条目：存在、名称/难度/描述与清单一致
 *   2. BOSS 条目：数量、顺序、关序、role、MonsterID 档位后缀
 *   3. 字段自洽：MonsterHealth == health × healthBars、防御/减暴击/减暴伤一致、字段齐全
 *   4. 与数据源一致：逐字段对拍 doc/data/res111_*.json（站点原始快照）
 *   5. 展示层登记：每个副本都在 dungeonMeta.ts 的 顺序/胶囊短名/标签/别名 里，
 *      且默认副本仍是 T17（防「聊天有、轮播没有」这类漏登记回潮）
 *
 * 用法：node scripts/check_boss_data.mjs      # 失败即非零退出
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GD = path.join(ROOT, 'web_app/public/game_data');
const SOURCES = path.join(ROOT, 'doc/data/dungeon_boss_sources.json');
const META = path.join(ROOT, 'web_app/src/data/dungeonMeta.ts');

const config = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
const dungeons = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons.json'), 'utf8'));
const monsters = JSON.parse(fs.readFileSync(path.join(GD, 'dungeons_monsters.json'), 'utf8'));
const metaSrc = fs.readFileSync(META, 'utf8');

const fails = [];
const notes = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

const NEED = ['level', 'health', 'healthBars', 'zhenQi', 'attack', 'defense', 'bonusDamage', 'damageReduction',
    'normalHit', 'normalDodge', 'critRate', 'critDamage', 'resistance', 'critRateReduction',
    'critDamageReduction', 'skillDodge', 'skillHit', 'ignoreReduction'];

const SNAP_FIELDS = {
    level: '等级', health: '气血', healthBars: '血条', zhenQi: '真气', attack: '攻击', defense: '防御',
    bonusDamage: '附加伤害', damageReduction: '减免伤害', normalHit: '普攻命中', normalDodge: '普攻躲闪',
    critRate: '暴击率', critDamage: '暴击伤害', resistance: '抗性',
    critRateReduction: '减免暴击', critDamageReduction: '减免暴伤', skillDodge: '技能躲闪',
    skillHit: '技能命中', ignoreReduction: '无视减免',
};

let bossTotal = 0;

for (const dungeon of config.dungeons) {
    const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, dungeon.snapshot), 'utf8'));

    dungeon.tiers.forEach((tier, ti) => {
        const id = `${dungeon.dungeonId}_${tier.tag}`;
        const meta = dungeons.find((d) => d.DungeonID === id);

        // 1. 副本条目
        ok(!!meta, `dungeons.json 缺 ${id}`);
        if (meta) {
            ok(meta.DungeonName === `${dungeon.dungeonName}（${tier.tag}）`, `${id} 名称错误: ${meta.DungeonName}`);
            ok(meta.difficulty === tier.difficulty, `${id} 难度应 ${tier.difficulty}，实际 ${meta.difficulty}`);
            ok(meta.Description === tier.desc, `${id} 描述与清单不一致`);
        }

        // 2/3/4. BOSS 条目
        const list = monsters[id];
        ok(Array.isArray(list), `dungeons_monsters.json 缺 ${id}`);
        if (!Array.isArray(list)) return;
        ok(list.length === dungeon.bosses.length, `${id} BOSS 数应 ${dungeon.bosses.length}，实际 ${list.length}`);
        bossTotal += list.length;

        list.forEach((m, bi) => {
            const spec = dungeon.bosses[bi] ?? {};
            ok(m.MonsterName === spec.name, `${id}#${bi} 名称应 ${spec.name}，实际 ${m.MonsterName}`);
            ok(m.DungeonLevel === spec.level, `${id}/${m.MonsterName} 关序应 ${spec.level}，实际 ${m.DungeonLevel}`);
            ok(m.role === 'boss', `${id}/${m.MonsterName} role 应 boss`);
            ok(m.MonsterID === `${spec.pin}_${tier.tag}`, `${id}/${m.MonsterName} MonsterID 不符: ${m.MonsterID}`);

            const a = m.displayAttributes || {};
            const miss = NEED.filter((k) => a[k] === undefined);
            ok(miss.length === 0, `${id}/${m.MonsterName} 缺字段: ${miss.join(',')}`);
            ok(m.MonsterAttributeModifiers?.MonsterHealth === a.health * a.healthBars,
                `${id}/${m.MonsterName} MonsterHealth ≠ health×healthBars`);
            ok(m.MonsterAttributeModifiers?.MonsterDefense === a.defense, `${id}/${m.MonsterName} MonsterDefense ≠ defense`);
            ok(m.MonsterAttributeModifiers?.MonsterCriticalHitRateReduction === a.critRateReduction,
                `${id}/${m.MonsterName} MonsterCriticalHitRateReduction ≠ critRateReduction`);
            ok(m.MonsterAttributeModifiers?.MonsterCriticalDamagePercentReduction === a.critDamageReduction,
                `${id}/${m.MonsterName} MonsterCriticalDamagePercentReduction ≠ critDamageReduction`);

            // 与站点快照逐字段对拍
            const srcId = spec.ids?.[ti];
            const snap = snapshot[String(srcId)];
            if (!snap) {
                fails.push(`${id}/${m.MonsterName} 快照缺 ${srcId}`);
            } else {
                for (const [jk, sk] of Object.entries(SNAP_FIELDS)) {
                    const want = Math.round(Number(snap[sk]));
                    const got = a[jk];
                    if (want !== got) fails.push(`${id}/${m.MonsterName}.${jk}: 快照=${want} 入库=${got}`);
                }
            }
        });
    });

    // 档位单调：气血必须逐档递增（硬断言）；攻击/抗性只做「不下降」的软校验并记录异常
    // ⚠ 攻击确实存在官方非单调（如玄天守卫 T14 299000 > T15 236600），不能当错误
    dungeon.bosses.forEach((boss, bi) => {
        const hp = dungeon.tiers.map((t) => monsters[`${dungeon.dungeonId}_${t.tag}`]?.[bi]?.displayAttributes?.health ?? 0);
        const atk = dungeon.tiers.map((t) => monsters[`${dungeon.dungeonId}_${t.tag}`]?.[bi]?.displayAttributes?.attack ?? 0);
        for (let i = 1; i < hp.length; i++) {
            ok(hp[i - 1] < hp[i], `${boss.name} 气血未随档位递增: ${hp.join(' / ')}`);
            if (atk[i - 1] > atk[i]) notes.push(`${dungeon.seriesShort}/${boss.name} 攻击非单调（原始值）: ${atk.join(' / ')}`);
        }
    });
    const res = dungeon.tiers.map((t) => monsters[`${dungeon.dungeonId}_${t.tag}`]?.[0]?.displayAttributes?.resistance ?? 0);
    for (let i = 1; i < res.length; i++) {
        ok(res[i - 1] <= res[i], `${dungeon.dungeonName} 抗性随档位下降: ${res.join(' / ')}`);
    }
}

// 5. 展示层登记（所有副本，不只是本次新增的）
for (const d of dungeons) {
    ok(metaSrc.includes(`${d.DungeonID}:`), `dungeonMeta.ts 未登记 ${d.DungeonID}（顺序/短名/标签/别名会缺）`);
}
ok(metaSrc.includes("DEFAULT_DUNGEON_ID = 'HUIMENG_LINGYUN_T17'"), 'dungeonMeta.ts 默认副本应为 T17');

// 输出
if (fails.length) {
    console.error(`✗ 副本 BOSS 数据回归失败 ${fails.length} 条：`);
    fails.slice(0, 25).forEach((f) => console.error('  - ' + f));
    if (fails.length > 25) console.error(`  ... 还有 ${fails.length - 25} 条`);
    process.exit(1);
}
notes.forEach((n) => console.log('  ⚠ ' + n));
console.log(`✓ 副本 BOSS 数据回归通过：${config.dungeons.length} 个系列 / ${dungeons.length} 个副本 / ${bossTotal} 条 BOSS；字段自洽 + 档位单调 + 与 res111 快照逐字段一致 + 展示层登记齐全`);

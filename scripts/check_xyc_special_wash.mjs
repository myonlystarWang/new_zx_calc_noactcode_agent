/**
 * 轩辕策「特殊洗练」逻辑回归（纯 Node，不需要浏览器）
 *
 * 覆盖官方 2026-03-31 更新的四条规则 + 数值口径（2026-10-27 用户拍板：新洗词条共用一次新档）：
 *  1. 仅 青龙/白虎 英雄版可进特殊洗练；累计洗练达 25 次后进入，上限 30 → 5 次额度
 *  2. 锁定 ≤2 条：种类与数值均不变、槽位不动；未锁槽位种类与数值都重掷
 *  3. 自选本职业 3 级技能，洗后必得（等级固定 3）
 *  4. 新洗出的词条共用一次新的档位投掷 → 用官方五档表；统计值对齐
 *     doc/轩辕策_洗练概率与锁定策略_20261027.md（1.391% / 8% / 0.111%）
 *
 * 用法：node scripts/check_xyc_special_wash.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const ROOT = 'D:/工作/ww/personal_work/new_zx_calc_noactcode_agent';
const require = createRequire(import.meta.url);

const fails = [];
const ok = (cond, msg) => {
    if (!cond) fails.push(msg);
};
const near = (val, exp, tol, msg) => ok(Math.abs(val - exp) <= tol, `${msg}: 实测 ${val.toFixed(5)} vs 期望 ${exp} ±${tol}`);

// ── 把 TS 引擎打成 cjs 再 require（tsx 在本环境不可用） ──
const bundle = path.join(ROOT, 'scratch', '_xyc_engine.cjs');
fs.mkdirSync(path.dirname(bundle), { recursive: true });
await build({
    entryPoints: [path.join(ROOT, 'web_app/src/utils/xycRefineSim.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bundle,
    logLevel: 'silent',
});
const E = require(bundle);

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'web_app/public/game_data/xyc_refine.json'), 'utf8'));
const ATTR = (id) => data.attrs[String(id)]?.name ?? `#${id}`;

// 青龙英雄六品的池：id 18=致命一击伤害(6%) 15=真气%(8%) 12=攻击%(10%) 14=气血%(10%) 0=固定攻击(10%)
const LOCK_A = 18;
const LOCK_B = 15;
const GOAL = [0, 12, 14];

const identify = (opts, seed = 0x2f6e2b1) => {
    const book = E.identifyBook(data, { version: '英雄', beast: '青龙', grade: 6, level: 0, occ: '鬼王', ...opts }, E.makeRng(seed));
    if (!book) throw new Error('identifyBook 返回 null');
    return book;
};

/** 鉴定一本「指定词条」的书：随机鉴定结果不一定含 爆伤/真气%，锁定自然也就无从谈起 */
const identifyWith = (ids, extra = {}) => {
    const book = identify({});
    const pool = data.pools['英雄']['青龙']['6'];
    const attrs = ids.map((id) => {
        const def = pool.attrs.find((a) => a.id === id);
        return { id, base: def.min + (def.max - def.min) * 0.4 };
    });
    return { ...book, attrs, attrCount: attrs.length, ...extra };
};

// ── 1. 资格与阈值 ──
{
    const normal = identify({ version: '普通' });
    const heroQl = identify({});
    const heroBh = identify({ beast: '白虎' });
    const heroZq = identify({ beast: '朱雀' });
    ok(!E.supportsSpecialWash(normal), '普通版不应具备特殊洗练资格');
    ok(E.supportsSpecialWash(heroQl), '青龙英雄版应具备特殊洗练资格');
    ok(E.supportsSpecialWash(heroBh), '白虎英雄版应具备特殊洗练资格');
    ok(!E.supportsSpecialWash(heroZq), '朱雀英雄版不应具备特殊洗练资格');

    ok(E.SPECIAL_WASH_FROM === 25, '门槛应为 25 次');
    ok(E.SPECIAL_WASH_LOCK_MAX === 2, '锁定上限应为 2 条');
    ok(E.SPECIAL_WASH_SKILL_LEVEL === 3, '必得技能等级应为 3');

    ok(!E.inSpecialWash({ ...heroQl, washUsed: 24, washMax: 30 }), '24 次时不应进入特殊洗练');
    ok(E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 30 }), '25 次时应进入特殊洗练');
    ok(!E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 25 }), '未提升上限（25）时不应进入特殊洗练');
    ok(E.specialWashLeft({ ...heroQl, washUsed: 26, washMax: 30 }) === 4, '第 26 次后应剩 4 次额度');
    ok(E.specialWashLeft({ ...heroQl, washUsed: 10, washMax: 30 }) === 0, '未达门槛时额度应为 0');
}

// ── 1b. 上限阶梯：一次「增加洗练次数」只升一档（2026-10-30 线上反馈） ──
{
    const heroQl = identify({});
    const heroBh = identify({ beast: '白虎' });
    const heroZq = identify({ beast: '朱雀' });
    const normal = identify({ version: '普通' });

    const fmt = (a) => a.join('→');
    ok(fmt(E.washMaxStages(data, '英雄', '青龙')) === '10→25→30', `青龙英雄版阶梯应为 10→25→30，实际 ${fmt(E.washMaxStages(data, '英雄', '青龙'))}`);
    ok(fmt(E.washMaxStages(data, '英雄', '白虎')) === '10→25→30', `白虎英雄版阶梯应为 10→25→30，实际 ${fmt(E.washMaxStages(data, '英雄', '白虎'))}`);
    ok(fmt(E.washMaxStages(data, '英雄', '朱雀')) === '10→25', `朱雀英雄版阶梯应为 10→25（无 30 档），实际 ${fmt(E.washMaxStages(data, '英雄', '朱雀'))}`);
    ok(fmt(E.washMaxStages(data, '普通', '青龙')) === '10→25', `普通版阶梯应为 10→25，实际 ${fmt(E.washMaxStages(data, '普通', '青龙'))}`);

    // 关键回归：洗满 10 次后第一次点「增加洗练次数」只能到 25，不是一步 30
    ok(E.nextWashMax(data, '英雄', '青龙', 10) === 25, '10 次后第一档应到 25（不能一步跳 30）');
    ok(E.nextWashMax(data, '英雄', '青龙', 25) === 30, '25 次后第二档应到 30');
    ok(E.nextWashMax(data, '英雄', '青龙', 30) === null, '到 30 后不应再有下一档');
    ok(E.nextWashMax(data, '英雄', '朱雀', 25) === null, '非青龙/白虎到 25 即封顶');
    ok(E.nextWashMax(data, '普通', '青龙', 25) === null, '普通版到 25 即封顶');

    // 只升到 25 的英雄版不能进特殊洗练（必须再升到 30 才有 25~30 的 5 次额度）
    ok(!E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 25 }), '只升到 25 的英雄版不应进特殊洗练');
    ok(E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 30 }), '升到 30 的英雄版应进特殊洗练');
    ok(!E.inSpecialWash({ ...heroBh, washUsed: 25, washMax: 25 }), '白虎只升到 25 时同样不进特殊洗练');
    ok(!E.inSpecialWash({ ...heroZq, washUsed: 25, washMax: 25 }), '朱雀到 25 后不进特殊洗练');
    ok(!E.inSpecialWash({ ...normal, washUsed: 25, washMax: 25 }), '普通版到 25 后不进特殊洗练');
}

// ── 2. 锁定行为（单次） ──
{
    const base = identifyWith([LOCK_A, LOCK_B, 12, 14, 0], { washUsed: 25, washMax: 30 });
    const skillId = E.specialSkillOptions(data, '青龙', '鬼王')[2].id;
    const res = E.specialWash(data, base, { lockIds: [LOCK_A, LOCK_B], skillId }, '鬼王', E.makeRng(7));
    const nb = res.book;

    ok(nb.attrs.length === base.attrCount, '洗练不应改变属性条数');
    for (const id of [LOCK_A, LOCK_B]) {
        const before = base.attrs.find((a) => a.id === id);
        const after = nb.attrs.find((a) => a.id === id);
        ok(Boolean(before && after), `锁定属性 ${ATTR(id)} 不应消失`);
        if (before && after) {
            ok(Math.abs(before.base - after.base) < 1e-12, `锁定属性 ${ATTR(id)} 数值不应变化`);
            ok(base.attrs.indexOf(before) === nb.attrs.indexOf(after), `锁定属性 ${ATTR(id)} 槽位不应移动`);
        }
    }
    const unlocked = nb.attrs.filter((a) => a.id !== LOCK_A && a.id !== LOCK_B);
    ok(unlocked.length === 3, `未锁槽位应为 3 条，实际 ${unlocked.length}`);
    ok(new Set(nb.attrs.map((a) => a.id)).size === nb.attrs.length, '同一次洗练不应出现重复属性');
    ok(unlocked.every((a) => a.id !== LOCK_A && a.id !== LOCK_B), '未锁槽位不应再抽到已锁属性');
    for (const a of unlocked) {
        const def = data.pools['英雄']['青龙']['6'].attrs.find((x) => x.id === a.id);
        ok(a.base >= def.min && a.base <= def.max, `${ATTR(a.id)} 数值 ${a.base} 越界 [${def.min}, ${def.max}]`);
    }
    ok(nb.skill && nb.skill.id === skillId, '特殊洗练应必得所选技能');
    ok(nb.skill && nb.skill.level === 3, `所选技能应为 3 级，实际 ${nb.skill?.level}`);
    ok(nb.washUsed === 26 && nb.washTotal === base.washTotal + 1, '洗练次数应 +1');
    ok(res.changed.some((c) => c.kind === 'skill'), '技能变化应出现在变化摘要里');
}

// ── 3. 锁定 0 条 / 超过 2 条 / 未达门槛 ──
{
    const base = identifyWith([LOCK_A, LOCK_B, 12, 14, 0], { washUsed: 25, washMax: 30 });
    const s0 = E.specialWash(data, base, { lockIds: [], skillId: null }, '鬼王', E.makeRng(11)).book;
    ok(s0.attrs.length === 5, '不锁时仍应洗出 5 条');

    const three = base.attrs.slice(0, 3).map((a) => a.id);
    const s3 = E.specialWash(data, base, { lockIds: three, skillId: null }, '鬼王', E.makeRng(13)).book;
    const kept = three.filter((id) => Math.abs((s3.attrs.find((a) => a.id === id)?.base ?? -1) - (base.attrs.find((a) => a.id === id)?.base ?? -2)) < 1e-12);
    ok(kept.length === 2, `超过 2 条的锁定应被截断为 2 条，实际保留 ${kept.length} 条`);

    const early = { ...base, washUsed: 24 };
    const r = E.specialWash(data, early, { lockIds: [], skillId: null }, '鬼王', E.makeRng(17));
    ok(r.book === early && r.changed.length === 0, '未达 25 次时特殊洗练应拒绝执行');
}

// ── 4. 统计口径（对齐文档 1.391% / 8% / 0.111%） ──
{
    const N = 200000;
    const rng = E.makeRng(0x9e3779b9);
    const base = identifyWith([LOCK_A, LOCK_B, 12, 14, 0], { washUsed: 25, washMax: 30 });
    const skillId = E.specialSkillOptions(data, '青龙', '鬼王')[0].id;
    let goalHits = 0;
    let highTier = 0;
    let both = 0;
    let dup = 0;
    let oob = 0;
    for (let i = 0; i < N; i++) {
        const nb = E.specialWash(data, base, { lockIds: [LOCK_A, LOCK_B], skillId }, '鬼王', rng).book;
        const ids = nb.attrs.filter((a) => a.id !== LOCK_A && a.id !== LOCK_B).map((a) => a.id);
        const goal = ids.length === 3 && GOAL.every((g) => ids.includes(g));
        const hi = nb.tier >= 3;
        if (goal) goalHits++;
        if (hi) highTier++;
        if (goal && hi) both++;
        if (new Set(nb.attrs.map((a) => a.id)).size !== nb.attrs.length) dup++;
        for (const a of nb.attrs) {
            const def = data.pools['英雄']['青龙']['6'].attrs.find((x) => x.id === a.id);
            if (!def || a.base < def.min - 1e-9 || a.base > def.max + 1e-9) oob++;
        }
    }
    const pGoal = goalHits / N;
    const pHi = highTier / N;
    const pBoth = both / N;
    near(pGoal, 0.013909, 0.0012, `锁 爆伤+真气% 后 3 条全中概率（文档 1.391%）`);
    near(pHi, 0.08, 0.0024, `新档 ≥ 紫（文档 8%）`);
    near(pBoth, 0.001113, 0.0003, `单次特殊洗练成功（文档 0.111%）`);
    ok(dup === 0, `抽样 ${N} 次出现重复属性 ${dup} 次`);
    ok(oob === 0, `抽样 ${N} 次出现越界数值 ${oob} 次`);
    console.log(
        `  统计：全中 ${(pGoal * 100).toFixed(3)}% · 档≥紫 ${(pHi * 100).toFixed(2)}% · 同时满足 ${(pBoth * 100).toFixed(4)}%（N=${N}）`,
    );
}

// ── 5. 上限 30 与 5 次额度可连洗 ──
{
    let book = identifyWith([LOCK_A, LOCK_B, 12, 14, 0], { washUsed: 25, washMax: 30 });
    const skillId = E.specialSkillOptions(data, '青龙', '鬼王')[0].id;
    const rng = E.makeRng(0x1234);
    let n = 0;
    while (E.inSpecialWash(book) && n < 10) {
        book = E.specialWash(data, book, { lockIds: [LOCK_A], skillId }, '鬼王', rng).book;
        n++;
    }
    ok(n === 5, `25 次后应还能洗 5 次（上限 30），实际 ${n} 次`);
    ok(book.washUsed === 30, `连洗后次数应为 30，实际 ${book.washUsed}`);
    ok(!E.inSpecialWash(book), '额度用尽后不应再进入特殊洗练');
}

if (fails.length) {
    console.error(`✗ 轩辕策特殊洗练回归失败 ${fails.length} 项：`);
    fails.forEach((f) => console.error('  - ' + f));
    process.exit(1);
}
console.log('✓ 轩辕策特殊洗练回归通过（资格 / 锁定 / 技能必得 / 统计口径 / 5 次额度）');

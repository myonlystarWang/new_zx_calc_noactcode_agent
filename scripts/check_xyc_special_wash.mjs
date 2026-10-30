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

// ── 1b. 上限阶梯：五档「轩辕拾遗录」逐档提升（2026-10-30 玩家提供道具说明） ──
{
    const normalQl = identify({ version: '普通' });
    const heroQl = identify({});
    const heroBh = identify({ beast: '白虎' });
    const heroZq = identify({ beast: '朱雀' });
    const heroXw = identify({ beast: '玄武' });

    const fmt = (a) => a.join('→');
    // 封顶只看系别：青龙 / 白虎 30，朱雀 / 玄武 25；普通 / 典藏 / 英雄完全一样
    ok(fmt(E.washMaxStages(data, '青龙')) === '10→14→17→20→25→30', `青龙应为 10→14→17→20→25→30，实际 ${fmt(E.washMaxStages(data, '青龙'))}`);
    ok(fmt(E.washMaxStages(data, '白虎')) === '10→14→17→20→25→30', `白虎应为 10→14→17→20→25→30，实际 ${fmt(E.washMaxStages(data, '白虎'))}`);
    for (const beast of ['朱雀', '玄武']) {
        ok(fmt(E.washMaxStages(data, beast)) === '10→14→17→20→25',
            `${beast} 应为 10→14→17→20→25，实际 ${fmt(E.washMaxStages(data, beast))}`);
    }
    // 版本无关（普通版与英雄版完全一致）—— 2026-10-30 玩家确认。
    // 引擎签名已不含 version，从结构上杜绝「按版本分支」；这里只断言封顶来自系别表。
    ok(data.meta.washMaxCapByBeast?.['青龙'] === 30 && data.meta.washMaxCapByBeast?.['朱雀'] === 25,
        'washMaxCapByBeast 应为 青龙 30 / 朱雀 25');
    ok(E.washMaxSteps(data, '朱雀').length === 4, '朱雀只应有 4 档（无相易）');
    ok(E.washMaxSteps(data, '玄武').length === 4, '玄武只应有 4 档（无相易）');

    // 每档绑定的道具、加次数、星级、兑换来源
    const steps = E.washMaxSteps(data, '青龙');
    ok(steps.map((x) => x.item).join('/') ===
        '轩辕拾遗录·逍遥/轩辕拾遗录·秋水/轩辕拾遗录·齐物/轩辕拾遗录·尽年/轩辕拾遗录·相易',
        `道具顺序不对：${steps.map((x) => x.item).join('/')}`);
    ok(steps.map((x) => x.add).join('+') === '4+3+3+5+5', `加次数应为 4+3+3+5+5，实际 ${steps.map((x) => x.add).join('+')}`);
    ok(steps.map((x) => x.star).join('') === '12345', `星级应为 1~5，实际 ${steps.map((x) => x.star).join('')}`);
    ok(steps.reduce((a, b) => a + b.add, data.meta.baseWashMax) === 30, '五档加满应正好到 30');
    for (const st of steps) {
        ok(fs.existsSync(path.join(ROOT, 'web_app/public/game_data/equip_icons', st.icon)), `图标文件缺失：${st.icon}`);
    }
    // 兑换链：逍遥为基础档；其后每档 2 换 1；相易是尽年 ×1 + 帝鸿玄章 ×50000
    ok(!steps[0].from, '逍遥应为基础档（无前置）');
    const chain = steps.slice(1).map((x) => `${x.from}×${x.need}`).join('|');
    ok(chain === '轩辕拾遗录·逍遥×2|轩辕拾遗录·秋水×2|轩辕拾遗录·齐物×2|轩辕拾遗录·尽年×1',
        `兑换链不对：${chain}`);
    ok((steps[4].note || '').includes('50000'), `相易应注明帝鸿玄章 50000，实际 ${steps[4].note}`);
    // 折算到基础档：相易 = 8 个逍遥
    ok(steps.slice(1).reduce((n, x) => n * (x.need ?? 1), 1) === 8, '相易应折算为 8 个逍遥');

    // 星级：新鉴定的策 0 星，每用一档拾遗录 +1 星，用满 5 档 = 5 星（2026-10-30 玩家拍板）
    ok(identify({}).star === 0, '新鉴定的策应为 0 星');
    ok(identify({ version: '普通' }).star === 0, '新鉴定的普通版也应为 0 星');

    // 逐档推进：每次只进一档，到顶返回 null
    const chainTo = [];
    let cur = 10;
    for (let i = 0; i < 6; i++) {
        const nx = E.nextWashMax(data, '青龙', cur);
        if (nx === null) break;
        chainTo.push(nx);
        cur = nx;
    }
    ok(chainTo.join('→') === '14→17→20→25→30', `逐档推进应为 14→17→20→25→30，实际 ${chainTo.join('→')}`);
    ok(E.nextWashMax(data, '青龙', 30) === null, '到 30 后不应再有下一档');
    ok(E.nextWashMax(data, '朱雀', 25) === null, '朱雀到 25 即封顶');
    ok(E.nextWashMax(data, '玄武', 25) === null, '玄武到 25 即封顶');

    // 下一档必须带上「这一档该用什么道具」
    ok(E.nextWashStep(data, '青龙', 10)?.item === '轩辕拾遗录·逍遥', '10 次后下一档应用逍遥');
    ok(E.nextWashStep(data, '青龙', 20)?.item === '轩辕拾遗录·尽年', '20 次后下一档应用尽年');
    ok(E.nextWashStep(data, '青龙', 25)?.item === '轩辕拾遗录·相易', '25 次后下一档应用相易');
    ok(E.nextWashStep(data, '青龙', 30) === null, '到顶后不应有下一档道具');

    // 只升到 25 的青龙不能进特殊洗练（必须再升到 30 才有 25~30 的 5 次额度）
    ok(!E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 25 }), '只升到 25 的青龙不应进特殊洗练');
    ok(E.inSpecialWash({ ...heroQl, washUsed: 25, washMax: 30 }), '升到 30 的青龙应进特殊洗练');
    ok(!E.inSpecialWash({ ...heroBh, washUsed: 25, washMax: 25 }), '白虎只升到 25 时同样不进特殊洗练');
    ok(!E.inSpecialWash({ ...heroZq, washUsed: 25, washMax: 25 }), '朱雀到 25 后不进特殊洗练');
    ok(!E.inSpecialWash({ ...heroXw, washUsed: 25, washMax: 25 }), '玄武到 25 后不进特殊洗练');
    ok(!E.inSpecialWash({ ...normalQl, washUsed: 25, washMax: 25 }), '普通青龙到 25 后不进特殊洗练（普通版最高也是 30，但这条用 25 上限验证不进特殊区间）');
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

#!/usr/bin/env node
/**
 * 识图校对卡 + 引擎真算 一键自检
 *
 * 为什么要有它：断言原来躺在 scratch/（被 .gitignore 忽略），换个会话就没人能复现。
 * 用法：
 *   node scripts/vision_check.mjs            # 两段都跑
 *   node scripts/vision_check.mjs --card     # 只跑卡片 SSR
 *   node scripts/vision_check.mjs --engine   # 只跑引擎真算
 *
 * 不联网、不需要浏览器：卡片用 react-dom/server 渲 HTML 后做机械断言；
 * 引擎直接把 web_app/public/game_data 里的真数据注入 DataService。
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GD = path.join(ROOT, 'web_app/public/game_data');
const SRC = path.join(ROOT, 'web_app/src');
// 中间产物放 node_modules/.cache：react 等 external 依赖要靠它向上找 node_modules
const TMP = path.join(ROOT, 'node_modules', '.cache', `zx-vision-${process.pid}`);
fs.mkdirSync(TMP, { recursive: true });

const argv = process.argv.slice(2);
const only = argv.find(a => a.startsWith('--')) || '--all';
const doCard = only === '--all' || only === '--card';
const doEngine = only === '--all' || only === '--engine';

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const pj = (p) => p.replace(/\\/g, '/');

async function bundle(name, entrySource) {
    const entry = path.join(TMP, `${name}.tsx`);
    const outfile = path.join(TMP, `${name}.mjs`);
    fs.writeFileSync(entry, entrySource, 'utf8');
    await build({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node18',
        outfile,
        logLevel: 'error',
        jsx: 'automatic',
        loader: { '.tsx': 'tsx', '.ts': 'ts' },
        external: ['react', 'react-dom', 'react-dom/server', 'clsx', 'lucide-react']
    });
    return import(pathToFileURL(outfile).href);
}

/* =========================== A. 卡片 SSR =========================== */
async function runCardChecks() {
    const mod = await bundle('card', `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VisionReviewCard } from '${pj(SRC)}/components/vision/VisionReviewCard';
import { fromServerPanel, degradedPanel } from '${pj(SRC)}/services/vision/adapters';
export { React, renderToStaticMarkup, VisionReviewCard, fromServerPanel, degradedPanel };
`);
    const { React, renderToStaticMarkup, VisionReviewCard, fromServerPanel, degradedPanel } = mod;
    const h = React.createElement;
    const render = (panel) => renderToStaticMarkup(h(VisionReviewCard, {
        panel,
        onOpenXyc: () => {},
        onOpenTianyuan: () => {},
        onImport: () => {},
        onArchive: () => {}
    }));

    const PANEL = {
        panelKind: 'character_panel', kindConfidence: 0.94, kindEvidence: ['致命一击'],
        textLines: [
            { label: '攻击', raw: '26918-151478' }, { label: '防御', raw: '30545' },
            { label: '气血', raw: '814972/1604910' }, { label: '真气', raw: '1145140/2983930' },
            { label: '致命伤害', raw: '1889.6%' }, { label: '致命一击', raw: '261.0%' }
        ],
        fields: [
            { key: 'attackMin', label: '攻击', raw: '26918-151478', value: 26918, status: 'ok' },
            { key: 'attackMax', label: '攻击', raw: '26918-151478', value: 151478, status: 'ok' },
            { key: 'defense', label: '防御', raw: '30545', value: 30545, status: 'ok' },
            { key: 'health', label: '气血', raw: '814972/1604910', value: 1604910, status: 'ok' },
            { key: 'mana', label: '真气', raw: '1145140/2983930', value: 2983930, status: 'ok' },
            { key: 'critDamage', label: '致命伤害', raw: '1889.6%', value: 1889.6, status: 'ok' },
            { key: 'critRate', label: '致命一击', raw: '261.0%', value: 261, status: 'ok' },
            { key: 'monsterDamageBonus', label: null, raw: null, value: null, status: 'absent' }
        ],
        character: { classRaw: '逐霜', factionRaw: '魔', levelRaw: '175' }
    };

    const XYC = {
        panelKind: 'xyc', kindConfidence: 0.9, kindEvidence: ['洗炼次数'],
        textLines: [{ label: '洗炼次数', raw: '4/10' }],
        fields: [
            { key: 'beast', label: '四象', raw: '青龙', value: '青龙', status: 'ok' },
            { key: 'bookName', label: '书名', raw: '青囊玉书', value: '青囊玉书', status: 'ok' },
            { key: 'tier', label: '品阶', raw: '六品', value: '六品', status: 'ok' },
            { key: 'stars', label: '星级', raw: '★★★★★', value: 5, status: 'ok' },
            { key: 'washUsed', label: '洗炼次数', raw: '4/10', value: 4, status: 'ok' },
            { key: 'level', label: '等级', raw: '1', value: 1, status: 'ok' },
            { key: 'advSkillName', label: '进阶技能', raw: '山雨欲来III', value: '山雨欲来III', status: 'ok' },
            { key: 'advSkillVariant', label: '进阶技能', raw: '《天空》', value: '天空', status: 'ok' },
            { key: 'advSkillLevel', label: '进阶技能', raw: '1级', value: 1, status: 'ok' }
        ]
    };

    const TY_NEW = {
        panelKind: 'tianyuan', kindConfidence: 0.9, kindEvidence: ['天命'],
        textLines: [{ label: '天缘', raw: '天缘+10' }],
        fields: [
            { key: 'name', label: '名称', raw: '上玄佑万辰须弥盔', value: '上玄佑万辰须弥盔', status: 'ok' },
            { key: 'part', label: '部位', raw: '盔', value: '盔', status: 'ok' },
            { key: 'tianyuanLevel', label: '天缘等级', raw: '天缘+10', value: 10, status: 'ok' }
        ],
        attrs: [{ tianming: 2, name: '真气', value: '+5.8%' }, { tianming: 1, name: '固定攻击', value: '+2057' }]
    };

    const TY_OLD = { ...TY_NEW, fields: TY_NEW.fields.map(f => f.key === 'name' ? { ...f, value: '天命·头盔' } : f) };

    const MISALIGNED = { ...PANEL, fields: PANEL.fields.map(f => f.key === 'critRate' ? { key: 'critRate', label: '普攻命中', raw: '3610', value: 3610, status: 'ok' } : f) };

    const cases = {
        'role-panel': fromServerPanel(PANEL, 'data:image/png;base64,x', { provider: 'cf-workers-ai:mistral', quality: 'full' }),
        'role-misaligned': fromServerPanel(MISALIGNED, null, {}),
        'xyc': fromServerPanel(XYC, null, {}),
        'tianyuan-new': fromServerPanel(TY_NEW, null, {}),
        'tianyuan-old': fromServerPanel(TY_OLD, null, {}),
        'degraded': degradedPanel({ degradedReason: 'no_key', lastError: 'AI binding 未注入' }, null)
    };

    const html = {};
    for (const [id, panel] of Object.entries(cases)) html[id] = render(panel);

    console.log('── A. 卡片 SSR ─────────────────────────────');
    for (const [id, h2] of Object.entries(html)) {
        const p = cases[id];
        const okFields = p.fields.filter(f => f.status === 'ok').length;
        console.log(`  ${id.padEnd(16)} kind=${String(p.kind).padEnd(16)} ok=${okFields}/${p.fields.length} len=${h2.length}`);
    }

    ok(Boolean(html['role-panel'].includes('data-testid="vision-review-card"')), '角色面板卡缺 data-testid');
    ok(cases['role-panel'].fields.filter(f => f.status === 'ok').length === 7, '角色面板应 7 项 ok');
    ok((html['role-panel'].match(/data-field-status="absent"/g) || []).length === 1, '角色面板应恰好 1 项 absent（对怪增伤）');
    ok(cases['role-panel'].engine.attrs.CharacterMaxAttack === 151478, '引擎未映射最大攻');
    ok(cases['role-panel'].engine.attrs.CharacterCriticalHitDamagePercent === 1889.6, '爆伤刻度应为 0-100（1889.6）');
    ok(html['role-panel'].includes('151,478'), '卡上未显示 151,478');
    ok(!html['role-panel'].includes('data-action="open-xyc"'), '角色面板卡不该出现轩辕策按钮');
    ok(!html['role-panel'].includes('data-action="open-tianyuan"'), '角色面板卡不该出现天缘按钮');
    ok(html['role-panel'].includes('data-buff-key="BUFF_FOCUS_EFFECT"'), '缺四项战斗增益输入');

    ok((html['role-misaligned'].match(/data-field-status="invalid"/g) || []).length >= 1, '错位字段未被判 invalid');
    ok(!html['role-misaligned'].includes('3,610'), '错位值不应显示为合法数值');

    ok(html['xyc'].includes('data-action="open-xyc"'), '轩辕策卡缺「打开轩辕策模拟」');
    ok(html['xyc'].includes('六品') && html['xyc'].includes('山雨欲来III'), '轩辕策卡缺品阶/进阶技能');
    ok(!html['xyc'].includes('data-action="open-tianyuan"'), '轩辕策卡不该出现天缘按钮');

    ok(html['tianyuan-new'].includes('data-tianyuan-kind="new"'), '新天缘应判为 new');
    ok(html['tianyuan-new'].includes('查新天缘词条池'), '新天缘按钮文案不对');
    ok(html['tianyuan-old'].includes('data-tianyuan-kind="old"'), '旧天缘应判为 old');
    ok(html['tianyuan-old'].includes('查旧天缘图鉴'), '旧天缘按钮文案不对');
    ok(html['tianyuan-new'].includes('+5.8%'), '天缘词条行未渲染');

    ok(cases['degraded'].fields.every(f => f.status === 'absent'), '降级态不该有 ok 字段');
    ok(html['degraded'].includes('vision-degraded'), '降级态缺受限提示条');
}

/* =========================== B. 引擎真算 =========================== */
async function runEngineChecks() {
    const mod = await bundle('engine', `
export { DataService } from '${pj(SRC)}/services/DataService';
export { runPanelSimulation, DEFAULT_COMBAT_BUFFS } from '${pj(SRC)}/services/vision/runPanelSimulation';
export { fromServerPanel } from '${pj(SRC)}/services/vision/adapters';
export { classCoverage } from '${pj(SRC)}/services/vision/classCoverage';
`);
    const { DataService, runPanelSimulation, DEFAULT_COMBAT_BUFFS, fromServerPanel, classCoverage } = mod;

    const skills = readJson(path.join(GD, 'skills.json'));
    const monstersByDungeon = readJson(path.join(GD, 'dungeons_monsters.json'));
    const dungeons = readJson(path.join(GD, 'dungeons.json'));
    const classes = readJson(path.join(GD, 'classes.json'));
    const combatBuffs = readJson(path.join(GD, 'combat_buffs.json'));

    const ds = DataService.getInstance();
    ds.getAllSkills = () => skills;
    ds.getDungeonsMonsters = () => monstersByDungeon;
    ds.getDungeons = () => dungeons;
    ds.getClasses = () => classes;
    ds.getBuffs = () => combatBuffs;

    const dungeonId = Object.keys(monstersByDungeon).find(k => (monstersByDungeon[k] || []).length > 0);
    const boss = monstersByDungeon[dungeonId][0];
    const target = {
        dungeonId,
        dungeonName: (dungeons.find(d => d.DungeonID === dungeonId) || {}).DungeonName || dungeonId,
        bossId: boss.MonsterID,
        bossName: boss.MonsterName
    };

    // 仙昭冥真面板的数值，换职业标签（用户口径）
    const panel = (classRaw, factionRaw, withBonus = true) => fromServerPanel({
        panelKind: 'character_panel', kindConfidence: 0.94, kindEvidence: ['致命一击'],
        textLines: [
            { label: '攻击', raw: '26918-151478' }, { label: '防御', raw: '30545' },
            { label: '气血', raw: '814972/1604910' }, { label: '真气', raw: '1145140/2983930' },
            { label: '致命伤害', raw: '1889.6%' }, { label: '致命一击', raw: '261.0%' }
        ],
        fields: [
            { key: 'attackMin', label: '攻击', raw: '26918-151478', value: 26918, status: 'ok' },
            { key: 'attackMax', label: '攻击', raw: '26918-151478', value: 151478, status: 'ok' },
            { key: 'defense', label: '防御', raw: '30545', value: 30545, status: 'ok' },
            { key: 'health', label: '气血', raw: '814972/1604910', value: 1604910, status: 'ok' },
            { key: 'mana', label: '真气', raw: '1145140/2983930', value: 2983930, status: 'ok' },
            { key: 'critDamage', label: '致命伤害', raw: '1889.6%', value: 1889.6, status: 'ok' },
            { key: 'critRate', label: '致命一击', raw: '261.0%', value: 261, status: 'ok' },
            withBonus
                ? { key: 'monsterDamageBonus', label: '对怪增伤', raw: '43.8%', value: 43.8, status: 'ok' }
                : { key: 'monsterDamageBonus', label: null, raw: null, value: null, status: 'absent' }
        ],
        character: { classRaw, factionRaw, levelRaw: '175' }
    }, null, { provider: 'vision_check' });

    const cases = [
        { id: '逐霜·魔', panel: panel('逐霜', '魔'), expect: 'ok' },
        { id: '鬼王·魔', panel: panel('鬼王', '魔'), expect: 'ok' },
        { id: '涅羽·仙', panel: panel('涅羽', '仙'), expect: 'ok' },
        { id: '昭冥·仙', panel: panel('昭冥', '仙'), expect: 'FACTION_EMPTY' },
        { id: '昭冥·佛', panel: panel('昭冥', '佛'), expect: 'NO_DAMAGE_SKILL' },
        { id: '缺对怪增伤', panel: panel('逐霜', '魔', false), expect: 'ENGINE_INPUT_INCOMPLETE' }
    ];

    console.log('\n── B. 引擎真算 ─────────────────────────────');
    console.log(`  目标：${target.dungeonName} · ${target.bossName}`);

    for (const c of cases) {
        const cov = classCoverage(c.panel.character?.classRaw, c.panel.character?.factionRaw);
        const out = runPanelSimulation(c.panel, target, DEFAULT_COMBAT_BUFFS);
        if (out.ok) {
            console.log(`  ${c.id.padEnd(12)} ✅ ${(out.trace.result.power / 1e8).toFixed(2)} 亿  技能 ${cov.skillCount}/输出 ${cov.damageSkillCount}  buffs ${out.trace.buffIds.length}  trace ${out.trace.attrsHash}`);
            ok(c.expect === 'ok', `${c.id} 本应被拒（${c.expect}）却算出来了`);
            ok(out.trace.result.power > 0, `${c.id} 战力应为正数`);
            ok(Boolean(out.trace.attrsHash), `${c.id} 缺 trace`);
        } else {
            console.log(`  ${c.id.padEnd(12)} ⛔ ${out.code} — ${out.message}`);
            ok(c.expect !== 'ok', `${c.id} 本应能算，实际 ${out.code}`);
            ok(out.code === c.expect, `${c.id} 期望 ${c.expect}，实际 ${out.code}`);
        }
    }

    // 四项增益是否真的进引擎
    const withBuffs = runPanelSimulation(panel('逐霜', '魔'), target, DEFAULT_COMBAT_BUFFS);
    const zeroBuffs = runPanelSimulation(panel('逐霜', '魔'), target, {
        BUFF_FOCUS_EFFECT: 0, BUFF_HOLYWRATH_EFFECT: 0, BUFF_MON_CRITDAMAGE_EFFECT: 0, BUFF_MON_HARMED_EFFECT: 0
    });
    const wb = withBuffs.ok ? withBuffs.trace.result.power : 0;
    const zb = zeroBuffs.ok ? zeroBuffs.trace.result.power : 0;
    console.log(`  增益影响：带增益 ${(wb / 1e8).toFixed(2)} 亿 vs 清零 ${(zb / 1e8).toFixed(2)} 亿`);
    ok(wb > zb, '四项增益未真正参与计算（带增益应大于清零）');
}

/* =========================== 入口 =========================== */
try {
    if (doCard) await runCardChecks();
    if (doEngine) await runEngineChecks();
} finally {
    fs.rmSync(TMP, { recursive: true, force: true });
}

console.log('');
if (fails.length) {
    console.log(`❌ ${fails.length} 项失败：`);
    for (const f of fails) console.log('   · ' + f);
    process.exitCode = 1;
} else {
    console.log('✅ 全部通过');
}

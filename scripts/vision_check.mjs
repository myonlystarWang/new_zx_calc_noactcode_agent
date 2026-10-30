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
const doCeiling = only === '--all' || only === '--ceiling';

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
/** 识图结果 → 会话消息的路由层（判定「出卡 / 只回文字」的唯一入口） */
async function bundleMsg() {
    return bundle('msg', `
export { buildVisionMessage } from '${pj(SRC)}/services/vision/buildVisionMessage';
`);
}

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

    /** 用户原图回归：mistral 把「上玄佑万辰须弥刃」读成「上古佑万辰颈弓刃」，图上也没有「天缘+N」。
     *  这两点都不该让它掉进「角色属性面板 / 带入计算器」。 */
    const TY_BLADE = {
        panelKind: 'tianyuan', kindConfidence: 0.8, kindEvidence: ['天缘', '天命'],
        textLines: [{ label: '天缘', raw: '天缘' }, { label: '天命', raw: '致命一击率 +2.1%' }],
        fields: [
            { key: 'name', label: '名称', raw: '上古佑万辰颈弓刃', value: '上古佑万辰颈弓刃', status: 'ok' },
            { key: 'part', label: '部位', raw: '上古佑万辰颈弓刃', value: '刃', status: 'ok' }
        ],
        attrs: [
            { tianming: 1, name: '致命一击率', value: '+2.1%' },
            { tianming: 1, name: '固定攻击', value: '+1000' },
            { tianming: 1, name: '克佛', value: '+3.4%' },
            { tianming: 1, name: '无视伤害减免', value: '+2.9%' },
            { tianming: 1, name: '攻击', value: '+1.4%' }
        ]
    };

    const MISALIGNED = { ...PANEL, fields: PANEL.fields.map(f => f.key === 'critRate' ? { key: 'critRate', label: '普攻命中', raw: '3610', value: 3610, status: 'ok' } : f) };

    const cases = {
        'role-panel': fromServerPanel(PANEL, 'data:image/png;base64,x', { provider: 'cf-workers-ai:mistral', quality: 'full' }),
        'role-misaligned': fromServerPanel(MISALIGNED, null, {}),
        'xyc': fromServerPanel(XYC, null, {}),
        'tianyuan-new': fromServerPanel(TY_NEW, null, {}),
        'tianyuan-old': fromServerPanel(TY_OLD, null, {}),
        'tianyuan-ocr-name': fromServerPanel(TY_BLADE, null, {}),
        'degraded': degradedPanel({ degradedReason: 'no_key', lastError: 'AI binding 未注入' }, null),
        'degraded-tianyuan': degradedPanel({ degradedReason: 'non_standard', recognizedKind: 'tianyuan', lastError: '非标准面板[SIGNATURE_MISSING]: …' }, null)
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
    // 只数栅格行：资源条也带 data-field-status，但要靠 data-bar 区分。
    // （旧断言写死 ===1，自 2026-10-29 属性行扩充后一直是红的，见 doc 待办）
    const gridAbsent = (h2) => (h2.match(/data-field-status="absent"(?! data-bar)/g) || []).length;
    ok(gridAbsent(html['role-panel']) === 7, `角色面板栅格 absent 行数应为 7，实际 ${gridAbsent(html['role-panel'])}`);
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

    /* 天缘卡 = 金色标题 + 逐行天命档；名称/部位不在栅格重复，部位 tab 与天缘加减已按用户口径移除 */
    ok(html['tianyuan-new'].includes('data-testid="vision-tianyuan-body"'), '天缘卡缺天缘版式 body');
    ok(!html['tianyuan-new'].includes('data-part="'), '天缘卡不该再有 甲/刃/盔 部位切换（标题已写明部位）');
    ok(!html['tianyuan-new'].includes('data-testid="vision-hint"'), '天缘卡不该再有底部虚线说明');
    ok(!html['tianyuan-new'].includes('data-field-key="name"'), '天缘卡不该再在栅格里重复「名称」行');
    ok(html['tianyuan-new'].includes('天缘 +10'), '天缘标题应带天缘等级');
    /* 天命档必须逐行显示，且能点改（用户口径：图上有天命+几就要看得见） */
    ok(html['tianyuan-new'].includes('天命+2') && html['tianyuan-new'].includes('天命+1'), '天缘词条行应显示每行的「天命+N」');
    ok((html['tianyuan-new'].match(/data-tianyuan-attr=/g) || []).length === 2, '天缘词条应逐行渲染（条数按图上实际行数）');
    /* 配色 = 新天缘模拟器同一套炼器色阶（玩家认过的颜色不能变）：+1 淡紫 / +2 淡绿 / +10 黄绿 */
    ok(html['tianyuan-new'].includes('#f2d3ff') && html['tianyuan-new'].includes('#bcffd2'), '天命档必须按炼器色阶着色（+1 淡紫 #f2d3ff / +2 淡绿 #bcffd2）');
    ok(html['tianyuan-new'].includes('#c5ff54'), '天缘 +10 必须用 +10 的炼器色 #c5ff54（与模拟器一致）');

    /* 轩辕策卡 = 游戏 tooltip 版式（对齐 XycTomeDetailCard）：书名 → 品阶+星级 → 洗炼次数 → 等级 → 词条
       2026-10-31 口径：四系由识别决定不再给切换；等级去掉 −/+；品阶仍是可改的下拉 */
    ok(html['xyc'].includes('data-testid="vision-xyc-body"'), '轩辕策卡缺 tooltip 版式 body');
    ok(!html['xyc'].includes('data-beast='), '四系不该再有切换按钮（标题已写明）');
    ok(!html['xyc'].includes('>−<'), '轩辕策等级不该再有 −/+ 步进（改回虚线点击编辑）');
    ok((html['xyc'].match(/<select/g) || []).length === 1, '品阶应仍是唯一的下拉（做成看起来像文字的样子）');
    ok(html['xyc'].includes('data-xyc-hero="1"'), '版本仍要能点（书名后缀的虚线）');
    ok(html['xyc'].indexOf('洗炼次数') > 0 && html['xyc'].indexOf('洗炼次数') < html['xyc'].indexOf('等级'),
        '洗炼次数应在等级之上（游戏 tooltip 顺序）');
    ok(html['xyc'].indexOf('等级') < html['xyc'].indexOf('（进阶技能）'), '等级应在词条/进阶技能之上（游戏 tooltip 顺序）');
    ok(!html['xyc'].includes('<h4'), '轩辕策卡不该再有重复的顶部标题栏');

    /* 降级时直接把「怎么截」摊开 */
    ok(html['degraded'].includes('data-testid="vision-capture-guide"'), '降级态缺「怎么截图」指引');

    // 名字被 OCR 读错 + 没有「天缘+N」时，仍然是天缘卡，且必须命中「新天缘」而不被送去旧图鉴
    ok(cases['tianyuan-ocr-name'].kind === 'tianyuan', '读错名字的天缘图不该退回角色面板');
    ok(html['tianyuan-ocr-name'].includes('data-action="open-tianyuan"'), '读错名字的天缘卡缺天缘入口');
    ok(html['tianyuan-ocr-name'].includes('data-tianyuan-kind="new"'), '「万辰」系列应判新天缘（否则会被送去旧图鉴）');
    ok(!html['tianyuan-ocr-name'].includes('data-action="import"'), '天缘卡不该出现「带入计算器」');
    ok(cases['tianyuan-ocr-name'].attrs.length === 5, '天缘 5 条天命应全部保留');

    ok(cases['degraded'].fields.every(f => f.status === 'absent'), '降级态不该有 ok 字段');
    ok(html['degraded'].includes('vision-degraded'), '降级态缺受限提示条');
    ok(cases['degraded-tianyuan'].kind === 'tianyuan', '降级时也要保留服务端认出的体系（否则默认角色面板 → 战力计算）');

    /* 资源条常驻：气血/真气是引擎必填，没识别到也必须有一条能点的空条。
       （旧实现 `if (!max) return null` → 条整个消失，栅格里又被 hideInGrid 掉，等于无处可填） */
    for (const id of ['role-panel', 'degraded']) {
        ok(html[id].includes('data-bar="气血"'), `${id}：缺气血条`);
        ok(html[id].includes('data-bar="真气"'), `${id}：缺真气条`);
        ok(/data-bar="气血"[^>]*>\s*(<div[^>]*><\/div>)?\s*<button/.test(html[id]), `${id}：气血条不可点`);
    }
    ok(html['degraded'].includes('气血未识别 · 点此填写上限'), '降级态气血空条缺手填引导');
    ok(!html['degraded'].includes('data-field-status="absent" data-bar="第三槽"'), '降级态不该凭空造第三槽');

    // 窄容器文案：老的「未识别 · 点此填写」在 2 列栅格里把行顶出卡外（资源条是全宽，不受此限）
    for (const [id, h2] of Object.entries(html)) {
        ok(!h2.includes('>未识别 · 点此填写<'), `${id}：栅格仍出现过长的「未识别 · 点此填写」`);
    }

    /* 降级 + 天缘 / 轩辕策：不许硬塞「角色属性面板 / 带入计算器」卡，只能文字回复 */
    const { buildVisionMessage } = await bundleMsg();
    const msgDeleted = (kind) => buildVisionMessage(
        { mode: 'general', rawExplanation: '天缘图没读到完整词条行。', degraded: true, degradedReason: 'non_standard', recognizedKind: kind },
        'data:image/png;base64,x',
        '12:00'
    );
    const msgTy = msgDeleted('tianyuan');
    ok(!msgTy.cardType, '降级天缘不该出卡片（实际会被渲染成角色属性面板 / 战力计算）');
    ok(msgTy.text.includes('天缘图没读到完整词条行'), '降级天缘应保留服务端的具体说明');
    ok(!msgDeleted('xyc').cardType, '降级轩辕策不该出角色属性面板卡');
    const msgCp = msgDeleted('character_panel');
    ok(msgCp.cardType === 'c_panel_review', '降级角色面板仍应给可手填的空卡');
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

/* =========================== C. 满属性对照 =========================== */
/**
 * 用两张真图（用户 2026-10-30 提供）验算「离满属性还差多少」。
 * 期望值不是抄算法，是**手算反推**的：青龙英雄六品池 气血% max10 + 0.2×20 = 14%、
 * 固定防御 375 + 10×20 = 575、定身抗性 112 + 1×20 = 132、致命一击伤害 75 + 1×20 = 95%。
 * 四个数都对得上，说明「池上限 + step×等级」这条口径没跑偏。
 */
async function runCeilingChecks() {
    const mod = await bundle('ceiling', `
export { buildXycCeiling, buildTianyuanCeiling, tianyuanExtraLevels } from '${pj(SRC)}/services/vision/ceiling';
`);
    const { buildXycCeiling, buildTianyuanCeiling, tianyuanExtraLevels } = mod;
    const refine = readJson(path.join(GD, 'xyc_refine.json'));
    const tyData = readJson(path.join(GD, 'new_tianyuan_data.json'));

    const XYC = {
        kind: 'xyc',
        xyc: { beast: '青龙', bookName: '青囊玉书', heroVersion: true, tier: '六品', stars: 4, washUsed: 17, level: 20 },
        attrs: [
            { name: '气血', value: '+13.5%', wash: '+0.87%' },
            { name: '固定防御', value: '+526', wash: '+42.1' },
            { name: '真气', value: '+13.7%', wash: '+1.27%' },
            { name: '定身抗性', value: '+130', wash: '+12.0' },
            { name: '致命一击伤害', value: '+92.4%', wash: '+7.30%', extra: '+18.20%' }
        ]
    };
    const TY = {
        kind: 'tianyuan',
        tianyuan: { name: '上玄佑万辰须弥刃', part: '刃', tianyuanLevel: 1 },
        attrs: [
            { tianming: 1, name: '致命一击率', value: '+2.1%' },
            { tianming: 1, name: '固定攻击', value: '+1000' },
            { tianming: 1, name: '克佛', value: '+3.4%' },
            { tianming: 1, name: '无视伤害减免', value: '+2.9%' },
            { tianming: 1, name: '攻击', value: '+1.4%' }
        ]
    };

    const xyc = buildXycCeiling(XYC, refine);
    const ty = buildTianyuanCeiling(TY, tyData);

    const pick = (rep, name) => (rep?.rows || []).find(r => r.name === name);
    console.log('── C. 满属性对照 ───────────────────────────');
    console.log(`  轩辕策 ${xyc?.basis} 完成度 ${xyc?.overall === null ? '—' : Math.round(xyc.overall * 100) + '%'}`);
    for (const r of xyc?.rows || []) console.log(`    ${r.name.padEnd(8)} ${r.current} / ${r.ceiling}  差 ${r.diff}`);
    console.log(`  天缘   ${ty?.basis} 完成度 ${ty?.overall === null ? '—' : Math.round(ty.overall * 100) + '%'}`);
    for (const r of ty?.rows || []) console.log(`    ${r.name.padEnd(8)} ${r.current} / ${r.ceiling}  差 ${r.diff}`);

    ok(xyc?.rows.length === 5, `轩辕策应有 5 行对照，实际 ${xyc?.rows.length}`);
    ok(pick(xyc, '气血')?.ceiling === 14, `气血% 满值应为 14（10+0.2×20），实际 ${pick(xyc, '气血')?.ceiling}`);
    ok(pick(xyc, '固定防御')?.ceiling === 575, `固定防御满值应为 575（375+10×20），实际 ${pick(xyc, '固定防御')?.ceiling}`);
    ok(pick(xyc, '定身抗性')?.ceiling === 132, `定身抗性满值应为 132（112+1×20），实际 ${pick(xyc, '定身抗性')?.ceiling}`);
    ok(pick(xyc, '致命一击伤害')?.ceiling === 95, `致命一击伤害满值应为 95（75+1×20），实际 ${pick(xyc, '致命一击伤害')?.ceiling}`);
    ok(pick(xyc, '固定防御')?.diff === 49, `固定防御应差 49，实际 ${pick(xyc, '固定防御')?.diff}`);
    ok(xyc?.rows.every(r => r.pct > 0.85 && r.pct <= 1), '这张图五条都应在 85% 以上且不超上限');
    ok(xyc?.warnings.length === 0, `这张图不该有告警，实际 ${JSON.stringify(xyc?.warnings)}`);
    // 括号值只展示、不进差距（用户 2026-10-30 拍板）
    ok(pick(xyc, '气血')?.current === 13.5, '当前值必须取括号前主值，不能加洗炼增量');

    ok(ty?.rows.length === 5, `天缘应有 5 行对照，实际 ${ty?.rows.length}`);
    ok(pick(ty, '固定攻击')?.ceiling === 1200, `固定攻击满值应为 1200（1000+100×等级1+天命1档100），实际 ${pick(ty, '固定攻击')?.ceiling}`);
    ok(pick(ty, '致命一击率')?.ceiling === 2.6, `致命一击率满值应为 2.6（2+0.3+天命1档0.3），实际 ${pick(ty, '致命一击率')?.ceiling}`);
    ok(tianyuanExtraLevels(0) === 0 && tianyuanExtraLevels(3) === 3 && tianyuanExtraLevels(7) === 6 && tianyuanExtraLevels(10) === 10, '天缘天命档位阶梯应为 0/3/6/10');

    // 等级读不到 → 必须拒绝出数，不能按 0 级硬算给出「已满」的假结论
    const noLv = buildXycCeiling({ ...XYC, xyc: { ...XYC.xyc, level: undefined } }, refine);
    ok(noLv?.rows.length === 0 && noLv?.overall === null, '轩辕策缺等级时必须不出数');

    /* 天缘：图上没有「天缘+N」= 天缘 +0，照算出数（2026-10-30 用户口径），但口径必须写明 */
    const noTyLv = buildTianyuanCeiling({ ...TY, tianyuan: { name: '上玄佑万辰须弥刃', part: '刃' } }, tyData);
    ok(noTyLv?.rows.length === 5, `天缘缺「天缘+N」时应按 +0 出数，实际 ${noTyLv?.rows.length} 行`);
    ok(/天缘 \+0/.test(noTyLv?.basis || ''), `缺等级的 basis 应写明「天缘 +0」，实际 ${noTyLv?.basis}`);
    ok((noTyLv?.warnings || []).some(w => w.includes('天缘 +0')), '缺等级应提示按 +0 折算');
    ok((noTyLv?.warnings || []).some(w => w.includes('洗到过 +3')), '缺等级但已有天命+N 时，应提醒补真实等级（天命只在 +3/6/9/10 触发）');
    const lv0 = buildTianyuanCeiling({ ...TY, tianyuan: { ...TY.tianyuan, tianyuanLevel: 0 } }, tyData);
    ok(pick(lv0, '固定攻击')?.ceiling === 1100, `天缘+0 的固定攻击上限应为 1100（1000+天命1档100），实际 ${pick(lv0, '固定攻击')?.ceiling}`);
    ok(pick(ty, '固定攻击').ceiling > pick(lv0, '固定攻击').ceiling, '天缘等级必须进公式（+1 的上限要高于 +0）');
    // 部位认不出 → 同样不出数
    const noPart = buildTianyuanCeiling({ ...TY, tianyuan: { name: '未知装备', tianyuanLevel: 3 } }, tyData);
    ok(noPart?.rows.length === 0, '部位认不出时不该出对照行');

    /* 用户第三张图：天缘+10（天命祝福），5 条词条天命档各不相同（+3/+1/0/+5/+1） */
    const TY_BLESS = {
        kind: 'tianyuan',
        tianyuan: { name: '上玄佑万辰须弥刃', part: '刃', tianyuanLevel: 10 },
        attrs: [
            { tianming: 3, name: '致命一击率', value: '+7.2%' },
            { tianming: 1, name: '固定攻击', value: '+2100' },
            { tianming: 0, name: '克佛', value: '+6.4%' },
            { tianming: 5, name: '无视伤害减免', value: '+5.6%' },
            { tianming: 1, name: '攻击', value: '+4.7%' }
        ]
    };
    const bless = buildTianyuanCeiling(TY_BLESS, tyData);
    console.log(`  天缘+10 天命祝福  ${bless?.basis} 完成度 ${bless?.overall === null ? '—' : Math.round((bless.overall || 0) * 100) + '%'}`);
    for (const r of bless?.rows || []) console.log(`    天命+${r.destiny} ${r.name.padEnd(8)} ${r.current} / ${r.ceiling}  差 ${r.diff}  ${Math.round(r.pct * 100)}%`);
    ok(bless?.rows.length === 5, `天缘+10 应出 5 行，实际 ${bless?.rows.length}`);
    ok(pick(bless, '固定攻击')?.ceiling === 2100, `天命+1 的固定攻击上限应为 2100，实际 ${pick(bless, '固定攻击')?.ceiling}`);
    ok(pick(bless, '克佛')?.ceiling === 7, `天命+0 的克佛上限应为 7（4+10×0.3），实际 ${pick(bless, '克佛')?.ceiling}`);
    ok(pick(bless, '无视伤害减免')?.ceiling === 6.2, `天命+5 的无视伤害减免上限应为 6.2（3.5+1+17×0.1），实际 ${pick(bless, '无视伤害减免')?.ceiling}`);
    ok(pick(bless, '致命一击率')?.diff === 0, '四舍五入造成的 0.1 差应算「已满」，不该报反超');
    ok(!(bless?.warnings || []).some(w => w.includes('反超')), `这张图不该报反超上限，实际 ${JSON.stringify(bless?.warnings)}`);
    ok((bless?.overall || 0) > 0.9, `完成度应在 90% 以上，实际 ${bless?.overall}`);
    ok((bless?.rows || []).every(r => typeof r.destiny === 'number'), '每行都要回传各自的天命档（UI 靠它显示 天命+N）');
    // 普通版比英雄版低：同一词条上限必须更小
    const normal = buildXycCeiling({ ...XYC, xyc: { ...XYC.xyc, heroVersion: false } }, refine);
    ok((pick(normal, '气血')?.ceiling ?? 0) < (pick(xyc, '气血')?.ceiling ?? 0), '普通版满值应低于英雄版');
}

/* =========================== 入口 =========================== */
try {
    if (doCard) await runCardChecks();
    if (doEngine) await runEngineChecks();
    if (doCeiling) await runCeilingChecks();
} finally {
    // 清理失败（磁盘满 / 文件被占用）不应让自检失败
    try {
        fs.rmSync(TMP, { recursive: true, force: true });
    } catch {
        /* 忽略 */
    }
}

console.log('');
if (fails.length) {
    console.log(`❌ ${fails.length} 项失败：`);
    for (const f of fails) console.log('   · ' + f);
    process.exitCode = 1;
} else {
    console.log('✅ 全部通过');
}

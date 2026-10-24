#!/usr/bin/env node
/**
 * 从 web_app/public/game_data/skills.json 抽出 `_meta`，生成 web_app/src/game_data/skillsMeta.json。
 *
 * 为什么需要这一步：
 *   SimulationArena 只用到 skills.json 里的 `_meta`（约 11KB），却直接
 *   `import skillsData from '../../../public/game_data/skills.json'`：
 *     1) public 目录的文件按设计只能通过 URL 访问，被 JS import 时 Vite 会警告
 *        "Assets in public directory cannot be imported from JavaScript."；
 *     2) 整个 skills.json（约 132KB）会被内联进 JS 主包，而同一份文件在运行时
 *        又被 DataService 用 fetch('/game_data/skills.json') 拉了一次 —— 双份载荷。
 *   拆出 _meta 后：JS 侧只带 11KB 配置，技能表仍然走运行时 fetch，唯一数据源不变。
 *
 * 用法：
 *   node scripts/build_skills_meta.mjs           重新生成（内容没变则不动文件）
 *   node scripts/build_skills_meta.mjs --check   只校验是否同步，不同步退出码 1
 *
 * 同步保障：web_app 的 npm run build 前会跑 prebuild 自动调用本脚本。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'web_app/public/game_data/skills.json');
const TARGET = path.join(ROOT, 'web_app/src/game_data/skillsMeta.json');

const sourceText = fs.readFileSync(SOURCE, 'utf8');
const raw = JSON.parse(sourceText);
const meta = raw && typeof raw === 'object' ? raw._meta : null;

if (!meta || typeof meta !== 'object') {
    console.error(`[fail] no "_meta" object found in ${path.relative(ROOT, SOURCE)}`);
    process.exit(1);
}

const nextText = `${JSON.stringify(meta, null, 2)}\n`;
const prevText = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
const relTarget = path.relative(ROOT, TARGET).replace(/\\/g, '/');

if (process.argv.includes('--check')) {
    if (prevText !== nextText) {
        console.error(`[fail] ${relTarget} is out of sync with skills.json._meta`);
        console.error('       run: node scripts/build_skills_meta.mjs');
        process.exit(1);
    }
    console.log(`[ok] ${relTarget} is in sync`);
    process.exit(0);
}

if (prevText === nextText) {
    console.log(`[ok] ${relTarget} unchanged (${Buffer.byteLength(nextText)} bytes)`);
    process.exit(0);
}

fs.mkdirSync(path.dirname(TARGET), { recursive: true });
fs.writeFileSync(TARGET, nextText);
console.log(
    `[ok] wrote ${relTarget}: ${Buffer.byteLength(nextText)} bytes ` +
    `(source skills.json ${Buffer.byteLength(sourceText)} bytes, saved ${Buffer.byteLength(sourceText) - Buffer.byteLength(nextText)} bytes)`
);

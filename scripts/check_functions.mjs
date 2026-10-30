#!/usr/bin/env node
/**
 * Cloudflare Pages Functions 预检（本地就能跑，不用等 CF 构建）
 *
 * 背景：2026-10-30 v1.3.4 推送后 CF Pages 构建失败 ——
 *   functions/api/copilot/vision.ts 的 prompt 模板字符串里写了一对反引号（`"tianming":0`），
 *   提前闭合了模板，wrangler 报 Expected ";" but found "\"tianming\""。
 *   `npm run web:build` 只跑 tsc -b + vite build，**完全不覆盖 functions/**，所以本地全绿、线上炸。
 *
 * 本脚本对 functions/ 下每个 .ts：
 *   1) transform —— 语法（模板字符串、括号配对等）
 *   2) build(bundle) —— 相对 import 能否解析、导出是否成立
 * 任何一条失败即退出码 1。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

// 必须用 fileURLToPath：pathname 在中文路径下是 URL 编码的（%E5%B7%A5...），scandir 会 ENOENT
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN_DIR = path.join(ROOT, 'functions');

const files = [];
const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.ts')) files.push(p);
    }
};
walk(FN_DIR);

let fail = 0;
for (const f of files.sort()) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    const src = fs.readFileSync(f, 'utf8');
    try {
        esbuild.transformSync(src, { loader: 'ts' });
    } catch (e) {
        fail++;
        console.log(`FAIL  ${rel}\n      语法: ${String(e.message).split('\n').slice(0, 4).join('\n      ')}`);
        continue;
    }
    try {
        await esbuild.build({
            entryPoints: [f],
            bundle: true,
            write: false,
            format: 'esm',
            platform: 'neutral',
            target: 'es2022',
            logLevel: 'silent',
        });
    } catch (e) {
        fail++;
        console.log(`FAIL  ${rel}\n      打包: ${String(e.message).split('\n').slice(0, 4).join('\n      ')}`);
        continue;
    }
    console.log(`PASS  ${rel}`);
}

console.log(`\n==== ${files.length - fail}/${files.length} PASS${fail ? `，${fail} FAIL` : '，全部通过'} ====`);
if (fail) process.exit(1);

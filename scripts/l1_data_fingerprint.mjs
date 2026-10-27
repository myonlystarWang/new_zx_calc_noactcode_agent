#!/usr/bin/env node
/**
 * game_data 数据指纹（L1 golden 快照新鲜度基线）
 *
 * 背景：L1 意图夹具的 golden 是「cardData 全文快照」，其中大量字段是 game_data 的透传回波。
 * 只要 `web_app/public/game_data/*.json` 变了，golden 就会大面积对不上。
 * 2026-10-27 的 47 条 FAIL 就是这么来的：4fe9359 同一 commit 里数据改了、golden 却在改数据前生成。
 *
 * 这里对 game_data 下全部 .json 取 sha256，作为「golden 生成时的数据状态」基线。
 * 由 `l1_intent_fixture.mjs --golden` 自动写入，由 `check_l1_fresh.mjs` 检查。
 *
 * 为什么是全量 .json 而不是 fixture mock 里那几个：
 *   mock 的文件清单会随功能演进漂移，漏一个就漏检；30 个文件 32MB 全量 sha256 实测 106ms，不值得省。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GAME_DATA_DIR = path.join(ROOT, 'web_app', 'public', 'game_data');
export const FINGERPRINT_FILE = path.join(ROOT, 'regression_test', 'l1_golden.fingerprint.json');

/** 计算当前 game_data 全部 .json 的 sha256，返回 { relPath: sha256 }
 *
 * ⚠️ 必须先做行尾归一（CRLF→LF）再 hash。
 * 实测踩坑：本仓库 .gitattributes 是 `eol=lf` + 本机 core.autocrlf=true，
 * `git checkout -- <file>` 会把文件重写成 LF 版，而 checkout 前的 CRLF 版 git status 仍显示「干净」——
 * 于是同一份内容在 checkout 前后得到两个 hash，闸门永久误报。
 * 同理 CF Pages（Linux）clone 出来的行尾也与本机不同，字节级 hash 在 CI 上必然全红。
 * JSON 的语义与行尾无关，归一后再 hash 才既跨平台稳定、又对内容变化敏感。
 * BOM 一并剥离（部分 Windows 工具会写 BOM，JSON.parse 能容忍但 hash 不同）。
 */
export function normalizeJsonText(buf) {
    let s = buf.toString('utf8');
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    return s.replace(/\r\n/g, '\n');
}

export function computeDataHashes() {
    const out = {};
    if (!fs.existsSync(GAME_DATA_DIR)) return out;
    for (const name of fs.readdirSync(GAME_DATA_DIR).sort()) {
        if (!name.endsWith('.json')) continue;
        const buf = fs.readFileSync(path.join(GAME_DATA_DIR, name));
        out[name] = crypto.createHash('sha256').update(normalizeJsonText(buf)).digest('hex');
    }
    return out;
}

/** 对 { name: sha } 取整体摘要，便于一行比对 */
export function overallDigest(hashes) {
    const joined = Object.keys(hashes).sort().map((k) => `${k}:${hashes[k]}`).join('\n');
    return crypto.createHash('sha256').update(joined).digest('hex').slice(0, 16);
}

/** 读取基线；不存在返回 null */
export function readBaseline() {
    try {
        const raw = JSON.parse(fs.readFileSync(FINGERPRINT_FILE, 'utf8'));
        if (!raw || typeof raw.files !== 'object') return null;
        return raw;
    } catch {
        return null;
    }
}

/** 写入基线（由 --golden 或 --write 调用） */
export function writeBaseline(extra = {}) {
    const files = computeDataHashes();
    const payload = {
        note: 'L1 golden 快照对应的 game_data 数据指纹。由 l1_intent_fixture.mjs --golden 自动写入，请勿手改。',
        generatedAt: new Date().toISOString(),
        digest: overallDigest(files),
        fileCount: Object.keys(files).length,
        ...extra,
        files,
    };
    fs.writeFileSync(FINGERPRINT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
}

/** 比对，返回 { same, added[], removed[], changed[{name,from,to}] } */
export function diffAgainstBaseline(baseline = readBaseline()) {
    const current = computeDataHashes();
    if (!baseline) {
        return { same: false, missingBaseline: true, current, added: [], removed: [], changed: [] };
    }
    const base = baseline.files || {};
    const added = Object.keys(current).filter((k) => !(k in base));
    const removed = Object.keys(base).filter((k) => !(k in current));
    const changed = Object.keys(current)
        .filter((k) => k in base && base[k] !== current[k])
        .map((k) => ({ name: k, from: base[k].slice(0, 8), to: current[k].slice(0, 8) }));
    return {
        same: added.length === 0 && removed.length === 0 && changed.length === 0,
        missingBaseline: false,
        baselineDigest: baseline.digest,
        currentDigest: overallDigest(current),
        added,
        removed,
        changed,
    };
}

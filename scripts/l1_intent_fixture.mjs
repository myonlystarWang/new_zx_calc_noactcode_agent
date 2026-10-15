#!/usr/bin/env node
/**
 * L1 意图匹配回归夹具（P0）
 * 设计依据：doc/AI对话全链路说明书与意图匹配维护指南.md 第七章
 *
 * 用法：
 *   node scripts/l1_intent_fixture.mjs                  # 跑全部用例：断言 + 对拍 golden 快照
 *   node scripts/l1_intent_fixture.mjs --golden         # 重新生成 golden 快照（= 人工 approve 当前行为）
 *   node scripts/l1_intent_fixture.mjs --probe "T20"    # 探测单条输入的实际输出（写用例前核实期望值）
 *   node scripts/l1_intent_fixture.mjs --verbose        # 失败时打印完整 diff
 *
 * 用例格式（regression_test/l1_intent_cases.json）：
 *   { "id": "唯一 id", "input": "用户输入", "expect": {...} | null,
 *     "tags": ["变体类", "意图类"], "assert": "strong" | "weak" }
 *   expect 为 null        -> 期望 matchLocalIntent 返回 null（未命中）
 *   expect 为对象         -> 点路径断言，支持三种键：
 *     "cardType"                    -> 标量严格相等
 *     "cardData.dungeonId"          -> 任意点路径严格相等（string/number/boolean）
 *     "cardData.candidates.length"  -> 以 .length 结尾：数组长度相等
 *     "cardData.candidates.ids"     -> 以 .ids 结尾：数组各项 id 的集合相等（无视顺序）
 *     "@textIncludes": "子串"        -> result.text 包含子串
 *   assert: "weak"       -> 只强制执行 cardType 断言（演进期过渡）
 *
 * golden 快照（regression_test/l1_intent_golden.json）：
 *   每条用例的 normalize 后结果（剔除 id/time——二者每次运行都不同，不剔除则 100% 误报）。
 *   默认模式与快照对拍，任何差异即 FAIL；--golden 重新生成快照（须人工确认后执行）。
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'web_app', 'src', 'services');
const GAME_DATA = path.join(ROOT, 'web_app', 'public', 'game_data');
const CASES_FILE = path.join(ROOT, 'regression_test', 'l1_intent_cases.json');
const GOLDEN_FILE = path.join(ROOT, 'regression_test', 'l1_intent_golden.json');
const BUNDLE = path.join(os.tmpdir(), `l1_fixture_bundle_${process.pid}.mjs`);

const argv = process.argv.slice(2);
const MODE_GOLDEN = argv.includes('--golden');
const MODE_PROBE = argv.includes('--probe');
const VERBOSE = argv.includes('--verbose');
const PROBE_INPUTS = MODE_PROBE ? argv.slice(argv.indexOf('--probe') + 1).filter(a => !a.startsWith('--')) : [];

/* ---------------- 1. esbuild 打包（platform: 'node'，缺此必踩坑） ---------------- */
await build({
    entryPoints: [path.join(ROOT, 'scripts', 'l1_fixture_entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    outfile: BUNDLE,
    logLevel: 'error',
});

let mod;
try {
    mod = await import(pathToFileURL(BUNDLE).href);
} finally {
    try { fs.unlinkSync(BUNDLE); } catch { /* ignore */ }
}
const { DataService, CopilotService, isValidEquip, isValidSkill } = mod;

/* ---------------- 2. mock DataService：fs 读真实 game_data + 复用真实过滤器 ---------------- */
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function makeFsMock() {
    const dungeonsMeta = readJson(path.join(GAME_DATA, 'dungeons.json'));
    const monstersByDungeon = readJson(path.join(GAME_DATA, 'dungeons_monsters.json'));
    const equipRaw = readJson(path.join(GAME_DATA, 'equip_curated.json'));
    const fabaoRaw = readJson(path.join(GAME_DATA, 'fabao_curated.json'));
    const skillChunks = ['all_skills_curated_1.json', 'all_skills_curated_2.json', 'all_skills_curated_3.json']
        .map((f) => readJson(path.join(GAME_DATA, f)));

    return {
        // 返回 {...meta, Monsters:[...]} 形状（与真实实现一致，非扁平数组）；
        // 不算 displayAttributes——matchLocalIntent 所有读取均有 ?? MonsterAttributeModifiers 兜底
        getDungeons: () => dungeonsMeta.map((meta) => ({
            ...meta,
            Monsters: monstersByDungeon[meta.DungeonID] || [],
        })),
        // 与真实实现相同：过 isValidEquip 过滤（不过滤则候选数与线上不一致）
        getEquipList: async () => (Array.isArray(equipRaw) ? equipRaw : []).filter(isValidEquip),
        // 与真实实现相同：无过滤
        getFabaoList: async () => (Array.isArray(fabaoRaw) ? fabaoRaw : []),
        // 与真实实现相同：三分块合并后过 isValidSkill 过滤
        getAllCuratedSkills: async () => skillChunks.flat().filter(isValidSkill),
    };
}

// 必须在任何 matchLocalIntent 调用之前注入（该方法内部第 350 行动态获取单例）
DataService.instance = makeFsMock();
const svc = CopilotService.getInstance();

/* ---------------- 3. 断言引擎 ---------------- */
function getByPath(obj, dotPath) {
    if (dotPath === '') return obj;
    return dotPath.split('.').reduce((acc, k) => (acc === null || acc === undefined ? acc : acc[k]), obj);
}

function stableStringify(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
}

// JSON 语义规范化：递归剔除 undefined 值——否则内存对象（含 undefined 键）与
// golden 文件（JSON round-trip 后键消失）对拍必然误报（cardData.difficulty 等字段常为 undefined）
function canonicalize(v) {
    if (Array.isArray(v)) return v.map(canonicalize);
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) {
            const cv = canonicalize(v[k]);
            if (cv !== undefined) out[k] = cv;
        }
        return out;
    }
    return v;
}

// golden 快照专用：剔除每次运行都不同的 id/time
function normalize(msg) {
    if (!msg) return null;
    const { id, time, ...rest } = msg;
    return canonicalize(rest);
}

function checkExpect(testCase, result) {
    const failures = [];
    const expect = testCase.expect;

    if (expect === null) {
        if (result !== null) failures.push(`expect null(未命中), got cardType=${result?.cardType}`);
        return failures;
    }
    if (result === null) {
        failures.push('expect 非空结果, got null');
        return failures;
    }

    const enforced = testCase.assert === 'weak'
        ? Object.fromEntries(Object.entries(expect).filter(([k]) => k === 'cardType'))
        : expect;

    for (const [key, want] of Object.entries(enforced)) {
        if (key === '@textIncludes') {
            if (!String(result.text || '').includes(want)) {
                failures.push(`@textIncludes: text 应包含 "${want}"`);
            }
            continue;
        }
        if (key.endsWith('.length')) {
            const arr = getByPath(result, key.slice(0, -'.length'.length));
            const got = Array.isArray(arr) ? arr.length : undefined;
            if (got !== want) failures.push(`${key}: expect ${want}, got ${got}`);
            continue;
        }
        if (key.endsWith('.ids')) {
            const arr = getByPath(result, key.slice(0, -'.ids'.length));
            const got = Array.isArray(arr) ? arr.map((x) => x?.id ?? x) : null;
            const gotSet = new Set(got || []);
            const wantSet = new Set(want);
            const same = gotSet.size === wantSet.size && [...wantSet].every((v) => gotSet.has(v));
            if (!same) failures.push(`${key}: expect 集合[${want.join(',')}], got[${(got || []).join(',')}]`);
            continue;
        }
        const got = getByPath(result, key);
        if (got !== want) failures.push(`${key}: expect ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    }
    return failures;
}

/* ---------------- 4. 运行 ---------------- */
async function runOne(input) {
    try {
        return await svc.matchLocalIntent(input);
    } catch (err) {
        return { __error: `matchLocalIntent 抛错: ${err?.message || err}` };
    }
}

if (MODE_PROBE) {
    for (const input of PROBE_INPUTS) {
        const r = await runOne(input);
        console.log(`\n===== INPUT: ${JSON.stringify(input)} =====`);
        console.log(JSON.stringify(normalize(r), null, 2));
    }
    process.exit(0);
}

const cases = readJson(CASES_FILE);
if (!Array.isArray(cases) || cases.length === 0) {
    console.error(`用例文件为空或格式错误: ${CASES_FILE}`);
    process.exit(2);
}

const results = [];
let passCount = 0;
let failCaseCount = 0;
const failLines = [];

for (const c of cases) {
    const r = await runOne(c.input);
    const norm = normalize(r);
    const failures = [];

    if (r?.__error) {
        failures.push(r.__error);
    } else {
        failures.push(...checkExpect(c, r));
    }
    // golden 对拍（--golden 模式跳过：该模式即用于重建快照）
    if (!MODE_GOLDEN) {
        const golden = readJson(GOLDEN_FILE);
        const g = golden[c.id];
        if (g === undefined) {
            failures.push(`golden 中无此用例（新用例须先跑 --golden 收录）`);
        } else if (stableStringify(g) !== stableStringify(norm)) {
            failures.push(`与 golden 快照不一致${VERBOSE ? `\n  golden: ${stableStringify(g)}\n  actual: ${stableStringify(norm)}` : '（--verbose 看 diff）'}`);
        }
    }

    if (failures.length === 0) {
        passCount++;
        if (VERBOSE) console.log(`PASS ${c.id} [${(c.tags || []).join(',')}]`);
    } else {
        failCaseCount++;
        failLines.push(`FAIL ${c.id} [${(c.tags || []).join(',')}] input=${JSON.stringify(c.input)}`);
        for (const f of failures) failLines.push(`     - ${f}`);
    }
    results.push({ id: c.id, input: c.input, norm });
}

for (const line of failLines) console.log(line);

if (MODE_GOLDEN) {
    const golden = {};
    for (const r of results) golden[r.id] = r.norm;
    fs.writeFileSync(GOLDEN_FILE, `${JSON.stringify(golden, null, 2)}\n`, 'utf8');
    console.log(`\ngolden 快照已写入: ${GOLDEN_FILE}（${results.length} 条）`);
    console.log(`断言失败 ${failCaseCount} 条${failCaseCount > 0 ? '——快照已按当前行为重建，但断言失败须逐条人工确认是"预期变化"还是 bug！' : ''}`);
    process.exit(failCaseCount > 0 ? 1 : 0);
}

console.log(`\n==== ${passCount}/${cases.length} PASS${failCaseCount > 0 ? `, ${failCaseCount} FAIL` : ', 全绿'} ====`);
process.exit(failCaseCount > 0 ? 1 : 0);

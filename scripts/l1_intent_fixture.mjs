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
const MATRIX_FILE = path.join(ROOT, 'regression_test', 'l1_intent_cases_matrix.json');
const MATRIX_REPORT_FILE = path.join(ROOT, 'regression_test', 'l1_matrix_report.txt');
const GOLDEN_FILE = path.join(ROOT, 'regression_test', 'l1_intent_golden.json');
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache');
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
const BUNDLE = path.join(CACHE_DIR, `l1_fixture_bundle_${process.pid}.mjs`);

const argv = process.argv.slice(2);
const MODE_GOLDEN = argv.includes('--golden');
const MODE_PROBE = argv.includes('--probe');
const MODE_MATRIX = argv.includes('--generate-matrix');
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
    // T-15b：class_status 分支读 skills.json._meta.supportRoles（与真实实现同源）
    const skillsMeta = readJson(path.join(GAME_DATA, 'skills.json'))._meta ?? null;
    // T-06：服务器按名查询（与真实 getServerList 同源）
    const serverList = readJson(path.join(GAME_DATA, 'server_list.json'));

    return {
        // 返回 {...meta, Monsters:[...]} 形状（与真实实现一致，非扁平数组）；
        // 不算 displayAttributes——matchLocalIntent 所有读取均有 ?? MonsterAttributeModifiers 兜底
        // T-11：_ADDS 附加怪并入母副本（与真实 getDungeons 一致）
        getDungeons: () => dungeonsMeta.map((meta) => ({
            ...meta,
            Monsters: [
                ...(monstersByDungeon[meta.DungeonID] || []),
                ...(monstersByDungeon[`${meta.DungeonID}_ADDS`] || [])
            ]
        })),
        getDungeonsAsync: async () => dungeonsMeta.map((meta) => ({
            ...meta,
            Monsters: [
                ...(monstersByDungeon[meta.DungeonID] || []),
                ...(monstersByDungeon[`${meta.DungeonID}_ADDS`] || [])
            ]
        })),
        // 与真实实现相同：过 isValidEquip 过滤（不过滤则候选数与线上不一致）
        getEquipList: async () => (Array.isArray(equipRaw) ? equipRaw : []).filter(isValidEquip),
        // 与真实实现相同：无过滤
        getFabaoList: async () => (Array.isArray(fabaoRaw) ? fabaoRaw : []),
        // 与真实实现相同：三分块合并后过 isValidSkill 过滤
        getAllCuratedSkills: async () => skillChunks.flat().filter(isValidSkill),
        // T-15b：skills.json._meta（真实实现在 loadSkills 时剥离 _meta 存 skillMeta）
        getSkillMeta: () => skillsMeta,
        getSkillMetaAsync: async () => skillsMeta,
        // T-06：server_list.json（真实实现 lazy load 缓存）
        getServerList: async () => serverList,
        // T-18：peizhang_shengcui.json 圣粹佩章数据
        getPeizhangData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'peizhang_shengcui.json'));
            } catch {
                return null;
            }
        },
        // T-18：ninglingqi.json 宸极·凝灵契数据
        getNinglingqiData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'ninglingqi.json'));
            } catch {
                return null;
            }
        },
        // T-18：pet_pledge.json 宠物结誓/誓印数据
        getPetPledgeData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'pet_pledge.json'));
            } catch {
                return null;
            }
        },
        // T-18：zhenling_upgrade.json 阵灵聚灵升级消耗数据
        getZhenlingUpgradeData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'zhenling_upgrade.json'));
            } catch {
                return null;
            }
        },
        // T-18：fabao_upgrade_exp.json 法宝经验等级数据
        getFabaoUpgradeExpData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'fabao_upgrade_exp.json'));
            } catch {
                return null;
            }
        },
        // jiuwenlang.json 佩章·九纹琅数据
        getJiuwenlangData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'jiuwenlang.json'));
            } catch {
                return null;
            }
        },
        // tianyuan_old.json 旧天缘数据
        getOldTianyuanData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'tianyuan_old.json'));
            } catch {
                return null;
            }
        },
        // xingsu_upgrade.json 星宿属性数据
        getXingsuData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'xingsu_upgrade.json'));
            } catch {
                return null;
            }
        },
        // baoshi.json 宝石属性数据
        getBaoshiData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'baoshi.json'));
            } catch {
                return null;
            }
        },
        // silin_benyuan.json 四灵本元（伏龙鼎镶嵌）数据
        getSilinBenyuanData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'silin_benyuan.json'));
            } catch {
                return null;
            }
        },
        // fashion_skills_hesui.json 贺岁时装技能数据
        getFashionSkillData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'fashion_skills_hesui.json'));
            } catch {
                return null;
            }
        },
        // new_tianyuan_data.json 新版须弥天缘数据
        getNewTianYuanData: async () => {
            try {
                return readJson(path.join(GAME_DATA, 'new_tianyuan_data.json'));
            } catch {
                return null;
            }
        },
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
// transform(key, value)：可返回 undefined 剔除整个键（用于 golden 回波字段裁剪）
function canonicalize(v, transform) {
    if (Array.isArray(v)) return v.map((item) => canonicalize(item, transform));
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v)) {
            const tv = transform ? transform(k, v[k]) : v[k];
            if (tv === undefined) continue;
            const cv = canonicalize(tv, transform);
            if (cv !== undefined) out[k] = cv;
        }
        return out;
    }
    return v;
}

// golden 快照专用：剔除每次运行都不同的 id/time
// 另剔除两类噪音字段（否则数据文件一更新 golden 就误报，approve 机制被噪音淹没）：
//   1. 体量回波：allEquips（全量装备列表）/ candidates[].monster / .dungeon 原始对象
//   2. 实体回波：skill/equip/fabao 完整对象只留 id/name 级标识（技改常改描述，非逻辑回归）
const PRUNE_KEYS = new Set(['allEquips', 'monster', 'dungeon']);
const SUBSET_KEYS = {
    skill: ['id', 'name'],
    equip: ['id', 'name', 'slot'],
    fabao: ['id', 'name', 'grade'],
};
// candidates 内额外剔除的文本回波键（el_descs 为技能描述文本，技改必动、非逻辑回归）
const CANDIDATE_DROP_KEYS = new Set(['el_descs']);

function pruneForGolden(key, v) {
    if (PRUNE_KEYS.has(key)) return undefined;
    if (SUBSET_KEYS[key] && v && typeof v === 'object' && !Array.isArray(v)) {
        const out = {};
        for (const k of SUBSET_KEYS[key]) {
            if (v[k] !== undefined) out[k] = v[k];
        }
        return out;
    }
    // candidates 数组：只保留原始字段（string/number/boolean + 原始类型数组），
    // 丢弃嵌套对象/数组（装备 ad/sj/ref 等大体量回波——其内容随数据更新而变，非逻辑回归）
    if (key === 'candidates' && Array.isArray(v)) {
        return v.map((item) => {
            if (!item || typeof item !== 'object') return item;
            const out = {};
            for (const [k, val] of Object.entries(item)) {
                if (CANDIDATE_DROP_KEYS.has(k)) continue;
                if (val === null || val === undefined) continue;
                if (typeof val === 'object') {
                    if (Array.isArray(val) && val.every((x) => x === null || typeof x !== 'object')) {
                        out[k] = val;
                    }
                    continue;
                }
                out[k] = val;
            }
            return out;
        });
    }
    return v;
}

function normalize(msg, pruneEchoes = true) {
    if (!msg) return null;
    const { id, time, ...rest } = msg;
    return canonicalize(rest, pruneEchoes ? pruneForGolden : undefined);
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
        // probe 保留全量字段（含回波），仅供人工核对期望值；golden 才裁剪
        console.log(JSON.stringify(normalize(r, false), null, 2));
    }
    process.exit(0);
}

/* ---------------- 4b. 实体矩阵生成（T-01：从数据文件自动生成覆盖用例） ---------------- */
// 词表与 CopilotService.ts 保持一致（行号基线 75c1454）：品质 611 / 部位 612-615 / 职业 627-631 / 技能类别词 1347
const MATRIX_QUALITIES = ['修武', '昭武', '彰武', '神隐', '神级', '天命', '至尊', '混虚'];
const MATRIX_SLOTS = ['武器', '头盔', '衣服', '靴子', '袖甲', '腰带', '项链', '戒指', '法身', '罡气', '护符', '勋章', '玺绶', '锦囊', '佩章'];

// lean golden：矩阵用例的 candidates 只存 {__count, __first} 摘要——
// 否则 120 个装备用例 × 上百候选会把 golden 撑爆；断言强度不受影响（断言读原始结果）
function leanify(norm) {
    if (!norm || !norm.cardData || !Array.isArray(norm.cardData.candidates)) return norm;
    const c = norm.cardData.candidates;
    return {
        ...norm,
        cardData: {
            ...norm.cardData,
            candidates: { __count: c.length, __first: c[0]?.id ?? null },
        },
    };
}

function buildExpectation(r) {
    if (r === null || r?.__error) return null;
    const expect = { cardType: r.cardType };
    const cd = r.cardData;
    if (!cd) return expect;
    if (Array.isArray(cd.candidates)) {
        expect['cardData.candidates.length'] = cd.candidates.length;
        if (cd.candidates[0]?.id !== undefined) expect['cardData.candidates.0.id'] = cd.candidates[0].id;
    }
    if (typeof cd.totalCount === 'number') expect['cardData.totalCount'] = cd.totalCount;
    // 单卡用例必须冻结实体身份，否则"返回错了同类实体"的回归抓不到
    if (cd.fabao?.['名称']) expect['cardData.fabao.名称'] = cd.fabao['名称']; // fabao 单卡（T-14 R1 后 11 个法宝名翻转到此）
    if (cd.equip?.name) expect['cardData.equip.name'] = cd.equip.name;
    if (typeof cd.name === 'string') expect['cardData.name'] = cd.name;       // fabao 单卡
    if (cd.monsterId) expect['cardData.monsterId'] = cd.monsterId;           // boss 单卡
    // class_hub 分流卡：冻结职业名与三入口 query
    if (typeof cd.className === 'string') {
        expect['cardData.className'] = cd.className;
        if (Array.isArray(cd.options)) {
            expect['cardData.options.length'] = cd.options.length;
            if (cd.options[0]?.query) expect['cardData.options.0.query'] = cd.options[0].query;
        }
    }
    return expect;
}

if (MODE_MATRIX) {
    const monstersByDungeon = readJson(path.join(GAME_DATA, 'dungeons_monsters.json'));
    const fabaoRaw = readJson(path.join(GAME_DATA, 'fabao_curated.json'));
    const skillChunks = ['all_skills_curated_1.json', 'all_skills_curated_2.json', 'all_skills_curated_3.json']
        .map((f) => readJson(path.join(GAME_DATA, f))).flat();

    // 每类的期望意图族（用于覆盖报告分级）；null/guard 与族外结果都会被点名
    const FAMILIES = {
        equip: ['equip', 'equip_candidates'],
        boss: ['boss', 'boss_candidates'],
        skill: ['skill', 'skill_candidates'],
        fabao: ['fabao', 'fabao_candidates'],
    };

    const matrix = [];   // { id, input, family }
    const addMany = (items, family, idPrefix) => {
        for (const it of items) matrix.push({ ...it, family, id: `${idPrefix}-${it.id}` });
    };

    // A. 装备：15 部位 × 8 品质
    const equipInputs = [];
    for (const q of MATRIX_QUALITIES) {
        for (const s of MATRIX_SLOTS) {
            equipInputs.push({ id: `${q}-${s}`, input: `${q} ${s}` });
        }
    }
    addMany(equipInputs, 'equip', 'gen-equip');

    // B. BOSS：全部怪物名（去重，跨难度同名只测一次）
    const bossNames = [...new Set(Object.values(monstersByDungeon).flat().map((m) => m.MonsterName).filter(Boolean))];
    addMany(bossNames.map((n) => ({ id: n, input: n })), 'boss', 'gen-boss');

    // C. 技能：group_name「职业·类别·阵营」→「职业 类别」；另加裸职业名
    // 非查询类别的组不进矩阵（相关/触发/特殊/连段/宠物/怪物 是数据分组，不是玩家查询语）
    const NON_CATEGORY = new Set(['相关', '触发', '特殊', '连段', '宠物', '怪物']);
    const classCat = new Set();
    const classBare = new Set();
    for (const s of skillChunks) {
        const g = s.group_name || '';
        if (!g) continue;
        const parts = g.split('·');
        if (parts.length >= 2) {
            if (!NON_CATEGORY.has(parts[1])) classCat.add(`${parts[0]} ${parts[1]}`);
        } else {
            classBare.add(parts[0]);
        }
    }
    addMany([...classCat].map((n) => ({ id: n, input: n })), 'skill', 'gen-skill');
    addMany([...classBare].map((n) => ({ id: n, input: n })), 'skill', 'gen-skillclass');

    // D. 法宝：全部名称
    addMany(fabaoRaw.map((f) => ({ id: String(f.id), input: f.名称 })).filter((x) => x.input), 'fabao', 'gen-fabao');

    // 装备交叉校验底稿：有效装备按 (品质, 部位) 计数——用于区分
    // "查无是因为真没数据"（正常）vs "有数据却查无"（匹配 bug）
    const validEquips = (readJson(path.join(GAME_DATA, 'equip_curated.json'))).filter(isValidEquip);
    const equipDataCount = {};
    for (const e of validEquips) {
        const key = `${e.q || ''}|${e.slot || ''}`;
        equipDataCount[key] = (equipDataCount[key] || 0) + 1;
    }

    // 逐条实测 → 生成带实测期望的用例
    const generated = [];
    const report = { equip: {}, boss: {}, skill: {}, fabao: {} };
    const holes = { equip: [], boss: [], skill: [], fabao: [] };
    const quirks = { equip: [], boss: [], skill: [], fabao: [] };
    const guardWithData = [];   // 有数据却查无（疑似 bug）
    let okEmptyCount = 0;       // 查无且确实无数据（正常）
    for (const m of matrix) {
        const r = await runOne(m.input);
        const cardType = r?.__error ? '__error' : (r?.cardType ?? (r === null ? 'null' : 'text-only'));
        report[m.family][cardType] = (report[m.family][cardType] || 0) + 1;
        const inFamily = r !== null && FAMILIES[m.family].includes(r.cardType);
        const isGuard = r !== null && r.cardType === undefined; // 查无提示（未命中意图）
        if (r === null || r?.__error) holes[m.family].push(m.input);
        else if (!inFamily && !isGuard) quirks[m.family].push(`${m.input} → ${r.cardType}`);
        else if (isGuard && m.family === 'equip') {
            const [q, s] = m.input.split(' ');
            const dataCount = equipDataCount[`${q}|${s}`] || 0;
            if (dataCount > 0) guardWithData.push(`${m.input}（数据有 ${dataCount} 件）`);
            else okEmptyCount++;
        }
        generated.push({
            id: m.id,
            input: m.input,
            expect: buildExpectation(r),
            tags: ['generated', m.family],
            assert: 'strong',
            golden: 'lean',
            source: 'matrix',
        });
    }
    fs.writeFileSync(MATRIX_FILE, `${JSON.stringify(generated, null, 2)}\n`, 'utf8');

    const lines = [];
    const catTotal = (f) => Object.values(report[f]).reduce((a, b) => a + b, 0);
    lines.push('==== 实体矩阵覆盖报告（T-01） ====');
    for (const f of ['equip', 'boss', 'skill', 'fabao']) {
        const dist = Object.entries(report[f]).map(([k, v]) => `${k} ${v}`).join(' / ');
        lines.push(`${f}（${catTotal(f)} 输入）: ${dist}`);
        if (holes[f].length) lines.push(`  [空洞] 未命中: ${holes[f].join(', ')}`);
        if (quirks[f].length) lines.push(`  [族外] 需人工判断: ${quirks[f].join(' ; ')}`);
    }
    if (guardWithData.length) lines.push(`[装备疑似bug] 有数据却查无: ${guardWithData.join(', ')}`);
    lines.push(`[装备正常空] 查无且确实无数据: ${okEmptyCount} 条`);
    lines.push(`\n矩阵用例已写入: ${MATRIX_FILE}（${generated.length} 条，lean golden）`);
    lines.push('下一步: 跑 --golden 收录快照，再跑默认模式验收');
    const out = lines.join('\n');
    console.log(out);
    fs.writeFileSync(MATRIX_REPORT_FILE, `${out}\n`, 'utf8');
    process.exit(0);
}

const cases = (() => {
    const curated = readJson(CASES_FILE);
    const matrix = fs.existsSync(MATRIX_FILE) ? readJson(MATRIX_FILE) : [];
    const all = [...(Array.isArray(curated) ? curated : []), ...(Array.isArray(matrix) ? matrix : [])];
    const seen = new Set();
    for (const c of all) {
        if (seen.has(c.id)) {
            console.error(`用例 id 重复: ${c.id}（curated 与 matrix 不允许同名）`);
            process.exit(2);
        }
        seen.add(c.id);
    }
    return all;
})();
if (cases.length === 0) {
    console.error('用例为空');
    process.exit(2);
}

const goldenCache = MODE_GOLDEN ? null : readJson(GOLDEN_FILE);

const results = [];
let passCount = 0;
let failCaseCount = 0;
const failLines = [];

for (const c of cases) {
    const r = await runOne(c.input);
    const norm = normalize(r);
    // lean golden：矩阵用例的 candidates 压缩为摘要后再对拍/入库（断言仍读原始结果，强度不变）
    const gnorm = c.golden === 'lean' ? leanify(norm) : norm;
    const failures = [];

    if (r?.__error) {
        failures.push(r.__error);
    } else {
        failures.push(...checkExpect(c, r));
    }
    // golden 对拍（--golden 模式跳过：该模式即用于重建快照）
    if (!MODE_GOLDEN) {
        const g = goldenCache[c.id];
        if (g === undefined) {
            failures.push(`golden 中无此用例（新用例须先跑 --golden 收录）`);
        } else if (stableStringify(g) !== stableStringify(gnorm)) {
            failures.push(`与 golden 快照不一致${VERBOSE ? `\n  golden: ${stableStringify(g)}\n  actual: ${stableStringify(gnorm)}` : '（--verbose 看 diff）'}`);
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
    results.push({ id: c.id, input: c.input, norm: gnorm });
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

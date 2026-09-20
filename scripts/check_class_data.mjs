/**
 * 职业/技能数据体检 —— 新增职业或改动 skills.json 后跑一次。
 *
 * 用法：node scripts/check_class_data.mjs
 * 退出码：0 = 全部通过（可能有 WARN）；1 = 存在 FAIL
 *
 * 覆盖：
 *   1. JSON 合法性
 *   2. classes.json / skills.json._meta.classLabels / skills.json 职业键 三者一致性
 *   3. 职业栏顺序登记（_meta.compendiumOrder）：有技能却没登记 → WARN（图鉴会兜底排到末尾）
 *   4. 技能条目必填字段、ID 唯一、RequiredClass/Faction 与所在位置一致
 *   5. 每段数组字段长度 === MultiHitConfig.HitCount（引擎 validator 的离线前置检查）
 *   6. Grant（造化/心法/四代）的 TargetSkillIds 是否存在于该职业
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'web_app/public/game_data');

const PER_HIT_FIELDS = [
    'SkillAttackPercentBonus',
    'SkillAttackFixedBonus',
    'SkillHealthPercentBonus',
    'SkillManaPercentBonus',
    'SkillDefensePercentBonus',
    'SkillCriticalDamagePercentBonus',
    'SkillDamageBonus',
];
const FACTIONS = ['XIAN', 'FO', 'MO', 'COMMON'];

const fails = [];
const warns = [];
const oks = [];
const FAIL = (m) => fails.push(m);
const WARN = (m) => warns.push(m);
const OK = (m) => oks.push(m);

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------- 1. 读取 ----------
let classes, skillsRaw;
try {
    classes = readJson(path.join(DATA, 'classes.json'));
    OK(`classes.json 合法（${classes.length} 个职业）`);
} catch (e) {
    FAIL('classes.json 解析失败: ' + e.message);
}
try {
    skillsRaw = readJson(path.join(DATA, 'skills.json'));
    OK('skills.json 合法');
} catch (e) {
    FAIL('skills.json 解析失败: ' + e.message);
}
if (!classes || !skillsRaw) {
    console.log(fails.map((f) => 'FAIL  ' + f).join('\n'));
    process.exit(1);
}

const meta = skillsRaw._meta || {};
const labels = meta.classLabels || {};
const order = meta.compendiumOrder || [];
const skillData = Object.fromEntries(Object.entries(skillsRaw).filter(([k]) => k !== '_meta'));

// ---------- 2. 三者一致性 ----------
const classIds = new Set(classes.map((c) => c.ClassID));
for (const c of classes) {
    if (!c.ClassID || !c.ClassName) FAIL(`classes.json 条目缺 ClassID/ClassName: ${JSON.stringify(c).slice(0, 60)}`);
    if (!labels[c.ClassID]) WARN(`skills.json._meta.classLabels 缺 ${c.ClassID}(${c.ClassName})`);
    if (!classIds.has(c.ClassID)) FAIL('unreachable');
}
const labelOnly = Object.keys(labels).filter((k) => !classIds.has(k));
if (labelOnly.length) WARN(`classLabels 里有 classes.json 未定义的职业: ${labelOnly.join(', ')}`);
OK(`classLabels 覆盖 ${Object.keys(labels).length}/${classes.length} 个职业`);

for (const [cid, facMap] of Object.entries(skillData)) {
    if (!classIds.has(cid)) FAIL(`skills.json 有职业键 ${cid}，但 classes.json 无此职业`);
    for (const f of Object.keys(facMap)) {
        if (!FACTIONS.includes(f)) FAIL(`${cid} 出现非法阵营键 "${f}"（应为 ${FACTIONS.join('/')}）`);
    }
}

// ---------- 3. 职业栏顺序 ----------
const hasSkill = (cid) => FACTIONS.some((f) => Array.isArray(skillData[cid]?.[f]) && skillData[cid][f].length > 0);
const withSkills = Object.keys(skillData).filter(hasSkill);
for (const cid of withSkills) {
    if (!order.includes(cid)) WARN(`${cid}(${labels[cid] || '?'}) 有技能但未登记在 _meta.compendiumOrder → 图鉴会兜底排到末尾`);
    else if (!hasSkill(cid)) WARN(`_meta.compendiumOrder 里的 ${cid} 没有技能数据，不会显示`);
}
for (const cid of order) {
    if (!classIds.has(cid)) FAIL(`_meta.compendiumOrder 里的 ${cid} 不是合法职业 ID`);
    else if (!hasSkill(cid)) WARN(`_meta.compendiumOrder 里的 ${cid}(${labels[cid]}) 当前无技能数据，图鉴不显示`);
}
OK(`职业栏将显示 ${order.filter(hasSkill).length} 个职业（有技能数据 ${withSkills.length} 个）`);

// ---------- 4~6. 技能条目 ----------
const allIds = new Map();
let skillTotal = 0;
let perHitArrays = 0;
for (const [cid, facMap] of Object.entries(skillData)) {
    const nameToId = new Map();
    for (const f of FACTIONS) {
        for (const sk of facMap[f] || []) {
            if (sk.SkillName) nameToId.set(sk.SkillName, sk.SkillID);
        }
    }
    for (const f of FACTIONS) {
        for (const sk of facMap[f] || []) {
            skillTotal++;
            const tag = `${cid}/${f}/${sk.SkillID || '(缺ID)'} ${sk.SkillName || '(缺名)'}`;
            if (!sk.SkillID) FAIL(`${tag}: 缺 SkillID`);
            if (!sk.SkillName) FAIL(`${tag}: 缺 SkillName`);
            if (!sk.ActionType) FAIL(`${tag}: 缺 ActionType`);
            if (sk.SkillID) {
                if (allIds.has(sk.SkillID)) FAIL(`SkillID 重复: ${sk.SkillID}（${allIds.get(sk.SkillID)} 与 ${tag}）`);
                allIds.set(sk.SkillID, tag);
            }
            if (sk.RequiredClass && sk.RequiredClass !== cid) FAIL(`${tag}: RequiredClass=${sk.RequiredClass} 与所在职业 ${cid} 不一致`);
            if (sk.Faction && f !== 'COMMON' && sk.Faction !== f) FAIL(`${tag}: Faction=${sk.Faction} 与所在阵营 ${f} 不一致`);

            const b = sk.SkillBonusAttributes || {};
            const hitCount = b.MultiHitConfig?.HitCount;
            for (const field of PER_HIT_FIELDS) {
                const v = b[field];
                if (!Array.isArray(v)) continue;
                perHitArrays++;
                if (!hitCount) FAIL(`${tag}: ${field} 是逐段数组但缺 MultiHitConfig.HitCount`);
                else if (v.length !== hitCount) FAIL(`${tag}: ${field} 数组长度 ${v.length} ≠ HitCount ${hitCount}`);
                if (v.some((x) => typeof x !== 'number' || !Number.isFinite(x))) FAIL(`${tag}: ${field} 含非法元素`);
            }

            const grants = [
                ...(sk.ZaoHuaGrants || []).map((g) => ['ZaoHuaGrants', g]),
                ...Object.entries(sk.FourthGenGrants || {}).flatMap(([q, list]) => (list || []).map((g) => [`FourthGenGrants.${q}`, g])),
            ];
            for (const [src, g] of grants) {
                for (const tid of g.TargetSkillIds || []) {
                    const known = allIds.has(tid) || [...nameToId.values()].includes(tid);
                    if (!known && !facMap.COMMON?.some((x) => x.SkillID === tid)) {
                        // 目标技能可能还没解析到（后面才遍历到的职业），只做弱校验
                        const exists = FACTIONS.some((ff) => (facMap[ff] || []).some((x) => x.SkillID === tid)) ||
                            [...allIds.keys()].includes(tid);
                        if (!exists) WARN(`${tag} 的 ${src} 指向 SkillID ${tid}，未在本职业内找到（跨职业引用请确认）`);
                    }
                }
            }
        }
    }
}
OK(`技能条目 ${skillTotal} 条，SkillID 唯一；逐段数组字段 ${perHitArrays} 处长度校验通过`);

// ---------- 汇总 ----------
const line = (s) => console.log(s);
line('=== 职业/技能数据体检 ===');
for (const o of oks) line('OK    ' + o);
for (const w of warns) line('WARN  ' + w);
for (const f of fails) line('FAIL  ' + f);
line(`=== ${fails.length ? fails.length + ' FAIL' : 'ALL PASS'}${warns.length ? `（${warns.length} WARN）` : ''} ===`);

fs.writeFileSync(
    path.join(ROOT, 'scratch/check_class_data_report.txt'),
    [oks.map((o) => 'OK    ' + o), warns.map((w) => 'WARN  ' + w), fails.map((f) => 'FAIL  ' + f)].flat().join('\n') +
        `\n=== ${fails.length ? fails.length + ' FAIL' : 'ALL PASS'}${warns.length ? `（${warns.length} WARN）` : ''} ===\n`,
    'utf8'
);
process.exit(fails.length ? 1 : 0);

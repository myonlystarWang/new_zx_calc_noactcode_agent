#!/usr/bin/env node
/**
 * Workers AI 通道体检（REST API 版，不需要部署）
 *
 * 目的：一次问清三件事
 *   1. 这个账号当前到底有哪些模型可用（官方 model search，不靠猜 id）
 *   2. 视觉模型有哪几个、各自的入参形状哪种能跑通
 *   3. 文本模型哪些能用（顺带定位线上 chat 落 local-fallback 的原因）
 *
 * 凭据（都不进仓库，scratch/ 已被 .gitignore 忽略）：
 *   scratch/.cftoken    单行 API Token（权限：Account → Workers AI → Read 即可）
 *   scratch/.cfaccount  单行 Account ID（可选，默认用 DEFAULT_ACCOUNT）
 *   或环境变量 CF_API_TOKEN / CF_ACCOUNT_ID
 *
 * 用法：
 *   node scripts/cf_ai_probe.mjs --list          # 只列模型
 *   node scripts/cf_ai_probe.mjs --vision        # 只测视觉
 *   node scripts/cf_ai_probe.mjs --text          # 只测文本
 *   node scripts/cf_ai_probe.mjs                 # 全跑
 *
 * 产物：scratch/cf_ai_probe_report.md / .json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = path.join(ROOT, 'scratch');
const DEFAULT_ACCOUNT = '6d92824138ed453c329838ad427c87e4';
const API = 'https://api.cloudflare.com/client/v4';

const readLine = (p) => {
    try {
        return fs.readFileSync(p, 'utf8').trim().split(/\r?\n/)[0].trim();
    } catch {
        return '';
    }
};

const TOKEN = process.env.CF_API_TOKEN || readLine(path.join(SCRATCH, '.cftoken'));
const ACCOUNT = process.env.CF_ACCOUNT_ID || readLine(path.join(SCRATCH, '.cfaccount')) || DEFAULT_ACCOUNT;

if (!TOKEN) {
    console.error([
        '缺少 API Token。',
        '',
        '在 Cloudflare 控制台：My Profile → API Tokens → Create Token',
        '  · 模板选「Workers AI」；或自定义权限 Account → Workers AI → Read',
        '然后把它写进（单行，不要带引号）：',
        '  scratch/.cftoken',
        '',
        '注意：不要把 token 贴在聊天里，scratch/ 已被 .gitignore 忽略。'
    ].join('\n'));
    process.exit(2);
}

const argv = process.argv.slice(2);
const only = argv.find(a => a.startsWith('--')) || '--all';
const doList = only === '--all' || only === '--list';
const doVision = only === '--all' || only === '--vision';
const doText = only === '--all' || only === '--text';

const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const trunc = (v, n = 200) => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s && s.length > n ? s.slice(0, n) + '…' : s || '';
};

async function cfFetch(url, init = {}) {
    const res = await fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            'Content-Type': 'application/json',
            ...(init.headers || {})
        }
    });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
}

/* ---------- 1. 列出账号可用模型 ---------- */
async function listModels() {
    const out = [];
    for (let page = 1; page <= 6; page++) {
        const { status, body } = await cfFetch(`${API}/accounts/${ACCOUNT}/ai/models/search?per_page=100&page=${page}&hide_experimental=false`);
        if (status !== 200 || !body?.success) {
            return { ok: false, status, error: trunc(body), models: out };
        }
        const rows = body.result || [];
        out.push(...rows);
        if (rows.length < 100) break;
    }
    return { ok: true, models: out };
}

const taskOf = (m) => {
    const t = m?.task ?? m?.properties?.task ?? m?.task_name ?? '';
    return typeof t === 'string' ? t : (t?.name || t?.id || '');
};
/** model search 的 id 字段是内部 UUID，真正可调用的 model id 在 name 里（形如 @cf/xxx/yyy） */
const modelIdOf = (m) => m?.name || m?.id || '';
/** properties 是 [{property_id, value}] 数组，不是对象 */
const propMap = (m) => {
    const out = {};
    const arr = Array.isArray(m?.properties) ? m.properties : [];
    for (const p of arr) {
        if (p && p.property_id) out[p.property_id] = p.value;
    }
    return out;
};

/* ---------- 2. 视觉探测 ---------- */
function visionShapes(dataUrl, bytes) {
    const ask = 'What color is this image? Answer with one word.';
    return [
        {
            shape: 'messages+image_url(dataURL)',
            body: {
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: ask },
                        { type: 'image_url', image_url: { url: dataUrl } }
                    ]
                }],
                max_tokens: 32
            }
        },
        {
            shape: 'prompt+image(bytes[])',
            body: { prompt: ask, image: bytes, max_tokens: 32 }
        },
        {
            shape: 'prompt+image(base64)',
            body: { prompt: ask, image: TINY_PNG_B64, max_tokens: 32 }
        }
    ];
}

const pickText = (body) => {
    if (!body) return '';
    return body.result?.response
        || body.result?.description
        || body.result?.choices?.[0]?.message?.content
        || (typeof body.response === 'string' ? body.response : '')
        || '';
};

async function probeModel(modelId, shapes) {
    const rows = [];
    for (const s of shapes) {
        const t0 = Date.now();
        let status = 0, body = null, err = '';
        try {
            const r = await cfFetch(`${API}/accounts/${ACCOUNT}/ai/run/${modelId}`, {
                method: 'POST',
                body: JSON.stringify(s.body)
            });
            status = r.status;
            body = r.body;
        } catch (e) {
            err = e?.message || String(e);
        }
        const text = pickText(body);
        rows.push({
            modelId,
            shape: s.shape,
            status,
            ms: Date.now() - t0,
            ok: status === 200 && Boolean(text),
            sample: trunc(text, 60),
            error: status === 200
                ? (text ? '' : trunc(body, 160))
                : (body?.errors?.[0]?.message || body?.error || trunc(body, 160) || err)
        });
    }
    return rows;
}

/* ---------- 3. 主流程 ---------- */
const report = {
    at: new Date().toISOString(),
    account: ACCOUNT,
    models: { ok: false, total: 0, byTask: {}, visionCandidates: [], textCandidates: [] },
    vision: [],
    text: [],
    verdict: ''
};

if (doList || doVision || doText) {
    const listed = await listModels();
    report.models.ok = listed.ok;
    report.models.total = listed.models.length;
    if (!listed.ok) {
        report.models.error = listed.error;
    } else {
        const byTask = {};
        for (const m of listed.models) {
            const t = taskOf(m) || '(unknown)';
            byTask[t] = (byTask[t] || 0) + 1;
        }
        report.models.byTask = byTask;

        // 视觉候选：优先 Image-to-Text（图片进、文字出），再补 Text Generation 里带 vision 属性的
        const vision = listed.models.filter(m => {
            const t = taskOf(m).toLowerCase();
            const p = propMap(m);
            const visionProp = p['vision'] === true || p['vision'] === 'true'
                || p['multimodal'] === true || p['multimodal'] === 'true';
            const isI2T = t.includes('image-to-text') || t.includes('image to text');
            return isI2T || (t.includes('text generation') && visionProp);
        });
        const text = listed.models.filter(m => {
            const t = taskOf(m).toLowerCase();
            return (t.includes('text generation') || t.includes('text-generation'))
                && !(propMap(m)['vision'] === true);
        });

        report.models.visionCandidates = vision.map(m => ({ id: modelIdOf(m), task: taskOf(m) }));
        report.models.textCandidates = text.map(m => ({ id: modelIdOf(m), task: taskOf(m) }));

        if (doVision) {
            // 优先测「真·视觉」组合：Image-to-Text 全测 + 已知带 vision 属性的文本模型
            const preferred = [
                '@cf/meta/llama-3.2-11b-vision-instruct',
                '@cf/llava-hf/llava-1.5-7b-hf',
                '@cf/moondream/moondream3.1-9B-A2B',
                '@cf/mistralai/mistral-small-3.1-24b-instruct',
                '@cf/meta/llama-4-scout-17b-16e-instruct'
            ];
            const all = report.models.visionCandidates.map(v => v.id).filter(Boolean);
            const ids = [...new Set([
                ...preferred.filter(p => all.includes(p)),
                ...all
            ])].slice(0, 8);
            const bytes = Array.from(Buffer.from(TINY_PNG_B64, 'base64'));
            const dataUrl = `data:image/png;base64,${TINY_PNG_B64}`;
            for (const id of ids) {
                report.vision.push(...await probeModel(id, visionShapes(dataUrl, bytes)));
            }
        }

        if (doText) {
            const preferred = [
                '@cf/meta/llama-3.1-8b-instruct-fp8',
                '@cf/meta/llama-3.2-3b-instruct',
                '@cf/meta/llama-3.1-8b-instruct'
            ];
            const ids = [...new Set([...preferred.filter(p => report.models.textCandidates.some(c => c.id === p)),
                ...report.models.textCandidates.map(c => c.id)])].slice(0, 5);
            for (const id of ids) {
                report.text.push(...await probeModel(id, [{
                    shape: 'messages',
                    body: { messages: [{ role: 'user', content: '回复两个字：通了' }], max_tokens: 24 }
                }]));
            }
        }
    }
}

const firstVisionOk = report.vision.find(r => r.ok);
report.verdict = firstVisionOk
    ? `可用视觉组合：${firstVisionOk.modelId} + ${firstVisionOk.shape}`
    : '未找到可用视觉组合';

/* ---------- 4. 落盘 ---------- */
fs.mkdirSync(SCRATCH, { recursive: true });
fs.writeFileSync(path.join(SCRATCH, 'cf_ai_probe_report.json'), JSON.stringify(report, null, 2), 'utf8');

const lines = [];
lines.push('# Workers AI 体检报告', '');
lines.push(`- 时间：${report.at}`);
lines.push(`- Account：${report.account}`);
lines.push(`- 模型总数：${report.models.total}（list ok=${report.models.ok}）`);
lines.push('');
if (Object.keys(report.models.byTask).length) {
    lines.push('## 任务分布', '', '| task | 数量 |', '|---|---|');
    for (const [k, v] of Object.entries(report.models.byTask).sort((a, b) => b[1] - a[1])) {
        lines.push(`| ${k} | ${v} |`);
    }
    lines.push('');
}
if (report.models.visionCandidates.length) {
    lines.push('## 视觉候选', '', '| model id | task |', '|---|---|');
    for (const v of report.models.visionCandidates) lines.push(`| \`${v.id}\` | ${v.task} |`);
    lines.push('');
}
if (report.vision.length) {
    lines.push('## 视觉探测', '', '| model | 形状 | HTTP | 结果 | 耗时 |', '|---|---|---|---|---|');
    for (const r of report.vision) {
        lines.push(`| \`${r.modelId}\` | ${r.shape} | ${r.status} | ${r.ok ? '✅ ' + r.sample : '❌ ' + r.error} | ${r.ms}ms |`);
    }
    lines.push('');
}
if (report.text.length) {
    lines.push('## 文本探测', '', '| model | HTTP | 结果 |', '|---|---|---|');
    for (const r of report.text) {
        lines.push(`| \`${r.modelId}\` | ${r.status} | ${r.ok ? '✅ ' + r.sample : '❌ ' + r.error} |`);
    }
    lines.push('');
}
lines.push('## 结论', '', report.verdict, '');
fs.writeFileSync(path.join(SCRATCH, 'cf_ai_probe_report.md'), lines.join('\n'), 'utf8');

console.log(lines.join('\n'));
console.log(`\n报告已写入 scratch/cf_ai_probe_report.md（token 未落盘）`);

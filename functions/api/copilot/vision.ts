/**
 * Cloudflare Pages Function: /api/copilot/vision
 * 多模态截图识别（结构化提取）
 *
 * 通道优先级（2026-10-21 REST 实测，见 doc/识图校对与功能路由设计 §11）：
 *   1. Workers AI binding：
 *      @cf/meta/llama-3.2-11b-vision-instruct（需先 agree，已接受）
 *      → @cf/mistralai/mistral-small-3.1-24b-instruct
 *      → @cf/meta/llama-4-scout-17b-16e-instruct
 *   2. 智谱 glm-4v-flash
 *   3. 硅基 Qwen2-VL
 *   4. Gemini 1.5 flash
 *
 * 铁律：
 *   · 全部失败返回 degraded（无任何面板数值），绝不返回写死模板（旧 offline-preview 已删除）
 *   · 模型只转录不计算；缺字段必须 absent，禁止编造
 *   · 失败原因必须回传 lastError（G14）；model 走候选表（G15）
 */

import { normalizePanel, assessStandardness } from './visionNormalize';

interface Env {
    AI?: any;
    ZHIPU_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
    GEMINI_API_KEY?: string;
}

interface VisionRequestBody {
    imageBase64: string;
    prompt?: string;
    customKeys?: { zhipuKey?: string; siliconflowKey?: string; geminiKey?: string };
}

/** 五段式 prompt：禁令 → 判体系 → 逐行转录 → 取字段 → 正反例 */
const VISION_SYSTEM_PROMPT = `你是《诛仙3》截图录入员。你只做转录与结构化，不计算、不推断、不补全、不美化。

【一、判体系】先判断图片属于哪一类，并给出图内可见词作为证据：
- character_panel：角色属性面板（含"攻击 x-y""致命伤害""致命一击""血炼值"等行）
- xyc：轩辕策（标题形如 青龙<青囊玉书>·英雄版 / 白虎<白锦道册> / 玄武<玄甲元略>，含"洗炼次数""品阶""（进阶技能）"）
- tianyuan：天缘属性（上玄佑万辰须弥 系列，含"天命"）
- equip / fabao / skill / boss / combat_log / unknown

【二、逐行转录】按视觉顺序把"标签:数值"抄一遍，包括你看不懂含义的行。这一步必须真实，不允许脑补。

【三、面板行序地图（取值必须对号）】
角色属性面板的值区是**两列**，每行左右各一个属性，都要取：
  第1行：攻击(min–max)  | 防御            → attackMin / attackMax / defense
  第2行：普攻命中        | 普攻躲闪        → physHit / physDodge
  第3行：致命伤害        | 致命一击        → critDamage / critRate
  第4行：减免暴伤        | 减免暴击        → critDamageReduction / critRateReduction
  第5行：技能命中        | 技能躲闪        → skillHit / skillDodge
  顶部资源条：气血 cur/max、真气 cur/max、第三槽 cur/max → health / mana 取斜杠后的上限
  **左右两列绝不能串**：第 3 行左=致命伤害、右=致命一击；第 4 行左=减免暴伤、右=减免暴击。
轩辕策的取值：标题里的 青龙/白虎/朱雀/玄武 → beast，尖括号里的书名 → bookName，末尾「·英雄版」→ heroVersion；「六品」→ tier；★ 个数 → stars；「洗炼次数 4/10」→ washUsed=4；「等级 20」→ level；「（进阶技能）霜池映月III 《碧海》 3级」→ advSkillName / advSkillVariant / advSkillLevel。
阵营的取值：标题形如「175级 昭冥五重 飞升仙」→ classRaw=昭冥、factionRaw=仙（取"仙/魔/佛"这一个字，**不要写"飞升"**，也不要带"五重"）。
轩辕策英雄版：标题末尾「·英雄版」→ heroVersion=true（布尔 true/false，不要写"英雄版"这个字符串）。
进阶技能保留罗马数字后缀：「山雨欲来III」就写 山雨欲来III，不要截成 山雨欲来。
天缘的取值：标题「上玄佑万辰须弥盔（+2真气）」→ name=上玄佑万辰须弥盔、part=盔；**标题括号里的「+2真气」一律丢掉，不要输出 suffix、也不要放进 attrs**；「天缘+10」「天缘+10（天命祝福）」→ tianyuanLevel=10（括号里的"天命祝福"不写进任何字段）；随后每一行「天命+2 真气 +5.8%」都进 attrs 数组：tianming=2、name=真气、value=+5.8%。**天缘有几行输出几行（3~5 条都可能），不许合并、不许省略。**
- 某一行只写「天命」两个字、没有 +N（游戏原文如此，等于 +0）→ 这一行的 attrs 里必须写 "tianming": 0，**不许省略这个字段、也不许编一个数字**。
- 图上完全没有「天缘+N」这一行（掉落预览里只有「天缘」两个字）→ tianyuanLevel 不要输出，**绝对不要猜一个等级**。

【四、取字段】每个字段必须同时给 label（图上该行左侧的中文标签），label 必须来自上面的行序地图；没看到就 status="absent"、value=null，并且 raw、label 都为 null。

character_panel 的 key（只这 14 个，不要输出别的）：attackMin / attackMax / defense / physHit / physDodge / critDamage / critRate / critDamageReduction / critRateReduction / skillHit / skillDodge / health / mana / monsterDamageBonus
xyc 的 key：beast / bookName / heroVersion / tier / stars / washUsed / level / advSkillName / advSkillVariant / advSkillLevel
tianyuan 的 key：name / part / tianyuanLevel，**并必须输出 attrs 数组**（天缘的全部「天命+N 属性 +值」行）

【四之二、attrs 数组】轩辕策与天缘用它承载词条行，格式：
[{"tianming":2,"name":"真气","value":"+5.8%"},{"tianming":1,"name":"固定攻击","value":"+2057"}]
- name 取属性名（保留「固定」前缀，如 固定攻击 / 固定真气 / 固定气血）
- value 保留原文的正负号与百分号，不要换算成数字
- tianming 只有天缘有（天命+N 的 N）。**每一条天缘词条都必须带 tianming**：有 +N 就写 N，「天命」无数字写 0 —— 这一项决定该行能吃多少额外档，漏了满值就算不准。轩辕策词条用 wash / extra 装括号增量：
  「固定防御 +215（+14.0）（+42.3）」→ name=固定防御、value=+215、wash="+14.0"、extra="+42.3"
  **「洗炼次数 14/10+4」里的 14 只写进 washUsed，绝对不能填进任何词条的 wash**（这是最常见的错）
- 天缘一张图有几行词条就输出几条，漏行等于丢数据

【五、反例铁律（最常见的错，逐条避开）】
- 角色属性面板上没有"对怪增伤"这一行 → monsterDamageBonus 必须 absent，不得填 78 / 82 / 65 / 49.6。
- 致命伤害 与 致命一击 是两行：前者是暴击伤害（如 1889.6%），后者是暴击率（如 261.0%）。不要互换。
- 普攻命中（如 3610）、普攻躲闪（2906）、技能命中（369.5）、技能躲闪（77.5）都不是攻击力，也不是暴击率，不得填进 critRate / critDamage / ignoreReduction —— 它们各有自己的 key（physHit / physDodge / skillHit / skillDodge）。
- **实测最常错的一处**：把第 4 行右边的「减免暴伤 201.3%」填进第 3 行右边的「致命一击」。取完每一行都要回头核一次：致命一击 = 第 3 行右边，减免暴伤 = 第 4 行左边。
- **value 必须与 raw 里的数字逐位一致**：raw 写 "250832/250832" 时 value 只能是 250832，不许写成 2508332（多读一位）；raw 写 "10345/10345" 时 value 只能是 10345。
- 气血 814972/1604910 → health 取上限 1604910，不取当前值。
- 青龙/白虎/朱雀/玄武 只是轩辕策书名的前缀（写进 beast），不要另立字段。
- 天缘标题括号里的「+2真气」既不进 attrs、也不要单独成字段（suffix 已废弃，2026-10-31）。
- 图里没有「攻击 x-y / 致命伤害 / 书名<…> / 天缘·天命」这类面板特征（例如攻略表格、属性清单截图）时，panelKind 必须是 unknown，fields 全部 absent。**表格里某一行的文字看起来像"天命+10"也不算天缘面板**。
- 天缘的「天缘+N」不是必需的：掉落预览只有「天缘」两个字也是天缘面板（=天缘+0），照常按上述规则取 attrs。

【六、输出】只输出一个 JSON，不要 markdown 代码块，不要任何解释文字。**必须按示例把所有 14 个 key 都列出来**（没有的就写 absent），不要省略：
{"panelKind":"character_panel","kindEvidence":["致命一击","血炼值"],"kindConfidence":0.9,
 "textLines":[{"label":"攻击","raw":"26918-151478"},{"label":"致命一击","raw":"261.0%"}],
 "fields":[
  {"key":"attackMin","label":"攻击","raw":"26918-151478","value":26918,"status":"ok"},
  {"key":"attackMax","label":"攻击","raw":"26918-151478","value":151478,"status":"ok"},
  {"key":"defense","label":"防御","raw":"30545","value":30545,"status":"ok"},
  {"key":"health","label":"气血","raw":"814972/1604910","value":1604910,"status":"ok"},
  {"key":"mana","label":"真气","raw":"1145140/2983930","value":2983930,"status":"ok"},
  {"key":"critDamage","label":"致命伤害","raw":"1889.6%","value":1889.6,"status":"ok"},
  {"key":"critRate","label":"致命一击","raw":"261.0%","value":261.0,"status":"ok"},
  {"key":"physHit","label":"普攻命中","raw":"3610","value":3610,"status":"ok"},
  {"key":"physDodge","label":"普攻躲闪","raw":"2906","value":2906,"status":"ok"},
  {"key":"critDamageReduction","label":"减免暴伤","raw":"742.1%","value":742.1,"status":"ok"},
  {"key":"critRateReduction","label":"减免暴击","raw":"132.9%","value":132.9,"status":"ok"},
  {"key":"skillHit","label":"技能命中","raw":"369.5","value":369.5,"status":"ok"},
  {"key":"skillDodge","label":"技能躲闪","raw":"77.5","value":77.5,"status":"ok"},
  {"key":"monsterDamageBonus","label":null,"raw":null,"value":null,"status":"absent"}
 ],
 "character":{"classRaw":"昭冥","factionRaw":"仙","levelRaw":"175"},
 "rawExplanation":"识别到昭冥·仙角色属性面板"}`;

const trunc = (v: unknown, n = 200): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s && s.length > n ? s.slice(0, n) + '…' : (s || '');
};

/** Workers AI 返回结构不统一：result.response / result.choices[0].message.content / 顶层 response */
function pickAiText(payload: any): string {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload.response === 'string') return payload.response;
    if (typeof payload.result?.response === 'string') return payload.result.response;
    const choice = payload.choices?.[0]?.message?.content ?? payload.result?.choices?.[0]?.message?.content;
    if (typeof choice === 'string') return choice;
    if (Array.isArray(choice)) return choice.map((c: any) => c?.text ?? '').join('');
    if (typeof payload.result?.description === 'string') return payload.result.description;
    return '';
}

interface TransportResult {
    ok: boolean;
    raw: string;
    provider: string;
    error?: string;
    needAgree?: boolean;
}

/**
 * Workers AI 视觉通道（顺序 = 实测「准确率 + 延迟」）
 * · mistral：20s，角色面板 8/8 全对，天缘结构全对（唯一的数字误读是把 4468 读成 44468，靠校对卡纠）
 * · scout：46–68s，字段准但爱把 attrs 塞进 fields（前端已做结构兜底）
 * · llama-3.2-11b：**已移除**。实测会把 prompt 示例里的昭冥面板当成识别结果输出（照抄示例 = 造假），
 *   宁可降级也不能让它返回假数据。
 */
const CF_VISION_CHAIN = [
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
    '@cf/meta/llama-4-scout-17b-16e-instruct'
];

async function runCfVision(ai: any, modelId: string, dataUrl: string, userPrompt: string): Promise<TransportResult> {
    const payload = {
        messages: [
            { role: 'system', content: VISION_SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: userPrompt || '请识别这张截图并输出 JSON。' },
                    { type: 'image_url', image_url: { url: dataUrl } }
                ]
            }
        ],
        max_tokens: 1600,
        temperature: 0
    };

    const call = async () => {
        try {
            const res = await ai.run(modelId, payload);
            const text = pickAiText(res);
            return { ok: Boolean(text), text, error: text ? undefined : trunc(res, 160) };
        } catch (e: any) {
            const msg = trunc(e?.message || String(e), 300);
            const needAgree = /must submit the prompt 'agree'|Model Agreement/i.test(msg);
            return { ok: false, text: '', error: msg, needAgree };
        }
    };

    let r = await call();
    if (!r.ok && r.needAgree) {
        try { await ai.run(modelId, { prompt: 'agree' }); } catch { /* 已同意时会抛 403，但内容是成功 */ }
        r = await call();
    }
    return { ok: r.ok, raw: r.text, provider: `cf-workers-ai:${modelId}`, error: r.error, needAgree: r.needAgree };
}

async function runZhipu(mimeType: string, rawBase64: string, key: string, userPrompt: string): Promise<TransportResult> {
    try {
        const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: 'glm-4v-flash',
                messages: [
                    { role: 'system', content: VISION_SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt || '请识别这张截图并输出 JSON。' },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${rawBase64}` } }
                        ]
                    }
                ],
                temperature: 0.1
            })
        });
        if (!res.ok) return { ok: false, raw: '', provider: 'zhipu-glm-4v-flash', error: `HTTP ${res.status}` };
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        return { ok: Boolean(text), raw: text, provider: 'zhipu-glm-4v-flash', error: text ? undefined : 'empty' };
    } catch (e: any) {
        return { ok: false, raw: '', provider: 'zhipu-glm-4v-flash', error: trunc(e?.message || String(e), 200) };
    }
}

async function runSiliconflow(mimeType: string, rawBase64: string, key: string, userPrompt: string): Promise<TransportResult> {
    try {
        const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model: 'Qwen/Qwen2-VL-7B-Instruct',
                messages: [
                    { role: 'system', content: VISION_SYSTEM_PROMPT },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: userPrompt || '请识别这张截图并输出 JSON。' },
                            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${rawBase64}` } }
                        ]
                    }
                ]
            })
        });
        if (!res.ok) return { ok: false, raw: '', provider: 'siliconflow-qwen2-vl', error: `HTTP ${res.status}` };
        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        return { ok: Boolean(text), raw: text, provider: 'siliconflow-qwen2-vl', error: text ? undefined : 'empty' };
    } catch (e: any) {
        return { ok: false, raw: '', provider: 'siliconflow-qwen2-vl', error: trunc(e?.message || String(e), 200) };
    }
}

async function runGemini(mimeType: string, rawBase64: string, key: string, userPrompt: string): Promise<TransportResult> {
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: VISION_SYSTEM_PROMPT + '\n' + (userPrompt || '请识别这张截图并输出 JSON。') },
                        { inline_data: { mime_type: mimeType, data: rawBase64 } }
                    ]
                }],
                generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
            })
        });
        if (!res.ok) return { ok: false, raw: '', provider: 'gemini-1.5-flash', error: `HTTP ${res.status}` };
        const data: any = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { ok: Boolean(text), raw: text, provider: 'gemini-1.5-flash', error: text ? undefined : 'empty' };
    } catch (e: any) {
        return { ok: false, raw: '', provider: 'gemini-1.5-flash', error: trunc(e?.message || String(e), 200) };
    }
}

/* ---------------- 解析与向后兼容映射 ---------------- */

function extractJson(text: string): any {
    if (!text) return null;
    const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(cleaned); } catch { /* continue */ }
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* ignore */ } }
    return null;
}

function fieldMap(parsed: any): Record<string, { value: any; raw: string | null; status: string }> {
    const out: Record<string, any> = {};
    for (const f of parsed?.fields || []) {
        if (f && typeof f.key === 'string') {
            out[f.key] = {
                value: f.value ?? null,
                raw: f.raw ?? null,
                status: f.status || (f.value == null ? 'absent' : 'ok')
            };
        }
    }
    return out;
}

/** 每个 key 期望的图上标签（用于拦「整列错位」——实测 mistral 会把普攻命中填进 critRate） */
const EXPECTED_LABELS: Record<string, string[]> = {
    attackMin: ['攻击'],
    attackMax: ['攻击'],
    defense: ['防御'],
    health: ['气血'],
    mana: ['真气', '法力'],
    critDamage: ['致命伤害', '致命一击伤害'],
    critRate: ['致命一击', '致命一击率'],
    physHit: ['普攻命中'],
    physDodge: ['普攻躲闪'],
    critDamageReduction: ['减免暴伤', '减免暴击伤害'],
    critRateReduction: ['减免暴击', '减免暴击率'],
    skillHit: ['技能命中'],
    skillDodge: ['技能躲闪'],
    monsterDamageBonus: ['对怪增伤', '对怪物增伤', '怪增']
};

const normStr = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** 校验：label 必须对号；raw 必须能在转录文本里找到。不通过的字段降级为 invalid，绝不带进计算。 */
function validateParsed(parsed: any): { issues: string[]; parsed: any } {
    const issues: string[] = [];
    const lines: { label: string; raw: string }[] = Array.isArray(parsed?.textLines) ? parsed.textLines : [];
    for (const f of parsed?.fields || []) {
        if (!f || f.status === 'absent' || f.value == null) continue;
        const expected = EXPECTED_LABELS[f.key];
        if (expected) {
            const label = normStr(f.label);
            const labelOk = expected.some(e => label.includes(normStr(e)));
            if (!labelOk) {
                f.status = 'invalid';
                f.reason = `label 不符（期望 ${expected.join('/')}，实际 ${f.label ?? '空'}）`;
                issues.push(`LABEL_MISMATCH:${f.key}`);
                continue;
            }
        }
        // 数值一致性：value 必须能在 raw 里找到（拦「模型多读一位 / 自己算错」，
        // 实测 250832 被读成 2508332、10345 被读成 10346）
        if (f.raw && typeof f.value === 'number') {
            const nums = (String(f.raw).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || []).map(Number);
            const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 1e-4);
            if (nums.length > 0 && !nums.some(n => near(n, f.value as number))) {
                f.status = 'invalid';
                f.reason = `value ${f.value} 与 raw「${f.raw}」不符`;
                issues.push(`VALUE_RAW_MISMATCH:${f.key}`);
                continue;
            }
        }
        if (f.raw) {
            const hit = lines.some(l => normStr(l.raw).includes(normStr(f.raw)) || normStr(f.raw).includes(normStr(l.raw)));
            // 宽恕：raw 没抄全，但数值本身能在某一行找到（实测 health/mana 的 raw 常被模型写残）
            const valHit = f.value != null && lines.some(l => normStr(l.raw).replace(/[,%（）()]/g, '').includes(normStr(f.value)));
            // 气血/真气来自画面顶部的资源条，模型本来就不会把它们抄进行序地图，不该按转录校验
            const fromTopBar = f.key === 'health' || f.key === 'mana';
            if (!fromTopBar && !hit && !valHit) {
                f.status = 'invalid';
                f.reason = 'raw 未在转录文本中出现';
                issues.push(`RAW_NOT_IN_TRANSCRIPT:${f.key}`);
            }
        }
    }
    return { issues, parsed };
}

/** 完整性：计算所需 6 个字段里对了几个 */
function completeness(parsed: any): number {
    const f = fieldMap(parsed);
    return ['attackMin', 'attackMax', 'defense', 'health', 'mana', 'critDamage']
        .filter(k => f[k] && f[k].status === 'ok' && f[k].value != null).length;
}
function toLegacyShape(parsed: any): { mode: string; rawExplanation: string; cPanelData?: any; xycData?: any } {
    const kind = parsed?.panelKind || 'unknown';
    const f = fieldMap(parsed);
    const pick = (k: string) => {
        const cell = f[k];
        if (!cell || cell.status === 'absent' || cell.value == null) return undefined;
        const n = Number(cell.value);
        return Number.isFinite(n) ? n : undefined;
    };
    const explanation = typeof parsed?.rawExplanation === 'string' ? parsed.rawExplanation : '';

    if (kind === 'character_panel') {
        const fac = parsed?.character?.factionRaw;
        return {
            mode: 'c_panel',
            rawExplanation: explanation || '已识别角色属性面板。',
            cPanelData: {
                characterClass: parsed?.character?.classRaw,
                faction: fac === '佛' ? 'FO' : fac === '魔' ? 'MO' : fac === '仙' ? 'XIAN' : undefined,
                attack: pick('attackMax'),
                minAttack: pick('attackMin'),
                defense: pick('defense'),
                hp: pick('health'),
                mp: pick('mana'),
                critRate: pick('critRate'),
                critDamage: pick('critDamage'),
                ignoreReduction: pick('ignoreReduction'),
                monsterDamageBonus: pick('monsterDamageBonus') // 面板没有 → undefined，禁止补值
            }
        };
    }
    if (kind === 'xyc') {
        return {
            mode: 'xyc',
            rawExplanation: explanation || '已识别轩辕策。',
            xycData: {
                beast: f['beast']?.value ?? undefined,
                bookName: f['bookName']?.value ?? undefined,
                isHero: f['heroVersion']?.value === true || f['heroVersion']?.value === 'true',
                level: pick('level'),
                tier: f['tier']?.value ?? undefined,
                stars: pick('stars'),
                washUsed: pick('washUsed'),
                advSkill: {
                    name: f['advSkillName']?.value ?? undefined,
                    variant: f['advSkillVariant']?.value ?? undefined,
                    level: pick('advSkillLevel')
                }
            }
        };
    }
    return { mode: 'general', rawExplanation: explanation || '未能识别为可计算的面板。' };
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
    const env = context.env;
    try {
        const body = (await context.request.json()) as VisionRequestBody;
        const imageBase64 = body.imageBase64 || '';
        const customKeys = body.customKeys || {};

        if (!imageBase64) {
            return json({ ok: false, error: { code: 'no_image', message: 'Image base64 is required' } }, 400);
        }

        let mimeType = 'image/png';
        let rawBase64 = imageBase64;
        if (imageBase64.startsWith('data:')) {
            const m = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (m) { mimeType = m[1]; rawBase64 = m[2]; }
        }
        const dataUrl = `data:${mimeType};base64,${rawBase64}`;
        const userPrompt = body.prompt?.trim() || '请识别这张截图并输出 JSON。';
        const attempts: { provider: string; error?: string }[] = [];
        let best: { parsed: any; issues: string[]; provider: string; score: number } | null = null;
        /** 闸门拒了也要记住「模型认为是哪个体系」：降级时前端据此给准确引导，而不是一律塞角色面板 */
        let recognizedKind: string | null = null;
        let recognizedKindEvidence: string[] = [];

        /** 校验 + 完整性闸门：字段对不齐或太少就换下一条通道，避免把错位数据带进计算 */
        const tryResult = (r: TransportResult) => {
            const raw = r.ok ? extractJson(r.raw) : null;
            if (!raw) {
                attempts.push({ provider: r.provider, error: r.ok ? 'JSON 解析失败' : r.error });
                return null;
            }
            const { parsed, issues } = validateParsed(raw);
            // 归一化（只统一格式，不补值）→ 标准化闸门（不是标准面板图就不算一次有效结果）
            const norm = normalizePanel(parsed);
            const kindOf = norm.panel?.panelKind;
            if (kindOf && kindOf !== 'unknown' && !recognizedKind) {
                recognizedKind = kindOf;
                recognizedKindEvidence = Array.isArray(norm.panel?.kindEvidence) ? norm.panel.kindEvidence.slice(0, 4) : [];
            }
            const std = assessStandardness(norm.panel);
            if (!std.standard) {
                attempts.push({ provider: r.provider, error: `非标准面板[${std.code}]: ${std.detail}` });
                return null;
            }
            const kind = norm.panel?.panelKind;
            const score = kind === 'character_panel'
                ? completeness(norm.panel)
                : (Array.isArray(norm.panel?.fields) ? norm.panel.fields.filter((f: any) => f?.status === 'ok').length : 0);
            if (!best || score > best.score) best = { parsed: norm.panel, issues, provider: r.provider, score };

            const need = kind === 'character_panel' ? 4 : 1;
            if (score >= need) {
                return json({
                    ok: true,
                    provider: r.provider,
                    degraded: false,
                    quality: kind === 'character_panel' && score < 6 ? 'partial' : 'full',
                    issues,
                    panel: norm.panel,
                    result: toLegacyShape(norm.panel)
                });
            }
            attempts.push({ provider: r.provider, error: `字段不完整（${score} 项）` });
            return null;
        };

        // 1) Workers AI（实测可用三条）
        if (env.AI) {
            for (const modelId of CF_VISION_CHAIN) {
                const hit = tryResult(await runCfVision(env.AI, modelId, dataUrl, userPrompt));
                if (hit) return hit;
            }
        } else {
            attempts.push({ provider: 'cf-workers-ai', error: 'AI binding 未注入' });
        }

        // 2) 智谱
        const zhipuKey = customKeys.zhipuKey || env.ZHIPU_API_KEY;
        if (zhipuKey) {
            const hit = tryResult(await runZhipu(mimeType, rawBase64, zhipuKey, userPrompt));
            if (hit) return hit;
        }

        // 3) 硅基
        const sfKey = customKeys.siliconflowKey || env.SILICONFLOW_API_KEY;
        if (sfKey) {
            const hit = tryResult(await runSiliconflow(mimeType, rawBase64, sfKey, userPrompt));
            if (hit) return hit;
        }

        // 4) Gemini
        const gemKey = customKeys.geminiKey || env.GEMINI_API_KEY;
        if (gemKey) {
            const hit = tryResult(await runGemini(mimeType, rawBase64, gemKey, userPrompt));
            if (hit) return hit;
        }

        // 全部通道都拿不到「够用」的结果：如果有最好的一次，就带警告返回（绝不补值）
        if (best) {
            const b = best as { parsed: any; issues: string[]; provider: string; score: number };
            return json({
                ok: true,
                provider: b.provider,
                degraded: false,
                quality: 'partial',
                warning: `识别不完整（计算字段仅 ${b.score}/6 项），缺失项需手填`,
                issues: b.issues,
                attempts,
                panel: b.parsed,
                result: toLegacyShape(b.parsed)
            });
        }

        // 一条都没拿到：明确降级，绝不返回面板数值。
        // degradedReason 三分类，前端据此说人话（旧实现一律说「没有可用的视觉模型」，实测模型明明在跑，
        // 只是把图判成了非标准面板 —— 用户看不懂这条假话）。
        const nonStandard = attempts.some(a => /非标准面板/.test(a.error || ''));
        const noBinding = attempts.some(a => /AI binding 未注入/.test(a.error || ''))
            && attempts.every(a => /AI binding 未注入|JSON 解析失败/.test(a.error || ''));
        const degradedReason = noBinding ? 'no_key' : nonStandard ? 'non_standard' : 'provider_error';

        const kindHint: Record<string, string> = {
            tianyuan: '这张像天缘，但没读到「天命 属性 +值」这样的词条行，不敢带进计算。请截「天缘」详情面板（含全部天命行），或直接说装备名查词条池。',
            xyc: '这张像轩辕策，但书名 / 四系书型没对上。请截完整的轩辕策详情（含书名、洗炼次数、进阶技能）。',
            character_panel: '这张像角色属性面板，但致命伤害 / 致命一击这排对不齐，不敢带进计算。请截完整的 C 键属性面板（含顶部气血真气条）。',
            equip: '这是装备图。直接说装备名，我出图鉴卡更快。',
            fabao: '这是法宝图。说法宝名，我出特技卡。',
            skill: '这是技能图。说技能名，我出技能卡。',
            boss: '这是 BOSS 界面。先说要打哪个副本。',
            combat_log: '战报不能反推面板，请上传角色属性面板截图。'
        };
        const fallbackText = degradedReason === 'non_standard'
            ? (recognizedKind && kindHint[recognizedKind]) || '这张图不是标准面板截图。请截「角色属性面板（C 键）」「轩辕策详情」或「天缘详情」的完整面板再试。'
            : degradedReason === 'no_key'
                ? '识图功能受限：服务端没有注入视觉模型通道（详见 /api/copilot/diag）。可以手动填写下面的空卡，或稍后重试。'
                : '识图通道临时不可用（超时或额度），这次没有拿到任何数值。可以手动填写下面的空卡，或稍后重试。';

        return json({
            ok: false,
            provider: null,
            degraded: true,
            degradedReason,
            recognizedKind,
            recognizedKindEvidence,
            lastError: attempts.map(a => `${a.provider}: ${a.error}`).join(' | ').slice(0, 300),
            attempts,
            result: {
                mode: 'general',
                rawExplanation: fallbackText
            }
        });
    } catch (error: any) {
        return json({
            ok: false,
            degraded: true,
            degradedReason: 'provider_error',
            lastError: trunc(error?.message || String(error), 200),
            error: { code: 'vision_error', message: error?.message || 'Vision parse error' }
        }, 500);
    }
};

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

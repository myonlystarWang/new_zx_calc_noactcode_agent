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
角色属性面板的值区是**两列**，每行一个属性，取的是左侧标签右边的数字：
  第1行：攻击(min–max)  | 防御            → attackMin / attackMax / defense
  第2行：普攻命中        | 普攻躲闪        → 不取（不要填进任何 key）
  第3行：致命伤害        | 致命一击        → critDamage / critRate
  第4行：减免暴伤        | 减免暴击        → 不取
  第5行：技能命中        | 技能躲闪        → 不取
  顶部资源条：气血 cur/max、真气 cur/max、第三槽 cur/max → health / mana 取斜杠后的上限
轩辕策的取值：标题里的 青龙/白虎/朱雀/玄武 → beast，尖括号里的书名 → bookName，末尾「·英雄版」→ heroVersion；「六品」→ tier；★ 个数 → stars；「洗炼次数 4/10」→ washUsed=4；「等级 20」→ level；「（进阶技能）霜池映月III 《碧海》 3级」→ advSkillName / advSkillVariant / advSkillLevel。
天缘的取值：标题「上玄佑万辰须弥盔（+2真气）」→ name=上玄佑万辰须弥盔、part=盔、suffix=+2真气；「天缘+10」→ tianyuanLevel=10；随后每一行「天命+2 真气 +5.8%」都进 attrs 数组：tianming=2、name=真气、value=+5.8%。**天缘有几行输出几行，不许合并、不许省略。**

【四、取字段】每个字段必须同时给 label（图上该行左侧的中文标签），label 必须来自上面的行序地图；没看到就 status="absent"、value=null，并且 raw、label 都为 null。

character_panel 的 key（只这 8 个，不要输出别的）：attackMin / attackMax / defense / health / mana / critDamage / critRate / monsterDamageBonus
xyc 的 key：beast / bookName / heroVersion / tier / stars / washUsed / level / advSkillName / advSkillVariant / advSkillLevel
tianyuan 的 key：name / part / suffix / tianyuanLevel，**并必须输出 attrs 数组**（天缘的全部「天命+N 属性 +值」行）

【四之二、attrs 数组】轩辕策与天缘用它承载词条行，格式：
[{"tianming":2,"name":"真气","value":"+5.8%"},{"tianming":1,"name":"固定攻击","value":"+2057"}]
- name 取属性名（保留「固定」前缀，如 固定攻击 / 固定真气 / 固定气血）
- value 保留原文的正负号与百分号，不要换算成数字
- tianming 只有天缘有（天命+N 的 N）；轩辕策洗炼词条可省略 tianming，改用 "wash" 放括号增量、"extra" 放第二个括号
- 天缘一张图有几行词条就输出几条，漏行等于丢数据

【五、反例铁律（最常见的错，逐条避开）】
- 角色属性面板上没有"对怪增伤"这一行 → monsterDamageBonus 必须 absent，不得填 78 / 82 / 65 / 49.6。
- 致命伤害 与 致命一击 是两行：前者是暴击伤害（如 1889.6%），后者是暴击率（如 261.0%）。不要互换。
- 普攻命中（如 3610）、普攻躲闪（2906）、技能命中（369.5）、技能躲闪（77.5）都不是攻击力，也不是暴击率，不得填进 critRate / critDamage / ignoreReduction。
- 气血 814972/1604910 → health 取上限 1604910，不取当前值。
- 青龙/白虎/朱雀/玄武 只是轩辕策书名的前缀（写进 beast），不要另立字段。
- 天缘标题括号里的「+2真气」是后缀（suffix），不是一条词条，不要放进 attrs。

【六、输出】只输出一个 JSON，不要 markdown 代码块，不要任何解释文字。**必须按示例把所有 8 个 key 都列出来**（没有的就写 absent），不要省略：
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
        if (f.raw) {
            const hit = lines.some(l => normStr(l.raw).includes(normStr(f.raw)) || normStr(f.raw).includes(normStr(l.raw)));
            if (!hit) {
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

        /** 校验 + 完整性闸门：字段对不齐或太少就换下一条通道，避免把错位数据带进计算 */
        const tryResult = (r: TransportResult) => {
            const raw = r.ok ? extractJson(r.raw) : null;
            if (!raw) {
                attempts.push({ provider: r.provider, error: r.ok ? 'JSON 解析失败' : r.error });
                return null;
            }
            const { parsed, issues } = validateParsed(raw);
            const kind = parsed?.panelKind;
            const score = kind === 'character_panel'
                ? completeness(parsed)
                : (Array.isArray(parsed?.fields) ? parsed.fields.filter((f: any) => f?.status === 'ok').length : 0);
            if (!best || score > best.score) best = { parsed, issues, provider: r.provider, score };

            const need = kind === 'character_panel' ? 4 : 1;
            if (score >= need) {
                return json({
                    ok: true,
                    provider: r.provider,
                    degraded: false,
                    quality: kind === 'character_panel' && score < 6 ? 'partial' : 'full',
                    issues,
                    panel: parsed,
                    result: toLegacyShape(parsed)
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

        // 一条都没拿到：明确降级，绝不返回面板数值
        return json({
            ok: false,
            provider: null,
            degraded: true,
            degradedReason: attempts.some(a => /AI binding/.test(a.error || '')) ? 'no_key' : 'provider_error',
            lastError: attempts.map(a => `${a.provider}: ${a.error}`).join(' | ').slice(0, 300),
            attempts,
            result: {
                mode: 'general',
                rawExplanation: '识图功能受限：当前没有可用的视觉模型（详见 /api/copilot/diag）。请手动填写属性，或稍后重试。'
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

/**
 * Cloudflare Pages Function: GET /api/copilot/diag
 *
 * 目的：一条请求看清「模型通道到底通没通」。
 * 只返回布尔与截断后的错误串，不回显任何密钥值。
 *
 * 用法：
 *   curl https://<domain>/api/copilot/diag
 *   curl https://<domain>/api/copilot/diag?only=vision
 *   curl https://<domain>/api/copilot/diag?only=text
 *
 * 设计依据：doc/识图校对与功能路由设计_20261021.md §11
 *   G14 失败必须回传 lastError，禁止只有 console.warn
 *   G15 model id 不写死，候选表逐个试，结果进 diag
 */

interface Env {
    AI?: any;
    ZHIPU_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
    GEMINI_API_KEY?: string;
}

interface ProbeResult {
    id: string;
    shape: string;
    ok: boolean;
    ms: number;
    sample?: string;
    error?: string;
}

/** 1x1 透明 PNG，用于探测视觉通道（不含任何用户数据） */
const TINY_PNG_B64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const TEXT_CANDIDATES = [
    '@cf/meta/llama-3.1-8b-instruct-fp8',
    '@cf/meta/llama-3.2-3b-instruct',
    '@cf/meta/llama-3.1-8b-instruct' // 已知下线，留作对照，证明候选表生效
];

/** 2026-10-21 REST 实测：以下三条在 Workers Free 计划均可用 */
const VISION_CANDIDATES = [
    '@cf/meta/llama-3.2-11b-vision-instruct',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
    '@cf/meta/llama-4-scout-17b-16e-instruct'
];

/** 返回结构不统一：response / result.response / choices[0].message.content */
const pickText = (payload: any): string => {
    if (!payload) return '';
    if (typeof payload === 'string') return payload;
    if (typeof payload.response === 'string') return payload.response;
    if (typeof payload.result?.response === 'string') return payload.result.response;
    const c = payload.choices?.[0]?.message?.content ?? payload.result?.choices?.[0]?.message?.content;
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map((x: any) => x?.text ?? '').join('');
    if (typeof payload.result?.description === 'string') return payload.result.description;
    return '';
};

const trunc = (v: unknown, n = 180): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (!s) return '';
    return s.length > n ? s.slice(0, n) + '…' : s;
};

/** Workers 运行时没有 Node Buffer，用 atob 解 base64 */
const bytesFromBase64 = (b64: string): number[] => {
    const bin = atob(b64);
    const arr: number[] = [];
    for (let i = 0; i < bin.length; i++) arr.push(bin.charCodeAt(i));
    return arr;
};

const errText = (e: any): string => {
    const m = e?.message || e?.toString?.() || 'unknown error';
    return trunc(m, 200);
};

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; value?: T; error?: string }> {
    const t0 = Date.now();
    try {
        const value = await fn();
        return { ok: true, ms: Date.now() - t0, value };
    } catch (e) {
        return { ok: false, ms: Date.now() - t0, error: errText(e) };
    }
}

/** 文本模型探测 */
async function probeText(ai: any): Promise<ProbeResult[]> {
    const out: ProbeResult[] = [];
    for (const id of TEXT_CANDIDATES) {
        const r = await timed(() =>
            ai.run(id, {
                messages: [{ role: 'user', content: '回复两个字：通了' }],
                max_tokens: 16
            })
        );
        const text = r.ok ? pickText(r.value) : '';
        out.push({
            id,
            shape: 'messages',
            ok: Boolean(text),
            ms: r.ms,
            sample: text ? trunc(text, 60) : undefined,
            error: r.ok ? (text ? undefined : 'empty response') : r.error
        });
    }
    return out;
}

/** 视觉模型探测：同一张 1x1 图，试 3 种入参形状 */
async function probeVision(ai: any, id: string): Promise<ProbeResult[]> {
    const out: ProbeResult[] = [];
    const dataUrl = `data:image/png;base64,${TINY_PNG_B64}`;
    const bytes = bytesFromBase64(TINY_PNG_B64);
    const ask = 'What color is this image? Answer in one word.';

    // 形状 A：OpenAI 兼容多模态 messages（文档推荐形态，实测可用）
    {
        const r = await timed(() =>
            ai.run(id, {
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: ask },
                            { type: 'image_url', image_url: { url: dataUrl } }
                        ]
                    }
                ],
                max_tokens: 24
            })
        );
        const text = r.ok ? pickText(r.value) : '';
        out.push({
            id,
            shape: 'messages+image_url(dataURL)',
            ok: Boolean(text),
            ms: r.ms,
            sample: text ? trunc(text, 60) : undefined,
            error: r.ok ? (text ? undefined : 'empty response') : r.error
        });
    }

    // 形状 B：prompt + image 字节数组（旧形态）
    {
        const r = await timed(() =>
            ai.run(id, { prompt: ask, image: bytes, max_tokens: 24 })
        );
        const text = r.ok ? pickText(r.value) : '';
        out.push({
            id,
            shape: 'prompt+image(bytes[])',
            ok: Boolean(text),
            ms: r.ms,
            sample: text ? trunc(text, 60) : undefined,
            error: r.ok ? (text ? undefined : 'empty response') : r.error
        });
    }

    // 形状 C：prompt + image base64 字符串
    {
        const r = await timed(() =>
            ai.run(id, { prompt: ask, image: TINY_PNG_B64, max_tokens: 24 })
        );
        const text = r.ok ? pickText(r.value) : '';
        out.push({
            id,
            shape: 'prompt+image(base64)',
            ok: Boolean(text),
            ms: r.ms,
            sample: text ? trunc(text, 60) : undefined,
            error: r.ok ? (text ? undefined : 'empty response') : r.error
        });
    }

    return out;
}

/** llama-3.2-vision 需要先接受 Meta License；失败不算错误，只报状态 */
async function probeLicense(ai: any): Promise<ProbeResult> {
    const id = '@cf/meta/llama-3.2-11b-vision-instruct';
    const r = await timed(() => ai.run(id, { prompt: 'agree', max_tokens: 8 }));
    return {
        id,
        shape: 'license(agree)',
        ok: r.ok,
        ms: r.ms,
        sample: r.ok ? trunc((r.value as any)?.response, 60) : undefined,
        error: r.ok ? undefined : r.error
    };
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
    const url = new URL(context.request.url);
    const only = url.searchParams.get('only') || 'all';
    const env = context.env;

    const report: any = {
        at: new Date().toISOString(),
        runtime: {
            hasAI: Boolean(env.AI),
            aiType: env.AI ? typeof env.AI.run : 'undefined',
            keys: {
                zhipu: Boolean(env.ZHIPU_API_KEY),
                siliconflow: Boolean(env.SILICONFLOW_API_KEY),
                gemini: Boolean(env.GEMINI_API_KEY)
            }
        }
    };

    if (!env.AI) {
        report.verdict = 'AI binding 未注入：检查 Pages → Settings → Bindings 里是否有名字叫 AI 的 Workers AI 绑定，且改完要重新部署';
        return json(report);
    }

    if (only === 'all' || only === 'license') {
        report.license = await probeLicense(env.AI);
    }
    if (only === 'all' || only === 'text') {
        report.text = await probeText(env.AI);
    }
    if (only === 'all' || only === 'vision') {
        report.vision = [];
        for (const id of VISION_CANDIDATES) {
            report.vision.push(...(await probeVision(env.AI, id)));
        }
    }

    // 结论：给出"第一个可用组合"，供后续 vision.ts 直接采用
    const visionOk = (report.vision || []).filter((v: ProbeResult) => v.ok);
    report.verdict = visionOk.length
        ? `可用视觉组合：${visionOk[0].id} + ${visionOk[0].shape}`
        : '没有可用的视觉组合：见 vision[].error（常见原因：未接受 Meta License / 模型下线 / 配额不足）';

    return json(report);
};

function json(data: unknown): Response {
    return new Response(JSON.stringify(data, null, 2), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        }
    });
}

/**
 * Cloudflare Pages Function: /api/copilot/chat
 * 纯文本专属高 RPM 免费模型池路由
 * 规则：严禁调用视觉多模态模型以防消耗视觉配额。
 */

interface Env {
    ZHIPU_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
    AI?: any; // Cloudflare Workers AI binding
}

interface RequestBody {
    prompt: string;
    history?: { role: string; content: string }[];
    customKeys?: {
        zhipuKey?: string;
        siliconflowKey?: string;
    };
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
    try {
        const body = (await context.request.json()) as RequestBody;
        const prompt = body.prompt?.trim();
        const history = body.history || [];
        const customKeys = body.customKeys || {};

        if (!prompt) {
            return new Response(JSON.stringify({ error: 'Prompt is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const systemMessage = {
            role: 'system',
            content: `你是《诛仙3》顶尖战术配装与机制计算专家。
专业背景涵盖：
1. 副本 BOSS（T19~T21断浪碎晶宫、流波惊变等）属性机制、破防无视门槛、减免百分比、怪增收益。
2. 轩辕策四象（青龙/白虎/朱雀/玄武）基础底子与20阶满级极限、技能命中/躲闪/爆伤。
3. 装备（修武/昭武/彰武/神隐+0~+15）、法宝（普通/承/真品阶）、新天缘须弥属性。
回答规范：
- 语言精炼准确，紧扣实战数值与收益分析。
- 绝不要使用 LaTeX 数学公式（不要写 $ 或 \\frac 等符号），所有计算与数值请直接使用纯文本表达（例如：135% + 15% = 150%）。
- 态度客观严谨。`
        };

        const messages = [
            systemMessage,
            ...history.slice(-6),
            { role: 'user', content: prompt }
        ];

        // 优先级 1: 用户自定义智谱 Key 或环境变量 ZHIPU_API_KEY
        const zhipuKey = customKeys.zhipuKey || context.env.ZHIPU_API_KEY;
        if (zhipuKey) {
            try {
                const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${zhipuKey}`
                    },
                    body: JSON.stringify({
                        model: 'glm-4-flash',
                        messages,
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });

                if (res.ok) {
                    const data: any = await res.json();
                    const reply = data.choices?.[0]?.message?.content;
                    if (reply) {
                        return new Response(JSON.stringify({ reply, provider: 'zhipu-glm-4-flash' }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch (err) {
                console.warn('Zhipu chat error:', err);
            }
        }

        // 优先级 2: 用户自定义硅基流动 Key 或环境变量 SILICONFLOW_API_KEY (Qwen2.5-7B Free)
        const sfKey = customKeys.siliconflowKey || context.env.SILICONFLOW_API_KEY;
        if (sfKey) {
            try {
                const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sfKey}`
                    },
                    body: JSON.stringify({
                        model: 'Qwen/Qwen2.5-7B-Instruct',
                        messages,
                        temperature: 0.7,
                        max_tokens: 1024
                    })
                });

                if (res.ok) {
                    const data: any = await res.json();
                    const reply = data.choices?.[0]?.message?.content;
                    if (reply) {
                        return new Response(JSON.stringify({ reply, provider: 'siliconflow-qwen2.5' }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                }
            } catch (err) {
                console.warn('Siliconflow chat error:', err);
            }
        }

        // 优先级 3: Cloudflare Workers AI 本地绑定（如果配置了 Workers AI）
        // 注意：@cf/meta/llama-3.1-8b-instruct 已于官方下线（现存 -fp8 版本），
        // 写死单个 model id 会导致调用必失败且错误被 catch 吞掉 → 落 local-fallback 且无从排查。
        // 因此改为候选表逐个尝试，并把失败原因放进响应（G14 / G15）。
        if (context.env.AI) {
            const aiCandidates = [
                '@cf/meta/llama-3.1-8b-instruct-fp8',
                '@cf/meta/llama-3.2-3b-instruct'
            ];
            const aiErrors: string[] = [];
            for (const modelId of aiCandidates) {
                try {
                    const aiRes: any = await context.env.AI.run(modelId, {
                        messages,
                        max_tokens: 512
                    });
                    // 返回结构不统一：部分模型给 response，部分给 OpenAI 兼容的 choices[0].message.content
                    const aiText = typeof aiRes?.response === 'string'
                        ? aiRes.response
                        : (typeof aiRes?.choices?.[0]?.message?.content === 'string' ? aiRes.choices[0].message.content : '');
                    if (aiText) {
                        return new Response(JSON.stringify({ reply: aiText, provider: `cloudflare-workers-ai:${modelId}` }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }
                    aiErrors.push(`${modelId}: empty response`);
                } catch (err: any) {
                    aiErrors.push(`${modelId}: ${(err?.message || String(err)).slice(0, 160)}`);
                    console.warn('Workers AI chat error:', modelId, err);
                }
            }
            // 全部候选失败：把原因带回前端（截断），便于定位是模型下线还是配额问题
            return new Response(JSON.stringify({
                reply: `【模型通道异常】Workers AI 候选模型均调用失败，已回退到本地知识库答复。\n${aiErrors.join('\n')}\n\n` + `针对你的咨询「${prompt}」：\n本地知识库暂未覆盖该问题，可换一种说法（例如「逐霜 打桩」「T20 逆戟鲸神 属性」），或稍后重试。`,
                provider: 'local-fallback',
                lastError: aiErrors.join(' | ').slice(0, 300)
            }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 兜底智能策略回复（若服务端未配置远程 Key）
        const fallbackReply = `【诛仙3 战术策略库】
针对你的咨询「${prompt}」：
1. 攻坚配装基准：当前版本副本 BOSS（如 T21 赤梭）拥有极高基础减爆伤与防御属性，优先堆叠暴击伤害（建议1700%+）与对怪伤害增加（30%+）。
2. 细节优先级：轩辕策爆伤与攻击气血真气三项属性优先，配合新天缘高阶属性可获得稳定突破。
如需测算精准战力，可点击输入框上方的快捷提问或上传任务属性面板截图。`;

        return new Response(JSON.stringify({ reply: fallbackReply, provider: 'local-fallback' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error?.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

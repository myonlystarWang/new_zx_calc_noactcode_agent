/**
 * DEV-only 识图 fixture 注入（生产构建被 import.meta.env.DEV 剔除）。
 *
 * 用法（本地 vite dev）：
 *   ?vision=fixture:zhaoming_xian_full
 *   localStorage.setItem('zx_vision_fixture', 'zhaoming_xian_full')
 *   或 DevTools 里直接设 window.__ZX_VISION_FIXTURE__ = {...}
 *   'off' / 空 → 关闭注入，走真实接口
 */

const PANEL_ZH = {
    panelKind: 'character_panel',
    kindEvidence: ['致命一击', '御仙'],
    kindConfidence: 0.94,
    textLines: [
        { label: '攻击', raw: '26918-151478' },
        { label: '防御', raw: '30545' },
        { label: '普攻命中', raw: '3610' },
        { label: '普攻躲闪', raw: '2906' },
        { label: '气血', raw: '814972/1604910' },
        { label: '真气', raw: '1145140/2983930' },
        { label: '致命伤害', raw: '1889.6%' },
        { label: '致命一击', raw: '261.0%' },
        { label: '减免暴伤', raw: '742.1%' },
        { label: '减免暴击', raw: '132.9%' },
        { label: '技能命中', raw: '369.5' },
        { label: '技能躲闪', raw: '77.5' }
    ],
    fields: [
        { key: 'attackMin', label: '攻击', raw: '26918-151478', value: 26918, status: 'ok' },
        { key: 'attackMax', label: '攻击', raw: '26918-151478', value: 151478, status: 'ok' },
        { key: 'defense', label: '防御', raw: '30545', value: 30545, status: 'ok' },
        { key: 'physHit', label: '普攻命中', raw: '3610', value: 3610, status: 'ok' },
        { key: 'physDodge', label: '普攻躲闪', raw: '2906', value: 2906, status: 'ok' },
        { key: 'health', label: '气血', raw: '814972/1604910', value: 1604910, status: 'ok' },
        { key: 'mana', label: '真气', raw: '1145140/2983930', value: 2983930, status: 'ok' },
        { key: 'critDamage', label: '致命伤害', raw: '1889.6%', value: 1889.6, status: 'ok' },
        { key: 'critRate', label: '致命一击', raw: '261.0%', value: 261.0, status: 'ok' },
        { key: 'critDamageReduction', label: '减免暴伤', raw: '742.1%', value: 742.1, status: 'ok' },
        { key: 'critRateReduction', label: '减免暴击', raw: '132.9%', value: 132.9, status: 'ok' },
        { key: 'skillHit', label: '技能命中', raw: '369.5', value: 369.5, status: 'ok' },
        { key: 'skillDodge', label: '技能躲闪', raw: '77.5', value: 77.5, status: 'ok' },
        { key: 'monsterDamageBonus', label: null, raw: null, value: null, status: 'absent' }
    ],
    character: { classRaw: '昭冥', factionRaw: '仙', levelRaw: '175' },
    rawExplanation: '识别到昭冥·仙角色属性面板。'
};

const PANEL_XYC = {
    panelKind: 'xyc',
    kindEvidence: ['洗炼次数', '进阶技能'],
    kindConfidence: 0.92,
    textLines: [{ label: '等级', raw: '1' }, { label: '洗炼次数', raw: '4/10' }],
    fields: [
        { key: 'beast', label: '书系', raw: '青龙', value: '青龙', status: 'ok' },
        { key: 'bookName', label: '书名', raw: '青囊玉书', value: '青囊玉书', status: 'ok' },
        { key: 'tier', label: '品阶', raw: '六品', value: '六品', status: 'ok' },
        { key: 'stars', label: '星级', raw: '★★★★★', value: 5, status: 'ok' },
        { key: 'washUsed', label: '洗炼次数', raw: '4/10', value: 4, status: 'ok' },
        { key: 'level', label: '等级', raw: '1', value: 1, status: 'ok' },
        { key: 'advSkillName', label: '进阶技能', raw: '山雨欲来III', value: '山雨欲来III', status: 'ok' },
        { key: 'advSkillVariant', label: '进阶技能', raw: '《天空》', value: '天空', status: 'ok' },
        { key: 'advSkillLevel', label: '进阶技能', raw: '1级', value: 1, status: 'ok' }
    ],
    character: null
};

const PANEL_TIANYUAN = {
    panelKind: 'tianyuan',
    kindEvidence: ['天缘+10', '天命+2'],
    kindConfidence: 0.95,
    textLines: [
        { label: '天缘', raw: '天缘+10' },
        { label: '天命', raw: '天命+2 真气 +5.8%' }
    ],
    fields: [
        { key: 'name', label: '名称', raw: '上玄佑万辰须弥盔（+2真气）', value: '上玄佑万辰须弥盔', status: 'ok' },
        { key: 'part', label: '部位', raw: '上玄佑万辰须弥盔（+2真气）', value: '盔', status: 'ok' },
        { key: 'suffix', label: '后缀', raw: '上玄佑万辰须弥盔（+2真气）', value: '+2真气', status: 'ok' },
        { key: 'tianyuanLevel', label: '天缘等级', raw: '天缘+10', value: 10, status: 'ok' }
    ],
    attrs: [
        { tianming: 2, name: '真气', value: '+5.8%' },
        { tianming: 1, name: '固定攻击', value: '+2057' },
        { tianming: 3, name: '固定真气', value: '+4468' },
        { tianming: 2, name: '固定气血', value: '+3427' }
    ],
    character: null,
    rawExplanation: '识别到上玄佑万辰须弥盔，天缘 +10，4 条天命词条。'
};

const FIXTURES: Record<string, any> = {
    zhaoming_xian_full: {
        ok: true,
        provider: 'cf-workers-ai:@cf/mistralai/mistral-small-3.1-24b-instruct',
        degraded: false,
        quality: 'full',
        panel: PANEL_ZH,
        result: { mode: 'c_panel', rawExplanation: '识别到昭冥·仙角色属性面板。' }
    },
    xyc_qinglong: {
        ok: true,
        provider: 'cf-workers-ai:@cf/mistralai/mistral-small-3.1-24b-instruct',
        degraded: false,
        quality: 'full',
        panel: PANEL_XYC,
        result: { mode: 'xyc', rawExplanation: '识别到青龙<青囊玉书>·英雄版。' }
    },
    tianyuan_xumikui: {
        ok: true,
        provider: 'cf-workers-ai:@cf/mistralai/mistral-small-3.1-24b-instruct',
        degraded: false,
        quality: 'full',
        panel: PANEL_TIANYUAN,
        result: { mode: 'general', rawExplanation: '识别到上玄佑万辰须弥盔，天缘 +10，4 条天命词条。' }
    },
    degraded_no_key: {
        ok: false,
        provider: null,
        degraded: true,
        degradedReason: 'no_key',
        lastError: 'cf-workers-ai: AI binding 未注入',
        result: { mode: 'general', rawExplanation: '识图功能受限：当前没有可用的视觉模型，未能识别出任何数值。' }
    },
    hallucinated: {
        ok: true,
        provider: 'cf-workers-ai:@cf/meta/llama-4-scout-17b-16e-instruct',
        degraded: false,
        quality: 'partial',
        issues: ['LABEL_MISMATCH:critRate'],
        panel: {
            ...PANEL_ZH,
            fields: PANEL_ZH.fields.map(f => f.key === 'critRate'
                ? { key: 'critRate', label: '普攻命中', raw: '3610', value: 3610, status: 'ok' }
                : f)
        },
        result: { mode: 'c_panel', rawExplanation: '识别完成，但有一项标签不符。' }
    }
};

export function getVisionFixture(): any | null {
    if (!(import.meta as any).env?.DEV) return null;
    try {
        const w = window as any;
        if (w.__ZX_VISION_FIXTURE__) return w.__ZX_VISION_FIXTURE__;
        const fromLs = localStorage.getItem('zx_vision_fixture');
        const fromUrl = new URLSearchParams(window.location.search).get('vision');
        const id = (fromLs && fromLs !== 'off')
            ? fromLs
            : (fromUrl && fromUrl.startsWith('fixture:') ? fromUrl.slice(8) : null);
        if (!id) return null;
        return FIXTURES[id] || null;
    } catch {
        return null;
    }
}

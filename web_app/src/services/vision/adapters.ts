/**
 * 服务端识别结果 → 前端可渲染的 RecognizedPanel。
 * 这里做三件事：字段按注册表排序补空、label/raw 双校验、算出引擎快照。
 */
import type { FieldCell, PanelKind, RecognizedPanel } from './types';
import { fieldsFor } from './fieldRegistry';
import { mapToEngine } from './mapToEngine';

const norm = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

function parseBars(raw: { label: string; raw: string }[], fields: FieldCell[]): RecognizedPanel['bars'] {
    const pick = (labels: string[]) => raw.find(l => labels.some(x => norm(l.label).includes(norm(x))));
    const split = (s?: string) => {
        if (!s) return {};
        const m = String(s).replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
        return m ? { cur: Number(m[1]), max: Number(m[2]) } : {};
    };
    const hp = split(pick(['气血', '血量'])?.raw);
    const mp = split(pick(['真气', '法力'])?.raw);
    const third = split(pick(['灵力', '元力', '元气', '第三'])?.raw);
    if (!hp.max && !mp.max && !third.max) {
        // 没有 cur/max 原文时，退回字段值（只有上限）
        const h = fields.find(f => f.key === 'health');
        const m = fields.find(f => f.key === 'mana');
        if (!h && !m) return undefined;
        return { hpMax: typeof h?.value === 'number' ? h.value : undefined, mpMax: typeof m?.value === 'number' ? m.value : undefined };
    }
    return {
        hpCur: hp.cur, hpMax: hp.max,
        mpCur: mp.cur, mpMax: mp.max,
        thirdCur: third.cur, thirdMax: third.max
    };
}

export function fromServerPanel(serverPanel: any, imageRef: string | null, meta?: { provider?: string | null; quality?: 'full' | 'partial'; issues?: string[] }): RecognizedPanel {
    const kind: PanelKind = (serverPanel?.panelKind as PanelKind) || 'unknown';
    const serverFields: any[] = Array.isArray(serverPanel?.fields) ? serverPanel.fields : [];
    const byKey = new Map<string, any>();
    for (const f of serverFields) {
        if (f && typeof f.key === 'string') byKey.set(f.key, f);
    }

    const textLines: { label: string; raw: string }[] = Array.isArray(serverPanel?.textLines)
        ? serverPanel.textLines.filter((l: any) => l && typeof l.raw === 'string').map((l: any) => ({ label: String(l.label ?? ''), raw: String(l.raw) }))
        : [];

    const issues: string[] = [...(meta?.issues || [])];

    // attrs 兜底：部分模型（实测 llama-4-scout）会把词条数组塞进 fields，key 写成 attrs
    const rawAttrs: any[] = (() => {
        if (Array.isArray(serverPanel?.attrs)) return serverPanel.attrs;
        const fromFields = serverFields.find((f: any) => f && f.key === 'attrs' && Array.isArray(f.value));
        return fromFields ? fromFields.value : [];
    })();
    const attrs = rawAttrs
        .filter(a => a && typeof a === 'object' && (a.name || a.value))
        .map(a => ({
            name: String(a.name ?? ''),
            value: String(a.value ?? ''),
            tianming: typeof a.tianming === 'number' ? a.tianming : (typeof a.tianming === 'string' && a.tianming.trim() !== '' ? Number(a.tianming) : undefined),
            wash: a.wash ? String(a.wash) : undefined,
            extra: a.extra ? String(a.extra) : undefined
        }));

    const cells: FieldCell[] = fieldsFor(kind).map(def => {
        const raw = byKey.get(def.key);
        const value = raw?.value ?? null;
        const label = raw?.label ?? def.label;
        let status = (raw?.status as FieldCell['status']) || (value === null ? 'absent' : 'ok');

        // 校验一：label 必须对号（拦「整列错位」）
        if (status !== 'absent' && value !== null && def.expectedLabels.length > 0) {
            const ok = def.expectedLabels.some(e => norm(label).includes(norm(e)));
            if (!ok) {
                status = 'invalid';
                issues.push(`${def.label}：标签不符（识别为「${label}」）`);
            }
        }
        // 校验二：raw 必须能在转录文本里找到（只对「数值型面板行」生效；
        // 轩辕策/天缘的书名、品阶等来自标题，不在 textLines 里；手填项本就没有 raw）
        if (status !== 'absent' && value !== null && !def.manual && raw?.raw && def.expectedLabels.length > 0 && textLines.length > 0) {
            const hit = textLines.some(l => norm(l.raw).includes(norm(raw.raw)) || norm(raw.raw).includes(norm(l.raw)));
            if (!hit && textLines.length > 0) {
                status = 'invalid';
                issues.push(`${def.label}：图中未找到出处`);
            }
        }
        // 校验三：最小攻不得大于最大攻
        if (def.key === 'attackMin' && typeof value === 'number' && typeof byKey.get('attackMax')?.value === 'number') {
            if (value > Number(byKey.get('attackMax').value)) {
                status = 'invalid';
                issues.push('最小攻大于最大攻，可能抄串行');
            }
        }

        return {
            key: def.key,
            label: def.label,
            unit: def.unit,
            value,
            raw: raw?.raw ?? null,
            status,
            confidence: typeof raw?.confidence === 'number' ? raw.confidence : (status === 'ok' ? 0.9 : 0),
            source: value === null ? 'none' : 'vision',
            engine: def.engine,
            reason: def.engine ? undefined : (value !== null ? '已记录 · 不参与计算' : undefined)
        };
    });

    // 只有角色面板需要「另有 N 项」计数；轩辕策/天缘的词条已经单独渲染
    const extraCount = kind === 'character_panel'
        ? Math.max(0, textLines.length - cells.filter(c => c.status === 'ok').length)
        : 0;

    const base: RecognizedPanel = {
        kind,
        kindConfidence: typeof serverPanel?.kindConfidence === 'number' ? serverPanel.kindConfidence : 0,
        kindEvidence: Array.isArray(serverPanel?.kindEvidence) ? serverPanel.kindEvidence : [],
        provider: meta?.provider ?? null,
        degraded: false,
        quality: meta?.quality || 'full',
        extraCount,
        character: serverPanel?.character || undefined,
        bars: parseBars(textLines, cells),
        fields: cells,
        attrs: attrs.length > 0 ? attrs : undefined,
        xyc: kind === 'xyc' ? {
            beast: byKey.get('beast')?.value ?? undefined,
            bookName: byKey.get('bookName')?.value ?? undefined,
            heroVersion: byKey.get('heroVersion')?.value === true || byKey.get('heroVersion')?.value === 'true',
            tier: byKey.get('tier')?.value ?? undefined,
            stars: typeof byKey.get('stars')?.value === 'number' ? byKey.get('stars').value : undefined,
            washUsed: typeof byKey.get('washUsed')?.value === 'number' ? byKey.get('washUsed').value : undefined,
            level: typeof byKey.get('level')?.value === 'number' ? byKey.get('level').value : undefined
        } : undefined,
        advSkill: kind === 'xyc' ? {
            name: byKey.get('advSkillName')?.value ?? undefined,
            variant: byKey.get('advSkillVariant')?.value ?? undefined,
            level: typeof byKey.get('advSkillLevel')?.value === 'number' ? byKey.get('advSkillLevel').value : undefined
        } : undefined,
        tianyuan: kind === 'tianyuan' ? {
            name: (byKey.get('name')?.value ?? undefined) as string | undefined,
            part: (byKey.get('part')?.value ?? undefined) as string | undefined,
            suffix: (byKey.get('suffix')?.value ?? undefined) as string | undefined,
            tianyuanLevel: typeof byKey.get('tianyuanLevel')?.value === 'number' ? byKey.get('tianyuanLevel').value : undefined
        } : undefined,
        textLines,
        issues,
        engine: { attrs: {}, missingRequired: [], mappedFrom: {} },
        imageRef
    };

    base.engine = mapToEngine(base);
    return base;
}

/** 降级态：没有任何数值，只留一张可手填的空卡 */
export function degradedPanel(envelope: { degradedReason?: string; lastError?: string; panel?: any }, imageRef: string | null): RecognizedPanel {
    const kind: PanelKind = (envelope?.panel?.panelKind as PanelKind) || 'character_panel';
    const cells: FieldCell[] = fieldsFor(kind).map(def => ({
        key: def.key,
        label: def.label,
        unit: def.unit,
        value: null,
        raw: null,
        status: 'absent' as const,
        confidence: 0,
        source: 'none' as const,
        engine: def.engine,
        reason: def.manual ? def.absentHint : undefined
    }));
    const base: RecognizedPanel = {
        kind,
        kindConfidence: 0,
        kindEvidence: [],
        provider: null,
        degraded: true,
        degradedReason: envelope?.degradedReason || 'provider_error',
        quality: 'degraded',
        extraCount: 0,
        fields: cells,
        textLines: [],
        issues: envelope?.lastError ? [envelope.lastError] : [],
        engine: { attrs: {}, missingRequired: [], mappedFrom: {} },
        imageRef
    };
    base.engine = mapToEngine(base);
    return base;
}

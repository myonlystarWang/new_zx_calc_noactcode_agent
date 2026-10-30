/**
 * 服务端识别结果 → 前端可渲染的 RecognizedPanel。
 * 这里做四件事：字段按注册表排序补空、label/raw/value 三重校验、职业是否对得上、算出引擎快照。
 *
 * 2026-10-29 加的两道校验（线上实测 mistral 会稳定把右列「减免暴伤」的值填进左列「致命一击」，
 * 并把气血 250832 读成 2508332）：
 *   校验四 value ↔ raw 数值一致 —— 拦「模型自己算错 / 多读少读一位」
 *   校验五 raw 必须来自 label 匹配的那一行 —— 拦「左右列串位」
 * 这两条之所以必须加：label 校验和 raw 存在性校验用的都是模型自己给的 label / textLines，
 * 同源幻觉永远自洽，等于没校验。
 */
import type { FieldCell, PanelKind, RecognizedPanel } from './types';
import { fieldsFor } from './fieldRegistry';
import { mapToEngine } from './mapToEngine';
import { DataService } from '../DataService';

const norm = (s: any) => String(s ?? '').replace(/\s+/g, '').toLowerCase();

/** 从原文里抽出所有数字（去千分位；保留小数） */
function numsIn(s: string): number[] {
    return (String(s).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) || [])
        .map(Number)
        .filter(n => Number.isFinite(n));
}

/** 数值相等判定：容忍小数截断（487.1 vs 487.10）与千分位写法差异 */
function sameNum(a: number, b: number): boolean {
    return Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 1e-4);
}

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

/**
 * 职业名能否对上职业表。
 * 对不上 = 模型幻觉（实测把「百灵」读成「元灵」），必须显式告知，不能静默保留上一个职业。
 * 职业表还没加载完时返回 undefined（不下结论，避免误判）。
 */
function resolveClass(classRaw?: string): { known?: boolean; className?: string } {
    if (!classRaw) return {};
    let classes: any[] = [];
    try {
        classes = DataService.getInstance().getClasses() || [];
    } catch {
        return {};
    }
    if (classes.length === 0) return {};
    const hit = classes.find((c: any) => c.ClassName === classRaw || c.ClassID === classRaw);
    return hit ? { known: true, className: hit.ClassName } : { known: false };
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
            // 天命档：0 是合法值（图上只写「天命」= +0），不能当"没读到"丢掉
            tianming: (() => {
                const raw = a.tianming;
                if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(10, Math.round(raw)));
                if (typeof raw === 'string') {
                    const d = raw.replace(/[^0-9]/g, '');
                    return d === '' ? undefined : Math.max(0, Math.min(10, Number(d)));
                }
                return undefined;
            })(),
            wash: a.wash ? String(a.wash) : undefined,
            extra: a.extra ? String(a.extra) : undefined
        }));

    const cells: FieldCell[] = fieldsFor(kind).map(def => {
        const raw = byKey.get(def.key);
        const value = raw?.value ?? null;
        const label = raw?.label ?? def.label;
        let status = (raw?.status as FieldCell['status']) || (value === null ? 'absent' : 'ok');

        // 校验一：label 必须对号（拦「整列错位」的第一道，用的是模型自报的 label，单靠它不够）
        if (status !== 'absent' && value !== null && def.expectedLabels.length > 0) {
            const ok = def.expectedLabels.some(e => norm(label).includes(norm(e)));
            if (!ok) {
                status = 'invalid';
                issues.push(`${def.label}：标签不符（识别为「${label}」）`);
            }
        }
        // 校验二：raw 必须能在转录文本里找到（只对「数值型面板行」生效；
        // 轩辕策/天缘的书名、品阶等来自标题，不在 textLines 里；手填项本就没有 raw）
        if (status !== 'absent' && status !== 'invalid' && value !== null && !def.manual && raw?.raw && def.expectedLabels.length > 0 && textLines.length > 0) {
            const hit = textLines.some(l => norm(l.raw).includes(norm(raw.raw)) || norm(raw.raw).includes(norm(l.raw)));
            if (!hit) {
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
        // 校验四：value 必须能在 raw 原文里找到（拦「模型自己算错 / 多读一位」，如 250832 → 2508332）
        if (status !== 'absent' && status !== 'invalid' && typeof value === 'number' && raw?.raw) {
            const nums = numsIn(raw.raw);
            if (nums.length > 0 && !nums.some(n => sameNum(n, value))) {
                status = 'invalid';
                issues.push(`${def.label}：数值 ${value} 与原文「${raw.raw}」不符`);
            }
        }
        // 校验五：raw 所在的那一行，标签必须也匹配（拦「左右列串位」：
        // 实测 201.3% 属于「减免暴伤」行，却被填进了「致命一击」）
        if (status !== 'absent' && status !== 'invalid' && typeof value === 'number' && raw?.raw && def.expectedLabels.length > 0 && textLines.length > 0) {
            const hitLines = textLines.filter(l => norm(l.raw).includes(norm(raw.raw)) || norm(raw.raw).includes(norm(l.raw)));
            if (hitLines.length > 0 && !hitLines.some(l => def.expectedLabels.some(e => norm(l.label).includes(norm(e))))) {
                status = 'invalid';
                issues.push(`${def.label}：该数值在图中属于「${hitLines[0].label}」行，疑似左右列串位`);
            }
        }
        // 校验六：进引擎的数值没有原文佐证 → 降为「需复核」（仍带入，但卡上标黄，不静默采信）
        if (status === 'ok' && def.engine && !def.manual && value !== null && !raw?.raw) {
            status = 'low_confidence';
            issues.push(`${def.label}：无原文佐证，请复核`);
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

    // 「另有 N 项」= 转录到了、但没有任何字段认领的行（例如第三槽的「灵力」）。
    // 不能用「textLines 条数 − ok 字段数」：字段被校验判 invalid 时那一行其实已经被认领，
    // 再算进「另有」会误导用户以为漏了数据。
    const BAR_LABELS = ['气血', '血量', '真气', '法力', '灵力', '元力', '元气', '第三'];
    const claimed = textLines.map(l => {
        const n = norm(l.raw);
        if (BAR_LABELS.some(b => norm(l.label).includes(norm(b)))) return true;
        return cells.some(c => c.raw && (norm(c.raw).includes(n) || n.includes(norm(c.raw))));
    });
    const extraCount = kind === 'character_panel' ? claimed.filter(x => !x).length : 0;

    const classInfo = kind === 'character_panel' ? resolveClass(serverPanel?.character?.classRaw) : {};
    if (classInfo.known === false) {
        issues.push(`职业「${serverPanel?.character?.classRaw}」不在职业表里，请手动选`);
    }

    const base: RecognizedPanel = {
        kind,
        kindConfidence: typeof serverPanel?.kindConfidence === 'number' ? serverPanel.kindConfidence : 0,
        kindEvidence: Array.isArray(serverPanel?.kindEvidence) ? serverPanel.kindEvidence : [],
        provider: meta?.provider ?? null,
        degraded: false,
        quality: meta?.quality || 'full',
        extraCount,
        character: serverPanel?.character
            ? { ...serverPanel.character, classUnknown: classInfo.known === false }
            : undefined,
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
export function degradedPanel(envelope: { degradedReason?: string; lastError?: string; panel?: any; recognizedKind?: string | null; recognizedKindEvidence?: string[] }, imageRef: string | null): RecognizedPanel {
    // 体系优先取服务端「模型认为的 kind」：闸门拒了不代表没认出来。
    // 旧实现一律默认 character_panel，天缘 / 轩辕策图会被硬塞进「带入计算器」空卡。
    const kind: PanelKind = ((envelope?.recognizedKind || envelope?.panel?.panelKind) as PanelKind) || 'character_panel';
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
        kindEvidence: Array.isArray(envelope?.recognizedKindEvidence) ? envelope.recognizedKindEvidence : [],
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

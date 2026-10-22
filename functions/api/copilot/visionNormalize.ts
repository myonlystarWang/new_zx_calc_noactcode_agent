/**
 * 识图结果归一化 + 标准化闸门（服务端）
 *
 * 为什么需要：模型只在"标准面板图"上可靠。真图实测（2026-10-22，三张标准图 + 一张攻略表）暴露四类系统性偏差：
 *   1) character.factionRaw = "飞升"（图上写"175级 昭冥五重 飞升仙"）
 *   2) xyc.heroVersion = "英雄版"（应为 true）；advSkillName = "山雨欲来"（丢了罗马数字后缀 III）
 *   3) tianyuan.suffix = "+2 气血"（多空格）
 *   4) 攻略表格被 scout 误判 tianyuan，并编出 33 条 attrs（第一行"衣服天命+10"被当天缘标题）
 *
 * 归一化只做"同一事实的格式统一"，绝不补值、不推断缺失；判不准就留空。
 * 闸门只回答一个问题：这张图是不是标准面板截图？不是就明确降级，绝不渲染半真半假的卡。
 */

const BEASTS = ['青龙', '白虎', '朱雀', '玄武'];
const FACTION_WORDS: Array<[RegExp, string]> = [
    [/飞升\s*仙|仙族|佛?仙/, '仙'],
    [/飞升\s*魔|魔族/, '魔'],
    [/飞升\s*佛|佛族/, '佛']
];

interface NormalizeResult {
    panel: any;
    fixes: string[];
}

function fieldMap(panel: any): Record<string, any> {
    const o: Record<string, any> = {};
    for (const f of panel?.fields || []) if (f && f.key) o[f.key] = f;
    return o;
}

function allText(panel: any): string {
    const parts: string[] = [];
    if (Array.isArray(panel?.textLines)) for (const l of panel.textLines) parts.push(`${l?.label ?? ''}${l?.raw ?? ''}`);
    for (const f of panel?.fields || []) parts.push(`${f?.label ?? ''}${f?.raw ?? ''}${f?.value ?? ''}`);
    if (panel?.rawExplanation) parts.push(String(panel.rawExplanation));
    return parts.join(' | ');
}

/** 从标题里取阵营：优先"飞升X"，其次「昭冥·仙」这类写法 */
function detectFaction(panel: any): string | undefined {
    const text = allText(panel);
    const flown = text.match(/飞升\s*([仙魔佛])/);
    if (flown) return flown[1];
    // 「昭冥·仙」「昭冥 仙」「仙族」「仙角色」
    const named = text.match(/[\u4e00-\u9fa5]{2,5}[·\s]?([仙魔佛])(?:族|角色|阵营|版|$|[\s·|）)、，。])/);
    if (named) return named[1];
    for (const [re, val] of FACTION_WORDS) if (re.test(text)) return val;
    return undefined;
}

/** 罗马数字后缀：山雨欲来 III / 山雨欲来III / 山雨欲来 3 级 */
function restoreRomanSuffix(name: string, text: string): string {
    if (!name) return name;
    if (/[IVX]+$/.test(name)) return name;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hit = text.match(new RegExp(`${esc}\\s*([IVX]{1,4})(?![A-Za-z])`));
    return hit ? name + hit[1] : name;
}

function toBool(v: any): boolean | undefined {
    if (typeof v === 'boolean') return v;
    if (typeof v !== 'string') return undefined;
    if (/英雄/.test(v)) return true;
    if (/普通/.test(v)) return false;
    return undefined;
}

export function normalizePanel(input: any): NormalizeResult {
    const fixes: string[] = [];
    if (!input || typeof input !== 'object') return { panel: input, fixes };
    const panel = JSON.parse(JSON.stringify(input));
    const text = allText(panel);
    const f = fieldMap(panel);

    // --- 角色面板 ---
    if (panel.character && typeof panel.character === 'object') {
        const cls0 = String(panel.character.classRaw ?? '').trim();
        const cur = String(panel.character.factionRaw ?? '').trim();
        // 只有认出职业才猜阵营，避免把攻略表格里的"仙"当阵营
        if (cls0 && !['仙', '魔', '佛'].includes(cur)) {
            const fac = detectFaction(panel);
            if (fac) {
                panel.character.factionRaw = fac;
                fixes.push(`factionRaw "${cur}"→"${fac}"`);
            } else {
                // 图上只写了"飞升"、没有仙/魔/佛 可依据 → 留空让用户自己选，绝不猜
                panel.character.factionRaw = null;
                fixes.push(`factionRaw "${cur}" 无依据→置空（请用户选阵营）`);
            }
        }
        const cls = String(panel.character.classRaw ?? '').trim();
        if (cls && !/^[\u4e00-\u9fa5]{2,4}$/.test(cls)) {
            const m = cls.match(/([\u4e00-\u9fa5]{2,4}?)(?:五重|四重|三重|二重|一重|飞升|$)/);
            if (m && m[1] && m[1] !== cls) { panel.character.classRaw = m[1]; fixes.push(`classRaw "${cls}"→"${m[1]}"`); }
        }
        // 攻击区间：min 必须 <= max。实测出现「26918 读成 126918」这类数字误读，
        // 这种不能靠交换修（交换会变成 151478-126918，更错），只标低置信度让用户核对。
        const aMin = Number(f.attackMin?.value), aMax = Number(f.attackMax?.value);
        if (Number.isFinite(aMin) && Number.isFinite(aMax)) {
            if (aMin > aMax) {
                f.attackMin.value = aMax; f.attackMax.value = aMin;
                fixes.push(`attackMin/Max 交换（${aMin} > ${aMax}）`);
            } else if (aMin > aMax * 0.6 && f.attackMin?.status === 'ok') {
                f.attackMin.status = 'low_confidence';
                f.attackMin.reason = `下限 ${aMin} 与上限 ${aMax} 过近，疑似数字误读，请核对原图`;
                fixes.push(`attackMin 标低置信（${aMin} vs ${aMax}）`);
            }
        }
    }

    // --- 轩辕策 ---
    if (panel.panelKind === 'xyc' || f.beast || f.bookName) {
        const hv = toBool(f.heroVersion?.value) ?? toBool(panel.xyc?.heroVersion) ?? toBool(panel.xyc?.heroVersion === true ? true : '');
        if (hv !== undefined) {
            if (f.heroVersion) { f.heroVersion.value = hv; }
            if (panel.xyc) panel.xyc.heroVersion = hv;
            if (typeof (input.fields || []).find?.((x: any) => x.key === 'heroVersion')?.value === 'string') fixes.push('heroVersion 字符串→布尔');
        }
        if (f.beast) {
            const bv = String(f.beast.value ?? '');
            const hit = BEASTS.find(b => bv.includes(b));
            if (hit && hit !== bv) { f.beast.value = hit; fixes.push(`beast "${bv}"→"${hit}"`); }
        }
        if (f.advSkillName) {
            const name = String(f.advSkillName.value ?? '');
            const restored = restoreRomanSuffix(name, text + ' ' + String(f.advSkillName.raw ?? ''));
            if (restored !== name) { f.advSkillName.value = restored; fixes.push(`advSkillName "${name}"→"${restored}"`); }
        }
        // 洗炼次数只属于 washUsed；模型常把 14 塞进每条词条的 wash
        const washUsed = Number(f.washUsed?.value);
        if (Array.isArray(panel.attrs) && Number.isFinite(washUsed)) {
            let n = 0;
            for (const a of panel.attrs) {
                if (a && (a.wash === washUsed || a.wash === String(washUsed))) { a.wash = undefined; n++; }
                if (a && (a.extra === 0 || a.extra === '0')) a.extra = undefined;
            }
            if (n) fixes.push(`清掉 ${n} 条词条里误填的 wash=${washUsed}（那是洗炼次数）`);
        }
    }

    // --- 天缘 ---
    if (panel.panelKind === 'tianyuan' || f.tianyuanLevel) {
        for (const k of ['suffix', 'part', 'name']) {
            const cell = f[k];
            if (cell && typeof cell.value === 'string' && /\s/.test(cell.value)) {
                const trimmed = cell.value.replace(/\s+/g, '');
                fixes.push(`${k} "${cell.value}"→"${trimmed}"`);
                cell.value = trimmed;
            }
        }
        if (Array.isArray(panel.attrs)) {
            for (const a of panel.attrs) {
                if (a && (a.tianming === 0 || a.tianming === '0' || a.tianming === '')) a.tianming = null;
            }
        }
    }

    return { panel, fixes };
}

export interface Standardness {
    standard: boolean;
    code: 'ok' | 'KIND_UNKNOWN' | 'FIELDS_TOO_FEW' | 'SIGNATURE_MISSING' | 'ATTRS_IMPLAUSIBLE';
    detail: string;
}

/**
 * 标准化闸门：这张图是不是标准面板截图？
 * 依据 = 识别结果自身的结构证据（不依赖图片像素），三类各有硬签名。
 */
export function assessStandardness(panel: any): Standardness {
    const kind = panel?.panelKind;
    const f = fieldMap(panel);
    const ok = (k: string) => f[k] && (f[k].status === 'ok' || f[k].status === 'low_confidence') && f[k].value != null;

    if (!kind || kind === 'unknown' || kind === 'equip' || kind === 'fabao' || kind === 'skill' || kind === 'boss' || kind === 'combat_log') {
        return { standard: false, code: 'KIND_UNKNOWN', detail: `未识别为三类标准面板（kind=${kind || '空'}）` };
    }

    if (kind === 'character_panel') {
        const need = ['attackMin', 'attackMax', 'defense', 'health', 'mana', 'critDamage', 'critRate'];
        const hit = need.filter(ok).length;
        if (!ok('critDamage') && !ok('critRate')) {
            return { standard: false, code: 'SIGNATURE_MISSING', detail: '缺「致命伤害/致命一击」行，不像角色属性面板' };
        }
        if (hit < 5) return { standard: false, code: 'FIELDS_TOO_FEW', detail: `仅 ${hit}/7 项关键属性可读` };
        return { standard: true, code: 'ok', detail: `${hit}/7 项可读` };
    }

    if (kind === 'xyc') {
        const book = String(f.bookName?.value ?? '');
        const beast = String(f.beast?.value ?? '');
        if (!book || !BEASTS.some(b => beast.includes(b))) {
            return { standard: false, code: 'SIGNATURE_MISSING', detail: `缺书名或四系书型（书="${book}" 系="${beast}"）` };
        }
        return { standard: true, code: 'ok', detail: `${beast}<${book}>` };
    }

    if (kind === 'tianyuan') {
        const name = String(f.name?.value ?? '');
        const lv = Number(f.tianyuanLevel?.value);
        const attrs = Array.isArray(panel?.attrs) ? panel.attrs.length : 0;
        if (!/万辰须弥/.test(name)) {
            return { standard: false, code: 'SIGNATURE_MISSING', detail: `名称不是须弥系列（"${name}"）` };
        }
        if (!Number.isFinite(lv) || lv <= 0) {
            return { standard: false, code: 'SIGNATURE_MISSING', detail: '缺「天缘+N」' };
        }
        // 天缘一件装备最多 6 条天命；>8 必是把整张表格当词条读了
        if (attrs > 8) {
            return { standard: false, code: 'ATTRS_IMPLAUSIBLE', detail: `天命词条 ${attrs} 条，超出装备上限` };
        }
        return { standard: true, code: 'ok', detail: `天缘+${lv}，${attrs} 条天命` };
    }

    return { standard: false, code: 'KIND_UNKNOWN', detail: `未支持的体系 kind=${kind}` };
}

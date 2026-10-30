/**
 * 「距离满属性还差多少」——贴图校对卡的第二结论层。
 *
 * 铁律：
 *  · 满值一律按**图里声称的等级/天缘等级**折算，绝不按 1 级或满级硬算。
 *    轩辕策：满 = 词条池 max + step × 等级（`xyc_refine.json` 表 213/214/215 解包值）
 *    天  缘：满 = initMax + 天缘等级 × perLevelGain + Σ(前 N 档 extraCoeffs) × perLevelGain
 *            （与 `NewTianyuanDetailCard` 同一套官方天命数值表口径）
 *  · 当前值只取**主值**；括号里的洗炼增量（绿/红）只展示、不计入差距 —— 2026-10-30 用户拍板。
 *  · 算不出来就说算不出来（缺等级 / 缺部位 / 词条对不上池），不许拿近似值糊过去。
 */
import type { RecognizedPanel } from './types';

export interface CeilingRow {
    name: string;
    /** 图上的主值（不含括号） */
    current: number;
    /** 同等级理论上限 */
    ceiling: number;
    /** ceiling - current，恒 ≥ 0（超上限时为负，表示疑似识别错） */
    diff: number;
    /** current / ceiling，0~1（超上限截到 1） */
    pct: number;
    unit: 'point' | 'percent';
    /** 括号里的洗炼增量原文，只展示 */
    wash?: string;
    extra?: string;
    /** 天缘：这一行吃到的天命档（图上的「天命+N」，缺失按 0） */
    destiny?: number;
    /** 天缘：天命档贡献的绝对值（= 累计系数 × 每级增益） */
    destinyGain?: number;
    /** 天缘/轩辕策：满值是怎么算出来的，给 tooltip 用 */
    note?: string;
}

export interface CeilingReport {
    kind: 'xyc' | 'tianyuan';
    rows: CeilingRow[];
    /** 各条完成度的平均值（0~1），没有可比行时为 null */
    overall: number | null;
    /** 口径说明：「六品 · 英雄版 · 等级 20」 */
    basis: string;
    /** 算不准的地方，必须显示给用户 */
    warnings: string[];
}

const round = (n: number, d = 2): number => {
    const p = Math.pow(10, d);
    return Math.round(n * p) / p;
};

/** 从 `+13.5%` / `+526` / `+1,200` 里取数 */
export function numOf(v: unknown): number | null {
    const m = String(v ?? '').replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
    if (!m) return null;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : null;
}

const isPct = (v: unknown): boolean => String(v ?? '').includes('%');
const norm = (s: unknown): string => String(s ?? '').replace(/[\s·]/g, '');

function finish(kind: 'xyc' | 'tianyuan', rows: CeilingRow[], basis: string, warnings: string[]): CeilingReport {
    const scored = rows.filter(r => r.ceiling > 0 && Number.isFinite(r.pct));
    // 有词条反超上限 = 数据自相矛盾（等级/部位/品阶判错，或数值读错），此时不给完成度，
    // 否则会出现「100% 完成度 + 超上限」并列的荒唐结论
    const contradictory = rows.some(r => r.diff < 0);
    const overall = !contradictory && scored.length > 0
        ? scored.reduce((s, r) => s + r.pct, 0) / scored.length
        : null;
    return { kind, rows, overall, basis, warnings };
}

/* ────────────────────────── 轩辕策 ────────────────────────── */

/**
 * 轩辕策满属性对照。
 * 词条池按「版本(普通/典藏/英雄) × 四系 × 品阶」取，池里每条词条给 min/max/step：
 * 等级每 +1，该词条上下限各 +step（客户端显示值 = base + step × 等级）。
 */
export function buildXycCeiling(panel: RecognizedPanel, refine: any): CeilingReport | null {
    const attrs = panel.attrs || [];
    if (panel.kind !== 'xyc' || attrs.length === 0 || !refine?.pools) return null;

    const warnings: string[] = [];
    const beast = ['青龙', '白虎', '朱雀', '玄武'].find(b => norm(panel.xyc?.beast).includes(b));
    const version = panel.xyc?.heroVersion ? '英雄' : '普通';
    const gradeNames: string[] = refine?.meta?.gradeNames || ['一品', '二品', '三品', '四品', '五品', '六品'];
    const tierName = String(panel.xyc?.tier || '').match(/[一二三四五六]品/)?.[0] || '六品';
    const gradeKey = String(gradeNames.indexOf(tierName) + 1 || 6);
    const level = typeof panel.xyc?.level === 'number' ? panel.xyc.level : null;

    const poolBook = refine.pools[version]?.[beast || ''] || refine.pools['英雄']?.[beast || ''];
    const pool = poolBook?.[gradeKey] || poolBook?.['6'] || null;

    if (!pool) {
        return finish('xyc', [], `${tierName} · ${version}版`, [
            `没找到「${beast || '未知系'} · ${tierName} · ${version}版」的洗炼词条池，算不出满值。`
        ]);
    }
    // 等级是满值的唯一折算基准：读不到就**不出数**（按 0 级硬算会给出「已满」的假结论）
    if (level === null) {
        return finish('xyc', [], `${tierName} · ${version}版 · 等级未读出`, [
            '没读到「等级 N」，算不了差距 —— 词条上限按等级逐级上涨。用卡片上的「等级 ±」补一个，或截含「等级」与全部词条的完整 tooltip。'
        ]);
    }

    // 池里同一属性可能有多档（主档 / 稀有档，上下限与概率都不同）。
    // 取「当前值所在的那一档」的上限：拿主档的去比稀有档上限，会凭空多出 20 个点的「差距」。
    const defPct = (id: number): boolean => Boolean(refine?.attrs?.[String(id)]?.pct);
    const pickTier = <T,>(cands: T[], rangeOf: (c: T) => [number, number, number], current: number): T | null => {
        if (cands.length === 0) return null;
        const inside = cands.filter(c => { const [lo, hi] = rangeOf(c); return current >= lo - 1e-9 && current <= hi + 1e-9; });
        if (inside.length > 0) return inside.sort((a, b) => rangeOf(a)[2] - rangeOf(b)[2])[0];
        const above = cands.filter(c => rangeOf(c)[2] >= current).sort((a, b) => rangeOf(a)[2] - rangeOf(b)[2]);
        if (above.length > 0) return above[0];
        return cands.slice().sort((a, b) => rangeOf(b)[2] - rangeOf(a)[2])[0];
    };
    const lv = level ?? 0;

    const rows: CeilingRow[] = [];
    for (const a of attrs) {
        const current = numOf(a.value);
        if (current === null) continue;
        const wantPct = isPct(a.value);
        const name = norm(a.name);
        const ids = (pool.attrs as any[])
            .map(x => x.id)
            .filter(id => {
                const nm = norm(refine?.attrs?.[String(id)]?.name);
                if (!nm) return false;
                // 「攻击」与「固定攻击」必须靠 % 区分，不能只靠名字包含关系
                const nameOk = nm === name || nm.includes(name) || name.includes(nm);
                return nameOk && defPct(id) === wantPct;
            });
        if (ids.length === 0) {
            warnings.push(`「${a.name}」不在${beast || ''}${tierName}词条池里，跳过。`);
            continue;
        }
        const tier = pickTier(ids, (id: number) => {
            const def = pool.attrs.find((x: any) => x.id === id)!;
            const k = defPct(id) ? 100 : 1;
            const lo = round((def.min + def.step * lv) * k, 2);
            const hi = round((def.max + def.step * lv) * k, 2);
            return [lo, hi, hi];
        }, current);
        if (tier === null) continue;
        const def = pool.attrs.find((x: any) => x.id === tier)!;
        const k = defPct(tier) ? 100 : 1;
        const ceiling = round((def.max + def.step * lv) * k, 2);
        if (!Number.isFinite(ceiling) || ceiling <= 0) continue;
        const diff = round(ceiling - current, 2);
        rows.push({
            name: a.name,
            current,
            ceiling,
            diff,
            pct: Math.max(0, Math.min(1, current / ceiling)),
            unit: wantPct ? 'percent' : 'point',
            wash: a.wash,
            extra: a.extra
        });
    }
    if (rows.some(r => r.diff < 0)) warnings.push('有词条反超上限，多半是数值识别错或品阶判错，请核对原图。');
    return finish('xyc', rows, `${tierName} · ${version}版 · 等级 ${level}`, warnings);
}

/* ────────────────────────── 天缘 ────────────────────────── */

const clampInt = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * 天缘等级 → 「属性池全貌」用的满档天命数（官方表 +3/+6/+9/+10 阶梯）。
 * 注意：这是 `NewTianyuanDetailCard` 展示「全部属性能洗到多高」的口径。
 * **单件装备的对照不用它** —— 每条词条吃多少天命由该行自己的「天命+N」决定，
 * 同一件装备上可以同时存在 天命+5 和 天命（+0）两条。
 */
export function tianyuanExtraLevels(level: number): number {
    if (level >= 10) return 10;
    if (level >= 9) return 9;
    if (level >= 6) return 6;
    if (level >= 3) return 3;
    return 0;
}

/** 天命档累计系数：cum[0]=0，cum[n] = 前 n 档 extraCoeffs 之和（官方 destinyCumulative = [1,3,7,11,17,23,29,35,41,47]） */
export function destinyCumulativeOf(data: any, group: any): number[] {
    const coeffs: number[] = Array.isArray(group?.extraCoeffs) && group.extraCoeffs.length > 0
        ? group.extraCoeffs
        : (Array.isArray(data?.destinyCoeffs) ? data.destinyCoeffs : []);
    const cum: number[] = [0];
    for (const c of coeffs) cum.push((cum[cum.length - 1] ?? 0) + (Number(c) || 0));
    return cum;
}

/**
 * 天缘满属性对照。
 * 每条词条：满 = initMax + 天缘等级×每级增益 + 天命累计系数×每级增益
 *   ① initMax：该属性在该档「洗出来的基础值」的天花板
 *   ② 天缘等级×每级增益：天缘每 +1 级，全件词条基础值一起涨
 *   ③ 天命累计系数×每级增益：这一行的「天命+N」吃到的额外档（每级天命加多少 = perLevelGain）
 *   官方同源公式见 `newTianyuanSim.attrDisplayValue`：
 *     (base + level×perLevel + perLevel×cumulative[N-1]) × scale，把 base 取满值 initMax 即为上限。
 *
 * 「图上没有天缘+N」= **天缘 +0**，照常出数（2026-10-30 用户口径），把口径写进 basis 并提示；
 * 只有当算出来有词条反超 +0 上限时，才提示「这张图其实是带等级的，补一个天缘+N」。
 */
export function buildTianyuanCeiling(panel: RecognizedPanel, data: any): CeilingReport | null {
    const attrs = panel.attrs || [];
    if (panel.kind !== 'tianyuan' || attrs.length === 0 || !Array.isArray(data?.attributeGroups)) return null;

    const warnings: string[] = [];
    const label = String(panel.tianyuan?.part || panel.tianyuan?.name || '');
    const part = ['甲', '刃', '盔'].find(p => label.includes(p)) || null;
    const group = part
        ? data.attributeGroups.find((g: any) => String(g.name).endsWith(part))
        : data.attributeGroups.find((g: any) => label.includes(String(g.name).replace('上玄佑万辰须弥', '')));
    if (!group) {
        return finish('tianyuan', [], '部位未识别', [`没认出部位（名称「${label || '空'}」），算不出满值。点卡片上的 甲 / 刃 / 盔 选一个即可。`]);
    }

    const hasLevel = typeof panel.tianyuan?.tianyuanLevel === 'number';
    const level = hasLevel ? clampInt(panel.tianyuan!.tianyuanLevel as number, 0, 10) : 0;
    if (!hasLevel) {
        // 有「天命+N」就说明这件洗到过 +3 以上（天命只在 +3/+6/+9/+10 触发），
        // 此时把等级当 +0 会低估上限、高估差距 —— 必须提醒补等级，而不是静默给个偏低的完成度。
        const anyDestiny = attrs.some(a => typeof a.tianming === 'number' && a.tianming > 0);
        warnings.push(anyDestiny
            ? '图上没有「天缘+N」，先按「天缘 +0」折算；但这件已经有「天命+N」词条，说明它洗到过 +3 以上，真实等级请在「天缘 ±」补一下（差距才准）。'
            : '图上没有「天缘+N」，按「天缘 +0」折算 —— 天缘每升 1 级，下面每条上限再涨一列「每级增益」。等级读错了就在上面的「天缘 ±」改一下。');
    }

    const cum = destinyCumulativeOf(data, group);
    const pool: any[] = Array.isArray(group.attributes) ? group.attributes : [];
    const partName = String(group.name).replace('上玄佑万辰须弥', '');
    const maxDestiny = cum.length - 1;

    const rows: CeilingRow[] = [];
    let missingDestiny = 0;
    for (const a of attrs) {
        const current = numOf(a.value);
        if (current === null) continue;
        const wantPct = isPct(a.value) || /%$/.test(String(a.value).trim());
        const name = norm(a.name);
        const cands = pool.filter(d => {
            const dn = norm(d.name);
            const nameOk = dn === name || dn.includes(name) || name.includes(dn);
            const unitPct = String(d.unit || '').includes('%');
            return nameOk && unitPct === wantPct;
        });
        if (cands.length === 0) {
            warnings.push(`「${a.name}」不在${partName}的属性表里，跳过。`);
            continue;
        }

        const hasDestiny = typeof a.tianming === 'number' && Number.isFinite(a.tianming);
        if (!hasDestiny) missingDestiny += 1;
        const n = hasDestiny ? clampInt(a.tianming as number, 0, maxDestiny) : 0;
        const extraCoeff = cum[n] ?? 0;

        // 同名两档（主档高权重低数值 / 稀有档低权重新数值）：
        // 把当前值扣掉「等级段 + 天命段」还原成 base，看它落在哪一档的 initMin~initMax 里，
        // 取那一档的上限 —— 拿主档上限比稀有档的值会凭空多出十几个点的「差距」。
        // 都不落区间时（多半是玩家手动改了天命档）取「base 离区间最近」的那档：
        // 取 hi 最大的那档会永远偏向稀有档，差距直接被放大一倍。
        const spanOf = (d: any) => {
            const gain = Number(d.perLevelGain) || 0;
            const initMax = Number(d.initMax);
            const initMin = Number(d.initMin);
            const base = current - level * gain - extraCoeff * gain;
            // 容差：游戏显示值是四舍五入的，base 微超 initMax 属于同一档，不该判成"稀有档"或"反超上限"
            const tol = Math.max(0.1, Math.abs(initMax) * 0.01);
            return {
                gain,
                initMin,
                initMax,
                base,
                tol,
                hi: round(initMax + level * gain + extraCoeff * gain, 2),
                fits: base >= initMin - tol && base <= initMax + tol,
                dist: base < initMin ? initMin - base : (base > initMax ? base - initMax : 0)
            };
        };
        const inside = cands.filter(d => spanOf(d).fits);
        const narrowed = inside.length > 0
            ? inside.sort((x, y) => spanOf(x).hi - spanOf(y).hi)
            : cands.slice().sort((x, y) => spanOf(x).dist - spanOf(y).dist || spanOf(x).hi - spanOf(y).hi);
        const best = narrowed[0];
        const span = spanOf(best);
        const c = span.hi;
        if (!Number.isFinite(c) || c <= 0) continue;

        const destinyGain = round(extraCoeff * span.gain, 2);
        // 游戏显示值是四舍五入的：7.2% 算出来满值 7.1% 属于「已满」，不该报反超上限。
        // 只有超出容差之外才当真的数据矛盾（识别错 / 档位判错）。
        const rawDiff = round(c - current, 2);
        const capTol = Math.max(0.1, Math.abs(span.initMax) * 0.01);
        const diff = rawDiff < 0 && Math.abs(rawDiff) <= capTol ? 0 : rawDiff;
        rows.push({
            name: a.name,
            current,
            ceiling: c,
            diff,
            pct: diff <= 0 ? 1 : Math.max(0, Math.min(1, current / c)),
            unit: wantPct ? 'percent' : 'point',
            wash: a.wash,
            extra: a.extra,
            destiny: n,
            destinyGain,
            note: [
                `满 = 基础上限 ${fmtCeilingValue(span.initMax, wantPct ? 'percent' : 'point')}`,
                `+ 天缘 ${level} 级 × ${fmtCeilingValue(span.gain, wantPct ? 'percent' : 'point')}/级`,
                n > 0
                    ? `+ 天命+${n}（多 ${extraCoeff} 份每级增益）× ${fmtCeilingValue(span.gain, wantPct ? 'percent' : 'point')} = ${fmtCeilingValue(destinyGain, wantPct ? 'percent' : 'point')}`
                    : '+ 天命 +0（这行没吃额外档）'
            ].join(' ')
        });
    }

    if (missingDestiny > 0 && missingDestiny < attrs.length) {
        warnings.push(`有 ${missingDestiny} 行没读到「天命+N」，按 +0 档算；点行首的「天命」可以直接补。`);
    }
    if (rows.some(r => r.diff < 0)) {
        warnings.push(hasLevel
            ? '有词条反超上限 —— 多半是数值识别错或部位/天命档判错，请核对原图。'
            : '有词条反超「天缘 +0」的上限 —— 这张图其实是带等级的，请在上面的「天缘 ±」补上真实等级。');
    }
    const levelText = hasLevel ? `天缘 +${level}` : '天缘 +0（图上没有等级行）';
    return finish('tianyuan', rows, `${partName} · ${levelText}`, warnings);
}

/* ────────────────────────── 展示 ────────────────────────── */

export function fmtCeilingValue(v: number, unit: 'point' | 'percent'): string {
    if (unit === 'percent') return `${round(v, 2)}%`;
    return Number.isInteger(round(v, 2)) ? String(Math.round(v)) : String(round(v, 2));
}

/** 最短的那块板（完成度最低且有差距的一条），用于一句话结论；全满返回 null */
export function worstRow(report: CeilingReport | null): CeilingRow | null {
    if (!report) return null;
    const lacking = report.rows.filter(r => r.diff > 0.001);
    if (lacking.length === 0) return null;
    return [...lacking].sort((a, b) => a.pct - b.pct)[0] || null;
}

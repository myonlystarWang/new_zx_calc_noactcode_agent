/**
 * 统一的数字显示格式：
 * - 上亿 → 保留「亿」（去小数尾零）
 * - 上万 → 保留「万」（去小数尾零）
 * - 小数字 → 纯整数，无千分位逗号
 * withUnit=false 时仅返回数值字符串（不带「万/亿」单位），用于表格紧凑列。
 */
export function formatNumber(value: number, withUnit: boolean = true): string {
    if (value === null || value === undefined || !isFinite(value)) return '-';

    const abs = Math.abs(value);
    const trim = (v: number) => parseFloat(v.toFixed(2)).toString();

    if (abs >= 1e8) {
        const v = value / 1e8;
        return withUnit ? `${trim(v)} 亿` : trim(v);
    }
    if (abs >= 1e4) {
        const v = value / 1e4;
        return withUnit ? `${trim(v)} 万` : trim(v);
    }
    return String(Math.round(value));
}

/**
 * 属性单位归一（2026-10-26）
 *
 * 「技能命中 / 技能躲闪」在游戏里是**点数**（几十到几百点），不是百分比。
 * 但多个客户端数据源（轩辕策表 213/214、四灵本元、凝灵契、新天缘）把它们与百分比属性
 * 放在同一张表里，前端只要跟着 `pct/isPercent/unit` 走，就会渲染成「技能命中 +11.0%」。
 * 这里统一兜底：这两个属性一律按点值取整展示，不带百分号。
 */

const POINT_ATTR_KEYWORDS = ['技能命中', '技能躲闪'] as const;

/** 是否为「点数类」属性（展示时不带 %） */
export function isPointAttr(name?: string | null): boolean {
    if (!name) return false;
    return POINT_ATTR_KEYWORDS.some((k) => name.includes(k));
}

/** 点数类属性统一取整展示：11.0 → "11"、10.5 → "11" */
export function formatPointAttrValue(value: number): string {
    if (!Number.isFinite(value)) return '0';
    return String(Math.round(value));
}

/**
 * gameColorSystem.ts
 * 诛仙3 / 寻宝天行（xunbao178.com）官方道具标准配色与渲染常量系统
 * 沉淀自寻宝天行实机 XML 道具流与游戏客户端原生 Tooltip 规范
 */

export const GAME_COLORS = {
    // 基础纯白与通用字色
    WHITE: '#ffffff',
    TEXT_MUTED: '#8892b0',
    TEXT_LOCKED: '#556070',

    // 核心装备属性蓝（用于基础攻击、固定攻击、已激活附加属性、防御等）
    STAT_BLUE: '#8080ff',

    // 经典游戏标识色
    PURE_RED: '#ff0000',      // 限制门派、极·神机、+15 蕴灵
    PALE_PURPLE_WHITE: '#d1e4f7', // +0 ~ +10 蕴灵淡白紫
    BRIGHT_GREEN: '#00ff00',  // +11 蕴灵翠绿
    MINT_GREEN: '#11ff11',    // 附加属性激活绿 / 技能特效
    SKY_BLUE: '#3aa6f9',      // +12 蕴灵湛蓝
    BRIGHT_YELLOW: '#f8f64b', // +13 蕴灵灿黄
    VIOLET_PURPLE: '#aa32ff', // +14 蕴灵幽紫
    SHENYIN_CYAN: '#80ffff',  // 神隐青
    OWNER_ORANGE: '#ff6000',  // 装备主人、血祭橙
    HUN_GREEN: '#6cfb4b',     // 魂值亮绿
    TIANYUAN_LIME: '#c5ff54', // 天缘浅黄绿
    GOLD_AMBER: '#ffdc50',    // 神机黄金/琥珀
} as const;

/**
 * 诛仙3 经典炼器等级色（+0 白 ~ +10，17173 十六进制原值）。
 * **唯一真相**：新天缘模拟器（`NewTianyuanSimCard`）与识图卡（`VisionReviewCard`）都用它，
 * 天缘等级「天缘+N」和每条词条的天命档「天命+N」共用同一套色阶 —— 玩家在模拟器里认过的颜色，
 * 贴图校对卡里必须一模一样，否则会以为识别错了。
 */
export const REFINE_LEVEL_COLORS = [
    '#ffffff', // +0
    '#f2d3ff', // +1
    '#bcffd2', // +2
    '#fff38e', // +3
    '#ffc0db', // +4
    '#ff00ff', // +5
    '#95aeff', // +6
    '#426aff', // +7
    '#6dffff', // +8
    '#45ff45', // +9
    '#c5ff54'  // +10
] as const;

/** 等级 → 炼器色（越界夹到 0~10，缺省按 +0 白） */
export function getRefineLevelColor(level: number | null | undefined): string {
    const n = Number.isFinite(Number(level)) ? Math.round(Number(level)) : 0;
    return REFINE_LEVEL_COLORS[Math.max(0, Math.min(10, n))];
}

/**
 * 蕴灵等级对应色彩映射（修武、昭武、彰武、混虚系列完全一致）
 * +0 ~ +10: 淡白紫 (#d1e4f7)
 * +11: 碧绿 (#00ff00)
 * +12: 湛蓝 (#3aa6f9)
 * +13: 灿黄 (#f8f64b)
 * +14: 幽紫 (#aa32ff)
 * +15: 炽红 (#ff0000)
 */
export function getYunlingColor(level: number): string {
    if (level >= 15) return GAME_COLORS.PURE_RED;
    if (level === 14) return GAME_COLORS.VIOLET_PURPLE;
    if (level === 13) return GAME_COLORS.BRIGHT_YELLOW;
    if (level === 12) return GAME_COLORS.SKY_BLUE;
    if (level === 11) return GAME_COLORS.BRIGHT_GREEN;
    return GAME_COLORS.PALE_PURPLE_WHITE;
}

/**
 * 神机属性分阶颜色映射
 */
export function getShenjiTierColor(tier: number): string {
    if (tier >= 15) return GAME_COLORS.PURE_RED;
    if (tier >= 13) return GAME_COLORS.BRIGHT_YELLOW;
    if (tier >= 11) return GAME_COLORS.MINT_GREEN;
    return GAME_COLORS.WHITE;
}

export function getEquipQualityColor(q?: string, name?: string): string {
    if (!q) {
        if (name && name.includes('至尊')) return '#ffd700';
        return GAME_COLORS.OWNER_ORANGE;
    }
    switch (q) {
        case '神隐': return GAME_COLORS.SHENYIN_CYAN;
        case '彰武': return '#ff4d4f';
        case '昭武': return '#b37feb';
        case '修武': return '#36cfc9';
        case '至尊': return '#ffd700';
        case '神级': return GAME_COLORS.OWNER_ORANGE;
        case '天命': return '#ba68c8';
        default: return GAME_COLORS.OWNER_ORANGE;
    }
}

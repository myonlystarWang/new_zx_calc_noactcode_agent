/**
 * 伤害长图绘制器（2026-10-27 品牌版式）
 *
 * 页头 / 页脚 / 背景 / 玻璃卡 / 分区标题全部来自 `sharePosterKit`，
 * 与蕴灵 / 轩辕策 / 天缘三张模拟器长图共用同一套骨架，这里只写「中间的数据区」。
 *
 * 用 Canvas 2D 自绘而不是截 DOM：
 * - 站内卡片的技能表在 `max-h-[550px] overflow-y-auto` 内，DOM 截图会被裁半；
 * - 卡片上有 `blur-[60px] mix-blend-screen` 装饰圆与 `backdrop-filter`，html2canvas 系不支持。
 */
import type { CharacterAttributes } from '../../types';
import { formatNumber } from '../../utils/format';
import {
    BG_DEEP,
    CHIP_GAP,
    CHIP_H,
    CYAN,
    GOLD_BRIGHT,
    GOLD_MAIN,
    POSTER_INNER,
    POSTER_PAD,
    POSTER_W,
    chip,
    fitText,
    font,
    glassPanel,
    goldFill,
    posterBackground,
    posterFooter,
    posterFrame,
    posterHeader,
    preloadQrImage,
    preloadShareLogo,
    sectionHead,
    splitMagnitude,
    text,
    withAlpha,
    type PosterCtx,
} from './sharePosterKit';

export { preloadQrImage, preloadShareLogo };

export interface ShareHitRow {
    hitIndex: number;
    min: number;
    max: number;
    avg: number;
}

export interface ShareSkillRow {
    name: string;
    avg: number;
    min: number;
    max: number;
    hitCount: number;
    isMultiHit: boolean;
    hits: ShareHitRow[];
}

export interface ShareBuffChip {
    name: string;
    value: number;
}

export interface ShareCardData {
    siteName: string;
    dateText: string;
    className: string;
    factionLabel: string;
    attributes: CharacterAttributes;
    buffs: ShareBuffChip[];
    dungeonName: string;
    bossName: string;
    skills: ShareSkillRow[];
    qrDataUrl?: string | null;
    /** 图底免责/署名文案（多行用 \n 分隔） */
    watermark?: string;
    /** 右上角主数字：参考战力 */
    totalPower?: number;
    /** 品牌网址，默认 zxai.raddishlab.com */
    siteUrl?: string;
    /** 页头 kicker，默认「诛仙 3 · 伤害模拟」 */
    kicker?: string;
}

export interface ShareCardTheme {
    base: string;
    panel: string;
    text: string;
    primary: string;
    accent: string;
}

const ATTR_COLS = 4;
const ATTR_GAP = 14;
const ATTR_CELL_W = (POSTER_INNER - ATTR_GAP * (ATTR_COLS - 1)) / ATTR_COLS;
const ATTR_CELL_H = 96;
const SKILL_ROW_H = 92;
const SKILL_GAP = 20;
const HIT_ROW_H = 46;
const MAX_PIXELS = 8_000_000;

export function readShareTheme(): ShareCardTheme {
    const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const get = (name: string, fallback: string) => {
        const v = cs?.getPropertyValue(name)?.trim();
        return v || fallback;
    };
    return {
        base: BG_DEEP,
        panel: get('--theme-panel-bg', 'rgba(18,16,14,0.92)'),
        text: get('--theme-text', '#e8eee9'),
        primary: get('--theme-primary', '#5c8a75'),
        accent: get('--theme-accent', '#5897a8'),
    };
}

const ATTR_ROWS: Array<[keyof CharacterAttributes, string, boolean]> = [
    ['CharacterMinAttack', '最小攻击', false],
    ['CharacterMaxAttack', '最大攻击', false],
    ['CharacterHealth', '气血', false],
    ['CharacterMana', '真气', false],
    ['CharacterDefense', '防御', false],
    ['CharacterCriticalHitDamagePercent', '暴击伤害', true],
    ['CharacterMonsterDamageIncreasePercent', '对怪增伤', true],
];

/**
 * 多段技能只保留「有信息量」的段：
 * · 各段相同        → 一行，标签写成「第 1~9 段」（不额外加说明行）
 * · 递增 / 各段不同 → 只列首段与末段
 * 段数本身由技能名旁的「共 N 段」徽标兜住，图上不再写省略说明。
 */
function condenseHits(hits: ShareHitRow[]): Array<{ label: string; min: number; max: number; avg: number; isLast: boolean }> {
    const n = hits.length;
    const line = (h: ShareHitRow, label: string, isLast: boolean) => ({
        label,
        min: h.min,
        max: h.max,
        avg: h.avg,
        isLast,
    });
    if (n === 0) return [];
    if (n === 1) return [line(hits[0], `第 ${hits[0].hitIndex} 段`, true)];

    const same = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b), 1) * 1e-6;
    const first = hits[0];
    const last = hits[n - 1];

    if (hits.every((h) => same(h.avg, first.avg))) {
        return [line(first, `第 1~${n} 段`, true)];
    }
    return [line(first, `第 ${first.hitIndex} 段 (首段)`, false), line(last, `第 ${last.hitIndex} 段 (末段)`, true)];
}

/** 单趟布局；`paint=false` 时只量算高度。返回内容总高度（含上下 padding）。 */
function layout(c: PosterCtx, data: ShareCardData, theme: ShareCardTheme): number {
    const { ctx } = c;
    const dim = withAlpha(theme.text, 0.40);

    // ① 页头（LOGO + 品牌 + 日期/网址 + 金线）
    let y = posterHeader(
        c,
        {
            siteName: data.siteName,
            kicker: data.kicker || '诛仙 3 · 伤害模拟',
            dateText: data.dateText,
            url: data.siteUrl,
        },
        64,
    );

    // ② 主结果卡：副本/BOSS ＋ 参考战力
    const HERO_H = 210;
    glassPanel(c, POSTER_PAD, y, POSTER_INNER, HERO_H);
    const heroPadX = 32;

    let cx = POSTER_PAD + heroPadX;
    cx += chip(c, data.className, cx, y + 30, {
        bg: withAlpha(theme.primary, 0.22),
        fg: '#eaf2ff',
        border: withAlpha(theme.primary, 0.75),
        size: 22,
    }) + 14;
    chip(c, data.factionLabel, cx, y + 30, {
        bg: withAlpha(GOLD_MAIN, 0.12),
        fg: GOLD_MAIN,
        border: withAlpha(GOLD_MAIN, 0.55),
        size: 22,
    });

    const power = data.totalPower && Number.isFinite(data.totalPower) ? splitMagnitude(data.totalPower) : null;
    text(c, '参考战力', POSTER_W - POSTER_PAD - heroPadX, y + 44, font(17, 700), withAlpha(GOLD_MAIN, 0.75), 'right', 2);
    if (power) {
        text(
            c,
            power.amount,
            POSTER_W - POSTER_PAD - heroPadX - (power.unit ? 40 : 0),
            y + 116,
            font(58, 900),
            goldFill(ctx, y + 62, 60),
            'right',
        );
        if (power.unit) {
            text(c, power.unit, POSTER_W - POSTER_PAD - heroPadX, y + 114, font(26, 700), withAlpha(GOLD_MAIN, 0.9), 'right');
        }
    }

    const nameMaxW = POSTER_INNER - heroPadX * 2 - (power ? 300 : 0);
    text(
        c,
        fitText(ctx, data.dungeonName, font(30, 700), Math.max(200, nameMaxW)),
        POSTER_PAD + heroPadX,
        y + 154,
        font(30, 700),
        '#ffffff',
    );
    text(c, `当前 BOSS · ${data.bossName}`, POSTER_PAD + heroPadX, y + 188, font(19, 400), dim);
    y += HERO_H + 40;

    // ③ 角色属性
    y = sectionHead(c, '01', '角色属性', `${ATTR_ROWS.length} 项核心`, y, theme.text);
    ATTR_ROWS.forEach(([key, label, isPercent], i) => {
        const col = i % ATTR_COLS;
        const row = Math.floor(i / ATTR_COLS);
        const cellX = POSTER_PAD + col * (ATTR_CELL_W + ATTR_GAP);
        const cellY = y + row * (ATTR_CELL_H + ATTR_GAP);
        glassPanel(c, cellX, cellY, ATTR_CELL_W, ATTR_CELL_H, { radius: 12, gold: false });
        const raw = data.attributes?.[key];
        const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
        text(c, label, cellX + 16, cellY + 32, font(15, 500), dim);
        // 带单位：攻击/气血这类大数字在 231px 格子里靠「万/亿」才读得懂
        text(
            c,
            isPercent ? `${Math.round(value)}%` : formatNumber(value),
            cellX + 16,
            cellY + 74,
            font(28, 700),
            '#f2f5fa',
        );
    });
    y += Math.ceil(ATTR_ROWS.length / ATTR_COLS) * (ATTR_CELL_H + ATTR_GAP) + 24;

    // ④ 战斗增益
    y = sectionHead(c, '02', '战斗增益', data.buffs.length ? `${data.buffs.length} 项生效` : '未启用', y, theme.text);
    if (data.buffs.length === 0) {
        chip(c, '无增益', POSTER_PAD, y, { bg: withAlpha(theme.text, 0.05), fg: dim, border: withAlpha(theme.text, 0.14) });
        y += CHIP_H + 32;
    } else {
        let rx = POSTER_PAD;
        let rows = 1;
        data.buffs.forEach((buff) => {
            const label = buff.value ? `${buff.name} +${buff.value}` : buff.name;
            ctx.font = font(24);
            const w = Math.ceil(ctx.measureText(label).width) + 40;
            if (rx + w > POSTER_W - POSTER_PAD && rx > POSTER_PAD) {
                rx = POSTER_PAD;
                rows += 1;
            }
            chip(c, label, rx, y + (rows - 1) * (CHIP_H + CHIP_GAP), {
                bg: withAlpha(CYAN, 0.10),
                fg: '#e6fffb',
                border: withAlpha(CYAN, 0.30),
                size: 24,
            });
            rx += w + CHIP_GAP;
        });
        y += rows * CHIP_H + (rows - 1) * CHIP_GAP + 32;
    }

    // ⑤ 技能伤害明细（主体）
    y = sectionHead(c, '03', '技能伤害明细', `${data.skills.length} 个技能`, y, theme.text);
    const maxAvg = data.skills.reduce((m, s) => Math.max(m, s.avg), 0);
    data.skills.forEach((skill) => {
        const nameY = y + 30;
        const nameF = font(26, 700);
        text(c, skill.name, POSTER_PAD, nameY, nameF, '#f2f5fa');
        ctx.font = nameF;
        let nameEnd = POSTER_PAD + ctx.measureText(skill.name).width;
        if (skill.isMultiHit) {
            const badge = `共 ${skill.hitCount} 段`;
            ctx.font = font(18, 700);
            const bw = Math.ceil(ctx.measureText(badge).width) + 22;
            if (c.paint) {
                const bx = nameEnd + 14;
                const by = nameY - 20;
                ctx.beginPath();
                ctx.moveTo(bx + 8, by);
                ctx.lineTo(bx + bw - 8, by);
                ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 8);
                ctx.lineTo(bx + bw, by + 28 - 8);
                ctx.quadraticCurveTo(bx + bw, by + 28, bx + bw - 8, by + 28);
                ctx.lineTo(bx + 8, by + 28);
                ctx.quadraticCurveTo(bx, by + 28, bx, by + 28 - 8);
                ctx.lineTo(bx, by + 8);
                ctx.quadraticCurveTo(bx, by, bx + 8, by);
                ctx.closePath();
                ctx.fillStyle = 'rgba(229,190,115,0.12)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(229,190,115,0.45)';
                ctx.stroke();
            }
            text(c, badge, nameEnd + 14 + bw / 2, nameY - 1, font(18, 700), GOLD_MAIN, 'center');
            nameEnd += 14 + bw;
        }

        text(c, `平均 ${formatNumber(skill.avg)}`, POSTER_W - POSTER_PAD, nameY, font(28, 900), goldFill(ctx, nameY - 26, 30), 'right');

        const barY = y + 50;
        if (c.paint) {
            ctx.beginPath();
            ctx.moveTo(POSTER_PAD + 6, barY);
            ctx.lineTo(POSTER_PAD + POSTER_INNER - 6, barY);
            ctx.quadraticCurveTo(POSTER_PAD + POSTER_INNER, barY, POSTER_PAD + POSTER_INNER, barY + 6);
            ctx.lineTo(POSTER_PAD + POSTER_INNER, barY + 6);
            ctx.quadraticCurveTo(POSTER_PAD + POSTER_INNER, barY + 12, POSTER_PAD + POSTER_INNER - 6, barY + 12);
            ctx.lineTo(POSTER_PAD + 6, barY + 12);
            ctx.quadraticCurveTo(POSTER_PAD, barY + 12, POSTER_PAD, barY + 6);
            ctx.lineTo(POSTER_PAD, barY + 6);
            ctx.quadraticCurveTo(POSTER_PAD, barY, POSTER_PAD + 6, barY);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.fill();

            const ratio = maxAvg > 0 ? Math.max(0, Math.min(1, skill.avg / maxAvg)) : 0;
            if (ratio > 0) {
                const bw = Math.max(8, POSTER_INNER * ratio);
                ctx.beginPath();
                ctx.moveTo(POSTER_PAD + 6, barY);
                ctx.lineTo(POSTER_PAD + bw - 6, barY);
                ctx.quadraticCurveTo(POSTER_PAD + bw, barY, POSTER_PAD + bw, barY + 6);
                ctx.lineTo(POSTER_PAD + bw, barY + 6);
                ctx.quadraticCurveTo(POSTER_PAD + bw, barY + 12, POSTER_PAD + bw - 6, barY + 12);
                ctx.lineTo(POSTER_PAD + 6, barY + 12);
                ctx.quadraticCurveTo(POSTER_PAD, barY + 12, POSTER_PAD, barY + 6);
                ctx.lineTo(POSTER_PAD, barY + 6);
                ctx.quadraticCurveTo(POSTER_PAD, barY, POSTER_PAD + 6, barY);
                ctx.closePath();
                const g = ctx.createLinearGradient(POSTER_PAD, 0, POSTER_PAD + bw, 0);
                g.addColorStop(0, withAlpha(theme.primary, 0.95));
                g.addColorStop(1, withAlpha(GOLD_MAIN, 0.85));
                ctx.fillStyle = g;
                ctx.fill();
            }
        }
        y += SKILL_ROW_H;

        // 多段：各段相同→一行「第 1~N 段」；否则→首末两行
        if (skill.isMultiHit && skill.hits.length > 0) {
            condenseHits(skill.hits).forEach((hit) => {
                const hitY = y + 26;
                text(c, hit.label, POSTER_PAD + 24, hitY, font(21, 700), withAlpha(GOLD_MAIN, 0.82));
                text(c, `${formatNumber(hit.min)} ~ ${formatNumber(hit.max)}`, POSTER_PAD + 200, hitY, font(21, 400), withAlpha(theme.text, 0.30));
                text(
                    c,
                    formatNumber(hit.avg),
                    POSTER_W - POSTER_PAD,
                    hitY,
                    font(21, hit.isLast ? 700 : 500),
                    hit.isLast ? GOLD_BRIGHT : withAlpha(theme.text, 0.70),
                    'right',
                );
                y += HIT_ROW_H;
            });
        }
        y += SKILL_GAP;
    });

    // ⑥ 页脚
    return posterFooter(
        c,
        {
            qrDataUrl: data.qrDataUrl,
            disclaimer: data.watermark,
            url: data.siteUrl,
            caption: '扫码打开 · 自己算一遍',
        },
        y + 24,
    );
}

export interface RenderedShareCard {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    scale: number;
}

export function renderShareCard(data: ShareCardData, theme: ShareCardTheme): RenderedShareCard {
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    if (!probeCtx) throw new Error('Canvas 2D 不可用');

    const height = Math.ceil(layout({ ctx: probeCtx, paint: false }, data, theme));

    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const byBudget = Math.sqrt(MAX_PIXELS / (POSTER_W * height));
    const scale = Math.max(1, Math.min(dpr, byBudget));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(POSTER_W * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');

    // ⚠️ 必须先 scale 再用逻辑坐标画背景/外框：先在物理像素里填 (0,0,W,H) 时，
    // 一旦 scale>1（retina / 手机），背景只铺满左上 1/scale²，其余全白。
    ctx.scale(scale, scale);
    posterBackground(ctx, height);
    layout({ ctx, paint: true }, data, theme);
    posterFrame(ctx, height);

    return { canvas, width: POSTER_W, height, scale };
}

/** 文件名基名：副本战力_副本_关卡_日期 */
export function suggestShareFilename(dungeonName: string, bossName: string, dateText: string): string {
    return ['副本战力', dungeonName, bossName, dateText].filter(Boolean).join('_');
}

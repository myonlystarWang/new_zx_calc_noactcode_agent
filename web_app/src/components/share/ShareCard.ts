/**
 * 分享长图绘制器（Step 10）
 *
 * 用 Canvas 2D 自绘而不是截 DOM：
 * - 站内卡片的技能表在 `max-h-[550px] overflow-y-auto` 内，DOM 截图会被裁半；
 * - 卡片上有 `blur-[60px] mix-blend-screen` 装饰圆与 `backdrop-filter`，html2canvas 系不支持；
 * - Canvas 输出尺寸/配色完全可控，主题色直接跟随门派（`--theme-*`）。
 */
import type { CharacterAttributes } from '../../types';
import { formatNumber } from '../../utils/format';

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
    watermark?: string;
}

export interface ShareCardTheme {
    base: string;
    panel: string;
    text: string;
    primary: string;
    accent: string;
}

const W = 1080;
const PAD = 56;
const INNER = W - PAD * 2;
const COL_GAP = 40;
const COL_W = (INNER - COL_GAP) / 2;
const CHIP_H = 56;
const CHIP_GAP = 16;
const ATTR_ROW_H = 52;
const SKILL_ROW_H = 76;
const SKILL_GAP = 16;
const HIT_ROW_H = 44;
const QR_SIZE = 168;
const MAX_PIXELS = 8_000_000;

const FONT_STACK = `'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans SC','Source Han Sans SC',system-ui,-apple-system,'Segoe UI',sans-serif`;

const font = (size: number, weight: 400 | 500 = 400) => `${weight} ${size}px ${FONT_STACK}`;

export function readShareTheme(): ShareCardTheme {
    const cs = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const get = (name: string, fallback: string) => {
        const v = cs?.getPropertyValue(name)?.trim();
        return v || fallback;
    };
    return {
        base: '#0a0d0c',
        panel: get('--theme-panel-bg', 'rgba(18,16,14,0.92)'),
        text: get('--theme-text', '#e8eee9'),
        primary: get('--theme-primary', '#5c8a75'),
        accent: get('--theme-accent', '#5897a8'),
    };
}

/** #rgb / #rrggbb / rgb() / rgba() → rgba(r,g,b,alpha) */
function withAlpha(color: string, alpha: number): string {
    const c = (color || '').trim();
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
        if (hex.length === 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            return `rgba(${r},${g},${b},${alpha})`;
        }
    }
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) return `rgba(${m[1]},${m[2]},${m[3]},${alpha})`;
    return `rgba(232,238,233,${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

interface Ctx {
    ctx: CanvasRenderingContext2D;
    paint: boolean;
}

function text(
    { ctx, paint }: Ctx,
    str: string,
    x: number,
    y: number,
    f: string,
    color: string,
    align: CanvasTextAlign = 'left',
): void {
    if (!paint) return;
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
}

function fitText(ctx: CanvasRenderingContext2D, str: string, f: string, maxW: number): string {
    ctx.font = f;
    if (ctx.measureText(str).width <= maxW) return str;
    let out = str;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxW) out = out.slice(0, -1);
    return `${out}…`;
}

/** 画一枚胶囊，返回宽度 */
function chip(
    { ctx, paint }: Ctx,
    label: string,
    x: number,
    y: number,
    opts: { bg: string; fg: string; border: string; size?: number; weight?: 400 | 500 },
): number {
    const f = font(opts.size ?? 26, opts.weight ?? 400);
    ctx.font = f;
    const w = Math.ceil(ctx.measureText(label).width) + 44;
    if (paint) {
        roundRect(ctx, x, y, w, CHIP_H, 14);
        ctx.fillStyle = opts.bg;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = opts.border;
        ctx.stroke();
    }
    text({ ctx, paint }, label, x + w / 2, y + CHIP_H / 2 + 9, f, opts.fg, 'center');
    return w;
}

/** 小节标题：左侧竖条 + 标题，返回标题行结束后（含间距）的 y */
function sectionTitle({ ctx, paint }: Ctx, label: string, y: number, theme: ShareCardTheme): number {
    if (paint) {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(PAD, y + 6, 4, 28);
    }
    text({ ctx, paint }, label, PAD + 18, y + 28, font(28, 500), theme.text);
    return y + 52;
}

function divider({ ctx, paint }: Ctx, y: number, color: string): void {
    if (!paint) return;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.stroke();
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
 * 单趟布局；`paint=false` 时只量算高度。返回内容总高度（含上下 padding）。
 */
function layout(c: Ctx, data: ShareCardData, theme: ShareCardTheme): number {
    const { ctx } = c;
    const muted = withAlpha(theme.text, 0.62);
    const dim = withAlpha(theme.text, 0.42);
    const hairline = withAlpha(theme.text, 0.16);

    let y = PAD;

    // ① 站点头
    text(c, data.siteName, PAD, y + 34, font(34, 500), theme.text);
    text(c, data.dateText, W - PAD, y + 32, font(22), muted, 'right');
    y += 58;
    divider(c, y, hairline);
    y += 36;

    // ② 身份区
    let x = PAD;
    x += chip(c, data.className, x, y, {
        bg: withAlpha(theme.primary, 0.20),
        fg: theme.text,
        border: withAlpha(theme.primary, 0.75),
        weight: 500,
    });
    x += CHIP_GAP;
    chip(c, data.factionLabel, x, y, {
        bg: withAlpha(theme.accent, 0.18),
        fg: theme.accent,
        border: theme.accent,
        weight: 500,
    });
    y += CHIP_H + 36;

    // ③ 角色属性（两列）
    y = sectionTitle(c, '角色属性', y, theme);
    const half = Math.ceil(ATTR_ROWS.length / 2);
    ATTR_ROWS.forEach(([key, label, isPercent], i) => {
        const col = i < half ? 0 : 1;
        const row = i < half ? i : i - half;
        const colX = PAD + col * (COL_W + COL_GAP);
        const rowY = y + row * ATTR_ROW_H;
        const raw = data.attributes?.[key];
        const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
        text(c, label, colX, rowY + 30, font(26), muted);
        text(
            c,
            isPercent ? `${Math.round(value)}%` : formatNumber(value, false),
            colX + COL_W,
            rowY + 30,
            font(26, 500),
            theme.text,
            'right',
        );
    });
    y += half * ATTR_ROW_H + 36;

    // ④ 战斗增益
    y = sectionTitle(c, '战斗增益', y, theme);
    if (data.buffs.length === 0) {
        chip(c, '无增益', PAD, y, {
            bg: withAlpha(theme.text, 0.06),
            fg: dim,
            border: hairline,
        });
        y += CHIP_H + 36;
    } else {
        let cx = PAD;
        let rows = 1;
        data.buffs.forEach((buff) => {
            const label = buff.value ? `${buff.name} +${buff.value}` : buff.name;
            ctx.font = font(26);
            const w = Math.ceil(ctx.measureText(label).width) + 44;
            if (cx + w > W - PAD && cx > PAD) {
                cx = PAD;
                rows += 1;
            }
            chip(c, label, cx, y + (rows - 1) * (CHIP_H + CHIP_GAP), {
                bg: withAlpha(theme.text, 0.10),
                fg: theme.text,
                border: hairline,
            });
            cx += w + CHIP_GAP;
        });
        y += rows * CHIP_H + (rows - 1) * CHIP_GAP + 36;
    }

    // ⑤ 当前副本伤害明细（本图主体）
    y = sectionTitle(c, '当前副本伤害明细', y, theme);

    const bandH = 76;
    if (c.paint) {
        roundRect(ctx, PAD, y, INNER, bandH, 14);
        ctx.fillStyle = withAlpha(theme.text, 0.06);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = hairline;
        ctx.stroke();
    }
    const bossLabel = `当前 BOSS：${data.bossName}`;
    ctx.font = font(22);
    const bossW = ctx.measureText(bossLabel).width;
    const maxNameW = INNER - 40 - bossW - 24;
    text(c, fitText(ctx, data.dungeonName, font(28, 500), Math.max(120, maxNameW)), PAD + 20, y + 48, font(28, 500), theme.text);
    text(c, bossLabel, W - PAD - 20, y + 46, font(22), muted, 'right');
    y += bandH + 28;

    const maxAvg = data.skills.reduce((m, s) => Math.max(m, s.avg), 0);
    data.skills.forEach((skill) => {
        // 技能名 + 段数徽标 + 平均伤害
        const nameY = y + 28;
        const nameF = font(26, 500);
        text(c, skill.name, PAD, nameY, nameF, theme.text);
        ctx.font = nameF;
        let nameEnd = PAD + ctx.measureText(skill.name).width;
        if (skill.isMultiHit) {
            const badge = `共 ${skill.hitCount} 段`;
            ctx.font = font(20);
            const bw = Math.ceil(ctx.measureText(badge).width) + 24;
            if (c.paint) {
                roundRect(ctx, nameEnd + 14, nameY - 22, bw, 30, 8);
                ctx.fillStyle = withAlpha(theme.accent, 0.18);
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = theme.accent;
                ctx.stroke();
            }
            text(c, badge, nameEnd + 14 + bw / 2, nameY, font(20), theme.accent, 'center');
            nameEnd += 14 + bw;
        }

        const avgLabel = `平均 ${formatNumber(skill.avg)}`;
        text(c, avgLabel, W - PAD, nameY, font(28, 500), theme.text, 'right');

        // 对比条
        const barY = y + 44;
        const barW = INNER;
        if (c.paint) {
            roundRect(ctx, PAD, barY, barW, 10, 5);
            ctx.fillStyle = withAlpha(theme.text, 0.12);
            ctx.fill();
            const ratio = maxAvg > 0 ? Math.max(0, Math.min(1, skill.avg / maxAvg)) : 0;
            if (ratio > 0) {
                roundRect(ctx, PAD, barY, Math.max(6, barW * ratio), 10, 5);
                ctx.fillStyle = theme.primary;
                ctx.fill();
            }
        }
        y += SKILL_ROW_H;

        // 多段技能：逐段明细
        if (skill.isMultiHit && skill.hits.length > 0) {
            skill.hits.forEach((hit) => {
                const hitY = y + 28;
                text(c, `第 ${hit.hitIndex} 段`, PAD + 28, hitY, font(24), muted);
                text(
                    c,
                    `${formatNumber(hit.min)} ~ ${formatNumber(hit.max)}`,
                    PAD + 220,
                    hitY,
                    font(24),
                    dim,
                );
                text(c, formatNumber(hit.avg), W - PAD, hitY, font(24, 500), theme.text, 'right');
                y += HIT_ROW_H;
            });
        }
        y += SKILL_GAP;
    });

    y += 12;
    divider(c, y, hairline);
    y += 36;

    // ⑥ 页脚：二维码 + 水印
    if (data.qrDataUrl) {
        const qr = getQrImage(data.qrDataUrl);
        if (qr.complete && qr.naturalWidth > 0 && c.paint) {
            ctx.drawImage(qr, W - PAD - QR_SIZE, y, QR_SIZE, QR_SIZE);
        } else if (c.paint) {
            roundRect(ctx, W - PAD - QR_SIZE, y, QR_SIZE, QR_SIZE, 12);
            ctx.fillStyle = withAlpha(theme.text, 0.08);
            ctx.fill();
        }
    }
    const lines = (data.watermark || '').split('\n').filter(Boolean);
    lines.forEach((line, i) => {
        text(c, line, PAD, y + 40 + i * 34, font(22), i === 0 ? muted : dim);
    });
    y += QR_SIZE + PAD;

    return y;
}

/** QR dataURL → <img> 缓存（第二趟绘制时才能同步 drawImage） */
const qrCache = new Map<string, HTMLImageElement>();
function getQrImage(dataUrl: string): HTMLImageElement {
    const cached = qrCache.get(dataUrl);
    if (cached) return cached;
    const img = new Image();
    img.src = dataUrl;
    qrCache.set(dataUrl, img);
    return img;
}

/** 预热 QR 图，确保 renderShareCard 时能同步绘制 */
export async function preloadQrImage(dataUrl: string): Promise<void> {
    const img = getQrImage(dataUrl);
    if (img.complete && img.naturalWidth > 0) return;
    await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
    });
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
    const byBudget = Math.sqrt(MAX_PIXELS / (W * height));
    const scale = Math.max(1, Math.min(dpr, byBudget));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');

    // 背景：先铺暗底，再叠主题面板色（面板色带 alpha，随门派变化）
    ctx.fillStyle = theme.base;
    ctx.fillRect(0, 0, W, height);
    ctx.fillStyle = theme.panel;
    ctx.fillRect(0, 0, W, height);

    ctx.scale(scale, scale);
    layout({ ctx, paint: true }, data, theme);

    return { canvas, width: W, height, scale };
}

/** 文件名基名：副本战力_副本_关卡_日期 */
export function suggestShareFilename(dungeonName: string, bossName: string, dateText: string): string {
    return ['副本战力', dungeonName, bossName, dateText].filter(Boolean).join('_');
}

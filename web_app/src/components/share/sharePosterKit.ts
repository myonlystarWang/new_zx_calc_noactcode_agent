/**
 * 分享海报公共骨架（2026-10-27）
 *
 * 伤害长图与三张模拟器长图共用同一套「页头 / 页脚 / 背景 / 玻璃卡 / 分区标题」，
 * 只是中间的数据区各画各的。所有绘制函数都吃 `PosterCtx.paint`：
 * 第一趟 `paint=false` 只量高度，第二趟才落笔（见各 render 函数）。
 *
 * 视觉来源：`doc/四灵本元升阶_全解图解_20261023.html`
 *   深黑底 + 顶部金色光晕 + 右侧青微光 → LOGO/品牌/kicker → 金渐隐线 →
 *   玻璃卡（金边 + 内高光） → 序号式分区 → 页脚金线 + 二维码 + 作者署名。
 */
import { formatNumber } from '../../utils/format';

export interface PosterCtx {
    ctx: CanvasRenderingContext2D;
    paint: boolean;
}

export const POSTER_W = 1080;
export const POSTER_PAD = 56;
export const POSTER_INNER = POSTER_W - POSTER_PAD * 2;
export const QR_SIZE = 240;
export const CHIP_H = 56;
export const CHIP_GAP = 16;

export const GOLD_BRIGHT = '#fff3d1';
export const GOLD_MAIN = '#e5be73';
export const GOLD_DARK = '#a67c33';
export const CYAN = '#66f0e2';
export const BG_DEEP = '#05070b';
export const DEFAULT_SITE_URL = 'zxai.raddishlab.com';
export const DEFAULT_SITE_NAME = '天书万象 AI';
export const DEFAULT_AUTHOR = '星耀-萝卜';

const FONT_STACK = `'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans SC','Source Han Sans SC',system-ui,-apple-system,'Segoe UI',sans-serif`;

export type FontWeight = 400 | 500 | 700 | 900;

export const font = (size: number, weight: FontWeight = 400) => `${weight} ${size}px ${FONT_STACK}`;

// ---------------------------------------------------------------- 颜色/几何

export function withAlpha(color: string, alpha: number): string {
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

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

/** 金色竖向渐变（品牌字 / 主数字） */
export function goldFill(ctx: CanvasRenderingContext2D, top: number, height: number): CanvasGradient {
    const g = ctx.createLinearGradient(0, top, 0, top + height);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.38, GOLD_BRIGHT);
    g.addColorStop(0.72, GOLD_MAIN);
    g.addColorStop(1, GOLD_DARK);
    return g;
}

// ---------------------------------------------------------------- 文字

export function text(
    c: PosterCtx,
    str: string,
    x: number,
    y: number,
    f: string,
    color: string | CanvasGradient,
    align: CanvasTextAlign = 'left',
    spacing = 0,
): void {
    if (!c.paint) return;
    const { ctx } = c;
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    const anyCtx = ctx as unknown as { letterSpacing?: string };
    const canSpace = typeof anyCtx.letterSpacing === 'string';
    if (canSpace && spacing) anyCtx.letterSpacing = `${spacing}px`;
    ctx.fillText(str, x, y);
    if (canSpace && spacing) anyCtx.letterSpacing = '0px';
}

export function measure(ctx: CanvasRenderingContext2D, str: string, f: string): number {
    ctx.font = f;
    return ctx.measureText(str).width;
}

export function fitText(ctx: CanvasRenderingContext2D, str: string, f: string, maxW: number): string {
    ctx.font = f;
    if (ctx.measureText(str).width <= maxW) return str;
    let out = str;
    while (out.length > 1 && ctx.measureText(`${out}…`).width > maxW) out = out.slice(0, -1);
    return `${out}…`;
}

/** 中文按字换行 */
export function wrapText(ctx: CanvasRenderingContext2D, str: string, f: string, maxW: number): string[] {
    ctx.font = f;
    const out: string[] = [];
    let line = '';
    for (const ch of str) {
        if (ch === '\n') {
            out.push(line);
            line = '';
            continue;
        }
        const next = line + ch;
        if (ctx.measureText(next).width > maxW && line) {
            out.push(line);
            line = ch;
        } else {
            line = next;
        }
    }
    if (line) out.push(line);
    return out;
}

// ---------------------------------------------------------------- 元件

export function chip(
    c: PosterCtx,
    label: string,
    x: number,
    y: number,
    opts: { bg: string; fg: string; border: string; size?: number; weight?: FontWeight; height?: number; radius?: number },
): number {
    const f = font(opts.size ?? 24, opts.weight ?? 500);
    c.ctx.font = f;
    const h = opts.height ?? CHIP_H;
    const r = opts.radius ?? 14;
    const pad = opts.height ? 24 : 40;
    const w = Math.ceil(c.ctx.measureText(label).width) + pad;
    if (c.paint) {
        roundRect(c.ctx, x, y, w, h, r);
        c.ctx.fillStyle = opts.bg;
        c.ctx.fill();
        c.ctx.lineWidth = 1;
        c.ctx.strokeStyle = opts.border;
        c.ctx.stroke();
    }
    text(c, label, x + w / 2, y + h / 2 + (opts.size ?? 24) * 0.35, f, opts.fg, 'center');
    return w;
}

/** 玻璃卡片：渐变底 + 金边 + 顶部内高光 */
export function glassPanel(
    c: PosterCtx,
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { radius?: number; gold?: boolean },
): void {
    if (!c.paint) return;
    const { ctx } = c;
    const r = opts?.radius ?? 18;
    roundRect(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    g.addColorStop(0, 'rgba(23,30,46,0.92)');
    g.addColorStop(1, 'rgba(13,18,28,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts?.gold === false ? 'rgba(255,255,255,0.07)' : 'rgba(229,190,115,0.28)';
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y + 1);
    ctx.lineTo(x + w - r, y + 1);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.stroke();
    ctx.restore();
}

/** 分区标题：序号（金色）+ 标题 + 右侧说明 + 金渐隐底线。返回下一段 y */
export function sectionHead(
    c: PosterCtx,
    index: string,
    title: string,
    hint: string,
    y: number,
    textColor = '#e8eee9',
): number {
    const { ctx, paint } = c;
    const base = y + 34;
    text(c, index, POSTER_PAD, base, font(30, 900), goldFill(ctx, y + 8, 34));
    ctx.font = font(26, 900);
    const idxW = ctx.measureText(index).width;
    text(c, title, POSTER_PAD + idxW + 14, base, font(26, 900), '#ffffff');
    if (hint) text(c, hint, POSTER_W - POSTER_PAD, base - 2, font(16, 500), withAlpha(textColor, 0.42), 'right');
    if (paint) {
        const g = ctx.createLinearGradient(POSTER_PAD, 0, POSTER_W - POSTER_PAD, 0);
        g.addColorStop(0, 'rgba(229,190,115,0.55)');
        g.addColorStop(0.35, 'rgba(229,190,115,0.18)');
        g.addColorStop(1, 'rgba(229,190,115,0)');
        ctx.beginPath();
        ctx.moveTo(POSTER_PAD, y + 50);
        ctx.lineTo(POSTER_W - POSTER_PAD, y + 50);
        ctx.lineWidth = 1;
        ctx.strokeStyle = g;
        ctx.stroke();
    }
    return y + 70;
}

/** 通栏金渐隐细线 */
export function goldHairline(c: PosterCtx, y: number, alpha = 0.55, reverse = false): void {
    if (!c.paint) return;
    const { ctx } = c;
    const g = ctx.createLinearGradient(POSTER_PAD, 0, POSTER_W - POSTER_PAD, 0);
    g.addColorStop(0, `rgba(229,190,115,${reverse ? 0.28 : 0})`);
    g.addColorStop(0.5, `rgba(229,190,115,${alpha})`);
    g.addColorStop(1, `rgba(229,190,115,${reverse ? 0.55 : 0})`);
    ctx.beginPath();
    ctx.moveTo(POSTER_PAD, y);
    ctx.lineTo(POSTER_W - POSTER_PAD, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = g;
    ctx.stroke();
}

// ---------------------------------------------------------------- 图片

const lazyImages = new Map<string, HTMLImageElement>();

export function loadImage(src: string): HTMLImageElement {
    const cached = lazyImages.get(src);
    if (cached) return cached;
    const img = new Image();
    img.src = src;
    lazyImages.set(src, img);
    return img;
}

async function waitImage(img: HTMLImageElement): Promise<void> {
    if (img.complete && img.naturalWidth > 0) return;
    await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
    });
}

export function getQrImage(dataUrl: string): HTMLImageElement {
    return loadImage(dataUrl);
}

export async function preloadQrImage(dataUrl: string): Promise<void> {
    await waitImage(getQrImage(dataUrl));
}

/** 品牌 LOGO（/icon-192.png，与 PWA 图标同源） */
export function getLogoImage(): HTMLImageElement {
    return loadImage('/icon-192.png');
}

export async function preloadShareLogo(): Promise<void> {
    await waitImage(getLogoImage());
}

// ---------------------------------------------------------------- 背景 / 外框

/** 深黑底 + 顶部金色径向光晕 + 右侧青色微光 */
export function posterBackground(ctx: CanvasRenderingContext2D, height: number): void {
    ctx.fillStyle = BG_DEEP;
    ctx.fillRect(0, 0, POSTER_W, height);
    const gold = ctx.createRadialGradient(POSTER_W / 2, 0, 0, POSTER_W / 2, 0, POSTER_W * 0.78);
    gold.addColorStop(0, 'rgba(229,190,115,0.13)');
    gold.addColorStop(0.55, 'rgba(229,190,115,0.02)');
    gold.addColorStop(1, 'rgba(229,190,115,0)');
    ctx.fillStyle = gold;
    ctx.fillRect(0, 0, POSTER_W, height);
    const cyan = ctx.createRadialGradient(POSTER_W, height * 0.55, 0, POSTER_W, height * 0.55, POSTER_W * 0.7);
    cyan.addColorStop(0, 'rgba(102,240,226,0.055)');
    cyan.addColorStop(1, 'rgba(102,240,226,0)');
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, POSTER_W, height);
}

export function posterFrame(ctx: CanvasRenderingContext2D, height: number): void {
    roundRect(ctx, 18, 18, POSTER_W - 36, height - 36, 22);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.22)';
    ctx.stroke();
}

// ---------------------------------------------------------------- 页头

export interface PosterHeaderOpts {
    siteName: string;
    kicker: string;
    dateText: string;
    url?: string;
}

/** LOGO + 品牌名 + kicker + 右上日期/网址 + 金渐隐线。返回页头结束后的 y */
export function posterHeader(c: PosterCtx, o: PosterHeaderOpts, y0: number): number {
    const { ctx, paint } = c;
    const url = o.url || DEFAULT_SITE_URL;
    const textColor = '#e8eee9';
    let y = y0;

    const LOGO = 76;
    const logo = getLogoImage();
    if (paint) {
        roundRect(ctx, POSTER_PAD, y, LOGO, LOGO, 20);
        ctx.save();
        ctx.clip();
        if (logo.complete && logo.naturalWidth > 0) {
            ctx.drawImage(logo, POSTER_PAD, y, LOGO, LOGO);
        } else {
            ctx.fillStyle = 'rgba(229,190,115,0.10)';
            ctx.fill();
        }
        ctx.restore();
        roundRect(ctx, POSTER_PAD, y, LOGO, LOGO, 20);
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(229,190,115,0.45)';
        ctx.stroke();
    }

    const bx = POSTER_PAD + LOGO + 22;
    text(c, o.siteName || DEFAULT_SITE_NAME, bx, y + 40, font(44, 900), goldFill(ctx, y + 2, 46), 'left', 2);
    text(c, o.kicker, bx, y + 72, font(15, 700), withAlpha(GOLD_MAIN, 0.85), 'left', 4);

    text(c, `模拟于 ${o.dateText}`, POSTER_W - POSTER_PAD, y + 34, font(20, 500), withAlpha(textColor, 0.62), 'right');
    text(c, url, POSTER_W - POSTER_PAD, y + 66, font(18, 700), withAlpha(CYAN, 0.72), 'right', 0.5);
    y += LOGO + 26;

    goldHairline(c, y, 0.55);
    return y + 34;
}

// ---------------------------------------------------------------- 页脚

export interface PosterFooterOpts {
    /** 不传则不画二维码，免责文案占满整行 */
    qrDataUrl?: string | null;
    /** 免责/说明文案，多行用 \n 分隔 */
    disclaimer?: string;
    url?: string;
    author?: string;
    caption?: string;
}

/** 页脚：二维码 + 免责 + 底部通栏（作者 / 品牌·域名）。返回整图总高度 */
export function posterFooter(c: PosterCtx, o: PosterFooterOpts, y0: number): number {
    const { ctx, paint } = c;
    const textColor = '#e8eee9';
    const url = o.url || DEFAULT_SITE_URL;

    goldHairline(c, y0, 0.55);
    const footTop = y0 + 38;
    const hasQr = !!o.qrDataUrl;
    const leftW = hasQr ? POSTER_INNER - QR_SIZE - 44 : POSTER_INNER;

    if (hasQr) {
        const qr = getQrImage(o.qrDataUrl as string);
        const qx = POSTER_W - POSTER_PAD - QR_SIZE;
        if (paint) {
            roundRect(ctx, qx - 10, footTop - 10, QR_SIZE + 20, QR_SIZE + 20, 16);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            if (qr.complete && qr.naturalWidth > 0) {
                ctx.drawImage(qr, qx, footTop, QR_SIZE, QR_SIZE);
            } else {
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.fillRect(qx, footTop, QR_SIZE, QR_SIZE);
            }
        }
        text(
            c,
            o.caption || '扫码打开 · 自己算一遍',
            qx + QR_SIZE / 2,
            footTop + QR_SIZE + 34,
            font(16, 500),
            withAlpha(textColor, 0.42),
            'center',
        );
    }

    const disF = font(19);
    const dLines = (o.disclaimer || '')
        .split('\n')
        .filter((s) => s.trim())
        .flatMap((seg) => wrapText(ctx, seg, disF, leftW));
    const blockH = hasQr ? QR_SIZE : dLines.length * 32;
    const disTop = footTop + blockH / 2 - ((dLines.length - 1) * 32) / 2 + 6;
    dLines.forEach((line, i) => {
        text(c, line, POSTER_PAD, disTop + i * 32, disF, withAlpha(textColor, 0.50));
    });

    // 底部通栏：左作者，右品牌 + 域名
    const bottomY = footTop + (hasQr ? QR_SIZE + 110 : dLines.length * 32 + 66);
    if (paint) {
        const g = ctx.createLinearGradient(POSTER_PAD, 0, POSTER_W - POSTER_PAD, 0);
        g.addColorStop(0, 'rgba(229,190,115,0.28)');
        g.addColorStop(1, 'rgba(229,190,115,0.10)');
        ctx.beginPath();
        ctx.moveTo(POSTER_PAD, bottomY - 42);
        ctx.lineTo(POSTER_W - POSTER_PAD, bottomY - 42);
        ctx.lineWidth = 1;
        ctx.strokeStyle = g;
        ctx.stroke();
    }
    text(c, `作者：${o.author || DEFAULT_AUTHOR}`, POSTER_PAD, bottomY, font(18, 500), withAlpha(textColor, 0.45), 'left', 0.5);

    const urlF = font(18, 700);
    text(c, url, POSTER_W - POSTER_PAD, bottomY, urlF, withAlpha(CYAN, 0.68), 'right');
    const urlW = measure(ctx, url, urlF);
    text(c, `${DEFAULT_SITE_NAME} ·`, POSTER_W - POSTER_PAD - urlW - 12, bottomY, font(20, 900), goldFill(ctx, bottomY - 20, 22), 'right', 0.5);

    return bottomY + 34 + POSTER_PAD - 30;
}

// ---------------------------------------------------------------- 数字/日期

/** 拆成「数值 + 单位」，用于大字主数据（亿/万 走单位，小数走数值） */
export function splitMagnitude(value: number): { amount: string; unit: string } {
    if (!Number.isFinite(value)) return { amount: '-', unit: '' };
    const abs = Math.abs(value);
    if (abs >= 1e8) return { amount: formatNumber(value, false), unit: '亿' };
    if (abs >= 1e4) return { amount: formatNumber(value, false), unit: '万' };
    return { amount: formatNumber(value, false), unit: '' };
}

/** 已迁到 `utils/date`（轻量函数不能被海报模块绑架），此处 re-export 保持旧引用可用 */
export { todayText } from '../../utils/date';

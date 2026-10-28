/**
 * 「游戏面板风」长图（新天缘 / 轩辕策 / 神机专用）
 *
 * 为什么不做成品牌海报：玩家在群里转发这类装备/宝书/神机结果时，认的就是游戏内
 * tooltip 那个样子（深底、紫色属性名、蓝色数值、品阶星星）。做成游戏面板反而更可信，
 * 也更省版面 —— 品牌只在最底部留一行小字，不抢内容。
 *
 * 绘制仍是 Canvas 自绘（不截 DOM）：DOM 版本带 icons 字体、伪元素描边、backdrop-filter，
 * 截图库一律还原不了。
 */
export interface PanelLine {
    /** 左列前缀（如「天命+2」），固定列宽对齐，可无 */
    prefix?: string;
    name: string;
    value: string;
    /** gold = 关键行（天命点/天缘等级等） */
    tone?: 'normal' | 'gold';
}

export interface PanelModel {
    title: string;
    /** 标题下的红字，如「不会掉落」 */
    subtitle?: string;
    /** 品阶/洗练次数/等级，或 境界/种族/门派/等级 */
    meta: string[];
    /** 属性行：名称 + 数值 */
    lines: PanelLine[];
    /** 底部注释，如「（进阶技能）聚灵咒III《天空》 1级」 */
    note?: string;
    /** 左上角图标（dataURL 或同级资源路径），可无 */
    iconSrc?: string;
    /** 面板宽度，默认 720 */
    width?: number;
}

const FONT_STACK = `'Microsoft YaHei','PingFang SC','Hiragino Sans GB','Noto Sans SC',system-ui,-apple-system,sans-serif`;
const font = (size: number, weight = 400) => `${weight} ${size}px ${FONT_STACK}`;

const C = {
    bg: '#05070b',
    panel: '#0c1019',
    border: '#1d2740',
    title: '#e5be73',
    subtitle: '#ff7b7b',
    meta: '#9aa7ba',
    name: '#a58cff',
    value: '#6fb5ff',
    gold: '#ffd75e',
    note: '#8fa0bd',
    brand: 'rgba(229,190,115,0.55)',
    url: 'rgba(111,181,255,0.55)',
    hair: 'rgba(120,150,200,0.16)',
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function txt(
    ctx: CanvasRenderingContext2D,
    str: string,
    x: number,
    y: number,
    f: string,
    color: string,
    align: CanvasTextAlign = 'left',
) {
    ctx.font = f;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
}

const IMG = new Map<string, HTMLImageElement>();
function img(src: string): HTMLImageElement {
    const hit = IMG.get(src);
    if (hit) return hit;
    const el = new Image();
    el.src = src;
    IMG.set(src, el);
    return el;
}

export async function preloadPanelIcon(src?: string): Promise<void> {
    if (!src) return;
    const el = img(src);
    if (el.complete && el.naturalWidth > 0) return;
    await new Promise<void>((resolve) => {
        el.onload = () => resolve();
        el.onerror = () => resolve();
    });
}

const PAD = 44;
const ICON = 104;
const LINE_H = 46;
const META_H = 34;
const TITLE_H = 46;

/** 解析成需要的高度（不含外框留白） */
function measureHeight(m: PanelModel): number {
    const headText = TITLE_H + (m.subtitle ? 32 : 0) + m.meta.length * META_H;
    const head = Math.max(m.iconSrc ? ICON + 8 : 0, headText);
    const noteH = m.note ? 44 : 0;
    return 48 + head + 18 + 18 + m.lines.length * LINE_H + noteH + 30 + 34 + 40;
}

export interface RenderedPanel {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    scale: number;
}

export function renderPanel(m: PanelModel): RenderedPanel {
    const W = m.width ?? 720;
    const h = Math.ceil(measureHeight(m));
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');

    ctx.scale(dpr, dpr);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, h);

    // 面板底
    roundRect(ctx, 12, 12, W - 24, h - 24, 10);
    ctx.fillStyle = C.panel;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.border;
    ctx.stroke();

    let y = 48;
    const left = PAD;
    const right = W - PAD;

    // 图标（游戏里是物品格：深底 + 金/紫描边）
    let textX = left;
    if (m.iconSrc) {
        const el = img(m.iconSrc);
        roundRect(ctx, left, y - 6, ICON, ICON, 8);
        ctx.fillStyle = '#0a0d14';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(190,120,255,0.55)';
        ctx.stroke();
        if (el.complete && el.naturalWidth > 0) {
            const pad = 8;
            ctx.drawImage(el, left + pad, y - 6 + pad, ICON - pad * 2, ICON - pad * 2);
        }
        textX = left + ICON + 20;
    }

    // 标题
    txt(ctx, m.title, textX, y + 34, font(34, 900), C.title);
    y += TITLE_H;

    if (m.subtitle) {
        txt(ctx, m.subtitle, textX, y + 20, font(22, 700), C.subtitle);
        y += 32;
    }
    m.meta.forEach((line) => {
        txt(ctx, line, textX, y + 24, font(22, 400), C.meta);
        y += META_H;
    });

    // 头部与正文分隔
    y = Math.max(y, 48 + (m.iconSrc ? ICON + 2 : 0)) + 18;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.hair;
    ctx.stroke();
    y += 18;

    // 属性行（有 prefix 时左列固定 132px，中文两列才对得齐）
    m.lines.forEach((line) => {
        const gold = line.tone === 'gold';
        const nameX = line.prefix ? left + 132 : left;
        if (line.prefix) {
            txt(ctx, line.prefix, left, y + 30, font(28, 700), gold ? C.gold : C.name);
        }
        txt(ctx, line.name, nameX, y + 30, font(28, gold ? 700 : 500), gold ? C.gold : C.name);
        txt(ctx, line.value, right, y + 30, font(28, 700), gold ? C.gold : C.value, 'right');
        y += LINE_H;
    });

    if (m.note) {
        y += 10;
        txt(ctx, m.note, left, y + 22, font(20, 400), C.note);
        y += 34;
    }

    // 底部：品牌 + 域名（很轻，不抢内容）
    const footY = h - 40;
    ctx.beginPath();
    ctx.moveTo(left, footY - 26);
    ctx.lineTo(right, footY - 26);
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.hair;
    ctx.stroke();
    txt(ctx, '天书万象 AI', left, footY, font(18, 900), C.brand);
    txt(ctx, 'zxai.raddishlab.com · 模拟结果仅供参考', right, footY, font(16, 400), C.url, 'right');

    return { canvas, width: W, height: h, scale: dpr };
}

/**
 * 「截图 + 品牌侧栏」合成器（2026-10-28 并排版 v3）
 *
 * 站内已把卡做成 1:1 游戏实机样式，手绘必走形，所以内容直接截真实 DOM，
 * 装饰全部挤到右侧一栏：
 *
 *   ┌──────────────────────────┬──────────────┐
 *   │                          │ LOGO 品牌名   │
 *   │    真实 DOM 截图（主体）   │ 免责         │
 *   │                          │ 二维码        │
 *   │                          │ 作者 / 域名   │
 *   └──────────────────────────┴──────────────┘
 *
 * v2（2026-10-27）：画布 1080→1000，PAD 44→36，二维码 200→176。
 *
 * v3（2026-10-28，用户反馈「左侧图片太大、和右边字体不适配」）：
 *  · 截图区宽度不再写死 600，改为 `卡片原始宽 × 1.5`，夹在 [380, 620]。
 *    根因：手机面板里的卡只有 ~307px 宽，硬拉到 600 等于放大 1.95 倍，
 *    卡内 14px 正文被渲染成 27px —— 比右栏品牌字还大，视觉层级倒置。
 *  · 右栏所有尺寸/字号按同一系数 kr 跟随缩放（品牌 26 / kicker 11 / 免责 14 /
 *    caption 12 / 署名 12 × kr），保证两侧字号始终同量级。
 *  · 采样倍率从固定 4x 改为按卡片宽度自适应，见 SAMPLE_* 注释。
 */
import { domToCanvas } from 'modern-screenshot';
import {
    DEFAULT_SITE_URL,
    GOLD_MAIN,
    CYAN,
    getLogoImage,
    getQrImage,
    goldFill,
    preloadShareLogo,
    roundRect,
    withAlpha,
    wrapText,
    font,
    text,
} from './sharePosterKit';

export interface DomPosterOpts {
    node: HTMLElement;
    kicker: string;
    dateText: string;
    qrDataUrl?: string | null;
    disclaimer?: string;
    siteUrl?: string;
    backgroundColor?: string;
}

export interface RenderedDomPoster {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
}

// ---------------------------------------------------------------- 版式常量
const W = 1000;
const PAD = 36;
const GAP = 28;
const TEXT = '#e8eee9';

/**
 * 截图区宽度（2026-10-28 v3：从固定 600 改为跟随卡片原始宽度）
 *
 * 固定 600 的问题：手机上面板里的卡只有 300~350px 宽，硬拉到 600 等于放大 1.9 倍，
 * 卡内 14px 正文被渲染成 27px —— 比右栏品牌字（26px）还大，视觉层级整个倒置。
 * 现在按 1.3 倍上限放大，并夹在 [380, 620]，让「卡内正文」和「右栏文字」保持同一量级。
 */
const CARD_W_MIN = 380;
/** 上限 520：再宽右栏就只剩 300 出头，品牌字（26×kr）会贴到画布边缘 */
const CARD_W_MAX = 520;
const CARD_UPSCALE = 1.5;

/** 右栏各元件在 k=1 时的基准尺寸，实际值 = 基准 × 右栏缩放系数 kr */
const LOGO_BASE = 52;
const QR_BASE = 176;
const F_BRAND = 26;
const F_KICKER = 11;
const F_DIS = 14;
const F_CAPTION = 12;
const F_SIGN = 12;

/**
 * 截图采样倍率（2026-10-28 从固定 4x 改为按卡片宽度自适应）
 *
 * 4x 采样是纯浪费：卡片 420px 宽时产出 1680×2940（近 500 万像素、20MB 位图），
 * 随后 trimBlankBands 的 getImageData 还要再拷一份，低配机上点一次分享能卡 0.5~1.5s。
 *
 * 现在的规则：按「截图区最大宽度 × 1.2」反推倍率，夹在 [1.25, 2] 之间 ——
 * 最终只会缩小、不会放大到模糊，像素量比 4x 降 60%~80%。
 */
const SAMPLE_TARGET_PX = Math.round(CARD_W_MAX * 1.2);
const SAMPLE_MIN = 1.25;
const SAMPLE_MAX = 2;

/** 截图后要抽掉的纯空白行带，至少这么高（CSS px，实际阈值 = 本值 × 采样倍率）才动手 */
const BLANK_MIN_CSS = 24;
/** 裁剪时上下各保留这么多空白（CSS px），否则删完两行文字会贴在一起 */
const BLANK_KEEP_CSS = 10;

/**
 * 抽掉截图里「整行都是同一个深色」的长空白带。
 *
 * 站内这些卡是 flex 布局，内容与底部按钮之间会被撑出一段空洞；
 * 纯调画布参数消不掉（洞在卡片内部），直接扫像素最省事。
 * 只删「整行颜色一致且很暗」的连续行，文字行永远不可能满足这个条件。
 */
function trimBlankBands(src: HTMLCanvasElement, sample: number): HTMLCanvasElement {
    const ctx = src.getContext('2d', { willReadFrequently: true });
    if (!ctx) return src;
    const { width: w, height: h } = src;
    const minPx = BLANK_MIN_CSS * sample;
    const keepPx = BLANK_KEEP_CSS * sample;
    let data: Uint8ClampedArray;
    try {
        data = ctx.getImageData(0, 0, w, h).data;
    } catch {
        return src;
    }

    const blank = new Uint8Array(h);
    const stepX = Math.max(1, Math.floor(w / 64));
    for (let y = 0; y < h; y++) {
        // 忽略左右各 6px（卡片圆角/描边），只看内部
        const x0 = 6;
        const x1 = w - 6;
        let r0 = -1; let g0 = -1; let b0 = -1;
        let uniform = true;
        for (let x = x0; x < x1; x += stepX) {
            const i = (y * w + x) << 2;
            const r = data[i]; const g = data[i + 1]; const b = data[i + 2];
            if (r0 < 0) { r0 = r; g0 = g; b0 = b; continue; }
            if (Math.abs(r - r0) > 6 || Math.abs(g - g0) > 6 || Math.abs(b - b0) > 6) {
                uniform = false;
                break;
            }
        }
        // 必须「够暗」才算空白（避免把亮色纯色块当空白删掉）
        blank[y] = uniform && r0 >= 0 && r0 < 48 && g0 < 48 && b0 < 48 ? 1 : 0;
    }

    // 找出长度达标的空白带
    const bands: Array<[number, number]> = [];
    let runStart = -1;
    for (let y = 0; y <= h; y++) {
        const isBlank = y < h && blank[y] === 1;
        if (isBlank && runStart < 0) runStart = y;
        if (!isBlank && runStart >= 0) {
            // 只删中间那段，两端各留 keepPx/2，保住行间距
            if (y - runStart >= minPx + keepPx) {
                bands.push([runStart + keepPx / 2, y - keepPx / 2]);
            }
            runStart = -1;
        }
    }
    if (bands.length === 0) return src;

    const removed = bands.reduce((s, [a, b]) => s + (b - a), 0);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h - removed;
    const octx = out.getContext('2d');
    if (!octx) return src;

    let cursor = 0;
    let destY = 0;
    bands.forEach(([a, b]) => {
        const segH = a - cursor;
        if (segH > 0) {
            octx.drawImage(src, 0, cursor, w, segH, 0, destY, w, segH);
            destY += segH;
        }
        cursor = b;
    });
    if (cursor < h) {
        octx.drawImage(src, 0, cursor, w, h - cursor, 0, destY, w, h - cursor);
    }
    return out;
}

export async function renderDomPoster(o: DomPosterOpts): Promise<RenderedDomPoster> {
    await preloadShareLogo();
    const url = o.siteUrl || DEFAULT_SITE_URL;

    // 显式给宽高：目标是 flex 子项（flex-1 min-w-0），单独克隆会拿不到父级宽度、右侧被裁。
    // 采样倍率按卡片实际宽度自适应，见 SAMPLE_* 注释。
    const rect = o.node.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const sample = Math.min(SAMPLE_MAX, Math.max(SAMPLE_MIN, SAMPLE_TARGET_PX / cssW));
    const raw = await domToCanvas(o.node, {
        scale: sample,
        width: cssW,
        height: cssH,
        backgroundColor: o.backgroundColor ?? 'transparent',
    });
    const shot = trimBlankBands(raw, sample);
    const natW = shot.width / sample;
    const natH = shot.height / sample;

    // ---- 截图区尺寸：只放大到 1.3 倍，避免卡内正文比右栏品牌字还大 ----
    const cardW = Math.round(Math.min(CARD_W_MAX, Math.max(CARD_W_MIN, natW * CARD_UPSCALE)));
    const k = cardW / Math.max(1, natW);
    const cardH = Math.max(1, Math.round(natH * k));

    // ---- 右栏几何：字号跟随截图缩放系数 kr，两侧保持同一量级 ----
    const railX = PAD + cardW + GAP;
    const railW = W - railX - PAD;
    const kr = Math.min(CARD_UPSCALE, Math.max(0.85, k));
    const logoSize = Math.round(LOGO_BASE * kr);
    const qr = Math.round(Math.min(QR_BASE * kr, railW * 0.62));
    const fBrand = Math.round(F_BRAND * kr);
    const fKicker = Math.max(10, Math.round(F_KICKER * kr));
    const fDis = Math.round(F_DIS * kr);
    const fCaption = Math.max(10, Math.round(F_CAPTION * kr));
    const fSign = Math.max(10, Math.round(F_SIGN * kr));
    const disLH = Math.round(fDis * 1.7);
    const gap18 = Math.round(18 * kr);
    const gap22 = Math.round(22 * kr);

    // ---- 右栏高度预算 ----
    const disF = font(fDis);
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) throw new Error('Canvas 2D 不可用');
    const disLines = (o.disclaimer || '')
        .split('\n')
        .filter((s) => s.trim())
        .flatMap((seg) => wrapText(probe, seg, disF, railW));
    const railH =
        logoSize + gap18 + // LOGO / 品牌
        gap18 + disLines.length * disLH + gap22 + // 免责
        qr + gap22 + gap18 + // 二维码 + caption
        Math.round(46 * kr); // 作者 + 品牌·域名

    const H = Math.round(Math.max(cardH, railH) + PAD * 2);
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const scale = Math.max(1, Math.min(dpr, Math.sqrt(8_000_000 / (W * H))));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D 不可用');

    ctx.scale(scale, scale);

    // 背景：深黑 + 左偏金晕 + 右侧青微光
    ctx.fillStyle = '#05070b';
    ctx.fillRect(0, 0, W, H);
    const gold = ctx.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, W * 0.62);
    gold.addColorStop(0, 'rgba(229,190,115,0.13)');
    gold.addColorStop(0.55, 'rgba(229,190,115,0.02)');
    gold.addColorStop(1, 'rgba(229,190,115,0)');
    ctx.fillStyle = gold;
    ctx.fillRect(0, 0, W, H);
    const cyan = ctx.createRadialGradient(W, H * 0.5, 0, W, H * 0.5, W * 0.5);
    cyan.addColorStop(0, 'rgba(102,240,226,0.06)');
    cyan.addColorStop(1, 'rgba(102,240,226,0)');
    ctx.fillStyle = cyan;
    ctx.fillRect(0, 0, W, H);

    const c = { ctx, paint: true };

    // ---- 左：截图（垂直居中 + 玻璃外框） ----
    const cardY = Math.round((H - cardH) / 2);
    roundRect(ctx, PAD - 7, cardY - 7, cardW + 14, cardH + 14, 13);
    ctx.fillStyle = 'rgba(20,26,38,0.72)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.22)';
    ctx.stroke();
    ctx.drawImage(shot, PAD, cardY, cardW, cardH);

    // ---- 右：信息栏（长卡片弹性分布，矮卡片居中） ----
    const isTall = cardH > railH + 60;
    const footLine = Math.round(34 * kr);

    let y = isTall ? PAD + 4 : Math.round((H - railH) / 2);
    const railTop = y;

    const logoImg = getLogoImage();
    const logoR = Math.round(14 * kr);
    roundRect(ctx, railX, y, logoSize, logoSize, logoR);
    ctx.save();
    ctx.clip();
    if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, railX, y, logoSize, logoSize);
    } else {
        ctx.fillStyle = 'rgba(229,190,115,0.10)';
        ctx.fill();
    }
    ctx.restore();
    roundRect(ctx, railX, y, logoSize, logoSize, logoR);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.45)';
    ctx.stroke();

    const brandX = railX + logoSize + Math.round(12 * kr);
    text(c, '天书万象 AI', brandX, y + Math.round(logoSize * 0.52), font(fBrand, 900), goldFill(ctx, y + 2, fBrand + 4), 'left', 1);
    text(c, o.kicker, brandX, y + Math.round(logoSize * 0.9), font(fKicker, 700), withAlpha(GOLD_MAIN, 0.85), 'left', 2);
    y += logoSize + gap18;

    // 分隔线
    ctx.beginPath();
    ctx.moveTo(railX, y);
    ctx.lineTo(railX + railW, y);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.22)';
    ctx.stroke();
    y += gap18;

    // 免责
    disLines.forEach((line, i) => {
        text(c, line, railX, y + Math.round(fDis * 0.9) + i * disLH, disF, withAlpha(TEXT, 0.52));
    });
    const disBottomY = y + disLines.length * disLH;

    // 底部两行位置
    const footY = isTall ? (H - PAD - 6) : (railTop + railH);

    // 二维码垂直定位：若 tall 则在免责与底部横线之间居中
    let qrTopY = disBottomY + gap22;
    if (isTall && o.qrDataUrl) {
        const qrTotalH = qr + Math.round(20 * kr) + 14;
        const availableSpace = (footY - footLine) - disBottomY;
        qrTopY = disBottomY + Math.max(16, Math.round((availableSpace - qrTotalH) / 2));
    }

    // 二维码（右栏居中 + 白底留白）
    if (o.qrDataUrl) {
        const qrImg = getQrImage(o.qrDataUrl);
        const qx = railX + Math.round((railW - qr) / 2);
        roundRect(ctx, qx - 7, qrTopY - 7, qr + 14, qr + 14, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        if (qrImg.complete && qrImg.naturalWidth > 0) {
            ctx.drawImage(qrImg, qx, qrTopY, qr, qr);
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fillRect(qx, qrTopY, qr, qr);
        }
        text(c, '扫码打开 · 自己试一次', qx + qr / 2, qrTopY + qr + Math.round(20 * kr), font(fCaption, 500), withAlpha(TEXT, 0.42), 'center');
    }

    // 底部两行（贴右栏内容块底或贴海报底）
    ctx.beginPath();
    ctx.moveTo(railX, footY - footLine);
    ctx.lineTo(railX + railW, footY - footLine);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.18)';
    ctx.stroke();
    text(c, '作者：星耀-萝卜', railX, footY - Math.round(14 * kr), font(fSign, 500), withAlpha(TEXT, 0.45), 'left', 0.5);
    text(c, '天书万象 AI', railX, footY + Math.round(4 * kr), font(fSign, 900), withAlpha(GOLD_MAIN, 0.80), 'left', 0.5);
    ctx.font = font(fSign, 900);
    const brandW = ctx.measureText('天书万象 AI').width;
    text(c, ' · ' + url, railX + brandW + 2, footY + Math.round(4 * kr), font(fSign, 700), withAlpha(CYAN, 0.68), 'left');

    // 外框
    roundRect(ctx, 12, 12, W - 24, H - 24, 18);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(229,190,115,0.22)';
    ctx.stroke();

    return { canvas, width: W, height: H };
}

/** 文件名：工具名_内容_日期 */
export function domPosterFilename(prefix: string, name: string, dateText: string): string {
    return [prefix, name, dateText].filter(Boolean).join('_').replace(/[\\/:*?"<>|\s]+/g, '-');
}

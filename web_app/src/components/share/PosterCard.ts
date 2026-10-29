/**
 * 通用海报渲染器（模拟器专用）
 *
 * 三张模拟器长图（蕴灵 / 轩辕策 / 天缘）都只是「填不同的数据」，版式完全一样：
 *   页头 → 主数据卡 → 若干 01/02/03 分区（格子 / 胶囊 / 行） → 页脚
 * 所以这里用 `PosterModel` 描述内容，各工具只写一个 build 函数。
 *
 * 骨架（页头/页脚/背景/玻璃卡/分区标题）全部来自 `sharePosterKit`，与伤害长图一致。
 */
import {
    CHIP_GAP,
    CHIP_H,
    CYAN,
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
    roundRect,
    sectionHead,
    text,
    withAlpha,
    type PosterCtx,
} from './sharePosterKit';

export interface PosterHero {
    /** 左上胶囊：装备名 / 书名 / 部件 + 品阶等 */
    badges: string[];
    title: string;
    subtitle: string;
    metricLabel: string;
    metricValue: string;
    metricUnit?: string;
    metric2Label?: string;
    metric2Value?: string;
    metric2Unit?: string;
}

export interface PosterCell {
    label: string;
    value: string;
}

export interface PosterRow {
    name: string;
    /** 名字右侧的小徽标，如「+3 → +4」 */
    badge?: string;
    /** 右侧主数值 */
    value: string;
    /** 名字下方小字 */
    sub?: string;
    /** 0~1，画对比条 */
    ratio?: number;
}

export interface PosterCallout {
    badge: string;
    headline: string;
    subText?: string;
    tone?: 'gold' | 'cyan' | 'red' | 'slate';
}

export type PosterSection =
    | { kind: 'cells'; index: string; title: string; hint?: string; cells: PosterCell[]; callout?: PosterCallout }
    | { kind: 'chips'; index: string; title: string; hint?: string; chips: string[] }
    | { kind: 'rows'; index: string; title: string; hint?: string; rows: PosterRow[] };

export interface PosterModel {
    kicker: string;
    dateText: string;
    hero: PosterHero;
    sections: PosterSection[];
    qrDataUrl?: string | null;
    disclaimer?: string;
    siteUrl?: string;
}

const TEXT = '#e8eee9';
const ATTR_COLS = 4;
const ATTR_GAP = 14;
const ATTR_CELL_W = (POSTER_INNER - ATTR_GAP * (ATTR_COLS - 1)) / ATTR_COLS;
const ATTR_CELL_H = 96;
const ROW_H = 92;
const ROW_GAP = 20;
const MAX_PIXELS = 8_000_000;

function heroBlock(c: PosterCtx, hero: PosterHero, y: number): number {
    const H = 210;
    glassPanel(c, POSTER_PAD, y, POSTER_INNER, H);
    const padX = 32;

    let cx = POSTER_PAD + padX;
    hero.badges.filter(Boolean).forEach((b, i) => {
        cx += chip(c, b, cx, y + 30, {
            bg: i === 0 ? withAlpha(CYAN, 0.12) : withAlpha(GOLD_MAIN, 0.12),
            fg: i === 0 ? '#e6fffb' : GOLD_MAIN,
            border: i === 0 ? withAlpha(CYAN, 0.42) : withAlpha(GOLD_MAIN, 0.55),
            size: 22,
        }) + 14;
    });

    // 右侧主数值
    const rightX = POSTER_W - POSTER_PAD - padX;
    text(c, hero.metricLabel, rightX, y + 44, font(17, 700), withAlpha(GOLD_MAIN, 0.75), 'right', 2);
    const unitW = hero.metricUnit ? 34 : 0;
    text(c, hero.metricValue, rightX - unitW, y + 116, font(58, 900), goldFill(c.ctx, y + 62, 60), 'right');
    if (hero.metricUnit) {
        text(c, hero.metricUnit, rightX, y + 114, font(26, 700), withAlpha(GOLD_MAIN, 0.9), 'right');
    }

    if (hero.metric2Label) {
        text(c, hero.metric2Label, rightX, y + 154, font(16, 500), withAlpha(TEXT, 0.42), 'right');
        const m2 = `${hero.metric2Value || ''}${hero.metric2Unit || ''}`;
        text(c, m2, rightX, y + 188, font(24, 700), withAlpha(TEXT, 0.86), 'right');
    }

    const nameMaxW = POSTER_INNER - padX * 2 - 300;
    text(
        c,
        fitText(c.ctx, hero.title, font(30, 700), Math.max(200, nameMaxW)),
        POSTER_PAD + padX,
        y + 154,
        font(30, 700),
        '#ffffff',
    );
    text(c, fitText(c.ctx, hero.subtitle, font(19, 400), nameMaxW), POSTER_PAD + padX, y + 188, font(19, 400), withAlpha(TEXT, 0.40));
    return y + H + 40;
}

function calloutBlock(c: PosterCtx, callout: PosterCallout, y: number): number {
    const H = callout.subText ? 88 : 62;
    const padX = 24;
    const tone = callout.tone || 'cyan';

    if (c.paint) {
        const { ctx } = c;
        roundRect(ctx, POSTER_PAD, y, POSTER_INNER, H, 12);
        const g = ctx.createLinearGradient(POSTER_PAD, y, POSTER_PAD + POSTER_INNER, y + H);
        if (tone === 'gold') {
            g.addColorStop(0, 'rgba(40,32,18,0.88)');
            g.addColorStop(1, 'rgba(20,16,10,0.94)');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(229,190,115,0.45)';
        } else if (tone === 'red') {
            g.addColorStop(0, 'rgba(46,20,20,0.88)');
            g.addColorStop(1, 'rgba(24,10,10,0.94)');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(248,113,113,0.45)';
        } else {
            g.addColorStop(0, 'rgba(16,32,44,0.88)');
            g.addColorStop(1, 'rgba(10,20,30,0.94)');
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = 'rgba(70,232,251,0.35)';
        }
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    const badgeBg =
        tone === 'gold'
            ? 'rgba(229,190,115,0.15)'
            : tone === 'red'
              ? 'rgba(248,113,113,0.15)'
              : 'rgba(70,232,251,0.12)';
    const badgeFg = tone === 'gold' ? GOLD_MAIN : tone === 'red' ? '#f87171' : CYAN;
    const badgeBorder =
        tone === 'gold'
            ? 'rgba(229,190,115,0.45)'
            : tone === 'red'
              ? 'rgba(248,113,113,0.45)'
              : 'rgba(70,232,251,0.35)';

    const bw = chip(c, callout.badge, POSTER_PAD + padX, y + 16, {
        bg: badgeBg,
        fg: badgeFg,
        border: badgeBorder,
        size: 19,
        weight: 700,
        height: 30,
        radius: 8,
    });

    const headColor = tone === 'gold' ? goldFill(c.ctx, y + 16, 28) : tone === 'red' ? '#fca5a5' : '#e6fffb';
    text(c, callout.headline, POSTER_PAD + padX + bw + 14, y + 38, font(23, 700), headColor);

    if (callout.subText) {
        text(c, callout.subText, POSTER_PAD + padX + 2, y + 70, font(17, 400), withAlpha(TEXT, 0.65));
    }

    return y + H + 18;
}

function cellsBlock(c: PosterCtx, cells: PosterCell[], y: number): number {
    cells.forEach((cell, i) => {
        const col = i % ATTR_COLS;
        const row = Math.floor(i / ATTR_COLS);
        const x = POSTER_PAD + col * (ATTR_CELL_W + ATTR_GAP);
        const cy = y + row * (ATTR_CELL_H + ATTR_GAP);
        glassPanel(c, x, cy, ATTR_CELL_W, ATTR_CELL_H, { radius: 12, gold: false });
        text(c, cell.label, x + 16, cy + 32, font(15, 500), withAlpha(TEXT, 0.40));
        text(c, cell.value, x + 16, cy + 74, font(28, 700), '#f2f5fa');
    });
    return y + Math.ceil(cells.length / ATTR_COLS) * (ATTR_CELL_H + ATTR_GAP) + 24;
}

function chipsBlock(c: PosterCtx, chips: string[], y: number): number {
    if (chips.length === 0) {
        chip(c, '无', POSTER_PAD, y, { bg: withAlpha(TEXT, 0.05), fg: withAlpha(TEXT, 0.4), border: withAlpha(TEXT, 0.14) });
        return y + CHIP_H + 32;
    }
    let rx = POSTER_PAD;
    let rows = 1;
    chips.forEach((label) => {
        c.ctx.font = font(24);
        const w = Math.ceil(c.ctx.measureText(label).width) + 40;
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
    return y + rows * CHIP_H + (rows - 1) * CHIP_GAP + 32;
}

function rowsBlock(c: PosterCtx, rows: PosterRow[], y: number): number {
    const { ctx } = c;
    const maxRatio = rows.reduce((m, r) => Math.max(m, r.ratio ?? 0), 0);
    rows.forEach((row) => {
        const nameY = y + 30;
        const nameF = font(26, 700);
        text(c, row.name, POSTER_PAD, nameY, nameF, '#f2f5fa');
        ctx.font = nameF;
        let nameEnd = POSTER_PAD + ctx.measureText(row.name).width;

        if (row.badge) {
            ctx.font = font(18, 700);
            const bw = Math.ceil(ctx.measureText(row.badge).width) + 22;
            const bx = nameEnd + 14;
            const by = nameY - 20;
            if (c.paint) {
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
            text(c, row.badge, bx + bw / 2, nameY - 1, font(18, 700), GOLD_MAIN, 'center');
            nameEnd += 14 + bw;
        }

        text(c, row.value, POSTER_W - POSTER_PAD, nameY, font(28, 900), goldFill(ctx, nameY - 26, 30), 'right');

        // 有条形时：名字 → 条形 → 小字，三者垂直不重叠（小字压在条上会糊）
        const barY = row.sub ? y + 74 : y + 50;
        if (row.sub) {
            text(c, row.sub, POSTER_PAD, y + 56, font(19, 400), withAlpha(TEXT, 0.46));
        }

        if (typeof row.ratio === 'number' && row.ratio > 0) {
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
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                ctx.fill();

                const ratio = maxRatio > 0 ? Math.max(0, Math.min(1, row.ratio / maxRatio)) : 0;
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
                    g.addColorStop(0, withAlpha(CYAN, 0.55));
                    g.addColorStop(1, withAlpha(GOLD_MAIN, 0.85));
                    ctx.fillStyle = g;
                    ctx.fill();
                }
            }
        }
        y += ROW_H + (row.sub ? 8 : 0) + ROW_GAP;
    });
    return y;
}

function layoutPoster(c: PosterCtx, model: PosterModel): number {
    let y = posterHeader(
        c,
        {
            siteName: '天书万象 AI',
            kicker: model.kicker,
            dateText: model.dateText,
            url: model.siteUrl,
        },
        64,
    );

    y = heroBlock(c, model.hero, y);

    model.sections.forEach((sec) => {
        y = sectionHead(c, sec.index, sec.title, sec.hint || '', y, TEXT);
        if (sec.kind === 'cells') {
            if (sec.callout) y = calloutBlock(c, sec.callout, y);
            y = cellsBlock(c, sec.cells, y);
        }
        else if (sec.kind === 'chips') y = chipsBlock(c, sec.chips, y);
        else y = rowsBlock(c, sec.rows, y);
        y += 24;
    });

    return posterFooter(
        c,
        {
            qrDataUrl: model.qrDataUrl,
            disclaimer: model.disclaimer,
            url: model.siteUrl,
            caption: '扫码打开 · 自己试一次',
        },
        y - 24 + 24,
    );
}

export interface RenderedPoster {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    scale: number;
}

export function renderPoster(model: PosterModel): RenderedPoster {
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    if (!probeCtx) throw new Error('Canvas 2D 不可用');

    const height = Math.ceil(layoutPoster({ ctx: probeCtx, paint: false }, model));

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
    layoutPoster({ ctx, paint: true }, model);
    posterFrame(ctx, height);

    return { canvas, width: POSTER_W, height, scale };
}

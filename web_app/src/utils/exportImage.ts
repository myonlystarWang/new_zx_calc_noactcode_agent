/**
 * 导出图片（Step 10）
 *
 * `canvas.toDataURL` + `<a download>` 在微信内置浏览器 / iOS 上经常被直接吞掉，
 * 而本站的分享场景恰恰就是微信群 → 这两类环境改为「弹出图片 + 长按保存」。
 * 其余环境用 `toBlob` + `createObjectURL`，并在点击后释放 URL。
 */
export type ExportMode = 'download' | 'preview';

/**
 * 分享结果：
 *  · shared   —— 唤起系统分享面板并完成（用户取消也算走到这一步，不报错）
 *  · fallback —— 环境不支持分享，已降级为下载 / 长按保存
 */
export type ShareOutcome = 'shared' | 'cancelled' | 'fallback';

export interface ExportResult {
    mode: ExportMode;
    /** preview 模式下用于 <img src> 的 dataURL */
    dataUrl?: string;
    error?: string;
    outcome?: ShareOutcome;
}

export function isWeixin(): boolean {
    return typeof navigator !== 'undefined' && /MicroMessenger/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua)
        || (ua.includes('Macintosh') && (navigator.maxTouchPoints ?? 0) > 1);
}

/** 微信 / iOS 走长按保存 */
export function prefersPreviewSave(): boolean {
    return isWeixin() || isIOS();
}

/** Windows 非法字符剔除 + 空格转 '-'，控制长度 */
export function safeFilename(name: string): string {
    return (name || 'share')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80) || 'share';
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
    return new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        } catch {
            resolve(null);
        }
    });
}

/**
 * 导出画布：返回本次采用的模式（download / preview）。
 * preview 模式由调用方负责把 dataUrl 展示出来并提示「长按图片保存」。
 */
export async function exportCanvas(canvas: HTMLCanvasElement, filename: string): Promise<ExportResult> {
    const name = safeFilename(filename);
    const blob = await canvasToBlob(canvas);

    if (blob && !prefersPreviewSave()) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${name}.png`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // 立刻 revoke 会导致部分浏览器下载中断，延后释放
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        return { mode: 'download' };
    }

    try {
        return { mode: 'preview', dataUrl: canvas.toDataURL('image/png') };
    } catch (err) {
        return {
            mode: 'preview',
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/** 该环境能否直接调起系统分享面板（带文件） */
export function canShareFiles(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
    try {
        const probe = new File([new Uint8Array(1)], 'probe.png', { type: 'image/png' });
        return navigator.canShare({ files: [probe] });
    } catch {
        return false;
    }
}

/**
 * 一键分享：能在系统面板里直接发微信就发，不能就退回下载 / 长按保存。
 *
 * ⚠️ 必须在用户手势的**同一条调用链**里调用（`await` 本地动态 import 与 canvas 绘制没问题，
 * 但中间不要插入 `setTimeout` 之类的任务边界，否则 Safari 会判定为「非手势触发」）。
 */
export async function shareImage(
    canvas: HTMLCanvasElement,
    filename: string,
    meta?: { title?: string; text?: string },
): Promise<ExportResult> {
    const name = safeFilename(filename);

    if (canShareFiles()) {
        const blob = await canvasToBlob(canvas);
        if (blob) {
            try {
                const file = new File([blob], `${name}.png`, { type: 'image/png' });
                await navigator.share({
                    files: [file],
                    title: meta?.title || name,
                    text: meta?.text || '',
                });
                return { mode: 'preview', outcome: 'shared' };
            } catch (err) {
                // 用户主动取消 → 按成功处理，不再降级弹一次预览，否则很吵
                if (err instanceof Error && err.name === 'AbortError') {
                    return { mode: 'preview', outcome: 'cancelled' };
                }
                // NotAllowedError / TypeError：面板没起来，走降级
            }
        }
    }

    const res = await exportCanvas(canvas, filename);
    return { ...res, outcome: 'fallback' };
}

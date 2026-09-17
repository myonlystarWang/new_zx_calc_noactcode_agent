/**
 * 导出图片（Step 10）
 *
 * `canvas.toDataURL` + `<a download>` 在微信内置浏览器 / iOS 上经常被直接吞掉，
 * 而本站的分享场景恰恰就是微信群 → 这两类环境改为「弹出图片 + 长按保存」。
 * 其余环境用 `toBlob` + `createObjectURL`，并在点击后释放 URL。
 */
export type ExportMode = 'download' | 'preview';

export interface ExportResult {
    mode: ExportMode;
    /** preview 模式下用于 <img src> 的 dataURL */
    dataUrl?: string;
    error?: string;
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

/**
 * 上传前降采样：长边 ≤1600px、JPEG q0.88。
 * 目的：① 省 Workers AI 的 input token；② 提高识别率（大图被模型缩放后小字更糊）。
 * 非浏览器环境（SSR / 单测）直接原样返回，不抛错。
 */
export interface DownscaleOptions {
    maxEdge?: number;
    quality?: number;
    forceJpeg?: boolean;
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export async function downscaleDataUrl(
    dataUrl: string,
    options: DownscaleOptions = {}
): Promise<string> {
    const { maxEdge = 1600, quality = 0.88, forceJpeg = true } = options;
    if (!isBrowser || !dataUrl?.startsWith('data:image/')) return dataUrl;

    try {
        const img = await loadImage(dataUrl);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return dataUrl;

        const scale = Math.min(1, maxEdge / Math.max(w, h));
        // 尺寸已经够小、且不强制转 JPEG 时，保持原图（PNG 截图无损更利于识图）
        if (scale === 1 && !forceJpeg) return dataUrl;

        const tw = Math.round(w * scale);
        const th = Math.round(h * scale);
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) return dataUrl;
        ctx.drawImage(img, 0, 0, tw, th);

        const hasAlpha = /^data:image\/png/i.test(dataUrl);
        // PNG 截图保留 PNG（文字边缘更锐），其它转 JPEG
        const out = hasAlpha && !forceJpeg
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', quality);

        // 压缩后反而更大（极少见），保留原图
        return out.length < dataUrl.length ? out : dataUrl;
    } catch {
        return dataUrl;
    }
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

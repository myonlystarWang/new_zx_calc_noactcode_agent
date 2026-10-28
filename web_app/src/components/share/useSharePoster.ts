/**
 * 「一键分享长图」hook —— 三张模拟器卡共用。
 *
 * 点一下就出图：
 *  · 移动端 → 直接唤起系统分享面板（发微信/相册/存文件）
 *  · 桌面 / 微信内 → 自动降级为下载或预览长按保存
 * 卡片只管传一个 `build()`（把当前状态映射成 PosterModel），其余全在这里。
 *
 * `build()` 允许是 async：海报绘制模块（simPosters / PosterCard）体积不小，
 * 必须等到用户点分享那一刻再 `import()`，否则会跟着卡片一起进业务 chunk。
 */
import { useCallback, useEffect, useState } from 'react';
import type { PosterModel } from './PosterCard';
import { trackShareClick } from '../../utils/track';
import { hideSharePreview, showSharePreview } from './sharePreview';

/** 二维码固定指向线上首页（带来源参数） */
const QR_TARGET = 'https://zxai.raddishlab.com/#/?src=qr-sim';

export interface UseSharePosterResult {
    busy: boolean;
    share: (build: () => PosterModel | Promise<PosterModel>, filename: string, mode: string) => Promise<void>;
}

export function useSharePoster(): UseSharePosterResult {
    const [busy, setBusy] = useState(false);

    // 弹层是命令式的，组件卸载时兜底清掉，避免遮罩留在 body 上锁死滚动
    useEffect(() => hideSharePreview, []);

    const share = useCallback(async (build: () => PosterModel | Promise<PosterModel>, filename: string, mode: string) => {
        if (busy) return;
        setBusy(true);
        try {
            const [{ renderPoster }, exporter, kit] = await Promise.all([
                import('./PosterCard'),
                import('../../utils/exportImage'),
                import('./sharePosterKit'),
            ]);

            // 二维码失败不阻塞出图
            let qrDataUrl: string | null = null;
            try {
                const QRCode = (await import('qrcode')).default;
                qrDataUrl = await QRCode.toDataURL(QR_TARGET, {
                    margin: 1,
                    width: 480,
                    errorCorrectionLevel: 'M',
                    color: { dark: '#0a0d0c', light: '#ffffff' },
                });
                await kit.preloadQrImage(qrDataUrl);
            } catch (err) {
                console.warn('二维码生成失败，改为无码出图:', err);
            }

            // LOGO 必须先就绪，否则页头是空框
            await kit.preloadShareLogo();

            const model = await build();
            if (!model.qrDataUrl && qrDataUrl) {
                model.qrDataUrl = qrDataUrl;
            }

            const { canvas } = renderPoster(model);
            const result = await exporter.shareImage(canvas, filename, {
                title: '天书万象 AI · 诛仙3 模拟',
                text: '天书万象 AI · 诛仙3 模拟',
            });
            // 微信 / iOS 调不起系统面板 → 必须把图显示出来，否则用户以为按钮坏了
            if (result.outcome === 'fallback' && result.mode === 'preview' && result.dataUrl) {
                showSharePreview(result.dataUrl);
            }
            trackShareClick(`share-${result.outcome || 'fallback'}`, mode);
        } catch (err) {
            console.error('分享长图失败:', err);
        } finally {
            setBusy(false);
        }
    }, [busy]);

    return { busy, share };
}

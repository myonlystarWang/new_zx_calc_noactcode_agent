/**
 * 「截图 + 品牌头尾」分享 hook —— 模拟器信息卡专用。
 *
 * 点一下：截取页面里真实的卡片 DOM（所见即所得）→ 上下套品牌页头与二维码落款 →
 * 移动端唤起系统分享面板，桌面/微信内降级为下载或长按保存。
 *
 * ⚠️ 必须用动态 import：`modern-screenshot` 有 13.7KB(gz)，静态引入会进首屏包。
 */
import { useCallback, useEffect, useState } from 'react';
import { trackShareClick } from '../../utils/track';
import { hideSharePreview, showSharePreview } from './sharePreview';

/** 二维码固定指向线上首页（本地调试时也扫得到真实站点） */
const QR_TARGET = 'https://zxai.raddishlab.com/#/?src=qr-sim';

const DISCLAIMER = '本图由天书万象 AI 依据官方数据模拟生成，\n可能存在误差，请以游戏内实际为准。';

export interface DomShareOpts {
    /** 要截的节点；null 时直接忽略 */
    node: HTMLElement | null;
    kicker: string;
    /** 文件名里的内容名，如「天缘 +10」 */
    name: string;
    /** 埋点用的工具标识：tianyuan / xyc / shenji */
    mode: string;
    prefix: string;
}

export function useDomShare() {
    const [busy, setBusy] = useState(false);

    // 弹层是命令式的，组件卸载时兜底清掉，避免遮罩留在 body 上锁死滚动
    useEffect(() => hideSharePreview, []);

    const share = useCallback(async (o: DomShareOpts) => {
        if (!o.node || busy) return;
        setBusy(true);
        try {
            const [{ renderDomPoster, domPosterFilename }, exporter, kit] = await Promise.all([
                import('./domPoster'),
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

            const { canvas } = await renderDomPoster({
                node: o.node,
                kicker: o.kicker,
                dateText: kit.todayText(),
                qrDataUrl,
                disclaimer: DISCLAIMER,
            });

            const result = await exporter.shareImage(
                canvas,
                domPosterFilename(o.prefix, o.name, kit.todayText()),
                { title: '天书万象 AI · 诛仙3 模拟', text: '天书万象 AI · 诛仙3 模拟' },
            );
            // 微信 / iOS 调不起系统面板 → 必须把图显示出来，否则用户以为按钮坏了
            if (result.outcome === 'fallback' && result.mode === 'preview' && result.dataUrl) {
                showSharePreview(result.dataUrl);
            }
            trackShareClick(`share-${result.outcome || 'fallback'}`, o.mode);
        } catch (err) {
            console.error('分享长图失败:', err);
        } finally {
            setBusy(false);
        }
    }, [busy]);

    return { busy, share };
}

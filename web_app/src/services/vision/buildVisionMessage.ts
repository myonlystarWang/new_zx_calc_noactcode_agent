/**
 * 识图结果 → 会话消息。
 * 统一一个入口，避免 HomePage 首发/追问两处各写一遍（原实现重复且易漂移）。
 */
import type { CopilotMessage, VisionExtractionResult } from '../CopilotService';
import { degradedPanel, fromServerPanel } from './adapters';
import { UNSUPPORTED_HINT } from './fieldRegistry';

export function buildVisionMessage(
    diag: VisionExtractionResult,
    image: string,
    timeStr: string
): CopilotMessage {
    const id = `ast-${Date.now()}`;

    // 新协议：服务端返回结构化 panel 或明确降级
    if (diag.panel || diag.degraded) {
        const panel = diag.panel
            ? fromServerPanel(diag.panel, image, {
                provider: diag.provider ?? null,
                quality: diag.quality,
                issues: diag.issues
            })
            : degradedPanel(diag, image);

        // 不建卡的体系：给文字引导，不硬塞卡片
        const hint = UNSUPPORTED_HINT[panel.kind];
        if (hint) {
            return { id, sender: 'assistant', text: hint, time: timeStr };
        }

        return {
            id,
            sender: 'assistant',
            text: diag.rawExplanation || (panel.degraded ? '' : '已识别，请校对下面几个数值：'),
            time: timeStr,
            cardType: 'c_panel_review',
            cardData: { panel }
        };
    }

    return {
        id,
        sender: 'assistant',
        text: diag.rawExplanation || '已完成图像解析。',
        time: timeStr
    };
}

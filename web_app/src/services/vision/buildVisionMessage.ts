/**
 * 识图结果 → 会话消息。
 * 统一一个入口，避免 HomePage 首发/追问两处各写一遍（原实现重复且易漂移）。
 */
import type { CopilotMessage, VisionExtractionResult } from '../CopilotService';
import { degradedPanel, fromLegacy, fromServerPanel } from './adapters';
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

    // 旧协议兜底（仅客户端直连智谱时出现）：转成同一张卡，标 LEGACY_UNVERIFIED
    if (diag.mode === 'c_panel' && diag.cPanelData) {
        const panel = fromLegacy(diag.cPanelData, image);
        return {
            id,
            sender: 'assistant',
            text: diag.rawExplanation || '已识别，请校对下面几个数值：',
            time: timeStr,
            cardType: 'c_panel_review',
            cardData: { panel }
        };
    }

    // 轩辕策旧协议：保留原有跳转卡（Phase D 再统一）
    if (diag.mode === 'xyc' && diag.xycData) {
        return {
            id,
            sender: 'assistant',
            text: `${diag.rawExplanation}\n\n识别到【${diag.xycData.beast}】轩辕策（当前 ${diag.xycData.level} 阶）：`,
            time: timeStr,
            cardType: 'xyc_diag',
            cardData: {
                title: `${diag.xycData.beast}轩辕策`,
                route: `/tools/xyc?beast=${encodeURIComponent(diag.xycData.beast)}&lvl=${diag.xycData.level}`,
                desc: '支持四象 1~20 阶成长推算与极品毕业度评级'
            }
        };
    }

    return {
        id,
        sender: 'assistant',
        text: diag.rawExplanation || '已完成图像解析。',
        time: timeStr
    };
}

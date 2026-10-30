/**
 * 识图结果 → 会话消息。
 * 统一一个入口，避免 HomePage 首发/追问两处各写一遍（原实现重复且易漂移）。
 *
 * 埋点也在这里发：`vision_result` 只埋一次，不依赖调用方是否记得。
 */
import type { CopilotMessage, VisionExtractionResult } from '../CopilotService';
import { degradedPanel, fromServerPanel } from './adapters';
import { UNSUPPORTED_HINT, kindLabel } from './fieldRegistry';
import { trackVisionResult } from '../../utils/track';

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

        trackVisionResult(
            panel.kind,
            panel.fields.filter(f => f.status === 'ok' || f.status === 'low_confidence').length,
            panel.fields.length,
            panel.degraded,
            panel.provider
        );

        // 不建卡的体系：给文字引导，不硬塞卡片
        const hint = UNSUPPORTED_HINT[panel.kind];
        if (hint) {
            return { id, sender: 'assistant', text: hint, time: timeStr };
        }

        // 降级 + 非角色面板：绝不出「角色属性面板 / 带入计算器」卡。
        // 天缘、轩辕策这些体系的空卡没有任何可填项（名称/等级是文本字段），出了只会误导；
        // 识别到的体系用文字说清楚 —— 这正是「不支持就直说」的落点。
        if (panel.degraded && panel.kind !== 'character_panel') {
            return {
                id,
                sender: 'assistant',
                text: diag.rawExplanation || `这张图像是${kindLabel(panel.kind)}，但没读到可用的数值，暂不支持这样直接录入。请截完整面板再试。`,
                time: timeStr
            };
        }

        // 职业对不上职业表：必须在聊天里就说，不能等用户点开卡片才发现
        const classUnknown = panel.kind === 'character_panel' && panel.character?.classUnknown;
        const baseText = diag.rawExplanation || (panel.degraded ? '' : '已识别，请校对下面几个数值：');
        const text = classUnknown
            ? `${baseText}\n⚠️ 图里的职业名「${panel.character?.classRaw}」在职业表里找不到，多半是识别错了。带入计算器时职业会置空，请手动选一次职业。`
            : baseText;

        return {
            id,
            sender: 'assistant',
            text,
            time: timeStr,
            cardType: 'c_panel_review',
            cardData: { panel }
        };
    }

    trackVisionResult('no_panel', 0, 0, true, diag.provider ?? null);

    return {
        id,
        sender: 'assistant',
        text: diag.rawExplanation || '已完成图像解析。',
        time: timeStr
    };
}

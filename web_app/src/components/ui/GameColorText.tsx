import React from 'react';

export interface GameColorSegment {
    color: string;
    text: string;
}

/**
 * 解析游戏色彩控制符（如 ^11ff11、^ffcb4a、^96f5ff、^ffffff 等）
 */
export function parseGameColorSegments(rawText: string, defaultColor = '#cfd3e0'): GameColorSegment[] {
    if (!rawText) return [];
    const segments: GameColorSegment[] = [];

    // 检查首个色彩码之前是否有文本
    const firstMatch = rawText.search(/\^[0-9a-fA-F]{6}/);
    if (firstMatch > 0) {
        segments.push({ color: defaultColor, text: rawText.slice(0, firstMatch) });
    } else if (firstMatch === -1) {
        return [{ color: defaultColor, text: rawText }];
    }

    const regex = /\^([0-9a-fA-F]{6})([^^]*)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
        const hex = match[1];
        const segText = match[2];
        if (segText) {
            segments.push({ color: `#${hex}`, text: segText });
        }
    }
    return segments;
}

/**
 * 剥离色彩控制符，获取纯文本（用于检索、无障碍与统计）
 */
export function stripGameColor(rawText: string): string {
    if (!rawText) return '';
    return rawText.replace(/\^[0-9a-fA-F]{6}/g, '').replace(/\r/g, '');
}

interface GameColorTextProps {
    text: string;
    className?: string;
    defaultColor?: string;
    tag?: 'span' | 'div' | 'p';
}

/**
 * 诛仙3 原生色彩码渲染组件
 * 将游戏内的 ^RRGGBB 字符 1:1 还原为高保真高对比度荧光文字，并保留换行排版
 */
export const GameColorText: React.FC<GameColorTextProps> = ({
    text,
    className = '',
    defaultColor = '#cfd3e0',
    tag: Tag = 'span'
}) => {
    if (!text) return null;
    const segments = parseGameColorSegments(text, defaultColor);

    const content = segments.map((seg, idx) => {
        // 如果分段中包含换行，拆分为带 <br/> 的节点
        const lines = seg.text.split('\n');
        return (
            <span key={idx} style={{ color: seg.color }}>
                {lines.map((line, lIdx) => (
                    <React.Fragment key={lIdx}>
                        {line}
                        {lIdx < lines.length - 1 && <br />}
                    </React.Fragment>
                ))}
            </span>
        );
    });

    return <Tag className={`game-color-text font-sans ${className}`}>{content}</Tag>;
};

/**
 * 游戏客户端原生 Tooltip 视效包装容器
 */
export const GameTooltipShell: React.FC<{
    children: React.ReactNode;
    title?: string;
    titleColor?: string;
    className?: string;
}> = ({ children, title, titleColor = '#58a6ff', className = '' }) => {
    return (
        <div
            className={`rounded-lg p-3 text-xs leading-relaxed border border-[#30363d] bg-[#0d1117]/95 shadow-xl backdrop-blur-md ${className}`}
            style={{
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 0 16px rgba(10, 25, 45, 0.4)',
            }}
        >
            {title && (
                <div
                    className="text-sm font-bold pb-1.5 mb-2 border-b border-[#21262d] flex items-center justify-between"
                    style={{ color: titleColor }}
                >
                    <span>{title}</span>
                </div>
            )}
            <div className="space-y-1.5">{children}</div>
        </div>
    );
};

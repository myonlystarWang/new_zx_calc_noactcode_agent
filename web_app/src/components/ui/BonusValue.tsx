import React from 'react';

/**
 * 技能附加属性「值」的统一渲染。
 *
 * 值里既可能是纯数字（`+240%`、`0.0783`），也可能夹中文单位（`104/114/124/124/124/124%（6段）`、`常驻·无需佩戴`）。
 * 单一字体族都会出问题：
 * - 全用 mono：中文落进等宽栈（栈内无中文字形）→ fallback 出另一套中文字形，与相邻 label 不搭；
 * - 全用 sans：数字失去等宽字形，与站内其它数字观感割裂。
 *
 * 故按**片段**分流：数字/符号片段永远 `font-mono`，中文片段（含中文括号）永远 `font-sans`。
 * 规则固定 → 同一张卡片内、以及不同卡片之间，数字都是同一套字形。
 */
const SEGMENT = /（[^）]*）|[\u4e00-\u9fa5·]+|[0-9A-Za-z+\-./%×]+|\s+|[\s\S]/g;
const HAS_CJK = /[\u4e00-\u9fa5·（）]/;

export const BonusValue: React.FC<{ value?: string | null }> = ({ value }) => {
    if (!value) return null;
    const parts = value.match(SEGMENT) ?? [value];
    return (
        <>
            {parts.map((part, i) => (
                <span key={i} className={HAS_CJK.test(part) ? 'font-sans' : 'font-mono'}>
                    {part}
                </span>
            ))}
        </>
    );
};

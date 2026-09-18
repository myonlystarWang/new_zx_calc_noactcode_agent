/**
 * 技能速查卡片 —— 全部排版规格的**唯一真相**。
 *
 * 卡片里有四类内容，各自只有一套样式，改这一处 = 全站所有卡片（输出 / 造化·心法被动 / 四代被动）一起变：
 *   1. 头部胶囊（冷却/施法/充能/常驻）—— 见 SkillsView 头部，独立于属性区
 *   2. 属性矩阵（ATTR_*）：label 11px + 值 12px 两档
 *   3. 属性矩阵里的「跨整行行」（ATTR_*_STACK）：造化/心法的逐目标技能增量 —— 属描述性质，与描述区同档 11px
 *   4. 描述区（NOTE_*）：反向增益行 + 机制说明段 —— 11px，低于属性值一档
 *
 * 字号层级（全卡只有两档，不要再引入第三档）：
 *   - 主值（属性矩阵的值）：12px
 *   - 其余一切文字（label、增量明细、反向增益、机制说明）：11px
 *
 * ⚠️ 使用约定：**不要在同一元素上叠加两个同属性工具类**（如 `ATTR_VALUE` + `ATTR_VALUE_STACK`）。
 *    Tailwind 里 `text-xs` 与 `text-[11px]` 谁生效取决于 CSS 生成顺序，不由 className 字符串顺序决定 ——
 *    本次踩过：两者并存导致「增量明细」仍按 12px 渲染，断言才发现。两档样式一律用**互斥分支**选择。
 */
export const ATTR_GRID = 'grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs';

export const ATTR_CELL = 'px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 min-w-0';
export const ATTR_CELL_INLINE = 'flex items-center justify-between gap-1.5';
export const ATTR_CELL_STACK = 'col-span-2 sm:col-span-3 flex flex-col items-start gap-1';
export const ATTR_CELL_BADGE = 'flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800/70';

export const ATTR_LABEL = 'text-slate-400 text-[11px] mr-1.5 whitespace-nowrap shrink-0';
export const ATTR_LABEL_STACK = 'text-slate-400 text-[11px] mr-1.5 whitespace-normal break-words w-full';
export const ATTR_VALUE = 'font-bold text-xs min-w-0 text-right break-words';
export const ATTR_VALUE_STACK = 'font-bold text-[11px] text-cyan-300 whitespace-normal break-words leading-snug w-full font-sans';

/** 描述区：反向增益（受《…》…）与机制说明段 */
export const NOTE_BLOCK = 'pt-2 border-t border-slate-800/40 flex flex-col gap-1.5';
export const NOTE_ROW = 'flex items-start justify-between gap-2';
export const NOTE_LABEL = 'text-slate-400 text-[11px] shrink-0 leading-snug';
export const NOTE_TEXT = 'text-[11px] leading-snug min-w-0 break-words';
export const NOTE_LINK = 'text-cyan-300 hover:text-cyan-200 font-bold text-left';
export const NOTE_PARAGRAPH = 'text-[11px] leading-relaxed text-slate-300/85 px-1 pt-1 border-t border-slate-800/60';

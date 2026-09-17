import clsx from 'clsx';

/**
 * 站内「切换胶囊 / 筛选 chip」统一规格（2026-09-17）
 *
 * 背景：资料库一级子页签、属性分类、职业技能、职业阵营、副本分类、副本难度
 * 六行胶囊此前各写各的 —— padding 有 `px-3.5 py-2` / `px-3 py-1.5` / `px-3 py-1` 三种，
 * 圆角 xl / lg 混用，字号 `text-xs sm:text-sm` / `text-xs md:text-sm` / `text-xs` 三种，
 * 图标 16px 与 14px 混用，实际高度从 26px 到 38px 不等。
 *
 * **本文件是唯一规格来源**：新增同类行一律 import 这里的常量，不要手写类名。
 *
 * 统一后规格：固定高 h-8(32px) · px-3 · rounded-lg · text-xs · font-bold · leading-none ·
 *            控件内 gap-1.5 · 图标由 `[&>svg]` 压到 14px（图标自带 w-4/w-3.5 都会被覆盖）。
 * 容器（换行 or 横滚）保持各行原有策略，只统一 gap-1.5，避免改变移动端换行行为。
 */

/** 行容器的公共部分：各行自行追加 `flex-wrap` 或 `overflow-x-auto no-scrollbar pb-1` */
export const CHIP_ROW_BASE = 'flex items-center gap-1.5';

/** 胶囊本体（尺寸 / 字号 / 行高 / 图标尺寸的唯一来源） */
export const CHIP =
    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold leading-none whitespace-nowrap shrink-0 transition-all [&>svg]:w-3.5 [&>svg]:h-3.5';

/** 选中态 */
export const CHIP_ON = 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]';

/** 未选中态 */
export const CHIP_OFF = 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-850 hover:text-slate-200';

/** 完整胶囊类名 */
export const chipCls = (active: boolean): string => clsx(CHIP, active ? CHIP_ON : CHIP_OFF);

/**
 * 胶囊内的计数徽章。
 * ⚠️ 原实现写的是 `py-0.2` —— **Tailwind 默认间距刻度里没有 0.2**，该类不会被生成，
 * 徽章实际没有纵向内边距。这里统一 `py-[3px]` + `leading-none` 兜住。
 */
export const CHIP_COUNT_BASE = 'font-mono text-[10px] leading-none px-1.5 py-[3px] rounded-full border shrink-0';
export const CHIP_COUNT_ON = 'bg-cyan-500/30 text-cyan-200 border-cyan-500/40';
export const CHIP_COUNT_OFF = 'bg-slate-800 text-slate-400 border-slate-700/60';
export const chipCountCls = (active: boolean): string =>
    clsx(CHIP_COUNT_BASE, active ? CHIP_COUNT_ON : CHIP_COUNT_OFF);

/** 行首说明文字（如「属性分类:」），保证与胶囊同一视觉节奏 */
export const CHIP_ROW_LABEL = 'text-xs font-bold text-slate-400 mr-1 flex-shrink-0';

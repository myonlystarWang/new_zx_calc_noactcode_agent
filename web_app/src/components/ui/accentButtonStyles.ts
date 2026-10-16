/**
 * 顶栏控制按钮与标签统一规范（按照【+号hover】统一暗调科技感风格）
 *
 * 规范：
 * - 平态：微透暗底 bg-white/5 · 灰字 text-slate-400 · 微边框 border-white/5
 * - Hover态：背景提亮 hover:bg-white/10 · 亮青 hover:text-cyan-300 · 边框 hover:border-cyan-500/30
 * - 激活/指示态：text-cyan-300 亮青高亮
 */

/** 顶栏交互按钮（如【返回主页】） */
export const ACCENT_BUTTON =
    'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg ' +
    'text-xs font-semibold leading-none whitespace-nowrap shrink-0 cursor-pointer select-none ' +
    'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 ' +
    'border border-white/5 hover:border-cyan-500/30 ' +
    'transition-all duration-200 active:scale-95 group';

/** 顶栏交互按钮内的图标 */
export const ACCENT_BUTTON_ICON = 'w-3.5 h-3.5 shrink-0 text-slate-400 group-hover:text-cyan-300 transition-colors';

/** 顶栏当前工作区功能标识徽章（如【战力计算器】、【副本训练场】） */
export const WORKSPACE_TAG =
    'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg ' +
    'text-xs font-semibold leading-none whitespace-nowrap shrink-0 select-none ' +
    'bg-white/5 text-cyan-300 border border-white/10 shadow-sm';

/** 顶栏功能标识内的图标 */
export const WORKSPACE_TAG_ICON = 'w-3.5 h-3.5 shrink-0 text-cyan-300';

/** 顶栏控制图标按钮（如【放大/还原】、【关闭】） */
export const WORKSPACE_ICON_BUTTON =
    'p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 ' +
    'border border-white/5 hover:border-cyan-500/30 transition-all duration-200 cursor-pointer';
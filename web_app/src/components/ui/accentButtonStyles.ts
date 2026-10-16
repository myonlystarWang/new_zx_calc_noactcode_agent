/**
 * 顶栏控制按钮与标签统一规范（精致暗调微透科技风）
 *
 * 设计原则：
 * 1. 结构感与质感：采用带有深度感的暗色磨砂底 (bg-slate-900/85)，配合细微青色透光边框，杜绝“平淡深灰像禁用态”的问题。
 * 2. 视觉锚点：交互性操作以科技亮青 (text-cyan-400) 为主提示，文字保持高清晰度的明亮冷灰白 (text-slate-200)。
 * 3. 悬浮微光：hover 时呈现优雅的青色光晕 (hover:border-cyan-500/60 hover:bg-cyan-500/10)。
 */

/** 顶栏交互主按钮（如对话顶栏【返回主页】） */
export const ACCENT_BUTTON =
    'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg ' +
    'text-xs font-semibold leading-none whitespace-nowrap shrink-0 cursor-pointer select-none ' +
    'bg-slate-900/85 hover:bg-cyan-500/10 text-slate-200 hover:text-white ' +
    'border border-cyan-500/30 hover:border-cyan-500/60 shadow-sm ' +
    'hover:shadow-[0_0_12px_rgba(6,182,212,0.2)] ' +
    'transition-all duration-200 active:scale-95 group';

/** 顶栏交互主按钮内的图标：默认亮青提示，悬浮时更亮并带微位移 */
export const ACCENT_BUTTON_ICON = 'w-3.5 h-3.5 shrink-0 text-cyan-400 group-hover:text-cyan-300 group-hover:-translate-x-0.5 transition-all';

/** 顶栏当前工作区功能标识徽章（如【战力计算器】、【副本训练场】） */
export const WORKSPACE_TAG =
    'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg ' +
    'text-xs font-bold leading-none whitespace-nowrap shrink-0 select-none ' +
    'bg-cyan-950/40 text-cyan-300 border border-cyan-500/35 ' +
    'shadow-[0_0_10px_rgba(6,182,212,0.12)]';

/** 顶栏功能标识内的图标 */
export const WORKSPACE_TAG_ICON = 'w-3.5 h-3.5 shrink-0 text-cyan-400';

/** 顶栏全屏/还原按钮（科技青悬浮微光） */
export const WORKSPACE_MAXIMIZE_BUTTON =
    'p-1.5 rounded-lg bg-slate-900/80 hover:bg-cyan-500/15 text-slate-300 hover:text-cyan-300 ' +
    'border border-slate-700/60 hover:border-cyan-500/40 hover:shadow-[0_0_10px_rgba(6,182,212,0.15)] ' +
    'transition-all duration-200 cursor-pointer';

/** 顶栏关闭按钮（警示玫瑰红悬浮微光） */
export const WORKSPACE_CLOSE_BUTTON =
    'p-1.5 rounded-lg bg-slate-900/80 hover:bg-rose-500/15 text-slate-300 hover:text-rose-300 ' +
    'border border-slate-700/60 hover:border-rose-500/40 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] ' +
    'transition-all duration-200 cursor-pointer';
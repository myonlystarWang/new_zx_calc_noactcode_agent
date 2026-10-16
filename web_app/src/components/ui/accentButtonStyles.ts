/**
 * 站内「主题色按钮」统一规格（2026-10-16）
 *
 * 背景：对话顶栏的【返回主页】与右侧工作区顶栏的【功能名】（战力计算器 / 副本训练场 / …）
 * 此前都是中性灰（`bg-white/5` / `bg-slate-800/50`），与站内唯一强调色（青→蓝渐变）
 * 脱节，视觉上像"禁用态"。参考样板＝聊天输入框的发送按钮。
 *
 * **本文件是唯一规格来源**：新增同类主题按钮一律 import 这里的常量，不要手写类名。
 *
 * 统一后规格：圆角 lg · text-xs · font-bold · 字色 slate-950（深字压亮底）
 *            青→蓝横向渐变 · cyan-500/30 外发光 · hover 提亮 · active 轻微缩放
 */

/** 主题色按钮本体（唯一来源） */
export const ACCENT_BUTTON =
    'inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg ' +
    'text-xs font-bold leading-none whitespace-nowrap shrink-0 cursor-pointer select-none ' +
    'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 ' +
    'text-slate-950 shadow-md shadow-cyan-500/30 ' +
    'transition-all active:scale-95';

/** 主题色按钮内的图标：跟随字色，不再写死灰/青 */
export const ACCENT_BUTTON_ICON = 'w-3.5 h-3.5 shrink-0';
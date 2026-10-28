/**
 * 日期小工具（2026-10-28）
 *
 * 单独成文件的原因：`todayText` 原本住在 `components/share/sharePosterKit.ts`，
 * 而 `YunlingForgeCard` 只为拿一个日期串就静态 import 了那个海报骨架模块，
 * 导致整套 Canvas 绘制代码被静态链入主包。轻量函数必须与绘制模块解耦。
 */

/** `YYYY-MM-DD` */
export function todayText(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 更新日志「已读版本」记录（Step 11.4）
 *
 * 规则（用户拍板）：**进入 #/changelog 页面即视为已读**，不仅限于点击 Header 版本号。
 * 只存版本号字符串，不存时间戳；版本号不同即视为有未读更新（含降级，实现简单、无歧义）。
 */
import { LATEST_CHANGELOG_VERSION } from '../data/changelog';

const SEEN_KEY = 'zx_changelog_seen_version';

/**
 * 当前构建版本号：由 vite.config.ts 的 `define` 注入，来源是 web_app/package.json 的 version。
 * 兜底（未经过 Vite 构建的环境，如单测/裸 TS 运行）取 changelog 首条版本。
 */
export const CURRENT_VERSION: string =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : LATEST_CHANGELOG_VERSION;

/** 读取上次已读版本（无记录 / localStorage 不可用 → null） */
export function getSeenVersion(): string | null {
    try {
        return localStorage.getItem(SEEN_KEY);
    } catch {
        return null;
    }
}

/** 标记当前版本为已读 */
export function markChangelogSeen(version: string = CURRENT_VERSION): void {
    try {
        localStorage.setItem(SEEN_KEY, version);
    } catch {
        /* 隐私模式 / 存储配额满：静默失败，不影响浏览 */
    }
}

/** 是否存在未读更新（首次访问为 true） */
export function hasUnseenChangelog(): boolean {
    return getSeenVersion() !== CURRENT_VERSION;
}

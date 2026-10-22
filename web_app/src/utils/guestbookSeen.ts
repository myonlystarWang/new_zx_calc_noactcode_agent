/**
 * 意见反馈「新留言」标记（与 changelogSeen 同构）
 *
 * 无用户体系：所有访客看同一份留言板，所谓「新」只能相对本机上次浏览。
 *
 * 判定：云端留言指纹（非置顶帖条数 : 回复总数）与本机上次已读指纹不同即视为有新内容。
 *  - 新增留言 → 条数 +1
 *  - 新增回复 → 回复数 +1（有人回你比有人发帖更值得提醒）
 *  - 点赞不参与（高频且与阅读无关）
 *  - 置顶公告 pin-1 不参与（永远在第一屏，不该触发角标）
 *
 * 规则（与更新动态一致）：**进入 #/feedback 即视为已读**。
 * 首次访问无记录 → 静默建立基线，不亮角标（避免新访客看到莫名的红标）。
 */

export interface GuestbookStampSource {
    id?: string;
    replies?: unknown[];
}

const SEEN_KEY = 'zx_guestbook_seen_stamp';
const CACHE_KEY = 'zx_guestbook_stamp_cache_v1';
const SEEN_EVENT = 'guestbook_seen';

export const GUESTBOOK_SEEN_EVENT = SEEN_EVENT;

/** 留言指纹：帖子条数与回复总数，任何一人新增都会改变它 */
export function computeGuestbookStamp(posts: GuestbookStampSource[] | null | undefined): string {
    if (!Array.isArray(posts) || posts.length === 0) return '';
    const userPosts = posts.filter(p => p && p.id !== 'pin-1');
    const replies = userPosts.reduce((n, p) => n + (Array.isArray(p.replies) ? p.replies.length : 0), 0);
    return `${userPosts.length}:${replies}`;
}

/** 读取本机上次已读指纹（无记录 / localStorage 不可用 → null） */
export function getSeenStamp(): string | null {
    try {
        return localStorage.getItem(SEEN_KEY);
    } catch {
        return null;
    }
}

/** 标记当前留言状态为已读，并同步刷新拉取缓存 */
export function markGuestbookSeen(stamp: string): void {
    if (!stamp) return;
    try {
        localStorage.setItem(SEEN_KEY, stamp);
        writeStampCache(stamp);
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(SEEN_EVENT));
        }
    } catch {
        /* 隐私模式 / 存储配额满：静默失败，不影响浏览 */
    }
}

/** 是否存在未读留言（首次访问返回 false 并建立基线） */
export function hasUnseenGuestbook(stamp: string | null | undefined): boolean {
    if (!stamp) return false;
    const seen = getSeenStamp();
    if (seen === null) {
        markGuestbookSeen(stamp);
        return false;
    }
    return seen !== stamp;
}

/** 近期是否拉过云端（避免每次路由切换都读一次 KV） */
export function isStampCacheFresh(ttlMs: number): boolean {
    const cache = readStampCache();
    return !!cache && Date.now() - cache.ts < ttlMs;
}

export function readStampCache(): { stamp: string; ts: number } | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.stamp === 'string' && typeof parsed.ts === 'number') {
            return parsed;
        }
    } catch {
        /* ignore */
    }
    return null;
}

export function writeStampCache(stamp: string): void {
    if (!stamp) return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ stamp, ts: Date.now() }));
    } catch {
        /* ignore */
    }
}

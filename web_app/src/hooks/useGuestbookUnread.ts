import { useEffect, useState } from 'react';
import {
    computeGuestbookStamp,
    hasUnseenGuestbook,
    isStampCacheFresh,
    readStampCache,
    GUESTBOOK_SEEN_EVENT
} from '../utils/guestbookSeen';

/** 云端留言拉取的最小间隔：10 分钟内不重复读 KV */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface GuestbookApiResponse {
    success?: boolean;
    posts?: Array<{ id?: string; replies?: unknown[] }>;
}

/**
 * 意见反馈入口的「新留言」标记。
 *
 * - 已在反馈页 → 恒为 false（进页面即已读，与更新动态规则一致）
 * - 其余情况：首屏空闲后静默拉一次全量留言（命中 10 分钟缓存则跳过），比对指纹
 * - 请求失败（离线 / 本地 dev 无 functions）静默失败，不亮角标
 *
 * @param onFeedbackPage 当前是否停留在 #/feedback
 */
export function useGuestbookUnread(onFeedbackPage: boolean): boolean {
    const [pending, setPending] = useState<boolean>(false);

    // 进页面即清除
    useEffect(() => {
        if (onFeedbackPage) setPending(false);
    }, [onFeedbackPage]);

    // 页面内标记已读时同步收起（含其他标签页写入）
    useEffect(() => {
        const handleSeen = () => setPending(false);
        window.addEventListener(GUESTBOOK_SEEN_EVENT, handleSeen);
        return () => window.removeEventListener(GUESTBOOK_SEEN_EVENT, handleSeen);
    }, []);

    // 非反馈页：按缓存 + 云端指纹判定
    useEffect(() => {
        if (onFeedbackPage) return;

        const cache = readStampCache();
        if (cache) {
            setPending(hasUnseenGuestbook(cache.stamp));
            if (isStampCacheFresh(CACHE_TTL_MS)) return;
        }

        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch('/api/guestbook');
                if (!res.ok) return;
                const data = (await res.json()) as GuestbookApiResponse;
                if (!data?.success || !Array.isArray(data.posts)) return;
                const stamp = computeGuestbookStamp(data.posts);
                if (!stamp || cancelled) return;
                setPending(hasUnseenGuestbook(stamp));
            } catch {
                /* 离线 / dev 环境无 Functions：静默 */
            }
        };

        // 首屏空闲后再发，不抢渲染
        const ric = (window as unknown as {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        }).requestIdleCallback;
        let handle = 0;
        if (typeof ric === 'function') {
            handle = ric(load, { timeout: 2500 });
        } else {
            handle = window.setTimeout(load, 1200);
        }

        return () => {
            cancelled = true;
            const cic = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
            if (typeof ric === 'function' && typeof cic === 'function') {
                cic(handle);
            } else {
                clearTimeout(handle);
            }
        };
    }, [onFeedbackPage]);

    return pending;
}

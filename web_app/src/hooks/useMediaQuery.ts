import { useEffect, useState } from 'react';

/** 订阅一条媒体查询；首帧即用 matchMedia 求值，不做 SSR，无闪烁。 */
export function useMediaQuery(query: string): boolean {
    const [match, setMatch] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = () => setMatch(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return match;
}

/**
 * 手机判定：竖屏 <768，或横屏（高 <500 且主指针为粗）。
 * 横屏手机 844×390 会落进 md 区间，只按宽度会被误判成平板。
 */
export const MOBILE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);

/** 横屏手机 / 极矮视口：抽屉直接铺满，不做 92dvh */
export const useIsShortViewport = () =>
    useMediaQuery('(max-height: 500px) and (pointer: coarse)');

import { useEffect, useState } from 'react';

/**
 * 键盘遮挡高度（px）。
 *
 * iOS Safari 弹键盘时只缩「可视视口」，`100dvh` 不变，于是底部输入框会被键盘盖住。
 * 这里用 visualViewport 差值算出键盘高度，交给外层容器做 padding-bottom，
 * 把内容顶到键盘之上。
 *
 * Android 弹键盘会同时缩布局视口（innerHeight 变小），差值自然接近 0，不会重复顶。
 */
export function useKeyboardInset(): number {
    const [inset, setInset] = useState(0);

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        const update = () => {
            // 键盘高度 = 布局视口高 - 可视视口高 - 页面被顶起的偏移
            const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
            // 小于 80px 视为地址栏收缩等噪声，忽略
            setInset(next > 80 ? Math.round(next) : 0);
        };

        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, []);

    return inset;
}

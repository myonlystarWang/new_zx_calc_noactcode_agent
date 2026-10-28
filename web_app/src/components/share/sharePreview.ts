/**
 * 分享长图「长按保存」预览层（2026-10-28）
 *
 * 为什么是命令式而不是 React 组件：微信 / iOS 里 `navigator.canShare` 不支持带文件，
 * `shareImage` 会降级成 `mode: 'preview'` 并把 dataUrl 返回给调用方。四个模拟器卡片
 * （新天缘 / 轩辕策 / 神机 / 蕴灵）都要弹这个层，做成组件就得在四份 JSX 里各插一处，
 * 而它是纯展示、无状态、生命周期只有「显示 → 关闭」，挂到 body 最省事且不会漏。
 *
 * 样式全用内联，不依赖 Tailwind 是否扫到这个文件。
 */

const Z = 2147483000;

let current: HTMLDivElement | null = null;

function close(): void {
    if (!current) return;
    current.remove();
    current = null;
    document.removeEventListener('keydown', onKey);
    document.body.style.removeProperty('overflow');
}

function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') close();
}

/**
 * 弹出全屏预览，提示「长按保存」。
 * 重复调用会先关掉上一张，避免叠层。
 */
export function showSharePreview(dataUrl: string, hint = '长按图片：选择「发送给朋友」直达微信，或「存储图像」到相册'): void {
    if (typeof document === 'undefined') return;
    close();

    const mask = document.createElement('div');
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-label', '分享长图预览');
    mask.style.cssText = [
        'position:fixed',
        'inset:0',
        `z-index:${Z}`,
        'background:rgba(0,0,0,0.88)',
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'padding:16px',
        'box-sizing:border-box',
        'overflow-y:auto',
        '-webkit-overflow-scrolling:touch',
    ].join(';');

    const wrap = document.createElement('div');
    wrap.style.cssText = [
        'display:flex',
        'flex-direction:column',
        'align-items:center',
        'gap:14px',
        'margin:auto',
        'max-width:100%',
    ].join(';');

    const img = document.createElement('img');
    img.src = dataUrl;
    img.alt = '分享长图（长按保存）';
    img.style.cssText = 'max-height:74vh;max-width:100%;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.6);display:block;';

    const tip = document.createElement('p');
    tip.textContent = hint;
    tip.style.cssText = 'margin:0;color:#cbd5e1;font-size:12px;line-height:1.5;text-align:center;';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '关闭';
    btn.style.cssText = [
        'padding:7px 22px',
        'border-radius:999px',
        'border:1px solid rgba(229,190,115,0.45)',
        'background:rgba(20,26,38,0.9)',
        'color:#e8eee9',
        'font-size:13px',
        'cursor:pointer',
    ].join(';');
    btn.addEventListener('click', close);

    // 点遮罩空白处关闭；点图片/按钮容器空白处关闭
    mask.addEventListener('click', (e) => {
        if (e.target === mask || e.target === wrap) close();
    });

    wrap.append(img, tip, btn);
    mask.append(wrap);
    document.body.appendChild(mask);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    current = mask;
}

/** 供调用方在组件卸载时清场 */
export function hideSharePreview(): void {
    close();
}

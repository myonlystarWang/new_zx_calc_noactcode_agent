import { useCallback, useEffect, useRef, useState } from 'react';

/** 当前视口下左栏最小宽度（与原固定断点一致：460 / xl 480 / 2xl 500） */
const getMinWidth = () => {
  if (typeof window === 'undefined') return 460;
  if (window.innerWidth >= 1536) return 500;
  if (window.innerWidth >= 1280) return 480;
  return 460;
};

/**
 * 双轨分屏左栏宽度拖拽 hook。
 * 左栏不得小于原固定宽度（460/480/500 按断点），右侧始终保留至少 520px。
 */
export function useSplitDrag(initialWidth = 500, maxWidth = 760) {
  const [leftWidth, setLeftWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragState = useRef<{ startX: number; startWidth: number } | null>(null);

  const onSplitterPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragState.current = { startX: e.clientX, startWidth: leftWidth };
      setIsResizing(true);
    },
    [leftWidth],
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: PointerEvent) => {
      const s = dragState.current;
      if (!s) return;
      const min = getMinWidth();
      const max = Math.max(min, Math.min(maxWidth, window.innerWidth - 520));
      const next = Math.max(min, Math.min(max, s.startWidth + (e.clientX - s.startX)));
      setLeftWidth(next);
    };
    const onUp = () => setIsResizing(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, maxWidth]);

  // 视口变化：钳制到 [当前断点最小宽, innerWidth-520]
  useEffect(() => {
    const onResize = () => {
      setLeftWidth((w) => {
        const min = getMinWidth();
        const max = Math.max(min, window.innerWidth - 520);
        return Math.max(min, Math.min(max, w));
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { leftWidth, isResizing, onSplitterPointerDown };
}

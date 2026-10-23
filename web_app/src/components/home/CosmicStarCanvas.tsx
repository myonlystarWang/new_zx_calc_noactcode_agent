import React, { useEffect, useRef } from 'react';

interface CosmicStarCanvasProps {
  /**
   * 文字净空区：传入元素的 ref，该矩形范围内的星点会被淡出（边缘羽化），
   * 避免星点穿透标题/副标题影响可读性。
   */
  avoidRef?: React.RefObject<HTMLElement | null>;
}

/** 文字区边缘羽化半径（px）：由全透明平滑过渡到正常亮度 */
const AVOID_FEATHER = 88;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

interface AvoidZone {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const CosmicStarCanvas: React.FC<CosmicStarCanvasProps> = ({ avoidRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avoidRefLatest = useRef(avoidRef);
  avoidRefLatest.current = avoidRef;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // 缓存文字净空区（canvas 坐标系），避免每帧读取布局
    let zone: AvoidZone | null = null;
    let zoneScaleX = 1;
    let zoneScaleY = 1;

    const measureAvoid = () => {
      const el = avoidRefLatest.current?.current;
      const canvasRect = canvas.getBoundingClientRect();
      if (!el || canvasRect.width === 0 || canvasRect.height === 0) {
        zone = null;
        return;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        zone = null;
        return;
      }
      zoneScaleX = canvas.width / canvasRect.width;
      zoneScaleY = canvas.height / canvasRect.height;
      zone = {
        left: (rect.left - canvasRect.left) * zoneScaleX,
        right: (rect.right - canvasRect.left) * zoneScaleX,
        top: (rect.top - canvasRect.top) * zoneScaleY,
        bottom: (rect.bottom - canvasRect.top) * zoneScaleY,
      };
    };

    const resize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      measureAvoid();
    };
    window.addEventListener('resize', resize);

    measureAvoid();
    // 字体异步加载会改变标题块高度，加载完成后再校准一次
    document.fonts?.ready?.then(measureAvoid).catch(() => undefined);
    const lateTimer = window.setTimeout(measureAvoid, 600);
    let observer: ResizeObserver | null = null;
    const observeTarget = avoidRefLatest.current?.current;
    if (observeTarget && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measureAvoid());
      observer.observe(observeTarget);
    }

    interface Star {
      x: number;
      y: number;
      r: number;
      alpha: number;
      speed: number;
    }

    const stars: Star[] = [];
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.3,
        alpha: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.02 + 0.005,
      });
    }

    // 文字净空区透明度系数：区内 0，羽化带内平滑过渡，区外 1
    const avoidFactor = (x: number, y: number) => {
      if (!zone) return 1;
      const dx = Math.max(zone.left - x, 0, x - zone.right);
      const dy = Math.max(zone.top - y, 0, y - zone.bottom);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= 0) return 0;
      return smoothstep(0, AVOID_FEATHER, dist);
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        s.y -= s.speed;
        if (s.y < 0) {
          s.y = height;
          s.x = Math.random() * width;
        }
        const factor = avoidFactor(s.x, s.y);
        const alpha = s.alpha * factor;
        if (alpha < 0.02) continue;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${alpha})`;
        ctx.shadowBlur = s.r * 3;
        ctx.shadowColor = '#38bdf8';
        ctx.fill();
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(lateTimer);
      observer?.disconnect();
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};

/**
 * 轻量埋点客户端
 *
 * 设计约束（详见 doc/埋点系统规划_20261026.md）：
 *  · 只发白名单事件，单条 < 1KB；后端再校验一次
 *  · sendBeacon 优先，失败静默——埋点绝不能影响业务
 *  · 不存 IP、不存 UA 原文、不存完整输入、不用 Cookie（因此无需隐私弹窗）
 *  · sessionId 仅存 sessionStorage，关标签页即失效
 */

const SESSION_KEY = 'zx_sid';

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export type TrackPayload = Record<string, string | number | boolean>;

/** 上报一个事件。任何异常都在内部吞掉。 */
export function track(event: string, data: TrackPayload = {}): void {
  if (typeof navigator === 'undefined' || !event) return;
  try {
    const body = JSON.stringify({
      e: event,
      s: getSessionId(),
      d: { ...data, path: (location.hash || location.pathname || '/').slice(0, 24) },
    });
    if (body.length > 900) return;

    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/track', {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  } catch {
    /* 静默 */
  }
}

export type FontHealthStatus = 'ok' | 'partial' | 'fail' | 'no_css' | 'pending';

/**
 * 字体健康度：判断 Google Fonts 的 woff2 到底有没有下来。
 *
 * 为什么不用 `document.fonts.check()`——实测（2026-10-26）它在字体未注册时也返回 true，
 * 线上 `media="print"` 的异步加载下完全失效。
 * 真正可靠的信号是 **FontFace.status**：
 *   正常网络        → 部分 face 为 loaded，0 个 error
 *   gstatic 不可达  → 大量 face 为 error（国内 DNS 污染时的典型表现）
 *   googleapis 也不可达 → 一个 face 都没注册（no_css）
 *
 * 采样用轮询而不是固定延迟：CJK 字体分片多，弱网下 4.5s 可能还没加载完，
 * 固定延迟会把「还在加载」误判成异常。首次拿到确定结论即停，最多等 8s。
 */
export function reportFontHealth(): void {
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  let done = false;
  const maxRounds = 8;

  const finish = (status: FontHealthStatus, m: { total: number; loaded: number; error: number }) => {
    if (done) return;
    done = true;
    track('font_check', {
      status,
      loaded: m.loaded,
      error: m.error,
      total: m.total,
      vw: window.innerWidth,
      et: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType || '',
    });
  };

  const readAll = () => {
    const faces = Array.from(document.fonts).filter(f => /Noto (Sans|Serif) SC/.test(f.family));
    return {
      total: faces.length,
      loaded: faces.filter(f => f.status === 'loaded').length,
      error: faces.filter(f => f.status === 'error').length,
    };
  };

  const tick = (round: number) => {
    if (done) return;
    const m = readAll();

    if (m.total === 0) {
      // 连 @font-face 都没注册：要么 CSS 没下来（no_css），要么还没解析完
      if (round >= 2) finish('no_css', m);
    } else if (m.error > 0 && m.loaded === 0) {
      finish('fail', m);                       // 典型国内直连：全部分片 404
    } else if (m.loaded > 0 && m.error > 0) {
      finish('partial', m);                    // 部分分片失败
    } else if (m.loaded > 0) {
      finish('ok', m);                         // 已成功加载，剩余分片未命中属正常
    }

    if (!done) {
      if (round >= maxRounds) finish('pending', m);   // 8s 仍在加载：慢网/墙内半通
      else window.setTimeout(() => tick(round + 1), 1000);
    }
  };

  const start = () => window.setTimeout(() => tick(0), 2000);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

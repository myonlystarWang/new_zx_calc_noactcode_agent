/**
 * 轻量埋点客户端
 *
 * 设计约束（详见 doc/埋点系统规划_20261026.md v4）：
 *  · 只发白名单事件，单条 < 1KB；后端再校验一次
 *  · sendBeacon 优先，失败静默——埋点绝不能影响业务
 *  · 不存 IP、不存 UA 原文、不用 Cookie（因此无需隐私弹窗）
 *  · sessionId 仅存 sessionStorage，关标签页即失效
 *  · path 必须截到 `?` 之前：分享链接是 `#/?s=<配置快照>`
 *
 * 槽位映射只在本文件里出现一次（各 trackXxx helper），调用点不要再拼字段名。
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

/** hash 里的路径部分，去掉查询串（分享快照在 ?s= 里） */
function cleanPath(): string {
  try {
    const raw = location.hash || location.pathname || '/';
    return raw.split('?')[0].slice(0, 24);
  } catch {
    return '/';
  }
}

export type TrackPayload = Record<string, string | number | boolean>;

/** 上报一个事件。任何异常都在内部吞掉。 */
export function track(event: string, data: TrackPayload = {}): void {
  if (typeof navigator === 'undefined' || !event) return;
  try {
    const body = JSON.stringify({ e: event, s: getSessionId(), d: { ...data, path: cleanPath() } });
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

// ---------------------------------------------------------------
// 事件封装：槽位映射只写在这里
// ---------------------------------------------------------------

/**
 * 来源判定。CF Web Analytics 已经能看「从哪个站来」，但那是一张独立的表，
 * 没法和 zx_events 做 join。这里存的是**能 join 的类别**，
 * 用来回答「搜索来的人里有多少真的开了工具」这种问题。
 */
function detectRef(): string {
  try {
    // 长图二维码回流（二维码 URL 带 src=qr）—— 必须排在普通分享之前，否则会被记成同一个 share
    if (/[?&]src=qr/.test(location.hash || '')) return 'share-qr';
    // 分享链接回流（分享第 3 批上线后才会出现 #/?s=）
    if (/[?&]s=/.test(location.hash || '')) return 'share';

    const ref = document.referrer || '';
    if (!ref) return 'direct';

    const u = new URL(ref);
    const host = u.hostname.toLowerCase();
    if (host === location.hostname) {
      return u.pathname.startsWith('/data/') ? 'static' : 'internal';
    }
    if (/baidu|google|bing|sogou|so\.com|sm\.cn|toutiao|shenma/.test(host)) return 'search';
    if (/weixin|weibo|douyin|toutiao|qq\.com|qzone/.test(host)) return 'social';
    return 'ext';
  } catch {
    return 'direct';
  }
}

/** 会话基线：每会话 1 次。所有比例的分母，也是 PWA 装机率的唯一来源 */
export function trackSessionStart(): void {
  try {
    if (sessionStorage.getItem('zx_sess_sent')) return;
    sessionStorage.setItem('zx_sess_sent', '1');
  } catch {
    /* sessionStorage 不可用时照发，宁可多一条 */
  }
  const standalone =
    typeof window !== 'undefined' && window.matchMedia
      ? Number(
          window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as unknown as { standalone?: boolean }).standalone === true,
        )
      : 0;
  track('session_start', {
    detail: detectRef(),
    v2: standalone,
    vw: typeof window !== 'undefined' ? window.innerWidth : 0,
  });
}

/** 工具打开。mode 回答「哪个工具最热」，src 回答「哪个入口有效」 */
export function trackOpenTool(mode: string, src: string): void {
  track('open_tool', { detail: mode, extra: src });
}

/**
 * 卡片选项点击 —— 内容热点的核心。
 * ct=卡片类型，opt=选项 key，sub=主体名（职业/部位/标题）。
 * 没有 sub 就只知道「有人点了技能查询」，不知道「哪个职业的」。
 */
export function trackCardClick(ct: string, opt: string, sub: string): void {
  track('card_click', { detail: ct, extra: opt, sub: sub.slice(0, 16) });
}

/** 分享通道。决定「分享要不要从只有计算器扩到 4 个模拟器」 */
export function trackShareClick(ch: string, mode: string): void {
  track('share_click', { detail: ch, extra: mode });
}

/** PWA 安装引导：曝光 / 关闭 / 入口点击 / 弹窗 / 一键安装 */
export function trackInstallPrompt(act: string, src: string): void {
  track('install_prompt', { detail: act, extra: src });
}

/**
 * 发消息。src 区分本地意图 / AI 兜底 / 识图。
 * q 只在 src=ai（本地意图没接住）时带 —— 那才是词表缺口，local 命中的记了没用。
 */
export function trackChatSend(src: 'local' | 'ai' | 'vision', text?: string): void {
  const payload: TrackPayload = { detail: src, v2: src === 'vision' ? 1 : 0 };
  if (src === 'ai' && text) payload.extra = text.trim().slice(0, 20);
  track('chat_send', payload);
}

// ---------------------------------------------------------------
// font_check
// ---------------------------------------------------------------

export type FontHealthStatus = 'ok' | 'partial' | 'fail' | 'no_css' | 'pending';

/**
 * 字体健康度：判断 Google Fonts 到底有没有下来。
 *
 * v3 及之前判据是 `loaded > 0`（任何一片下来就算 ok）—— 实测 279 条 ok 里有 22 条
 * loaded < 10，其中 5 条只有 1 片。CJK 按 unicode-range 切片，主标题
 * `Noto Serif SC 900` 至少需要 8~10 片，所以那些样本主标题大概率已经回退成系统字体，
 * 却被判成健康。→ v4 改成**只看 Serif**：serif 的 loaded 数 = 0 就是真退化。
 *
 * 为什么不用 `document.fonts.check()`：实测它在字体未注册时也返回 true（规范行为），
 * 在 `media="print"` 的异步加载下完全失效。只有遍历 `document.fonts` 看 `status` 才准。
 *
 * 采样用轮询而不是固定延迟：CJK 分片多，弱网下 4.5s 可能还没加载完，
 * 固定延迟会把「还在加载」误判成异常。首次拿到确定结论即停，最多等 8s。
 */
export function reportFontHealth(): void {
  if (typeof document === 'undefined' || !('fonts' in document)) return;

  let done = false;
  const maxRounds = 8;

  const finish = (status: FontHealthStatus, serifLoaded: number, serifTotal: number, error: number) => {
    if (done) return;
    done = true;
    track('font_check', {
      detail: status,
      v1: serifLoaded,   // Serif（主标题）已加载的分片数 —— 0 就是退化
      v2: error,         // 全部 face 的错误数
      v3: serifTotal,    // Serif 的 face 总数
      vw: window.innerWidth,
      extra: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType || '',
    });
  };

  const readAll = () => {
    const faces = Array.from(document.fonts);
    const serif = faces.filter((f) => /Noto Serif SC/.test(f.family));
    return {
      serifTotal: serif.length,
      serifLoaded: serif.filter((f) => f.status === 'loaded').length,
      error: faces.filter((f) => f.status === 'error').length,
    };
  };

  const tick = (round: number) => {
    if (done) return;
    const m = readAll();

    if (m.serifTotal === 0) {
      // 连 @font-face 都没注册：要么 CSS 没下来（no_css），要么还没解析完
      if (round >= 2) finish('no_css', 0, 0, m.error);
    } else if (m.error > 0 && m.serifLoaded === 0) {
      finish('fail', m.serifLoaded, m.serifTotal, m.error);      // 典型国内直连：全部分片 404
    } else if (m.serifLoaded > 0 && m.error > 0) {
      finish('partial', m.serifLoaded, m.serifTotal, m.error);   // 部分分片失败
    } else if (m.serifLoaded > 0) {
      finish('ok', m.serifLoaded, m.serifTotal, m.error);        // 主标题字体已到位
    }

    if (!done) {
      if (round >= maxRounds) finish('pending', m.serifLoaded, m.serifTotal, m.error);
      else window.setTimeout(() => tick(round + 1), 1000);
    }
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    window.setTimeout(() => tick(0), 2000);
  };

  if (document.readyState === 'complete') {
    start();
  } else {
    window.addEventListener('load', start, { once: true });
    // 兜底：`load` 会被第三方资源拖住 —— Google Fonts 的 CSS（media="print"）迟迟不返回时，
    // load 可能等到超时才触发，甚至根本不触发。而「字体加载不到」恰恰是最需要这条数据的场景，
    // 实测无头环境里有一半的会话因此一条都发不出来。5s 后无论如何先跑。
    window.setTimeout(start, 5000);
  }
}

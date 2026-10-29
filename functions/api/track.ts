/**
 * Cloudflare Pages Function: /api/track
 * 轻量埋点接收端。设计见 doc/埋点系统规划_20261026.md（v4）。
 *
 * 白名单机制保证前端任何脏数据都进不来。加新事件 = 这里 ALLOWED_EVENTS 加一行。
 *
 * 绑定要求（Cloudflare Pages → Settings → Functions → Analytics Engine bindings）：
 *   变量名 ANALYTICS ｜ dataset 名 zx_events
 * 未绑定时静默返回 204，不影响线上任何功能。
 *
 * 槽位约定（全事件通用，不要按事件挪位置）：
 *   blob1 事件名 ｜ blob2 detail ｜ blob3 extra ｜ blob4 path ｜ blob5 国家码
 *   blob6 env（后端从 UA 算）｜ blob7 sub（仅 card_click）
 *   double1..3 由事件自定义 ｜ double4 固定视口宽
 *
 * 隐私：不记录 IP、UA 原文、完整输入；国家码取 Cloudflare 自带的 cf-ipcountry（两位）。
 */

interface Env {
  ANALYTICS?: {
    writeDataPoint: (p: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => void;
  };
}

/** 事件白名单：只有这里的事件会被写入 */
const ALLOWED_EVENTS = new Set([
  'font_check',
  'session_start',
  'open_tool',
  'card_click',
  'share_click',
  'install_prompt',
  'static_page',
  'chat_send',
  'vision_result',
]);

/** 单条请求体上限，超过直接丢弃（防刷） */
const MAX_BODY_BYTES = 1024;

const noContent = () =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

const str = (v: unknown, n = 48): string => (typeof v === 'string' ? v.slice(0, n) : '');

const num = (v: unknown): number => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0);

/**
 * 从 UA 反推浏览环境。顺序敏感：内置浏览器优先于平台，
 * 否则微信 Android 会先命中 Android 分支，永远统计不到 wechat。
 */
function detectEnv(ua: string): string {
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  if (/Weibo/i.test(ua)) return 'weibo';
  if (/aweme|BytedanceWebview|Douyin/i.test(ua)) return 'douyin';
  if (/AlipayClient/i.test(ua)) return 'alipay';
  // QQ 内置浏览器 UA 含 " QQ/"，独立的 QQ 浏览器是 "QQBrowser" —— 只认前者
  if (/\bQQ\//i.test(ua)) return 'qq';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** path 只留 hash 的路径部分：分享链接是 #/?s=<配置快照>，带上会把用户属性写进埋点 */
function cleanPath(raw: string): string {
  const cut = raw.split('?')[0];
  return cut.slice(0, 24);
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  let body: any;
  try {
    const text = await context.request.text();
    if (!text || text.length > MAX_BODY_BYTES) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  const event = str(body?.e, 32);
  if (!ALLOWED_EVENTS.has(event)) return noContent();

  const d = body?.d && typeof body.d === 'object' ? body.d : {};
  const req = context.request;

  // detail/extra 是 v4 起的通用名；status/et 是 font_check 的历史名，保留兜底，
  // 避免发版瞬间还在跑旧 bundle 的客户端把 blob2 写成空串。
  const detail = str(d.detail ?? d.status, 32);
  const extra = str(d.extra ?? d.et, 32);

  try {
    context.env.ANALYTICS?.writeDataPoint({
      blobs: [
        event,                                             // blob1 事件名
        detail,                                            // blob2 mode / ch / act / ct / src / status
        extra,                                             // blob3 src / opt / q / 网络类型
        cleanPath(str(d.path, 48)),                        // blob4 页面
        str(req.headers.get('cf-ipcountry'), 2),           // blob5 国家码（不存 IP）
        detectEnv(req.headers.get('user-agent') || ''),    // blob6 浏览环境
        str(d.sub, 16),                                    // blob7 主体名（仅 card_click）
      ],
      doubles: [
        num(d.v1 ?? d.loaded),                             // double1 主数值
        num(d.v2 ?? d.error),                              // double2
        num(d.v3 ?? d.total),                              // double3
        num(d.vw),                                         // double4 视口宽（所有事件都写）
      ],
      indexes: [str(body?.s, 32) || 'anon'],               // 会话 ID（sessionStorage）
    });
  } catch {
    /* 埋点失败绝不影响业务 */
  }

  return noContent();
};

/** GET 一律 405，避免被当成探针或预取 */
export const onRequestGet = async () => new Response(null, { status: 405 });

/**
 * Cloudflare Pages Function: /api/track
 * 轻量埋点接收端。
 *
 * 当前只放行 `font_check`（字体加载成败）。其余事件在 doc/埋点系统规划_20261026.md
 * 里定义、逐个加进 ALLOWED_EVENTS 后再开启——白名单机制保证前端任何脏数据都进不来。
 *
 * 绑定要求（Cloudflare Pages → Settings → Functions → Analytics Engine bindings）：
 *   变量名 ANALYTICS ｜ dataset 名 zx_events
 * 未绑定时静默返回 204，不影响线上任何功能。
 *
 * 隐私：不记录 IP、UA 原文、完整输入；国家码取 Cloudflare 自带的 cf-ipcountry（两位）。
 */

interface Env {
  ANALYTICS?: {
    writeDataPoint: (p: { blobs?: string[]; doubles?: number[]; indexes?: string[] }) => void;
  };
}

/** 事件白名单：只有这里的事件会被写入 */
const ALLOWED_EVENTS = new Set(['font_check']);

/** 单条请求体上限，超过直接丢弃（防刷） */
const MAX_BODY_BYTES = 1024;

const noContent = () =>
  new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

const str = (v: unknown, n = 48): string => (typeof v === 'string' ? v.slice(0, n) : '');

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

  try {
    context.env.ANALYTICS?.writeDataPoint({
      blobs: [
        event,                                                   // blob1 事件名
        str(d.status, 16),                                       // blob2 ok/partial/fail/no_css
        str(d.et, 8),                                            // blob3 网络类型 4g/3g/wifi
        str(d.path, 24),                                         // blob4 所在页面
        str(context.request.headers.get('cf-ipcountry'), 2),     // blob5 国家码（不存 IP）
      ],
      doubles: [
        Number(d.loaded) || 0,                                   // double1 成功加载的 face 数
        Number(d.error) || 0,                                    // double2 加载失败的 face 数
        Number(d.total) || 0,                                    // double3 face 总数
        Number(d.vw) || 0,                                       // double4 视口宽
      ],
      indexes: [str(body?.s, 32) || 'anon'],                     // 会话 ID（sessionStorage）
    });
  } catch {
    /* 埋点失败绝不影响业务 */
  }

  return noContent();
};

/** GET 一律 405，避免被当成探针或预取 */
export const onRequestGet = async () => new Response(null, { status: 405 });

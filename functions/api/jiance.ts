/**
 * Cloudflare Pages Function: /api/jiance
 * 诛仙开服雷达 - 官方网关端口 29000 边缘双通道实时探测接口
 * 路由：/api/jiance?server=xxx 或 /api/jiance?servers=s1,s2,s3
 */

interface ProbeResult {
  status: number; // 1: 已开服, 0: 未开服/维护中
  ping: number;   // 延迟 (ms)
  msg: string;    // 状态描述文本
}

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// 内存短缓存（2000ms），避免高频轮询与战区批量探测瞬间并发风暴
const probeCache = new Map<string, { result: ProbeResult; expiresAt: number }>();
const CACHE_TTL_MS = 2000;

/**
 * 通道 1: 尝试利用 Cloudflare Sockets (TCP 29000) 直连完美世界官方网关
 */
async function probeViaSocket(connectFn: any, server: string, timeoutMs = 2000): Promise<ProbeResult> {
  const start = Date.now();
  let socket: any = null;
  let timer: any = null;

  try {
    const host = `${server}.link.zhuxian.com.cn`;
    socket = connectFn({ hostname: host, port: 29000 });

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
    });

    await Promise.race([socket.opened, timeoutPromise]);
    const ping = Date.now() - start;
    return { status: 1, ping, msg: '已开服' };
  } catch (err: any) {
    if (err?.message === 'TIMEOUT') {
      return { status: 0, ping: 0, msg: '未开服 / 探测超时' };
    }
    return {
      status: 0,
      ping: 0,
      msg: err?.message?.includes('refused') ? '维护中 (端口未开放)' : '未开服 / 维护中'
    };
  } finally {
    if (timer) clearTimeout(timer);
    if (socket) {
      try {
        await socket.close();
      } catch {}
    }
  }
}

/**
 * 通道 2: 国内成熟雷达探测源 (小木匠官方检测源) 容灾兜底
 */
async function probeViaHttpFallback(server: string, timeoutMs = 2500): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://www.mujiston.com/zhuxian/jiance?type=jiance&server=${encodeURIComponent(server)}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.mujiston.com/zhuxian/kaifujiance.html',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    const ping = Date.now() - start;
    const content = data?.content;

    if (content && (content.status === 1 || content.status === '1')) {
      return { status: 1, ping, msg: '已开服' };
    } else {
      return { status: 0, ping: 0, msg: content?.msg || '维护中 (官方网关端口 29000 未放行)' };
    }
  } catch {
    return { status: 0, ping: 0, msg: '未开服 / 维护中' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 综合探测调度器：双通道容灾互备
 */
async function probeServerWithCache(server: string): Promise<ProbeResult> {
  const cleanServer = server.replace(/[^a-zA-Z0-9_-]/g, '').trim();
  if (!cleanServer) {
    return { status: 0, ping: 0, msg: '无效的服务器标识' };
  }

  const now = Date.now();
  const cached = probeCache.get(cleanServer);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  let result: ProbeResult = { status: 0, ping: 0, msg: '未开服 / 维护中' };

  // 1. 优先尝试 Cloudflare Sockets 直连
  let socketAttempted = false;
  try {
    // @ts-ignore
    const cf = await import('cloudflare:sockets');
    if (cf && typeof cf.connect === 'function') {
      socketAttempted = true;
      const socketRes = await probeViaSocket(cf.connect, cleanServer, 1800);
      if (socketRes.status === 1) {
        result = socketRes;
        probeCache.set(cleanServer, { result, expiresAt: now + CACHE_TTL_MS });
        return result;
      }
    }
  } catch {
    // 忽略异常，降级到 HTTP 备用探测
  }

  // 2. 备用通道兜底
  try {
    const httpRes = await probeViaHttpFallback(cleanServer, 2200);
    result = httpRes;
  } catch {
    if (!socketAttempted) {
      result = { status: 0, ping: 0, msg: '未开服 / 维护中' };
    }
  }

  probeCache.set(cleanServer, { result, expiresAt: now + CACHE_TTL_MS });
  return result;
}

/**
 * 处理 GET /api/jiance 请求
 */
export const onRequestGet = async (context: { request: Request }) => {
  const url = new URL(context.request.url);
  const srv = url.searchParams.get('server');
  const serversParam = url.searchParams.get('servers');

  try {
    // 批量探测模式（针对战区内多服务器，限制最多 15 个）
    if (serversParam) {
      const list = serversParam
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 15);

      const results = await Promise.all(
        list.map(async (s) => {
          const probe = await probeServerWithCache(s);
          return { server: s, ...probe };
        })
      );

      return new Response(JSON.stringify({ sc: true, results }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 单服探测模式
    if (!srv) {
      return new Response(JSON.stringify({ sc: false, error: 'Missing server parameter' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const probe = await probeServerWithCache(srv);
    return new Response(JSON.stringify({ sc: true, content: probe }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ sc: false, error: e?.message || 'Internal error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
};

/**
 * 处理 CORS OPTIONS 预检请求
 */
export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
};

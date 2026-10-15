/**
 * Cloudflare Pages Function: /api/guestbook
 * 仙友留言板全员共享云端持久化 (Cloudflare KV 极简存储 + 安全加固与防刷保护)
 * 生效根目录：仓库根目录 /functions
 * 绑定要求：在 Cloudflare Pages 设置中的 KV namespace bindings 绑定变量名 GUESTBOOK
 */

interface Env {
  GUESTBOOK?: any; // Cloudflare KVNamespace (大小写均可自适应识别)
}

export type GuestbookCategory = 'all' | 'suggestion' | 'bug' | 'build' | 'feature';

export interface GuestbookReply {
  id: string;
  author: string;
  content: string;
  time: string;
  isAuthor?: boolean;
}

export interface GuestbookEntry {
  id: string;
  author: string;
  category: GuestbookCategory;
  content: string;
  time: string;
  likes: number;
  isPinned?: boolean;
  statusBadge?: 'adopted' | 'in_progress' | 'fixed';
  statusText?: string;
  replies?: GuestbookReply[];
}

const INITIAL_POSTS: GuestbookEntry[] = [
  {
    id: 'pin-1',
    author: '星耀-萝卜 (作者)',
    category: 'suggestion',
    content: '欢迎仙友使用天书万象 AI 诛仙全知大模型！本平台 100% 静态边缘计算，真实数据全量免费开放。任何技能公式误差、BOSS属性校对或战力对比建议，均可在此留言交流！',
    time: '2026-10-14 12:00',
    likes: 88,
    isPinned: true,
    statusBadge: 'adopted',
    statusText: '官方公告',
    replies: []
  }
];

const KV_STORAGE_KEY = 'tianshu_guestbook_posts_v3';
const MAX_POSTS_LIMIT = 300;
const MAX_REPLIES_PER_POST = 20;
const MAX_SYNC_BATCH = 20;

// 防刷频率限制（内存冷却缓存）
const ipRateLimitMap = {
  create: new Map<string, number>(),
  reply: new Map<string, number>(),
  like: new Map<string, number>(),
  sync: new Map<string, number>(),
  lastContent: new Map<string, string>()
};

const COOLDOWN_MS: Record<string, number> = {
  create: 8000,  // 发帖冷却：8秒
  reply: 4000,   // 回复冷却：4秒
  like: 1000,    // 点赞冷却：1秒
  sync: 30000    // 批量同步冷却：30秒
};

const corsHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const formatCurrentTime = (): string => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const bjDate = new Date(utc + 3600000 * 8);
  const y = bjDate.getFullYear();
  const m = (bjDate.getMonth() + 1).toString().padStart(2, '0');
  const d = bjDate.getDate().toString().padStart(2, '0');
  const hh = bjDate.getHours().toString().padStart(2, '0');
  const mm = bjDate.getMinutes().toString().padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
};

// 大小写自适应获取 KV 绑定
const getKv = (env: any) => env?.GUESTBOOK || env?.guestbook || env?.Guestbook;

// 提取真实客户端 IP
const getClientIp = (request: Request): string => {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
};

// 字段清洗与规范化
const sanitizeCategory = (cat: any): GuestbookCategory => {
  const validCategories: GuestbookCategory[] = ['suggestion', 'bug', 'build', 'feature'];
  return validCategories.includes(cat) ? cat : 'suggestion';
};

const sanitizeText = (text: any, maxLength: number): string => {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, maxLength);
};

const sanitizeReply = (raw: any): GuestbookReply | null => {
  if (!raw || typeof raw !== 'object') return null;
  const content = sanitizeText(raw.content, 300);
  if (!content) return null;
  const author = sanitizeText(raw.author, 16) || '热心仙友';
  const time = typeof raw.time === 'string' && raw.time.length >= 10 ? raw.time.slice(0, 20) : formatCurrentTime();
  return {
    id: typeof raw.id === 'string' && raw.id.length > 0 ? raw.id.slice(0, 32) : `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    content,
    time
  };
};

const sanitizeEntry = (raw: any): GuestbookEntry | null => {
  if (!raw || typeof raw !== 'object') return null;
  // 禁止覆盖置顶官方公告 ID
  if (raw.id === 'pin-1') return null;

  const content = sanitizeText(raw.content, 500);
  if (!content) return null;

  const author = sanitizeText(raw.author, 16) || '匿踪仙友';
  const category = sanitizeCategory(raw.category);
  const time = typeof raw.time === 'string' && raw.time.length >= 10 ? raw.time.slice(0, 20) : formatCurrentTime();
  const likes = typeof raw.likes === 'number' && Number.isFinite(raw.likes) ? Math.max(1, Math.min(raw.likes, 9999)) : 1;

  const replies: GuestbookReply[] = Array.isArray(raw.replies)
    ? raw.replies.map(sanitizeReply).filter((r): r is GuestbookReply => r !== null).slice(0, MAX_REPLIES_PER_POST)
    : [];

  const id = typeof raw.id === 'string' && raw.id.length > 0 && raw.id.length <= 48
    ? raw.id
    : `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  return {
    id,
    author,
    category,
    content,
    time,
    likes,
    replies
  };
};

async function getStoredPosts(kv?: any): Promise<{ posts: GuestbookEntry[]; isCloud: boolean }> {
  if (!kv) {
    return { posts: INITIAL_POSTS, isCloud: false };
  }
  try {
    const raw = await kv.get(KV_STORAGE_KEY, 'json');
    if (Array.isArray(raw) && raw.length > 0) {
      const savedPin = raw.find((p: GuestbookEntry) => p && p.id === 'pin-1');
      const pinnedPost: GuestbookEntry = savedPin
        ? {
            ...INITIAL_POSTS[0],
            likes: typeof savedPin.likes === 'number' ? Math.max(INITIAL_POSTS[0].likes, savedPin.likes) : INITIAL_POSTS[0].likes,
            replies: Array.isArray(savedPin.replies) ? savedPin.replies : (INITIAL_POSTS[0].replies || [])
          }
        : INITIAL_POSTS[0];
      const userPosts = raw.filter((p: GuestbookEntry) => p && p.id !== 'pin-1');
      return { posts: [pinnedPost, ...userPosts], isCloud: true };
    }
  } catch (err) {
    console.error('Error reading from KV:', err);
  }
  return { posts: INITIAL_POSTS, isCloud: true };
}

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  try {
    const kv = getKv(context.env);
    const { posts, isCloud } = await getStoredPosts(kv);

    return new Response(
      JSON.stringify({
        success: true,
        cloud: isCloud,
        posts,
        total: posts.length
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Failed to fetch guestbook posts'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const kv = getKv(context.env);
    const body: any = await context.request.json().catch(() => ({}));
    const action = body.action || 'create';
    const clientIp = getClientIp(context.request);
    const nowTs = Date.now();

    // 1. 蜜罐校验 (Honeypot): 若脚本填写了隐藏字段，静默拦截，避免消耗写配额
    if (body.faxian_trap || body.website || body.honeypot) {
      return new Response(
        JSON.stringify({ success: true, cloud: true, message: 'ok' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. 防刷与 IP 频率冷却限制
    if (['create', 'reply', 'like', 'sync'].includes(action)) {
      const lastActionTime = (ipRateLimitMap as any)[action]?.get(clientIp) || 0;
      const cooldown = COOLDOWN_MS[action] || 1000;
      if (nowTs - lastActionTime < cooldown) {
        const waitSec = Math.ceil((cooldown - (nowTs - lastActionTime)) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            error: `仙友论道调息中，请稍候 ${waitSec} 秒后再试`
          }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    const { posts: currentPosts, isCloud } = await getStoredPosts(kv);
    let updatedPosts = [...currentPosts];

    // 发新留言
    if (action === 'create') {
      const content = sanitizeText(body.content, 500);
      const author = sanitizeText(body.author, 16) || '匿踪仙友';
      const category = sanitizeCategory(body.category);

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: '留言内容不能为空' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // 防刷：禁止同 IP 连续提交完全相同的内容
      const lastContent = ipRateLimitMap.lastContent.get(clientIp);
      if (lastContent && lastContent === content) {
        return new Response(
          JSON.stringify({ success: false, error: '请勿重复提交完全相同的心得' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const newEntry: GuestbookEntry = {
        id: `post-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
        author,
        category,
        content,
        time: formatCurrentTime(),
        likes: 1,
        replies: []
      };

      updatedPosts = [updatedPosts[0], newEntry, ...updatedPosts.slice(1)].slice(0, MAX_POSTS_LIMIT);

      if (kv) {
        await kv.put(KV_STORAGE_KEY, JSON.stringify(updatedPosts));
      }

      // 更新冷却记录
      ipRateLimitMap.create.set(clientIp, nowTs);
      ipRateLimitMap.lastContent.set(clientIp, content);

      return new Response(
        JSON.stringify({
          success: true,
          cloud: isCloud,
          post: newEntry,
          posts: updatedPosts
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 回复留言
    if (action === 'reply') {
      const postId = sanitizeText(body.postId, 48);
      const content = sanitizeText(body.content, 300);
      const author = sanitizeText(body.author, 16) || '热心仙友';

      if (!postId || !content) {
        return new Response(
          JSON.stringify({ success: false, error: '回复目标与内容不能为空' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const newReply: GuestbookReply = {
        id: `rep-${nowTs}-${Math.random().toString(36).slice(2, 6)}`,
        author,
        content,
        time: formatCurrentTime()
      };

      let found = false;
      updatedPosts = updatedPosts.map(p => {
        if (p.id === postId) {
          found = true;
          const currentReplies = p.replies || [];
          return {
            ...p,
            replies: [...currentReplies, newReply].slice(-MAX_REPLIES_PER_POST)
          };
        }
        return p;
      });

      if (!found) {
        return new Response(
          JSON.stringify({ success: false, error: '未找到对应留言条目' }),
          { status: 404, headers: corsHeaders }
        );
      }

      if (kv) {
        await kv.put(KV_STORAGE_KEY, JSON.stringify(updatedPosts));
      }

      ipRateLimitMap.reply.set(clientIp, nowTs);

      return new Response(
        JSON.stringify({
          success: true,
          cloud: isCloud,
          reply: newReply,
          posts: updatedPosts
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 点赞
    if (action === 'like') {
      const postId = sanitizeText(body.postId, 48);
      if (!postId) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少 postId' }),
          { status: 400, headers: corsHeaders }
        );
      }

      updatedPosts = updatedPosts.map(p => {
        if (p.id === postId) {
          return { ...p, likes: (p.likes || 0) + 1 };
        }
        return p;
      });

      if (kv) {
        await kv.put(KV_STORAGE_KEY, JSON.stringify(updatedPosts));
      }

      ipRateLimitMap.like.set(clientIp, nowTs);

      return new Response(
        JSON.stringify({
          success: true,
          cloud: isCloud,
          posts: updatedPosts
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // 安全合入存量留言 (批量同步)
    if (action === 'sync') {
      // 门禁：仅当云端无用户留言（帖数 <= 1，仅官方公告）时才允许批量同步，已初始化后永久关门
      if (currentPosts.length > 1) {
        return new Response(
          JSON.stringify({
            success: false,
            error: '云端留言板已完成初始化，不再允许批量同步'
          }),
          { status: 403, headers: corsHeaders }
        );
      }

      ipRateLimitMap.sync.set(clientIp, nowTs);

      const incomingRaw: any[] = Array.isArray(body.posts) ? body.posts.slice(0, MAX_SYNC_BATCH) : [];
      const sanitizedBatch: GuestbookEntry[] = incomingRaw
        .map(sanitizeEntry)
        .filter((entry): entry is GuestbookEntry => entry !== null);

      const existingIds = new Set(updatedPosts.map(p => p.id));
      const newlyAdded = sanitizedBatch.filter(p => !existingIds.has(p.id));

      if (newlyAdded.length > 0) {
        updatedPosts = [updatedPosts[0], ...newlyAdded, ...updatedPosts.slice(1)].slice(0, MAX_POSTS_LIMIT);
        if (kv) {
          await kv.put(KV_STORAGE_KEY, JSON.stringify(updatedPosts));
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          cloud: isCloud,
          syncedCount: newlyAdded.length,
          posts: updatedPosts
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unsupported action: ${action}` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

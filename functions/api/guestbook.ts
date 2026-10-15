/**
 * Cloudflare Pages Function: /api/guestbook
 * 仙友留言板全员共享云端持久化 (Cloudflare KV 极简存储)
 * 绑定要求：在 Cloudflare Pages 设置中的 KV namespace bindings 绑定变量名 GUESTBOOK
 */

interface Env {
  GUESTBOOK?: any; // Cloudflare KVNamespace
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

const getKv = (env: any) => env?.GUESTBOOK || env?.guestbook || env?.Guestbook;

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

    const { posts: currentPosts, isCloud } = await getStoredPosts(kv);
    let updatedPosts = [...currentPosts];

    if (action === 'create') {
      const content = (body.content || '').trim();
      const author = (body.author || '匿踪仙友').trim().slice(0, 16);
      const category: GuestbookCategory = ['all', 'suggestion', 'bug', 'build', 'feature'].includes(body.category)
        ? body.category
        : 'suggestion';

      if (!content) {
        return new Response(
          JSON.stringify({ success: false, error: '留言内容不能为空' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const newEntry: GuestbookEntry = {
        id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        author: author || '匿踪仙友',
        category,
        content: content.slice(0, 500),
        time: formatCurrentTime(),
        likes: 1,
        replies: []
      };

      updatedPosts = [updatedPosts[0], newEntry, ...updatedPosts.slice(1)].slice(0, MAX_POSTS_LIMIT);

      if (kv) {
        await kv.put(KV_STORAGE_KEY, JSON.stringify(updatedPosts));
      }

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

    if (action === 'reply') {
      const postId = body.postId;
      const content = (body.content || '').trim();
      const author = (body.author || '热心仙友').trim().slice(0, 16);

      if (!postId || !content) {
        return new Response(
          JSON.stringify({ success: false, error: '回复目标与内容不能为空' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const newReply: GuestbookReply = {
        id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        author: author || '热心仙友',
        content: content.slice(0, 300),
        time: formatCurrentTime()
      };

      let found = false;
      updatedPosts = updatedPosts.map(p => {
        if (p.id === postId) {
          found = true;
          return {
            ...p,
            replies: [...(p.replies || []), newReply]
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

    if (action === 'like') {
      const postId = body.postId;
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

      return new Response(
        JSON.stringify({
          success: true,
          cloud: isCloud,
          posts: updatedPosts
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (action === 'sync') {
      const incomingPosts: GuestbookEntry[] = Array.isArray(body.posts) ? body.posts : [];
      const existingIds = new Set(updatedPosts.map(p => p.id));
      const newlyAdded = incomingPosts.filter(p => p && p.id && !existingIds.has(p.id) && p.id !== 'pin-1');

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

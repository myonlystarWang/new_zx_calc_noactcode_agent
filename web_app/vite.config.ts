import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'
import net from 'net'

function zhuxianServerRadarPlugin(): Plugin {
  const probeTcpServer = (server: string, timeout = 2500): Promise<{ status: number; ping: number; msg: string }> => {
    return new Promise((resolve) => {
      const start = Date.now();
      const host = `${server}.link.zhuxian.com.cn`;
      const conn = net.createConnection({ host, port: 29000, timeout }, () => {
        const ping = Date.now() - start;
        conn.end();
        resolve({ status: 1, ping, msg: '已开服' });
      });
      conn.on('error', (err: any) => {
        resolve({ status: 0, ping: 0, msg: err.code === 'ECONNREFUSED' ? '维护中 (端口未开放)' : '未开服 / 维护中' });
      });
      conn.on('timeout', () => {
        conn.destroy();
        resolve({ status: 0, ping: 0, msg: '未开服 / 探测超时' });
      });
    });
  };

  const handleRadarApi = async (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/jiance')) {
      return next();
    }
    const parsedUrl = new URL(req.url, 'http://localhost');
    const srv = parsedUrl.searchParams.get('server');
    const serversParam = parsedUrl.searchParams.get('servers');

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    try {
      if (serversParam) {
        const list = serversParam.split(',').map((s: string) => s.trim()).filter(Boolean);
        const results = await Promise.all(list.map(async (s: string) => {
          const probe = await probeTcpServer(s);
          return { server: s, ...probe };
        }));
        res.end(JSON.stringify({ sc: true, results }));
        return;
      }

      if (!srv) {
        res.statusCode = 400;
        res.end(JSON.stringify({ sc: false, error: 'Missing server parameter' }));
        return;
      }

      const probe = await probeTcpServer(srv);
      res.end(JSON.stringify({ sc: true, content: probe }));
    } catch (e: any) {
      res.statusCode = 500;
      res.end(JSON.stringify({ sc: false, error: e.message }));
    }
  };

  return {
    name: 'zhuxian-server-radar',
    configureServer(server) {
      server.middlewares.use(handleRadarApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleRadarApi);
    }
  };
}

function guestbookDevPlugin(): Plugin {
  let devPosts: any[] = [
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

  const handleGuestbookApi = async (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/guestbook')) {
      return next();
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'GET') {
      res.end(JSON.stringify({ success: true, cloud: true, devMock: true, posts: devPosts, total: devPosts.length }));
      return;
    }

    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const action = body.action || 'create';
          const now = new Date();
          const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          if (action === 'create') {
            const newEntry = {
              id: `post-${Date.now()}`,
              author: (body.author || '匿踪仙友').slice(0, 16),
              category: body.category || 'suggestion',
              content: (body.content || '').slice(0, 500),
              time: timeStr,
              likes: 1,
              replies: []
            };
            devPosts = [devPosts[0], newEntry, ...devPosts.slice(1)];
            res.end(JSON.stringify({ success: true, cloud: true, devMock: true, post: newEntry, posts: devPosts }));
            return;
          }

          if (action === 'reply') {
            const newReply = {
              id: `rep-${Date.now()}`,
              author: (body.author || '热心仙友').slice(0, 16),
              content: (body.content || '').slice(0, 300),
              time: timeStr
            };
            devPosts = devPosts.map(p => p.id === body.postId ? { ...p, replies: [...(p.replies || []), newReply] } : p);
            res.end(JSON.stringify({ success: true, cloud: true, devMock: true, posts: devPosts }));
            return;
          }

          if (action === 'like') {
            devPosts = devPosts.map(p => p.id === body.postId ? { ...p, likes: (p.likes || 0) + 1 } : p);
            res.end(JSON.stringify({ success: true, cloud: true, devMock: true, posts: devPosts }));
            return;
          }

          if (action === 'sync') {
            if (devPosts.length > 1) {
              res.statusCode = 403;
              res.end(JSON.stringify({ success: false, error: '云端留言板已完成初始化，不再允许批量同步' }));
              return;
            }
            const incoming = Array.isArray(body.posts) ? body.posts.slice(0, 20) : [];
            const ids = new Set(devPosts.map(p => p.id));
            const fresh = incoming.filter((p: any) => p && p.id && !ids.has(p.id) && p.id !== 'pin-1');
            if (fresh.length > 0) {
              devPosts = [devPosts[0], ...fresh, ...devPosts.slice(1)];
            }
            res.end(JSON.stringify({ success: true, cloud: true, devMock: true, posts: devPosts }));
            return;
          }

          res.end(JSON.stringify({ success: true, posts: devPosts }));
        } catch (e: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    next();
  };

  return {
    name: 'guestbook-dev-mock',
    configureServer(server) {
      server.middlewares.use(handleGuestbookApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleGuestbookApi);
    }
  };
}

/**
 * 本地模拟 /api/track（线上由 functions/api/track.ts 写入 Analytics Engine）
 * 只打印到终端，方便在 dev 里确认埋点真的发出了、字段对不对。
 */
function trackDevPlugin(): Plugin {
  const handleTrackApi = (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/track')) return next();
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    let raw = '';
    req.on('data', (chunk: any) => { raw += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        console.log(`[track] ${body.e} ${JSON.stringify(body.d)} sid=${body.s}`);
      } catch {
        /* 忽略脏数据 */
      }
      res.statusCode = 204;
      res.end();
    });
  };

  return {
    name: 'zx-track-dev-mock',
    configureServer(server) {
      server.middlewares.use(handleTrackApi);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleTrackApi);
    },
  };
}

/**
 * 构建期注入 JSON-LD（WebApplication + FAQPage）
 *
 * 为什么必须在构建期做：AI 爬虫与搜索引擎不执行 JS，运行时注入等于没做。
 * 为什么用 transformIndexHtml 而不是直接写进 index.html：
 *   源文件保持干净，FAQ 内容与其它配置待在一处（这个文件），改文案不用碰 HTML。
 */
const FAQ_ITEMS: Array<{ q: string; a: string }> = [
    {
        q: '诛仙 3 装备蕴灵上 15 要多少月德符？',
        a: '通用装备从 +0 推到 +15 平均约 381 手、39,891 个月德符；腰带与袖甲的月德符曲线不同，消耗更高。具体数值受装备幸运值影响，可在天书万象 AI 的蕴灵模拟器里按实际幸运值计算。',
    },
    {
        q: '新天缘的 3 条、4 条、5 条属性概率分别是多少？',
        a: '3 条 60%、4 条 30%、5 条 10%。天命触发概率为：2 点 40%、3 点 60%、4 点 80%、5 点 100%。',
    },
    {
        q: '轩辕策洗练五档概率是多少？',
        a: '普通六品为 47% / 30% / 15% / 6% / 2%；典藏与英雄六品没有最低档，为 0 / 67% / 25% / 6% / 2%。属性条数概率（普通六品）：2 条 30%、3 条 40%、4 条 20%、5 条 10%。',
    },
    {
        q: '神机洗练红档概率改了吗？',
        a: '已由 10% 调整为 6%（按客户端数据修正）。其余档位概率可在天书万象 AI 的神机模拟器里查看。',
    },
    {
        q: '天书万象 AI 是什么？',
        a: '免费的诛仙 3 数据工具站：伤害计算、副本训练场、蕴灵 / 新天缘 / 轩辕策 / 神机模拟器，以及全量技能装备图鉴与副本 BOSS 属性。数据来自游戏客户端解包，非官方公示。',
    },
    {
        q: '使用天书万象 AI 需要注册或付费吗？',
        a: '不需要。全部工具免登录、免费、无广告，用浏览器直接打开就能用，手机可添加到桌面当应用使用。',
    },
];

function jsonLdPlugin(): Plugin {
    const graph = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'WebApplication',
                '@id': 'https://zxai.raddishlab.com/#app',
                name: '天书万象 AI',
                alternateName: '诛仙全知大模型',
                url: 'https://zxai.raddishlab.com/',
                description:
                    '免费的诛仙 3 数据工具站：伤害计算、副本训练场、装备蕴灵 / 新天缘 / 轩辕策 / 神机模拟器，全量技能装备图鉴与 97 副本 BOSS 属性。',
                applicationCategory: 'GameApplication',
                operatingSystem: 'Web',
                inLanguage: 'zh-CN',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
            },
            {
                '@type': 'FAQPage',
                '@id': 'https://zxai.raddishlab.com/#faq',
                mainEntity: FAQ_ITEMS.map((item) => ({
                    '@type': 'Question',
                    name: item.q,
                    acceptedAnswer: { '@type': 'Answer', text: item.a },
                })),
            },
        ],
    };

    return {
        name: 'zx-jsonld',
        transformIndexHtml(html) {
            const tag = `<script type="application/ld+json">${JSON.stringify(graph)}</script>`;
            // 只追加在 </head> 前，不改动任何既有内容
            return html.replace('</head>', `  ${tag}\n</head>`);
        },
    };
}

/**
 * 让 `/data/` 在 dev / preview 下也能访问
 *
 * 线上 Cloudflare Pages 默认支持目录索引（`/data/` → `/data/index.html`），
 * 但 Vite 的静态服务不自动找目录下的 index.html —— 请求 `/data/` 会落到 SPA fallback，
 * 于是点了「概率表」看到的还是首页。这里显式重写一次，两个环境行为一致。
 */
function staticDataDirPlugin(): Plugin {
    const rewrite = (req: any, _res: any, next: any) => {
        const url = req.url || '';
        if (url === '/data' || url === '/data/' || url.startsWith('/data/?')) {
            req.url = '/data/index.html';
        }
        next();
    };
    return {
        name: 'zx-data-dir',
        configureServer(server) {
            server.middlewares.use(rewrite);
        },
        configurePreviewServer(server) {
            server.middlewares.use(rewrite);
        },
    };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zhuxianServerRadarPlugin(), guestbookDevPlugin(), trackDevPlugin(), jsonLdPlugin(), staticDataDirPlugin()],
  // 版本号唯一来源：package.json 的 version（Header 版本徽章 / 更新日志页 均由 __APP_VERSION__ 读出）
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // 函数式 manualChunks：对象式写法在 React 19 + Vite 5 下无法把 react-dom 拆出，
        // 构建产物证实 vendor-react 仅 0.08kB、react-dom 仍留在主块。函数式可正确归类 node_modules。
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory') || id.includes('internmap')) return 'vendor-recharts';
            if (id.includes('pinyin-pro')) return 'vendor-pinyin';
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react';
            // 只在「分享」动作里动态 import 的库，单独成块才能保持懒加载
            // （若混进 'vendor'，会因该块被主包静态引用而变成首屏就下载）
            // modern-screenshot 必须列进来：漏了它就会掉进 vendor，而 vendor 被 index.html
            // modulepreload → 首屏白白多下 ~14KB(gz)，动态 import 的隔离完全失效。
            if (id.includes('lz-string') || id.includes('qrcode') || id.includes('modern-screenshot')) return 'vendor-share';
            return 'vendor';
          }
        },
      },
    },
  },
})

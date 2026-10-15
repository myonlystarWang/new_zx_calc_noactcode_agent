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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zhuxianServerRadarPlugin(), guestbookDevPlugin()],
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
            if (id.includes('lz-string') || id.includes('qrcode')) return 'vendor-share';
            return 'vendor';
          }
        },
      },
    },
  },
})

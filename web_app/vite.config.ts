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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), zhuxianServerRadarPlugin()],
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

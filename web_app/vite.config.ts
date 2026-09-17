import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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

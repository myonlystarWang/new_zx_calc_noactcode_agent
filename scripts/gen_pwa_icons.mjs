/**
 * 生成 PWA 图标（构建前一次性运行，产物入库，不需要每次构建重跑）
 *
 *   node scripts/gen_pwa_icons.mjs
 *
 * 为什么不用 sharp / canvas：
 *   项目里没装图像库，而 favicon.svg 带 radialGradient / linearGradient / feGaussianBlur /
 *   strokeDasharray，纯手写光栅化会失真。headless Chrome 直接截图 = 与浏览器实际渲染一致。
 *
 * 产物（web_app/public/）：
 *   icon-192.png            192 普通图标（transparent 四角，圆形底盘）
 *   icon-512.png            512 普通图标
 *   icon-maskable-512.png   512 遮罩图标（满幅不透明底 + 内容缩到 76%，避开 Android 裁切安全区）
 *   apple-touch-icon.png    180 iOS 主屏图标（iOS 不支持透明，必须不透明底）
 *
 * maskable 的安全区：Android 只保证「中心直径 80% 的圆」可见。
 *   76% 缩放后内容半径 = 0.76*512/2 = 194.6 < 0.4*512 = 204.8 ✓
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ROOT = path.resolve(import.meta.dirname, '..');
const SVG_PATH = path.join(ROOT, 'web_app/public/favicon.svg');
const OUT_DIR = path.join(ROOT, 'web_app/public');
const PROFILE = path.join(ROOT, 'scratch/_icon_profile');
const PORT = 9455;

const BG = '#0b0f17';
const rawSvg = fs.readFileSync(SVG_PATH, 'utf8');

/**
 * 修 favicon.svg 的辉光滤镜。
 *
 * 原写法 `feComposite in="SourceGraphic" in2="blur" operator="over"` 在 headless 软件光栅化下
 * 会把**整个滤镜区域涂白**，512px 图上表现为每个发光节点周围一个白方块（192px 不明显、
 * 389px 又消失，属于尺寸相关的渲染 bug）。真实浏览器里不出现，但截图会脏。
 *
 * 换成标准写法 feMerge（先画模糊层、再叠原图），语义等价、无该 bug；并显式声明
 * color-interpolation-filters="sRGB"，否则默认 linearRGB 会让辉光偏灰。
 */
const svg = rawSvg.replace(
  /<filter id="tsGlow"[\s\S]*?<\/filter>/,
  '<filter id="tsGlow" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">' +
  '<feGaussianBlur stdDeviation="2.5" result="blur" />' +
  '<feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>' +
  '</filter>',
);

/** 生成一页用于截图的 HTML */
function page({ size, scale = 1, opaque = false }) {
  const inner = size * scale;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;
      background:${opaque ? BG : 'transparent'};}
    .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center}
    svg{width:${inner}px;height:${inner}px;display:block}
  </style></head><body><div class="wrap">${svg}</div></body></html>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === 'page');
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* not ready */ }
    await sleep(250);
  }
  throw new Error('Chrome DevTools 未就绪');
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');

async function shoot({ file, size, scale, opaque }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: size, height: size, deviceScaleFactor: 1, mobile: false,
  });
  // 透明底：只在非 opaque 时启用，否则 iOS 图标会出现黑角
  await send('Emulation.setDefaultBackgroundColorOverride', {
    color: opaque ? { r: 11, g: 15, b: 23, a: 1 } : { r: 0, g: 0, b: 0, a: 0 },
  });

  const html = page({ size, scale, opaque });
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  await send('Page.navigate', { url: dataUrl });
  await sleep(700);

  const { data } = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: false, fromSurface: true,
  });
  const buf = Buffer.from(data, 'base64');
  const out = path.join(OUT_DIR, file);
  fs.writeFileSync(out, buf);
  console.log(`✓ ${file}  ${size}×${size}  scale=${scale}  ${(buf.length / 1024).toFixed(1)}KB`);
}

await shoot({ file: 'icon-192.png', size: 192, scale: 1, opaque: false });
await shoot({ file: 'icon-512.png', size: 512, scale: 1, opaque: false });
await shoot({ file: 'icon-maskable-512.png', size: 512, scale: 0.76, opaque: true });
await shoot({ file: 'apple-touch-icon.png', size: 180, scale: 1, opaque: true });

ws.close();
chrome.kill();
try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
console.log('done');

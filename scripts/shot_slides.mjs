// 多屏幻灯片/图集分屏截图工具 (CDP，无第三方依赖)
// 用法: node scripts/shot_slides.mjs <url_or_file> <out_dir> [selector] [scale]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
let inputUrl = process.argv[2];
if (!inputUrl) {
  console.error('Usage: node scripts/shot_slides.mjs <url_or_file> <out_dir> [selector] [scale]');
  process.exit(1);
}

if (!inputUrl.startsWith('http://') && !inputUrl.startsWith('https://') && !inputUrl.startsWith('file://')) {
  inputUrl = pathToFileURL(path.resolve(inputUrl)).href;
}

const outDir = path.resolve(process.argv[3] ?? './slides_out');
const selector = process.argv[4] ?? '.slide';
const scale = Number(process.argv[5] ?? 2);

const PORT = 9400 + Math.floor(Math.random() * 200);
const profile = path.join(outDir, `_cdp_profile_${PORT}`);

fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--force-color-profile=srgb',
  '--disable-extensions', '--mute-audio',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  '--window-size=1200,900', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hardStop = setTimeout(() => {
  console.error('TIMEOUT: screenshot pipeline exceeded 90s');
  try { chrome.kill(); } catch {}
  process.exit(2);
}, 90000);

async function waitPort() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return await r.json();
    } catch {}
    await sleep(250);
  }
  throw new Error('chrome devtools not ready');
}

const ver = await waitPort();
const tabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(inputUrl)}`,
  { method: 'PUT', signal: AbortSignal.timeout(8000) });
const tab = await tabRes.json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);

let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else if (msg.method) events.push(msg.method);
};
await new Promise(r => ws.onopen = r);

const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id;
  pending.set(mid, (m) => m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result));
  ws.send(JSON.stringify({ id: mid, method, params }));
});

await send('Page.enable');
await send('Network.enable');
await send('Page.navigate', { url: inputUrl });

for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
await sleep(800);

const { contentSize } = await send('Page.getLayoutMetrics');
const totalHeight = Math.ceil(contentSize.height);
const totalWidth = Math.ceil(contentSize.width);

// 将整个文档完整高度作为 viewport，确保所有 slide 的 y 坐标都在渲染区域内
await send('Emulation.setDeviceMetricsOverride', {
  width: Math.max(totalWidth, 600),
  height: totalHeight,
  deviceScaleFactor: scale,
  mobile: false,
});
await sleep(300);

const evalRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const list = document.querySelectorAll('${selector}');
    return Array.from(list).map((el, i) => {
      const rect = el.getBoundingClientRect();
      return {
        index: i,
        x: rect.left + window.scrollX,
        y: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
        title: el.getAttribute('data-title') || ('slide_' + (i + 1))
      };
    });
  })()`,
  returnByValue: true
});

const slides = evalRes.result?.value ?? [];
console.log(`Found ${slides.length} slides matching "${selector}"`);

if (slides.length === 0) {
  console.warn('No elements found with selector:', selector);
}

for (const s of slides) {
  const width = Math.ceil(s.width);
  const height = Math.ceil(s.height);
  if (width <= 0 || height <= 0) continue;

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: s.x,
      y: s.y,
      width: width,
      height: height,
      scale: 1,
    }
  });

  const paddedIndex = String(s.index + 1).padStart(2, '0');
  const safeTitle = s.title.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `slide_${paddedIndex}_${safeTitle}.png`;
  const filePath = path.join(outDir, filename);
  fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));
  console.log(`Saved slide [${paddedIndex}] ${filename} (${width}x${height} @ ${scale}x) -> ${filePath}`);
}

clearTimeout(hardStop);
ws.close();
chrome.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
console.log('All slides captured successfully.');
process.exit(0);

// 全页长图截图（CDP，无第三方依赖；Node 22 自带 fetch/WebSocket）
// 用法: node scripts/shot_full.mjs <url> <out.png> [width] [scale] [blockUrls]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = process.argv[2];
const out = path.resolve(process.argv[3]);
const width = Number(process.argv[4] ?? 480);
const scale = Number(process.argv[5] ?? 2);
// 默认拦截外网 CDN，避免 html2canvas 之类的外链把 load 事件拖死
const block = process.argv[6] ?? '*cdn.jsdelivr.net*';
const PORT = 9300 + Math.floor(Math.random() * 200);
const profile = path.join(path.dirname(out), `_cdp_profile_${PORT}`);

fs.rmSync(profile, { recursive: true, force: true });
fs.mkdirSync(path.dirname(out), { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--force-color-profile=srgb',
  '--disable-extensions', '--mute-audio',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
  `--window-size=${width},900`, 'about:blank',
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
const tabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
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
console.log('step: page enabled');
await send('Network.enable');
if (block) {
  try { await send('Network.setBlockedURLs', { urls: [block] }); } catch {}
}
await send('Page.navigate', { url });
console.log('step: navigated');
for (let i = 0; i < 100 && !events.includes('Page.loadEventFired'); i++) await sleep(100);
console.log('step: load event', events.includes('Page.loadEventFired'));
await sleep(600);

const { contentSize } = await send('Page.getLayoutMetrics');
const height = Math.ceil(contentSize.height);
const cw = Math.ceil(contentSize.width);
console.log('step: metrics', cw + 'x' + height);
// 直接把视口设成整页高度，再普通截图（最稳，避开 captureBeyondViewport）
await send('Emulation.setDeviceMetricsOverride', {
  width: cw, height, deviceScaleFactor: scale, mobile: false,
});
await sleep(600);
const shot = await send('Page.captureScreenshot', { format: 'png' });
console.log('step: captured');
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('chrome', ver.Browser, '| size', cw + 'x' + height, '| png', fs.statSync(out).size, 'bytes ->', out);

clearTimeout(hardStop);
ws.close();
chrome.kill();
process.exit(0);

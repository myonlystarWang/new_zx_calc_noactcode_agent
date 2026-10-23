/**
 * 生成「神机洗练红档下调 · 手数分布」自包含 HTML 报告
 * 用法：node scripts/shenji_mc_report.mjs
 * 输入：zx_analysis_results/神机洗练/red_target.json
 * 输出：zx_analysis_results/神机洗练/report.html
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const IN = path.join(ROOT, 'zx_analysis_results/神机洗练/red_target.json');
const OUT = path.join(ROOT, 'zx_analysis_results/神机洗练/report.html');

const data = JSON.parse(fs.readFileSync(IN, 'utf8'));
const rows = data.rows;
const base = rows.find((r) => r.R === 12);
const now = rows.find((r) => r.R === 10);

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';

/** 颜色：12% 灰蓝、11% 青、10% 红（当前）、9% 紫 */
const COLORS = { 12: '#7f9db9', 11: '#4ec9b0', 10: '#e04538', 9: '#b48ce0' };

/** 几何分布 CDF 折线点（对数横轴 100~30000） */
function cdfPoints(p, w, h, pad, maxN = 30000, minN = 100) {
  const xs = [];
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const n = minN * Math.pow(maxN / minN, i / steps);
    const cdf = 1 - Math.pow(1 - p, n);
    const x = pad.l + (Math.log(n / minN) / Math.log(maxN / minN)) * (w - pad.l - pad.r);
    const y = h - pad.b - cdf * (h - pad.t - pad.b);
    xs.push([x, y, n, cdf]);
  }
  return xs;
}

const W = 760;
const H = 340;
const PAD = { l: 54, r: 16, t: 18, b: 40 };

const lines = rows
  .map((r) => {
    const pts = cdfPoints(r.p, W, H, PAD)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${COLORS[r.R]}" stroke-width="${r.R === 10 ? 2.6 : 1.8}" opacity="${r.R === 10 ? 1 : 0.85}"/>`;
  })
  .join('\n');

const xTicks = [100, 300, 1000, 3000, 10000, 30000]
  .map((n) => {
    const x = PAD.l + (Math.log(n / 100) / Math.log(30000 / 100)) * (W - PAD.l - PAD.r);
    return `<line x1="${x}" y1="${PAD.t}" x2="${x}" y2="${H - PAD.b}" stroke="#1c2b3c" stroke-width="1"/>
            <text x="${x}" y="${H - PAD.b + 16}" fill="#7d93a8" font-size="11" text-anchor="middle">${n.toLocaleString('en-US')}</text>`;
  })
  .join('');

const yTicks = [0, 0.25, 0.5, 0.75, 1]
  .map((v) => {
    const y = H - PAD.b - v * (H - PAD.t - PAD.b);
    return `<line x1="${PAD.l}" y1="${y}" x2="${W - PAD.r}" y2="${y}" stroke="#1c2b3c" stroke-width="1"/>
            <text x="${PAD.l - 8}" y="${y + 4}" fill="#7d93a8" font-size="11" text-anchor="end">${v * 100}%</text>`;
  })
  .join('');

const legend = rows
  .map(
    (r, i) =>
      `<g transform="translate(${PAD.l + 6 + i * 132}, ${PAD.t + 24})">
        <line x1="0" y1="0" x2="18" y2="0" stroke="${COLORS[r.R]}" stroke-width="3"/>
        <text x="24" y="4" fill="#c8d8e6" font-size="12">红 ${r.R}%</text>
      </g>`
  )
  .join('');

const mainRows = rows
  .map((r) => {
    const hl = r.R === 10 ? ' class="hl"' : r.R === 12 ? ' class="base"' : '';
    return `<tr${hl}>
      <td><b style="color:${COLORS[r.R]}">红 ${r.R}%</b>${r.R === 12 ? ' <span class="tag">旧</span>' : r.R === 10 ? ' <span class="tag now">当前</span>' : ''}</td>
      <td class="num">1 / ${fmt(r.oneIn)}</td>
      <td class="num">${fmt(r.mc.mean)}</td>
      <td class="num">${fmt(r.mc.p50)}</td>
      <td class="num">${fmt(r.mc.p75)}</td>
      <td class="num">${fmt(r.mc.p90)}</td>
      <td class="num">${fmt(r.mc.p95)}</td>
      <td class="num">${fmt(r.mc.p99)}</td>
      <td class="num">${fmt(r.costMean)}</td>
    </tr>`;
  })
  .join('');

const bucketRows = rows
  .map((r) => {
    const cells = r.mc.buckets
      .map((b) => `<td class="num">${((b.n / data.meta.trials) * 100).toFixed(1)}%</td>`)
      .join('');
    return `<tr${r.R === 10 ? ' class="hl"' : ''}><td><b style="color:${COLORS[r.R]}">红 ${r.R}%</b></td>${cells}</tr>`;
  })
  .join('');

const distRows = rows
  .map((r) => {
    const d = r.redDist15;
    return `<tr${r.R === 10 ? ' class="hl"' : ''}>
      <td><b style="color:${COLORS[r.R]}">红 ${r.R}%</b></td>
      <td class="num">${pct(d.zero)}</td>
      <td class="num">${pct(d.one)}</td>
      <td class="num">${pct(d.two, 2)}（1/${fmt(1 / d.two)}）</td>
      <td class="num">${pct(d.three, 2)}（1/${fmt(1 / d.three)}）</td>
    </tr>`;
  })
  .join('');

const rateTable = (R) => {
  const r = rows.find((x) => x.R === R);
  const t = r.table;
  const cell = (g, l) => `<td class="num">${t[g][l].join(' / ')}</td>`;
  return `<table class="tbl">
    <thead><tr><th>组 / 部位</th><th>+11 池</th><th>+13 池</th><th>+15 池</th></tr></thead>
    <tbody>
      <tr><td>A · 武器、衣服</td>${cell('A', 11)}${cell('A', 13)}${cell('A', 15)}</tr>
      <tr><td>B · 头盔、靴子</td>${cell('B', 11)}${cell('B', 13)}${cell('B', 15)}</tr>
      <tr><td>C · 腰带、袖甲</td>${cell('C', 11)}${cell('C', 13)}${cell('C', 15)}</tr>
    </tbody>
  </table>`;
};

const delta = (a, b) => {
  const v = ((b - a) / a) * 100;
  return `<span class="${v > 0 ? 'up' : 'down'}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
};

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>神机洗练红档下调 · 手数分布对比</title>
<style>
  :root{--bg:#0a121c;--panel:#101d2b;--line:#1e3046;--txt:#dbe8f4;--dim:#8ba3b8;--red:#e04538;--gold:#e8b34b}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 50% -10%,#132538,#0a121c 60%);color:var(--txt);
       font:14px/1.7 "PingFang SC","Microsoft YaHei",system-ui,sans-serif;padding:32px 20px 64px}
  .wrap{max-width:1080px;margin:0 auto}
  h1{font-size:26px;margin:0 0 6px;letter-spacing:.5px}
  .sub{color:var(--dim);font-size:13px;margin-bottom:24px}
  h2{font-size:17px;margin:34px 0 12px;padding-left:10px;border-left:3px solid var(--red)}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0 6px}
  @media (max-width:760px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
  .card .k{color:var(--dim);font-size:12px}
  .card .v{font-size:22px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums}
  .card .d{font-size:12px;margin-top:4px;color:var(--dim)}
  table.tbl{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;font-size:13px}
  .tbl th,.tbl td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left}
  .tbl th{background:#16263a;color:#a9c2d6;font-weight:600;font-size:12px}
  .tbl tr:last-child td{border-bottom:none}
  .tbl td.num{text-align:right;font-variant-numeric:tabular-nums}
  .tbl tr.hl{background:rgba(224,69,56,.10)}
  .tbl tr.base{background:rgba(127,157,185,.07)}
  .tag{font-size:11px;padding:1px 6px;border-radius:3px;background:#2a3d52;color:#9fb6ca;margin-left:4px}
  .tag.now{background:rgba(224,69,56,.22);color:#ff8b80}
  .up{color:#ff8b80}.down{color:#4ec9b0}
  .note{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:6px;padding:12px 16px;color:#c3d4e3;font-size:13px}
  .note b{color:var(--gold)}
  ul{margin:8px 0;padding-left:20px;color:#c3d4e3}
  li{margin:4px 0}
  .chart{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:10px 6px 0}
  .foot{color:#63798d;font-size:12px;margin-top:36px;text-align:center}
  code{background:#16263a;padding:1px 5px;border-radius:3px;color:#9fd6ff;font-size:12px}
</style>
</head>
<body><div class="wrap">
  <h1>神机洗练 · 红档下调前后手数分布</h1>
  <div class="sub">
    目标：<b>彰武武器，蕴灵固定 +15</b> —— 第 2 条（+13 池）为<b>红·攻击百分比</b>，且第 3 条（+15 池）为<b>红·对怪物造成伤害</b>；第 1 条不设限<br/>
    蒙特卡洛 ${data.meta.trials.toLocaleString('en-US')} 次/档 · seed ${data.meta.seed} · 单次洗练 ${data.meta.costPerRoll} 月德符（彰武通用价） · 生成于 ${data.meta.generatedAt.slice(0, 16).replace('T', ' ')}
  </div>

  <div class="cards">
    <div class="card"><div class="k">单次命中概率（红 10%）</div><div class="v">1 / ${fmt(now.oneIn)}</div><div class="d">旧 12%：1 / ${fmt(base.oneIn)}</div></div>
    <div class="card"><div class="k">平均手数</div><div class="v">${fmt(now.mc.mean)}</div><div class="d">旧 ${fmt(base.mc.mean)} ${delta(base.mc.mean, now.mc.mean)}</div></div>
    <div class="card"><div class="k">中位数 P50</div><div class="v">${fmt(now.mc.p50)}</div><div class="d">旧 ${fmt(base.mc.p50)} ${delta(base.mc.p50, now.mc.p50)}</div></div>
    <div class="card"><div class="k">90% 玩家 P90</div><div class="v">${fmt(now.mc.p90)}</div><div class="d">旧 ${fmt(base.mc.p90)} ${delta(base.mc.p90, now.mc.p90)}</div></div>
  </div>

  <h2>一、手数分布对照（红档 12% → 10%）</h2>
  <table class="tbl">
    <thead><tr>
      <th>红档</th><th>命中概率</th><th>均值手数</th><th>P50</th><th>P75</th><th>P90</th><th>P95</th><th>P99</th><th>均值月德符</th>
    </tr></thead>
    <tbody>${mainRows}</tbody>
  </table>

  <h2>二、累计达成曲线（横轴对数）</h2>
  <div class="chart">
    <svg viewBox="0 0 ${W} ${H}" width="100%" height="auto">
      <rect x="0" y="0" width="${W}" height="${H}" fill="none"/>
      ${xTicks}
      ${yTicks}
      ${lines}
      ${legend}
      <text x="${W / 2}" y="${H - 6}" fill="#7d93a8" font-size="11" text-anchor="middle">洗练手数（对数）</text>
    </svg>
  </div>
  <div class="sub" style="margin-top:8px">曲线 = 精确几何分布 <code>1−(1−p)^n</code>；红档越低，曲线整体右移，长尾明显变厚。</div>

  <h2>三、手数分桶占比</h2>
  <table class="tbl">
    <thead><tr><th>红档</th>${data.rows[0].mc.buckets.map((b) => `<th style="text-align:right">${b.label}</th>`).join('')}</tr></thead>
    <tbody>${bucketRows}</tbody>
  </table>

  <h2>四、+15 池红档整体分布（A 组，三档独立）</h2>
  <table class="tbl">
    <thead><tr><th>红档</th><th>零红</th><th>单红</th><th>任意两红</th><th>三条全红</th></tr></thead>
    <tbody>${distRows}</tbody>
  </table>
  <div class="sub" style="margin-top:8px">红档从 12% 降到 10%，零红比例 ${pct(base.redDist15.zero)} → ${pct(now.redDist15.zero)}（+${((now.redDist15.zero - base.redDist15.zero) * 100).toFixed(1)}pp），观感上"红变少"但不至于稀到没有。</div>

  <h2>五、档位概率表</h2>
  <div style="display:grid;grid-template-columns:1fr;gap:18px">
    <div>
      <div class="sub" style="margin:0 0 6px">旧：红档 12%（v3）</div>
      ${rateTable(12)}
    </div>
    <div>
      <div class="sub" style="margin:0 0 6px">新：红档 10%（v4，已落库）</div>
      ${rateTable(10)}
    </div>
  </div>
  <div class="sub" style="margin-top:8px">顺序固定为 白 / 绿 / 紫 / 橙 / 红；非红四档按 v3 比例等比放大到合计 90，用最大余数法取整保证合计 100。</div>

  <h2>六、口径说明</h2>
  <div class="note">
    <b>为什么是 1/${fmt(base.oneIn)} 而不是文档里的 1/1510？</b><br/>
    实证文档 §10 的 1/1510 把「第 1 条或第 2 条出攻击%」合并计入（11 池攻击% 8% + 13 池攻击% 38%）。
    本次按你的口径严格锁定<b>第 2 条</b>必须是红攻击%，故概率为
    <code>38%（+13 池攻击%） × 红档 × 10%（+15 池对怪） × 红档</code>，
    12% 时 = 1/1,827，10% 时 = 1/2,632。
  </div>
  <ul>
    <li>手数 = 一次洗练（一次产出 3 条属性）；第 1 条不设限，只判第 2、3 条。</li>
    <li>属性出现概率取自 <code>equip_curated.json</code>（与客户端 <code>elements.data</code> 表 325 逐字段一致，54/54 全等）。</li>
    <li>档位概率为模拟器体验调整值，非游戏内实测；客户端原值下该组合仅 1/17,361。</li>
    <li>三条红不能独立设定：设红档为 r，则两红 = 3r²(1−r)、三红 = r³，比值被 r 唯一决定。</li>
    <li>均值与 P50 来自 MC；P90/P99 与曲线用精确几何分布交叉校验，MC 与理论偏差 &lt; 2%。</li>
  </ul>

  <div class="foot">数据文件：zx_analysis_results/神机洗练/red_target.json · 脚本：scripts/shenji_mc_red_target.ts</div>
</div></body></html>`;

fs.writeFileSync(OUT, html, 'utf8');
console.log('HTML ->', OUT);

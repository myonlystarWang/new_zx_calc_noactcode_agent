/**
 * 蕴灵蒙特卡洛报告页生成器
 * 输入：zx_analysis_results/蕴灵蒙特卡洛/dist.json（由 scripts/yunling_mc_slots.ts 产出）
 * 输出：zx_analysis_results/蕴灵蒙特卡洛/report.html（自包含，无外部依赖）
 *
 * 用法：node scripts/yunling_mc_report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'zx_analysis_results', '蕴灵蒙特卡洛');
const data = JSON.parse(fs.readFileSync(path.join(dir, 'dist.json'), 'utf8'));

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>蕴灵蒙特卡洛 · 六部位（昭武）逐级手数分布</title>
<style>
  :root{
    --bg:#080d16; --panel:#0e1626; --line:#1e2a3f; --text:#e2e8f0; --muted:#8296b3;
    --cyan:#22d3ee; --amber:#fbbf24; --rose:#fb7185; --green:#34d399; --violet:#a78bfa;
  }
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 20% -10%,#0d1b2e 0%,var(--bg) 60%);color:var(--text);
       font:13px/1.7 "Microsoft YaHei","PingFang SC",system-ui,sans-serif;padding:28px 32px 60px}
  h1{font-size:20px;margin:0 0 6px;letter-spacing:.5px}
  h2{font-size:14px;margin:26px 0 10px;color:#cbd5e1;font-weight:700;display:flex;align-items:center;gap:8px}
  h2::before{content:'';width:3px;height:14px;background:var(--cyan);border-radius:2px}
  .sub{color:var(--muted);font-size:12px;margin-bottom:18px}
  .card{background:linear-gradient(180deg,rgba(20,30,48,.85),rgba(12,19,31,.9));border:1px solid var(--line);
        border-radius:14px;padding:16px 18px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0 4px}
  .kpi{background:rgba(14,22,38,.9);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
  .kpi .k{color:var(--muted);font-size:11px}
  .kpi .v{font-size:19px;font-weight:800;font-variant-numeric:tabular-nums}
  table{border-collapse:collapse;width:100%;font-size:12px;font-variant-numeric:tabular-nums}
  th,td{padding:5px 8px;text-align:right;border-bottom:1px solid rgba(30,42,63,.7)}
  th{color:var(--muted);font-weight:600;text-align:right;position:sticky;top:0;background:#0b1320}
  td:first-child,th:first-child{text-align:left;color:#cbd5e1}
  tr:hover td{background:rgba(34,211,238,.05)}
  .wrap{max-height:420px;overflow:auto;border:1px solid var(--line);border-radius:10px}
  .legend{display:flex;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:11px;margin-top:8px}
  .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
  .note{color:var(--muted);font-size:11px;margin-top:8px}
  code{background:rgba(34,211,238,.1);color:#7dd3fc;padding:1px 5px;border-radius:4px;font-size:11px}
  .flag{color:var(--amber)}
</style>
</head>
<body>
<h1>蕴灵蒙特卡洛 · 六部位（昭武）逐级手数分布</h1>
<div class="sub" id="sub"></div>

<div class="kpis" id="kpis"></div>

<h2>逐级手数区间（对数轴）</h2>
<div class="card">
  <div id="box"></div>
  <div class="legend">
    <span><i style="background:#334a6b"></i>P10~P90 长尾</span>
    <span><i style="background:#22d3ee"></i>P25~P75 主体</span>
    <span><i style="background:#f8fafc"></i>中位数</span>
    <span><i style="background:#fbbf24"></i>均值</span>
  </div>
  <div class="note">纵轴为手数（对数刻度）。同一等级六部位完全一致，故本图对六部位通用。</div>
</div>

<h2>逐级手数区间分布（占比）</h2>
<div class="card">
  <div id="stack"></div>
  <div class="legend" id="stackLegend"></div>
</div>

<h2>六部位差异：只差月德符单价</h2>
<div class="card">
  <div id="cost"></div>
  <div class="note">总手数六部位完全相同（同一批随机样本）；腰带走 431 累计曲线、袖甲走 321，其余四部位为通用 570。</div>
</div>

<h2>口径对照：为什么有人觉得「概率太高」</h2>
<div class="card">
  <div id="sens"></div>
  <div class="note flag" id="capNote"></div>
</div>

<h2>明细表</h2>
<div class="card">
  <div class="wrap"><table id="detail"></table></div>
</div>

<script>
const DATA = ${JSON.stringify(data)};

const NS = 'http://www.w3.org/2000/svg';
const fmt = (v, d=1) => Number.isInteger(v) ? String(v) : v.toFixed(d);
const pct = v => (v*100).toFixed(1)+'%';

// ── 头部 ──
document.getElementById('sub').innerHTML =
  '口径：<code>baseMode=' + DATA.meta.cfg.baseMode + '</code>（基础概率取官方区间下限）· 个人幸运 '
  + DATA.meta.cfg.personLuck + '（+5%）· 装备幸运 ' + DATA.meta.cfg.equipLuck
  + ' · 失败 +' + DATA.meta.cfg.luckGainPerFail + ' 幸运 · 每级独立跑 ' + DATA.meta.runs.toLocaleString()
  + ' 次 · 种子 ' + DATA.meta.seed;

// ── KPI ──
const lv15 = DATA.levels.find(l => l.level === 15);
const lv11 = DATA.levels.find(l => l.level === 11);
const p0 = DATA.parts[0];
const total = DATA.levels.reduce((s,l)=>s+l.mean,0);
document.getElementById('kpis').innerHTML = [
  ['单件 +0→+15 总手数均值', fmt(total,0)+' 手'],
  ['总手数中位 / P90 / P99', fmt(p0.totalTries.p50,0)+' / '+fmt(p0.totalTries.p90,0)+' / '+fmt(p0.totalTries.p99,0)],
  ['+11 中位手数', lv11.p50+' 手'],
  ['+15 中位手数', lv15.p50+' 手'],
  ['+15 均值 / P99', fmt(lv15.mean,0)+' / '+lv15.p99],
  ['+1~+10 合计均值', fmt(DATA.levels.slice(0,10).reduce((s,l)=>s+l.mean,0),1)+' 手'],
].map(([k,v]) => '<div class="kpi"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>').join('');

function svg(w,h){ const s=document.createElementNS(NS,'svg'); s.setAttribute('viewBox','0 0 '+w+' '+h); s.setAttribute('width','100%'); s.style.display='block'; return s; }
function el(tag,attrs,text){ const n=document.createElementNS(NS,tag); for(const k in attrs) n.setAttribute(k,attrs[k]); if(text!=null) n.textContent=text; return n; }

// ── 逐级箱线（对数轴）──
(function drawBox(){
  const W=1180,H=380,pad={l:52,r:16,t:14,b:46};
  const s=svg(W,H);
  const maxV=700, minV=1;
  const y=v=>{ const t=(Math.log10(Math.max(minV,v))-Math.log10(minV))/(Math.log10(maxV)-Math.log10(minV)); return H-pad.b-t*(H-pad.t-pad.b); };
  const n=DATA.levels.length;
  const step=(W-pad.l-pad.r)/n;
  const bw=Math.min(30,step*0.42);
  [1,3,10,30,100,300,600].forEach(g=>{
    s.appendChild(el('line',{x1:pad.l,x2:W-pad.r,y1:y(g),y2:y(g),stroke:'#1b2739','stroke-width':1}));
    s.appendChild(el('text',{x:pad.l-8,y:y(g)+4,fill:'#64748b','font-size':10,'text-anchor':'end'},g));
  });
  DATA.levels.forEach((L,i)=>{
    const cx=pad.l+step*(i+0.5);
    const x1=cx-bw/2, x2=cx+bw/2;
    // whisker
    s.appendChild(el('line',{x1:cx,x2:cx,y1:y(L.p10),y2:y(L.p90),stroke:'#334a6b','stroke-width':1.5}));
    s.appendChild(el('line',{x1:cx-6,x2:cx+6,y1:y(L.p10),y2:y(L.p10),stroke:'#334a6b','stroke-width':1.5}));
    s.appendChild(el('line',{x1:cx-6,x2:cx+6,y1:y(L.p90),y2:y(L.p90),stroke:'#334a6b','stroke-width':1.5}));
    // box
    const box=el('rect',{x:x1,y:y(L.p75),width:bw,height:Math.max(2,y(L.p25)-y(L.p75)),rx:3,fill:'rgba(34,211,238,.28)',stroke:'#22d3ee','stroke-width':1.2});
    s.appendChild(box);
    // median
    s.appendChild(el('line',{x1:x1,x2:x2,y1:y(L.p50),y2:y(L.p50),stroke:'#f8fafc','stroke-width':2}));
    // mean
    s.appendChild(el('circle',{cx:cx,cy:y(L.mean),r:3,fill:'#fbbf24'}));
    // label
    s.appendChild(el('text',{x:cx,y:H-pad.b+16,fill:'#94a3b8','font-size':11,'text-anchor':'middle'},'+'+L.level));
    s.appendChild(el('text',{x:cx,y:y(L.p90)-6,fill:'#64748b','font-size':9,'text-anchor':'middle'},L.p50));
  });
  document.getElementById('box').appendChild(s);
})();

// ── 区间占比堆叠条 ──
(function drawStack(){
  const colors=['#34d399','#22d3ee','#38bdf8','#818cf8','#a78bfa','#f472b6','#fb7185','#fbbf24','#f97316'];
  const W=1180, rowH=22, H=DATA.levels.length*rowH+34, pad={l:52,r:16,t:8,b:24};
  const s=svg(W,H);
  const barW=W-pad.l-pad.r;
  DATA.levels.forEach((L,i)=>{
    const y=pad.t+i*rowH;
    s.appendChild(el('text',{x:pad.l-8,y:y+14,fill:'#94a3b8','font-size':10,'text-anchor':'end'},'+'+L.level));
    let x=pad.l;
    L.shares.forEach((v,b)=>{
      if(v<=0) return;
      const w=v*barW;
      s.appendChild(el('rect',{x,y,width:Math.max(w-1,1),height:rowH-6,rx:2,fill:colors[b],opacity:.85}));
      if(w>46) s.appendChild(el('text',{x:x+w/2,y:y+12,fill:'#04121c','font-size':9,'text-anchor':'middle','font-weight':700},pct(v)));
      x+=w;
    });
  });
  document.getElementById('stack').appendChild(s);
  document.getElementById('stackLegend').innerHTML = DATA.buckets.map((b,i)=>'<span><i style="background:'+colors[i]+'"></i>'+b+'</span>').join('');
})();

// ── 六部位成本 ──
(function drawCost(){
  const W=1180,H=260,pad={l:60,r:16,t:12,b:44};
  const s=svg(W,H);
  const vals=DATA.parts.map(p=>p.totalCost.mean);
  const maxV=Math.max(...DATA.parts.map(p=>p.totalCost.p90))*1.1;
  const y=v=>H-pad.b-(v/maxV)*(H-pad.t-pad.b);
  [0,0.25,0.5,0.75,1].forEach(t=>{
    const v=maxV*t;
    s.appendChild(el('line',{x1:pad.l,x2:W-pad.r,y1:y(v),y2:y(v),stroke:'#1b2739'}));
    s.appendChild(el('text',{x:pad.l-8,y:y(v)+4,fill:'#64748b','font-size':10,'text-anchor':'end'},Math.round(v)));
  });
  const step=(W-pad.l-pad.r)/DATA.parts.length;
  DATA.parts.forEach((p,i)=>{
    const cx=pad.l+step*(i+0.5);
    const bw=54;
    s.appendChild(el('rect',{x:cx-bw/2,y:y(p.totalCost.mean),width:bw,height:H-pad.b-y(p.totalCost.mean),rx:3,fill:'rgba(34,211,238,.35)',stroke:'#22d3ee'}));
    s.appendChild(el('rect',{x:cx-bw/2,y:y(p.totalCost.p90),width:bw,height:3,rx:1.5,fill:'#fbbf24'}));
    s.appendChild(el('text',{x:cx,y:y(p.totalCost.mean)-8,fill:'#e2e8f0','font-size':11,'text-anchor':'middle','font-weight':700},Math.round(p.totalCost.mean).toLocaleString()));
    s.appendChild(el('text',{x:cx,y:H-pad.b+16,fill:'#94a3b8','font-size':11,'text-anchor':'middle'},p.slot));
    s.appendChild(el('text',{x:cx,y:H-pad.b+30,fill:'#64748b','font-size':10,'text-anchor':'middle'},p.curve));
  });
  document.getElementById('cost').appendChild(s);
})();

// ── 口径对照 ──
(function drawSens(){
  const rows = DATA.sensitivity.map(s=>({mode:s.mode, luck:s.equipLuck, v:s.rows.map(r=>r.mean)}));
  let h='<table><thead><tr><th>口径</th><th>装备幸运</th><th>+11</th><th>+12</th><th>+13</th><th>+14</th><th>+15</th></tr></thead><tbody>';
  rows.forEach(r=>{
    const hl = r.mode==='floor' && r.luck===0 ? ' style="background:rgba(34,211,238,.07)"' : '';
    h+='<tr'+hl+'><td>'+r.mode+'</td><td>'+r.luck+'</td>'+r.v.map(x=>'<td>'+fmt(x,1)+'</td>').join('')+'</tr>';
  });
  h+='</tbody></table>';
  document.getElementById('sens').innerHTML=h;
  const nc = DATA.noCap || [];
  const row = nc.find(x=>x.equipLuck===0);
  if(row){
    const n15 = row.rows.find(r=>r.level===15);
    document.getElementById('capNote').innerHTML =
      '软保底（250 手起抬升、300 手必成）对 +15 的影响：均值 '+fmt(n15.capMean,0)+' → '+fmt(n15.noCapMean,0)
      +' 手，P99 '+n15.capP99+' → '+n15.noCapP99+' 手。长尾被削平是「概率太高」的主因。';
  }
})();

// ── 明细表 ──
(function drawTable(){
  let h='<thead><tr><th>等级</th><th>均值</th><th>标准差</th><th>P10</th><th>P25</th><th>P50</th><th>P75</th><th>P90</th><th>P95</th><th>P99</th><th>最大</th></tr></thead><tbody>';
  DATA.levels.forEach(L=>{
    h+='<tr><td>+'+L.level+'</td><td>'+fmt(L.mean,2)+'</td><td>'+fmt(L.sd,2)+'</td><td>'+L.p10+'</td><td>'+L.p25+'</td><td>'+L.p50+'</td><td>'+L.p75+'</td><td>'+L.p90+'</td><td>'+L.p95+'</td><td>'+L.p99+'</td><td>'+L.max+'</td></tr>';
  });
  h+='</tbody>';
  document.getElementById('detail').innerHTML=h;
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(dir, 'report.html'), html, 'utf8');
console.log('HTML 写入：' + path.join(dir, 'report.html'));

// 回读 index.html 中注入的 SEARCH_DATA，复刻前端 match() 验证关键查询
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = html.match(/const SEARCH_DATA = (\[.*?\]);\nconst STATS/s);
if (!m) { console.error('SEARCH_DATA not found'); process.exit(1); }
const SEARCH_DATA = eval(m[1]);

function match(q) {
  q = q.trim().toLowerCase();
  const scored = [];
  for (const e of SEARCH_DATA) {
    const hay = (e.l + ' ' + e.g + ' ' + (e.k || []).join(' ')).toLowerCase();
    const idx = hay.indexOf(q);
    if (idx >= 0) { scored.push({ e, s: 100 - idx }); continue; }
    if (e.i && e.i.indexOf(q) >= 0) scored.push({ e, s: 60 - e.i.indexOf(q) });
    else if (e.f && e.f.indexOf(q) >= 0) scored.push({ e, s: 50 - e.f.indexOf(q) });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, 25).map((x) => x.e);
}

const cases = ['th', 'clx', 'cs', '苍龙', '易伤', '流波', 'ws', 'ttt'];
let fail = 0;
for (const q of cases) {
  const r = match(q).slice(0, 5).map((e) => `${e.l}[${e.c}]`);
  console.log(q.padEnd(6), '->', r.join(' | ') || '(无结果)');
}
// 断言
const has = (q, label) => match(q).some((e) => e.l.includes(label));
const topIs = (q, label) => match(q)[0] && match(q)[0].l.includes(label);
const checks = [
  ['th', '天华'], ['clx', '苍龙啸'], ['cs', '赤梭'], ['易伤', '易伤'],
  ['流波', '流波'], ['专注', '专注'], ['躲闪', '躲闪'],
];
for (const [q, label] of checks) {
  if (!has(q, label)) { console.error('FAIL:', q, '未命中', label); fail++; }
}
// th 首条必须是天华（防止英文 ID 噪声抢占）
if (!topIs('th', '天华')) { console.error('FAIL: th 首条不是天华，实际为', match('th')[0]); fail++; }
console.log(fail ? `\n${fail} 项失败` : '\n全部断言通过，总条目 ' + SEARCH_DATA.length);
process.exit(fail ? 1 : 0);

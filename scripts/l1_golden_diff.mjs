#!/usr/bin/env node
/**
 * 解析 l1_intent_fixture --verbose 输出，对每条 FAIL 做字段级 diff 归纳。
 * 用法: node scripts/l1_golden_diff.mjs scratch/l1_run_verbose.txt
 * 输出: 控制台摘要 + scratch/l1_golden_diff_report.json（逐条路径级差异）
 */
import fs from 'node:fs';

const file = process.argv[2] || 'scratch/l1_run_verbose.txt';
const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split('\n');

const records = [];
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^FAIL (\S+) \[(.*?)\] input=(.*)$/);
  if (!m) continue;
  // 后续行里找 "  golden: " 和 "  actual: "
  let goldenLine = null;
  let actualLine = null;
  for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
    if (lines[j].startsWith('  golden: ')) goldenLine = lines[j].slice('  golden: '.length);
    if (lines[j].startsWith('  actual: ')) actualLine = lines[j].slice('  actual: '.length);
  }
  records.push({ id: m[1], tags: m[2], input: m[3], goldenLine, actualLine });
}

function parseMaybe(s) {
  try { return { ok: true, v: JSON.parse(s) }; } catch (e) { return { ok: false, e: String(e), raw: s }; }
}

function diff(a, b, path = '', out = []) {
  if (a === b) return out;
  const ta = a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a;
  const tb = b === null ? 'null' : Array.isArray(b) ? 'array' : typeof b;
  if (ta !== tb) { out.push({ path, kind: 'type', golden: a, actual: b }); return out; }
  if (ta === 'array') {
    if (a.length !== b.length) out.push({ path: `${path}.length`, kind: 'len', golden: a.length, actual: b.length });
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) diff(a[i], b[i], `${path}[${i}]`, out);
    return out;
  }
  if (ta === 'object') {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) {
      const av = a?.[k];
      const bv = b?.[k];
      const p = path ? `${path}.${k}` : k;
      if (!(k in (a || {}))) out.push({ path: p, kind: 'added', actual: bv });
      else if (!(k in (b || {}))) out.push({ path: p, kind: 'removed', golden: av });
      else diff(av, bv, p, out);
      if (out.length > 60) return out;
    }
    return out;
  }
  out.push({ path, kind: 'value', golden: a, actual: b });
  return out;
}

/** 把差异路径折叠成签名（去掉数组下标），用于归类 */
function signature(d) {
  return `${d.kind}:${d.path.replace(/\[\d+\]/g, '[]')}`;
}

const report = [];
const sigCount = new Map();
for (const r of records) {
  if (!r.goldenLine || !r.actualLine) {
    report.push({ ...r, parseError: true, diffs: [] });
    continue;
  }
  const g = parseMaybe(r.goldenLine);
  const a = parseMaybe(r.actualLine);
  if (!g.ok || !a.ok) {
    report.push({ id: r.id, tags: r.tags, input: r.input, parseError: true,
      goldenErr: g.ok ? null : g.e, actualErr: a.ok ? null : a.e, diffs: [] });
    continue;
  }
  const diffs = diff(g.v, a.v);
  for (const d of diffs) {
    const s = signature(d);
    sigCount.set(s, (sigCount.get(s) || 0) + 1);
  }
  report.push({ id: r.id, tags: r.tags, input: r.input, diffCount: diffs.length, diffs });
}

fs.writeFileSync('scratch/l1_golden_diff_report.json', JSON.stringify(report, null, 2), 'utf8');

console.log(`FAIL 记录 ${records.length} 条，解析成功 ${report.filter(r => !r.parseError).length} 条`);
console.log('\n==== 差异路径签名 TOP ====');
[...sigCount.entries()].sort((x, y) => y[1] - x[1]).slice(0, 40)
  .forEach(([s, n]) => console.log(`${String(n).padStart(3)}  ${s}`));

console.log('\n==== 逐条摘要 ====');
for (const r of report) {
  if (r.parseError) { console.log(`\n${r.id}  [PARSE-FAIL] goldenErr=${r.goldenErr} actualErr=${r.actualErr}`); continue; }
  const sigs = [...new Set(r.diffs.map(signature))];
  console.log(`\n${r.id}  (${r.diffs.length} 处差异)`);
  for (const d of r.diffs.slice(0, 8)) {
    const g = JSON.stringify(d.golden);
    const a = JSON.stringify(d.actual);
    const trunc = (s) => (s && s.length > 120 ? `${s.slice(0, 120)}...` : s);
    console.log(`   ${d.kind.padEnd(7)} ${d.path}: ${trunc(g)} -> ${trunc(a)}`);
  }
  if (r.diffs.length > 8) console.log(`   ... 另 ${r.diffs.length - 8} 处，签名: ${sigs.slice(0, 6).join(' | ')}`);
}

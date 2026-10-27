/**
 * 导出 Cloudflare Analytics Engine（zx_events）数据到 CSV / JSON
 *
 * 一次性准备：
 *   1. Cloudflare Dashboard → My Profile → API Tokens → Create Custom Token
 *      权限：Account → Account Analytics → Read（只读，别给别的权限）
 *   2. Account ID：Workers & Pages 页面右侧栏
 *   3. 建 `.secrets/cloudflare-analytics.env`（已在 .gitignore 里）：
 *        CF_ACCOUNT_ID=xxxxxxxxxxxxxxxx
 *        CF_ANALYTICS_TOKEN=yyyyyyyyyyyyyyyy
 *
 * 用法：
 *   node scripts/export_analytics.mjs                # 跑全部预设查询
 *   node scripts/export_analytics.mjs summary        # 只跑指定的
 *   SQL="SELECT ..." node scripts/export_analytics.mjs custom   # 自定义
 *
 * 输出：scratch/analytics/<name>-<YYYYMMDD-HHmm>.csv 与 .json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.secrets/cloudflare-analytics.env');
const OUT_DIR = path.join(ROOT, 'scratch/analytics');

const DATASET = 'zx_events';

/** 预设查询 */
const QUERIES = {
  /** 总览：按状态 × 国家 */
  summary: `SELECT blob2 AS status, blob5 AS country, count() AS n,
                   count(DISTINCT index1) AS sessions,
                   sum(_sample_interval) AS weighted
            FROM ${DATASET}
            WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob2 != 'probe'
            GROUP BY status, country ORDER BY n DESC`,

  /** 字体健康度关键判据：loaded / error 分布 */
  font: `SELECT blob2 AS status,
                count() AS n,
                count(DISTINCT index1) AS sessions,
                min(double1) AS min_loaded, max(double1) AS max_loaded, avg(double1) AS avg_loaded,
                min(double2) AS min_err, max(double2) AS max_err, avg(double2) AS avg_err,
                min(double3) AS min_total, max(double3) AS max_total
         FROM ${DATASET}
         WHERE blob1 = 'font_check' AND blob2 != 'probe' AND timestamp > NOW() - INTERVAL '7' DAY
         GROUP BY status ORDER BY n DESC`,

  /** 按天趋势（看是否稳定、有无突增） */
  daily: `SELECT toDate(timestamp) AS day, blob2 AS status, count() AS n
          FROM ${DATASET}
          WHERE blob1 = 'font_check' AND timestamp > NOW() - INTERVAL '30' DAY
          GROUP BY day, status ORDER BY day DESC, n DESC`,

  /** 按小时趋势（今天） */
  hourly: `SELECT toStartOfHour(timestamp) AS hour, blob2 AS status, count() AS n
           FROM ${DATASET}
           WHERE blob1 = 'font_check' AND timestamp > NOW() - INTERVAL '2' DAY
           GROUP BY hour, status ORDER BY hour DESC`,

  /** 明细（最多 5000 行，用于自己算） */
  detail: `SELECT timestamp, index1 AS sid, blob1 AS event, blob2 AS status,
                  blob3 AS network, blob4 AS page, blob5 AS country,
                  double1 AS loaded, double2 AS error, double3 AS total, double4 AS viewport
           FROM ${DATASET}
           WHERE timestamp > NOW() - INTERVAL '7' DAY
           ORDER BY timestamp DESC LIMIT 5000`,
};

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync(ENV_FILE)) {
    for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

const env = loadEnv();
const ACCOUNT = env.CF_ACCOUNT_ID;
const TOKEN = env.CF_ANALYTICS_TOKEN;

if (!ACCOUNT || !TOKEN) {
  console.error('缺少凭证。请创建 .secrets/cloudflare-analytics.env：');
  console.error('  CF_ACCOUNT_ID=...');
  console.error('  CF_ANALYTICS_TOKEN=...   （权限：Account → Account Analytics → Read）');
  process.exit(1);
}

const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
};

async function runQuery(name, sql) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: sql,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[${name}] HTTP ${res.status}: ${text.slice(0, 300)}`);
    return null;
  }

  let rows;
  try {
    const json = JSON.parse(text);
    rows = Array.isArray(json) ? json : json.data ?? [];
  } catch {
    // 兜底：按 JSONEachRow 解析
    rows = text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '').replace(/-/g, '');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const base = path.join(OUT_DIR, `${name}-${stamp}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(rows, null, 2), 'utf8');
  fs.writeFileSync(`${base}.csv`, toCsv(rows), 'utf8');

  console.log(`\n=== ${name} === ${rows.length} 行 → ${path.relative(ROOT, base)}.csv`);
  console.table(rows.slice(0, 12));
  if (rows.length > 12) console.log(`… 其余 ${rows.length - 12} 行见 CSV`);
  return rows;
}

const target = process.argv[2];
const customSql = env.SQL;

if (customSql && (!target || target === 'custom')) {
  await runQuery('custom', customSql);
} else if (target && QUERIES[target]) {
  await runQuery(target, QUERIES[target]);
} else {
  if (target) console.error(`未知查询 "${target}"，可选：${Object.keys(QUERIES).join(' / ')}`);
  for (const [name, sql] of Object.entries(QUERIES)) {
    await runQuery(name, sql);
  }
}

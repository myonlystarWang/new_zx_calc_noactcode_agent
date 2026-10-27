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

/** 预设查询（槽位定义见 doc/埋点系统规划_20261026.md §4） */
const QUERIES = {
  /** 总览：各事件量级 × 环境。第一眼看「哪批事件在出数」 */
  overview: `SELECT blob1 AS event, blob6 AS env, count() AS n,
                    count(DISTINCT index1) AS sessions
             FROM ${DATASET}
             WHERE timestamp > NOW() - INTERVAL '7' DAY
             GROUP BY event, env ORDER BY event, n DESC`,

  /** 会话基线：来源 × 环境。所有比例的分母 */
  sessions: `SELECT blob2 AS ref, blob6 AS env, count(DISTINCT index1) AS sessions
             FROM ${DATASET}
             WHERE blob1 = 'session_start' AND timestamp > NOW() - INTERVAL '7' DAY
             GROUP BY ref, env ORDER BY sessions DESC`,

  /** 字体健康度：double1 = Serif（主标题）已加载分片数，0 就是真退化 */
  font: `SELECT blob2 AS status, count() AS n, count(DISTINCT index1) AS sessions,
                min(double1) AS min_serif, max(double1) AS max_serif, avg(double1) AS avg_serif,
                sum(double2) AS err_sum, max(double3) AS max_serif_total
         FROM ${DATASET}
         WHERE blob1 = 'font_check' AND blob2 != 'probe' AND timestamp > NOW() - INTERVAL '7' DAY
         GROUP BY status ORDER BY n DESC`,

  /** 工具热度 + 入口有效率 */
  tools: `SELECT blob2 AS tool, blob3 AS src, count() AS opens,
                 count(DISTINCT index1) AS sessions
          FROM ${DATASET}
          WHERE blob1 = 'open_tool' AND timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY tool, src ORDER BY tool, sessions DESC`,

  /** ★ 点击热点：哪个职业 / 部位被点最多 → 内容投入的直接依据 */
  clicks: `SELECT blob2 AS ct, blob7 AS sub, blob3 AS opt, count() AS clicks,
                  count(DISTINCT index1) AS sessions
           FROM ${DATASET}
           WHERE blob1 = 'card_click' AND timestamp > NOW() - INTERVAL '7' DAY
           GROUP BY ct, sub, opt ORDER BY clicks DESC LIMIT 200`,

  /** 分享通道：决定「分享要不要扩到 4 个模拟器」 */
  share: `SELECT blob2 AS ch, count() AS clicks, count(DISTINCT index1) AS sessions
          FROM ${DATASET}
          WHERE blob1 = 'share_click' AND timestamp > NOW() - INTERVAL '7' DAY
          GROUP BY ch ORDER BY clicks DESC`,

  /** PWA 安装引导：曝光 / 关闭 / 入口点击 / 一键安装 */
  install: `SELECT blob2 AS act, blob3 AS src, blob6 AS env, count() AS n
            FROM ${DATASET}
            WHERE blob1 = 'install_prompt' AND timestamp > NOW() - INTERVAL '7' DAY
            GROUP BY act, src, env ORDER BY act, n DESC`,

  /** GEO 落地页：view / click_home */
  static: `SELECT blob2 AS act, count() AS n, count(DISTINCT index1) AS sessions
           FROM ${DATASET}
           WHERE blob1 = 'static_page' AND timestamp > NOW() - INTERVAL '7' DAY
           GROUP BY act`,

  /** AI 成本结构：本地命中 / AI 兜底 / 识图 */
  chat: `SELECT blob2 AS src, count() AS n, count(DISTINCT index1) AS sessions
         FROM ${DATASET}
         WHERE blob1 = 'chat_send' AND timestamp > NOW() - INTERVAL '7' DAY
         GROUP BY src ORDER BY n DESC`,

  /** 词表缺口：AI 兜底时的原话（前 20 字）排行 */
  gaps: `SELECT blob3 AS q, count() AS n
         FROM ${DATASET}
         WHERE blob1 = 'chat_send' AND blob2 = 'ai' AND timestamp > NOW() - INTERVAL '7' DAY
         GROUP BY q ORDER BY n DESC LIMIT 100`,

  /** 按天趋势（看是否稳定、有无突增） */
  daily: `SELECT toDate(timestamp) AS day, blob1 AS event, count() AS n
          FROM ${DATASET}
          WHERE timestamp > NOW() - INTERVAL '30' DAY
          GROUP BY day, event ORDER BY day DESC, n DESC`,

  /** 明细（最多 5000 行，用于自己算） */
  detail: `SELECT timestamp, index1 AS sid, blob1 AS event, blob2 AS detail,
                  blob3 AS extra, blob4 AS page, blob5 AS country, blob6 AS env,
                  blob7 AS sub, double1 AS v1, double2 AS v2, double3 AS v3, double4 AS vw
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

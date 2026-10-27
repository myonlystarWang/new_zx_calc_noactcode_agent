/**
 * 生成静态数据页：web_app/public/data/index.html
 *
 * 目的：给搜索引擎与 AI 爬虫一份「可直出的结构化数据页」。
 * 纯 HTML + 内联样式，不依赖任何外部资源（不加载 Google Fonts、不引 JS）。
 *
 * 数据来源：
 *   · 新天缘 / 轩辕策 → 读 public/game_data/*.json（随数据自动更新）
 *   · 蕴灵 / 神机     → 站内已验证的常量（见下方 CONST 注释），改数据时需同步这里
 *
 * 生成物不入库（.gitignore 已忽略），由 package.json 的 prebuild 触发。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DATA = path.join(ROOT, 'web_app/public/game_data');
const OUT_DIR = path.join(ROOT, 'web_app/public/data');
const SITE = 'https://zxai.raddishlab.com';

const readJson = (f) => JSON.parse(fs.readFileSync(path.join(GAME_DATA, f), 'utf8'));
const pct = (v) => `${+(v * 100).toFixed(2)}%`;

// ------------------------------------------------------------
// 站内常量（与 web_app/src 中的模拟器口径一致，改动需同步）
// 蕴灵：月德符三套曲线（客户端表 280）、单级手数软上限 300
// 神机：红档 6%（2026-10 由 10% 调整）
// ------------------------------------------------------------
const YUNLING = {
    perLevel: { 通用: 1962, 腰带: 4422, 袖甲: 6069 },
    softCap: 300,
    fullPath: { tries: 381, fuda: 39891, note: '通用装备 +0 → +15 的平均值' },
};

const SHENJI_RED = 0.06;

// ------------------------------------------------------------
const tianyuan = readJson('new_tianyuan_data.json');
const xyc = readJson('xyc_refine.json');

const countProbs = (tianyuan.countProbabilities || [])
    .slice()
    .sort((a, b) => a.count - b.count)
    .map((x) => ({ k: `${x.count} 条`, v: pct(x.probability) }));

const triggerProbs = (tianyuan.triggerProbabilities || [])
    .slice()
    .sort((a, b) => a.count - b.count)
    .map((x) => ({ k: `${x.count} 点`, v: pct(x.probability) }));

const versions = xyc.meta?.versions || ['普通', '典藏', '英雄'];
const xycRows = [];
for (const ver of versions) {
    const books = xyc.pools?.[ver] || {};
    const bookNames = Object.keys(books);
    if (!bookNames.length) continue;
    const sample = books[bookNames[0]]?.['6'];
    if (!sample) continue;
    xycRows.push({
        ver,
        tier: (sample.tierProbs || []).map(pct).join(' / '),
        attrCount: Object.entries(sample.attrCountProbs || {})
            .filter(([, v]) => v > 0)
            .sort((a, b) => Number(a[0]) - Number(b[0]))
            .map(([k, v]) => `${k} 条 ${pct(v)}`)
            .join('，') || '—',
        // skillProb = 1 表示必出，显示 100% 容易被误解成「有概率」
        skill: sample.skillProb >= 1 ? '必出' : sample.skillProb ? pct(sample.skillProb) : '无',
        // 基础 10 次；普通/典藏用道具到 25，英雄版用「相易」到 30
        washMax:
            ver === '英雄'
                ? `10 → ${xyc.meta?.heroWashMaxWithItem ?? 30}`
                : `10 → ${xyc.meta?.washMaxWithItem ?? 25}`,
    });
}

// ------------------------------------------------------------
// 每张表下面都带来源与域名：这张页面的表格最可能被截图转发，
// 品牌行必须紧贴表格，否则被裁掉就等于免费给别人做素材。
const SRC_LINE = '<p class="src">数据来源：天书万象 AI · zxai.raddishlab.com</p>';

const table = (headers, rows) => `
  <table>
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  ${SRC_LINE}`;

const kvTable = (pairs) => table(['项目', '数值'], pairs.map((p) => [p.k, p.v]));

const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebPage',
            '@id': `${SITE}/data/#page`,
            url: `${SITE}/data/`,
            name: '诛仙 3 概率公示与属性上限速查',
            description: '诛仙 3 各系统概率公示：新天缘属性条数与天命触发、轩辕策洗练五档、装备蕴灵月德符曲线、神机洗练档位。数据来自游戏客户端整理。',
            inLanguage: 'zh-CN',
            isPartOf: { '@type': 'WebSite', name: '天书万象 AI', url: `${SITE}/` },
        },
        {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: '天书万象 AI', item: `${SITE}/` },
                { '@type': 'ListItem', position: 2, name: '概率公示', item: `${SITE}/data/` },
            ],
        },
    ],
};

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>诛仙 3 概率公示与属性上限速查 · 天书万象 AI</title>
<meta name="description" content="诛仙 3 各系统概率公示：新天缘 3/4/5 条属性概率 60%/30%/10%，轩辕策洗练五档，装备蕴灵月德符曲线，神机洗练档位。数据来自客户端数据整理。" />
<link rel="canonical" href="${SITE}/data/" />
<meta name="robots" content="index, follow" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 18px 60px; background: #0b0f17; color: #cbd5e1;
         font-family: -apple-system, "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", sans-serif;
         line-height: 1.65; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 860px; margin: 0 auto; }
  header { padding: 34px 0 22px; border-bottom: 1px solid #1e293b; }
  h1 { font-size: 24px; font-weight: 600; color: #e2e8f0; margin: 0 0 8px; letter-spacing: .5px; }
  .sub { font-size: 13.5px; color: #64748b; margin: 0; }
  h2 { font-size: 17px; font-weight: 600; color: #67e8f9; margin: 34px 0 10px; }
  h3 { font-size: 14px; font-weight: 600; color: #94a3b8; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 4px; font-size: 13.5px; }
  th { text-align: left; font-weight: 500; color: #94a3b8; padding: 8px 10px;
       border-bottom: 1px solid #334155; background: #111a28; }
  td { padding: 8px 10px; border-bottom: 1px solid #16202e; color: #cbd5e1; }
  tbody tr:hover td { background: #0e1420; }
  td:first-child { color: #e2e8f0; }
  .note { font-size: 12.5px; color: #64748b; margin: 10px 0 0; }
  .src { font-size: 11px; color: #475569; margin: 2px 0 14px; text-align: right; letter-spacing: .2px; }
  .cta { display: inline-block; margin-top: 10px; padding: 9px 18px; border-radius: 999px;
         background: rgba(34,211,238,.12); color: #67e8f9; text-decoration: none;
         font-size: 13px; border: 1px solid rgba(34,211,238,.35); }
  .cta:hover { background: rgba(34,211,238,.2); }
  footer { margin-top: 46px; padding-top: 20px; border-top: 1px solid #1e293b;
           font-size: 12.5px; color: #475569; }
  footer a { color: #67e8f9; text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>诛仙 3 概率公示 · 速查表</h1>
    <p class="sub">数据来自游戏客户端整理，非官方公示。整理：天书万象 AI（2026-10-27）</p>
  </header>

  <main>
    <h2 id="tianyuan">新天缘</h2>
    <h3>属性条数概率</h3>
    ${kvTable(countProbs)}
    <h3>天命触发概率</h3>
    ${kvTable(triggerProbs)}
    <p class="note">天命系数：1、2、4、4、6、6、6、6、6、6（对应 +1 ~ +10 各点）。</p>
    <a class="cta" href="${SITE}/">打开新天缘模拟器 →</a>

    <h2 id="xyc">轩辕策洗练</h2>
    <h3>六品洗练五档概率（按版本）</h3>
    ${table(['版本', '五档概率（最低档 → 最高档）', '属性条数概率', '技能概率', '洗练上限'], xycRows.map((r) => [r.ver, r.tier, r.attrCount, r.skill, r.washMax]))}
    <p class="note">同一本书整本共用一档；档内属性值均匀分布。2026-03-31 更新后，青龙/白虎英雄版可用「轩辕拾遗录·相易」把上限提到 30 次，达 25 次后进入特殊洗练（可自选本职业 3 级技能、最多锁 2 条）。</p>
    <a class="cta" href="${SITE}/">打开轩辕策洗练 →</a>

    <h2 id="yunling">装备蕴灵</h2>
    <h3>月德符消耗曲线（按装备类型）</h3>
    ${kvTable(Object.entries(YUNLING.perLevel).map(([k, v]) => [k + '装备', `${v.toLocaleString()} 符 / 级`]))}
    <h3>关键数值</h3>
    ${kvTable([
        ['单级手数软上限', `${YUNLING.softCap} 手（超过后成功率线性抬升到 100%）`],
        ['+0 → +15 平均消耗', `${YUNLING.fullPath.tries} 手 / ${YUNLING.fullPath.fuda.toLocaleString()} 符（${YUNLING.fullPath.note}）`],
        ['成功率公式', '基础概率 ×（1 + 装备幸运增益 + 个人幸运增益）'],
        ['装备幸运范围', '0 ~ 1200'],
    ])}
    <p class="note">失败掉 1 级，但不跌破 +3 / +6 / +9 档位下限。实际消耗受装备幸运值影响，建议在自己的装备幸运值下用模拟器计算。</p>
    <a class="cta" href="${SITE}/">打开蕴灵模拟器 →</a>

    <h2 id="shenji">神机洗练</h2>
    ${kvTable([['红档概率', pct(SHENJI_RED) + '（2026-10 由 10% 调整）']])}
    <p class="note">其余档位概率与各部件差异见站内神机模拟器。</p>
    <a class="cta" href="${SITE}/">打开神机模拟器 →</a>

  </main>

  <footer>
    天书万象 AI · 诛仙全知大模型 —— 玩家自建工具站，与完美世界 / 诛仙官方无关。<br />
    概率与属性来自客户端数据整理，随游戏版本更新可能变化；模拟器采用独立随机，与游戏内伪随机机制可能存在差异。<br />
    <a href="${SITE}/">返回工具站</a>
  </footer>
</div>
<script>
/* 埋点：这个页面不加载 React，track.ts 不会执行，只能内联。
   与站内共用同一个 zx_sid，才能算「落地页 → 进站 → 用工具」的完整漏斗。
   事件定义见 doc/埋点系统规划_20261026.md §3.5。 */
(function () {
  var sid = 'anon';
  try {
    sid = sessionStorage.getItem('zx_sid') || Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem('zx_sid', sid);
  } catch (e) {}
  function send(act) {
    try {
      navigator.sendBeacon('/api/track', new Blob([JSON.stringify({
        e: 'static_page', s: sid,
        d: { detail: act, extra: location.hostname, path: location.pathname, vw: innerWidth }
      })], { type: 'application/json' }));
    } catch (e) {}
  }
  send('view');
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="${SITE}"]');
    if (a) send('click_home');
  }, true);
})();
</script>
</body>
</html>
`;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
console.log(`[static-pages] 已生成 public/data/index.html（${(html.length / 1024).toFixed(1)}KB）`);
console.log(`  新天缘条数：${countProbs.map((x) => `${x.k} ${x.v}`).join(' / ')}`);
console.log(`  轩辕策版本：${xycRows.map((r) => r.ver).join(' / ')}`);

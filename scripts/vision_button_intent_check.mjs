/**
 * 识图卡「查新天缘词条池」按钮的落点校验：
 * query 必须命中 tianyuan_new 信息卡（不是模拟器、不是右分屏），且带上部位与等级。
 * 用法：node scripts/vision_button_intent_check.mjs
 */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'web_app/src');
const GD = path.join(ROOT, 'web_app/public/game_data');
const TMP = path.join(ROOT, 'node_modules/.cache/zx-intent-check');
fs.mkdirSync(TMP, { recursive: true });
const pj = p => p.replace(/\\/g, '/');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const entry = path.join(TMP, 'entry.ts');
fs.writeFileSync(entry, `
export { CopilotService } from '${pj(SRC)}/services/CopilotService';
export { DataService } from '${pj(SRC)}/services/DataService';
`, 'utf8');
const outfile = path.join(TMP, 'entry.mjs');
await build({
    entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', target: 'node18',
    outfile, logLevel: 'error', loader: { '.tsx': 'tsx', '.ts': 'ts' },
    external: ['react', 'react-dom', 'lucide-react', 'clsx']
});
const { CopilotService, DataService } = await import(pathToFileURL(outfile).href);

const ds = DataService.getInstance();
ds.getNewTianYuanData = async () => readJson(path.join(GD, 'new_tianyuan_data.json'));
ds.getTianYuanData = async () => readJson(path.join(GD, 'tianyuan_old.json'));

/** 意图链里还会摸到别的数据：把 fetch 接到 web_app/public/game_data 上，缺文件就当 404 */
globalThis.fetch = async url => {
    const name = String(url).split('/').pop().split('?')[0];
    const p = path.join(GD, name);
    if (fs.existsSync(p)) {
        return { ok: true, status: 200, json: async () => readJson(p), text: async () => fs.readFileSync(p, 'utf8') };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
};

const svc = CopilotService.getInstance();
const cases = [
    ['查新天缘词条池 上玄佑万辰须弥盔 10级', 'tianyuan_new', '上玄佑万辰须弥盔'],
    ['新天缘词条池 上玄佑万辰须弥甲 0级', 'tianyuan_new', '上玄佑万辰须弥甲'],
    ['新天缘词条池', 'tianyuan_new', undefined],
    ['新天缘精炼', 'tianyuan_sim', undefined],
    ['新天缘', 'tianyuan_sim', undefined],
    /* 识图卡「打开轩辕策洗练」按钮发的 query：必须落 xyc_wash 洗练卡，不是分屏、也不是 xyc_tome */
    ['轩辕策洗练 青龙 英雄 六品 20级', 'xyc_wash', undefined],
    ['轩辕策洗练 玄武 普通 三品 1级', 'xyc_wash', undefined],
    /* 裸「轩辕策」仍出属性信息卡（旧 xyc_diag「轩辕策属性模拟」入口已删：它是死代码且跳右分屏） */
    ['轩辕策', 'xyc_tome', undefined],
    ['青龙书', 'xyc_tome', undefined]
];

const fails = [];
for (const [q, wantType, wantGroup] of cases) {
    const msg = await svc.matchLocalIntent(q, '00:00');
    const got = msg?.cardType || '(none)';
    const group = msg?.cardData?.initialGroupName;
    const lvl = msg?.cardData?.initialLevel;
    const okType = got === wantType;
    const okGroup = wantGroup === undefined || group === wantGroup;
    const extra = got === 'xyc_wash'
        ? ` · ${msg.cardData.initialBeast}/${msg.cardData.initialVersion}/${msg.cardData.initialGrade}品/${msg.cardData.initialLevel}级`
        : '';
    console.log(`${okType && okGroup ? 'PASS' : 'FAIL'}  ${q.padEnd(34)} → ${got}${group ? ' · ' + group : ''}${typeof lvl === 'number' ? ' · ' + lvl + '级' : ''}${extra}`);
    if (!okType || !okGroup) fails.push({ q, got, group, wantType, wantGroup });
}

/* 轩辕策洗练卡：四系 / 版本 / 品阶 / 等级 必须按识图卡的 seed 预填 */
const washExpect = [
    ['轩辕策洗练 青龙 英雄 六品 20级', { initialBeast: '青龙', initialVersion: '英雄', initialGrade: 6, initialLevel: 20 }],
    ['轩辕策洗练 玄武 普通 三品 1级', { initialBeast: '玄武', initialVersion: '普通', initialGrade: 3, initialLevel: 1 }]
];
for (const [q, want] of washExpect) {
    const msg = await svc.matchLocalIntent(q, '00:00');
    const got = msg?.cardData || {};
    const bad = Object.entries(want).filter(([k, v]) => got[k] !== v);
    console.log(`${bad.length ? 'FAIL' : 'PASS'}  预填 ${q.padEnd(24)} → ${JSON.stringify({ beast: got.initialBeast, ver: got.initialVersion, grade: got.initialGrade, lv: got.initialLevel })}`);
    if (bad.length) fails.push({ q, bad });
}

console.log(fails.length ? `\n❌ ${fails.length} 项失败` : '\n✅ 全部通过');
process.exit(fails.length ? 1 : 0);

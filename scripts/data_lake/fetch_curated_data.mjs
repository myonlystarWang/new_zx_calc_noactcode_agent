/**
 * scripts/data_lake/fetch_curated_data.mjs
 * 手动按需数据提取流水线：
 * 1. 提纯法宝图鉴 (fabao_curated.json)
 * 2. 提纯精选主流装备 (equip_curated.json: 修武/昭武/彰武/神隐)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.resolve(__dirname, '../../web_app/public/game_data');

async function extractFabao() {
    console.log('[1/2] 正在抽取法宝图鉴数据...');
    let htmlContent = '';
    const localBrainStepPath = 'C:/Users/ww/.gemini/antigravity/brain/d1f44039-e8a9-41ad-a8b3-7d9e9cece2fe/.system_generated/steps/454/content.md';
    if (fs.existsSync(localBrainStepPath)) {
        htmlContent = fs.readFileSync(localBrainStepPath, 'utf8');
    } else {
        console.log('本地缓存未命中，从 zx.res111.com 获取 fabao.html...');
        const res = await fetch('https://zx.res111.com/fabao.html');
        htmlContent = await res.text();
    }

    const match = htmlContent.match(/var D=(\{[\s\S]*?\});/);
    if (!match) {
        throw new Error('未在 fabao.html 中匹配到 var D 数据');
    }

    const rawData = JSON.parse(match[1]);
    const fabaoList = rawData['法宝列表'] || [];
    console.log(`成功解析 ${fabaoList.length} 件法宝。`);

    const outPath = path.join(TARGET_DIR, 'fabao_curated.json');
    fs.writeFileSync(outPath, JSON.stringify(fabaoList, null, 2), 'utf8');
    console.log(`已写入: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

async function extractEquip() {
    console.log('[2/2] 正在抓取精选装备数据 (修武/昭武/彰武/神隐)...');
    const qualities = ['修武', '昭武', '彰武', '神隐'];
    const slots = ['武器', '头盔', '衣服', '靴子'];
    const allItems = [];

    for (const q of qualities) {
        for (const s of slots) {
            const url = `https://zx.res111.com/api/api/equip/list?qu=${encodeURIComponent(q)}&slot=${encodeURIComponent(s)}`;
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const items = data.items || [];
                console.log(`  - 品质 [${q}] 部位 [${s}]: 获取到 ${items.length} 件`);
                allItems.push(...items);
            } catch (err) {
                console.error(`  - 获取 [${q} - ${s}] 失败:`, err.message);
            }
        }
    }

    console.log(`共收集到 ${allItems.length} 件精选装备。`);
    const outPath = path.join(TARGET_DIR, 'equip_curated.json');
    fs.writeFileSync(outPath, JSON.stringify(allItems, null, 2), 'utf8');
    console.log(`已写入: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

async function main() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    await extractFabao();
    await extractEquip();
    console.log('✅ 数据湖 Phase 1 数据提取已顺利完成！');
}

main().catch(err => {
    console.error('❌ 数据抽取失败:', err);
    process.exit(1);
});

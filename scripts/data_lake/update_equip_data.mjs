import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_FILE = path.resolve(__dirname, '../../web_app/public/game_data/equip_curated.json');
const DIST_FILE = path.resolve(__dirname, '../../web_app/dist/game_data/equip_curated.json');

const API_BASE = 'https://zx.res111.com/api/api';

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            if (i === retries - 1) throw err;
            await new Promise(r => setTimeout(r, 600));
        }
    }
}

async function main() {
    console.log('读取现有 equip_curated.json...');
    const currentData = JSON.parse(fs.readFileSync(PUBLIC_FILE, 'utf8'));
    console.log(`现有装备数: ${currentData.length}`);

    // 1. 抓取全量戒指 (300件，包括金甲戒、九曲、造化、天机等)
    console.log('正在从 zx.res111.com 抓取全量戒指...');
    const ringsRes = await fetchWithRetry(`${API_BASE}/equip/list?slot=${encodeURIComponent('戒指')}`);
    const rings = (ringsRes && ringsRes.items) || [];
    console.log(`获取到戒指: ${rings.length} 件`);

    // 2. 抓取全量项链 (300件，包括命运、狡诈、抗性装、战神等全品类项链)
    console.log('正在从 zx.res111.com 抓取全量项链...');
    const necksRes = await fetchWithRetry(`${API_BASE}/equip/list?slot=${encodeURIComponent('项链')}`);
    const necks = (necksRes && necksRes.items) || [];
    console.log(`获取到项链: ${necks.length} 件`);

    // 3. 构建去重池
    const allItems = [];
    const seen = new Set();

    // 先加入抓取到的全量戒指与项链
    for (const r of rings) {
        const item = { ...r, slot: '戒指', q: r.q || '' };
        const key = `${item.name}_${item.q}_${item.slot}`;
        if (!seen.has(key)) {
            seen.add(key);
            allItems.push(item);
        }
    }
    for (const n of necks) {
        const item = { ...n, slot: '项链', q: n.q || '' };
        const key = `${item.name}_${item.q}_${item.slot}`;
        if (!seen.has(key)) {
            seen.add(key);
            allItems.push(item);
        }
    }

    // 加入现有装备库中的其他装备（法身、罡气、护符、勋章、玺绶、锦囊、佩章等）
    // 并且针对 5 个位置（武器、头盔、衣服、靴子、袖甲），剔除除了修武、昭武、彰武、混虚之外的所有老旧装备
    const YUNLING_SLOTS = ['武器', '头盔', '衣服', '靴子', '袖甲'];
    let filteredLegacy5SlotCount = 0;

    for (const it of currentData) {
        if (YUNLING_SLOTS.includes(it.slot)) {
            // 剔除除了修武、昭武、彰武、混虚之外的装备（如天弈至尊魔刺等）
            const isAllowed = (it.name && it.name.includes('混虚')) || ['修武', '昭武', '彰武'].includes(it.q);
            if (!isAllowed) {
                filteredLegacy5SlotCount++;
                continue;
            }
        }

        const key = `${it.name}_${it.q || ''}_${it.slot || ''}`;
        if (!seen.has(key)) {
            seen.add(key);
            allItems.push(it);
        }
    }

    console.log(`剔除 5 部位非修武/昭武/彰武/混虚的老旧装备: ${filteredLegacy5SlotCount} 件`);
    console.log(`新装备全集总计: ${allItems.length} 件`);

    // 检验金甲戒与项链
    const jinjia = allItems.find(i => i.name === '金甲戒');
    console.log('金甲戒存在状态:', jinjia ? `成功包含 (id: ${jinjia.id}, slot: ${jinjia.slot})` : '未找到');

    const totalRings = allItems.filter(i => i.slot === '戒指').length;
    const totalNecks = allItems.filter(i => i.slot === '项链').length;
    console.log(`戒指总数: ${totalRings}, 项链总数: ${totalNecks}`);

    fs.writeFileSync(PUBLIC_FILE, JSON.stringify(allItems, null, 2), 'utf8');
    if (fs.existsSync(path.dirname(DIST_FILE))) {
        fs.writeFileSync(DIST_FILE, JSON.stringify(allItems, null, 2), 'utf8');
    }
    console.log('equip_curated.json 更新完成！');
}

main().catch(err => {
    console.error('更新失败:', err);
    process.exit(1);
});

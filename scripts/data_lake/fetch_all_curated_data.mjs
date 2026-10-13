/**
 * scripts/data_lake/fetch_all_curated_data.mjs
 * 全量数据湖抽取流水线：
 * 1. 抓取修武/昭武/彰武/神隐/神级/天命/至尊的全 14 个部位装备 (保存至 equip_curated.json)
 *    部位涵盖: 头盔, 衣服, 靴子, 武器, 袖甲, 腰带, 项链, 戒指, 法身, 罡气, 护符, 勋章, 玺绶, 锦囊
 * 2. 抓取全 28 门派全套原生职业技能 (过滤排除 6916 个 NPC/测试/任务技能，保存至 all_skills_curated.json)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_DIR = path.resolve(__dirname, '../../web_app/public/game_data');

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

async function extractEquipFull() {
    console.log('[1/2] 正在抽取全 14 部位高频主流装备...');
    const qualities = ['修武', '昭武', '彰武', '神隐', '神级', '天命', '至尊'];
    const slots = [
        '武器', '头盔', '衣服', '靴子', '袖甲', '腰带',
        '项链', '戒指', '法身', '罡气', '护符', '勋章', '玺绶', '锦囊'
    ];

    const allItems = [];
    const seenKeys = new Set();

    for (const q of qualities) {
        for (const s of slots) {
            const url = `${API_BASE}/equip/list?qu=${encodeURIComponent(q)}&slot=${encodeURIComponent(s)}`;
            try {
                const data = await fetchWithRetry(url);
                const items = data.items || [];
                let added = 0;
                for (const it of items) {
                    const key = `${it.name}_${it.q || q}_${it.slot || s}`;
                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        allItems.push({
                            ...it,
                            q: it.q || q,
                            slot: it.slot || s
                        });
                        added++;
                    }
                }
                if (added > 0) {
                    console.log(`  - [${q}] [${s}]: 获取到 ${added} 件`);
                }
            } catch (err) {
                console.error(`  - 获取 [${q} - ${s}] 失败:`, err.message);
            }
        }
    }

    const specialSlots = ['项链', '戒指', '法身', '罡气', '勋章', '玺绶', '锦囊', '佩章'];
    for (const s of specialSlots) {
        const url = `${API_BASE}/equip/list?slot=${encodeURIComponent(s)}`;
        try {
            const data = await fetchWithRetry(url);
            const items = data.items || [];
            let added = 0;
            for (const it of items) {
                const key = `${it.name}_${it.q || ''}_${it.slot || s}`;
                if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    allItems.push({
                        ...it,
                        q: it.q || '',
                        slot: it.slot || s
                    });
                    added++;
                }
            }
            if (added > 0) {
                console.log(`  - [全品质] [${s}]: 获取到 ${added} 件`);
            }
        } catch (err) {
            console.error(`  - 获取 [全品质 - ${s}] 失败:`, err.message);
        }
    }

    // 剔除 5 个部位（武器、头盔、衣服、靴子、袖甲）中非修武/昭武/彰武/混虚的老旧装备
    const YUNLING_SLOTS = ['武器', '头盔', '衣服', '靴子', '袖甲'];
    const filteredItems = allItems.filter(it => {
        if (YUNLING_SLOTS.includes(it.slot)) {
            return (it.name && it.name.includes('混虚')) || ['修武', '昭武', '彰武'].includes(it.q);
        }
        return true;
    });

    console.log(`装备抽取完成，总计去重后得到 ${filteredItems.length} 件装备。`);
    const outPath = path.join(TARGET_DIR, 'equip_curated.json');
    fs.writeFileSync(outPath, JSON.stringify(filteredItems, null, 2), 'utf8');
    console.log(`已写入: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

async function extractSkillsFull() {
    console.log('[2/2] 正在抽取全职业原生技能数据 (过滤 6916 个 NPC/测试/任务技能)...');
    const groupsData = await fetchWithRetry(`${API_BASE}/skills/groups`);
    const groups = groupsData.groups || [];
    console.log(`获取到 ${groups.length} 个技能组。`);

    const validGroups = groups.filter(g => {
        // 严格排除【其他技能(NPC/任务/测试)】
        if (g.key === 'misc' || g.name.includes('NPC') || g.name.includes('测试')) {
            console.log(`  - 跳过非职业技能组: [${g.i}] ${g.name} (${g.count} 个)`);
            return false;
        }
        return true;
    });

    console.log(`待抓取职业技能组数量: ${validGroups.length} 个`);

    const allSkills = [];
    const seenSkillIds = new Set();

    // 并发抓取，控制并发数为 6
    const concurrency = 6;
    for (let i = 0; i < validGroups.length; i += concurrency) {
        const batch = validGroups.slice(i, i + concurrency);
        await Promise.all(batch.map(async (g) => {
            try {
                const groupDetail = await fetchWithRetry(`${API_BASE}/skills/group?i=${g.i}`);
                const skills = Array.isArray(groupDetail) ? groupDetail : (groupDetail.skills || []);
                for (const s of skills) {
                    if (!seenSkillIds.has(s.id)) {
                        seenSkillIds.add(s.id);
                        allSkills.push({
                            ...s,
                            group_name: g.name,
                            group_kind: g.kind
                        });
                    }
                }
            } catch (err) {
                console.error(`  - 抓取技能组 [${g.name}] 失败:`, err.message);
            }
        }));
        if ((i + concurrency) % 30 < concurrency) {
            console.log(`  - 技能抽取进度: ${Math.min(i + concurrency, validGroups.length)} / ${validGroups.length}`);
        }
    }

    console.log(`技能抽取完成，总计收集 ${allSkills.length} 个有效职业技能。`);
    const outPath = path.join(TARGET_DIR, 'all_skills_curated.json');
    fs.writeFileSync(outPath, JSON.stringify(allSkills, null, 2), 'utf8');
    console.log(`已写入: ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    await extractEquipFull();
    const skillsPath = path.join(TARGET_DIR, 'all_skills_curated.json');
    if (fs.existsSync(skillsPath) && fs.statSync(skillsPath).size > 1024 * 1024) {
        console.log(`all_skills_curated.json 已存在 (${(fs.statSync(skillsPath).size / 1024 / 1024).toFixed(2)} MB)，跳过重复抓取。`);
    } else {
        await extractSkillsFull();
    }
    console.log('数据湖抽取清洗全部就绪！');
}

main().catch(err => {
    console.error('抽取失败:', err);
    process.exit(1);
});

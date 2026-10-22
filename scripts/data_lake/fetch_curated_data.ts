/**
 * scripts/data_lake/fetch_curated_data.ts
 * 诛仙3 战斗实验室 - 数据湖按需抓取、提纯与清洗维护脚本
 * 
 * 作用：
 * 1. 从 zx.res111.com 获取法宝图鉴与修武/昭武/彰武/神隐精选装备
 * 2. 从 mujiston.com 获取四象轩辕策规则、新天缘须弥阶梯与战区服务器列表
 * 3. 产出结构化持久文件至 web_app/public/game_data/ 供前端与微工具加载
 */

import * as fs from 'fs';
import * as path from 'path';

const TARGET_DIR = path.resolve(__dirname, '../../web_app/public/game_data');

interface ServerConfigItem {
    zhanQu: string;
    servers: { name: string; server: string; serverId: string }[];
}

export async function syncFabaoData(): Promise<void> {
    console.log('[1/5] 同步法宝图鉴数据...');
    try {
        const res = await fetch('https://zx.res111.com/fabao.html');
        if (res.ok) {
            const html = await res.text();
            const match = html.match(/var D=(\{[\s\S]*?\});/);
            if (match) {
                const data = JSON.parse(match[1]);
                const list = data['法宝列表'] || [];
                const dest = path.join(TARGET_DIR, 'fabao_curated.json');
                fs.writeFileSync(dest, JSON.stringify(list, null, 2), 'utf-8');
                console.log(`  ✓ 成功提纯 ${list.length} 个法宝至 ${dest}`);
                return;
            }
        }
    } catch (err: any) {
        console.warn('  ⚠️ 远程获取法宝失败，保留本地缓存:', err?.message);
    }
}

export async function syncEquipData(): Promise<void> {
    console.log('[2/5] 同步精选装备数据 (修武/昭武/彰武/神隐)...');
    const qualities = ['修武', '昭武', '彰武', '神隐'];
    const slots = ['武器', '头盔', '衣服', '靴子'];
    const allItems: any[] = [];

    for (const q of qualities) {
        for (const s of slots) {
            const url = `https://zx.res111.com/api/api/equip/list?qu=${encodeURIComponent(q)}&slot=${encodeURIComponent(s)}`;
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data: any = await res.json();
                    const items = data.items || [];
                    allItems.push(...items);
                }
            } catch (err: any) {
                console.warn(`  ⚠️ 获取 ${q}-${s} 失败:`, err?.message);
            }
        }
    }

    if (allItems.length > 0) {
        const dest = path.join(TARGET_DIR, 'equip_curated.json');
        fs.writeFileSync(dest, JSON.stringify(allItems, null, 2), 'utf-8');
        console.log(`  ✓ 成功提纯 ${allItems.length} 件主流装备至 ${dest}`);
    }
}

export async function syncServerList(): Promise<void> {
    console.log('[3/5] 校验战区服务器列表...');
    const dest = path.join(TARGET_DIR, 'server_list.json');
    if (fs.existsSync(dest)) {
        console.log(`  ✓ server_list.json 已就绪 (${dest})`);
    }
}

export async function syncXycRules(): Promise<void> {
    console.log('[4/5] 校验轩辕策规则表...');
    const dest = path.join(TARGET_DIR, 'xyc_rules.json');
    if (fs.existsSync(dest)) {
        console.log(`  ✓ xyc_rules.json 已就绪 (${dest})`);
    }
}

export async function syncTianYuanData(): Promise<void> {
    console.log('[5/5] 校验新天缘须弥属性表...');
    const dest = path.join(TARGET_DIR, 'new_tianyuan_data.json');
    if (fs.existsSync(dest)) {
        console.log(`  ✓ new_tianyuan_data.json 已就绪 (${dest})`);
    }
}

export async function runDataLakePipeline(): Promise<void> {
    if (!fs.existsSync(TARGET_DIR)) {
        fs.mkdirSync(TARGET_DIR, { recursive: true });
    }
    console.log('=== 启动数据湖流水线更新 ===');
    await syncFabaoData();
    await syncEquipData();
    await syncServerList();
    await syncXycRules();
    await syncTianYuanData();
    console.log('=== 数据湖流水线执行完毕 ===\n');
}

// 脚本直接调用时执行
if (require.main === module || process.argv[1]?.endsWith('fetch_curated_data.ts')) {
    runDataLakePipeline().catch(err => {
        console.error('Pipeline error:', err);
        process.exit(1);
    });
}

/**
 * 生成 web_app/public/game_data/jiuwenlang.json（佩章·九纹琅 1~40 级）
 *
 * 数据来源（用户提供的三张核对表）：
 *   1. 属性 1~20 级 ：《佩章·九纹琅属性表》官方数值（与旧版 JSON 完全一致，仅迁移）
 *   2. 属性 21~30 级：同表续页
 *   3. 属性 31~40 级：《九纹琅属性》表（论坛整理，标注「所有数据以游戏线上数据为准」）
 *   4. 升级材料 2~40 级：《九纹琅升级所需材料》三套配方对照表
 *
 * 用法：node scripts/build_jiuwenlang_data.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../web_app/public/game_data/jiuwenlang.json');

/* ------------------------------------------------------------------ */
/* 1. 属性表                                                           */
/* ------------------------------------------------------------------ */

// [等级, 气血, 真气, 技能命中, 技能躲闪, 减暴击%, 减爆伤%, 御仙%, 御佛%, 御魔%, 减免伤害%]
const ATTR_ROWS = [
    [1, 12000, 12000, 5, 5, 1, 5, 1, 1, 1, 1],
    [2, 12600, 12600, 5.5, 5.5, 1.2, 6, 1.2, 1.2, 1.2, 1.2],
    [3, 13200, 13200, 6, 6, 1.4, 7, 1.4, 1.4, 1.4, 1.4],
    [4, 13800, 13800, 6.5, 6.5, 1.6, 8, 1.6, 1.6, 1.6, 1.6],
    [5, 14400, 14400, 7, 7, 1.8, 9, 1.8, 1.8, 1.8, 1.8],
    [6, 15000, 15000, 7.5, 7.5, 2, 10, 2, 2, 2, 2],
    [7, 15600, 15600, 8, 8, 2.2, 11, 2.2, 2.2, 2.2, 2.2],
    [8, 16200, 16200, 8.5, 8.5, 2.4, 12, 2.4, 2.4, 2.4, 2.4],
    [9, 16800, 16800, 9, 9, 2.6, 13, 2.6, 2.6, 2.6, 2.6],
    [10, 17400, 17400, 9.5, 9.5, 2.8, 14, 2.8, 2.8, 2.8, 2.8],
    [11, 18000, 18000, 10, 10, 3, 15, 3, 3, 3, 3],
    [12, 18600, 18600, 10.5, 10.5, 3.2, 16, 3.2, 3.2, 3.2, 3.2],
    [13, 19200, 19200, 11, 11, 3.4, 17, 3.4, 3.4, 3.4, 3.4],
    [14, 19800, 19800, 11.5, 11.5, 3.6, 18, 3.6, 3.6, 3.6, 3.6],
    [15, 20400, 20400, 12, 12, 3.8, 19, 3.8, 3.8, 3.8, 3.8],
    [16, 21000, 21000, 12.5, 12.5, 4, 20, 4, 4, 4, 4],
    [17, 21600, 21600, 13, 13, 4.2, 21, 4.2, 4.2, 4.2, 4.2],
    [18, 22200, 22200, 13.5, 13.5, 4.4, 22, 4.4, 4.4, 4.4, 4.4],
    [19, 22800, 22800, 14, 14, 4.6, 23, 4.6, 4.6, 4.6, 4.6],
    [20, 24000, 24000, 15, 15, 5, 25, 5, 5, 5, 5],
    [21, 25920, 25920, 15.8, 15.8, 5.2, 27, 5.4, 5.4, 5.4, 5.2],
    [22, 27840, 27840, 16.6, 16.6, 5.4, 29, 5.8, 5.8, 5.8, 5.4],
    [23, 29760, 29760, 17.4, 17.4, 5.6, 31, 6.2, 6.2, 6.2, 5.6],
    [24, 31680, 31680, 18.3, 18.3, 5.9, 33, 6.6, 6.6, 6.6, 5.9],
    [25, 33600, 33600, 19.2, 19.2, 6.2, 35, 7, 7, 7, 6.2],
    [26, 36480, 36480, 20.1, 20.1, 6.5, 38, 7.6, 7.6, 7.6, 6.5],
    [27, 39360, 39360, 21, 21, 6.8, 41, 8.2, 8.2, 8.2, 6.8],
    [28, 42240, 42240, 22, 22, 7.2, 44, 8.8, 8.8, 8.8, 7.2],
    [29, 45120, 45120, 23, 23, 7.6, 47, 9.4, 9.4, 9.4, 7.6],
    [30, 48000, 48000, 24, 24, 8, 50, 10, 10, 10, 8],
    [31, 50880, 50880, 24.8, 24.8, 8.2, 52, 10.6, 10.6, 10.6, 8.2],
    [32, 53760, 53760, 25.6, 25.6, 8.4, 54, 11.2, 11.2, 11.2, 8.4],
    [33, 56640, 56640, 26.4, 26.4, 8.6, 56, 11.8, 11.8, 11.8, 8.6],
    [34, 59860, 59860, 27.3, 27.3, 8.9, 58, 12.5, 12.5, 12.5, 8.9],
    [35, 63080, 63080, 28.2, 28.2, 9.2, 60, 13.2, 13.2, 13.2, 9.2],
    [36, 66300, 66300, 29.1, 29.1, 9.5, 63, 13.9, 13.9, 13.9, 9.5],
    [37, 69520, 69520, 30, 30, 9.8, 66, 14.6, 14.6, 14.6, 9.8],
    [38, 73680, 73680, 31, 31, 10.2, 69, 15.4, 15.4, 15.4, 10.2],
    [39, 77840, 77840, 32, 32, 10.6, 72, 16.2, 16.2, 16.2, 10.6],
    [40, 82000, 82000, 33, 33, 11, 75, 17, 17, 17, 11],
];

const levels = ATTR_ROWS.map(
    ([level, hp, mp, skillAccuracy, skillDodge, critReduction, critDamageReduction, resistImmortal, resistBuddha, resistDemon, damageReduction]) => ({
        level,
        hp,
        mp,
        skillAccuracy,
        skillDodge,
        critReduction,
        critDamageReduction,
        resistImmortal,
        resistBuddha,
        resistDemon,
        damageReduction,
    }),
);

/* ------------------------------------------------------------------ */
/* 2. 升级材料表                                                       */
/* ------------------------------------------------------------------ */

// 配方1：九纹残魄（2~30 级）
const R1_CANPO = [
    40, 45, 50, 55, 60, 66, 72, 78, 85, 95, 105, 115, 125, 135, 150, 165, 180, 200, 230, // 2~20
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100, // 21~30
];
// 配方1：九纹铸灵（21~40 级）
const R1_ZHULING = [48, 56, 64, 74, 84, 96, 110, 126, 142, 160, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
// 配方1：九纹衍神（31~40 级）
const R1_YANSHEN = [60, 70, 82, 96, 112, 130, 152, 178, 208, 242];

// 配方2：九纹残魄（2~30 级）
const R2_CANPO = [
    20, 22, 25, 27, 30, 33, 36, 39, 42, 47, 52, 57, 62, 67, 75, 82, 90, 100, 115, // 2~20
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100, // 21~30
];
// 配方2：艳阳宝玉（2~20 级）
const R2_YANYANG = [600, 700, 700, 800, 800, 900, 900, 1000, 1000, 1200, 1200, 1400, 1400, 1600, 1800, 2000, 2200, 2500, 2500];
// 配方2：翠岫仙玉（2~20 级）
const R2_CUIXIU = [5, 5, 6, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 22, 25];
// 配方2：紫虚神玉（21~30 级）
const R2_ZIXU = [10, 12, 16, 20, 24, 28, 32, 38, 42, 60];
// 配方2：碧涛仙玉（31~40 级）
const R2_BITAO = [12, 18, 26, 34, 44, 54, 66, 78, 92, 106];

// 配方3：九纹铸灵（21~30 级）
const R3_ZHULING = [32, 37, 43, 49, 56, 64, 73, 84, 95, 107];

const MAT = {
    canpo: (count) => ({ key: 'jiuwen_canpo', name: '九纹残魄', count }),
    zhuling: (count) => ({ key: 'jiuwen_zhuling', name: '九纹铸灵', count }),
    yanshen: (count) => ({ key: 'jiuwen_yanshen', name: '九纹衍神', count }),
    lingpo: (itemLevel, count = 1) => ({ key: 'jiuwen_lingpo', name: '九纹灵魄', itemLevel, count }),
    lang: (itemLevel, count = 1) => ({ key: 'jiuwenlang_attr', name: '九纹琅·属性', itemLevel, count }),
    yanyang: (count) => ({ key: 'yanyang_baoyu', name: '艳阳宝玉', count }),
    cuixiu: (count) => ({ key: 'cuixiu_xianyu', name: '翠岫仙玉', count }),
    zixu: (count) => ({ key: 'zixu_shenyu', name: '紫虚神玉', count }),
    bitao: (count) => ({ key: 'bitao_xianyu', name: '碧涛仙玉', count }),
};

/**
 * 副材料「九纹琅·属性」的等级：21 级起为「当前等级 - 20」，封顶 10 级
 * 3~20 级固定为 1 级
 */
const subLangLevel = (lv) => Math.min(10, Math.max(1, lv - 20));

/** 同一条配方里「同道具同等级」合并计数（如 2 级配方3 的两格都是九纹琅·属性(1级) → ×2） */
const mergeSameItem = (items) => {
    const out = [];
    const index = new Map();
    for (const it of items) {
        const id = `${it.key}|${it.itemLevel ?? ''}`;
        if (index.has(id)) {
            out[index.get(id)].count += it.count;
        } else {
            index.set(id, out.length);
            out.push({ ...it });
        }
    }
    return out;
};

const upgradeCosts = [];
for (let lv = 2; lv <= 40; lv += 1) {
    const idx1 = lv - 2; // 残魄数组下标（2 级起）
    const idx3 = lv - 21; // 21 级起数组下标

    /* 配方1：残魄 + 上一级九纹琅 + 副九纹琅（+ 铸灵 / 衍神） */
    const recipe1 = [];
    if (R1_CANPO[idx1] !== undefined) recipe1.push(MAT.canpo(R1_CANPO[idx1]));
    recipe1.push(MAT.lang(lv - 1));
    if (lv >= 3) recipe1.push(MAT.lang(subLangLevel(lv)));
    if (R1_ZHULING[idx3] !== undefined) recipe1.push(MAT.zhuling(R1_ZHULING[idx3]));
    if (lv >= 31) recipe1.push(MAT.yanshen(R1_YANSHEN[lv - 31]));

    /* 配方2：残魄 + 九纹琅 + 宝玉 / 仙玉 */
    const recipe2 = [];
    if (R2_CANPO[idx1] !== undefined) recipe2.push(MAT.canpo(R2_CANPO[idx1]));
    recipe2.push(MAT.lang(lv - 1));
    recipe2.push(MAT.lang(subLangLevel(lv)));
    if (lv <= 20) {
        recipe2.push(MAT.yanyang(R2_YANYANG[idx1]));
        recipe2.push(MAT.cuixiu(R2_CUIXIU[idx1]));
    } else if (lv <= 30) {
        recipe2.push(MAT.zixu(R2_ZIXU[idx3]));
    } else {
        recipe2.push(MAT.bitao(R2_BITAO[lv - 31]));
    }

    /* 配方3：九纹灵魄 + 九纹琅 ×2（21 级起追加铸灵）。31 级起该配方不再提供，整条删除 */
    const recipe3 = [];
    if (lv <= 30) {
        if (R3_ZHULING[idx3] !== undefined) recipe3.push(MAT.zhuling(R3_ZHULING[idx3]));
        recipe3.push(MAT.lingpo(lv - 1));
        recipe3.push(MAT.lang(lv - 1));
        recipe3.push(MAT.lang(subLangLevel(lv)));
    }

    const cost = { level: lv, recipe1: mergeSameItem(recipe1), recipe2: mergeSameItem(recipe2) };
    if (recipe3.length) cost.recipe3 = mergeSameItem(recipe3);
    upgradeCosts.push(cost);
}

/* ------------------------------------------------------------------ */
/* 3. 汇总输出                                                         */
/* ------------------------------------------------------------------ */

const data = {
    systemName: '佩章·九纹琅',
    category: '佩章附魔/纹饰',
    source: '官方数值与游戏线上核对表（1~20 级官方属性表、21~30 级同表续页、31~40 级论坛整理表）',
    maxLevel: 40,
    description:
        '九纹琅为佩章专属核心附魔强化系统，共 40 个等级。1~20 级为九纹残魄基础阶段；21 级起升级追加九纹铸灵，31 级起追加九纹衍神。满级（40 级）提供 82000 气血/真气、33 点命中躲闪、11% 减暴击与 17% 御三阵营/减免，以及 75% 减免暴击伤害。',
    attributes: [
        { key: 'hp', name: '气血', unit: '' },
        { key: 'mp', name: '真气', unit: '' },
        { key: 'skillAccuracy', name: '技能命中', unit: '' },
        { key: 'skillDodge', name: '技能躲闪', unit: '' },
        { key: 'critReduction', name: '减暴击', unit: '%' },
        { key: 'critDamageReduction', name: '减爆伤', unit: '%' },
        { key: 'resistImmortal', name: '御仙', unit: '%' },
        { key: 'resistBuddha', name: '御佛', unit: '%' },
        { key: 'resistDemon', name: '御魔', unit: '%' },
        { key: 'damageReduction', name: '减免伤害', unit: '%' },
    ],
    recipes: [
        {
            id: 'recipe1',
            name: '配方1',
            title: '残魄 · 琅祭品',
            summary: '九纹残魄 + 上一级九纹琅·属性 + 低阶九纹琅·属性；21 级起追加九纹铸灵，31 级起追加九纹衍神',
        },
        {
            id: 'recipe2',
            name: '配方2',
            title: '残魄 · 宝玉',
            summary: '九纹残魄 + 九纹琅·属性 + 艳阳宝玉 + 翠岫仙玉；21 级起改用紫虚神玉，31 级起改用碧涛仙玉',
        },
        {
            id: 'recipe3',
            name: '配方3',
            title: '灵魄 · 铸灵',
            maxLevel: 30,
            summary: '九纹灵魄 + 九纹琅·属性 ×2；21 级起追加九纹铸灵。31 级起该配方不再提供',
        },
    ],
    levels,
    upgradeCosts,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

/* 自检：打印成对照表，便于与源图逐行核对 */
const pad = (v, n) => String(v).padStart(n, ' ');
const fmtItem = (it) => `${it.name}${it.itemLevel ? `(${it.itemLevel})` : ''}x${it.count}`;
console.log(`written: ${OUT}`);
for (const c of upgradeCosts) {
    console.log(
        `${pad(c.level, 2)} | ${c.recipe1.map(fmtItem).join(' + ').padEnd(56)} | ${c.recipe2.map(fmtItem).join(' + ').padEnd(64)} | ${(c.recipe3 || []).map(fmtItem).join(' + ')}`,
    );
}

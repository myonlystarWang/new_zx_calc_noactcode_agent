/**
 * 副本展示元数据的**唯一真相**。
 *
 * 数据本体只有一套：`public/game_data/dungeons.json` + `dungeons_monsters.json`。
 * 这个文件只放「展示层」信息 —— 顺序、胶囊短名、图鉴标签、搜索别名。
 *
 * 以前这四样在 4 个文件里各写一份（ResultsSection / BossCompendiumView /
 * searchIndex / presetCompare），新增副本要改 4 处、漏一处就出现「聊天里有、
 * 计算器轮播里没有」的分裂。新增副本只需在这里加一条。
 */

/** 展示顺序：数字小的排前面。T系列按梯队升序，团本/试炼分组靠后。 */
export const DUNGEON_ORDER: Record<string, number> = {
    WUDU_QIGONGQIN_T10: 1,
    WUDU_QIGONGQIN_T11: 2,
    WUDU_QIGONGQIN_T12: 3,
    HUIMENG_LINGYUN_T16: 10,
    HUIMENG_LINGYUN_T17: 20,
    HUIMENG_LINGYUN_T18: 30,
    ZHENHAI_DUANLANG_T19: 40,
    ZHENHAI_DUANLANG_T20: 50,
    ZHENHAI_DUANLANG_T21: 60,
    SHOUSHEN_JIANGLIN_HARD: 110,
    JIEQI_KONGSANG_NORMAL: 120,
    JIEQI_KONGSANG_HARD: 130,
    TIANDI_BAOKU_NORMAL: 140,
    TIANDI_BAOKU_MEDIUM: 150,
    TIANDI_BAOKU_HARD: 160,
    LIU_BO_JING_BIAN_CHUSHI: 170,
    LIU_BO_JING_BIAN_HARD: 180,
    SIXIANG_QI: 210,
    XUANYELIN_QIWEI_WUGONG: 220,
};

/** 手机副本快捷条用的极短名（一行要塞得下多个胶囊）。 */
export const DUNGEON_PILL_NAME: Record<string, string> = {
    WUDU_QIGONGQIN_T10: 'T10',
    WUDU_QIGONGQIN_T11: 'T11',
    WUDU_QIGONGQIN_T12: 'T12',
    HUIMENG_LINGYUN_T16: 'T16',
    HUIMENG_LINGYUN_T17: 'T17',
    HUIMENG_LINGYUN_T18: 'T18',
    ZHENHAI_DUANLANG_T19: 'T19',
    ZHENHAI_DUANLANG_T20: 'T20',
    ZHENHAI_DUANLANG_T21: 'T21',
    SIXIANG_QI: '四象',
    TIANDI_BAOKU_NORMAL: '天帝1',
    TIANDI_BAOKU_MEDIUM: '天帝2',
    TIANDI_BAOKU_HARD: '天帝3',
    JIEQI_KONGSANG_NORMAL: '空桑1',
    JIEQI_KONGSANG_HARD: '空桑2',
    SHOUSHEN_JIANGLIN_HARD: '兽神',
    XUANYELIN_QIWEI_WUGONG: '悬夜林',
    LIU_BO_JING_BIAN_CHUSHI: '流波1',
    LIU_BO_JING_BIAN_HARD: '流波2',
};

/** 图鉴 / 搜索二级筛选用名（比胶囊长，保留难度说明）。 */
export const DUNGEON_LABEL: Record<string, string> = {
    WUDU_QIGONGQIN_T10: '五毒T10',
    WUDU_QIGONGQIN_T11: '五毒T11',
    WUDU_QIGONGQIN_T12: '五毒T12',
    HUIMENG_LINGYUN_T16: 'T16',
    HUIMENG_LINGYUN_T17: 'T17',
    HUIMENG_LINGYUN_T18: 'T18',
    ZHENHAI_DUANLANG_T19: 'T19',
    ZHENHAI_DUANLANG_T20: 'T20',
    ZHENHAI_DUANLANG_T21: 'T21',
    SHOUSHEN_JIANGLIN_HARD: '兽神困难',
    JIEQI_KONGSANG_NORMAL: '空桑初识',
    JIEQI_KONGSANG_HARD: '空桑困难',
    TIANDI_BAOKU_NORMAL: '天帝1',
    TIANDI_BAOKU_MEDIUM: '天帝2',
    TIANDI_BAOKU_HARD: '天帝3',
    LIU_BO_JING_BIAN_CHUSHI: '流波初识',
    LIU_BO_JING_BIAN_HARD: '流波困难',
    SIXIANG_QI: '四象七',
    XUANYELIN_QIWEI_WUGONG: '悬夜林',
};

/** 搜索增强别名（首字母、俗称、系列名）。 */
export const DUNGEON_ALIASES: Record<string, string[]> = {
    WUDU_QIGONGQIN_T10: ['t10', '五毒', '五毒其攻侵', '鏖战', 'wd10', 'wudu'],
    WUDU_QIGONGQIN_T11: ['t11', '五毒', '五毒其攻侵', '鏖战', 'wd11', 'wudu'],
    WUDU_QIGONGQIN_T12: ['t12', '五毒', '五毒其攻侵', '鏖战', 'wd12', 'wudu'],
    HUIMENG_LINGYUN_T16: ['t16', '凌云16', 'ly16', 'huimeng'],
    HUIMENG_LINGYUN_T17: ['t17', '凌云17', 'ly17', 'huimeng'],
    HUIMENG_LINGYUN_T18: ['t18', '凌云18', 'ly18', 'huimeng'],
    ZHENHAI_DUANLANG_T19: ['t19', '断浪19', 'dl19', 'zhenhai', 'duanlang'],
    ZHENHAI_DUANLANG_T20: ['t20', '断浪20', 'dl20', 'zhenhai', 'duanlang'],
    ZHENHAI_DUANLANG_T21: ['t21', '断浪21', 'dl21', 'zhenhai', 'duanlang'],
    SHOUSHEN_JIANGLIN_HARD: ['兽神', '困难', '兽神困难', 'ss', 'kn', 'sskn', 'shoushen', 'shoushenkunnan'],
    JIEQI_KONGSANG_NORMAL: ['空桑', '初识', '空桑初识', 'ks', 'cs', 'kscs', 'kongsang'],
    JIEQI_KONGSANG_HARD: ['空桑', '困难', '空桑困难', 'ks', 'kn', 'kskn', 'kongsang'],
    TIANDI_BAOKU_NORMAL: ['天帝', '天帝1', '天帝一层', '初入江湖', 'td', 'td1', 'tiandi'],
    TIANDI_BAOKU_MEDIUM: ['天帝', '天帝2', '天帝二层', '再起风云', 'td', 'td2', 'tiandi'],
    TIANDI_BAOKU_HARD: ['天帝', '天帝3', '天帝三层', '三生苦旅', 'td', 'td3', 'tiandi'],
    LIU_BO_JING_BIAN_CHUSHI: ['流波', '初识', '流波初识', 'lb', 'cs', 'lbcs', 'liubo'],
    LIU_BO_JING_BIAN_HARD: ['流波', '困难', '流波困难', 'lb', 'kn', 'lbkn', 'liubo'],
    SIXIANG_QI: ['四象', '四象七', '七杀', '七杀罪狱', 'sx', 'sxq'],
    XUANYELIN_QIWEI_WUGONG: ['悬夜林', '七尾蜈蚣', '蜈蚣', 'xyl', 'qiwei'],
};

/** 按 DUNGEON_ORDER 排序；未登记的排最后（保持相对顺序）。 */
export function sortDungeons<T extends { DungeonID: string }>(list: T[]): T[] {
    return [...list].sort(
        (a, b) => (DUNGEON_ORDER[a.DungeonID] ?? 999) - (DUNGEON_ORDER[b.DungeonID] ?? 999),
    );
}

/** 极短名兜底：优先查表，其次抓名称里的 T<数字>，再退回前 3 个字。 */
export function shortDungeonName(id: string, name: string): string {
    return DUNGEON_PILL_NAME[id] || name.match(/T\d+/)?.[0] || name.replace(/[（(].*$/, '').slice(0, 3);
}

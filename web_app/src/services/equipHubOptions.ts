/**
 * 装备全景导航（equip_hub）的唯一真相表。
 *
 * 为什么单独拆一个文件：
 * 1. `equip_curated.json` 实际有 15 个部位，导航卡早先只挂了 12 个入口，
 *    导致 项链 / 戒指 / 锦囊 / 罡气 / 法身（金身）/ 玺绶 / 勋章 / 护符 这些部位
 *    「能打字查到、但点不出来」——用户侧表现为「我明明规划过，你给我弄没了」。
 * 2. 拆出来后 `scripts/check_equip_hub_coverage.mjs` 可以直接 import 这张表，
 *    拿它跟数据里的 slot 集合对拍：**数据里有的部位，导航里必须有一个入口**，
 *    少一个就红。这样以后再加部位，忘了挂入口会当场被测试挡下来。
 *
 * 改动纪律：
 * - 新增部位 → 往 `EQUIP_SLOT_ENTRIES` 加一条，`slot` 必须与数据里的 `slot` 字段完全一致。
 * - `query` 是**用户视角的自然词**（点下去等于用户自己打这句话），不许写机器词。
 * - 系统的 `slot` 留 undefined（它们不是装备部位，是养成系统）。
 */

export type EquipHubOption = {
    key: string;
    label: string;
    query: string;
};

export type EquipSlotEntry = EquipHubOption & {
    /** 对应 `equip_curated.json` 的 slot 字段；系统入口不填 */
    slot?: string;
};

export type EquipHubGroup = {
    label: string;
    options: EquipSlotEntry[];
};

/** 一、主装品质（6 部位 × 三系全覆盖，走品质筛选；不绑定单一部位，故不填 slot） */
const QUALITY_ENTRIES: EquipSlotEntry[] = [
    { key: 'xiuwu', label: '修武装备', query: '修武' },
    { key: 'zhaowu', label: '昭武装备', query: '昭武' },
    { key: 'zhangwu', label: '彰武装备', query: '彰武' },
];

/** 二、主装部位（点进去选品质，6 个部位一个不少） */
const MAIN_SLOT_ENTRIES: EquipSlotEntry[] = [
    { key: 'slot_weapon', label: '武器', query: '武器', slot: '武器' },
    { key: 'slot_helmet', label: '头盔', query: '头盔', slot: '头盔' },
    { key: 'slot_armor', label: '衣服', query: '衣服', slot: '衣服' },
    { key: 'slot_wrist', label: '袖甲', query: '袖甲', slot: '袖甲' },
    { key: 'slot_belt', label: '腰带', query: '腰带', slot: '腰带' },
    { key: 'slot_boots', label: '靴子', query: '靴子', slot: '靴子' },
];

/** 三、其他装备细节（非主装部位，每个都必须能点出对应卡片） */
const OTHER_SLOT_ENTRIES: EquipSlotEntry[] = [
    { key: 'slot_necklace', label: '项链', query: '项链', slot: '项链' },
    { key: 'slot_ring', label: '戒指', query: '戒指', slot: '戒指' },
    { key: 'slot_pouch', label: '锦囊', query: '锦囊', slot: '锦囊' },
    { key: 'slot_seal', label: '玺绶', query: '玺绶', slot: '玺绶' },
    { key: 'slot_gangqi', label: '罡气', query: '罡气', slot: '罡气' },
    { key: 'slot_fashen', label: '法身', query: '法身', slot: '法身' },
    { key: 'slot_jinshen', label: '金身', query: '金身', slot: '法身' },
    { key: 'slot_peizhang', label: '圣粹佩章', query: '佩章', slot: '佩章' },
    { key: 'slot_medal', label: '勋章', query: '勋章', slot: '勋章' },
    { key: 'slot_amulet', label: '护符', query: '护符', slot: '护符' },
];

/** 四、养成系统（不挂在装备栏里，但一样堆属性） */
const SYSTEM_ENTRIES: EquipSlotEntry[] = [
    { key: 'silin_benyuan', label: '四灵本元', query: '四灵本元' },
    { key: 'ninglingqi', label: '宸极凝灵契', query: '凝灵契' },
    { key: 'jiuwenlang', label: '九纹琅', query: '九纹琅' },
    { key: 'tianyuan_old', label: '旧天缘', query: '旧天缘' },
    { key: 'tianyuan_new', label: '新天缘', query: '新天缘' },
    { key: 'xyc_tome', label: '轩辕策', query: '轩辕策属性' },
    { key: 'shenji', label: '神级首饰', query: '神级项链' },
    { key: 'baoshi', label: '宝石属性', query: '宝石' },
];

export const EQUIP_HUB_GROUPS: EquipHubGroup[] = [
    { label: '主装 · 按品质', options: QUALITY_ENTRIES },
    { label: '主装 · 按部位', options: MAIN_SLOT_ENTRIES },
    { label: '其他装备细节', options: OTHER_SLOT_ENTRIES },
    { label: '养成系统', options: SYSTEM_ENTRIES },
];

/** 扁平选项表（渲染兜底 / 测试遍历用）；`group` 用于在卡片里穿插分行标题 */
export const EQUIP_HUB_OPTIONS: (EquipSlotEntry & { group: string })[] =
    EQUIP_HUB_GROUPS.flatMap(g => g.options.map(o => ({ ...o, group: g.label })));

/** 导航里出现过的装备部位（去重），供覆盖度测试对拍数据 slot 集合 */
export const EQUIP_HUB_COVERED_SLOTS: string[] = Array.from(
    new Set(EQUIP_HUB_OPTIONS.map(o => o.slot).filter((s): s is string => Boolean(s)))
);

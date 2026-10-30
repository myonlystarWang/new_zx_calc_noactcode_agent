/**
 * 蕴灵（+N）加成落在哪个属性上 —— 唯一真相。
 *
 * 为什么单独拆出来：
 * 1. 旧实现按「部位名」硬映射，把 头盔 / 帽子 直接归到 hp（气血），
 *    但 `equip_curated.json` 里头盔只有 `def` + `mp`、根本没有 `hp`。
 *    结果：头盔点到 +1 之后，气血行不渲染（`hp === undefined`）、防御行不加成，
 *    画面上「加了等于没加」，标题却写着（蕴灵 +1）。
 * 2. 判定必须**以数据里真实存在的字段为准**，部位名只作兜底：
 *    武器 → atk｜衣服 → def｜袖甲 → mp｜腰带 → hp｜靴子(def+hp) → hp｜头盔(def+mp) → mp。
 *    靴子和头盔都带 def，但蕴灵的加成口径不同，靠「谁有 hp / 谁有 mp」区分。
 * 3. 抽成纯函数后，`scripts/l1_intent_fixture.mjs` 的审计段可以逐条对拍数据：
 *    每个可蕴灵部位都必须落到一个真实存在的数值字段上，否则整轮 FAIL。
 */
import type { CuratedEquipItem } from '../types';

export type EquipStatKey = 'atk' | 'def' | 'hp' | 'mp';

/**
 * 可蕴灵的真实部位 —— 与 `equip_curated.json` 的 slot 一一对应（就这 6 个）。
 *
 * **禁止往里塞口语别名**（帽子 / 鞋 / 护腕）：这一层拿到的永远是数据里的标准名，
 * 别名归一是输入层的事（`CopilotService` 的 `slotAliases`）。塞进来只会让后来的人
 * 以为「帽子」是真实部位，写新映射时照着加分支 —— 头盔那次就是这么错的。
 */
export const YUNLING_SLOTS = ['武器', '头盔', '衣服', '靴子', '腰带', '袖甲'] as const;

/**
 * 这件装备能不能打「蕴灵 +N」——**唯一判定入口**。
 *
 * 条件：数据里有 `ref` 梯度（1~20 级的加成值）且部位属于可蕴灵部位。
 * `EquipDetailCard`（要不要显示 −/+ 步进器）与 `CopilotService`（提示语写「可强化」
 * 还是「可换同系」）都调这一个函数：这两处曾各写一份白名单，一份 9 项带别名、
 * 一份 6 项，今天恰好等价，数据一变就会分叉（卡片说能 +1、回复说能换系）。
 */
export function isYunlingEquip(it: Pick<CuratedEquipItem, 'slot' | 'ref'>): boolean {
    return Boolean(
        Array.isArray(it.ref) && it.ref.length > 0
        && (YUNLING_SLOTS as readonly string[]).includes(it.slot || '')
    );
}

/**
 * 返回该装备的蕴灵加成应该加到哪个属性字段；无法判定返回 null。
 *
 * 顺序不可随意调换：`hp` 必须早于 `mp`、`mp` 必须早于 `def`，
 * 这样 靴子（def+hp）取 hp、头盔（def+mp）取 mp。
 */
export function getEquipRefKey(
    it: Pick<CuratedEquipItem, 'atk' | 'def' | 'hp' | 'mp'>,
): EquipStatKey | null {
    if (Array.isArray(it.atk) && it.atk.length > 0) return 'atk';
    if (typeof it.hp === 'number') return 'hp';
    if (typeof it.mp === 'number') return 'mp';
    if (typeof it.def === 'number') return 'def';
    return null;
}

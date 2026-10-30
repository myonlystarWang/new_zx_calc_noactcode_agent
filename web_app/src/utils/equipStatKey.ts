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

/** 可蕴灵的部位（与 `EquipDetailCard` 的 `YUNLING_SLOTS` 保持一致） */
export const YUNLING_SLOTS = ['武器', '头盔', '帽子', '衣服', '靴子', '鞋', '腰带', '袖甲', '护腕'];

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

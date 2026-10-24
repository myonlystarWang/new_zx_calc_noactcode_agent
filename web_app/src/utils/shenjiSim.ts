/**
 * shenjiSim.ts
 * 神机属性洗练模拟 —— 数据解析与抽取逻辑
 *
 * 数据源：equip_curated.json 的 `sj` 字段（已是 品质 → [{l: 11|13|15, d: "属性 下限~上限 (概率%)"}]）
 * 五档规则（由官网图19-21 的神机属性全览逐格核对）：
 *   第一档 = 区间下限（白）  第五档 = 区间上限（红·极·神机）
 *   第二/三/四档 = 下限 + 差值 × 20% / 40% / 60%
 * 档位概率（实测自 elements.data 表325「神机配置」每段 +196 处的 5 个 float，Σ=100）：
 *   按部位分三套，品质不影响；详见 SHENJI_TIER_RATE_GROUPS
 */
import type { CuratedEquipItem } from '../types';
import { GAME_COLORS } from '../constants/gameColorSystem';

export const SHENJI_QUALITIES = ['修武', '昭武', '彰武'] as const;
export type ShenjiQuality = (typeof SHENJI_QUALITIES)[number];

export const SHENJI_SLOTS = ['武器', '头盔', '衣服', '靴子', '腰带', '袖甲'] as const;
export type ShenjiSlot = (typeof SHENJI_SLOTS)[number];

/** 蕴灵档位 → 该档位下神机属性条数（第 1 条取 +11 池、第 2 条取 +13 池、第 3 条取 +15 池） */
export const SHENJI_SLOT_LEVELS: Record<number, number[]> = {
    11: [11],
    13: [11, 13],
    15: [11, 13, 15],
};

/**
 * 档位概率（百分比），按部位分三套。
 *
 * ⚠️ 当前为**体验调整值 v5**（2026-10-24，红档由 10% 下调到 6%）：
 *    每池红档统一 6%，其余四档按 v4 的原比例放大到合计 94%。
 *    效果：零红 ≈ 83.1%、单红 ≈ 15.9%、任意两红 ≈ 1/98、三条全红 ≈ 1/4600。
 *
 * 历史：v1 红档 11/9/6（两红 1/50）→ v2 红档 20%（两红 1/10，玩家反馈红太多）
 *      → v3 红档 12%（两红 1/26）→ v4 红档 10%（两红 1/37）→ v5 红档 6%（两红 1/98）。
 * 客户端原始值（elements.data 表 325，v183，逐条实测，仅供对照）：
 *    A 组 武器/衣服：11=34/33/18/10/5   13=38/33/17/8/4   15=42/33/16/6/3
 *    B 组 头盔/靴子：11=34/33/18/10/5   13=38/33/17/8/4   15=42/33/16/7/2
 *    C 组 腰带/袖甲：11=28/24/21/17/10  13=42/33/18/4/3   15=42/33/20/3/2
 *    （原始值下：单红 ≈ 1/9、任意两红 ≈ 1/221、三红 ≈ 1/16667）
 *    详见 doc/神机洗练_五档概率与属性池实证_20261021.md
 *
 * 修武 / 昭武 / 彰武 三品质共用同一套，仅数值区间不同。
 */
export const SHENJI_TIER_RATE_GROUPS: Record<'A' | 'B' | 'C', Record<number, number[]>> = {
    /** A 组：武器、衣服 */
    A: { 11: [35, 33, 18, 8, 6], 13: [37, 33, 16, 8, 6], 15: [41, 32, 15, 6, 6] },
    /** B 组：头盔、靴子 */
    B: { 11: [33, 34, 18, 9, 6], 13: [38, 32, 17, 7, 6], 15: [41, 32, 15, 6, 6] },
    /** C 组：腰带、袖甲（游戏内「手环」） */
    C: { 11: [30, 25, 22, 17, 6], 13: [41, 32, 17, 4, 6], 15: [41, 31, 19, 3, 6] },
};

/** 部位 → 档位概率分组 */
export const SHENJI_SLOT_RATE_GROUP: Record<ShenjiSlot, 'A' | 'B' | 'C'> = {
    武器: 'A',
    衣服: 'A',
    头盔: 'B',
    靴子: 'B',
    腰带: 'C',
    袖甲: 'C',
};

/** 取某部位 + 某蕴灵档的五档概率（白/绿/紫/橙/红） */
export function getShenjiTierRates(slot: ShenjiSlot, l: number): number[] {
    const group = SHENJI_TIER_RATE_GROUPS[SHENJI_SLOT_RATE_GROUP[slot] ?? 'A'];
    return group[l] ?? group[11];
}

/**
 * 五档在区间内的取值比例。
 * 客户端表 325 只存 min / max 两个端点，档位方向由官方说明确定：
 * 「颜色根据属性值高低，由低到高分别为白、绿、紫、金、红」⇒ 第一档 = min = 白，第五档 = max = 红（极·神机）。
 */
export const TIER_RATIOS = [0, 0.2, 0.4, 0.6, 1];

export const TIER_NAMES = ['白', '绿', '紫', '橙', '红'] as const;

/** 五档配色：全部取自项目 GAME_COLORS，不新造色 */
export const TIER_COLORS = [
    GAME_COLORS.WHITE,
    GAME_COLORS.MINT_GREEN,
    GAME_COLORS.VIOLET_PURPLE,
    GAME_COLORS.GOLD_AMBER,
    GAME_COLORS.PURE_RED,
];

/** 单条属性池条目（由 `d` 字符串解析而来） */
export interface ShenjiAttr {
    /** 该条来自哪个蕴灵档位的池子 */
    l: number;
    name: string;
    min: number;
    max: number;
    /** 生成概率（百分比，池内合计 100） */
    prob: number;
    /** 是否为百分比属性 */
    percent: boolean;
    /** 数值放大倍数：技能命中在数据里是 0.02~0.08，实机显示 2.0~8.0 */
    scale: number;
}

/** 一次抽取结果 */
export interface ShenjiRoll {
    /** 来自哪个蕴灵池 */
    l: number;
    name: string;
    raw: number;
    /** 已按 scale 换算、可直接展示的数值 */
    value: number;
    /** 1~5 */
    tier: number;
    /** 是否为「极·神机」 */
    isJi: boolean;
    color: string;
    percent: boolean;
    /** 是否按 1 位小数展示（百分比属性与技能命中） */
    decimal: boolean;
}

const D_RE = /^(.+?)\s+([\d.]+)(%?)\s*[~～]\s*([\d.]+)(%?)\s*[(（]\s*(\d+)%\s*[)）]$/;

/** 解析 "固定攻击 480~1200 (42%)" / "致命一击率 0.4%~2.4% (8%)" */
export function parseShenjiDesc(l: number, d: string): ShenjiAttr | null {
    const m = D_RE.exec(d.trim());
    if (!m) return null;
    const name = m[1].trim();
    const min = Number(m[2]);
    const max = Number(m[4]);
    const prob = Number(m[6]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(prob)) return null;
    // 只有「数值区间」自带 % 才算百分比属性（不能看末尾的生成概率 %）
    const percent = Boolean(m[3]) || Boolean(m[5]);
    // 无百分号且上限 ≤ 1 的属性（技能命中 0.02~0.08）按 100 倍换算展示
    const scale = !percent && max <= 1 ? 100 : 1;
    return { l, name, min, max, prob, percent, scale };
}

/** 从一件装备的 sj 字段中取出指定品质、指定蕴灵档位的属性池 */
export function getShenjiPool(equip: CuratedEquipItem | undefined, quality: ShenjiQuality, l: number): ShenjiAttr[] {
    const arr = (equip as any)?.sj?.[quality];
    if (!Array.isArray(arr)) return [];
    const out: ShenjiAttr[] = [];
    for (const item of arr) {
        if (Number(item?.l) !== l) continue;
        const parsed = parseShenjiDesc(l, String(item.d ?? ''));
        if (parsed) out.push(parsed);
    }
    return out;
}

/** 在装备列表中找到某部位 + 某品质的神机池载体（同一部位同品质的 sj 内容一致，取首个即可） */
export function findShenjiEquip(
    equips: CuratedEquipItem[],
    slot: ShenjiSlot,
    quality: ShenjiQuality
): CuratedEquipItem | undefined {
    return equips.find((e) => e.slot === slot && Array.isArray((e as any)?.sj?.[quality]) && (e as any).sj[quality].length > 0);
}

/** 该部位 + 品质 + 蕴灵档位下，每个槽位的候选属性池 */
export function buildShenjiPools(
    equips: CuratedEquipItem[],
    slot: ShenjiSlot,
    quality: ShenjiQuality,
    yunling: number
): ShenjiAttr[][] {
    const equip = findShenjiEquip(equips, slot, quality);
    const levels = SHENJI_SLOT_LEVELS[yunling] ?? [11];
    return levels.map((l) => getShenjiPool(equip, quality, l));
}

function pickWeighted<T>(items: T[], weight: (t: T) => number): T | null {
    const total = items.reduce((s, it) => s + weight(it), 0);
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const it of items) {
        r -= weight(it);
        if (r <= 0) return it;
    }
    return items[items.length - 1] ?? null;
}

/** 数值格式化：百分比与技能命中固定 1 位小数（对齐实机 "+4.0%" / "+4.4"），其余取整 */
export function formatShenjiValue(value: number, decimal: boolean): string {
    if (!decimal) return String(Math.round(value));
    return value.toFixed(1);
}

/** 单条抽取：先按属性概率选属性，再按该部位 + 蕴灵档的档位概率选档，最后取该档固定值 */
export function rollShenjiAttr(pool: ShenjiAttr[], l: number, slot: ShenjiSlot): ShenjiRoll | null {
    const attr = pickWeighted(pool, (a) => a.prob);
    if (!attr) return null;
    const rates = getShenjiTierRates(slot, l);
    let tier = 5;
    const total = rates.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < rates.length; i++) {
        r -= rates[i];
        if (r <= 0) {
            tier = i + 1;
            break;
        }
    }
    const ratio = TIER_RATIOS[tier - 1];
    const raw = attr.min + (attr.max - attr.min) * ratio;
    return {
        l,
        name: attr.name,
        raw,
        value: raw * attr.scale,
        tier,
        isJi: tier === 5,
        color: TIER_COLORS[tier - 1],
        percent: attr.percent,
        decimal: attr.percent || attr.scale === 100,
    };
}

/** 一次完整洗练：按槽位顺序逐条抽取（每条独立计算概率） */
export function rollShenjiPools(pools: ShenjiAttr[][], slot: ShenjiSlot): ShenjiRoll[] {
    const out: ShenjiRoll[] = [];
    pools.forEach((pool, idx) => {
        const l = pool[0]?.l ?? SHENJI_SLOT_LEVELS[11][idx] ?? 11;
        const roll = rollShenjiAttr(pool, l, slot);
        if (roll) out.push(roll);
    });
    return out;
}

/** 自动锻造单条目标配置 */
export interface AutoForgeTarget {
    /** 目标词条名称，"无" 表示任意 */
    attrName: string;
    /** 最低品质要求，0: 无基础品质, 1: 白, 2: 绿, 3: 紫, 4: 橙, 5: 红 */
    minTier: number;
}

/** 检查是否存在至少一个有效预设目标（非“无”或有基础品质要求） */
export function hasActiveAutoForgeTarget(targets: AutoForgeTarget[], activeCount: number): boolean {
    for (let i = 0; i < activeCount; i++) {
        const t = targets[i];
        if (!t) continue;
        if (t.attrName && t.attrName !== '无' && t.attrName.trim() !== '') {
            return true;
        }
        if (t.minTier > 0) {
            return true;
        }
    }
    return false;
}

/** 属性友好显示名：将带百分比的 攻击/气血/真气/防御 映射为 攻击百分比/气血百分比 等，避免与固定攻击等混淆 */
export function getShenjiAttrDisplayName(attr: { name: string; percent?: boolean }): string {
    if (attr.percent) {
        if (attr.name === '攻击') return '攻击百分比';
        if (attr.name === '气血') return '气血百分比';
        if (attr.name === '真气') return '真气百分比';
        if (attr.name === '防御') return '防御百分比';
    }
    return attr.name;
}

/** 检查洗练产出是否满足自动锻造预设目标 */
export function matchAutoForgeTarget(
    rolls: ShenjiRoll[],
    targets: AutoForgeTarget[],
    activeCount: number
): boolean {
    if (!rolls || rolls.length < activeCount) return false;
    // 若未设置任何一项有效目标（词条全为“无”且无基础品质门槛），则不触发目标匹配停止
    if (!hasActiveAutoForgeTarget(targets, activeCount)) {
        return false;
    }

    for (let i = 0; i < activeCount; i++) {
        const roll = rolls[i];
        const target = targets[i];
        if (!roll || !target) return false;

        // 1. 词条名称检查（同时兼容原名与百分比别名，例如“攻击百分比”可精准匹配到带%的“攻击”词条）
        if (target.attrName && target.attrName !== '无' && target.attrName.trim() !== '') {
            const rollDisplay = getShenjiAttrDisplayName(roll);
            const isNameMatched = roll.name === target.attrName || rollDisplay === target.attrName;
            if (!isNameMatched) {
                return false;
            }
        }

        // 2. 最低品质门槛检查
        if (target.minTier > 0) {
            if (roll.tier < target.minTier) {
                return false;
            }
        }
    }
    return true;
}

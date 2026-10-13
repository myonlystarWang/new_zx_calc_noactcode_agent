/**
 * equipSeries.ts
 * 装备进化体系与同系升降阶（Lineage & Progression Stepper）核心引擎
 * 覆盖：金身、法身、大乘战罡、玄灵战罡、同类锦囊、玺绶印记、太昊/太乙项链、符石/血玉戒指及通用星级进阶
 */

import type { CuratedEquipItem } from '../types';

export interface EquipSeriesInfo {
    seriesKey: string;
    seriesName: string;
    items: CuratedEquipItem[];
    currentIndex: number;
    currentTierLabel: string;
}

// 1. 法身 / 金身 16 阶进阶序列
const FASHEN_TIERS = [
    '太极初成', '两仪化生', '三花聚顶', '四象纵横', '五气朝元', '六爻离合',
    '七星转魂', '八法运通', '九转阴阳', '十方乾坤', '百劫洞冥', '千界婆娑',
    '万流至尊', '万流至尊★', '万流至尊★★', '万流至尊★★★'
];

// 2. 计系锦囊 42 阶进阶序列 (初计 ~ 三十六计 -> 百计 -> 千计 -> 万计 -> ★ -> ★★ -> ★★★)
const JI_TIERS = [
    '初计', '二计', '三计', '四计', '五计', '六计', '七计', '八计', '九计', '十计',
    '十一计', '十二计', '十三计', '十四计', '十五计', '十六计', '十七计', '十八计', '十九计', '二十计',
    '二十一计', '二十二计', '二十三计', '二十四计', '二十五计', '二十六计', '二十七计', '二十八计', '二十九计', '三十计',
    '三十一计', '三十二计', '三十三计', '三十四计', '三十五计', '三十六计',
    '百计', '千计', '万计', '万计★', '万计★★', '万计★★★'
];

// 3. 饰品/项链/戒指 6 大分支神祗阶梯 (1阶基础 ~ 5阶巅峰)
const ACCESSORY_BRANCH_GODS: Record<string, string[]> = {
    '天道': ['帝俊', '羲和', '华胥', '娥皇', '嫘祖'],
    '天弈': ['刑天', '蓐收', '烛龙', '蚩尤', '天戮'],
    '天眷': ['祝融', '望舒', '青阳', '婴侯', '翕忽'],
    '玉虚': ['共工', '静息', '天吴', '玄商', '穹仪'],
    '天遁': ['风伯', '句芒', '毕方', '石夷', '蚀天'],
    '天戍': ['雨师', '玄冥', '太章', '后土', '归墟']
};

// 4. 特殊战罡与玺绶固定序列
const ZHAN_GANG_TIERS = ['辟谷战罡', '元婴战罡', '空冥战罡', '渡劫战罡', '寂灭战罡'];
const HERO_MEDAL_TIERS = ['铜质英雄勋章', '银质英雄勋章', '金质英雄勋章'];
const SHOUDAI_TIERS = ['勇者绶带', '季军绶带', '亚军绶带', '冠军绶带'];
const LEIBU_TIERS = ['雷部使者印', '雷部总兵印', '雷部天尊印', '雷部鸿钧印'];
const TITLE_YIN_TIERS = ['威者印', '尊者印', '王者印'];

/**
 * 分析识别单件装备所属的进化系列，并返回完整的升阶/降阶兄弟节点列表与当前索引
 */
export function getEquipSeries(
    item: CuratedEquipItem,
    allEquips: CuratedEquipItem[]
): EquipSeriesInfo | null {
    if (!item || !Array.isArray(allEquips) || allEquips.length === 0) return null;
    const name = item.name || '';

    // 1. 法身 / 金身
    for (const prefix of ['法身·', '金身·']) {
        if (name.startsWith(prefix)) {
            const tierName = name.replace(prefix, '');
            const idx = FASHEN_TIERS.indexOf(tierName);
            if (idx !== -1) {
                const siblings: CuratedEquipItem[] = [];
                for (const t of FASHEN_TIERS) {
                    const match = allEquips.find(e => e.name === `${prefix}${t}`);
                    if (match) siblings.push(match);
                }
                const curIdx = siblings.findIndex(e => e.name === name);
                return {
                    seriesKey: prefix.replace('·', ''),
                    seriesName: `${prefix.replace('·', '')}系列`,
                    items: siblings,
                    currentIndex: curIdx >= 0 ? curIdx : 0,
                    currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
                };
            }
        }
    }

    // 2. 计系锦囊 (逍遥, 神行, 太虚)
    for (const prefix of ['逍遥锦囊·', '神行锦囊·', '太虚锦囊·']) {
        if (name.startsWith(prefix)) {
            const jiName = name.replace(prefix, '');
            const idx = JI_TIERS.indexOf(jiName);
            if (idx !== -1) {
                const siblings: CuratedEquipItem[] = [];
                for (const t of JI_TIERS) {
                    const match = allEquips.find(e => e.name === `${prefix}${t}`);
                    if (match) siblings.push(match);
                }
                const curIdx = siblings.findIndex(e => e.name === name);
                return {
                    seriesKey: prefix.replace('·', ''),
                    seriesName: `${prefix.replace('·', '')}系列`,
                    items: siblings,
                    currentIndex: curIdx >= 0 ? curIdx : 0,
                    currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
                };
            }
        }
    }

    // 3. 玺绶词缀印 (风云印 -> 惊天印 -> 齐天印 -> 翻天印 -> 覆天印)
    const yinMatch = name.match(/^(风云印|惊天印|齐天印|翻天印|覆天印)·(.+?)(·混沌)?$/);
    if (yinMatch) {
        const isChaos = Boolean(yinMatch[3]);
        const affix = yinMatch[2];
        const prefixOrder = isChaos
            ? ['惊天印', '齐天印', '翻天印', '覆天印']
            : ['风云印', '惊天印', '齐天印', '翻天印', '覆天印'];
        const siblings: CuratedEquipItem[] = [];
        for (const p of prefixOrder) {
            const targetName = isChaos ? `${p}·${affix}·混沌` : `${p}·${affix}`;
            const match = allEquips.find(e => e.name === targetName);
            if (match) siblings.push(match);
        }
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: `印_${affix}${isChaos ? '_混沌' : ''}`,
                seriesName: `${affix}印系列${isChaos ? '（混沌）' : ''}`,
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 4. 社稷印
    if (name.includes('社稷印·')) {
        const genderMatch = name.match(/（(阳|阴)）/);
        const gender = genderMatch ? genderMatch[1] : '';
        const order = ['万里人皇', '千军王者', '天下至尊'];
        const siblings: CuratedEquipItem[] = [];
        for (const o of order) {
            const targetName = gender ? `社稷印·${o}（${gender}）` : `社稷印·${o}`;
            const match = allEquips.find(e => e.name === targetName);
            if (match) siblings.push(match);
        }
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: `社稷印_${gender}`,
                seriesName: `社稷印（${gender}）系列`,
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 5. 境界战罡 (辟谷 -> 元婴 -> 空冥 -> 渡劫 -> 寂灭)
    if (ZHAN_GANG_TIERS.includes(name)) {
        const siblings = ZHAN_GANG_TIERS.map(n => allEquips.find(e => e.name === n)).filter(Boolean) as CuratedEquipItem[];
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: '境界战罡',
                seriesName: '境界战罡系列',
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 6. 英雄勋章 (铜质 -> 银质 -> 金质)
    if (HERO_MEDAL_TIERS.includes(name)) {
        const siblings = HERO_MEDAL_TIERS.map(n => allEquips.find(e => e.name === n)).filter(Boolean) as CuratedEquipItem[];
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: '英雄勋章',
                seriesName: '英雄勋章系列',
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 7. 赛事绶带 (勇者 -> 季军 -> 亚军 -> 冠军)
    if (SHOUDAI_TIERS.includes(name)) {
        const siblings = SHOUDAI_TIERS.map(n => allEquips.find(e => e.name === n)).filter(Boolean) as CuratedEquipItem[];
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: '赛事绶带',
                seriesName: '赛事绶带系列',
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 8. 雷部印
    if (LEIBU_TIERS.includes(name)) {
        const siblings = LEIBU_TIERS.map(n => allEquips.find(e => e.name === n)).filter(Boolean) as CuratedEquipItem[];
        if (siblings.length > 1) {
            const curIdx = siblings.findIndex(e => e.name === name);
            return {
                seriesKey: '雷部印',
                seriesName: '雷部印系列',
                items: siblings,
                currentIndex: curIdx >= 0 ? curIdx : 0,
                currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
            };
        }
    }

    // 9. 逐鹿疆场 / 狮王争霸
    for (const p of ['逐鹿疆场', '狮王争霸']) {
        if (name.startsWith(p)) {
            const siblings = TITLE_YIN_TIERS.map(t => allEquips.find(e => e.name === `${p}${t}`)).filter(Boolean) as CuratedEquipItem[];
            if (siblings.length > 1) {
                const curIdx = siblings.findIndex(e => e.name === name);
                return {
                    seriesKey: p,
                    seriesName: `${p}印系列`,
                    items: siblings,
                    currentIndex: curIdx >= 0 ? curIdx : 0,
                    currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
                };
            }
        }
    }

    // 10. 项链 (太昊 / 太乙 6大分支神级项链)
    if (item.slot === '项链') {
        for (const [branch, godList] of Object.entries(ACCESSORY_BRANCH_GODS)) {
            const matchedGod = godList.find(g => name.includes(g));
            if (matchedGod && (name.includes('·' + branch) || name.includes(branch))) {
                const isTaiyi = name.includes('太乙');
                const isTaihao = name.includes('太昊');
                const subSuffix = isTaiyi ? '太乙' : (isTaihao ? '太昊' : '');
                const siblings: CuratedEquipItem[] = [];
                for (const g of godList) {
                    const match = allEquips.find(e =>
                        e.slot === '项链' &&
                        e.name.includes(g) &&
                        !e.name.includes('体验版') &&
                        (!subSuffix || e.name.includes(subSuffix))
                    );
                    if (match) siblings.push(match);
                }
                if (siblings.length > 1) {
                    const curIdx = siblings.findIndex(e => e.name === name);
                    return {
                        seriesKey: `项链_${branch}_${subSuffix}`,
                        seriesName: `${branch}项链系列（${subSuffix}）`,
                        items: siblings,
                        currentIndex: curIdx >= 0 ? curIdx : 0,
                        currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
                    };
                }
            }
        }
    }

    // 11. 戒指 (符石 / 血玉 6大分支)
    if (item.slot === '戒指') {
        const isFuShi = name.includes('符石');
        const isXueYu = name.includes('血玉');
        const ringType = isFuShi ? '符石' : (isXueYu ? '血玉' : '');
        if (ringType) {
            for (const [branch, godList] of Object.entries(ACCESSORY_BRANCH_GODS)) {
                const branchAlt = branch === '天弈' ? ['天弈', '天奕'] : [branch];
                const matchedGod = godList.find(g => name.includes(g));
                if (matchedGod && branchAlt.some(b => name.includes(b))) {
                    const siblings: CuratedEquipItem[] = [];
                    for (const g of godList) {
                        const match = allEquips.find(e =>
                            e.slot === '戒指' &&
                            e.name.includes(g) &&
                            e.name.includes(ringType) &&
                            !e.name.includes('体验版')
                        );
                        if (match) siblings.push(match);
                    }
                    if (siblings.length > 1) {
                        const curIdx = siblings.findIndex(e => e.name === name);
                        return {
                            seriesKey: `戒指_${branch}_${ringType}`,
                            seriesName: `${branch}·${ringType}系列`,
                            items: siblings,
                            currentIndex: curIdx >= 0 ? curIdx : 0,
                            currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${siblings.length}阶`
                        };
                    }
                }
            }
        }
    }

    // 12. 通用星级进阶 (如 大乘战罡、玄灵战罡、无常空相、天道玄妙、观心自在锦囊等)
    const baseName = name.replace(/★+$/, '');
    const starMatches = allEquips.filter(e => {
        const eBase = (e.name || '').replace(/★+$/, '');
        return eBase === baseName && (e.slot === item.slot || !item.slot);
    });
    if (starMatches.length > 1) {
        starMatches.sort((a, b) => {
            const countA = (a.name.match(/★/g) || []).length;
            const countB = (b.name.match(/★/g) || []).length;
            return countA - countB;
        });
        const curIdx = starMatches.findIndex(e => e.name === name);
        return {
            seriesKey: `star_${baseName}`,
            seriesName: `${baseName}系列`,
            items: starMatches,
            currentIndex: curIdx >= 0 ? curIdx : 0,
            currentTierLabel: `${(curIdx >= 0 ? curIdx : 0) + 1}/${starMatches.length}阶`
        };
    }

    return null;
}

/**
 * 将装备候选列表中的同系列中间阶位聚合去重，默认保留最高阶作为系列代表
 * 避免数十件同系中间阶位填满候选栏，让用户在卡片内直接点击 [降阶] / [升阶] 切换
 */
export function collapseSeriesCandidates(
    candidates: CuratedEquipItem[],
    allEquips: CuratedEquipItem[]
): CuratedEquipItem[] {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const seriesSeen = new Map<string, CuratedEquipItem>();
    const result: CuratedEquipItem[] = [];

    for (const c of candidates) {
        const s = getEquipSeries(c, allEquips);
        if (s && s.items.length > 1) {
            if (!seriesSeen.has(s.seriesKey)) {
                // 系列候选默认展现该系列最高阶
                const topItem = s.items[s.items.length - 1];
                seriesSeen.set(s.seriesKey, topItem);
                result.push(topItem);
            }
        } else {
            // 普通独立装备按纯净名称去重（去除性别后缀）
            const cleanName = (c.name || '').replace(/[（(][男女][）)]/g, '').trim();
            if (!seriesSeen.has(cleanName)) {
                seriesSeen.set(cleanName, c);
                result.push(c);
            }
        }
    }

    return result;
}

/**
 * yunlingLuck.ts
 * 装备蕴灵运气分位（击败率）与连败概率测算
 */

import { DEFAULT_CONFIG, successProb } from './yunlingSim';
import { YUNLING_LUCK_TABLE } from './yunlingLuckTable.generated';

export interface YunlingLuckAssessment {
    /** 击败全服玩家百分比 (0.1 ~ 99.9) */
    beatRate: number;
    /** 运气档位 */
    tier: '欧皇' | '大吉' | '平稳' | '坎坷' | '非酋';
    /** 徽标小字，如「欧皇前 5%」「极罕见连败」 */
    badge: string;
    /** 主标题，如「击败了 96.4% 的洗练玩家」或「遭遇了 0.3% 的极罕见连败」 */
    headline: string;
    /** 副标题，如「当前手数处于全服前 5% 的欧皇区间」 */
    subText: string;
    /** 视觉基调 */
    tone: 'gold' | 'cyan' | 'red' | 'slate';
}

/**
 * 测算单级连续失败达到 tries 手的理论生存概率（遭遇连败概率）
 * P = ∏(1 - p_j)
 */
export function calcStreakProb(level: number, tries: number): number {
    if (tries <= 1 || level <= 0) return 1;
    let pSurvive = 1;
    for (let j = 1; j < tries; j++) {
        const p = successProb(level, DEFAULT_CONFIG, 0, () => 0.5, j - 1);
        pSurvive *= 1 - p;
        if (pSurvive < 1e-6) break;
    }
    return pSurvive;
}

/**
 * 根据起止等级与总手数，在预先计算的蒙特卡洛 CDF 表中查出击败率 (beatRate)
 * 手数越少代表越幸运，击败的玩家比例越高。
 */
export function calcBeatRate(start: number, end: number, totalTries: number): number {
    const s = Math.max(0, Math.min(14, Math.round(start)));
    const e = Math.max(s + 1, Math.min(15, Math.round(end)));
    const q = YUNLING_LUCK_TABLE[`${s}_${e}`];
    if (!q || q.length < 101) return 50.0;

    if (totalTries <= q[0]) return 99.9;
    if (totalTries >= q[100]) return 0.1;

    let lo = 0;
    let hi = 100;
    while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (q[mid] <= totalTries) lo = mid;
        else hi = mid;
    }

    const range = q[hi] - q[lo];
    const ratio = range === 0 ? 0 : (totalTries - q[lo]) / range;
    const pct = lo + ratio * (hi - lo);
    return Math.max(0.1, Math.min(99.9, 100 - pct));
}

/**
 * 综合评估本次蕴灵的运气情况
 */
export function calcYunlingLuck(
    startLevel: number,
    endLevel: number,
    totalTries: number,
    maxTriesInLevel: number,
    maxTriesLevel: number,
): YunlingLuckAssessment {
    // 若没有实际提升（如原地失败），保底当做冲下一级
    const effectiveEnd = endLevel > startLevel ? endLevel : startLevel + 1;
    const beatRate = calcBeatRate(startLevel, effectiveEnd, totalTries);
    const streakProb = calcStreakProb(maxTriesLevel, maxTriesInLevel);

    const streakPct = streakProb * 100;
    const isExtremeStreak = streakProb <= 0.03; // 单级连败概率低于 3%（极罕见事件）

    if (beatRate >= 95.0) {
        return {
            beatRate,
            tier: '欧皇',
            badge: '欧皇前 5%',
            headline: `击败了 ${beatRate.toFixed(1)}% 的玩家`,
            subText: '总消耗处于全服前 5% 的欧皇区间',
            tone: 'gold',
        };
    }

    // 若遭遇极罕见单级连败（≤ 3%），优先凸显连败以契合玩家吐槽心理
    if (isExtremeStreak) {
        return {
            beatRate,
            tier: beatRate < 20.0 ? '非酋' : '坎坷',
            badge: streakProb <= 0.01 ? '极罕见连败' : '遭遇连败',
            headline: `遭遇了 ${streakPct.toFixed(1)}% 的${streakProb <= 0.01 ? '极罕见' : ''}连败`,
            subText: `单级最多消耗 ${maxTriesInLevel} 手（击败了 ${beatRate.toFixed(1)}% 的玩家）`,
            tone: 'red',
        };
    }

    if (beatRate >= 80.0) {
        return {
            beatRate,
            tier: '大吉',
            badge: '气运亨通',
            headline: `击败了 ${beatRate.toFixed(1)}% 的玩家`,
            subText: '总消耗远少于大多数玩家，运气绝佳',
            tone: 'gold',
        };
    }

    if (beatRate >= 40.0) {
        return {
            beatRate,
            tier: '平稳',
            badge: '气运平稳',
            headline: `击败了 ${beatRate.toFixed(1)}% 的玩家`,
            subText: '总消耗处于全服主流平均区间',
            tone: 'cyan',
        };
    }

    if (beatRate >= 15.0) {
        return {
            beatRate,
            tier: '坎坷',
            badge: '略有波折',
            headline: `击败了 ${beatRate.toFixed(1)}% 的玩家`,
            subText: '总消耗略高于平均水平，略有波折',
            tone: 'slate',
        };
    }

    return {
        beatRate,
        tier: '非酋',
        badge: '非酋时刻',
        headline: `击败了 ${beatRate.toFixed(1)}% 的玩家`,
        subText: '总消耗处于全服后 15% 的坎坷区间',
        tone: 'red',
    };
}

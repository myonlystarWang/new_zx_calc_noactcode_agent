import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
    GAME_COLORS
} from '../../constants/gameColorSystem';

function formatPeizhangAttrName(name: string): string {
    if (!name) return '';
    return name
        .replace(/暴击伤害/g, '致命一击伤害')
        .replace(/暴击率/g, '致命一击率');
}

export interface PeizhangTypeData {
    id: string;
    name: string;
    shortName: string;
    focus: string;
    sampleRolls: {
        base: Record<string, number>;
        hidden: Record<string, string>;
    };
    baseAttributes: Array<{
        name: string;
        min: number;
        max: number;
        step: number;
        rate: number;
        isPercent: boolean;
    }>;
    refineUnlocks: Record<string, Array<{ attr: string; rate: number }>>;
}

export interface PeizhangCardData {
    selectedTypeId?: string;
    refineLevel?: number;
    types?: PeizhangTypeData[];
}

export interface PeizhangDetailCardProps {
    cardData?: PeizhangCardData;
    className?: string;
}

// 内置五大圣粹佩章数据底座
const DEFAULT_TYPES: PeizhangTypeData[] = [
    {
        id: 'huifeng',
        name: '回风佩章<圣粹>',
        shortName: '回风',
        focus: '特化攻击与气血',
        sampleRolls: {
            base: { '固定攻击': 419, '攻击': 1.9, '固定气血': 701, '气血': 1.9 },
            hidden: {
                '5': '固定气血 +500',
                '7': '固定攻击 +240',
                '9': '减免暴伤 +20.1%',
                '11': '气血 +4.0%',
                '13': '对人族增伤 +12.0%'
            }
        },
        baseAttributes: [
            { name: '攻击', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '气血', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '固定气血', min: 550, max: 800, step: 250, rate: 0.25, isPercent: false },
            { name: '固定攻击', min: 325, max: 450, step: 150, rate: 0.25, isPercent: false }
        ],
        refineUnlocks: {
            '5': [
                { attr: '固定攻击 +120', rate: 0.2125 },
                { attr: '固定防御 +200', rate: 0.2125 },
                { attr: '固定气血 +500', rate: 0.2125 },
                { attr: '固定真气 +500', rate: 0.2125 },
                { attr: '攻击 +1.0%', rate: 0.05 },
                { attr: '气血 +1.0%', rate: 0.05 },
                { attr: '真气 +1.0%', rate: 0.05 }
            ],
            '7': [
                { attr: '固定攻击 +240', rate: 0.26 },
                { attr: '固定气血 +800', rate: 0.26 },
                { attr: '固定真气 +800', rate: 0.26 },
                { attr: '克仙 +1.0%', rate: 0.05 },
                { attr: '克佛 +1.0%', rate: 0.05 },
                { attr: '克魔 +1.0%', rate: 0.05 },
                { attr: '攻击 +2.0%', rate: 0.05 },
                { attr: '攻击 +5.1%', rate: 0.02 }
            ],
            '9': [
                { attr: '克仙 +3.0%', rate: 0.17 },
                { attr: '克佛 +3.0%', rate: 0.17 },
                { attr: '克魔 +3.0%', rate: 0.17 },
                { attr: '减免暴击 +1.0%', rate: 0.15 },
                { attr: '减免暴击 +5.1%', rate: 0.03 },
                { attr: '减免暴伤 +5.1%', rate: 0.15 },
                { attr: '减免暴伤 +20.1%', rate: 0.03 },
                { attr: '气血 +1.0%', rate: 0.10 },
                { attr: '气血 +5.1%', rate: 0.03 }
            ],
            '11': [
                { attr: '攻击 +2.0%', rate: 0.10 },
                { attr: '攻击 +4.0%', rate: 0.10 },
                { attr: '气血 +2.0%', rate: 0.10 },
                { attr: '气血 +4.0%', rate: 0.10 },
                { attr: '真气 +2.0%', rate: 0.10 },
                { attr: '真气 +4.0%', rate: 0.10 },
                { attr: '技能命中 +2.0', rate: 0.08 },
                { attr: '技能命中 +5.1', rate: 0.08 },
                { attr: '无视伤害减免 +2.0%', rate: 0.06 },
                { attr: '无视伤害减免 +5.1%', rate: 0.06 },
                { attr: '伤害减免 +1.5%', rate: 0.06 },
                { attr: '伤害减免 +3.0%', rate: 0.06 }
            ],
            '13': [
                { attr: '攻击 +6.0%', rate: 0.11 },
                { attr: '攻击 +10.1%', rate: 0.11 },
                { attr: '气血 +6.0%', rate: 0.11 },
                { attr: '气血 +10.1%', rate: 0.11 },
                { attr: '对人族增伤 +4.0%', rate: 0.12 },
                { attr: '对人族增伤 +12.0%', rate: 0.02 },
                { attr: '对神裔增伤 +4.0%', rate: 0.12 },
                { attr: '对神裔增伤 +12.0%', rate: 0.02 },
                { attr: '对天脉增伤 +4.0%', rate: 0.12 },
                { attr: '对天脉增伤 +12.0%', rate: 0.02 },
                { attr: '对苍祇增伤 +4.0%', rate: 0.12 },
                { attr: '对苍祇增伤 +12.0%', rate: 0.02 }
            ]
        }
    },
    {
        id: 'pixiu',
        name: '貔貅佩章<圣粹>',
        shortName: '貔貅',
        focus: '特化攻击与真气',
        sampleRolls: {
            base: { '固定攻击': 419, '攻击': 1.9, '固定真气': 701, '真气': 1.9 },
            hidden: {
                '5': '固定气血 +500',
                '7': '固定攻击 +240',
                '9': '减免暴伤 +20.1%',
                '11': '真气 +4.0%',
                '13': '对人族增伤 +12.0%'
            }
        },
        baseAttributes: [
            { name: '攻击', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '真气', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '固定真气', min: 550, max: 800, step: 250, rate: 0.25, isPercent: false },
            { name: '固定攻击', min: 325, max: 450, step: 150, rate: 0.25, isPercent: false }
        ],
        refineUnlocks: {
            '5': [
                { attr: '固定攻击 +120', rate: 0.2125 },
                { attr: '固定防御 +200', rate: 0.2125 },
                { attr: '固定气血 +500', rate: 0.2125 },
                { attr: '固定真气 +500', rate: 0.2125 },
                { attr: '攻击 +1.0%', rate: 0.05 },
                { attr: '气血 +1.0%', rate: 0.05 },
                { attr: '真气 +1.0%', rate: 0.05 }
            ],
            '7': [
                { attr: '固定攻击 +240', rate: 0.26 },
                { attr: '固定气血 +800', rate: 0.26 },
                { attr: '固定真气 +800', rate: 0.26 },
                { attr: '克仙 +1.0%', rate: 0.05 },
                { attr: '克佛 +1.0%', rate: 0.05 },
                { attr: '克魔 +1.0%', rate: 0.05 },
                { attr: '攻击 +2.0%', rate: 0.05 },
                { attr: '攻击 +5.1%', rate: 0.02 }
            ],
            '9': [
                { attr: '克仙 +3.0%', rate: 0.17 },
                { attr: '克佛 +3.0%', rate: 0.17 },
                { attr: '克魔 +3.0%', rate: 0.17 },
                { attr: '减免暴击 +1.0%', rate: 0.15 },
                { attr: '减免暴击 +5.1%', rate: 0.03 },
                { attr: '减免暴伤 +5.1%', rate: 0.15 },
                { attr: '减免暴伤 +20.1%', rate: 0.03 },
                { attr: '真气 +1.0%', rate: 0.10 },
                { attr: '真气 +5.1%', rate: 0.03 }
            ],
            '11': [
                { attr: '攻击 +2.0%', rate: 0.10 },
                { attr: '攻击 +4.0%', rate: 0.10 },
                { attr: '气血 +2.0%', rate: 0.10 },
                { attr: '气血 +4.0%', rate: 0.10 },
                { attr: '真气 +2.0%', rate: 0.10 },
                { attr: '真气 +4.0%', rate: 0.10 },
                { attr: '技能命中 +2.0', rate: 0.08 },
                { attr: '技能命中 +5.1', rate: 0.08 },
                { attr: '无视伤害减免 +2.0%', rate: 0.06 },
                { attr: '无视伤害减免 +5.1%', rate: 0.06 },
                { attr: '伤害减免 +1.5%', rate: 0.06 },
                { attr: '伤害减免 +3.0%', rate: 0.06 }
            ],
            '13': [
                { attr: '攻击 +6.0%', rate: 0.11 },
                { attr: '攻击 +10.1%', rate: 0.11 },
                { attr: '真气 +6.0%', rate: 0.11 },
                { attr: '真气 +10.1%', rate: 0.11 },
                { attr: '对人族增伤 +4.0%', rate: 0.12 },
                { attr: '对人族增伤 +12.0%', rate: 0.02 },
                { attr: '对神裔增伤 +4.0%', rate: 0.12 },
                { attr: '对神裔增伤 +12.0%', rate: 0.02 },
                { attr: '对天脉增伤 +4.0%', rate: 0.12 },
                { attr: '对天脉增伤 +12.0%', rate: 0.02 },
                { attr: '对苍祇增伤 +4.0%', rate: 0.12 },
                { attr: '对苍祇增伤 +12.0%', rate: 0.02 }
            ]
        }
    },
    {
        id: 'jiaotu',
        name: '椒图佩章<圣粹>',
        shortName: '椒图',
        focus: '特化攻击与暴击/暴伤',
        sampleRolls: {
            base: { '致命一击伤害': 2.0, '致命一击率': 0.9, '固定攻击': 361, '攻击': 1.5 },
            hidden: {
                '5': '固定真气 +500',
                '7': '攻击 +2.0%',
                '9': '致命一击率 +3.0%',
                '11': '气血 +2.0%',
                '13': '对人族增伤 +12.0%'
            }
        },
        baseAttributes: [
            { name: '致命一击伤害', min: 1.75, max: 2.5, step: 1.2, rate: 0.25, isPercent: true },
            { name: '致命一击率', min: 0.7, max: 1.1, step: 0.35, rate: 0.25, isPercent: true },
            { name: '固定攻击', min: 325, max: 450, step: 150, rate: 0.25, isPercent: false },
            { name: '攻击', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true }
        ],
        refineUnlocks: {
            '5': [
                { attr: '固定攻击 +120', rate: 0.2125 },
                { attr: '固定防御 +200', rate: 0.2125 },
                { attr: '固定气血 +500', rate: 0.2125 },
                { attr: '固定真气 +500', rate: 0.2125 },
                { attr: '攻击 +1.0%', rate: 0.05 },
                { attr: '气血 +1.0%', rate: 0.05 },
                { attr: '真气 +1.0%', rate: 0.05 }
            ],
            '7': [
                { attr: '固定攻击 +240', rate: 0.26 },
                { attr: '固定气血 +800', rate: 0.26 },
                { attr: '固定真气 +800', rate: 0.26 },
                { attr: '克仙 +1.0%', rate: 0.05 },
                { attr: '克佛 +1.0%', rate: 0.05 },
                { attr: '克魔 +1.0%', rate: 0.05 },
                { attr: '攻击 +2.0%', rate: 0.05 },
                { attr: '攻击 +5.1%', rate: 0.02 }
            ],
            '9': [
                { attr: '克仙 +3.0%', rate: 0.17 },
                { attr: '克佛 +3.0%', rate: 0.17 },
                { attr: '克魔 +3.0%', rate: 0.17 },
                { attr: '减免暴击 +1.0%', rate: 0.15 },
                { attr: '减免暴击 +5.1%', rate: 0.03 },
                { attr: '减免暴伤 +5.1%', rate: 0.15 },
                { attr: '减免暴伤 +20.1%', rate: 0.03 },
                { attr: '暴击率 +1.0%', rate: 0.10 },
                { attr: '暴击率 +3.0%', rate: 0.03 }
            ],
            '11': [
                { attr: '攻击 +2.0%', rate: 0.10 },
                { attr: '攻击 +4.0%', rate: 0.10 },
                { attr: '气血 +2.0%', rate: 0.10 },
                { attr: '气血 +4.0%', rate: 0.10 },
                { attr: '真气 +2.0%', rate: 0.10 },
                { attr: '真气 +4.0%', rate: 0.10 },
                { attr: '技能命中 +2.0', rate: 0.08 },
                { attr: '技能命中 +5.1', rate: 0.08 },
                { attr: '无视伤害减免 +2.0%', rate: 0.06 },
                { attr: '无视伤害减免 +5.1%', rate: 0.06 },
                { attr: '伤害减免 +1.5%', rate: 0.06 },
                { attr: '伤害减免 +3.0%', rate: 0.06 }
            ],
            '13': [
                { attr: '攻击 +6.0%', rate: 0.11 },
                { attr: '攻击 +10.1%', rate: 0.11 },
                { attr: '气血 +6.0%', rate: 0.11 },
                { attr: '气血 +10.1%', rate: 0.11 },
                { attr: '对人族增伤 +4.0%', rate: 0.12 },
                { attr: '对人族增伤 +12.0%', rate: 0.02 },
                { attr: '对神裔增伤 +4.0%', rate: 0.12 },
                { attr: '对神裔增伤 +12.0%', rate: 0.02 },
                { attr: '对天脉增伤 +4.0%', rate: 0.12 },
                { attr: '对天脉增伤 +12.0%', rate: 0.02 },
                { attr: '对苍祇增伤 +4.0%', rate: 0.12 },
                { attr: '对苍祇增伤 +12.0%', rate: 0.02 }
            ]
        }
    },
    {
        id: 'jiaoduan',
        name: '角端佩章<圣粹>',
        shortName: '角端',
        focus: '特化五大抗性与种族减伤',
        sampleRolls: {
            base: { '眩晕抗性': 9, '魅惑抗性': 9, '昏睡抗性': 9, '虚弱抗性': 9, '定身抗性': 9 },
            hidden: {
                '5': '固定气血 +500',
                '7': '固定攻击 +240',
                '9': '暴击伤害 +12.0%',
                '11': '伤害减免 +3.0%',
                '13': '对人族减伤 +12.0%'
            }
        },
        baseAttributes: [
            { name: '眩晕抗性', min: 7, max: 10, step: 3, rate: 0.20, isPercent: false },
            { name: '魅惑抗性', min: 7, max: 10, step: 3, rate: 0.20, isPercent: false },
            { name: '昏睡抗性', min: 7, max: 10, step: 3, rate: 0.20, isPercent: false },
            { name: '虚弱抗性', min: 7, max: 10, step: 3, rate: 0.20, isPercent: false },
            { name: '定身抗性', min: 7, max: 10, step: 3, rate: 0.20, isPercent: false }
        ],
        refineUnlocks: {
            '5': [
                { attr: '固定攻击 +120', rate: 0.2125 },
                { attr: '固定防御 +200', rate: 0.2125 },
                { attr: '固定气血 +500', rate: 0.2125 },
                { attr: '固定真气 +500', rate: 0.2125 },
                { attr: '攻击 +1.0%', rate: 0.05 },
                { attr: '气血 +1.0%', rate: 0.05 },
                { attr: '真气 +1.0%', rate: 0.05 }
            ],
            '7': [
                { attr: '固定攻击 +240', rate: 0.26 },
                { attr: '固定气血 +800', rate: 0.26 },
                { attr: '固定真气 +800', rate: 0.26 },
                { attr: '克仙 +1.0%', rate: 0.05 },
                { attr: '克佛 +1.0%', rate: 0.05 },
                { attr: '克魔 +1.0%', rate: 0.05 },
                { attr: '攻击 +2.0%', rate: 0.05 },
                { attr: '攻击 +5.1%', rate: 0.02 }
            ],
            '9': [
                { attr: '克仙 +3.0%', rate: 0.17 },
                { attr: '克佛 +3.0%', rate: 0.17 },
                { attr: '克魔 +3.0%', rate: 0.17 },
                { attr: '减免暴击 +1.0%', rate: 0.15 },
                { attr: '减免暴击 +5.1%', rate: 0.03 },
                { attr: '减免暴伤 +5.1%', rate: 0.15 },
                { attr: '减免暴伤 +20.1%', rate: 0.03 },
                { attr: '暴击伤害 +5.1%', rate: 0.10 },
                { attr: '暴击伤害 +12.0%', rate: 0.03 }
            ],
            '11': [
                { attr: '攻击 +2.0%', rate: 0.10 },
                { attr: '攻击 +4.0%', rate: 0.10 },
                { attr: '气血 +2.0%', rate: 0.10 },
                { attr: '气血 +4.0%', rate: 0.10 },
                { attr: '真气 +2.0%', rate: 0.10 },
                { attr: '真气 +4.0%', rate: 0.10 },
                { attr: '技能命中 +2.0', rate: 0.08 },
                { attr: '技能命中 +5.1', rate: 0.08 },
                { attr: '无视伤害减免 +2.0%', rate: 0.06 },
                { attr: '无视伤害减免 +5.1%', rate: 0.06 },
                { attr: '伤害减免 +1.5%', rate: 0.06 },
                { attr: '伤害减免 +3.0%', rate: 0.06 }
            ],
            '13': [
                { attr: '攻击 +6.0%', rate: 0.11 },
                { attr: '攻击 +10.1%', rate: 0.11 },
                { attr: '真气 +6.0%', rate: 0.11 },
                { attr: '真气 +10.1%', rate: 0.11 },
                { attr: '对人族减伤 +4.0%', rate: 0.12 },
                { attr: '对人族减伤 +12.0%', rate: 0.02 },
                { attr: '对神裔减伤 +4.0%', rate: 0.12 },
                { attr: '对神裔减伤 +12.0%', rate: 0.02 },
                { attr: '对天脉减伤 +4.0%', rate: 0.12 },
                { attr: '对天脉减伤 +12.0%', rate: 0.02 },
                { attr: '对苍祇减伤 +4.0%', rate: 0.12 },
                { attr: '对苍祇减伤 +12.0%', rate: 0.02 }
            ]
        }
    },
    {
        id: 'hanying',
        name: '含瑛佩章<圣粹>',
        shortName: '含瑛',
        focus: '特化气血/真气与减免防御',
        sampleRolls: {
            base: { '固定气血': 701, '气血': 1.9, '固定真气': 701, '真气': 1.9 },
            hidden: {
                '5': '固定气血 +500',
                '7': '减免暴伤 +8.0%',
                '9': '减免暴伤 +40.1%',
                '11': '伤害减免 +3.0%',
                '13': '对人族减伤 +12.0%'
            }
        },
        baseAttributes: [
            { name: '气血', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '真气', min: 1.25, max: 2.0, step: 0.8, rate: 0.25, isPercent: true },
            { name: '固定气血', min: 550, max: 800, step: 250, rate: 0.25, isPercent: false },
            { name: '固定真气', min: 550, max: 800, step: 250, rate: 0.25, isPercent: false }
        ],
        refineUnlocks: {
            '5': [
                { attr: '固定防御 +200', rate: 0.30 },
                { attr: '固定气血 +500', rate: 0.25 },
                { attr: '固定真气 +500', rate: 0.25 },
                { attr: '防御 +1.0%', rate: 0.10 },
                { attr: '气血 +1.0%', rate: 0.05 },
                { attr: '真气 +1.0%', rate: 0.05 }
            ],
            '7': [
                { attr: '固定防御 +400', rate: 0.29 },
                { attr: '固定气血 +800', rate: 0.30 },
                { attr: '固定真气 +800', rate: 0.30 },
                { attr: '御仙 +1.0%', rate: 0.03 },
                { attr: '御佛 +1.0%', rate: 0.03 },
                { attr: '御魔 +1.0%', rate: 0.03 },
                { attr: '减免暴击 +1.0%', rate: 0.01 },
                { attr: '减免暴伤 +8.0%', rate: 0.01 }
            ],
            '9': [
                { attr: '御仙 +3.0%', rate: 0.17 },
                { attr: '御佛 +3.0%', rate: 0.17 },
                { attr: '御魔 +3.0%', rate: 0.17 },
                { attr: '气血 +5.1%', rate: 0.08 },
                { attr: '真气 +5.1%', rate: 0.08 },
                { attr: '减免暴击 +1.0%', rate: 0.15 },
                { attr: '减免暴击 +5.1%', rate: 0.03 },
                { attr: '减免暴伤 +8.0%', rate: 0.13 },
                { attr: '减免暴伤 +40.1%', rate: 0.02 }
            ],
            '11': [
                { attr: '气血 +2.0%', rate: 0.10 },
                { attr: '气血 +4.0%', rate: 0.10 },
                { attr: '真气 +2.0%', rate: 0.10 },
                { attr: '真气 +4.0%', rate: 0.10 },
                { attr: '御仙 +3.0%', rate: 0.10 },
                { attr: '御仙 +4.0%', rate: 0.10 },
                { attr: '御佛 +3.0%', rate: 0.08 },
                { attr: '御佛 +4.0%', rate: 0.08 },
                { attr: '御魔 +3.0%', rate: 0.06 },
                { attr: '御魔 +4.0%', rate: 0.06 },
                { attr: '伤害减免 +1.5%', rate: 0.06 },
                { attr: '伤害减免 +3.0%', rate: 0.06 }
            ],
            '13': [
                { attr: '气血 +6.0%', rate: 0.11 },
                { attr: '气血 +10.1%', rate: 0.11 },
                { attr: '真气 +6.0%', rate: 0.11 },
                { attr: '真气 +10.1%', rate: 0.11 },
                { attr: '对人族减伤 +4.0%', rate: 0.12 },
                { attr: '对人族减伤 +12.0%', rate: 0.02 },
                { attr: '对神裔减伤 +4.0%', rate: 0.12 },
                { attr: '对神裔减伤 +12.0%', rate: 0.02 },
                { attr: '对天脉减伤 +4.0%', rate: 0.12 },
                { attr: '对天脉减伤 +12.0%', rate: 0.02 },
                { attr: '对苍祇减伤 +4.0%', rate: 0.12 },
                { attr: '对苍祇减伤 +12.0%', rate: 0.02 }
            ]
        }
    }
];

export const PeizhangDetailCard: React.FC<PeizhangDetailCardProps> = ({
    cardData,
    className
}) => {
    const types = cardData?.types && cardData.types.length > 0 ? cardData.types : DEFAULT_TYPES;

    // 当前选中的佩章分类（默认貔貅或通过 query 指定）
    const [selectedId, setSelectedId] = useState<string>(() => {
        if (cardData?.selectedTypeId) {
            const match = types.find(t => t.id === cardData.selectedTypeId || t.name.includes(cardData.selectedTypeId!) || t.shortName === cardData.selectedTypeId);
            if (match) return match.id;
        }
        return 'pixiu';
    });

    // 当前炼器等级（0 ~ 15，默认 11 或通过 query 指定）
    const [refLevel, setRefLevel] = useState<number>(() => {
        if (typeof cardData?.refineLevel === 'number') {
            return Math.min(15, Math.max(0, cardData.refineLevel));
        }
        return 11;
    });

    // 是否展开未激活的「阶位隐藏属性池」
    const [showLockedPool, setShowLockedPool] = useState<boolean>(false);

    const currentType = useMemo(() => {
        return types.find(t => t.id === selectedId) || types[0];
    }, [types, selectedId]);

    // 佩章装备名称色彩：统一为纯白字，不随等级变色（与游戏/寻宝天行实机一致）
    const titleColor = GAME_COLORS.WHITE;

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0 max-w-xl',
            className
        )}>
            {/* 五大圣粹佩章分类切换 Capsule Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-sans">
                {types.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={clsx(
                            'px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors border whitespace-nowrap',
                            t.id === selectedId
                                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50 shadow-sm'
                                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                        )}
                    >
                        {t.shortName}
                    </button>
                ))}
            </div>

            {/* 1:1 游戏实机与寻宝天行原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 装备头部区域：装备名称（纯白字）与强化步进控制台 */}
                <div className="pb-1.5 mb-1 border-b border-[#1f293d]/80 flex items-center justify-between gap-2 min-w-0 flex-wrap">
                    {/* 完整装备名称（纯白字，不随炼器变色） */}
                    <div
                        className="font-bold text-[13px] sm:text-[14px] leading-snug break-words"
                        style={{ color: titleColor }}
                    >
                        {`${currentType.name}（炼器 ＋${refLevel}）`}
                    </div>

                    {/* 步进推演控制（强化 -1 / 强化 +1，样式与昭武完全对齐） */}
                    <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto font-sans">
                        <span className="text-[10px] sm:text-[11px] text-cyan-300/90 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 whitespace-nowrap">
                            +{refLevel}
                        </span>
                        <button
                            type="button"
                            onClick={() => setRefLevel(prev => Math.max(0, prev - 1))}
                            disabled={refLevel <= 0}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border whitespace-nowrap cursor-pointer',
                                refLevel <= 0
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                            )}
                        >
                            强化 -1
                        </button>
                        <button
                            type="button"
                            onClick={() => setRefLevel(prev => Math.min(15, prev + 1))}
                            disabled={refLevel >= 15}
                            className={clsx(
                                'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border whitespace-nowrap cursor-pointer',
                                refLevel >= 15
                                    ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                    : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                            )}
                        >
                            强化 +1
                        </button>
                    </div>
                </div>

                {/* 佩章名字下面是 已绑定 与 不会掉落（橙色，与寻宝网完全一致） */}
                <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                    已绑定
                </div>
                <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                    不会掉落
                </div>

                {/* 装备等级与基础属性（纯白字，随炼器等级动态累加） */}
                <div style={{ color: GAME_COLORS.WHITE }}>
                    等级 1
                </div>

                {/* 基础属性列表（白字展示，计算当前 +N 阶数值） */}
                {currentType.baseAttributes.map((attr, idx) => {
                    const baseVal = currentType.sampleRolls.base[attr.name] ?? attr.min;
                    const currentVal = baseVal + refLevel * attr.step;
                    const valStr = attr.isPercent ? `+${currentVal.toFixed(1)}%` : `+${Math.round(currentVal)}`;
                    return (
                        <div key={idx} style={{ color: GAME_COLORS.WHITE }}>
                            {formatPeizhangAttrName(attr.name)} {valStr}
                        </div>
                    );
                })}

                {/* 阶位隐藏属性池：+5, +7, +9, +11, +13 各阶位所有可能属性与概率 */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[12px] font-bold text-amber-300">
                        <span>阶位隐藏属性池:</span>
                        <button
                            type="button"
                            onClick={() => setShowLockedPool(prev => !prev)}
                            className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-sans font-normal"
                        >
                            {showLockedPool ? '仅显示已激活档位' : '展开未激活档位池'}
                        </button>
                    </div>

                    {[5, 7, 9, 11, 13].map(tier => {
                        const isUnlocked = refLevel >= tier;
                        const poolItems = currentType.refineUnlocks[String(tier)] || [];
                        const shouldShowList = isUnlocked || showLockedPool;

                        return (
                            <div
                                key={tier}
                                className="text-[12px] pl-1"
                            >
                                <div
                                    className="font-semibold flex items-center justify-between text-[11px] mb-0.5 opacity-90"
                                    style={{
                                        color: isUnlocked ? '#ffd272' : GAME_COLORS.TEXT_LOCKED
                                    }}
                                >
                                    <span>+{tier}档位</span>
                                    <span>{isUnlocked ? '已激活' : `需炼器 +${tier}`}</span>
                                </div>
                                {shouldShowList && (
                                    <div className="pl-2 space-y-0.5 text-[11px]">
                                        {poolItems.map((pi, pIdx) => {
                                            const ratePct = (pi.rate * 100).toFixed(pi.rate * 100 % 1 === 0 ? 0 : 2);
                                            return (
                                                <div
                                                    key={pIdx}
                                                    style={{
                                                        color: isUnlocked ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED
                                                    }}
                                                >
                                                    · {formatPeizhangAttrName(pi.attr)} ({ratePct}%)
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 底部属性与穿戴要求（寻宝天行与游戏客户端 1:1 标准） */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        价格 5000 金
                    </div>
                    <div className="pt-1.5" style={{ color: GAME_COLORS.HUN_GREEN }}>
                        苍龙为佩，白玉印钮。<br/>
                        日月轮替，虹隐玄珠。<br/>
                        阴阳正道，中和后土。<br/>
                        列宿周转，名存不朽。
                    </div>
                    <div style={{ color: GAME_COLORS.SHENYIN_CYAN }}>
                        河阳 章小佩<span style={{ color: '#ffcb4a' }}>处提供该佩章的精炼服务，详情请前往查看。</span>
                    </div>
                    <div style={{ color: GAME_COLORS.HUN_GREEN }}>
                        按Alt键可隐藏佩章次要信息
                    </div>
                </div>
            </div>
        </div>
    );
};

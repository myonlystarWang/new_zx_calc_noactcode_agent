/**
 * 三张模拟器长图的数据映射。
 *
 * 只做「数据 → PosterModel」，不碰绘制。属性名/数值由各卡片自己解析好再传进来，
 * 这里是纯函数，便于单测与排查。
 */
import type { PosterModel, PosterSection } from './PosterCard';
import { DEFAULT_SITE_URL, todayText } from './sharePosterKit';
import { calcYunlingLuck } from '../../utils/yunlingLuck';

const DISCLAIMER =
    '本图由天书万象 AI 依据官方数据模拟生成，\n可能存在误差，请以游戏内实际为准。';

const int = (n: number) => Math.round(n).toLocaleString('zh-CN');

export interface YunlingPosterInput {
    equipName: string | null;
    qualityLabel: string;
    slotLabel: string;
    startLevel: number;
    level: number;
    equipLuck: number;
    personLuck: number;
    rows: Array<{ tries: number; cost: number }>;
    totalTries: number;
    totalCost: number;
    dateText?: string;
}

/** 装备蕴灵：主数据=手数/月德符，分区=逐级消耗 + 关键指标 */
export function buildYunlingPoster(o: YunlingPosterInput): PosterModel {
    const equip = o.equipName || `${o.qualityLabel}${o.slotLabel}`;
    const start = o.startLevel;
    const end = o.level;

    const levels = o.rows
        .map((row, i) => ({ target: i + 1, tries: row.tries, cost: row.cost }))
        .filter((r) => r.tries > 0 && r.target > start && r.target <= end);

    let maxTries = 0;
    let maxTriesLevel = start + 1;
    levels.forEach((r) => {
        if (r.tries > maxTries) {
            maxTries = r.tries;
            maxTriesLevel = r.target;
        }
    });

    const avgPerHand = o.totalTries > 0 ? o.totalCost / o.totalTries : 0;
    const luck = calcYunlingLuck(start, end, o.totalTries, maxTries, maxTriesLevel);

    const sections: PosterSection[] = [
        {
            kind: 'rows',
            index: '01',
            title: '逐级消耗',
            hint: `${levels.length} 级`,
            rows: levels.map((r) => ({
                name: `+${r.target - 1} → +${r.target}`,
                value: `${int(r.tries)} 手`,
                sub: `月德符 ${int(r.cost)}`,
                ratio: r.tries,
            })),
        },
        {
            kind: 'cells',
            index: '02',
            title: '关键指标',
            hint: `${start} → ${end}`,
            callout: {
                badge: luck.badge,
                headline: luck.headline,
                subText: luck.subText,
                tone: luck.tone,
            },
            cells: [
                { label: '总手数', value: `${int(o.totalTries)} 手` },
                { label: '月德符合计', value: int(o.totalCost) },
                { label: '平均每手', value: int(avgPerHand) },
                { label: '单级最多', value: `${int(maxTries)} 手` },
                { label: '装备幸运', value: String(o.equipLuck) },
                { label: '个人幸运', value: String(o.personLuck) },
                { label: '目标等级', value: `+${end}` },
                { label: '装备品质', value: o.qualityLabel },
            ],
        },
    ];

    return {
        kicker: '诛仙 3 · 装备蕴灵模拟',
        dateText: o.dateText || todayText(),
        hero: {
            badges: [equip, o.slotLabel].filter(Boolean),
            title: equip,
            subtitle: `+${start} → +${end} · 装备幸运 ${o.equipLuck} · 个人幸运 ${o.personLuck}`,
            metricLabel: '总手数',
            metricValue: int(o.totalTries),
            metricUnit: '手',
            metric2Label: '月德符合计',
            metric2Value: int(o.totalCost),
        },
        sections,
        disclaimer: DISCLAIMER,
        siteUrl: DEFAULT_SITE_URL,
    };
}

export interface SimAttrLine {
    label: string;
    value: string;
    /** 0~1，用于画对比条（可选） */
    ratio?: number;
}

export interface XycPosterInput {
    beastLabel: string;
    versionLabel: string;
    gradeLabel: string;
    level: number;
    attrCount: number;
    attrs: SimAttrLine[];
    skillName?: string | null;
    skillVariant?: string | null;
    washTotal: number;
    washMax: number;
    dateText?: string;
}

/** 轩辕策洗练：主数据=洗练次数，分区=属性 / 技能与统计 */
export function buildXycPoster(o: XycPosterInput): PosterModel {
    const sections: PosterSection[] = [
        {
            kind: 'rows',
            index: '01',
            title: '当前属性',
            hint: `${o.attrCount} 条`,
            rows: o.attrs.map((a) => ({
                name: a.label,
                value: a.value,
                ratio: a.ratio,
            })),
        },
    ];

    const chips: string[] = [];
    if (o.skillName) chips.push(`技能 · ${o.skillName}${o.skillVariant ? `（${o.skillVariant}）` : ''}`);
    chips.push(`${o.beastLabel}`, `${o.versionLabel}`, `${o.gradeLabel}`, `等级 ${o.level}`);

    sections.push({
        kind: 'chips',
        index: '02',
        title: '技能与品阶',
        hint: o.skillName ? '已出技能' : '无技能',
        chips,
    });

    sections.push({
        kind: 'cells',
        index: '03',
        title: '洗练统计',
        hint: `${o.washTotal} 次`,
        cells: [
            { label: '累计洗练', value: `${int(o.washTotal)} 次` },
            { label: '单本上限', value: `${int(o.washMax)} 次` },
            { label: '剩余额度', value: `${int(Math.max(0, o.washMax - o.washTotal))} 次` },
            { label: '属性条数', value: `${o.attrCount} 条` },
        ],
    });

    return {
        kicker: '诛仙 3 · 轩辕策洗练模拟',
        dateText: o.dateText || todayText(),
        hero: {
            badges: [`${o.beastLabel}策`, `${o.gradeLabel}`],
            title: `${o.beastLabel}策 · ${o.gradeLabel}`,
            subtitle: `${o.versionLabel} · 等级 ${o.level} · 属性 ${o.attrCount} 条`,
            metricLabel: '累计洗练',
            metricValue: int(o.washTotal),
            metricUnit: '次',
            metric2Label: '单本上限',
            metric2Value: int(o.washMax),
            metric2Unit: '次',
        },
        sections,
        disclaimer: DISCLAIMER,
        siteUrl: DEFAULT_SITE_URL,
    };
}

export interface TianyuanPosterInput {
    pieceLabel: string;
    gradeLabel: string;
    level: number;
    attrs: SimAttrLine[];
    destinyTotal: number;
    dateText?: string;
}

/** 新天缘：主数据=天命点，分区=词条 / 统计 */
export function buildTianyuanPoster(o: TianyuanPosterInput): PosterModel {
    const sections: PosterSection[] = [
        {
            kind: 'rows',
            index: '01',
            title: '词条属性',
            hint: `${o.attrs.length} 条`,
            rows: o.attrs.map((a) => ({
                name: a.label,
                value: a.value,
                ratio: a.ratio,
            })),
        },
        {
            kind: 'cells',
            index: '02',
            title: '统计',
            hint: o.pieceLabel,
            cells: [
                { label: '词条数', value: `${o.attrs.length} 条` },
                { label: '天命点', value: String(o.destinyTotal) },
                { label: '强化等级', value: `+${o.level}` },
                { label: '品阶', value: o.gradeLabel },
            ],
        },
    ];

    return {
        kicker: '诛仙 3 · 新天缘模拟',
        dateText: o.dateText || todayText(),
        hero: {
            badges: [o.pieceLabel, o.gradeLabel].filter(Boolean),
            title: `${o.pieceLabel} · 天缘`,
            subtitle: `+${o.level} · ${o.attrs.length} 条词条`,
            metricLabel: '天命点',
            metricValue: String(o.destinyTotal),
            metricUnit: '点',
            metric2Label: '强化等级',
            metric2Value: `+${o.level}`,
        },
        sections,
        disclaimer: DISCLAIMER,
        siteUrl: DEFAULT_SITE_URL,
    };
}

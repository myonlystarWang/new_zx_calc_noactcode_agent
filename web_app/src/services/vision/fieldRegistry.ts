/**
 * 字段注册表：唯一真相。
 * 加字段 / 改顺序 / 改是否进引擎，只改这里；UI 与映射层都读它，不写 if。
 * 设计依据：doc/识图校对与功能路由设计_20261021.md §4 / §12
 */
import type { FieldUnit, PanelKind } from './types';

export interface FieldDef {
    key: string;
    /** 卡上显示的中文标签 */
    label: string;
    unit: FieldUnit;
    /** 是否参与伤害计算 */
    engine: boolean;
    /** 映射到 CharacterAttributes 的键名（engine=true 时必填） */
    engineKey?: string;
    /** 该 key 在面板上对应的行标签（用于校验模型是否整列错位） */
    expectedLabels: string[];
    /** 引擎必填但面板没有 → 手填 */
    manual?: boolean;
    /** 面板没有此项时的说明 */
    absentHint?: string;
}

const ATTACK_MAX: FieldDef = {
    key: 'attackMax',
    label: '最大攻',
    unit: 'point',
    engine: true,
    engineKey: 'CharacterMaxAttack',
    expectedLabels: ['攻击', '大攻', '最大攻击']
};
const ATTACK_MIN: FieldDef = {
    key: 'attackMin',
    label: '最小攻',
    unit: 'point',
    engine: true,
    engineKey: 'CharacterMinAttack',
    expectedLabels: ['攻击', '小攻', '最小攻击']
};

/** 角色属性面板：顺序完全照抄游戏两列布局 */
export const CHARACTER_PANEL_FIELDS: FieldDef[] = [
    ATTACK_MIN,
    ATTACK_MAX,
    { key: 'defense', label: '防御', unit: 'point', engine: true, engineKey: 'CharacterDefense', expectedLabels: ['防御'] },
    { key: 'health', label: '气血上限', unit: 'point', engine: true, engineKey: 'CharacterHealth', expectedLabels: ['气血', '气血值'] },
    { key: 'mana', label: '真气上限', unit: 'point', engine: true, engineKey: 'CharacterMana', expectedLabels: ['真气', '法力'] },
    { key: 'critDamage', label: '致命伤害', unit: 'percent', engine: true, engineKey: 'CharacterCriticalHitDamagePercent', expectedLabels: ['致命伤害', '暴击伤害', '爆伤'] },
    { key: 'critRate', label: '致命一击', unit: 'percent', engine: false, expectedLabels: ['致命一击', '暴击率'] },
    { key: 'monsterDamageBonus', label: '对怪增伤', unit: 'percent', engine: true, engineKey: 'CharacterMonsterDamageIncreasePercent', expectedLabels: ['对怪增伤', '对怪物增伤', '怪增'], manual: true, absentHint: '面板无此项 · 点此填写' }
];

/** 轩辕策：按 tooltip 层级，词条单独走 attrs，不进 fields */
export const XYC_FIELDS: FieldDef[] = [
    { key: 'beast', label: '四象', unit: 'text', engine: false, expectedLabels: [] },
    { key: 'bookName', label: '书名', unit: 'text', engine: false, expectedLabels: [] },
    { key: 'tier', label: '品阶', unit: 'text', engine: false, expectedLabels: [] },
    { key: 'stars', label: '星级', unit: 'point', engine: false, expectedLabels: [] },
    { key: 'washUsed', label: '洗炼次数', unit: 'point', engine: false, expectedLabels: [] },
    { key: 'level', label: '等级', unit: 'point', engine: false, expectedLabels: [] }
];

/** 天缘属性：标题三要素 + 若干「天命+N 属性 +值」词条行 */
export const TIANYUAN_FIELDS: FieldDef[] = [
    { key: 'name', label: '名称', unit: 'text', engine: false, expectedLabels: [] },
    { key: 'part', label: '部位', unit: 'text', engine: false, expectedLabels: [] },
    { key: 'tianyuanLevel', label: '天缘等级', unit: 'point', engine: false, expectedLabels: [] }
];

export function fieldsFor(kind: PanelKind): FieldDef[] {
    if (kind === 'character_panel') return CHARACTER_PANEL_FIELDS;
    if (kind === 'xyc') return XYC_FIELDS;
    if (kind === 'tianyuan') return TIANYUAN_FIELDS;
    return [];
}

export function fieldDef(kind: PanelKind, key: string): FieldDef | undefined {
    return fieldsFor(kind).find(f => f.key === key);
}

/** 引擎必填项（缺则不能算秒伤） */
export const ENGINE_REQUIRED = ['CharacterMinAttack', 'CharacterMaxAttack', 'CharacterCriticalHitDamagePercent', 'CharacterMonsterDamageIncreasePercent'];

export function kindLabel(kind: PanelKind): string {
    switch (kind) {
        case 'character_panel': return '角色属性面板';
        case 'xyc': return '轩辕策';
        case 'tianyuan': return '天缘属性';
        case 'equip': return '装备';
        case 'fabao': return '法宝';
        case 'skill': return '技能';
        case 'boss': return 'BOSS';
        case 'combat_log': return '战斗统计';
        default: return '未识别';
    }
}

/** 不建卡的体系：给文字引导而不是硬塞卡片 */
export const UNSUPPORTED_HINT: Partial<Record<PanelKind, string>> = {
    equip: '这是装备图。直接说装备名，我出图鉴卡更快。',
    fabao: '这是法宝图。说法宝名，我出特技卡。',
    skill: '这是技能图。说技能名，我出技能卡。',
    boss: '这是 BOSS 界面。先说要打哪个副本。',
    combat_log: '战报不能反推面板，请上传角色属性面板截图。',
    unknown: '这张图里没有可识别的游戏属性。'
};

/**
 * 粘贴文本 → 方案快照（Step 13 导入）
 *
 * 目标：手里只有一份数据（属性数值 + 增益数值）时，不用逐项手填，
 * 粘贴一段自由格式的文本即可解析成方案。支持的格式都很宽松：
 *
 *   职业 涅羽 阵营 佛
 *   最小攻击 210000  最大攻击 230000
 *   气血：3,200,000  真气 2800000  爆伤 1980
 *   专注 241、绿点 22.5  易伤 900
 *
 * 字段别名与 agent_tool/src/normalize.ts 的 attrAliases 保持同源口径；
 * 也接受 JSON 对象（键走同一张别名表）。
 * 解析器只做识别与校验，不抛异常——认不出的「键值对」进 warnings 由 UI 展示。
 */
import type { Buff, CharacterAttributes, CharacterClass } from '../types';
import { defaultAttributes } from '../context/AppContext';

export interface ParsedImport {
    classId: string | null;
    faction: 'XIAN' | 'FO' | 'MO' | null;
    attributes: CharacterAttributes;
    /** 解析出的增益（BuffID → 数值）；同时代表需要勾选激活 */
    buffValues: Record<string, number>;
    /** 认不出的键值对（原样回显，供用户自查） */
    warnings: string[];
    /** 是否解析出任何可导入内容 */
    get hasContent(): boolean;
}

/** 属性键 → 别名（中文/英文/缩写；小写比较） */
const ATTR_ALIASES: Array<[keyof CharacterAttributes, string[]]> = [
    ['CharacterMinAttack', ['characterminattack', 'minattack', 'min_attack', 'minatk', '最小攻击', '最小攻', '最小', 'min']],
    ['CharacterMaxAttack', ['charactermaxattack', 'maxattack', 'max_attack', 'maxatk', '最大攻击', '最大攻', '最大', 'max']],
    ['CharacterDefense', ['characterdefense', 'defense', 'def', '防御']],
    ['CharacterHealth', ['characterhealth', 'health', 'hp', '气血', '血量', '生命']],
    ['CharacterMana', ['charactermana', 'mana', 'mp', '真气', '蓝']],
    ['CharacterCriticalHitDamagePercent', ['charactercriticalhitdamagepercent', 'critdamage', 'criticaldamage', '爆伤', '暴击伤害', '会心伤害', '爆伤百分比']],
    ['CharacterCriticalHitRatePercent', ['charactercriticalhitratepercent', 'critrate', 'criticalrate', '暴击率', '暴击', '会心率']],
    ['CharacterMonsterDamageIncreasePercent', ['charactermonsterdamageincreasepercent', 'monsterdamageincrease', 'monsterdamage', '对怪增伤', '对怪', '增伤']],
];

const ATTR_LOOKUP: Record<string, keyof CharacterAttributes> = ATTR_ALIASES.reduce(
    (acc, [key, aliases]) => {
        for (const a of aliases) acc[a] = key;
        return acc;
    },
    {} as Record<string, keyof CharacterAttributes>,
);

/** 增益键 → BuffID（BuffName 另走 startsWith 匹配） */
const BUFF_ALIASES: Record<string, string> = {
    buff_focus_effect: 'BUFF_FOCUS_EFFECT',
    focus: 'BUFF_FOCUS_EFFECT',
    专注: 'BUFF_FOCUS_EFFECT',
    buff_holywrath_effect: 'BUFF_HOLYWRATH_EFFECT',
    holywrath: 'BUFF_HOLYWRATH_EFFECT',
    巫咒: 'BUFF_HOLYWRATH_EFFECT',
    buff_mon_critdamage_effect: 'BUFF_MON_CRITDAMAGE_EFFECT',
    greenpoint: 'BUFF_MON_CRITDAMAGE_EFFECT',
    green_point: 'BUFF_MON_CRITDAMAGE_EFFECT',
    绿点: 'BUFF_MON_CRITDAMAGE_EFFECT',
    buff_mon_harmed_effect: 'BUFF_MON_HARMED_EFFECT',
    monsterdamagetaken: 'BUFF_MON_HARMED_EFFECT',
    易伤: 'BUFF_MON_HARMED_EFFECT',
    buff_att_percent_effect: 'BUFF_ATT_PERCENT_EFFECT',
    attpercent: 'BUFF_ATT_PERCENT_EFFECT',
    att_percent: 'BUFF_ATT_PERCENT_EFFECT',
    攻击比: 'BUFF_ATT_PERCENT_EFFECT',
};

const FACTION_LOOKUP: Record<string, 'XIAN' | 'FO' | 'MO'> = {
    仙: 'XIAN', 佛: 'FO', 魔: 'MO', xian: 'XIAN', fo: 'FO', mo: 'MO',
};

const CLASS_KEY_RE = /(?:职业|门派|class(?:id)?)\s*[:：=]?\s*([^\s:：,，、;；#]{1,12})/i;
const FACTION_KEY_RE = /(?:阵营|faction)\s*[:：=]?\s*(仙|佛|魔|XIAN|FO|MO)/i;
const BARE_FACTION_RE = /^(仙|佛|魔)$/;

/** 键值对：中英文键 + 数字（容忍千分位逗号/下划线） */
const PAIR_RE = /([A-Za-z_\u4e00-\u9fa5]{1,14})\s*[:：=]?\s*(-?\d[\d,，_]*(?:\.\d+)?)/g;

const toNum = (s: string): number => Number(s.replace(/[,，_]/g, ''));

const norm = (s: string): string => s.trim().toLowerCase();

function lookupClass(value: string, classes: CharacterClass[]): string | null {
    const v = value.trim();
    const byName = classes.find((c) => c.ClassName === v);
    if (byName) return byName.ClassID;
    const byId = classes.find((c) => c.ClassID.toUpperCase() === v.toUpperCase().replace(/\s+/g, '_'));
    if (byId) return byId.ClassID;
    return null;
}

function lookupBuff(key: string, buffs: Buff[]): string | null {
    const k = norm(key);
    if (BUFF_ALIASES[k]) return BUFF_ALIASES[k];
    const byId = buffs.find((b) => b.BuffID.toLowerCase() === k);
    if (byId) return byId.BuffID;
    const byName = buffs.find((b) => b.BuffName === key.trim());
    if (byName) return byName.BuffID;
    // 「专注」→「专注增益」这类前缀匹配（键至少 2 个字，避免误吞）
    if ([...key.trim()].length >= 2) {
        const byPrefix = buffs.find((b) => b.BuffName.startsWith(key.trim()));
        if (byPrefix) return byPrefix.BuffID;
    }
    return null;
}

export function parsePresetText(
    text: string,
    buffs: Buff[],
    classes: CharacterClass[],
): ParsedImport {
    const attributes: CharacterAttributes = { ...defaultAttributes };
    const buffValues: Record<string, number> = {};
    const warnings: string[] = [];
    let classId: string | null = null;
    let faction: 'XIAN' | 'FO' | 'MO' | null = null;
    let parsedAttrs = 0;
    let parsedBuffs = 0;

    const putAttr = (key: keyof CharacterAttributes, value: number, rawKey: string) => {
        if (!Number.isFinite(value) || value < 0 || value > 1e12) {
            warnings.push(`${rawKey} ${value}（数值超出合理范围，已忽略）`);
            return;
        }
        attributes[key] = value;
        parsedAttrs += 1;
    };
    const putBuff = (id: string, value: number, rawKey: string) => {
        if (!Number.isFinite(value) || value < -1e9 || value > 1e9) {
            warnings.push(`${rawKey} ${value}（数值超出合理范围，已忽略）`);
            return;
        }
        buffValues[id] = value;
        parsedBuffs += 1;
    };

    const handlePair = (rawKey: string, rawValue: string) => {
        const attrKey = ATTR_LOOKUP[norm(rawKey)];
        if (attrKey) {
            putAttr(attrKey, toNum(rawValue), rawKey);
            return;
        }
        const buffId = lookupBuff(rawKey, buffs);
        if (buffId) {
            putBuff(buffId, toNum(rawValue), rawKey);
            return;
        }
        warnings.push(`${rawKey} ${rawValue}`);
    };

    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
        // JSON 形态：键走同一张别名表
        try {
            const obj = JSON.parse(trimmed) as Record<string, unknown>;
            for (const [k, v] of Object.entries(obj)) {
                const nk = norm(k);
                if (nk === 'class' || nk === 'classid' || nk === '职业' || nk === '门派') {
                    if (typeof v === 'string') classId = lookupClass(v, classes);
                    continue;
                }
                if (nk === 'faction' || nk === '阵营') {
                    const f = typeof v === 'string' ? FACTION_LOOKUP[norm(v)] : undefined;
                    if (f) faction = f;
                    continue;
                }
                if (typeof v === 'number' || typeof v === 'string') {
                    handlePair(k, String(v));
                }
            }
        } catch {
            warnings.push('JSON 解析失败，请检查格式');
        }
    } else {
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.replace(/#.*$/, '').trim();
            if (!line || /https?:|#\//i.test(line)) continue;

            const cm = line.match(CLASS_KEY_RE);
            if (cm) {
                const found = lookupClass(cm[1], classes);
                if (found) classId = found;
                else warnings.push(`职业「${cm[1]}」未识别`);
            }
            const fm = line.match(FACTION_KEY_RE);
            if (fm) {
                faction = FACTION_LOOKUP[fm[1].toLowerCase()] ?? FACTION_LOOKUP[fm[1]] ?? null;
            }

            let matched = false;
            for (const m of line.matchAll(PAIR_RE)) {
                matched = true;
                handlePair(m[1], m[2]);
            }
            if (BARE_FACTION_RE.test(line)) {
                faction = FACTION_LOOKUP[line];
                matched = true;
            }
            // 整行只有中文键没有数字（如「专注增益」）→ 提示缺数值。
            // 职业/阵营命中的行没有数字属正常，不提示
            if (!matched && !cm && !fm && /[\u4e00-\u9fa5]/.test(line) && !/^\d/.test(line)) {
                warnings.push(`${line}（没有读到数值）`);
            }
        }
    }

    return {
        classId,
        faction,
        attributes,
        buffValues,
        warnings,
        get hasContent() {
            return parsedAttrs > 0 || parsedBuffs > 0 || !!classId || !!faction;
        },
    };
}

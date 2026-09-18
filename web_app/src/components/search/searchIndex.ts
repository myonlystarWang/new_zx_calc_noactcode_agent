import { pinyin } from 'pinyin-pro';
import type { SubTab } from '../compendium/CompendiumView';
import { DataService } from '../../services/DataService';
import { buildSingleCalcSkills } from '../../utils/calculator';

/**
 * 全局搜索统一索引与匹配层
 *
 * 右上角轻量下拉（GlobalSearch）与首页 Ctrl+K 命令面板（HomePage）共用本模块：
 * - buildSearchIndex()：唯一的数据来源（功能入口 / 极致属性 / 职业速查与状态 / 副本 BOSS 速查 / 职业技能 / 满状态峰值变体 / 攻略增益）
 * - matchFlat()：扁平相关性结果（GlobalSearch 用）
 * - matchGrouped()：按分类聚合结果（HomePage 命令面板用）
 *
 * 匹配规则要点：
 * - 全量首字母索引：全面支持极致属性（jz/ws/jm/jbj/gz/ds）、职业（zs/ny/th/gw/ty/fx/zm/yz/sl/qy/hh）、
 *   副本简称（t16-t21/sskn/kscs/kskn/td1-td3/lbcs/lbkn/sxq/xyl）以及副本中 Boss 的拼音缩写。
 * - 多 Token 乱序匹配：输入「ws jz」与「jz ws」同等精准命中「极致无视攻略」；输入「clx zs」与「zs clx」命中「逐霜·苍龙啸」；
 *   输入「xk t21」与「t21 xk」命中「T21 · 玄铠」。
 * - 无空格复合缩写：如「jzws」「sskn」「t21xk」「zsclx」自动命中。
 * - 打分机制保障：多词全命中赋予高额奖励分与跨字段置顶权重，单项输入优先完全匹配。
 */

export type SearchTarget =
    | { tab: 'home' }
    | {
        tab: 'compendium';
        sub: SubTab;
        item?: string;
        skillId?: string;
        skillName?: string;
        classId?: string;
        faction?: string;
        dungeonId?: string;
        monsterId?: string;
    }
    | { tab: 'calculator'; dungeonId?: string; monsterId?: string; skillId?: string; skillName?: string; classId?: string; faction?: string }
    | { tab: 'skills'; classId?: string; faction?: string; skillName?: string; skillId?: string }
    | { tab: 'arena' };

export type SearchCategory = 'page' | 'dungeon' | 'monster' | 'skill' | 'role' | 'guide';

export interface SearchIndexItem {
    label: string;
    group: string;
    category: SearchCategory;
    keywords: string[];
    target: SearchTarget;
}

/** 拼音片段：一个不可再分的词（名称片段） */
export interface PinyinToken {
    /** 各音节首字母，如「天煞明王」→ tsmw */
    initials: string;
    /** 全拼，如「天煞明王」→ tianshamingwang */
    full: string;
}

export interface CompiledSearchItem extends SearchIndexItem {
    /** 名称各片段首字母拼接（用于徽标展示） */
    pyInitials: string;
    pyFull: string;
    /** 名称逐词切分后的拼音 */
    pyTokens: PinyinToken[];
    /** 所属实体/关键词切分后的拼音（职业/副本/分类等） */
    entityTokens: PinyinToken[];
    /** 收集的所有拼音首字母集合（小写） */
    initialsSet: Set<string>;
    /** 复合首字母组合列表（如: jzws, zsclx, t21xk, ssknkn 等） */
    combinedInitials: string[];
}

export interface SearchStats {
    dungeons: number;
    monsters: number;
    skills: number;
    buffs: number;
    roles: number;
    guides: number;
}

export const CATEGORY_ORDER: SearchCategory[] = ['skill', 'role', 'dungeon', 'monster', 'page', 'guide'];

export const CATEGORY_NAMES: Record<SearchCategory, string> = {
    skill: '职业技能',
    role: '职业与评级',
    dungeon: '副本',
    monster: 'Boss / 怪物',
    page: '功能入口',
    guide: '攻略与增益',
};

/** 同分时的分类优先级：核心实体与技能优先于功能入口与攻略明细 */
const CATEGORY_WEIGHT: Record<SearchCategory, number> = {
    skill: 5,
    role: 5,
    dungeon: 4,
    monster: 4,
    page: 3,
    guide: 2,
};

export const CLASS_LABELS: Record<string, string> = {
    ZHU_SHUANG: '逐霜',
    NIE_YU: '涅羽',
    TAI_HAO: '太昊',
    GUI_WANG: '鬼王',
    TIAN_YIN: '天音',
    FEN_XIANG: '焚香',
    ZHAO_MING: '昭冥',
    YING_ZHAO: '英招',
    TIAN_HUA: '天华',
    SHI_LUO: '释罗',
    HE_HUAN: '合欢',
    QING_YUN: '青云',
};

/** 职业拼音首字母映射（兜底加速） */
const CLASS_PINYIN_MAP: Record<string, { initials: string; full: string }> = {
    逐霜: { initials: 'zs', full: 'zhushuang' },
    涅羽: { initials: 'ny', full: 'nieyu' },
    太昊: { initials: 'th', full: 'taihao' },
    鬼王: { initials: 'gw', full: 'guiwang' },
    天音: { initials: 'ty', full: 'tianyin' },
    焚香: { initials: 'fx', full: 'fenxiang' },
    昭冥: { initials: 'zm', full: 'zhaoming' },
    英招: { initials: 'yz', full: 'yingzhao' },
    天华: { initials: 'th', full: 'tianhua' },
    释罗: { initials: 'sl', full: 'shiluo' },
    合欢: { initials: 'hh', full: 'hehuan' },
    青云: { initials: 'qy', full: 'qingyun' },
    归云: { initials: 'gy', full: 'guiyun' },
};

export const FACTION_LABELS: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔', COMMON: '通用' };

/** 副本二级筛选简写映射（与 BossCompendiumView 一致） */
export const DUNGEON_SHORT_LABELS: Record<string, string> = {
    HUIMENG_LINGYUN_T16: 'T16',
    HUIMENG_LINGYUN_T17: 'T17',
    HUIMENG_LINGYUN_T18: 'T18',
    ZHENHAI_DUANLANG_T19: 'T19',
    ZHENHAI_DUANLANG_T20: 'T20',
    ZHENHAI_DUANLANG_T21: 'T21',
    SHOUSHEN_JIANGLIN_HARD: '兽神困难',
    JIEQI_KONGSANG_NORMAL: '空桑初识',
    JIEQI_KONGSANG_HARD: '空桑困难',
    TIANDI_BAOKU_NORMAL: '天帝1',
    TIANDI_BAOKU_MEDIUM: '天帝2',
    TIANDI_BAOKU_HARD: '天帝3',
    LIU_BO_JING_BIAN_CHUSHI: '流波初识',
    LIU_BO_JING_BIAN_HARD: '流波困难',
    SIXIANG_QI: '四象七',
    XUANYELIN_QIWEI_WUGONG: '悬夜林',
};

/** 副本别名与首字母缩写增强库 */
export const DUNGEON_EXTRA_ALIASES: Record<string, string[]> = {
    HUIMENG_LINGYUN_T16: ['t16', '凌云16', 'ly16', 'huimeng'],
    HUIMENG_LINGYUN_T17: ['t17', '凌云17', 'ly17', 'huimeng'],
    HUIMENG_LINGYUN_T18: ['t18', '凌云18', 'ly18', 'huimeng'],
    ZHENHAI_DUANLANG_T19: ['t19', '断浪19', 'dl19', 'zhenhai', 'duanlang'],
    ZHENHAI_DUANLANG_T20: ['t20', '断浪20', 'dl20', 'zhenhai', 'duanlang'],
    ZHENHAI_DUANLANG_T21: ['t21', '断浪21', 'dl21', 'zhenhai', 'duanlang'],
    SHOUSHEN_JIANGLIN_HARD: ['兽神', '困难', '兽神困难', 'ss', 'kn', 'sskn', 'shoushen', 'shoushenkunnan'],
    JIEQI_KONGSANG_NORMAL: ['空桑', '初识', '空桑初识', 'ks', 'cs', 'kscs', 'kongsang'],
    JIEQI_KONGSANG_HARD: ['空桑', '困难', '空桑困难', 'ks', 'kn', 'kskn', 'kongsang'],
    TIANDI_BAOKU_NORMAL: ['天帝', '天帝1', '天帝一层', '初入江湖', 'td', 'td1', 'tiandi'],
    TIANDI_BAOKU_MEDIUM: ['天帝', '天帝2', '天帝二层', '再起风云', 'td', 'td2', 'tiandi'],
    TIANDI_BAOKU_HARD: ['天帝', '天帝3', '天帝三层', '三生苦旅', 'td', 'td3', 'tiandi'],
    LIU_BO_JING_BIAN_CHUSHI: ['流波', '初识', '流波初识', 'lb', 'cs', 'lbcs', 'liubo'],
    LIU_BO_JING_BIAN_HARD: ['流波', '困难', '流波困难', 'lb', 'kn', 'lbkn', 'liubo'],
    SIXIANG_QI: ['四象', '四象七', '四象7', '七杀罪狱', 'sx', 'sxq', 'sx7', 'sixiang', 'sixiangqi'],
    XUANYELIN_QIWEI_WUGONG: ['悬夜林', '七尾蜈蚣', 'xyl', 'xuanyelin', 'wugong'],
};

/** 片段切分：按空白、括号、标点拆词；「·」保留为词内连接符 */
const SEGMENT_SPLIT_RE = /[\s\-_/\\|、,，.。:：;；+'"“”()（）【】\[\]]+/;
/** 名称里的括号说明不参与核心拼音（「九变 (战力测算)」→「九变」） */
const BRACKET_RE = /[（(][^）)]*[）)]/g;

/** 单个片段 → 拼音 token；无汉字/字母则返回 null */
function tokenizePinyin(seg: string): PinyinToken | null {
    const arr = pinyin(seg, { toneType: 'none', type: 'array' }) as string[];
    const syllables = arr.filter(t => /^[a-z0-9]+$/i.test(t)).map(t => t.toLowerCase());
    if (syllables.length === 0) return null;
    return { initials: syllables.map(s => s[0]).join(''), full: syllables.join('') };
}

/** 文本 → 拼音 token 列表（逐词切分，剔除括号说明） */
function toPinyinTokens(text: string): PinyinToken[] {
    const out: PinyinToken[] = [];
    if (!text || typeof text !== 'string') return out;
    const stripped = text.replace(BRACKET_RE, ' ');
    for (const seg of stripped.split(SEGMENT_SPLIT_RE)) {
        const seg2 = seg.trim();
        if (!seg2 || !/[\u4e00-\u9fa5a-zA-Z0-9]/.test(seg2)) continue;
        const tk = tokenizePinyin(seg2);
        if (tk) out.push(tk);
    }
    return out;
}

/** 构建统一搜索索引（两个入口的唯一数据源） */
export function buildSearchIndex(): CompiledSearchItem[] {
    const service = DataService.getInstance();
    const list: SearchIndexItem[] = [];
    const add = (
        label: string,
        group: string,
        category: SearchCategory,
        keywords: string[],
        target: SearchTarget,
    ) => {
        if (!label || typeof label !== 'string') return;
        list.push({ label, group: group || '', category, keywords: (keywords || []).filter(Boolean), target });
    };

    // 1. 核心功能入口
    add('属性战力计算器', '功能入口', 'page', ['战力', '计算器', '属性计算', 'jsq', 'zljsq'], { tab: 'calculator' });
    add('副本模拟训练场', '功能入口', 'page', ['模拟', '训练场', '战斗模拟', 'arena', 'fbmx'], { tab: 'arena' });
    add('全景战斗资料库', '功能入口', 'page', ['资料库', '图鉴', '资料图鉴', '攻略', '资料', '专注值', '增益', 'qjzd'], { tab: 'compendium', sub: 'ceiling' });
    add('极致属性攻略', '功能入口 · 全景资料库', 'page', ['极致属性', '天花板', '无视', '减免', '怪增', '躲闪', 'jz', 'jzsx', 'jizhi'], { tab: 'compendium', sub: 'ceiling' });
    add('职业技能速查', '功能入口 · 全景资料库', 'page', ['技能', '速查', '技能库', '门派技能', 'zyjn', 'jnsc'], { tab: 'compendium', sub: 'skills' });
    add('职业状态一览', '功能入口 · 全景资料库', 'page', ['职业状态', '辅助', '增益', '状态评级', 'zyzt', 'zt'], { tab: 'compendium', sub: 'support' });
    add('副本 BOSS 速查', '功能入口 · 全景资料库', 'page', ['boss', '首领', '抗性', '副本boss', '减爆伤', 'fb', 'fbsc'], { tab: 'compendium', sub: 'boss' });

    // 2. 极致属性攻略 5 大核心属性子页（截图 1：极致无视、极致减免、极致减暴击、极致怪增、极致躲闪）
    const ceilingSubPages: Array<{ label: string; sub: SubTab; kw: string[] }> = [
        {
            label: '极致无视攻略',
            sub: 'ignore',
            kw: ['极致无视', '无视', '极致', '易伤', '无视减免', 'jzws', 'jz', 'ws', 'wushi', 'jizhiwushi'],
        },
        {
            label: '极致减免攻略',
            sub: 'reduction',
            kw: ['极致减免', '减免', '极致', '减伤', '减免伤害', 'jzjm', 'jz', 'jm', 'jianmian', 'jizhijanmian'],
        },
        {
            label: '极致减暴击攻略',
            sub: 'critReduction',
            kw: ['极致减暴击', '减暴击', '减暴', '极致', '暴击减免', 'jzjbj', 'jz', 'jbj', 'jianbaoji'],
        },
        {
            label: '极致怪增攻略',
            sub: 'monsterDamageBonus',
            kw: ['极致怪增', '怪增', '极致', '怪物增伤', '增伤', 'jzgz', 'jz', 'gz', 'guaizeng'],
        },
        {
            label: '极致躲闪攻略',
            sub: 'dodge',
            kw: ['极致躲闪', '躲闪', '极致', '闪避', 'jzds', 'jz', 'ds', 'duoshan'],
        },
    ];
    for (const cp of ceilingSubPages) {
        add(cp.label, '全景战斗资料库 · 极致属性', 'guide', cp.kw, { tab: 'compendium', sub: cp.sub });
    }

    // 3. 职业专属条目（截图 2：逐霜、涅羽、太昊、鬼王、天音、焚香、昭冥、英招、天华、释罗等）
    // 用户需求：搜「zs」时，技能速查与状态一览中逐霜都要有！
    const skillMeta = service.getSkillMeta();
    const classLabels: Record<string, string> = { ...CLASS_LABELS, ...(skillMeta?.classLabels || {}) };
    primeClassPrefixes(classLabels);

    for (const [classId, className] of Object.entries(classLabels)) {
        const pyInfo = CLASS_PINYIN_MAP[className] || tokenizePinyin(className);
        const initials = pyInfo ? pyInfo.initials : '';
        const full = pyInfo ? pyInfo.full : '';
        const classKw = [className, initials, full, `${initials}jn`, `${initials}zt`].filter(Boolean);

        // 职业技能速查入口
        add(
            `${className} (职业技能速查)`,
            '职业技能速查 · 门派',
            'skill',
            [...classKw, '职业技能', '技能速查', '门派技能'],
            { tab: 'compendium', sub: 'skills', classId }
        );

        // 职业状态一览入口
        add(
            `${className} (职业状态一览)`,
            '职业状态一览 · 门派',
            'role',
            [...classKw, '职业状态', '辅助', '专注值', '状态一览'],
            { tab: 'compendium', sub: 'support', item: className }
        );
    }

    // 4. 副本入口（截图 3：T16-T21、兽神困难、空桑、天帝、流波、四象七、悬夜林）
    // 提供两条：一条默认直达「副本 BOSS 速查」并选中副本；另一条带入「属性战力计算器」
    const dungeons = service.getDungeons();
    const monstersByDungeon = service.getDungeonsMonsters() || {};
    const aliases = skillMeta?.searchAliases || {};

    for (const d of dungeons) {
        const dAliases = aliases[d.DungeonID] || [];
        const extraAliases = DUNGEON_EXTRA_ALIASES[d.DungeonID] || [];
        const shortName = DUNGEON_SHORT_LABELS[d.DungeonID] || d.DungeonName;
        const tMatch = d.DungeonName.match(/T\d+/i) || shortName.match(/T\d+/i);
        const tKw = tMatch ? [tMatch[0].toUpperCase(), tMatch[0].toLowerCase()] : [];
        const baseDungeonKw = Array.from(new Set([...dAliases, ...extraAliases, ...tKw, shortName, d.DungeonName]));

        // 条目 1：直达全景资料库「副本 BOSS 速查」定位该副本
        add(
            `${shortName} (${d.DungeonName})`,
            '副本 BOSS 速查 · 副本',
            'dungeon',
            [...baseDungeonKw, 'boss速查', '首领速查', '抗性'],
            { tab: 'compendium', sub: 'boss', dungeonId: d.DungeonID }
        );

        // 条目 2：带入「属性战力计算器」
        add(
            `${shortName} (带入计算器测算)`,
            '属性战力计算器 · 副本入口',
            'page',
            [...baseDungeonKw, '计算器', '测算', '战斗测算'],
            { tab: 'calculator', dungeonId: d.DungeonID }
        );

        // 副本下的各 Boss / 怪物（全面支持首字母与组合缩写）
        const mList = monstersByDungeon[d.DungeonID] || [];
        for (const m of mList) {
            const name = (m as any).MonsterName || (m as any).name;
            const id = (m as any).MonsterID || (m as any).MonsterId;
            if (!name || !id) continue;
            const role = (m as any).role === 'add' ? '小怪' : 'Boss';
            const mAliases = aliases[id] || [];
            const sharedKw = Array.from(
                new Set([
                    d.DungeonName,
                    shortName,
                    ...tKw,
                    ...extraAliases,
                    ...mAliases,
                    `${shortName}${name}`,
                    `${shortName} ${name}`,
                ])
            );

            // Boss 条目 1：跳转副本 BOSS 速查（定位副本 + 自动高亮该首领）
            add(name, `${shortName} · ${role}`, 'monster', sharedKw, {
                tab: 'compendium',
                sub: 'boss',
                dungeonId: d.DungeonID,
                monsterId: id,
            });

            // Boss 条目 2：带入属性战力计算器测算
            add(
                `${name} (带入计算器测算)`,
                `属性战力计算器 · ${shortName} · 首领测算`,
                'page',
                [...sharedKw, '计算器', '测算'],
                { tab: 'calculator', dungeonId: d.DungeonID, monsterId: id }
            );
        }
    }

    // 5. 职业技能
    const allSkills = service.getAllSkills() || {};
    for (const [classId, factions] of Object.entries(allSkills)) {
        const className = classLabels[classId] || classId;
        const pyInfo = CLASS_PINYIN_MAP[className] || tokenizePinyin(className);
        const classInitials = pyInfo ? pyInfo.initials : '';

        for (const [factionId, skillArr] of Object.entries(factions as Record<string, any[]>)) {
            if (!Array.isArray(skillArr)) continue;
            const fName = FACTION_LABELS[factionId] || factionId;
            for (const sk of skillArr) {
                const combinedNames = [
                    `${className}·${sk.SkillName}`,
                    `${className}${sk.SkillName}`,
                    `${className} ${sk.SkillName}`,
                ];
                const skillAliases = aliases[sk.SkillID] || [];
                const skillKw = [
                    className,
                    classInitials,
                    fName,
                    ...combinedNames,
                    ...skillAliases,
                ].filter(Boolean);

                // 技能条目 1：跳转技能速查
                add(
                    sk.SkillName,
                    `${className}·${fName} · 技能速查`,
                    'skill',
                    skillKw,
                    { tab: 'skills', classId, faction: factionId, skillName: sk.SkillName, skillId: sk.SkillID }
                );

                // 技能条目 2：跳转属性战力计算器
                add(
                    `${sk.SkillName} (战力测算)`,
                    `属性战力计算器 · ${className}·${fName} · 实战测算`,
                    'page',
                    [...skillKw, '计算器', '测算', '属性', '伤害'],
                    { tab: 'calculator', classId, faction: factionId, skillName: sk.SkillName, skillId: sk.SkillID }
                );
            }
        }

        // 单次满配 / 战斗满状态峰值变体（如苍龙啸·龙怒）
        for (const factionId of ['XIAN', 'MO', 'FO'] as const) {
            let peakSkills: any[] = [];
            try {
                peakSkills = buildSingleCalcSkills(factions as any, factionId);
            } catch {
                peakSkills = [];
            }
            const pfName = FACTION_LABELS[factionId] || factionId;
                for (const pk of peakSkills) {
                    if (!pk.Variant) continue;
                    add(
                        pk.SkillName,
                        `属性战力计算器 · ${className}·${pfName} · 满状态峰值`,
                        'skill',
                        [className, pfName, '计算器', '测算', '龙怒', '峰值', '满配', '满状态', `${className}·${pk.SkillName}`].filter(Boolean),
                        { tab: 'calculator', classId, faction: factionId, skillName: pk.SkillName, skillId: pk.SkillID }
                    );
                }
            }
        }

        // 6. 战斗增益 Buff
        const buffs = service.getBuffs();
        const buffAliases: Record<string, string[]> = {
            BUFF_FOCUS_EFFECT: ['专注', 'zhuanzhu', 'zz', '增益', '专注增益'],
            BUFF_HOLYWRATH_EFFECT: ['巫咒', 'wuzhou', 'wz', '增益', '巫咒增益'],
            BUFF_MON_CRITDAMAGE_EFFECT: ['绿点', 'lvdian', 'ld', '暴伤', '增益', '绿点增益'],
            BUFF_MON_HARMED_EFFECT: ['易伤', 'yishang', 'ys', '增益', '易伤增益'],
            BUFF_ATT_PERCENT_EFFECT: ['攻击比', 'gongjibi', 'gjb', '增益', '攻击比增益'],
        };
        for (const b of buffs) {
            add(b.BuffName, '各职业状态 · 专注值与战斗增益参考', 'guide', buffAliases[b.BuffID] || [], {
                tab: 'compendium',
                sub: 'support',
                item: b.BuffName,
            });
        }

        // 7. 各职业状态评级（明确标示阵营，支持按阵营精确定位，不与顶层职业入口混淆）
        const roles = service.getSupportRoles();
        if (roles) {
            const seenRole = new Set<string>();
            for (const r of roles.roles) {
                const key = `${r.name}-${r.faction}`;
                if (seenRole.has(key)) continue;
                seenRole.add(key);
                const roleKind = r.roleType === 'dps' ? '输出' : '辅助';
                add(
                    `${r.name}·${r.faction} (${roleKind}评级)`,
                    `各职业状态 · ${r.faction} · ${roleKind}`,
                    'role',
                    [r.name, r.faction, roleKind, `${roleKind}职业`, '评级', `${r.name}${r.faction}`, `${r.faction}${r.name}`],
                    {
                        tab: 'compendium',
                        sub: 'support',
                        item: `${r.name}-${r.faction}`,
                    }
                );
            }
        }

    // 8. 专注值通用参考
    const focusRef = skillMeta?.focusReference;
    if (focusRef) {
        for (const g of focusRef.general || []) {
            add(g.name, '各职业状态 · 专注值参考', 'guide', ['专注', '通用'], {
                tab: 'compendium',
                sub: 'support',
                item: '专注值参考',
            });
        }
    }

    // 9. 极致属性明细行
    const guide = service.getAttributeCeilingGuide();
    if (guide) {
        const gMap: Record<string, { name: string; sub: SubTab }> = {
            ignore: { name: '极致无视攻略', sub: 'ignore' },
            reduction: { name: '极致减免攻略', sub: 'reduction' },
            critReduction: { name: '极致减暴击攻略', sub: 'critReduction' },
        };
        for (const [k, sec] of Object.entries(guide.sections)) {
            const info = gMap[k];
            if (!info) continue;
            for (const row of sec.rows) {
                add(row.item, `${info.name} · 明细`, 'guide', [], { tab: 'compendium', sub: info.sub, item: row.item });
            }
        }
    }

    // 10. 属性来源明细行
    const lists = service.getStatSourceLists();
    if (lists) {
        const lMap: Record<string, { name: string; sub: SubTab }> = {
            monsterDamageBonus: { name: '极致怪增攻略', sub: 'monsterDamageBonus' },
            dodge: { name: '极致躲闪攻略', sub: 'dodge' },
        };
        for (const [k, sec] of Object.entries(lists.sections)) {
            const info = lMap[k];
            if (!info) continue;
            for (const row of sec.sources || []) {
                add(row.item, `${info.name} · 属性来源`, 'guide', [], { tab: 'compendium', sub: info.sub, item: row.item });
            }
            for (const row of sec.conditionals || []) {
                add(row.item, `${info.name} · 条件来源`, 'guide', [], { tab: 'compendium', sub: info.sub, item: row.item });
            }
        }
    }

    // 去重：同分类 + 同名称 + 同分组 + 同目标视为同一条
    const seenKey = new Set<string>();
    const uniq: SearchIndexItem[] = [];
    for (const item of list) {
        const key = `${item.category}|${item.label}|${item.group}|${JSON.stringify(item.target)}`;
        if (seenKey.has(key)) continue;
        seenKey.add(key);
        uniq.push(item);
    }

    // 编译拼音索引：同时提取 label 和关键词实体的拼音
    return uniq.map(item => {
        const labelTokens = toPinyinTokens(item.label);
        const entityTokens: PinyinToken[] = [];
        const initialsSet = new Set<string>();
        const combinedInitials: string[] = [];

        // 收集 label 拼音
        const labelInitials = labelTokens.map(t => t.initials).join('');
        const labelFull = labelTokens.map(t => t.full).join('');
        if (labelInitials) {
            initialsSet.add(labelInitials);
            combinedInitials.push(labelInitials);
        }
        if (labelFull) initialsSet.add(labelFull);

        for (const lt of labelTokens) {
            if (lt.initials) initialsSet.add(lt.initials);
            if (lt.full) initialsSet.add(lt.full);
        }

        // 从 group 和 keywords 提取实体拼音
        const entityPool = [item.group, ...item.keywords];
        for (const str of entityPool) {
            if (!str) continue;
            const stripped = str.replace(BRACKET_RE, ' ');
            for (const seg of stripped.split(SEGMENT_SPLIT_RE)) {
                const seg2 = seg.trim().toLowerCase();
                if (!seg2) continue;
                if (/^[a-z0-9]+$/.test(seg2)) {
                    initialsSet.add(seg2);
                    continue;
                }
                const tk = tokenizePinyin(seg2);
                if (tk) {
                    entityTokens.push(tk);
                    if (tk.initials) initialsSet.add(tk.initials);
                    if (tk.full) initialsSet.add(tk.full);
                }
            }
        }

        // 生成实体 + 名称的组合拼音（如逐霜·苍龙啸 -> zsclx, t21玄铠 -> t21xk）
        for (const et of entityTokens) {
            if (et.initials && labelInitials) {
                combinedInitials.push(`${et.initials}${labelInitials}`);
            }
        }
        for (const kw of item.keywords) {
            const kwLower = kw.toLowerCase().trim();
            if (/^[a-z0-9]+$/.test(kwLower)) {
                combinedInitials.push(kwLower);
                if (labelInitials) combinedInitials.push(`${kwLower}${labelInitials}`);
            }
        }

        return {
            ...item,
            pyInitials: labelInitials,
            pyFull: labelFull,
            pyTokens: labelTokens,
            entityTokens,
            initialsSet,
            combinedInitials: Array.from(new Set(combinedInitials)),
        };
    });
}

/** 首页统计数字 */
export function buildSearchStats(items: CompiledSearchItem[]): SearchStats {
    const service = DataService.getInstance();
    const count = (c: SearchCategory) => items.filter(x => x.category === c).length;
    return {
        dungeons: count('dungeon'),
        monsters: count('monster'),
        skills: count('skill'),
        buffs: service.getBuffs().length,
        roles: service.getSupportRoles()?.roles.length ?? 0,
        guides: count('guide'),
    };
}

const PUNCT_RE = /[·\-_/\\|、,，.。:：;；+'"“”()（）【】\[\]\s]/g;
const ASCII_RE = /^[a-z0-9]+$/;

/** 职业前缀（分词用）：兜底列表，运行时由 skills.json 的 classLabels 补全 */
let CLASS_PREFIXES = ['逐霜', '涅羽', '太昊', '鬼王', '天音', '焚香', '昭冥', '英招', '天华', '释罗', '合欢', '青云', '百灵', '长生'];
const DUNGEON_PREFIXES = ['t16', 't17', 't18', 't19', 't20', 't21', 'sskn', 'kscs', 'kskn', 'td1', 'td2', 'td3', 'lbcs', 'lbkn', 'sxq', 'xyl'];
const JZ_PREFIXES = ['jz', 'ws', 'jm', 'jbj', 'gz', 'ds', 'zs', 'ny', 'th', 'gw', 'ty', 'fx', 'zm', 'yz', 'sl', 'qy', 'hh'];

function primeClassPrefixes(labels?: Record<string, string>): void {
    const names = Object.values(labels || {}).filter(Boolean);
    if (names.length === 0) return;
    CLASS_PREFIXES = Array.from(new Set([...names, ...CLASS_PREFIXES]));
}

/** 标点归一 + 分词 + 职业/副本/首字母前缀拆解（支持「逐霜 苍龙啸」「clx zs」「t21 xk」「jz ws」等） */
function tokenize(qRaw: string): string[] {
    const rawWords = qRaw.split(/[\s·\-_/\\|、,，.。:：;；+'"“”()（）【】\[\]]+/).filter(Boolean);
    const tokenSet = new Set<string>(rawWords);
    const allPrefixes = [...CLASS_PREFIXES, ...DUNGEON_PREFIXES, ...JZ_PREFIXES];

    for (const w of rawWords) {
        const wLower = w.toLowerCase();
        for (const p of allPrefixes) {
            const pLower = p.toLowerCase();
            if (wLower.startsWith(pLower) && wLower.length > pLower.length) {
                tokenSet.add(pLower);
                tokenSet.add(wLower.slice(pLower.length));
            }
        }
    }
    return Array.from(tokenSet);
}

/**
 * 针对单一 Token 对单个条目的匹配打分，<0 表示该 Token 未命中。
 * 分为：字面匹配（中文/英文）与拼音匹配（首字母缩写/全拼/复合拼音）。
 */
function scoreSingleToken(
    e: CompiledSearchItem,
    tok: string
): { score: number; isLabelMatch: boolean; isEntityMatch: boolean } {
    let score = -1;
    let isLabelMatch = false;
    let isEntityMatch = false;

    const tokClean = tok.toLowerCase().replace(PUNCT_RE, '');
    if (!tokClean || !e || !e.label || typeof e.label !== 'string') return { score: -1, isLabelMatch: false, isEntityMatch: false };

    const labelLower = e.label.toLowerCase();
    const labelClean = labelLower.replace(PUNCT_RE, '');

    // 1. 字面匹配（全字/包含）
    if (labelClean === tokClean) {
        score = Math.max(score, 120);
        isLabelMatch = true;
    } else if (labelClean.startsWith(tokClean)) {
        score = Math.max(score, 100 - (labelClean.length - tokClean.length) * 0.5);
        isLabelMatch = true;
    } else if (labelClean.includes(tokClean)) {
        score = Math.max(score, 88 - labelClean.indexOf(tokClean));
        isLabelMatch = true;
    }

    // 关键词 / 分组字面匹配
    for (const kw of e.keywords) {
        const kwLower = kw.toLowerCase().replace(PUNCT_RE, '');
        if (!kwLower) continue;
        if (kwLower === tokClean) {
            score = Math.max(score, 90);
            isEntityMatch = true;
        } else if (tokClean.length >= 2 && kwLower.startsWith(tokClean)) {
            score = Math.max(score, 84 - Math.min(kwLower.length - tokClean.length, 10));
            isEntityMatch = true;
        } else if (tokClean.length >= 2 && kwLower.includes(tokClean)) {
            score = Math.max(score, 80);
            isEntityMatch = true;
        }
    }

    const groupLower = e.group.toLowerCase().replace(PUNCT_RE, '');
    if (groupLower.includes(tokClean)) {
        score = Math.max(score, 75);
        isEntityMatch = true;
    }

    // 2. 拼音匹配（当 Token 是纯拉丁字母/数字时）
    if (ASCII_RE.test(tokClean)) {
        // A. 复合首字母完全或前缀匹配（如 jzws, sskn, t21xk, zsclx）
        for (const ci of e.combinedInitials) {
            if (ci === tokClean) {
                score = Math.max(score, 110);
                isLabelMatch = true;
            } else if (ci.startsWith(tokClean)) {
                score = Math.max(score, 95 - Math.min(ci.length - tokClean.length, 10));
                isLabelMatch = true;
            } else if (tokClean.length >= 2 && ci.includes(tokClean)) {
                score = Math.max(score, 82);
            }
        }

        // B. Label 的拼音 tokens 匹配
        for (const lt of e.pyTokens) {
            const n = lt.initials.length;
            if (lt.initials === tokClean) {
                score = Math.max(score, 98);
                isLabelMatch = true;
            } else if (lt.full === tokClean) {
                score = Math.max(score, 96);
                isLabelMatch = true;
            } else if (lt.initials.startsWith(tokClean)) {
                score = Math.max(score, 92 - Math.min(n - tokClean.length, 10));
                isLabelMatch = true;
            } else if (tokClean.length >= 2 && lt.initials.endsWith(tokClean)) {
                score = Math.max(score, 86);
                isLabelMatch = true;
            } else if (tokClean.length >= 2 && lt.initials.includes(tokClean)) {
                // 中部包含：例如「极致无视攻略」(jzwsgl) 包含「ws」
                score = Math.max(score, 84 - lt.initials.indexOf(tokClean));
                isLabelMatch = true;
            } else if (lt.full.startsWith(tokClean)) {
                score = Math.max(score, 80);
                isLabelMatch = true;
            } else if (tokClean.length >= 3 && lt.full.includes(tokClean)) {
                score = Math.max(score, 70);
                isLabelMatch = true;
            }
        }

        // C. Entity / Keywords 的拼音 tokens 匹配（职业名、副本简称等）
        for (const et of e.entityTokens) {
            const n = et.initials.length;
            if (et.initials === tokClean) {
                score = Math.max(score, 90);
                isEntityMatch = true;
            } else if (et.full === tokClean) {
                score = Math.max(score, 88);
                isEntityMatch = true;
            } else if (et.initials.startsWith(tokClean)) {
                score = Math.max(score, 82 - Math.min(n - tokClean.length, 10));
                isEntityMatch = true;
            } else if (tokClean.length >= 2 && et.initials.includes(tokClean)) {
                score = Math.max(score, 78);
                isEntityMatch = true;
            }
        }

        // D. Initials 快速集合匹配（涵盖所有别名）
        if (e.initialsSet.has(tokClean)) {
            score = Math.max(score, 85);
            isEntityMatch = true;
        }
    }

    return { score, isLabelMatch, isEntityMatch };
}

/**
 * 单条条目打分计算：全面支持多 Token 乱序匹配与单词精准匹配
 */
function scoreItem(e: CompiledSearchItem, _qRaw: string, qClean: string, tokens: string[]): number {
    let best = -1;

    // 1. 针对整串查询做直接打分（如无空格直接输入「极致无视」「jzws」「sskn」「t21xk」）
    const wholeMatch = scoreSingleToken(e, qClean);
    if (wholeMatch.score > 0) {
        best = Math.max(best, wholeMatch.score);
    }

    // 2. 多 Token 乱序组合打分（核心：支持「ws jz」「jz ws」「zs clx」「clx zs」「t21 xk」「xk t21」）
    // 只有当每个 Token 都能在条目中找到匹配时，才算多 Token 命中
    if (tokens.length > 1) {
        let allMatched = true;
        let sumScore = 0;
        let hasLabelMatch = false;
        let hasEntityMatch = false;

        for (let i = 0; i < tokens.length; i++) {
            const res = scoreSingleToken(e, tokens[i]);
            if (res.score <= 0) {
                allMatched = false;
                break;
            }
            sumScore += res.score;
            if (res.isLabelMatch) hasLabelMatch = true;
            if (res.isEntityMatch) hasEntityMatch = true;
        }

        if (allMatched) {
            // 所有 Token 全部命中：赋予高额多词联合命中奖励分
            const avg = sumScore / tokens.length;
            let comboScore = avg + 35; // 基础多词联合奖励
            if (hasLabelMatch && hasEntityMatch) {
                // 跨维度联合命中（例如一个命中门派/副本，一个命中技能/Boss/分类），极高优先级置顶
                comboScore += 15;
            }
            best = Math.max(best, comboScore);
        }
    }

    // 3. 核心入口特权置顶：当用户输入职业简称（如 zs, ny, th, gw）或中文名时，
    // 该职业的「技能速查」与「状态一览」入口顶格置顶（135分），稳坐对应分类首位
    if (tokens.length === 1 && (e.label.includes('(职业技能速查)') || e.label.includes('(职业状态一览)'))) {
        for (const tk of e.pyTokens) {
            if (tk.initials === qClean || tk.full === qClean) {
                best = Math.max(best, 135);
                break;
            }
        }
        for (const kw of e.keywords) {
            if (kw.toLowerCase().replace(PUNCT_RE, '') === qClean) {
                best = Math.max(best, 135);
                break;
            }
        }
    }

    return best;
}

interface Scored { e: CompiledSearchItem; s: number }

/** 统一排序：分数 → 分类优先级 → 名称长度（短名优先） */
function compareScored(a: Scored, b: Scored): number {
    if (b.s !== a.s) return b.s - a.s;
    const w = CATEGORY_WEIGHT[b.e.category] - CATEGORY_WEIGHT[a.e.category];
    if (w !== 0) return w;
    return a.e.label.length - b.e.label.length;
}

function scoreAndSort(items: CompiledSearchItem[], query: string, limit: number): CompiledSearchItem[] {
    const qRaw = query.trim().toLowerCase();
    if (!qRaw) return [];
    const qClean = qRaw.replace(PUNCT_RE, '');
    const tokens = tokenize(qRaw);
    const scored: Scored[] = [];
    for (const e of items) {
        const s = scoreItem(e, qRaw, qClean, tokens);
        if (s >= 0) scored.push({ e, s });
    }
    scored.sort(compareScored);
    return scored.slice(0, limit).map(x => x.e);
}

/** 扁平相关性结果（右上角 GlobalSearch 用） */
export function matchFlat(items: CompiledSearchItem[], query: string, limit = 25): CompiledSearchItem[] {
    return scoreAndSort(items, query, limit);
}

export interface GroupedResults {
    groupedList: Array<{ cat: SearchCategory; catName: string; items: CompiledSearchItem[] }>;
    flatList: CompiledSearchItem[];
}

/** 按分类聚合结果（首页 Ctrl+K 命令面板用），每个分类按最高分排序并均衡采样，绝不被单一分类刷屏霸占 */
export function matchGrouped(items: CompiledSearchItem[], query: string, limit = 25): GroupedResults {
    const qRaw = query.trim().toLowerCase();
    if (!qRaw) return { groupedList: [], flatList: [] };
    const qClean = qRaw.replace(PUNCT_RE, '');
    const tokens = tokenize(qRaw);

    const scored: Scored[] = [];
    for (const e of items) {
        const s = scoreItem(e, qRaw, qClean, tokens);
        if (s >= 0) scored.push({ e, s });
    }
    scored.sort(compareScored);

    // 关键优化：按分类归集所有命中项，每个分类保留最高分的前 N 条（如 6 条），
    // 保证各个命中分类（技能速查、状态一览、功能入口等）都能均衡露出
    const allGroups: Partial<Record<SearchCategory, Scored[]>> = {};
    for (const item of scored) {
        const c = item.e.category;
        (allGroups[c] = allGroups[c] || []).push(item);
    }

    const order = CATEGORY_ORDER.filter(c => allGroups[c] && allGroups[c]!.length > 0);
    order.sort((a, b) => {
        const ma = Math.max(...allGroups[a]!.map(x => x.s));
        const mb = Math.max(...allGroups[b]!.map(x => x.s));
        if (ma !== mb) return mb - ma;
        return (CATEGORY_WEIGHT[b] || 0) - (CATEGORY_WEIGHT[a] || 0);
    });

    const groupedList: GroupedResults['groupedList'] = [];
    const flatList: CompiledSearchItem[] = [];
    let remaining = limit;

    for (const c of order) {
        if (remaining <= 0) break;
        const catScored = allGroups[c]!;
        // 每个命中分类展示最前 6 条高分条目
        const take = Math.min(catScored.length, 6, remaining);
        const catItems = catScored.slice(0, take).map(x => x.e);
        groupedList.push({ cat: c, catName: CATEGORY_NAMES[c] || c, items: catItems });
        flatList.push(...catItems);
        remaining -= take;
    }
    return { groupedList, flatList };
}


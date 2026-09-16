import { pinyin } from 'pinyin-pro';
import type { SubTab } from '../compendium/CompendiumView';
import { DataService } from '../../services/DataService';
import { buildSingleCalcSkills } from '../../utils/calculator';

/**
 * 全局搜索统一索引与匹配层
 *
 * 右上角轻量下拉（GlobalSearch）与首页 Ctrl+K 命令面板（HomePage）共用本模块：
 * - buildSearchIndex()：唯一的数据来源（功能入口 / 副本 / Boss / 职业技能 / 满状态峰值变体 / 职业评级 / 攻略增益）
 * - matchFlat()：扁平相关性结果（GlobalSearch 用）
 * - matchGrouped()：按分类聚合结果（HomePage 命令面板用）
 * 新增搜索条目或调整匹配规则时，只改本文件即可，两个入口同步生效。
 */

export type SearchTarget =
    | { tab: 'home' }
    | { tab: 'compendium'; sub: SubTab; item?: string; skillId?: string }
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

export interface CompiledSearchItem extends SearchIndexItem {
    pyInitials: string;
    pyFull: string;
}

export interface SearchStats {
    dungeons: number;
    monsters: number;
    skills: number;
    buffs: number;
    roles: number;
    guides: number;
}

export const CATEGORY_ORDER: SearchCategory[] = ['page', 'dungeon', 'monster', 'skill', 'role', 'guide'];

export const CATEGORY_NAMES: Record<SearchCategory, string> = {
    page: '功能入口',
    dungeon: '副本',
    monster: 'Boss / 怪物',
    skill: '职业技能',
    role: '职业评级',
    guide: '攻略与增益',
};

const CLASS_LABELS: Record<string, string> = {
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
};
const FACTION_LABELS: Record<string, string> = { XIAN: '仙', FO: '佛', MO: '魔' };

/** 计算中文文本的全拼与首字母（忽略非字母字符） */
function toPinyin(text: string): { pyFull: string; pyInitials: string } {
    const arr = pinyin(text, { toneType: 'none', type: 'array' }) as string[];
    const syllables = arr.filter(t => /^[a-z]+$/i.test(t));
    return {
        pyFull: syllables.join('').toLowerCase(),
        pyInitials: syllables.map(s => s[0]).join('').toLowerCase(),
    };
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
    ) => list.push({ label, group, category, keywords, target });

    // 1. 核心功能入口
    add('属性战力计算器', '功能入口', 'page', ['战力', '计算器', '属性计算'], { tab: 'calculator' });
    add('副本模拟训练场', '功能入口', 'page', ['模拟', '训练场', '战斗模拟', 'arena'], { tab: 'arena' });
    add('全景战斗资料库', '功能入口', 'page', ['资料库', '图鉴', '资料图鉴', '攻略', '资料', '专注值', '增益'], { tab: 'compendium', sub: 'ceiling' });
    add('极致属性攻略', '功能入口', 'page', ['极致属性', '天花板', '无视', '减免', '怪增', '躲闪'], { tab: 'compendium', sub: 'ceiling' });
    add('职业技能速查', '功能入口', 'page', ['技能', '速查', '技能库', '门派技能'], { tab: 'compendium', sub: 'skills' });
    add('职业状态一览', '功能入口', 'page', ['职业状态', '辅助', '增益', '状态评级'], { tab: 'compendium', sub: 'support' });
    add('副本 BOSS 速查', '功能入口', 'page', ['boss', '首领', '抗性', '副本boss', '减爆伤'], { tab: 'compendium', sub: 'boss' });

    // 2. 副本与 Boss / 小怪
    const dungeons = service.getDungeons();
    const monstersByDungeon = service.getDungeonsMonsters() || {};
    const skillMeta = service.getSkillMeta();
    const aliases = skillMeta?.searchAliases || {};

    for (const d of dungeons) {
        const dAliases = aliases[d.DungeonID] || [];
        const tMatch = d.DungeonName.match(/T\d+/i);
        const tKw = tMatch ? [tMatch[0].toUpperCase(), tMatch[0].toLowerCase()] : [];

        add(d.DungeonName, '副本入口 · 属性战力计算器', 'dungeon', [...dAliases, ...tKw], {
            tab: 'calculator',
            dungeonId: d.DungeonID,
        });

        const mList = monstersByDungeon[d.DungeonID] || [];
        for (const m of mList) {
            const name = (m as any).MonsterName || (m as any).name;
            const id = (m as any).MonsterID || (m as any).MonsterId;
            if (!name || !id) continue;
            const role = (m as any).role === 'add' ? '小怪' : 'Boss';
            add(name, `${d.DungeonName} · ${role}`, 'monster', [d.DungeonName, ...tKw, ...(aliases[id] || [])], {
                tab: 'calculator',
                dungeonId: d.DungeonID,
                monsterId: id,
            });
        }
    }

    // 3. 职业技能（白板：技能速查 + 战力测算 两条）与单次满状态峰值变体（仅战力测算）
    const allSkills = service.getAllSkills() || {};
    const classLabels: Record<string, string> = skillMeta?.classLabels || CLASS_LABELS;

    for (const [classId, factions] of Object.entries(allSkills)) {
        const className = classLabels[classId] || classId;
        for (const [factionId, skillArr] of Object.entries(factions as Record<string, any[]>)) {
            if (!Array.isArray(skillArr)) continue;
            const fName = FACTION_LABELS[factionId] || factionId;
            for (const sk of skillArr) {
                const combinedNames = [
                    `${className}·${sk.SkillName}`,
                    `${className}${sk.SkillName}`,
                    `${className} ${sk.SkillName}`,
                ];

                // 条目 1：跳转技能速查
                add(sk.SkillName, `${className}·${fName} · 技能速查`, 'skill',
                    [className, fName, ...combinedNames, ...(aliases[sk.SkillID] || [])],
                    { tab: 'skills', classId, faction: factionId, skillName: sk.SkillName, skillId: sk.SkillID });

                // 条目 2：跳转属性战力计算器（战力测算）
                add(`${sk.SkillName} (战力测算)`, `属性战力计算器 · ${className}·${fName} · 属性与实战`, 'page',
                    [className, fName, '计算器', '测算', '属性', '伤害', ...combinedNames, ...(aliases[sk.SkillID] || [])],
                    { tab: 'calculator', classId, faction: factionId, skillName: sk.SkillName, skillId: sk.SkillID });
            }
        }

        // 单次满配 / 战斗满状态峰值变体（如苍龙啸·龙怒）：仅加入战力测算条目；
        // 技能速查不展示变体卡。通用：未来职业在 PEAK_VARIANT_RULES 登记即自动纳入。
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
                add(pk.SkillName, `属性战力计算器 · ${className}·${pfName} · 满状态峰值`, 'page',
                    [className, pfName, '计算器', '测算', '龙怒', '峰值', '满配', '满状态', `${className}·${pk.SkillName}`],
                    { tab: 'calculator', classId, faction: factionId, skillName: pk.SkillName, skillId: pk.SkillID });
            }
        }
    }

    // 4. 战斗增益 Buff
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

    // 5. 攻略子页
    const subPages: Array<{ label: string; sub: SubTab; kw: string[] }> = [
        { label: '极致无视攻略', sub: 'ignore', kw: ['无视', '易伤', '无视减免'] },
        { label: '极致减免伤害攻略', sub: 'reduction', kw: ['减免', '减伤'] },
        { label: '极致减暴击攻略', sub: 'critReduction', kw: ['减暴', '暴击减免', '减暴击'] },
        { label: '极致怪增攻略', sub: 'monsterDamageBonus', kw: ['怪增', '怪物增伤', '增伤'] },
        { label: '极致躲闪攻略', sub: 'dodge', kw: ['躲闪', '闪避'] },
        { label: '各职业状态', sub: 'support', kw: ['职业', '辅助', '专注值', '专注'] },
    ];
    for (const sp of subPages) {
        add(sp.label, '全景战斗资料库 · 攻略', 'guide', sp.kw, { tab: 'compendium', sub: sp.sub });
    }

    // 6. 各职业状态评级（同名多阵营去重）
    const roles = service.getSupportRoles();
    if (roles) {
        const seen = new Set<string>();
        for (const r of roles.roles) {
            const key = `${r.name}-${r.faction}`;
            if (seen.has(key)) continue;
            seen.add(key);
            add(r.name, `各职业状态 · ${r.faction} · ${r.rating === '输出' ? '输出' : '辅助'}`, 'role', [r.name, r.faction], {
                tab: 'compendium',
                sub: 'support',
                item: r.name,
            });
        }
    }

    // 7. 专注值通用参考
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

    // 8. 极致属性明细行
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

    // 9. 属性来源明细行
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

    return list.map(item => ({ ...item, ...toPinyin(`${item.label} ${item.keywords.join(' ')}`) }));
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

const PUNCT_RE = /[·\-_/\\|、\s]/g;
const CLASS_PREFIXES = ['逐霜', '涅羽', '太昊', '鬼王', '天音', '焚香', '昭冥', '英招', '天华', '释罗', '合欢', '青云', '百灵', '长生'];
const DUNGEON_PREFIXES = ['t16', 't17', 't18', 't19', 't20', 't21'];

/** 标点归一 + 分词 + 职业/副本前缀拆解（支持「逐霜 苍龙啸」「逐霜苍龙啸」「T21玄铠」） */
function tokenize(qRaw: string): string[] {
    const rawWords = qRaw.split(/[\s·\-_/\\|、]+/).filter(Boolean);
    const tokenSet = new Set<string>(rawWords);
    const allPrefixes = [...CLASS_PREFIXES, ...DUNGEON_PREFIXES];
    for (const w of rawWords) {
        for (const p of allPrefixes) {
            if (w.toLowerCase().startsWith(p.toLowerCase()) && w.length > p.length) {
                tokenSet.add(p.toLowerCase());
                tokenSet.add(w.slice(p.length).toLowerCase());
            }
        }
    }
    return Array.from(tokenSet);
}

/** 单条相关性打分，<0 表示不匹配 */
function scoreItem(e: CompiledSearchItem, qRaw: string, qClean: string, tokens: string[]): number {
    const label = e.label.toLowerCase();
    const group = e.group.toLowerCase();
    const keywords = e.keywords.join(' ').toLowerCase();
    const hay = `${label} ${group} ${keywords}`;
    const hayClean = hay.replace(PUNCT_RE, '');

    // 1. 名称完全匹配（最高权重）
    if (label === qRaw || label.replace(PUNCT_RE, '') === qClean) return 120;
    // 2. 名称包含原始查询词
    const labelIdx = label.indexOf(qRaw);
    if (labelIdx >= 0) return 100 - labelIdx * 2;
    // 3. 全文字符串包含原始查询词
    const hayIdx = hay.indexOf(qRaw);
    if (hayIdx >= 0) return 85 - hayIdx;
    // 4. 清理标点后的归一化包含
    if (qClean && hayClean.includes(qClean)) return 80;
    // 5. 多 Token 联合命中
    if (tokens.length > 1 && tokens.every(tok => hay.includes(tok))) return 75;
    // 6. 拼音首字母与全拼
    if (e.pyInitials && e.pyInitials.includes(qClean)) return 60 - e.pyInitials.indexOf(qClean);
    if (e.pyFull && e.pyFull.includes(qClean)) return 50 - e.pyFull.indexOf(qClean);
    return -1;
}

function scoreAndSort(items: CompiledSearchItem[], query: string, limit: number): CompiledSearchItem[] {
    const qRaw = query.trim().toLowerCase();
    if (!qRaw) return [];
    const qClean = qRaw.replace(PUNCT_RE, '');
    const tokens = tokenize(qRaw);
    const scored: Array<{ e: CompiledSearchItem; s: number }> = [];
    for (const e of items) {
        const s = scoreItem(e, qRaw, qClean, tokens);
        if (s >= 0) scored.push({ e, s });
    }
    scored.sort((a, b) => b.s - a.s);
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

/** 按分类聚合结果（首页 Ctrl+K 命令面板用），分类之间按组内最高分排序 */
export function matchGrouped(items: CompiledSearchItem[], query: string, limit = 25): GroupedResults {
    const qRaw = query.trim().toLowerCase();
    if (!qRaw) return { groupedList: [], flatList: [] };
    const qClean = qRaw.replace(PUNCT_RE, '');
    const tokens = tokenize(qRaw);

    const scored: Array<{ e: CompiledSearchItem; s: number }> = [];
    for (const e of items) {
        const s = scoreItem(e, qRaw, qClean, tokens);
        if (s >= 0) scored.push({ e, s });
    }
    scored.sort((a, b) => b.s - a.s);
    const topResults = scored.slice(0, limit);

    const groups: Partial<Record<SearchCategory, Array<{ e: CompiledSearchItem; s: number }>>> = {};
    for (const item of topResults) {
        const c = item.e.category;
        (groups[c] = groups[c] || []).push(item);
    }

    const order = CATEGORY_ORDER.filter(c => groups[c]);
    order.sort((a, b) => {
        const ma = Math.max(...groups[a]!.map(x => x.s));
        const mb = Math.max(...groups[b]!.map(x => x.s));
        return mb - ma;
    });

    const groupedList: GroupedResults['groupedList'] = [];
    const flatList: CompiledSearchItem[] = [];
    for (const c of order) {
        const catItems = groups[c]!.map(x => x.e);
        groupedList.push({ cat: c, catName: CATEGORY_NAMES[c] || c, items: catItems });
        flatList.push(...catItems);
    }
    return { groupedList, flatList };
}

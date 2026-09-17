/**
 * 站点路由表 + URL ⇄ SearchTarget 双向映射（Step 8：Hash 路由 + 深链）
 *
 * 约定（方案 B）：
 * - 路径承载「页面身份」：一级页面 + 资料库子页
 * - query 承载「进入意图 / 定位」：class / faction / skill / d / m / item / attr
 *
 * 本文件是 URL 的唯一真相来源：新增页面或参数只改这里 + App.tsx 的 <Route>。
 */
import { DataService } from './services/DataService';
import type { SearchTarget } from './components/search/searchIndex';
import type { SubTab } from './components/compendium/CompendiumView';

export const SITE_NAME = '诛仙3 副本战斗实验室';

/** 路由路径常量 */
export const ROUTE = {
    home: '/',
    calculator: '/calculator',
    arena: '/arena',
    compendium: '/compendium',
    ceiling: '/compendium/ceiling',
    skills: '/compendium/skills',
    support: '/compendium/support',
    boss: '/compendium/boss',
    changelog: '/changelog',
} as const;

export type PrimaryTab = 'home' | 'calculator' | 'arena' | 'compendium';

/** 资料库一级子页（与 CompendiumView 的 CompendiumPrimaryTab 对齐） */
export const COMPENDIUM_SEGMENTS = ['ceiling', 'skills', 'support', 'boss'] as const;

/** 极致属性攻略下的二级属性分类（真相来源为 CompendiumView 的 ATTRIBUTE_SUB_TABS） */
const ATTRIBUTE_SUB_TAB_IDS = ['ignore', 'reduction', 'critReduction', 'monsterDamageBonus', 'dodge'] as const;

const FACTION_IDS = ['XIAN', 'FO', 'MO'] as const;

const isAttributeSubTab = (v: string): boolean => (ATTRIBUTE_SUB_TAB_IDS as readonly string[]).includes(v);

const toFaction = (v: string | null): string | undefined =>
    v && (FACTION_IDS as readonly string[]).includes(v) ? v : undefined;

/** 由路径推导 Header / 布局所需的当前一级页面 */
export function primaryTabFromPath(pathname: string): PrimaryTab {
    // 更新日志不属于四大主栏目：Header 不高亮任何 tab，页脚按默认版式渲染（Footer 只区分 home/其他）
    if (pathname.startsWith(ROUTE.calculator)) return 'calculator';
    if (pathname.startsWith(ROUTE.arena)) return 'arena';
    if (pathname.startsWith(ROUTE.compendium)) return 'compendium';
    return 'home';
}

/** 由路径 + query 推导资料库当前子页（含极致属性的二级分类） */
export function compendiumSubFromLocation(pathname: string, search: URLSearchParams): SubTab | undefined {
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 'compendium') return undefined;
    const seg = parts[1];
    if (seg === 'skills' || seg === 'support' || seg === 'boss') return seg;
    // ceiling 或缺省 → 一级「极致属性攻略」，二级分类由 ?attr= 决定
    const attr = search.get('attr');
    if (attr && isAttributeSubTab(attr)) return attr as SubTab;
    return 'ceiling';
}

/** 路径段 → SubTab（非法段返回 undefined，由调用方重定向） */
export function compendiumSegmentToSub(seg: string | undefined): SubTab | undefined {
    if (!seg) return 'ceiling';
    if ((COMPENDIUM_SEGMENTS as readonly string[]).includes(seg)) return seg as SubTab;
    return undefined;
}

/** 深链参数 ?d= 是否指向真实存在的副本（用于非法 ID 回落，避免筛成空列表） */
export function isValidDungeonId(id: string): boolean {
    const dungeons = DataService.getInstance().getDungeons();
    return Array.isArray(dungeons) && dungeons.some((d) => d.DungeonID === id);
}

/** 浏览器标签页/收藏夹标题 */
export function titleForPath(pathname: string): string {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return `${SITE_NAME} · 属性计算 · 战斗模拟 · 全景资料速查`;
    if (parts[0] === 'calculator') return `属性战力计算器 · ${SITE_NAME}`;
    if (parts[0] === 'arena') return `副本模拟训练场 · ${SITE_NAME}`;
    if (parts[0] === 'changelog') return `更新日志 · ${SITE_NAME}`;
    if (parts[0] === 'compendium') {
        const map: Record<string, string> = {
            ceiling: '极致属性攻略',
            skills: '职业技能速查',
            support: '职业状态一览',
            boss: '副本 BOSS 速查',
        };
        return `${map[parts[1]] || '全景战斗资料库'} · ${SITE_NAME}`;
    }
    return SITE_NAME;
}

/** skill 参数（技能 ID 或中文名）→ 技能元数据 */
function resolveSkill(param: string): { skillId: string; skillName: string; classId: string; faction: string } | null {
    const allSkills = DataService.getInstance().getAllSkills();
    if (!allSkills) return null;
    for (const [classId, factions] of Object.entries(allSkills)) {
        if (!factions || typeof factions !== 'object') continue;
        for (const [factionId, arr] of Object.entries(factions as Record<string, unknown>)) {
            if (!Array.isArray(arr)) continue;
            for (const sk of arr as Array<{ SkillID?: string; SkillName?: string }>) {
                if (sk.SkillID === param || sk.SkillName === param) {
                    return { skillId: sk.SkillID || param, skillName: sk.SkillName || param, classId, faction: factionId };
                }
            }
        }
    }
    return null;
}

function withQuery(path: string, params: URLSearchParams): string {
    const qs = params.toString();
    return qs ? `${path}?${qs}` : path;
}

function setParam(params: URLSearchParams, key: string, value?: string | null): void {
    if (value) params.set(key, value);
}

/** SearchTarget → 路由 URL（站内所有跳转的唯一出口） */
export function buildPathFromTarget(t: SearchTarget): string {
    const params = new URLSearchParams();

    switch (t.tab) {
        case 'home':
            return ROUTE.home;

        case 'arena':
            return ROUTE.arena;

        case 'calculator':
            setParam(params, 'class', t.classId);
            setParam(params, 'faction', t.faction);
            setParam(params, 'd', t.dungeonId);
            setParam(params, 'm', t.monsterId);
            setParam(params, 'skill', t.skillId || t.skillName);
            return withQuery(ROUTE.calculator, params);

        case 'skills':
            setParam(params, 'class', t.classId);
            setParam(params, 'faction', t.faction);
            setParam(params, 'skill', t.skillId || t.skillName);
            return withQuery(ROUTE.skills, params);

        case 'compendium': {
            const sub = t.sub;
            if (sub === 'skills') {
                setParam(params, 'class', t.classId);
                setParam(params, 'faction', t.faction);
                setParam(params, 'skill', t.skillId || t.skillName);
                return withQuery(ROUTE.skills, params);
            }
            if (sub === 'support') {
                setParam(params, 'item', t.item);
                return withQuery(ROUTE.support, params);
            }
            if (sub === 'boss') {
                setParam(params, 'd', t.dungeonId);
                setParam(params, 'm', t.monsterId);
                return withQuery(ROUTE.boss, params);
            }
            if (sub === 'ceiling') {
                setParam(params, 'item', t.item);
                return withQuery(ROUTE.ceiling, params);
            }
            // 极致属性攻略的二级分类
            setParam(params, 'attr', sub);
            setParam(params, 'item', t.item);
            return withQuery(ROUTE.ceiling, params);
        }

        default:
            return ROUTE.home;
    }
}

/**
 * URL → SearchTarget（页面定位意图）。
 * 返回 null 表示该路径不应产生定位（例如 `/` 首页），由 App 清除当前意图。
 */
export function parseLocationToTarget(pathname: string, search: URLSearchParams): SearchTarget | null {
    const parts = pathname.split('/').filter(Boolean);

    if (parts.length === 0) return { tab: 'home' };
    if (parts[0] === 'arena') return { tab: 'arena' };

    if (parts[0] === 'calculator') {
        const skillParam = search.get('skill');
        const skill = skillParam ? resolveSkill(skillParam) : null;
        return {
            tab: 'calculator',
            classId: search.get('class') || skill?.classId || undefined,
            faction: toFaction(search.get('faction')) || (skill ? toFaction(skill.faction) : undefined),
            dungeonId: search.get('d') || undefined,
            monsterId: search.get('m') || undefined,
            skillId: skill?.skillId || skillParam || undefined,
            skillName: skill?.skillName || undefined,
        };
    }

    if (parts[0] === 'compendium') {
        const seg = parts[1];
        if (seg === 'skills') {
            const skillParam = search.get('skill');
            const skill = skillParam ? resolveSkill(skillParam) : null;
            return {
                tab: 'compendium',
                sub: 'skills',
                classId: search.get('class') || skill?.classId || undefined,
                faction: toFaction(search.get('faction')) || (skill ? toFaction(skill.faction) : undefined),
                skillId: skill?.skillId || skillParam || undefined,
                skillName: skill?.skillName || undefined,
            };
        }
        if (seg === 'support') {
            return { tab: 'compendium', sub: 'support', item: search.get('item') || undefined };
        }
        if (seg === 'boss') {
            return {
                tab: 'compendium',
                sub: 'boss',
                dungeonId: search.get('d') || undefined,
                monsterId: search.get('m') || undefined,
            };
        }
        // ceiling（含二级分类）
        const attr = search.get('attr');
        const sub: SubTab = attr && isAttributeSubTab(attr) ? (attr as SubTab) : 'ceiling';
        return { tab: 'compendium', sub, item: search.get('item') || undefined };
    }

    return null;
}

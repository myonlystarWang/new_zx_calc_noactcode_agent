/**
 * 职业×阵营技能覆盖检查。
 * 铁律：技能池为空时「算副本秒伤」必须禁用并写明原因，绝不借其它职业的技能池。
 * 依据：skills.json 是 web / engine / agent_tool 三处同源数据。
 */
import { DataService } from '../DataService';
import type { Skill } from '../../types';

export interface ClassCoverage {
    ok: boolean;
    code?: 'CLASS_UNKNOWN' | 'FACTION_UNKNOWN' | 'DATA_NOT_READY' | 'FACTION_EMPTY' | 'NO_DAMAGE_SKILL';
    classId?: string;
    className?: string;
    faction?: 'XIAN' | 'FO' | 'MO';
    /** 该阵营可用技能数（含 COMMON） */
    skillCount: number;
    /** 其中输出类（ActionType=DAMAGE） */
    damageSkillCount: number;
    reason?: string;
}

const FACTION_MAP: Record<string, 'XIAN' | 'FO' | 'MO'> = {
    仙: 'XIAN',
    佛: 'FO',
    魔: 'MO'
};

export function resolveClass(classRaw?: string): { classId?: string; className?: string } {
    if (!classRaw) return {};
    try {
        const classes = DataService.getInstance().getClasses() || [];
        const hit = classes.find(c => c.ClassName === classRaw || c.ClassID === classRaw);
        if (hit) return { classId: hit.ClassID, className: hit.ClassName };
    } catch {
        /* 数据未就绪 */
    }
    return {};
}

export function getFactionSkills(allSkills: Record<string, Record<string, Skill[]>> | null | undefined, classId: string, faction: string): Skill[] {
    const cls = allSkills?.[classId];
    if (!cls) return [];
    const merged: Skill[] = [];
    const seen = new Set<string>();
    for (const skill of [...(cls[faction] ?? []), ...(cls['COMMON'] ?? [])]) {
        if (skill && !seen.has(skill.SkillID)) {
            seen.add(skill.SkillID);
            merged.push(skill);
        }
    }
    return merged;
}

export function classCoverage(classRaw?: string, factionRaw?: string): ClassCoverage {
    const { classId, className } = resolveClass(classRaw);
    const faction = factionRaw ? FACTION_MAP[factionRaw] : undefined;

    if (!classId) {
        return { ok: false, skillCount: 0, damageSkillCount: 0, reason: `职业无法识别（${classRaw || '空'}），请先选择职业` };
    }
    if (!faction) {
        return { ok: false, classId, className, skillCount: 0, damageSkillCount: 0, reason: `${className} 的阵营未识别，请先选择仙/佛/魔` };
    }

    let allSkills: any = null;
    try {
        allSkills = DataService.getInstance().getAllSkills();
    } catch {
        allSkills = null;
    }
    if (!allSkills) {
        return { ok: false, classId, className, faction, skillCount: 0, damageSkillCount: 0, reason: '技能数据未加载完成' };
    }

    const own = allSkills?.[classId]?.[faction];
    const skills = getFactionSkills(allSkills, classId, faction);
    const damageSkills = skills.filter(s => s.ActionType === 'DAMAGE');

    if (!Array.isArray(own) || own.length === 0) {
        const zh = faction === 'XIAN' ? '仙' : faction === 'FO' ? '佛' : '魔';
        return {
            ok: false,
            code: 'FACTION_EMPTY',
            classId,
            className,
            faction,
            skillCount: skills.length,
            damageSkillCount: damageSkills.length,
            reason: `${className}·${zh} 技能数据未收录（当前仅收录其它阵营），暂不能推演秒伤`
        };
    }

    if (damageSkills.length === 0) {
        return { ok: false, code: 'NO_DAMAGE_SKILL', classId, className, faction, skillCount: skills.length, damageSkillCount: 0, reason: `${className} 该阵营没有输出技能（${skills.length} 个技能均为辅助/被动），无法推演秒伤` };
    }

    return { ok: true, classId, className, faction, skillCount: skills.length, damageSkillCount: damageSkills.length };
}

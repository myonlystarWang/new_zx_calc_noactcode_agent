import React, { useState } from 'react';
import { User, Users, Trash2, ShieldAlert } from 'lucide-react';
import type { Skill, CharacterAttributes } from '../../types';
import clsx from 'clsx';

export interface SupportConfig {
    actorId: string;
    classId: string;
    faction: 'XIAN' | 'FO' | 'MO';
    profileAttributes: CharacterAttributes;
}

const SUPPORT_CLASSES = [
    { id: 'TIAN_YIN', name: '天音', defaultFaction: 'FO' as const },
    { id: 'FEN_XIANG', name: '焚香', defaultFaction: 'FO' as const },
    { id: 'ZHAO_MING', name: '昭冥', defaultFaction: 'FO' as const },
    { id: 'YING_ZHAO', name: '英招', defaultFaction: 'FO' as const },
    { id: 'TIAN_HUA', name: '天华', defaultFaction: 'FO' as const }
];

const defaultSupportAttributes: CharacterAttributes = {
    CharacterMinAttack: 200000,
    CharacterMaxAttack: 220000,
    CharacterDefense: 300000,
    CharacterHealth: 3000000,
    CharacterMana: 4000000,
    CharacterCriticalHitDamagePercent: 800,
    CharacterMonsterDamageIncreasePercent: 25,
    CharacterOnePercentAttack: 1000,
    CharacterOnePercentDefense: 1500,
    CharacterOnePercentHealth: 20000,
    CharacterOnePercentMana: 30000
};

interface DpsConfigPanelProps {
    dpsFaction: 'XIAN' | 'MO';
    dpsAttributes: CharacterAttributes;
    dpsFourthGenQuality: 'YING_JU' | 'HAO_YUE' | 'XI_RI' | 'NONE';
    onDpsFactionChange: (faction: 'XIAN' | 'MO') => void;
    onDpsAttributesChange: (attrs: CharacterAttributes) => void;
    onDpsQualityChange: (quality: 'YING_JU' | 'HAO_YUE' | 'XI_RI' | 'NONE') => void;
    allSkills: Record<string, Record<string, Skill[]>>;
    onMouseEnter: (e: React.MouseEvent, skill: Skill) => void;
    onMouseLeave: () => void;
}

interface TeamConfigPanelProps {
    supports: SupportConfig[];
    onSupportsChange: (supports: SupportConfig[]) => void;
    allSkills: Record<string, Record<string, Skill[]>>;
    onMouseEnter: (e: React.MouseEvent, skill: Skill) => void;
    onMouseLeave: () => void;
    getSkillMiniStatus: (skillId: string) => React.ReactNode;
}

// 1. DPS Configuration Panel Component (Action Bar Layout)
export const DpsConfigPanel: React.FC<DpsConfigPanelProps> = ({
    dpsFaction,
    dpsAttributes,
    dpsFourthGenQuality,
    onDpsFactionChange,
    onDpsAttributesChange,
    onDpsQualityChange,
    allSkills,
    onMouseEnter,
    onMouseLeave
}) => {
    const handleDpsAttributeChange = (key: keyof CharacterAttributes, valStr: string) => {
        const value = parseFloat(valStr) || 0;
        onDpsAttributesChange({
            ...dpsAttributes,
            [key]: value
        });
    };

    const factionSkills = allSkills['ZHU_SHUANG']?.[dpsFaction] || [];

    return (
        <div className="flex flex-col justify-between h-full">

            <div>
                {/* HUD Header */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
                    <div className="p-1 rounded bg-[var(--theme-glow)] border border-[var(--theme-primary)]/20">
                        <User className="w-4 h-4 text-[var(--theme-primary)]" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-100 tracking-wide">逐霜角色属性与快捷技能</h3>
                        <p className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase leading-none">Main DPS HUD</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Compact Selectors */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-950/20 p-2 border border-slate-900/60 rounded-xl">
                        <div>
                            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">阵营</span>
                            <div className="flex gap-1">
                                {([
                                    { id: 'XIAN', label: '仙' },
                                    { id: 'MO', label: '魔' }
                                ] as const).map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => onDpsFactionChange(f.id)}
                                        className={clsx(
                                            "flex-1 py-1 rounded text-[10px] font-bold border transition-all",
                                            dpsFaction === f.id
                                                ? "bg-[var(--theme-primary)] text-slate-950 border-[var(--theme-primary)]"
                                                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">四代品质 (玄烛)</span>
                            <div className="flex gap-1">
                                {([
                                    { id: 'NONE', label: '常规' },
                                    { id: 'YING_JU', label: '莹' },
                                    { id: 'HAO_YUE', label: '皓' },
                                    { id: 'XI_RI', label: '曦' }
                                ] as const).map(q => (
                                    <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => onDpsQualityChange(q.id)}
                                        className={clsx(
                                            "flex-1 py-1 rounded text-[10px] font-bold border transition-all",
                                            dpsFourthGenQuality === q.id
                                                ? "bg-[var(--theme-primary)] text-slate-950 border-[var(--theme-primary)]"
                                                : "bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200"
                                        )}
                                    >
                                        {q.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Attributes Grid (Compact) */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-950/20 p-2 border border-slate-900 rounded-xl text-[10px]">
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">最小攻击</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterMinAttack}
                                onChange={(e) => handleDpsAttributeChange('CharacterMinAttack', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">最大攻击</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterMaxAttack}
                                onChange={(e) => handleDpsAttributeChange('CharacterMaxAttack', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">防御力</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterDefense}
                                onChange={(e) => handleDpsAttributeChange('CharacterDefense', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">气血上限</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterHealth}
                                onChange={(e) => handleDpsAttributeChange('CharacterHealth', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">真气上限</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterMana}
                                onChange={(e) => handleDpsAttributeChange('CharacterMana', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 mb-0.5">暴击伤害(%)</label>
                            <input
                                type="number"
                                value={dpsAttributes.CharacterCriticalHitDamagePercent}
                                onChange={(e) => handleDpsAttributeChange('CharacterCriticalHitDamagePercent', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                            />
                        </div>
                    </div>

                    {/* Action Bar (Skill Shortcut Keys) */}
                    <div>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                            快捷技能栏 (Action Bar - 悬停显示说明)
                        </span>
                        
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 bg-slate-950/40 p-2.5 border border-slate-900 rounded-xl max-h-[175px] overflow-y-auto">
                            {factionSkills.map(skill => {
                                const disabledIds = [
                                    'TY_FO_SKILL_DCB', 'TY_FO_SKILL_MKXJ', 'ZM_FO_SKILL_FGSL', 
                                    'YZ_FO_SKILL_TGFM', 'YZ_FO_SKILL_WXBG', 'TH_FO_SKILL_MQYY', 
                                    'TH_FO_SKILL_YSYY2', 'TH_FO_SKILL_JLS', 'TH_FO_SKILL_FQH'
                                ];
                                const partialIds = [
                                    'TH_FO_SKILL_JSKW', 'TH_FO_SKILL_QSYY', 
                                    'ZS_XIAN_SKILL_LZYY', 'ZS_MO_SKILL_LZYY', 
                                    'ZS_XIAN_SKILL_ZGDD', 'ZS_MO_SKILL_ZGDD', 
                                    'ZS_XIAN_SKILL_QXHS', 'ZS_MO_SKILL_QXHS'
                                ];
                                const isdisabled = disabledIds.includes(skill.SkillID);
                                const ispartial = partialIds.includes(skill.SkillID);
                                const isactive = !isdisabled && !ispartial;

                                return (
                                    <div
                                        key={skill.SkillID}
                                        onMouseEnter={(e) => onMouseEnter(e, skill)}
                                        onMouseLeave={onMouseLeave}
                                        className={clsx(
                                            "relative aspect-square rounded-xl border flex flex-col items-center justify-center p-1.5 cursor-help transition-all duration-300",
                                            isactive && "border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.1)] bg-amber-500/5 hover:border-amber-500 hover:bg-amber-500/10",
                                            ispartial && "border-[var(--theme-primary)]/40 shadow-[0_0_8px_var(--theme-glow)] bg-[var(--theme-primary)]/5 hover:border-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10",
                                            isdisabled && "border-slate-900 text-slate-550 opacity-40 bg-slate-950/20 hover:opacity-60"
                                        )}
                                    >
                                        <span className="text-[9px] font-bold text-slate-300 text-center leading-normal line-clamp-2 px-0.5">
                                            {skill.SkillName}
                                        </span>
                                        {/* Status Dot */}
                                        <span className={clsx(
                                            "absolute bottom-1 w-1 h-1 rounded-full",
                                            isactive && "bg-green-500",
                                            ispartial && "bg-amber-500",
                                            isdisabled && "bg-red-500"
                                        )} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// 2. Team Config Panel Component (Expandable Party Frames Layout)
export const TeamConfigPanel: React.FC<TeamConfigPanelProps> = ({
    supports,
    onSupportsChange,
    allSkills,
    onMouseEnter,
    onMouseLeave,
    getSkillMiniStatus
}) => {
    const [activeSupportIndex, setActiveSupportIndex] = useState<number | null>(null);

    const handleAddSupport = (classId: string) => {
        if (supports.length >= 5) return;
        const classConfig = SUPPORT_CLASSES.find(c => c.id === classId);
        if (!classConfig) return;

        const count = supports.filter(s => s.classId === classId).length;
        const actorId = `${classId.toLowerCase()}_sup${count > 0 ? `_${count}` : ''}`;

        const newSupport: SupportConfig = {
            actorId,
            classId,
            faction: classConfig.defaultFaction,
            profileAttributes: { ...defaultSupportAttributes }
        };

        onSupportsChange([...supports, newSupport]);
        // Auto-expand the newly added support
        setActiveSupportIndex(supports.length);
    };

    const handleRemoveSupport = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        onSupportsChange(supports.filter((_, i) => i !== index));
        if (activeSupportIndex === index) {
            setActiveSupportIndex(null);
        } else if (activeSupportIndex !== null && activeSupportIndex > index) {
            setActiveSupportIndex(activeSupportIndex - 1);
        }
    };

    const handleSupportAttributeChange = (supportIndex: number, key: keyof CharacterAttributes, valStr: string) => {
        const value = parseFloat(valStr) || 0;
        const newSupports = [...supports];
        newSupports[supportIndex] = {
            ...newSupports[supportIndex],
            profileAttributes: {
                ...newSupports[supportIndex].profileAttributes,
                [key]: value
            }
        };
        onSupportsChange(newSupports);
    };

    const renderSupportSkills = (classId: string, faction: string) => {
        const factionSkills = allSkills[classId]?.[faction] || [];
        const supportSkillList = factionSkills.filter(s => 
            ['TY_FO_SKILL_DCB', 'TY_FO_SKILL_MKXJ', 'ZM_FO_SKILL_FGSL', 'YZ_FO_SKILL_TGFM', 
             'YZ_FO_SKILL_WXBG', 'TH_FO_SKILL_MQYY', 'TH_FO_SKILL_JSKW', 'TH_FO_SKILL_QSYY', 
             'TH_FO_SKILL_YSYY2', 'TH_FO_SKILL_JLS', 'TH_FO_SKILL_FQH'].includes(s.SkillID)
        );

        if (supportSkillList.length === 0) return null;

        return (
            <div className="mt-2 space-y-1 border-t border-slate-900/60 pt-2">
                <span className="block text-[8px] font-bold text-slate-500 uppercase tracking-wide">增益技能 (悬停查看说明)</span>
                <div className="flex flex-wrap gap-1">
                    {supportSkillList.map(skill => (
                        <div
                            key={skill.SkillID}
                            onMouseEnter={(e) => onMouseEnter(e, skill)}
                            onMouseLeave={onMouseLeave}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-950/60 hover:bg-slate-950 hover:border-[var(--theme-primary)]/50 border border-slate-900 rounded cursor-help text-[9px] font-semibold text-slate-400 transition-all"
                        >
                            {getSkillMiniStatus(skill.SkillID)}
                            <span>{skill.SkillName}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col justify-between h-full">

            <div>
                {/* Team Selection Header */}
                <div className="flex flex-col gap-2 border-b border-slate-800 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-[var(--theme-glow)] border border-[var(--theme-primary)]/20">
                            <Users className="w-4 h-4 text-[var(--theme-primary)]" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold text-slate-100 tracking-wide">队友状态与框架 (Party Frames)</h3>
                            <p className="text-[9px] text-slate-500 font-semibold tracking-wider leading-none">Support Members</p>
                        </div>
                    </div>

                    {/* Class Adder Grid */}
                    <div className="flex flex-wrap gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-900 mt-1">
                        {SUPPORT_CLASSES.map(cls => {
                            const isAdded = supports.some(s => s.classId === cls.id);
                            return (
                                <button
                                    key={cls.id}
                                    type="button"
                                    disabled={isAdded || supports.length >= 5}
                                    onClick={() => handleAddSupport(cls.id)}
                                    className="px-2 py-0.5 rounded-lg text-[9px] font-bold transition-all flex items-center bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/25 text-slate-300 hover:bg-[var(--theme-primary)] hover:text-slate-950 disabled:opacity-20 disabled:hover:bg-transparent disabled:text-slate-600 disabled:border-transparent"
                                >
                                    +{cls.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Team Member Cards (Party Frames List) */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {supports.map((sup, index) => {
                        const classConfig = SUPPORT_CLASSES.find(c => c.id === sup.classId);
                        const isExpanded = activeSupportIndex === index;
                        return (
                            <div
                                key={sup.actorId}
                                onClick={() => setActiveSupportIndex(isExpanded ? null : index)}
                                className={clsx(
                                    "border rounded-xl p-2 flex flex-col gap-2 relative transition-all duration-300 cursor-pointer overflow-hidden select-none",
                                    isExpanded
                                        ? "border-[var(--theme-primary)]/60 bg-slate-950/45 shadow-[inset_0_0_10px_var(--theme-glow)]"
                                        : "border-slate-900 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-950/30"
                                )}
                            >
                                {/* Simulated Game Health Bar Background */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[var(--theme-primary)]/5 to-transparent pointer-events-none" />

                                {/* Header bar */}
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary)] animate-pulse" />
                                        <span className="text-[10px] font-black text-slate-200">
                                            {classConfig?.name || sup.classId}辅助 ({sup.actorId})
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[8px] font-bold text-slate-500 bg-slate-950/80 border border-slate-900 px-1 py-0.2 rounded font-mono uppercase">
                                            {isExpanded ? "收起" : "配置"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => handleRemoveSupport(e, index)}
                                            className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-slate-500 transition-colors z-20"
                                            title="移出队伍"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expandable Attribute Sliders & Skills */}
                                {isExpanded && (
                                    <div 
                                        className="relative z-10 animate-in fade-in duration-200"
                                        onClick={(e) => e.stopPropagation()} // Stop propagation to prevent collapse
                                    >
                                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-500 mb-0.5">最大攻击</label>
                                                <input
                                                    type="number"
                                                    value={sup.profileAttributes.CharacterMaxAttack}
                                                    onChange={(e) => handleSupportAttributeChange(index, 'CharacterMaxAttack', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-500 mb-0.5">最大真气</label>
                                                <input
                                                    type="number"
                                                    value={sup.profileAttributes.CharacterMana}
                                                    onChange={(e) => handleSupportAttributeChange(index, 'CharacterMana', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[8px] font-bold text-slate-500 mb-0.5">气血上限</label>
                                                <input
                                                    type="number"
                                                    value={sup.profileAttributes.CharacterHealth}
                                                    onChange={(e) => handleSupportAttributeChange(index, 'CharacterHealth', e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded px-1.5 py-0.5 text-[10px] font-mono focus:outline-none focus:border-[var(--theme-primary)]/40"
                                                />
                                            </div>
                                        </div>

                                        {renderSupportSkills(sup.classId, sup.faction)}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {supports.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/10">
                            <ShieldAlert className="w-5 h-5 text-slate-600 mb-1" />
                            <span className="text-[10px] font-semibold">队伍当前没有任何辅助，主输出将孤军战</span>
                            <span className="text-[8px] text-slate-600 mt-0.5">请使用上方快捷按钮添加职业</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

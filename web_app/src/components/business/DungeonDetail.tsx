import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { DataService } from '../../services/DataService';
import { calculateDamage } from '../../utils/calculator';
import type { Dungeon, RankConfig, Skill } from '../../types';
import { Sword, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

interface DungeonDetailProps {
    dungeon: Dungeon;
    isExpanded?: boolean;
    onToggle?: () => void;
    standalone?: boolean;
    rankConfig?: RankConfig;
    power?: number;
}

export const DungeonDetail = React.memo<DungeonDetailProps>(({
    dungeon,
    isExpanded = false,
    onToggle,
    standalone = false,
    rankConfig,
    power
}) => {
    const { userCharacter, activeBuffIds, buffs, buffValues } = useApp();
    const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);
    const tabsContainerRef = React.useRef<HTMLDivElement>(null);
    
    const [tooltipState, setTooltipState] = useState<{ visible: boolean; x: number; y: number; skill: Skill | null }>({ visible: false, x: 0, y: 0, skill: null });

    const getImportanceText = (weight: number) => {
        if (weight >= 0.8) return '重要';
        if (weight >= 0.5) return '一般';
        return '次要';
    };

    const getFrequencyText = (freq: number) => {
        if (freq >= 0.8) return '高';
        if (freq >= 0.4) return '中';
        return '低';
    };

    // Reset selected monster when dungeon changes
    useEffect(() => {
        if (dungeon.Monsters.length > 0) {
            setSelectedMonsterId(dungeon.Monsters[0].MonsterID);
        }
    }, [dungeon.DungeonID]);

    const service = DataService.getInstance();
    const skillsMap = service.getSkills(userCharacter.ClassID);
    const skills = skillsMap ? skillsMap[userCharacter.Faction] || [] : [];
    const activeBuffs = buffs.filter(b => activeBuffIds.includes(b.BuffID));

    const formatDamage = (damage: number, withUnit: boolean = true): string => {
        if (damage >= 100000000) {
            const value = (damage / 100000000).toFixed(3);
            return withUnit ? `${value} 亿` : value;
        }
        if (damage >= 10000) {
            const value = (damage / 10000).toFixed(3);
            return withUnit ? `${value} 万` : value;
        }
        return Math.round(damage).toLocaleString();
    };

    const numberToChinese = (num: number): string => {
        const chineseNumbers = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
        return chineseNumbers[num] || num.toString();
    };

    const showContent = standalone || isExpanded;
    const selectedMonster = dungeon.Monsters.find(m => m.MonsterID === selectedMonsterId) || dungeon.Monsters[0];

    // Pre-calculate damages for the selected monster
    const skillDamages = selectedMonster ? skills.map(skill => {
        const dmg = calculateDamage(userCharacter.BaseAttributes, skill, selectedMonster, activeBuffs, buffValues);
        return { skill, dmg };
    }).sort((a, b) => b.skill.SkillImportanceWeight - a.skill.SkillImportanceWeight) : [];

    const maxAvgDamage = skillDamages.length > 0 ? Math.max(...skillDamages.map(s => s.dmg.avgFinalDamage)) : 0;

    return (
        <div className={clsx(
            "relative overflow-hidden transition-all duration-300 rounded-2xl",
            isExpanded
                ? "bg-gradient-to-br from-slate-800/90 via-slate-900/90 to-slate-950/95 backdrop-blur-xl border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)]"
                : "bg-slate-900/80 border-white/5 shadow-lg"
        )}>
            {/* Ambient Glow Effects - Only for active card */}
            {isExpanded && (
                <>
                    <div className="absolute -top-24 -right-24 w-64 h-64 bg-cyan-500/10 blur-[60px] rounded-full pointer-events-none mix-blend-screen"></div>
                    <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-600/10 blur-[60px] rounded-full pointer-events-none mix-blend-screen"></div>
                </>
            )}
            {/* Header - Optimized Layout */}
            <div
                onClick={standalone ? undefined : onToggle}
                className={clsx(
                    "p-4 transition-colors group relative overflow-hidden",
                    standalone ? 'cursor-default bg-slate-800/50' : 'cursor-pointer hover:bg-slate-800/30'
                )}
            >
                {/* Background decorative glow */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex flex-col gap-2 relative z-10">
                    {/* Row 1: Badge + Name */}
                    <div className="flex items-center gap-3">
                        {dungeon.difficulty ? (
                            <span className={clsx(
                                "text-xs font-black px-2 py-1 rounded-lg border backdrop-blur-md shadow-sm",
                                dungeon.difficulty === '简单' && "text-green-400 border-green-400/50 bg-green-500/10",
                                dungeon.difficulty === '中等' && "text-blue-400 border-blue-400/50 bg-blue-500/10",
                                dungeon.difficulty === '较难' && "text-yellow-400 border-yellow-400/50 bg-yellow-500/10",
                                dungeon.difficulty === '难' && "text-orange-400 border-orange-400/50 bg-orange-500/10",
                                dungeon.difficulty === '极难' && "text-red-400 border-red-400/50 bg-red-500/10 shadow-[0_0_10px_rgba(248,113,113,0.3)]",
                            )}>
                                {dungeon.difficulty}
                            </span>
                        ) : rankConfig && (
                            <span className={clsx(
                                "text-xs font-black px-2 py-1 rounded-lg border backdrop-blur-md shadow-sm",
                                rankConfig.TextColor,
                                rankConfig.Border,
                                "bg-slate-950/50"
                            )}>
                                {rankConfig.Rank}
                            </span>
                        )}
                        <span className={clsx(
                            "font-bold text-lg md:text-xl text-slate-100 transition-colors tracking-wide",
                            !standalone && 'group-hover:text-cyan-300'
                        )}>
                            {dungeon.DungeonName}
                        </span>
                    </div>

                    {/* Row 2: Boss Info (Left) + Power (Right) */}
                    <div className="flex items-end justify-between mt-3">
                        <div className="flex items-baseline gap-1">
                            <span className="font-black text-xl md:text-2xl text-cyan-400 leading-none">
                                {dungeon.Monsters.length}
                            </span>
                            <span className="text-xs md:text-sm font-bold text-slate-600 tracking-wider mb-1">
                                BOSS
                            </span>
                        </div>

                        {power !== undefined && (
                            <div className="flex items-baseline gap-2">
                                <span className="text-xs md:text-sm text-slate-600 font-bold tracking-wide mb-1">
                                    参考战力
                                </span>
                                <div className="flex items-baseline gap-1">
                                    <span className={clsx(
                                        "font-black text-xl md:text-2xl tracking-tighter leading-none",
                                        "text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-200 to-blue-300 drop-shadow-sm"
                                    )}>
                                        {formatDamage(power)}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Expanded Content */}
            {showContent && (
                <div className="border-t border-slate-700/50 bg-slate-900/30 flex flex-col">
                    {/* Boss Tabs Navigation - Clean Scrollable List */}
                    <div className="flex items-center gap-1 md:gap-2 px-2 py-2 border-b border-slate-700/30 bg-slate-900/50">
                        <div
                            ref={tabsContainerRef}
                            className="flex-1 flex overflow-x-auto gap-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                        >
                            {dungeon.Monsters.map((monster) => {
                                const isSelected = monster.MonsterID === selectedMonsterId;
                                return (
                                    <button
                                        key={monster.MonsterID}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMonsterId(monster.MonsterID);

                                            // Manual scroll calculation to avoid shifting the entire card
                                            if (tabsContainerRef.current) {
                                                const container = tabsContainerRef.current;
                                                const button = e.currentTarget;

                                                // Calculate center position
                                                const scrollLeft = button.offsetLeft - (container.clientWidth / 2) + (button.clientWidth / 2);

                                                container.scrollTo({
                                                    left: scrollLeft,
                                                    behavior: 'smooth'
                                                });
                                            }
                                        }}
                                        className={clsx(
                                            "flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5 whitespace-nowrap",
                                            isSelected
                                                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                                                : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                                        )}
                                    >
                                        {isSelected && <Sword className="w-3 h-3" />}
                                        <span>第{numberToChinese(monster.DungeonLevel)}关</span>
                                        <span className={clsx(
                                            "ml-1 opacity-75",
                                            isSelected ? "text-cyan-200" : "text-slate-500"
                                        )}>
                                            {monster.MonsterName}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Boss Data */}
                    {selectedMonster && (
                        <div className="animate-fade-in"
                            onTouchStart={(e) => e.stopPropagation()}
                        >
                            <div className="p-3 md:p-4">
                                {/* Skills Damage Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700/50">
                                                <th className="text-left py-2 px-2 text-slate-400 font-medium text-xs whitespace-nowrap w-1/2">技能</th>
                                                <th className="hidden text-right py-2 px-2 text-slate-400 font-medium text-xs whitespace-nowrap">最小伤害</th>
                                                <th className="hidden text-right py-2 px-2 text-slate-400 font-medium text-xs whitespace-nowrap">最大伤害</th>
                                                <th className="text-right py-2 px-2 text-slate-400 font-medium text-xs whitespace-nowrap w-1/2">平均伤害</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700/30">
                                            {skillDamages.map(({ skill, dmg }) => {
                                                const barWidth = maxAvgDamage > 0 ? (dmg.avgFinalDamage / maxAvgDamage) * 100 : 0;

                                                return (
                                                    <tr key={skill.SkillID} className="hover:bg-slate-800/30 transition-colors group relative">
                                                        <td className="py-3 px-2 text-slate-200 font-medium relative z-10 whitespace-nowrap">
                                                            <div className="flex items-center gap-2 relative">
                                                                <span>{skill.SkillName}</span>
                                                                <Info 
                                                                    className="w-4 h-4 text-slate-500 hover:text-cyan-400 cursor-pointer transition-colors"
                                                                    onMouseEnter={(e) => {
                                                                        setTooltipState({ visible: true, x: e.clientX, y: e.clientY, skill });
                                                                    }}
                                                                    onMouseMove={(e) => {
                                                                        setTooltipState(prev => prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev);
                                                                    }}
                                                                    onMouseLeave={() => {
                                                                        setTooltipState(prev => ({ ...prev, visible: false }));
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="text-xs md:text-sm text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                                                                <span className="text-cyan-400 font-semibold">{formatDamage(dmg.minFinalDamage, false)}</span>
                                                                <span className="text-slate-500">~</span>
                                                                <span className="text-purple-400 font-semibold">{formatDamage(dmg.maxFinalDamage)}</span>
                                                            </div>
                                                        </td>
                                                        <td className="hidden py-3 px-2 text-right text-cyan-300 font-mono text-sm font-medium relative z-10 whitespace-nowrap">
                                                            {formatDamage(dmg.minFinalDamage)}
                                                        </td>
                                                        <td className="hidden py-3 px-2 text-right text-purple-300 font-mono text-sm font-medium relative z-10 whitespace-nowrap">
                                                            {formatDamage(dmg.maxFinalDamage)}
                                                        </td>
                                                        <td className="py-3 px-2 text-right relative">
                                                            {/* Damage Bar Background */}
                                                            <div
                                                                className="absolute inset-y-1 right-1 bg-yellow-500/20 rounded-sm transition-all duration-500"
                                                                style={{ width: `${barWidth * 0.95}%` }}
                                                            />
                                                            <span className="relative z-10 text-yellow-300 font-mono font-bold text-sm md:text-base shadow-black drop-shadow-sm whitespace-nowrap">
                                                                {formatDamage(dmg.avgFinalDamage)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tooltip Portal */}
            {tooltipState.visible && tooltipState.skill && createPortal(
                <div 
                    className="fixed z-[9999] pointer-events-none w-[320px] p-4 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-opacity animate-in fade-in"
                    style={{ 
                        left: Math.min(tooltipState.x + 15, window.innerWidth - 340), 
                        top: Math.max(10, Math.min(tooltipState.y - 150, window.innerHeight - 200))
                    }}
                >
                    <div className="flex flex-col gap-3 font-normal whitespace-normal">
                        <div className="text-cyan-400 font-bold border-b border-slate-700/50 pb-2 flex items-center justify-between">
                            <span>技能详细信息</span>
                            <span className="text-xs text-slate-500 truncate max-w-[120px]">{tooltipState.skill.SkillName}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                            <div className="text-slate-400">附加攻击比: <span className="text-slate-200">{tooltipState.skill.SkillBonusAttributes?.SkillAttackPercentBonus || 0}%</span></div>
                            <div className="text-slate-400">附加固定攻击: <span className="text-slate-200">{tooltipState.skill.SkillBonusAttributes?.SkillAttackFixedBonus || 0}</span></div>
                            <div className="text-slate-400">附加气血比: <span className="text-slate-200">{tooltipState.skill.SkillBonusAttributes?.SkillHealthPercentBonus || 0}%</span></div>
                            <div className="text-slate-400">附加真气比: <span className="text-slate-200">{tooltipState.skill.SkillBonusAttributes?.SkillManaPercentBonus || 0}%</span></div>
                            <div className="text-slate-400">附加爆伤: <span className="text-slate-200">{tooltipState.skill.SkillBonusAttributes?.SkillCriticalDamagePercentBonus || 0}%</span></div>
                            <div className="text-slate-400">伤害增加倍数: <span className="text-emerald-400 font-medium">{tooltipState.skill.SkillBonusAttributes?.SkillDamageBonus || 1}</span></div>
                            <div className="text-slate-400">重要性: <span className={clsx("font-medium", tooltipState.skill.SkillImportanceWeight >= 0.8 ? "text-yellow-400" : tooltipState.skill.SkillImportanceWeight >= 0.5 ? "text-blue-300" : "text-slate-400")}>{getImportanceText(tooltipState.skill.SkillImportanceWeight)}</span></div>
                            <div className="text-slate-400">使用频次: <span className={clsx("font-medium", tooltipState.skill.SkillFrequency >= 0.8 ? "text-yellow-400" : tooltipState.skill.SkillFrequency >= 0.4 ? "text-blue-300" : "text-slate-400")}>{getFrequencyText(tooltipState.skill.SkillFrequency)}</span></div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});

DungeonDetail.displayName = 'DungeonDetail';

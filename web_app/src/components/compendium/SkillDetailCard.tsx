import React, { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import { Minus, Plus, Zap, Award } from 'lucide-react';
import type { CuratedSkillItem } from '../../types';
import { GameColorText, GameTooltipShell } from '../ui/GameColorText';

interface SkillDetailCardProps {
    skill: CuratedSkillItem;
    initialLevel?: number;
    className?: string;
}

export const SkillDetailCard: React.FC<SkillDetailCardProps> = ({
    skill,
    initialLevel,
    className = ''
}) => {
    const maxLevel = useMemo(() => {
        return Math.max(1, skill.el_max || (skill.el_descs?.length ?? 1));
    }, [skill]);

    // 默认展示最高级（巅峰状态）
    const [currentLevel, setCurrentLevel] = useState<number>(() => {
        if (typeof initialLevel === 'number' && initialLevel >= 1 && initialLevel <= maxLevel) {
            return initialLevel;
        }
        return maxLevel;
    });

    useEffect(() => {
        if (typeof initialLevel === 'number' && initialLevel >= 1 && initialLevel <= maxLevel) {
            setCurrentLevel(initialLevel);
        } else {
            setCurrentLevel(maxLevel);
        }
    }, [skill.id, maxLevel, initialLevel]);

    const currentDesc = useMemo(() => {
        if (!skill.el_descs || skill.el_descs.length === 0) return '暂无技能说明';
        const idx = Math.min(Math.max(0, currentLevel - 1), skill.el_descs.length - 1);
        return skill.el_descs[idx] || '';
    }, [skill, currentLevel]);

    const handleStep = (delta: number) => {
        setCurrentLevel(prev => Math.min(maxLevel, Math.max(1, prev + delta)));
    };

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4 text-left select-none',
            className
        )}>
            {/* 顶栏：技能名、门派分类与等级推演器 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-lg font-black text-amber-300 tracking-wide flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-cyan-400" />
                        <span>{skill.name}</span>
                    </h3>

                    {skill.group_name && (
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300 font-medium flex items-center gap-1">
                            <Award className="w-3 h-3 text-cyan-400" />
                            <span>{skill.group_name}</span>
                        </span>
                    )}

                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                        共 {maxLevel} 阶
                    </span>
                </div>

                {/* 等级推演切换 Stepper */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                    <button
                        type="button"
                        onClick={() => handleStep(-1)}
                        disabled={currentLevel <= 1}
                        className={clsx(
                            'px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all',
                            currentLevel <= 1
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
                        )}
                        title="降低 1 级"
                    >
                        <Minus className="w-3 h-3" />
                        <span className="text-[11px]">-1</span>
                    </button>

                    <div className="px-3 py-0.5 text-center min-w-[76px]">
                        <div className="text-[10px] text-slate-400 font-mono">推演等级</div>
                        <div className="text-xs font-bold text-amber-300 font-mono">
                            {currentLevel} / {maxLevel}
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => handleStep(1)}
                        disabled={currentLevel >= maxLevel}
                        className={clsx(
                            'px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all',
                            currentLevel >= maxLevel
                                ? 'text-slate-600 cursor-not-allowed'
                                : 'text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700'
                        )}
                        title="提升 1 级"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="text-[11px]">+1</span>
                    </button>

                    {/* 快捷跳转首阶 / 满阶 */}
                    <div className="flex items-center gap-1 pl-1 border-l border-slate-800 ml-1">
                        <button
                            type="button"
                            onClick={() => setCurrentLevel(1)}
                            className={clsx(
                                'px-1.5 py-1 rounded text-[10px] font-mono transition-all',
                                currentLevel === 1 ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'
                            )}
                        >
                            初始
                        </button>
                        <button
                            type="button"
                            onClick={() => setCurrentLevel(maxLevel)}
                            className={clsx(
                                'px-1.5 py-1 rounded text-[10px] font-mono transition-all',
                                currentLevel === maxLevel ? 'bg-cyan-600/40 text-cyan-200 border border-cyan-500/50' : 'text-slate-500 hover:text-slate-300'
                            )}
                        >
                            满阶
                        </button>
                    </div>
                </div>
            </div>

            {/* 1:1 游戏原生 Tooltip 视效卡 */}
            <GameTooltipShell
                className="w-full bg-[#0a0d14]/95 border-[#222b3d] shadow-[0_8px_30px_rgb(0_0_0/0.7)]"
            >
                <div className="text-xs leading-relaxed">
                    <GameColorText text={currentDesc} />
                </div>
            </GameTooltipShell>
        </div>
    );
};

import React, { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import type { CuratedSkillItem } from '../../types';
import { GameColorText } from '../ui/GameColorText';

interface SkillDetailCardProps {
    skill: CuratedSkillItem;
    initialLevel?: number;
    className?: string;
    onSelectSkillName?: (skillName: string) => void;
}

export const SkillDetailCard: React.FC<SkillDetailCardProps> = ({
    skill,
    initialLevel,
    className = '',
    onSelectSkillName
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
        if (!skill.el_descs || skill.el_descs.length === 0) return '';
        const idx = Math.min(Math.max(0, currentLevel - 1), skill.el_descs.length - 1);
        return skill.el_descs[idx] || '';
    }, [skill, currentLevel]);

    // 分离第一行（原生技能标题）与正文内容
    const { titleLineClean, bodyDesc } = useMemo(() => {
        if (!currentDesc) {
            return {
                titleLineClean: `^ffffff${skill.name}`,
                bodyDesc: '暂无技能说明'
            };
        }
        const cleaned = currentDesc.replace(/\r/g, '');
        const lines = cleaned.split('\n');
        const first = lines[0]?.trim() || '';
        // 剥离第一行可能自带的静态等级后缀，以便实时拼装当前推演等级
        const titleClean = first
            .replace(/[\s\u3000]*(\^[0-9a-fA-F]{6})?[\s\u3000]*\d+\/\d+.*$/, '')
            .trim();
        const rest = lines.slice(1).join('\n').trim();
        return {
            titleLineClean: titleClean || `^ffffff${skill.name}`,
            bodyDesc: rest
        };
    }, [currentDesc, skill.name]);

    const handleStep = (delta: number) => {
        setCurrentLevel(prev => Math.min(maxLevel, Math.max(1, prev + delta)));
    };

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left select-none',
            className
        )}>
            {/* 1:1 游戏实机原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-4 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 首行技能名称与升降阶步进按钮 */}
                <div className="font-bold text-[14px] pb-1.5 mb-2 border-b border-[#1f293d]/80 flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* 技能名 + 原始黄色阶位等级（如 5/7），字号与技能名严格一致 */}
                        <GameColorText text={`${titleLineClean} ^ffcb4a${currentLevel}/${maxLevel}`} />
                        {skill.group_name && (
                            <span className="text-[11px] font-sans text-cyan-300/80 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/30 font-normal">
                                {skill.group_name}
                            </span>
                        )}
                        {skill.tags && skill.tags.map((t, tIdx) => {
                            const label = t.v ? `${t.n} ${t.v}` : t.n;
                            const colorCls =
                                t.n.includes('绿点') ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300' :
                                t.n.includes('紫点') ? 'bg-purple-950/70 border-purple-500/50 text-purple-300' :
                                t.n.includes('增伤') ? 'bg-amber-950/70 border-amber-500/50 text-amber-300' :
                                t.n.includes('破防') ? 'bg-rose-950/70 border-rose-500/50 text-rose-300' :
                                'bg-slate-800/80 border-slate-700 text-slate-300';
                            return (
                                <span
                                    key={tIdx}
                                    className={clsx('text-[11px] font-sans px-1.5 py-0.5 rounded border font-semibold tracking-tight', colorCls)}
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>

                    {/* 多阶技能：等级 -1 / 等级 +1 步进按钮 */}
                    {maxLevel > 1 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-sans text-amber-300/90 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                                {currentLevel}级
                            </span>
                            <button
                                type="button"
                                onClick={() => handleStep(-1)}
                                disabled={currentLevel <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-xs font-bold transition-all border font-sans',
                                    currentLevel <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等级 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStep(1)}
                                disabled={currentLevel >= maxLevel}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-xs font-bold transition-all border font-sans',
                                    currentLevel >= maxLevel
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-amber-600/30 border-amber-500/50 text-amber-200 hover:bg-amber-600/50 hover:text-white'
                                )}
                            >
                                等级 +1
                            </button>
                        </div>
                    )}
                </div>

                {/* 技能正文 */}
                {bodyDesc && (
                    <div className="text-[13px] leading-[22px]">
                        <GameColorText text={bodyDesc} />
                    </div>
                )}
            </div>

            {/* 联动天书与强化技能标签 */}
            {skill.buffed_by && skill.buffed_by.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-1 text-xs">
                    <span className="text-slate-400 font-medium">关联天书与强化:</span>
                    {skill.buffed_by.map(([buffId, buffName]) => (
                        <button
                            key={buffId}
                            type="button"
                            onClick={() => onSelectSkillName?.(buffName)}
                            title={`点击速查「${buffName}」天书与机制卡片`}
                            className={clsx(
                                'px-2.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 font-mono text-[11px] transition-all flex items-center gap-1 select-none',
                                onSelectSkillName
                                    ? 'hover:bg-cyan-900/70 hover:border-cyan-400 hover:text-white cursor-pointer active:scale-95 shadow-sm'
                                    : 'cursor-default'
                            )}
                        >
                            <span>{buffName}</span>
                            <span className="text-[9px] text-cyan-400/80 font-sans">↗</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

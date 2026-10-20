import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
    Zap
} from 'lucide-react';
import type { FabaoItem, FabaoSkillDetail } from '../../types';
import { GameColorText, GameTooltipShell } from '../ui/GameColorText';

interface FabaoDetailCardProps {
    fabao: FabaoItem;
    className?: string;
}

export const FabaoDetailCard: React.FC<FabaoDetailCardProps> = ({
    fabao,
    className
}) => {
    const [activeVariantKey, setActiveVariantKey] = useState<'普通' | '承' | '真'>('普通');
    const [rankLevel, setRankLevel] = useState<number>(5);

    // 当法宝变化时，若当前变体在法宝中不存在，则自动重置回普通或首个有效形态
    useEffect(() => {
        if (!fabao?.技能特效) return;
        const variants = fabao.技能特效;
        if (!variants[activeVariantKey]) {
            if (variants['普通']) {
                setActiveVariantKey('普通');
            } else {
                const firstKey = Object.keys(variants)[0] as '普通' | '承' | '真';
                if (firstKey) setActiveVariantKey(firstKey);
            }
        }
    }, [fabao]);

    // 当前选中的技能特效详情
    const currentSkillDetail: FabaoSkillDetail | undefined = useMemo(() => {
        if (!fabao?.技能特效) return undefined;
        return fabao.技能特效[activeVariantKey] || fabao.技能特效['普通'];
    }, [fabao, activeVariantKey]);

    // 动态等阶替换与标题/正文拆分（1~5阶）
    const { titleLine, bodyStr1 } = useMemo(() => {
        const skillName = currentSkillDetail?.name || fabao.skillName || '法宝特技';
        if (!currentSkillDetail?.str1) {
            return {
                titleLine: `^11ff11${skillName}　^ffcb4a第^11ff11${rankLevel}^ffcb4a阶`,
                bodyStr1: ''
            };
        }
        // 替换等阶 "第^11ff115^ffcb4a阶" 或 "第5阶"
        const replaced = currentSkillDetail.str1.replace(
            /(第(?:\^11ff11)?)\d+((?:\^ffcb4a)?阶)/,
            `$1${rankLevel}$2`
        );
        const lines = replaced.split('\n');
        // 首行通常为 "^11ff11技能名　^ffcb4a第^11ff115^ffcb4a阶"，提取到顶部标题行合并显示
        if (lines.length > 1 && /(?:第(?:\^11ff11)?\d+(?:\^ffcb4a)?阶)/.test(lines[0])) {
            return {
                titleLine: lines[0],
                bodyStr1: lines.slice(1).join('\n')
            };
        }
        return {
            titleLine: `^11ff11${skillName}　^ffcb4a第^11ff11${rankLevel}^ffcb4a阶`,
            bodyStr1: replaced
        };
    }, [currentSkillDetail, fabao.skillName, rankLevel]);

    const availableVariants = useMemo(() => {
        if (!fabao?.技能特效) return [];
        return (['普通', '承', '真'] as const).filter(k => Boolean(fabao.技能特效[k]));
    }, [fabao]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0 max-w-xl',
            className
        )}>
            {/* 详情顶栏：法宝名称与类别（第1行），传承形态与等阶加减按钮（第2行） */}
            <div className="flex flex-col gap-2 pb-2.5 border-b border-slate-800 min-w-0">
                {/* 第 1 行：法宝名称与品质/等级标签 */}
                <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <h3 className="text-base sm:text-lg font-black text-amber-300 tracking-wide break-words">
                            {fabao.名称}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono whitespace-nowrap">
                            {fabao.等级 || 135}级 · {fabao.类型}
                        </span>
                    </div>

                    {/* 若无传承形态时，等阶按钮直接在第 1 行右侧展示，避免多留一行空白 */}
                    {availableVariants.length <= 1 && (
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setRankLevel(prev => Math.max(1, prev - 1))}
                                disabled={rankLevel <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rankLevel <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等阶 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setRankLevel(prev => Math.min(5, prev + 1))}
                                disabled={rankLevel >= 5}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rankLevel >= 5
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                等阶 +1
                            </button>
                        </div>
                    )}
                </div>

                {/* 第 2 行：传承形态（左侧）与 等阶加减按钮（右侧）同排展示 */}
                {availableVariants.length > 1 && (
                    <div className="flex items-center justify-between gap-2 min-w-0 pt-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">传承形态:</span>
                            <div className="inline-flex rounded-lg bg-slate-950/70 p-0.5 border border-slate-800/80">
                                {availableVariants.map(k => {
                                    const isActive = activeVariantKey === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => setActiveVariantKey(k)}
                                            className={clsx(
                                                'px-3 py-0.5 rounded-md text-xs font-bold transition-all whitespace-nowrap cursor-pointer',
                                                isActive
                                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                                                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                                            )}
                                        >
                                            {k}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 等阶加减按钮，与传承形态在同一行左右呼应 */}
                        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                            <button
                                type="button"
                                onClick={() => setRankLevel(prev => Math.max(1, prev - 1))}
                                disabled={rankLevel <= 1}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rankLevel <= 1
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                )}
                            >
                                等阶 -1
                            </button>
                            <button
                                type="button"
                                onClick={() => setRankLevel(prev => Math.min(5, prev + 1))}
                                disabled={rankLevel >= 5}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                    rankLevel >= 5
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                等阶 +1
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 游戏保真 Tooltip 展现区 */}
            {currentSkillDetail ? (
                <GameTooltipShell
                    title={<GameColorText text={titleLine} />}
                    className="border-slate-700/80 bg-[#0b0e14]/95 text-xs font-sans leading-relaxed"
                >
                    {/* 标题段余下内容 (类型、使用效果等，首行等阶已合并至上方标题) */}
                    {bodyStr1 && (
                        <div className="pb-2 border-b border-slate-800/80">
                            <GameColorText text={bodyStr1} />
                        </div>
                    )}

                    {/* 数值与冷却/段数/加成 (str2) */}
                    {currentSkillDetail.str2 && (
                        <div className="py-2 border-b border-slate-800/80">
                            <GameColorText text={currentSkillDetail.str2} />
                        </div>
                    )}

                    {/* 附加文本 (str3/str4) */}
                    {(currentSkillDetail.str3 || currentSkillDetail.str4) && (
                        <div className="py-1 text-slate-400">
                            {currentSkillDetail.str3 && <GameColorText text={currentSkillDetail.str3} />}
                            {currentSkillDetail.str4 && <GameColorText text={currentSkillDetail.str4} />}
                        </div>
                    )}

                    {/* 特效变体展开 (融合变体 / 特效1~4) */}
                    {currentSkillDetail.特效变体 && currentSkillDetail.特效变体.length > 0 && (
                        <div className="pt-2 flex flex-col gap-2">
                            <div className="text-[11px] font-bold text-sky-300 flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-sky-400" />
                                <span>融合/阶位特效一览:</span>
                            </div>
                            <div className="flex flex-col gap-1.5 pl-1">
                                {currentSkillDetail.特效变体.map((v, vIdx) => (
                                    <div
                                        key={vIdx}
                                        className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs"
                                    >
                                        <GameColorText text={v.str2} />
                                        {v.效果标签 && v.效果标签.length > 0 && (
                                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                {v.效果标签.map((tagItem, tIdx) => {
                                                    const tagText = typeof tagItem === 'string'
                                                        ? tagItem
                                                        : `${tagItem.n}: ${tagItem.v}`;
                                                    return (
                                                        <span
                                                            key={tIdx}
                                                            className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold"
                                                        >
                                                            {tagText}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </GameTooltipShell>
            ) : (
                <div className="p-6 text-center text-slate-500 border border-slate-800 rounded-xl">
                    暂无该形态的特技描述
                </div>
            )}

            {/* 法宝来源说明 */}
            {/* <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex flex-col gap-1">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-cyan-400" /> 获取途径与说明:
                </span>
                <div className="text-slate-300 leading-relaxed pl-4">
                    <GameColorText text={fabao.描述_带换行 || fabao.描述_纯文本 || '暂无说明'} />
                </div>
            </div> */}
        </div>
    );
};

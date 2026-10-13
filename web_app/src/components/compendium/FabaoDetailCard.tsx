import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import {
    Sliders,
    Zap,
    Info
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

    // 动态等阶替换（1~5阶）
    const renderedSkillStr1 = useMemo(() => {
        if (!currentSkillDetail?.str1) return '';
        // 替换 "第^11ff115^ffcb4a阶" 或 "第5阶"
        return currentSkillDetail.str1.replace(
            /(第(?:\^11ff11)?)\d+((?:\^ffcb4a)?阶)/,
            `$1${rankLevel}$2`
        );
    }, [currentSkillDetail, rankLevel]);

    const availableVariants = useMemo(() => {
        if (!fabao?.技能特效) return [];
        return (['普通', '承', '真'] as const).filter(k => Boolean(fabao.技能特效[k]));
    }, [fabao]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4 text-left',
            className
        )}>
            {/* 详情顶栏：法宝名称、品质、多阶变体切换 */}
            <div className="flex flex-col gap-2.5 pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-amber-300 tracking-wide">
                            {fabao.名称}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                            {fabao.等级 || 135}级 · {fabao.类型}
                        </span>
                    </div>
                </div>

                {/* 普通 / 承 / 真 特技变体切换 Pills */}
                {availableVariants.length > 1 && (
                    <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-xs text-slate-400 font-semibold mr-1">传承形态:</span>
                        {availableVariants.map(k => {
                            const isActive = activeVariantKey === k;
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => setActiveVariantKey(k)}
                                    className={clsx(
                                        'px-3.5 py-1 rounded-lg text-xs font-bold transition-all',
                                        isActive
                                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                                    )}
                                >
                                    {k}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 等阶调节滑块 (1~5阶) - 轨道明显可见 */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>技能等阶:</span>
                    <span className="font-mono font-bold text-cyan-300 text-sm">
                        第 {rankLevel} 阶
                    </span>
                </div>
                <div className="flex items-center gap-2.5">
                    {/* 滑块轨道显式增加背景色、高度与微阴影，杜绝透明隐形 */}
                    <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={rankLevel}
                        onChange={(e) => setRankLevel(Number(e.target.value))}
                        className="w-28 sm:w-36 h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-600/60 shadow-inner [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-slate-700 [&::-moz-range-track]:rounded-full"
                    />
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(lv => (
                            <button
                                key={lv}
                                type="button"
                                onClick={() => setRankLevel(lv)}
                                className={clsx(
                                    'w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-all',
                                    rankLevel === lv
                                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                )}
                            >
                                {lv}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 游戏保真 Tooltip 展现区 */}
            {currentSkillDetail ? (
                <GameTooltipShell
                    title={currentSkillDetail.name}
                    titleColor="#11ff11"
                    className="border-slate-700/80 bg-[#0b0e14]/95 text-xs font-sans leading-relaxed"
                >
                    {/* 标题段与类型 (str1) */}
                    {renderedSkillStr1 && (
                        <div className="pb-2 border-b border-slate-800/80">
                            <GameColorText text={renderedSkillStr1} />
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
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex flex-col gap-1">
                <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-cyan-400" /> 获取途径与说明:
                </span>
                <div className="text-slate-300 leading-relaxed pl-4">
                    <GameColorText text={fabao.描述_带换行 || fabao.描述_纯文本 || '暂无说明'} />
                </div>
            </div>
        </div>
    );
};

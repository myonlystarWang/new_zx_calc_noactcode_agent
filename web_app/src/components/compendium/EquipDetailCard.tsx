import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import {
    Sparkles,
    CheckCircle2,
    Lock
} from 'lucide-react';
import type { CuratedEquipItem } from '../../types';
import { GameTooltipShell } from '../ui/GameColorText';

export interface EquipDetailCardProps {
    item: CuratedEquipItem;
    className?: string;
}

/**
 * 装备品质主色调
 */
export function getQualityColor(q: string): string {
    switch (q) {
        case '神隐': return '#ffcb4a'; // 金黄品质
        case '彰武': return '#ff4d4f'; // 炽红品质
        case '昭武': return '#b37feb'; // 幽紫品质
        case '修武': return '#36cfc9'; // 青碧品质
        default: return '#38bdf8';
    }
}

/**
 * 蕴灵与炼器等级色彩体系（+0 ~ +15 阶梯色彩映射，预留精准游戏色卡微调）
 */
export function getYunlingRefColor(refLevel: number): string {
    if (refLevel <= 0) return '#94a3b8'; // +0 灰
    if (refLevel <= 8) return '#cbd5e1'; // +1 ~ +8 银白
    if (refLevel <= 10) return '#10b981'; // +9 ~ +10 翡翠绿
    if (refLevel <= 12) return '#06b6d4'; // +11 ~ +12 天青蓝
    if (refLevel <= 14) return '#c084fc'; // +13 ~ +14 幽紫
    return '#ffcb4a'; // +15 纯金/红金蕴灵
}

function getRefKey(it: CuratedEquipItem): 'atk' | 'def' | 'hp' | 'mp' | null {
    let best: 'atk' | 'def' | 'hp' | 'mp' | null = null;
    let bv = -1;
    if (it.atk && it.atk[1] > bv) {
        bv = it.atk[1];
        best = 'atk';
    }
    const K: ('def' | 'hp' | 'mp')[] = ['def', 'hp', 'mp'];
    for (const k of K) {
        const v = it[k] || 0;
        if (v > bv) {
            bv = v;
            best = k;
        }
    }
    return best;
}

export const EquipDetailCard: React.FC<EquipDetailCardProps> = ({
    item,
    className
}) => {
    // 默认高亮 +11（主流档位）
    const [refLevel, setRefLevel] = useState<number>(11);

    const qualityColor = useMemo(() => getQualityColor(item.q), [item.q]);
    const refColor = useMemo(() => getYunlingRefColor(refLevel), [refLevel]);

    const targetRefKey = useMemo(() => getRefKey(item), [item]);

    // 计算当前 +N 阶炼器数值加成
    const currentRefBonus = useMemo(() => {
        if (!item.ref || refLevel === 0) return 0;
        const idx = Math.min(refLevel - 1, item.ref.length - 1);
        return item.ref[idx] || 0;
    }, [item.ref, refLevel]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4 text-left',
            className
        )}>
            {/* 标题栏与品质徽章 */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black tracking-wide" style={{ color: qualityColor }}>
                            {item.name}
                        </h3>
                        {refLevel > 0 && (
                            <span className="font-mono font-bold text-base" style={{ color: refColor }}>
                                +{refLevel}
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                        {item.slot} · {item.q}品质 · {item.lv}级
                        {item.prof && item.prof.length > 0 && ` · ${item.prof.join('、')}`}
                    </div>
                </div>
                <span
                    className="text-xs font-bold px-2 py-0.5 rounded border font-mono"
                    style={{
                        color: qualityColor,
                        borderColor: `${qualityColor}55`,
                        backgroundColor: `${qualityColor}15`
                    }}
                >
                    {item.q}
                </span>
            </div>

            {/* 强化步进控制器：强化 -1 与 强化 +1（彻底替代冗余滑动框与多余矩阵） */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>炼器强化等级:</span>
                    <span className="font-mono font-bold text-sm" style={{ color: refColor }}>
                        +{refLevel}
                    </span>
                    {currentRefBonus > 0 && (
                        <span className="font-mono text-cyan-300 font-bold text-xs bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded ml-1">
                            强化加成: +{currentRefBonus}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRefLevel(prev => Math.max(0, prev - 1))}
                        disabled={refLevel <= 0}
                        className={clsx(
                            'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm',
                            refLevel <= 0
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                        )}
                    >
                        强化 -1
                    </button>
                    <button
                        type="button"
                        onClick={() => setRefLevel(prev => Math.min(15, prev + 1))}
                        disabled={refLevel >= 15}
                        className={clsx(
                            'px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm',
                            refLevel >= 15
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                        )}
                    >
                        强化 +1
                    </button>
                </div>
            </div>

            {/* 游戏保真 Tooltip 面板 */}
            <GameTooltipShell
                className="border-slate-700/80 bg-[#0c1017]/95 text-xs font-sans leading-relaxed"
            >
                {/* 游戏保真首行标题：装备名称与蕴灵等级颜色高保真呈现 */}
                <div className="text-sm font-bold pb-1.5 mb-2 border-b border-[#21262d] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold tracking-wide">
                        <span style={{ color: qualityColor }}>{item.name}</span>
                        {refLevel > 0 && (
                            <span className="font-mono" style={{ color: refColor }}>+{refLevel}</span>
                        )}
                    </div>
                </div>

                {/* 基础属性 */}
                <div className="space-y-1 pb-2 border-b border-slate-800/80">
                    <div className="flex justify-between">
                        <span className="text-slate-400">品质：</span>
                        <span className="font-bold" style={{ color: qualityColor }}>{item.q}品质</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">部位：</span>
                        <span className="text-slate-200">{item.slot}</span>
                    </div>

                    {/* 攻击力 (含炼器强化) */}
                    {item.atk && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">攻击：</span>
                            <span className="font-mono font-bold text-slate-100">
                                {item.atk[0] + (targetRefKey === 'atk' ? currentRefBonus : 0)} - {item.atk[1] + (targetRefKey === 'atk' ? currentRefBonus : 0)}
                                {targetRefKey === 'atk' && currentRefBonus > 0 && (
                                    <span className="text-cyan-400 font-bold ml-1.5">
                                        (+{currentRefBonus})
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* 防御力 */}
                    {item.def !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">防御：</span>
                            <span className="font-mono font-bold text-slate-100">
                                +{item.def + (targetRefKey === 'def' ? currentRefBonus : 0)}
                                {targetRefKey === 'def' && currentRefBonus > 0 && (
                                    <span className="text-cyan-400 font-bold ml-1.5">
                                        (+{currentRefBonus})
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* 气血 */}
                    {item.hp !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">气血：</span>
                            <span className="font-mono font-bold text-slate-100">
                                +{item.hp + (targetRefKey === 'hp' ? currentRefBonus : 0)}
                                {targetRefKey === 'hp' && currentRefBonus > 0 && (
                                    <span className="text-cyan-400 font-bold ml-1.5">
                                        (+{currentRefBonus})
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {/* 真气 */}
                    {item.mp !== undefined && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">真气：</span>
                            <span className="font-mono font-bold text-slate-100">
                                +{item.mp + (targetRefKey === 'mp' ? currentRefBonus : 0)}
                                {targetRefKey === 'mp' && currentRefBonus > 0 && (
                                    <span className="text-cyan-400 font-bold ml-1.5">
                                        (+{currentRefBonus})
                                    </span>
                                )}
                            </span>
                        </div>
                    )}

                    {item.rng && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">攻击距离：</span>
                            <span className="text-slate-200">{item.rng}</span>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <span className="text-slate-400">等级限制：</span>
                        <span className="text-slate-200">{item.lv} 级</span>
                    </div>
                    {item.xz && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">修真限制：</span>
                            <span className="text-slate-200">{item.xz}</span>
                        </div>
                    )}
                    {item.prof && item.prof.length > 0 && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">门派限制：</span>
                            <span className="text-slate-200">{item.prof.join('、')}</span>
                        </div>
                    )}
                    {item.g && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">性别限制：</span>
                            <span className="text-slate-200">{item.g}</span>
                        </div>
                    )}
                    {item.dura && (
                        <div className="flex justify-between">
                            <span className="text-slate-400">耐久：</span>
                            <span className="text-slate-200">{item.dura}</span>
                        </div>
                    )}
                </div>

                {/* 附加属性列表 (根据 refLevel 动态判断激活与锁定，支持高对比度游戏色彩) */}
                {item.ad && item.ad.length > 0 && (
                    <div className="py-2 border-b border-slate-800/80">
                        <div className="text-[11px] font-bold text-amber-300 pb-1 flex items-center justify-between">
                            <span>附加属性:</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                                激活 {item.ad.filter(a => refLevel >= a.l).length} / {item.ad.length}
                            </span>
                        </div>
                        <div className="space-y-1">
                            {item.ad.map((attr, aIdx) => {
                                const isUnlocked = refLevel >= attr.l;
                                return (
                                    <div
                                        key={aIdx}
                                        className={clsx(
                                            'flex items-center justify-between py-0.5 text-xs font-mono transition-colors',
                                            isUnlocked
                                                ? 'text-[#11ff11] font-medium'
                                                : 'text-slate-500 opacity-60'
                                        )}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            {isUnlocked ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-[#11ff11]" />
                                            ) : (
                                                <Lock className="w-3.5 h-3.5 text-slate-500" />
                                            )}
                                            <span>{attr.d || attr.n}</span>
                                        </div>
                                        {attr.l > 0 && (
                                            <span className={clsx(
                                                'text-[10px] px-1.5 py-0.2 rounded border',
                                                isUnlocked
                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                            )}>
                                                +{attr.l} 解锁
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 神机属性 (可抽取洗炼词条池，色彩区分档位与数值) */}
                {item.sj && (
                    <div className="pt-2 flex flex-col gap-2">
                        <div className="text-[11px] font-bold text-orange-400 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                            <span>神机洗炼属性池:</span>
                        </div>
                        {Object.entries(item.sj).map(([groupKey, bonusList]) => {
                            if (!bonusList || bonusList.length === 0) return null;
                            return (
                                <div key={groupKey} className="space-y-1.5">
                                    {[11, 13, 15].map(tier => {
                                        const tierItems = bonusList.filter(b => b.l === tier);
                                        if (tierItems.length === 0) return null;
                                        const isUnlocked = refLevel >= tier;

                                        return (
                                            <div
                                                key={tier}
                                                className={clsx(
                                                    'p-2.5 rounded-lg border text-xs flex flex-col gap-1.5 transition-all',
                                                    isUnlocked
                                                        ? 'bg-orange-950/25 border-orange-500/40 text-orange-200'
                                                        : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60'
                                                )}
                                            >
                                                <div className="flex items-center justify-between font-mono font-bold">
                                                    <span className={isUnlocked ? 'text-amber-400' : 'text-slate-500'}>
                                                        +{tier} 档位神机池 ({groupKey})
                                                    </span>
                                                    <span className={clsx(
                                                        'text-[10px] px-1.5 py-0.2 rounded font-semibold',
                                                        isUnlocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-500'
                                                    )}>
                                                        {isUnlocked ? '当前已激活' : '需炼器 +' + tier}
                                                    </span>
                                                </div>
                                                <div className="space-y-1 pl-1 font-mono text-[11px]">
                                                    {tierItems.map((bi, bIdx) => (
                                                        <div key={bIdx} className="flex items-center justify-between">
                                                            <span className={isUnlocked ? 'text-slate-200' : 'text-slate-500'}>
                                                                · {bi.d}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}
            </GameTooltipShell>
        </div>
    );
};

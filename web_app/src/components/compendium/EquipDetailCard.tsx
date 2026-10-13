import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { Sparkles } from 'lucide-react';
import type { CuratedEquipItem } from '../../types';
import {
    GAME_COLORS,
    getYunlingColor,
    getShenjiTierColor,
    getEquipQualityColor
} from '../../constants/gameColorSystem';

export interface EquipDetailCardProps {
    item: CuratedEquipItem;
    className?: string;
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
    // 默认高亮 +11（主流分水岭档位）
    const [refLevel, setRefLevel] = useState<number>(11);

    const qualityColor = useMemo(() => getEquipQualityColor(item.q), [item.q]);
    const yunlingColor = useMemo(() => getYunlingColor(refLevel), [refLevel]);
    const targetRefKey = useMemo(() => getRefKey(item), [item]);

    // 计算当前 +N 阶炼器数值加成
    const currentRefBonus = useMemo(() => {
        if (!item.ref || refLevel === 0) return 0;
        const idx = Math.min(refLevel - 1, item.ref.length - 1);
        return item.ref[idx] || 0;
    }, [item.ref, refLevel]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left',
            className
        )}>
            {/* 顶栏操作区：强化等级步进器 */}
            <div className="flex items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <div className="flex items-center gap-2 text-xs font-medium">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-slate-300">蕴灵强化等级:</span>
                    <span className="font-mono font-bold text-sm tracking-wide" style={{ color: yunlingColor }}>
                        +{refLevel}
                    </span>
                    {currentRefBonus > 0 && (
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                            加成: +{currentRefBonus}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setRefLevel(prev => Math.max(0, prev - 1))}
                        disabled={refLevel <= 0}
                        className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm',
                            refLevel <= 0
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                        )}
                    >
                        强化 -1
                    </button>
                    <button
                        type="button"
                        onClick={() => setRefLevel(prev => Math.min(15, prev + 1))}
                        disabled={refLevel >= 15}
                        className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs font-bold transition-all border shadow-sm',
                            refLevel >= 15
                                ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                        )}
                    >
                        强化 +1
                    </button>
                </div>
            </div>

            {/* 1:1 游戏实机与寻宝天行原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-4 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 首行装备名称与蕴灵等级：统一应用蕴灵品阶原色（+15炽红、+14幽紫、+13明黄、+12湛蓝、+11碧绿、+0~+10淡白紫） */}
                <div
                    className="font-bold text-[14px] pb-1.5 mb-2 border-b border-[#1f293d]/80 flex items-center justify-between"
                    style={{ color: yunlingColor }}
                >
                    <span>
                        {item.name}
                        {item.g ? `（${item.g}）` : ''}
                        （蕴灵 +{refLevel}）
                    </span>
                    <span
                        className="text-[11px] px-1.5 py-0.2 rounded border font-mono font-normal"
                        style={{
                            color: qualityColor,
                            borderColor: `${qualityColor}44`,
                            backgroundColor: `${qualityColor}15`
                        }}
                    >
                        {item.q}
                    </span>
                </div>

                {/* 攻击距离（武器专属，纯白字） */}
                {item.rng !== undefined && (
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        攻击距离 {item.rng.toFixed(2)}
                    </div>
                )}

                {/* 基础攻击与固定攻击（经典游戏蓝 #8080ff） */}
                {item.atk && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础攻击 {item.atk[0]} － {item.atk[1]}
                    </div>
                )}
                {targetRefKey === 'atk' && currentRefBonus > 0 && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        固定攻击 {currentRefBonus} － {currentRefBonus}
                    </div>
                )}

                {/* 防御力与固定防御（经典游戏蓝 #8080ff） */}
                {item.def !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础防御 ＋{item.def}
                    </div>
                )}
                {targetRefKey === 'def' && currentRefBonus > 0 && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        固定防御 ＋{currentRefBonus}
                    </div>
                )}

                {/* 气血与真气（经典游戏蓝 #8080ff） */}
                {item.hp !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础气血 ＋{item.hp}
                    </div>
                )}
                {targetRefKey === 'hp' && currentRefBonus > 0 && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        固定气血 ＋{currentRefBonus}
                    </div>
                )}
                {item.mp !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础真气 ＋{item.mp}
                    </div>
                )}
                {targetRefKey === 'mp' && currentRefBonus > 0 && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        固定真气 ＋{currentRefBonus}
                    </div>
                )}

                {/* 附加属性列表：激活为经典游戏蓝 #8080ff，未激活置灰 */}
                {item.ad && item.ad.length > 0 && (
                    <div className="my-1.5 py-1 border-t border-b border-[#1c2436]/60">
                        {item.ad.map((attr, aIdx) => {
                            const isUnlocked = refLevel >= attr.l;
                            return (
                                <div
                                    key={aIdx}
                                    style={{
                                        color: isUnlocked ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span>{attr.d || attr.n}</span>
                                    {!isUnlocked && (
                                        <span className="text-[11px] opacity-75 font-mono">
                                            (需蕴灵 +{attr.l})
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 神机属性：分阶显示原生色彩与词条池（15阶极·炽红、13阶明黄、11阶碧绿） */}
                {item.sj && Object.entries(item.sj).length > 0 && (
                    <div className="my-1.5 py-1 border-b border-[#1c2436]/60 flex flex-col gap-1.5">
                        <div className="text-[12px] font-bold text-amber-300">
                            神机洗炼属性池:
                        </div>
                        {Object.entries(item.sj).map(([groupKey, bonusList]) => {
                            if (!bonusList || bonusList.length === 0) return null;
                            return (
                                <div key={groupKey} className="space-y-1">
                                    {[11, 13, 15].map(tier => {
                                        const tierItems = bonusList.filter(b => b.l === tier);
                                        if (tierItems.length === 0) return null;
                                        const isUnlocked = refLevel >= tier;
                                        const tierColor = getShenjiTierColor(tier);
                                        const tierLabel = tier === 15 ? '极·神机' : '神机';

                                        return (
                                            <div
                                                key={tier}
                                                className="text-[12px] pl-1"
                                                style={{
                                                    color: isUnlocked ? tierColor : GAME_COLORS.TEXT_LOCKED
                                                }}
                                            >
                                                <div className="font-semibold flex items-center justify-between text-[11px] mb-0.5 opacity-90">
                                                    <span>+{tier} 阶档位 ({tierLabel})</span>
                                                    <span>{isUnlocked ? '已激活' : '需蕴灵 +' + tier}</span>
                                                </div>
                                                {tierItems.map((bi, bIdx) => (
                                                    <div key={bIdx} className="pl-2">
                                                        · {tierLabel} {bi.d}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 底部属性与穿戴要求（白色字，门派等高亮红字） */}
                <div className="mt-2 text-[12px] leading-5 space-y-0.5 border-t border-[#1c2436]/60 pt-1.5">
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        品质：<span style={{ color: qualityColor }}>{item.q}品质</span>
                        <span className="mx-2 text-slate-600">|</span>
                        部位：<span className="text-slate-200">{item.slot}</span>
                        {item.dura && (
                            <>
                                <span className="mx-2 text-slate-600">|</span>
                                耐久：<span className="text-slate-200">{item.dura}</span>
                            </>
                        )}
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        穿戴要求：
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            {item.prof && item.prof.length > 0 ? item.prof.join('、') : '通用'}
                        </span>
                        {item.xz && (
                            <>
                                <span style={{ color: GAME_COLORS.WHITE }}>，</span>
                                <span style={{ color: GAME_COLORS.PURE_RED }}>{item.xz}</span>
                            </>
                        )}
                        <span style={{ color: GAME_COLORS.WHITE }}>，</span>
                        <span style={{ color: GAME_COLORS.PURE_RED }}>飞升{item.lv}级</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

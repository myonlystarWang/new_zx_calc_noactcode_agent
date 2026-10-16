import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Info, X } from 'lucide-react';
import clsx from 'clsx';

export const BuffSelector: React.FC<{ onNavigateToFocus?: () => void }> = () => {
    const { buffs, activeBuffIds, toggleBuff, buffValues, updateBuffValue } = useApp();
    const [showHelp, setShowHelp] = useState(false);
    const helpRef = useRef<HTMLDivElement>(null);

    // 点击外部区域自动关闭提示气泡
    useEffect(() => {
        if (!showHelp) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
                setShowHelp(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showHelp]);

    // Filter buffs: only show if IsDefaultActive or IsEditable is true (or if it's not explicitly false)
    // The requirement says: "IsDefaultActive and IsEditable为false的参数不显示"
    // So we filter out buffs where IsDefaultActive === false AND IsEditable === false
    const visibleBuffs = buffs.filter(buff => !(buff.IsDefaultActive === false && buff.IsEditable === false));

    const formatBuffEffect = (buff: any, value: number) => {
        const effects: string[] = [];
        const buffEffects = buff.BuffEffects || {};

        // Use the dynamic value for the effect description
        if (buffEffects.BuffFocusPercentEffect) {
            effects.push(`专注 +${value}`);
        }
        if (buffEffects.BuffHolyWrathPercentEffect) {
            effects.push(`巫咒 +${value}%`);
        }
        if (buffEffects.BuffMonsterCriticalDamagePercentEffect) {
            effects.push(`对怪暴伤 +${value}`);
        }
        if (buffEffects.BuffMonsterHarmedPercentEffect) {
            effects.push(`易伤 +${value}%`);
        }
        if (buffEffects.BuffAttackPercentEffect) {
            effects.push(`攻击 +${value}%`);
        }

        return effects.length > 0 ? effects.join(', ') : buff.BuffName;
    };
    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>, buffId: string) => {
        if (e.target.value === '') {
            updateBuffValue(buffId, 0);
            return;
        }
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            updateBuffValue(buffId, val);
        }
    };

    return (
        <div>
            <h2 className="text-sm font-bold text-slate-100 mb-2 flex items-center gap-2 relative">
                <span className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full"></span>
                战斗增益状态
                <div
                    className={clsx(
                        "ml-0.5 p-1 cursor-pointer transition-all rounded-full flex items-center justify-center",
                        showHelp
                            ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/50"
                            : "text-cyan-500/80 hover:text-cyan-300 hover:bg-cyan-500/10"
                    )}
                    title="点击查看团队战斗增益极值参考"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowHelp((prev) => !prev);
                    }}
                >
                    <Info className="w-3.5 h-3.5" />
                </div>

                {/* 原地轻量参考气泡弹窗（向上弹出，彻底根除底部溢出滚动条） */}
                {showHelp && (
                    <div
                        ref={helpRef}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-0 bottom-full mb-2 z-40 w-[310px] sm:w-[360px] p-3 rounded-xl bg-[#0b111e]/98 border border-cyan-500/40 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 text-slate-200"
                    >
                        <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                            <div className="flex items-center gap-1.5 font-bold text-xs text-cyan-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>团队战斗增益上限与参考基准</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowHelp(false)}
                                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                aria-label="关闭提示"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="space-y-1.5 text-xs">
                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-bold text-cyan-300">易伤上限 (逆水寒等)</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        多职业易伤叠加，团队增伤核心放大器。
                                    </p>
                                </div>
                                <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                                    +120%
                                </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-bold text-emerald-300">绿点上限 (弱化减暴伤)</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        主流职业如鬼王/英招，大幅提升主C输出。
                                    </p>
                                </div>
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                    +900
                                </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-bold text-purple-300">巫咒上限 (昭冥专属)</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        昭冥专属独立乘区增伤，爆发必备 Buff。
                                    </p>
                                </div>
                                <span className="font-mono font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20 shrink-0">
                                    22.5%
                                </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 flex items-start justify-between gap-2">
                                <div>
                                    <span className="font-bold text-amber-300">专注增伤 (团队配合)</span>
                                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                        组队效果显著，三碗固定提供 +20。
                                    </p>
                                </div>
                                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                                    无上限
                                </span>
                            </div>
                        </div>

                        {/* 小三角箭头指向下方的 (i) 图标 */}
                        <div className="absolute -bottom-1.5 left-7 w-3 h-3 bg-[#0b111e] border-b border-r border-cyan-500/40 rotate-45 pointer-events-none" />
                    </div>
                )}
            </h2>

            <div className="calc-attr-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
                {visibleBuffs.map((buff) => {
                    const isActive = activeBuffIds.includes(buff.BuffID);
                    const currentValue = buffValues[buff.BuffID] ?? buff.DefaultEffectValue ?? 0;

                    const defaults = { min: 0, max: 500, step: 1 };
                    const overrides = {
                        'BUFF_FOCUS_EFFECT': { max: 400 },
                        'BUFF_HOLYWRATH_EFFECT': { max: 22.5, step: 0.1 },
                        'BUFF_MON_CRITDAMAGE_EFFECT': { max: 900 },
                        'BUFF_MON_HARMED_EFFECT': { max: 120 }
                    }[buff.BuffID] || {};

                    const config = { ...defaults, ...overrides };

                    return (
                        <div
                            key={buff.BuffID}
                            onClick={() => toggleBuff(buff.BuffID)}
                            className={clsx(
                                'glass-panel h-[110px] p-3.5 flex flex-col justify-between transition-all duration-300 hover:border-cyan-500/50 cursor-pointer group relative',
                                isActive
                                    ? 'border-cyan-500/60 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.12)]'
                                    : 'border-slate-800 opacity-60 hover:opacity-90'
                            )}
                        >
                            {/* Header: Name & Status Dot */}
                            <div className="flex items-center justify-between text-xs font-bold mb-0.5">
                                <span className={clsx("truncate", isActive ? "text-cyan-300" : "text-slate-400")}>
                                    {buff.BuffName}
                                </span>
                                <span className={clsx(
                                    "w-2 h-2 rounded-full transition-all shrink-0",
                                    isActive ? "bg-cyan-400 shadow-[0_0_6px_#06b6d4]" : "bg-slate-600"
                                )} />
                            </div>

                            {/* Content: Value + Slider (Editable) OR Text (Fixed) */}
                            {buff.IsEditable ? (
                                <>
                                    <input
                                        type="number"
                                        value={currentValue}
                                        onChange={(e) => handleValueChange(e, buff.BuffID)}
                                        onClick={(e) => e.stopPropagation()}
                                        min={config.min}
                                        max={config.max}
                                        step={config.step}
                                        className={clsx(
                                            "w-full bg-transparent text-center font-black text-xl focus:outline-none font-mono py-1",
                                            isActive ? "text-white focus:text-cyan-400" : "text-slate-500"
                                        )}
                                        disabled={!isActive}
                                    />
                                    <input
                                        type="range"
                                        min={config.min}
                                        max={config.max}
                                        step={config.step}
                                        value={currentValue}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            updateBuffValue(buff.BuffID, parseFloat(e.target.value));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={clsx(
                                            "w-full h-1 appearance-none bg-transparent cursor-pointer focus:outline-none mb-0.5",
                                            "[&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:bg-slate-700/80 [&::-webkit-slider-runnable-track]:rounded-full",
                                            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125",
                                            isActive ? "[&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(6,182,212,0.6)]" : "[&::-webkit-slider-thumb]:bg-slate-600"
                                        )}
                                        disabled={!isActive}
                                    />
                                </>
                            ) : (
                                <p className={clsx(
                                    "text-xs font-bold text-center leading-relaxed transition-colors py-1 truncate",
                                    isActive ? "text-cyan-100/80" : "text-slate-500"
                                )}>
                                    {formatBuffEffect(buff, currentValue)}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

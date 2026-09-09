import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Info } from 'lucide-react';
import clsx from 'clsx';

export const BuffSelector: React.FC<{ onNavigateToFocus?: () => void }> = ({ onNavigateToFocus }) => {
    const { buffs, activeBuffIds, toggleBuff, buffValues, updateBuffValue } = useApp();

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
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
                战斗增益
                <div
                    className="ml-0.5 p-1 text-cyan-500/80 hover:text-cyan-400 cursor-pointer transition-colors hover:bg-cyan-500/10 rounded-full"
                    title="点击跳转「资料图鉴 / 各职业状态」查看专注值参考"
                    onClick={() => onNavigateToFocus?.()}
                >
                    <Info className="w-5 h-5" />
                </div>
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                                'glass-panel p-4 h-[124px] justify-center transition-all duration-300 hover:border-cyan-500/50 cursor-pointer group relative flex flex-col gap-3 items-center',
                                isActive
                                    ? 'border-cyan-500/70 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                                    : 'border-slate-700 hover:bg-slate-800/50'
                            )}
                        >

                            {/* Header: Icon & Name */}
                            <div className="flex items-center justify-center gap-3 relative z-10 w-full">
                                <div className={clsx(
                                    'p-2 rounded-lg transition-all shrink-0',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-400 scale-110'
                                        : 'bg-slate-800/50 text-slate-400 group-hover:bg-slate-700/50'
                                )}>
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <span className={clsx(
                                    'text-sm font-bold tracking-wide whitespace-nowrap',
                                    isActive ? 'text-cyan-300' : 'text-slate-300'
                                )}>
                                    {buff.BuffName}
                                </span>
                            </div>

                            {/* Content: Value + Slider (Editable) OR Text (Fixed) */}
                            <div className="w-full relative z-10 flex flex-col gap-2 items-center justify-center flex-grow">
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
                                                "bg-transparent text-xl font-black text-center w-full focus:outline-none transition-colors py-1",
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
                                                e.stopPropagation(); // Prevent card toggle
                                                updateBuffValue(buff.BuffID, parseFloat(e.target.value));
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className={clsx(
                                                "w-full h-1.5 appearance-none bg-transparent cursor-pointer focus:outline-none",
                                                // Track styling
                                                "[&::-webkit-slider-runnable-track]:w-full [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-runnable-track]:rounded-full",
                                                // Thumb styling
                                                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
                                                isActive ? "[&::-webkit-slider-thumb]:bg-cyan-400" : "[&::-webkit-slider-thumb]:bg-slate-600"
                                            )}
                                            disabled={!isActive}
                                        />
                                    </>
                                ) : (
                                    <p className={clsx(
                                        "text-xl font-black text-center leading-relaxed transition-colors py-1",
                                        isActive ? "text-cyan-100/80" : "text-slate-500"
                                    )}>
                                        {formatBuffEffect(buff, currentValue)}
                                    </p>
                                )}
                            </div>


                        </div>
                    );
                })}
            </div>
        </div>
    );
};

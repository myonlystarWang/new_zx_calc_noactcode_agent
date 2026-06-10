import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Info } from 'lucide-react';
import clsx from 'clsx';

export const BuffSelector: React.FC = () => {
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

    const [showFocusInfo, setShowFocusInfo] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState<'general' | 'support' | 'dps'>('support');

    const focusData = {
        general: [
            { name: '三碗专注', val: '20', note: '', total: 20 }
        ],
        support: [
            { name: '天音', val: '18 + 2', note: '法宝技能+1', total: 20 },
            { name: '天华', val: '(40+2) + (18+2)', note: '均为法宝技能+1', total: 62 },
            { name: '焚香', val: '30', note: '', total: 30 },
            { name: '画影', val: '24 + 3 + X', note: '法宝技能+1，每40万真气X+1', total: '27+' },
            { name: '昭冥', val: '52.5 + 7.5', note: '需132万真气以上', total: 60 },
        ],
        dps: [
            { name: '逐霜', val: '79 / 49', note: '仙 / 魔佛', total: '79/49' },
            { name: '归云', val: '90 / 30', note: '魔 / 仙佛', total: '90/30' },
            { name: '青云', val: '50 / 30', note: '仙 / 魔佛', total: '50/30' },
            { name: '涅羽', val: '70 + X', note: '每10万真气X+1', total: '70+' },
        ]
    };

    return (
        <div>
            <h2 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
                战斗增益
                <div
                    className="ml-0.5 p-1 text-cyan-500/80 hover:text-cyan-400 cursor-pointer transition-colors hover:bg-cyan-500/10 rounded-full"
                    onClick={() => setShowFocusInfo(true)}
                    title="查看数值参考"
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

            {/* Focus Info Modal */}
            {showFocusInfo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
                    onClick={() => setShowFocusInfo(false)}
                >
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col max-h-[80vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between shrink-0">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                                    <Info className="w-5 h-5" />
                                </div>
                                专注值参考
                            </h3>
                            <button
                                onClick={() => setShowFocusInfo(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                            >
                                <span className="sr-only">Close</span>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="p-2 bg-slate-900/50 border-b border-slate-800 flex gap-1 shrink-0">
                            {[
                                { id: 'support', label: '辅助职业' },
                                { id: 'dps', label: '输出职业' },
                                { id: 'general', label: '通用' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={clsx(
                                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                                        activeTab === tab.id
                                            ? "bg-slate-800 text-cyan-400 shadow-sm border border-slate-700"
                                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="p-4 overflow-y-auto custom-scrollbar">
                            <div className="space-y-3">
                                {focusData[activeTab].map((item, idx) => (
                                    <div key={idx} className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 hover:border-cyan-500/30 transition-colors group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base font-bold text-slate-200 group-hover:text-cyan-100 transition-colors">
                                                    {item.name}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xl font-black text-cyan-400 leading-none">
                                                    {item.total}
                                                </span>
                                                <span className="text-[10px] text-cyan-500/60 font-medium mt-0.5 uppercase tracking-wider">Total</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-800/50 flex justify-between items-center">
                                            <span className="text-xs text-slate-500 font-medium truncate mr-2" title={item.note}>
                                                {item.note || '基础数值'}
                                            </span>
                                            <span className="font-mono text-sm text-slate-300 font-semibold whitespace-nowrap">
                                                {item.val}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-800 bg-slate-800/30 shrink-0">
                            <button
                                onClick={() => setShowFocusInfo(false)}
                                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-900/20 transition-all active:scale-[0.98]"
                            >
                                明白
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

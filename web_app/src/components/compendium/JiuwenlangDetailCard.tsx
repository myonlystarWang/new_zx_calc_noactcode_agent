import React, { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

export interface JiuwenlangLevelData {
    level: number;
    hp: number;
    mp: number;
    skillAccuracy: number;
    skillDodge: number;
    critReduction: number;
    critDamageReduction: number;
    resistImmortal: number;
    resistBuddha: number;
    resistDemon: number;
    damageReduction: number;
}

export interface JiuwenlangData {
    systemName?: string;
    category?: string;
    source?: string;
    maxLevel?: number;
    description?: string;
    levels?: JiuwenlangLevelData[];
}

export interface JiuwenlangDetailCardProps {
    cardData?: {
        data?: JiuwenlangData;
        initialLevel?: number;
    };
    className?: string;
}

const DEFAULT_LEVELS: JiuwenlangLevelData[] = [
    { level: 1, hp: 12000, mp: 12000, skillAccuracy: 5.0, skillDodge: 5.0, critReduction: 1.0, critDamageReduction: 5.0, resistImmortal: 1.0, resistBuddha: 1.0, resistDemon: 1.0, damageReduction: 1.0 },
    { level: 2, hp: 12600, mp: 12600, skillAccuracy: 5.5, skillDodge: 5.5, critReduction: 1.2, critDamageReduction: 6.0, resistImmortal: 1.2, resistBuddha: 1.2, resistDemon: 1.2, damageReduction: 1.2 },
    { level: 3, hp: 13200, mp: 13200, skillAccuracy: 6.0, skillDodge: 6.0, critReduction: 1.4, critDamageReduction: 7.0, resistImmortal: 1.4, resistBuddha: 1.4, resistDemon: 1.4, damageReduction: 1.4 },
    { level: 4, hp: 13800, mp: 13800, skillAccuracy: 6.5, skillDodge: 6.5, critReduction: 1.6, critDamageReduction: 8.0, resistImmortal: 1.6, resistBuddha: 1.6, resistDemon: 1.6, damageReduction: 1.6 },
    { level: 5, hp: 14400, mp: 14400, skillAccuracy: 7.0, skillDodge: 7.0, critReduction: 1.8, critDamageReduction: 9.0, resistImmortal: 1.8, resistBuddha: 1.8, resistDemon: 1.8, damageReduction: 1.8 },
    { level: 6, hp: 15000, mp: 15000, skillAccuracy: 7.5, skillDodge: 7.5, critReduction: 2.0, critDamageReduction: 10.0, resistImmortal: 2.0, resistBuddha: 2.0, resistDemon: 2.0, damageReduction: 2.0 },
    { level: 7, hp: 15600, mp: 15600, skillAccuracy: 8.0, skillDodge: 8.0, critReduction: 2.2, critDamageReduction: 11.0, resistImmortal: 2.2, resistBuddha: 2.2, resistDemon: 2.2, damageReduction: 2.2 },
    { level: 8, hp: 16200, mp: 16200, skillAccuracy: 8.5, skillDodge: 8.5, critReduction: 2.4, critDamageReduction: 12.0, resistImmortal: 2.4, resistBuddha: 2.4, resistDemon: 2.4, damageReduction: 2.4 },
    { level: 9, hp: 16800, mp: 16800, skillAccuracy: 9.0, skillDodge: 9.0, critReduction: 2.6, critDamageReduction: 13.0, resistImmortal: 2.6, resistBuddha: 2.6, resistDemon: 2.6, damageReduction: 2.6 },
    { level: 10, hp: 17400, mp: 17400, skillAccuracy: 9.5, skillDodge: 9.5, critReduction: 2.8, critDamageReduction: 14.0, resistImmortal: 2.8, resistBuddha: 2.8, resistDemon: 2.8, damageReduction: 2.8 },
    { level: 11, hp: 18000, mp: 18000, skillAccuracy: 10.0, skillDodge: 10.0, critReduction: 3.0, critDamageReduction: 15.0, resistImmortal: 3.0, resistBuddha: 3.0, resistDemon: 3.0, damageReduction: 3.0 },
    { level: 12, hp: 18600, mp: 18600, skillAccuracy: 10.5, skillDodge: 10.5, critReduction: 3.2, critDamageReduction: 16.0, resistImmortal: 3.2, resistBuddha: 3.2, resistDemon: 3.2, damageReduction: 3.2 },
    { level: 13, hp: 19200, mp: 19200, skillAccuracy: 11.0, skillDodge: 11.0, critReduction: 3.4, critDamageReduction: 17.0, resistImmortal: 3.4, resistBuddha: 3.4, resistDemon: 3.4, damageReduction: 3.4 },
    { level: 14, hp: 19800, mp: 19800, skillAccuracy: 11.5, skillDodge: 11.5, critReduction: 3.6, critDamageReduction: 18.0, resistImmortal: 3.6, resistBuddha: 3.6, resistDemon: 3.6, damageReduction: 3.6 },
    { level: 15, hp: 20400, mp: 20400, skillAccuracy: 12.0, skillDodge: 12.0, critReduction: 3.8, critDamageReduction: 19.0, resistImmortal: 3.8, resistBuddha: 3.8, resistDemon: 3.8, damageReduction: 3.8 },
    { level: 16, hp: 21000, mp: 21000, skillAccuracy: 12.5, skillDodge: 12.5, critReduction: 4.0, critDamageReduction: 20.0, resistImmortal: 4.0, resistBuddha: 4.0, resistDemon: 4.0, damageReduction: 4.0 },
    { level: 17, hp: 21600, mp: 21600, skillAccuracy: 13.0, skillDodge: 13.0, critReduction: 4.2, critDamageReduction: 21.0, resistImmortal: 4.2, resistBuddha: 4.2, resistDemon: 4.2, damageReduction: 4.2 },
    { level: 18, hp: 22200, mp: 22200, skillAccuracy: 13.5, skillDodge: 13.5, critReduction: 4.4, critDamageReduction: 22.0, resistImmortal: 4.4, resistBuddha: 4.4, resistDemon: 4.4, damageReduction: 4.4 },
    { level: 19, hp: 22800, mp: 22800, skillAccuracy: 14.0, skillDodge: 14.0, critReduction: 4.6, critDamageReduction: 23.0, resistImmortal: 4.6, resistBuddha: 4.6, resistDemon: 4.6, damageReduction: 4.6 },
    { level: 20, hp: 24000, mp: 24000, skillAccuracy: 15.0, skillDodge: 15.0, critReduction: 5.0, critDamageReduction: 25.0, resistImmortal: 5.0, resistBuddha: 5.0, resistDemon: 5.0, damageReduction: 5.0 },
];

export const JiuwenlangDetailCard: React.FC<JiuwenlangDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const levels = data?.levels || DEFAULT_LEVELS;

    const [currentLevel, setCurrentLevel] = useState<number>(() => {
        return cardData?.initialLevel && cardData.initialLevel >= 1 && cardData.initialLevel <= 20
            ? cardData.initialLevel
            : 20;
    });

    const [showCalc, setShowCalc] = useState(false);
    const [calcStartLevel, setCalcStartLevel] = useState<number>(1);
    const [calcTargetLevel, setCalcTargetLevel] = useState<number>(20);
    const [showFullTable, setShowFullTable] = useState(false);

    const activeItem = useMemo(() => {
        return levels.find((l) => l.level === currentLevel) || levels[levels.length - 1];
    }, [levels, currentLevel]);

    const deltaResult = useMemo(() => {
        const startItem = levels.find((l) => l.level === calcStartLevel) || levels[0];
        const targetItem = levels.find((l) => l.level === calcTargetLevel) || levels[levels.length - 1];

        return {
            hp: targetItem.hp - startItem.hp,
            mp: targetItem.mp - startItem.mp,
            skillAccuracy: +(targetItem.skillAccuracy - startItem.skillAccuracy).toFixed(1),
            skillDodge: +(targetItem.skillDodge - startItem.skillDodge).toFixed(1),
            critReduction: +(targetItem.critReduction - startItem.critReduction).toFixed(1),
            critDamageReduction: +(targetItem.critDamageReduction - startItem.critDamageReduction).toFixed(1),
            resistImmortal: +(targetItem.resistImmortal - startItem.resistImmortal).toFixed(1),
            resistBuddha: +(targetItem.resistBuddha - startItem.resistBuddha).toFixed(1),
            resistDemon: +(targetItem.resistDemon - startItem.resistDemon).toFixed(1),
            damageReduction: +(targetItem.damageReduction - startItem.damageReduction).toFixed(1),
        };
    }, [levels, calcStartLevel, calcTargetLevel]);

    return (
        <div className={`w-full max-w-xl bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 text-xs font-sans shadow-xl select-none ${className || ''}`}>
            {/* 头部标题与徽标 */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f43f5e] shadow-[0_0_8px_#f43f5e]"></span>
                    <span className="text-[13px] font-bold text-white tracking-wide">
                        {data?.systemName || '佩章·九纹琅'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fda4af]">
                        佩章核心附魔
                    </span>
                    <span className="text-[11px] text-[#94a3b8]">
                        Lv.{activeItem.level}/20
                    </span>
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e293b]/70 hover:bg-[#334155] text-[#38bdf8] text-[11px] transition-colors border border-[#38bdf8]/20"
                >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showCalc ? '收起测算' : '等级测算'}</span>
                </button>
            </div>

            {/* 等级步进与预设档位 */}
            <div className="bg-[#0f172a]/70 rounded border border-[#1e293b]/80 p-2 mb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[#94a3b8]">等级切换：</span>
                    <div className="flex items-center gap-1">
                        {[1, 5, 10, 15, 20].map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setCurrentLevel(lvl)}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                                    currentLevel === lvl
                                        ? 'bg-[#f43f5e] text-white font-semibold shadow-[0_0_6px_#f43f5e]'
                                        : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'
                                }`}
                            >
                                {lvl === 20 ? '满级(20)' : `${lvl}级`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="1"
                        max="20"
                        step="1"
                        value={currentLevel}
                        onChange={(e) => setCurrentLevel(Number(e.target.value))}
                        className="w-full accent-[#f43f5e] h-1.5 bg-[#1e293b] rounded cursor-pointer"
                    />
                    <span className="w-8 text-right font-mono font-bold text-white text-[12px]">
                        +{currentLevel}
                    </span>
                </div>
            </div>

            {/* 当前等级属性卡片（仿游戏高保真原生面板） */}
            <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                <div className="bg-[#131b2e]/60 border border-[#1e293b] rounded p-2 flex flex-col justify-between">
                    <span className="text-[11px] text-[#94a3b8]">基础气血/真气</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[#38bdf8]">气血</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.hp.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#38bdf8]">真气</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.mp.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#131b2e]/60 border border-[#1e293b] rounded p-2 flex flex-col justify-between">
                    <span className="text-[11px] text-[#94a3b8]">战斗敏捷</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[#34d399]">技能命中</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.skillAccuracy}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#34d399]">技能躲闪</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.skillDodge}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#131b2e]/60 border border-[#1e293b] rounded p-2 flex flex-col justify-between">
                    <span className="text-[11px] text-[#94a3b8]">防暴击特化</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[#fbbf24]">减暴击</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.critReduction}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#fbbf24]">减爆伤</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.critDamageReduction}%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-[#131b2e]/60 border border-[#1e293b] rounded p-2 flex flex-col justify-between">
                    <span className="text-[11px] text-[#94a3b8]">减免与阵营御性</span>
                    <div className="mt-1 flex flex-col gap-0.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[#c084fc]">减免伤害</span>
                            <span className="font-mono text-white font-semibold">+{activeItem.damageReduction}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[#c084fc]">御仙/佛/魔</span>
                            <span className="font-mono text-white font-semibold">各 +{activeItem.resistImmortal}%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 自定义等级测算器面板 */}
            {showCalc && (
                <div className="bg-[#111827] border border-[#f43f5e]/30 rounded p-2.5 mb-2.5">
                    <div className="flex items-center gap-1.5 text-[#fda4af] font-bold text-[11px] mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>等级进阶差额测算</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-[11px]">
                        <span className="text-[#94a3b8]">起始：</span>
                        <select
                            value={calcStartLevel}
                            onChange={(e) => setCalcStartLevel(Number(e.target.value))}
                            className="bg-[#1e293b] border border-[#334155] text-white rounded px-1.5 py-0.5 text-[11px]"
                        >
                            {levels.map((l) => (
                                <option key={l.level} value={l.level}>
                                    Lv.{l.level}
                                </option>
                            ))}
                        </select>
                        <span className="text-[#94a3b8]">至 目标：</span>
                        <select
                            value={calcTargetLevel}
                            onChange={(e) => setCalcTargetLevel(Number(e.target.value))}
                            className="bg-[#1e293b] border border-[#334155] text-white rounded px-1.5 py-0.5 text-[11px]"
                        >
                            {levels.map((l) => (
                                <option key={l.level} value={l.level}>
                                    Lv.{l.level}
                                </option>
                            ))}
                        </select>
                    </div>

                    {calcTargetLevel > calcStartLevel ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 bg-[#0b0f19] p-2 rounded border border-[#1e293b] text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-[#94a3b8]">净增气血/真气：</span>
                                <span className="text-[#38bdf8] font-mono font-bold">+{deltaResult.hp.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#94a3b8]">净增命中/躲闪：</span>
                                <span className="text-[#34d399] font-mono font-bold">+{deltaResult.skillAccuracy}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#94a3b8]">净增减暴/减爆伤：</span>
                                <span className="text-[#fbbf24] font-mono font-bold">+{deltaResult.critReduction}% / +{deltaResult.critDamageReduction}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#94a3b8]">净增减免/御性：</span>
                                <span className="text-[#c084fc] font-mono font-bold">各 +{deltaResult.damageReduction}%</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[#f43f5e] text-[11px] py-1">目标等级需高于起始等级</div>
                    )}
                </div>
            )}

            {/* 折叠展开 1~20 全量对照表 */}
            <div className="border-t border-[#1e293b] pt-2">
                <button
                    onClick={() => setShowFullTable(!showFullTable)}
                    className="w-full flex items-center justify-between text-[#94a3b8] hover:text-white py-1 text-[11px] transition-colors"
                >
                    <span>1~20 级全量对照表</span>
                    {showFullTable ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showFullTable && (
                    <div className="mt-2 overflow-x-auto max-h-[240px] overflow-y-auto border border-[#1e293b] rounded">
                        <table className="w-full text-left text-[10px] min-w-[500px]">
                            <thead className="bg-[#1e293b] text-[#94a3b8] sticky top-0">
                                <tr>
                                    <th className="p-1 text-center">等级</th>
                                    <th className="p-1">气血/真气</th>
                                    <th className="p-1">命中/躲闪</th>
                                    <th className="p-1">减暴</th>
                                    <th className="p-1">减爆伤</th>
                                    <th className="p-1">御三阵营</th>
                                    <th className="p-1">减免伤害</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e293b]/50 font-mono">
                                {levels.map((item) => {
                                    const isHighlight = item.level === 20;
                                    const isSelected = item.level === currentLevel;
                                    return (
                                        <tr
                                            key={item.level}
                                            onClick={() => setCurrentLevel(item.level)}
                                            className={`cursor-pointer transition-colors ${
                                                isSelected
                                                    ? 'bg-[#f43f5e]/20 text-white font-bold'
                                                    : isHighlight
                                                    ? 'bg-[#fda4af]/10 text-[#fda4af] font-semibold'
                                                    : 'hover:bg-[#1e293b]/40 text-[#cbd5e1]'
                                            }`}
                                        >
                                            <td className="p-1 text-center font-bold">
                                                {item.level === 20 ? 'Lv.20★' : `Lv.${item.level}`}
                                            </td>
                                            <td className="p-1">{item.hp}</td>
                                            <td className="p-1">{item.skillAccuracy}</td>
                                            <td className="p-1">{item.critReduction}%</td>
                                            <td className="p-1">{item.critDamageReduction}%</td>
                                            <td className="p-1">各 {item.resistImmortal}%</td>
                                            <td className="p-1">{item.damageReduction}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="mt-2 pt-1.5 border-t border-[#1e293b]/60 flex items-center justify-between text-[10px] text-[#64748b]">
                <span>数据来源：完美世界官方游戏内线上实机对照</span>
                <span>满级气血/真气 +24000</span>
            </div>
        </div>
    );
};

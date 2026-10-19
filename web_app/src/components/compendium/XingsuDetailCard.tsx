import React, { useState, useMemo } from 'react';
import { Sparkles, Calculator, Star, ShieldAlert } from 'lucide-react';

export interface XingsuAttr {
    name: string;
    minBase: number;
    maxBase: number;
    unit: string;
    gains: number[]; // 1->2, 2->3, 3->4, 4->5
    probability: string;
}

export interface XingsuStarType {
    typeId: string;
    name: string;
    slot: string;
    ruleDesc: string;
    mainAttrs: XingsuAttr[];
    subAttrs: XingsuAttr[];
}

export interface XingsuData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    rules?: string[];
    stars?: XingsuStarType[];
}

export interface XingsuDetailCardProps {
    cardData?: {
        data?: XingsuData;
        initialTypeId?: string;
        initialRank?: number;
    };
    className?: string;
}

export const XingsuDetailCard: React.FC<XingsuDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const stars = data?.stars || [];

    const [activeTypeId, setActiveTypeId] = useState<string>(() => {
        return cardData?.initialTypeId || (stars[2]?.typeId ?? 'chonghua');
    });

    const [rank, setRank] = useState<number>(() => {
        return cardData?.initialRank && cardData.initialRank >= 1 && cardData.initialRank <= 5
            ? cardData.initialRank
            : 5;
    });

    const [showCalc, setShowCalc] = useState(false);
    const [calcAttrName, setCalcAttrName] = useState<string>('');

    const activeStar = useMemo(() => {
        return stars.find((s) => s.typeId === activeTypeId) || stars[0];
    }, [stars, activeTypeId]);

    // 计算指定等级下的属性累加值
    const getAccumulatedGain = (gains: number[], targetRank: number) => {
        if (targetRank <= 1) return 0;
        let sum = 0;
        for (let i = 0; i < targetRank - 1 && i < gains.length; i++) {
            sum += gains[i];
        }
        return sum;
    };

    const computedMainAttrs = useMemo(() => {
        if (!activeStar) return [];
        return activeStar.mainAttrs.map((attr) => {
            const added = getAccumulatedGain(attr.gains, rank);
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            return {
                ...attr,
                currentMin,
                currentMax,
            };
        });
    }, [activeStar, rank]);

    const computedSubAttrs = useMemo(() => {
        if (!activeStar) return [];
        return activeStar.subAttrs.map((attr) => {
            const added = getAccumulatedGain(attr.gains, rank);
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            return {
                ...attr,
                currentMin,
                currentMax,
            };
        });
    }, [activeStar, rank]);

    // 测算器属性选择
    const allAvailableAttrs = useMemo(() => {
        if (!activeStar) return [];
        return [...activeStar.mainAttrs, ...activeStar.subAttrs];
    }, [activeStar]);

    const selectedAttrForCalc = useMemo(() => {
        if (!allAvailableAttrs.length) return null;
        return allAvailableAttrs.find((a) => a.name === calcAttrName) || allAvailableAttrs[0];
    }, [allAvailableAttrs, calcAttrName]);

    const calcGain1To5 = useMemo(() => {
        if (!selectedAttrForCalc) return 0;
        return +selectedAttrForCalc.gains.reduce((a, b) => a + b, 0).toFixed(2);
    }, [selectedAttrForCalc]);

    if (!activeStar) return null;

    return (
        <div className={`w-full max-w-xl bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 text-xs font-sans shadow-xl select-none ${className || ''}`}>
            {/* 头部标题与徽标 */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#a855f7] shadow-[0_0_8px_#a855f7]"></span>
                    <span className="text-[13px] font-bold text-white tracking-wide">
                        {data?.systemName || '星辰属性及升星增益'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#a855f7]/15 border border-[#a855f7]/30 text-[#d8b4fe]">
                        星宿系统
                    </span>
                    <span className="text-[11px] text-[#94a3b8]">
                        {rank}星 ({activeStar.slot})
                    </span>
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e293b]/70 hover:bg-[#334155] text-[#38bdf8] text-[11px] transition-colors border border-[#38bdf8]/20"
                >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showCalc ? '收起测算' : '升星测算'}</span>
                </button>
            </div>

            {/* 星辰类型切换胶囊 */}
            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                {stars.map((s) => {
                    const isActive = s.typeId === activeTypeId;
                    return (
                        <button
                            key={s.typeId}
                            onClick={() => {
                                setActiveTypeId(s.typeId);
                                setCalcAttrName('');
                            }}
                            className={`px-2 py-1.5 rounded text-center transition-all ${
                                isActive
                                    ? 'bg-[#a855f7] text-white font-bold shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                                    : 'bg-[#1e293b]/70 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                            }`}
                        >
                            <div className="text-[11px] font-semibold">{s.name}</div>
                            <div className="text-[9px] opacity-75">{s.slot}</div>
                        </button>
                    );
                })}
            </div>

            {/* 规则说明条 */}
            <div className="bg-[#131b2e]/60 rounded border border-[#1e293b] px-2.5 py-1.5 mb-2.5 flex items-center justify-between text-[11px]">
                <span className="text-[#cbd5e1] font-medium">{activeStar.ruleDesc}</span>
                <span className="text-[#a855f7] font-mono text-[10px]">{activeStar.slot}</span>
            </div>

            {/* 星等步进器 (1星~5星) */}
            <div className="bg-[#0f172a]/70 rounded border border-[#1e293b]/80 p-2 mb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[#94a3b8]">星辰星等：</span>
                    <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((r) => (
                            <button
                                key={r}
                                onClick={() => setRank(r)}
                                className={`px-2 py-0.5 rounded text-[10px] flex items-center gap-0.5 transition-colors ${
                                    rank === r
                                        ? 'bg-[#a855f7] text-white font-bold shadow-[0_0_6px_#a855f7]'
                                        : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'
                                }`}
                            >
                                <Star className="w-2.5 h-2.5 fill-current" />
                                <span>{r}星</span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={rank}
                        onChange={(e) => setRank(Number(e.target.value))}
                        className="w-full accent-[#a855f7] h-1.5 bg-[#1e293b] rounded cursor-pointer"
                    />
                    <span className="w-10 text-right font-mono font-bold text-white text-[12px]">
                        {rank}星
                    </span>
                </div>
            </div>

            {/* 升星测算器 */}
            {showCalc && selectedAttrForCalc && (
                <div className="bg-[#111827] border border-[#a855f7]/30 rounded p-2.5 mb-2.5">
                    <div className="flex items-center gap-1.5 text-[#d8b4fe] font-bold text-[11px] mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>星辰 1星升至5星 满额成长测算</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2 text-[11px]">
                        <span className="text-[#94a3b8]">选择词条：</span>
                        <select
                            value={selectedAttrForCalc.name}
                            onChange={(e) => setCalcAttrName(e.target.value)}
                            className="bg-[#1e293b] border border-[#334155] text-white rounded px-1.5 py-0.5 text-[11px]"
                        >
                            {allAvailableAttrs.map((a) => (
                                <option key={a.name} value={a.name}>
                                    {a.name} ({a.probability})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b] flex items-center justify-between text-[11px]">
                        <span className="text-[#cbd5e1]">
                            [{selectedAttrForCalc.name}] 1星升至5星累计纯增益：
                        </span>
                        <span className="font-mono font-bold text-[#f59e0b] text-[13px]">
                            +{calcGain1To5}{selectedAttrForCalc.unit}
                        </span>
                    </div>
                </div>
            )}

            {/* 主属性池表格 */}
            <div className="border border-[#1e293b] rounded overflow-hidden mb-2">
                <div className="bg-[#1e293b]/80 px-2 py-1 text-[11px] font-bold text-[#e2e8f0] flex items-center justify-between">
                    <span>主属性候选池 ({computedMainAttrs.length} 项)</span>
                    <span className="text-[10px] text-[#94a3b8]">当前 {rank} 星数值区间</span>
                </div>
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#0f172a] text-[#94a3b8]">
                        <tr>
                            <th className="p-1.5">属性名称</th>
                            <th className="p-1.5 font-mono">{rank}星区间</th>
                            <th className="p-1.5">下一星增益</th>
                            <th className="p-1.5 text-center">产生概率</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60 font-mono">
                        {computedMainAttrs.map((attr) => {
                            const nextGain = rank < 5 ? attr.gains[rank - 1] : null;
                            const isRare = attr.name.includes('无视') || attr.name.includes('百分比') || attr.name.includes('命中') || attr.name.includes('躲闪');
                            return (
                                <tr key={attr.name} className="hover:bg-[#131b2e]/40 transition-colors">
                                    <td className="p-1.5 font-sans font-medium">
                                        <span className={isRare ? 'text-[#38bdf8] font-bold' : 'text-white'}>
                                            {attr.name}
                                        </span>
                                    </td>
                                    <td className="p-1.5 text-[#f59e0b] font-semibold">
                                        {attr.currentMin}{attr.unit} - {attr.currentMax}{attr.unit}
                                    </td>
                                    <td className="p-1.5 text-[#34d399]">
                                        {nextGain !== null ? `+${nextGain}${attr.unit}` : '已满星'}
                                    </td>
                                    <td className="p-1.5 text-center text-[#94a3b8]">
                                        {attr.probability}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 副属性池表格 (荧惑 1副，重华 2副) */}
            {computedSubAttrs.length > 0 && (
                <div className="border border-[#1e293b] rounded overflow-hidden mb-2">
                    <div className="bg-[#1e293b]/80 px-2 py-1 text-[11px] font-bold text-[#e2e8f0] flex items-center justify-between">
                        <span>副属性候选池 ({computedSubAttrs.length} 项)</span>
                        <span className="text-[10px] text-[#94a3b8]">当前 {rank} 星数值区间</span>
                    </div>
                    <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#0f172a] text-[#94a3b8]">
                            <tr>
                                <th className="p-1.5">属性名称</th>
                                <th className="p-1.5 font-mono">{rank}星区间</th>
                                <th className="p-1.5">下一星增益</th>
                                <th className="p-1.5 text-center">产生概率</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]/60 font-mono">
                            {computedSubAttrs.map((attr) => {
                                const nextGain = rank < 5 ? attr.gains[rank - 1] : null;
                                const isRare = attr.name.includes('无视') || attr.name.includes('暴击') || attr.name.includes('爆伤') || attr.name.includes('减免');
                                return (
                                    <tr key={attr.name} className="hover:bg-[#131b2e]/40 transition-colors">
                                        <td className="p-1.5 font-sans font-medium">
                                            <span className={isRare ? 'text-[#c084fc] font-bold' : 'text-white'}>
                                                {attr.name}
                                            </span>
                                        </td>
                                        <td className="p-1.5 text-[#f59e0b] font-semibold">
                                            {attr.currentMin}{attr.unit} - {attr.currentMax}{attr.unit}
                                        </td>
                                        <td className="p-1.5 text-[#34d399]">
                                            {nextGain !== null ? `+${nextGain}${attr.unit}` : '已满星'}
                                        </td>
                                        <td className="p-1.5 text-center text-[#94a3b8]">
                                            {attr.probability}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 升星要点提示 */}
            <div className="bg-[#131b2e]/40 border border-[#1e293b] rounded p-2 text-[10px] text-[#94a3b8] flex flex-col gap-1">
                <div className="flex items-center gap-1 text-[#f59e0b]">
                    <ShieldAlert className="w-3 h-3" />
                    <span className="font-semibold">升星注意点：</span>
                </div>
                <div>1. 两个星辰主属性相同时进行升星，获得的经验加成更高。</div>
                <div>2. 星辰升星会消耗包裹金币，请保留足够金币。</div>
            </div>

            <div className="mt-2 pt-1.5 border-t border-[#1e293b]/60 flex items-center justify-between text-[10px] text-[#64748b]">
                <span>数据来源：诛仙3官方论坛攻略区·时空</span>
                <span>支持 1~5 星属性增益递推</span>
            </div>
        </div>
    );
};

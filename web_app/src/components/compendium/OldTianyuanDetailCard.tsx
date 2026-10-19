import React, { useState, useMemo } from 'react';
import { Sparkles, Calculator } from 'lucide-react';

export interface OldTianyuanAttr {
    name: string;
    minBase: number;
    maxBase: number;
    unit: string;
    perLevelGain: number;
    probability: string;
    note?: string;
}

export interface OldTianyuanPart {
    partId: string;
    partName: string;
    slot: string;
    countProbabilities: Array<{ count: number; probability: string }>;
    attributes: OldTianyuanAttr[];
}

export interface OldTianyuanData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    parts?: OldTianyuanPart[];
}

export interface OldTianyuanDetailCardProps {
    cardData?: {
        data?: OldTianyuanData;
        initialPartId?: string;
        initialLevel?: number;
    };
    className?: string;
}

export const OldTianyuanDetailCard: React.FC<OldTianyuanDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const parts = data?.parts || [];

    const [activePartId, setActivePartId] = useState<string>(() => {
        return cardData?.initialPartId || (parts[0]?.partId ?? 'weapon');
    });

    const [level, setLevel] = useState<number>(() => {
        return cardData?.initialLevel && cardData.initialLevel >= 1 && cardData.initialLevel <= 10
            ? cardData.initialLevel
            : 10;
    });

    const [showCalc, setShowCalc] = useState(false);
    const [calcAttrName, setCalcAttrName] = useState<string>('');
    const [calcCustomBase, setCalcCustomBase] = useState<number>(0);

    const activePart = useMemo(() => {
        return parts.find((p) => p.partId === activePartId) || parts[0];
    }, [parts, activePartId]);

    // 计算当前等级下各属性的取值范围
    const computedAttrs = useMemo(() => {
        if (!activePart) return [];
        return activePart.attributes.map((attr) => {
            const added = (level - 1) * attr.perLevelGain;
            const currentMin = +(attr.minBase + added).toFixed(2);
            const currentMax = +(attr.maxBase + added).toFixed(2);
            return {
                ...attr,
                currentMin,
                currentMax,
            };
        });
    }, [activePart, level]);

    // 默认测算属性设置
    const selectedAttrForCalc = useMemo(() => {
        if (!activePart) return null;
        return activePart.attributes.find((a) => a.name === calcAttrName) || activePart.attributes[0];
    }, [activePart, calcAttrName]);

    const calcResultAt10 = useMemo(() => {
        if (!selectedAttrForCalc) return null;
        const baseVal = calcCustomBase || selectedAttrForCalc.maxBase;
        const gainTo10 = (10 - 1) * selectedAttrForCalc.perLevelGain;
        return +(baseVal + gainTo10).toFixed(2);
    }, [selectedAttrForCalc, calcCustomBase]);

    if (!activePart) return null;

    return (
        <div className={`w-full max-w-[560px] bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 text-xs font-sans shadow-xl select-none ${className || ''}`}>
            {/* 头部标题与徽标 */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8]"></span>
                    <span className="text-[13px] font-bold text-white tracking-wide">
                        {data?.systemName || '旧天缘属性全览'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#7dd3fc]">
                        天命词条池
                    </span>
                    <span className="text-[11px] text-[#94a3b8]">
                        天命 Lv.{level}/10
                    </span>
                </div>
                <button
                    onClick={() => setShowCalc(!showCalc)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e293b]/70 hover:bg-[#334155] text-[#38bdf8] text-[11px] transition-colors border border-[#38bdf8]/20"
                >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>{showCalc ? '收起测算' : '满级推演'}</span>
                </button>
            </div>

            {/* 部位切换胶囊 */}
            <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-0.5">
                {parts.map((p) => {
                    const isActive = p.partId === activePartId;
                    return (
                        <button
                            key={p.partId}
                            onClick={() => {
                                setActivePartId(p.partId);
                                setCalcAttrName('');
                                setCalcCustomBase(0);
                            }}
                            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap ${
                                isActive
                                    ? 'bg-[#38bdf8] text-[#0f172a] font-bold shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                                    : 'bg-[#1e293b]/70 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                            }`}
                        >
                            {p.partName}
                        </button>
                    );
                })}
            </div>

            {/* 条数产生概率条 */}
            <div className="bg-[#131b2e]/60 rounded border border-[#1e293b] p-2 mb-2.5">
                <div className="flex items-center justify-between mb-1 text-[11px]">
                    <span className="text-[#94a3b8]">天缘词条条数产生概率：</span>
                    <span className="text-[#7dd3fc] font-mono">2~3条为最主流 (90%)</span>
                </div>
                <div className="grid grid-cols-4 gap-1 font-mono text-[10px] text-center">
                    {activePart.countProbabilities.map((cp) => (
                        <div key={cp.count} className="bg-[#0b0f19] border border-[#1e293b]/80 rounded py-1 px-1">
                            <span className="text-[#94a3b8]">{cp.count}条：</span>
                            <span className="text-[#f59e0b] font-bold ml-1">{cp.probability}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 等级滑块与快速档位 */}
            <div className="bg-[#0f172a]/70 rounded border border-[#1e293b]/80 p-2 mb-2.5">
                <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] text-[#94a3b8]">天命装备等级：</span>
                    <div className="flex items-center gap-1">
                        {[1, 3, 5, 8, 10].map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setLevel(lvl)}
                                className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                                    level === lvl
                                        ? 'bg-[#38bdf8] text-[#0f172a] font-bold'
                                        : 'bg-[#1e293b] text-[#94a3b8] hover:bg-[#334155]'
                                }`}
                            >
                                {lvl === 10 ? '满级(10)' : `${lvl}级`}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={level}
                        onChange={(e) => setLevel(Number(e.target.value))}
                        className="w-full accent-[#38bdf8] h-1.5 bg-[#1e293b] rounded cursor-pointer"
                    />
                    <span className="w-8 text-right font-mono font-bold text-white text-[12px]">
                        +{level}
                    </span>
                </div>
            </div>

            {/* 测算器面板 */}
            {showCalc && selectedAttrForCalc && (
                <div className="bg-[#111827] border border-[#38bdf8]/30 rounded p-2.5 mb-2.5">
                    <div className="flex items-center gap-1.5 text-[#38bdf8] font-bold text-[11px] mb-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>洗炼数值满级(10级)自动推算器</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
                        <span className="text-[#94a3b8]">选择词条：</span>
                        <select
                            value={selectedAttrForCalc.name}
                            onChange={(e) => {
                                setCalcAttrName(e.target.value);
                                const found = activePart.attributes.find((a) => a.name === e.target.value);
                                if (found) setCalcCustomBase(found.maxBase);
                            }}
                            className="bg-[#1e293b] border border-[#334155] text-white rounded px-1.5 py-0.5 text-[11px]"
                        >
                            {activePart.attributes.map((a) => (
                                <option key={a.name} value={a.name}>
                                    {a.name} ({a.probability})
                                </option>
                            ))}
                        </select>
                        <span className="text-[#94a3b8]">初始值：</span>
                        <input
                            type="number"
                            step="any"
                            value={calcCustomBase || selectedAttrForCalc.maxBase}
                            onChange={(e) => setCalcCustomBase(Number(e.target.value))}
                            className="w-16 bg-[#1e293b] border border-[#334155] text-white font-mono rounded px-1.5 py-0.5 text-[11px]"
                        />
                        <span className="text-[#94a3b8]">{selectedAttrForCalc.unit}</span>
                    </div>

                    <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b] flex items-center justify-between text-[11px]">
                        <span className="text-[#cbd5e1]">
                            当前初始 [{calcCustomBase || selectedAttrForCalc.maxBase}{selectedAttrForCalc.unit}] 升至天命10级后最终值：
                        </span>
                        <span className="font-mono font-bold text-[#f59e0b] text-[13px]">
                            {calcResultAt10}{selectedAttrForCalc.unit}
                        </span>
                    </div>
                </div>
            )}

            {/* 属性池全览表 */}
            <div className="border border-[#1e293b] rounded overflow-hidden mb-2">
                <table className="w-full text-left text-[11px]">
                    <thead className="bg-[#1e293b] text-[#94a3b8]">
                        <tr>
                            <th className="p-1.5">属性名称</th>
                            <th className="p-1.5 font-mono">Lv.{level} 取值区间</th>
                            <th className="p-1.5">每级增益</th>
                            <th className="p-1.5 text-center">产生概率</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e293b]/60 font-mono">
                        {computedAttrs.map((attr) => {
                            const isRare = attr.name.includes('无视') || attr.name.includes('暴击率') || attr.name.includes('暴击伤害') || attr.name.includes('减免暴击');
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
                                        +{attr.perLevelGain}{attr.unit}/级
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

            <div className="pt-1.5 border-t border-[#1e293b]/60 flex items-center justify-between text-[10px] text-[#64748b]">
                <span>数据来源：完美世界官方游戏论坛攻略区</span>
                <span>支持天命 1~10 级线性成长</span>
            </div>
        </div>
    );
};

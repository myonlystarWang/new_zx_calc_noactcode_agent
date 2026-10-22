import React, { useState, useMemo } from 'react';
import {
    Compass,
    Sparkles,
    Sliders
} from 'lucide-react';
import clsx from 'clsx';
import { GameTooltipShell } from '../ui/GameColorText';

interface BeastMeta {
    name: '青龙' | '白虎' | '朱雀' | '玄武';
    color: string;
    border: string;
    bg: string;
    accent: string;
    specificKeys: string[];
}

const BEASTS: Record<string, BeastMeta> = {
    青龙: {
        name: '青龙',
        color: '#11ff11',
        border: 'border-emerald-500/40',
        bg: 'bg-emerald-500/10',
        accent: 'text-emerald-400',
        specificKeys: ['ql_bs', 'ql_jnmz', 'ql_xy', 'ql_ds']
    },
    白虎: {
        name: '白虎',
        color: '#ffcb4a',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/10',
        accent: 'text-amber-400',
        specificKeys: ['bh_bj', 'bh_jbj', 'bh_kx', 'bh_mh']
    },
    朱雀: {
        name: '朱雀',
        color: '#ff4d4f',
        border: 'border-rose-500/40',
        bg: 'bg-rose-500/10',
        accent: 'text-rose-400',
        specificKeys: ['zq_km', 'zq_yl', 'zq_yswn', 'zq_hs']
    },
    玄武: {
        name: '玄武',
        color: '#11aaff',
        border: 'border-sky-500/40',
        bg: 'bg-sky-500/10',
        accent: 'text-sky-400',
        specificKeys: ['xw_ws', 'xw_jbs', 'xw_kf', 'xw_xr']
    }
};

interface AttrRule {
    name: string;
    min: number;
    max: number;
    gain: number;
    unit?: string;
}

const STANDARD_RULES: Record<string, AttrRule> = {
    gj: { name: "攻击", min: 200, max: 1000, gain: 20 },
    fy: { name: "防御", min: 100, max: 300, gain: 10 },
    qx: { name: "气血", min: 2000, max: 6000, gain: 100 },
    zq: { name: "真气", min: 500, max: 3000, gain: 50 },
    gj_r: { name: "攻击%", min: 3.5, max: 10, gain: 0.4, unit: "%" },
    fy_r: { name: "防御%", min: 5, max: 10, gain: 0.5, unit: "%" },
    qx_r: { name: "气血%", min: 2, max: 8, gain: 0.2, unit: "%" },
    zq_r: { name: "真气%", min: 2, max: 8, gain: 0.2, unit: "%" },
    ql_xy: { name: "眩晕抗性", min: 20, max: 80, gain: 1 },
    ql_ds: { name: "定身抗性", min: 20, max: 80, gain: 1 },
    ql_jnmz: { name: "技能命中", min: 5, max: 15, gain: 0.5 },
    ql_bs: { name: "暴击伤害", min: 20, max: 60, gain: 1, unit: "%" },
    bh_kx: { name: "克仙", min: 3, max: 10, gain: 0.2, unit: "%" },
    bh_mh: { name: "魅惑抗性", min: 20, max: 80, gain: 1 },
    bh_jbj: { name: "减暴击", min: 1, max: 5, gain: 0.1, unit: "%" },
    bh_bj: { name: "暴击", min: 5, max: 12, gain: 0.3, unit: "%" },
    zq_km: { name: "克魔", min: 3, max: 10, gain: 0.2, unit: "%" },
    zq_yl: { name: "元力值", min: 500, max: 1600, gain: 40 },
    zq_yswn: { name: "元神威能", min: 20, max: 70, gain: 2 },
    zq_hs: { name: "昏睡抗性", min: 20, max: 80, gain: 1 },
    xw_kf: { name: "克佛", min: 3, max: 10, gain: 0.2, unit: "%" },
    xw_xr: { name: "虚弱抗性", min: 20, max: 80, gain: 1 },
    xw_jbs: { name: "减免暴伤", min: 4, max: 8, gain: 0.2, unit: "%" },
    xw_ws: { name: "无视减免", min: 3, max: 12, gain: 0.3, unit: "%" },
};

const HERO_RULES: Record<string, AttrRule> = {
    gj: { name: "攻击", min: 280, max: 1400, gain: 20 },
    fy: { name: "防御", min: 125, max: 375, gain: 10 },
    qx: { name: "气血", min: 2800, max: 8400, gain: 100 },
    zq: { name: "真气", min: 700, max: 4200, gain: 50 },
    gj_r: { name: "攻击%", min: 4.4, max: 12.5, gain: 0.4, unit: "%" },
    fy_r: { name: "防御%", min: 4.4, max: 12.5, gain: 0.5, unit: "%" },
    qx_r: { name: "气血%", min: 2.5, max: 10, gain: 0.2, unit: "%" },
    zq_r: { name: "真气%", min: 2.5, max: 10, gain: 0.2, unit: "%" },
    ql_xy: { name: "眩晕抗性", min: 28, max: 112, gain: 1 },
    ql_ds: { name: "定身抗性", min: 28, max: 112, gain: 1 },
    ql_jnmz: { name: "技能命中", min: 6.3, max: 18.8, gain: 0.5 },
    ql_bs: { name: "暴击伤害", min: 25, max: 75, gain: 1, unit: "%" },
    bh_kx: { name: "克仙", min: 4.2, max: 14, gain: 0.2, unit: "%" },
    bh_mh: { name: "魅惑抗性", min: 28, max: 112, gain: 1 },
    bh_jbj: { name: "减暴击", min: 1.3, max: 6.3, gain: 0.1, unit: "%" },
    bh_bj: { name: "暴击", min: 6.3, max: 15, gain: 0.3, unit: "%" },
    zq_km: { name: "克魔", min: 4.2, max: 14, gain: 0.2, unit: "%" },
    zq_yl: { name: "元力值", min: 700, max: 2240, gain: 40 },
    zq_yswn: { name: "元神威能", min: 25, max: 88, gain: 2 },
    zq_hs: { name: "昏睡抗性", min: 28, max: 112, gain: 1 },
    xw_kf: { name: "克佛", min: 4.2, max: 14, gain: 0.2, unit: "%" },
    xw_xr: { name: "虚弱抗性", min: 28, max: 112, gain: 1 },
    xw_jbs: { name: "减免暴伤", min: 5.6, max: 11.2, gain: 0.2, unit: "%" },
    xw_ws: { name: "无视减免", min: 3.8, max: 15, gain: 0.3, unit: "%" },
};

const COMMON_KEYS = ['gj', 'fy', 'qx', 'zq', 'gj_r', 'fy_r', 'qx_r', 'zq_r'];

interface SlotEntry {
    key: string;
    val: number | string;
}

/** 识图带入的初始值：系别 + 普通/英雄 + 品阶（进阶技能仅供卡上展示） */
export interface XycSeed {
    /** 系别：青龙 / 白虎 / 朱雀 / 玄武 */
    beast?: '青龙' | '白虎' | '朱雀' | '玄武';
    /** 是否英雄版 */
    isHero?: boolean;
    /** 品阶 1–20 */
    level?: number;
    /** 截图里识别到的进阶技能（青龙/白虎 系才有） */
    advSkill?: { name?: string; variant?: string; level?: number };
}

export const XycSimulatorView: React.FC<{ seed?: XycSeed | null }> = ({ seed }) => {
    const [selectedBeast, setSelectedBeast] = useState<'青龙' | '白虎' | '朱雀' | '玄武'>(
        seed?.beast && BEASTS[seed.beast] ? seed.beast : '玄武'
    );
    const [isHero, setIsHero] = useState<boolean>(Boolean(seed?.isHero));
    const [bookLevel, setBookLevel] = useState<number>(
        typeof seed?.level === 'number' ? Math.min(20, Math.max(1, seed.level)) : 1
    );

    // 当前配置的属性条目（最多5条）
    const [slots, setSlots] = useState<SlotEntry[]>([
        { key: 'xw_ws', val: 12.0 },
        { key: 'xw_jbs', val: 7.2 },
        { key: 'gj_r', val: 9.0 },
    ]);

    const activeRules = isHero ? HERO_RULES : STANDARD_RULES;
    const beastMeta = BEASTS[selectedBeast];

    // 可选的属性键列表（当前书系专属 + 通用基础）
    const availableKeys = useMemo(() => {
        return [...beastMeta.specificKeys, ...COMMON_KEYS];
    }, [beastMeta]);

    // 计算当前每个属性的成长与极品百分比
    const evaluatedResults = useMemo(() => {
        return slots.map(slot => {
            const rule = activeRules[slot.key];
            if (!rule) return null;
            const inputNum = Number(slot.val);
            if (isNaN(inputNum) || inputNum <= 0) return null;

            // 满级 (20级) 理论最小与最大
            const min20 = rule.min + 20 * rule.gain;
            const max20 = rule.max + 20 * rule.gain;

            // 预估到20级的数值
            const to20 = inputNum + (20 - bookLevel) * rule.gain;

            // 初始 (1级) 数值
            const csVal = inputNum - (bookLevel - 1) * rule.gain;
            const csMin = rule.min + rule.gain;
            const csMax = rule.max + rule.gain;

            // 百分比
            const range20 = max20 - min20;
            const bili20 = range20 > 0 ? Math.max(0, Math.min(100, ((to20 - min20) / range20) * 100)) : 0;

            const rangeCs = csMax - csMin;
            const csBili = rangeCs > 0 ? Math.max(0, Math.min(100, ((csVal - csMin) / rangeCs) * 100)) : 0;

            return {
                key: slot.key,
                name: rule.name,
                unit: rule.unit || '',
                inputNum,
                csVal: Number(csVal.toFixed(2)),
                csMin: Number(csMin.toFixed(2)),
                csMax: Number(csMax.toFixed(2)),
                csBili: Number(csBili.toFixed(1)),
                to20: Number(to20.toFixed(2)),
                min20: Number(min20.toFixed(2)),
                max20: Number(max20.toFixed(2)),
                bili20: Number(bili20.toFixed(1)),
            };
        }).filter(Boolean);
    }, [slots, bookLevel, activeRules]);

    // 综合品相评级
    const overallScore = useMemo(() => {
        if (evaluatedResults.length === 0) return null;
        const avg = evaluatedResults.reduce((acc, cur) => acc + (cur?.bili20 || 0), 0) / evaluatedResults.length;
        return Number(avg.toFixed(1));
    }, [evaluatedResults]);

    const handleKeyChange = (index: number, newKey: string) => {
        const next = [...slots];
        const rule = activeRules[newKey];
        next[index] = {
            key: newKey,
            val: rule ? Number(((rule.min + rule.max) / 2).toFixed(1)) : 0
        };
        setSlots(next);
    };

    const handleValChange = (index: number, newVal: string) => {
        const next = [...slots];
        next[index].val = newVal;
        setSlots(next);
    };

    const addSlot = () => {
        if (slots.length >= 5) return;
        const unused = availableKeys.find(k => !slots.some(s => s.key === k)) || availableKeys[0];
        const rule = activeRules[unused];
        setSlots([...slots, { key: unused, val: rule ? Number(((rule.min + rule.max) / 2).toFixed(1)) : 0 }]);
    };

    const removeSlot = (index: number) => {
        setSlots(slots.filter((_, i) => i !== index));
    };

    // 快捷典范样本一键填充
    const applyPreset = (presetName: string) => {
        if (presetName === '极品无视玄武') {
            setSelectedBeast('玄武');
            setIsHero(false);
            setBookLevel(1);
            setSlots([
                { key: 'xw_ws', val: 11.5 },
                { key: 'xw_jbs', val: 7.8 },
                { key: 'gj_r', val: 9.8 }
            ]);
        } else if (presetName === '双暴青龙英雄') {
            setSelectedBeast('青龙');
            setIsHero(true);
            setBookLevel(1);
            setSlots([
                { key: 'ql_bs', val: 72.0 },
                { key: 'ql_jnmz', val: 18.0 },
                { key: 'gj_r', val: 12.0 }
            ]);
        } else if (presetName === '极品克仙白虎') {
            setSelectedBeast('白虎');
            setIsHero(false);
            setBookLevel(1);
            setSlots([
                { key: 'bh_bj', val: 11.5 },
                { key: 'bh_kx', val: 9.5 },
                { key: 'gj', val: 950 }
            ]);
        }
    };

    return (
        <div className="flex flex-col gap-5 max-w-[1500px] mx-auto w-full">
            {/* 顶栏控制栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-300">
                        <Compass className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-slate-100 tracking-wide">
                                轩辕策模拟器
                            </h2>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold">
                                1~20级精准推算
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            青龙 · 白虎 · 朱雀 · 玄武 属性初始值与满级数值成长推算 · 极品度百分位雷达
                        </p>
                    </div>
                </div>

                {/* 快捷典范样本 */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> 典范预设:
                    </span>
                    <button
                        onClick={() => applyPreset('极品无视玄武')}
                        className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 transition-all"
                    >
                        极品玄武书
                    </button>
                    <button
                        onClick={() => applyPreset('双暴青龙英雄')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all"
                    >
                        双暴青龙英雄
                    </button>
                    <button
                        onClick={() => applyPreset('极品克仙白虎')}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all"
                    >
                        克仙白虎书
                    </button>
                </div>
            </div>

            {/* 书系切换与英雄版本开关 */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800/80 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400 font-bold mr-1">书系:</span>
                    {(['青龙', '白虎', '朱雀', '玄武'] as const).map(bName => {
                        const isSelected = selectedBeast === bName;
                        const meta = BEASTS[bName];
                        return (
                            <button
                                key={bName}
                                onClick={() => {
                                    setSelectedBeast(bName);
                                    // 自动切换非兼容词条
                                    setSlots(prev => prev.map(s => {
                                        if (COMMON_KEYS.includes(s.key)) return s;
                                        return { key: meta.specificKeys[0], val: 10 };
                                    }));
                                }}
                                className={clsx(
                                    'px-4 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1.5',
                                    isSelected
                                        ? clsx(meta.bg, meta.border, meta.accent, 'shadow-md shadow-black/40 scale-105')
                                        : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                                )}
                            >
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
                                <span>{bName}</span>
                            </button>
                        );
                    })}
                </div>

                {/* 英雄轩辕策开关 */}
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-amber-300 cursor-pointer select-none bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl hover:bg-amber-500/20 transition-all">
                        <input
                            type="checkbox"
                            checked={isHero}
                            onChange={(e) => setIsHero(e.target.checked)}
                            className="accent-amber-400 cursor-pointer"
                        />
                        <span>英雄轩辕策 (属性更高)</span>
                    </label>
                </div>
            </div>

            {/* 核心工作区：录入调节栏 + 结果展示卡片 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左侧：参数录入 (6列) */}
                <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-4">
                    {/* 等级选择 (1~20级) */}
                    <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                                <span>当前轩辕策等级:</span>
                                <span className="font-mono font-bold text-cyan-300 text-sm">
                                    第 {bookLevel} 阶 (Lv.{bookLevel})
                                </span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                                满级为 20 阶
                            </span>
                        </div>
                        <input
                            type="range"
                            min={1}
                            max={20}
                            step={1}
                            value={bookLevel}
                            onChange={(e) => setBookLevel(Number(e.target.value))}
                            className="w-full accent-cyan-400 cursor-pointer"
                        />
                    </div>

                    {/* 属性条目列表 */}
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-800 text-xs">
                            <span className="font-bold text-slate-200">
                                包含属性 ({slots.length} / 5 条)
                            </span>
                            <span className="text-slate-500">填入游戏当前看到的数值</span>
                        </div>

                        {slots.map((slot, idx) => {
                            const currentRule = activeRules[slot.key];
                            return (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-850"
                                >
                                    <span className="text-xs font-mono font-bold text-slate-500 w-5">
                                        #{idx + 1}
                                    </span>
                                    <select
                                        value={slot.key}
                                        onChange={(e) => handleKeyChange(idx, e.target.value)}
                                        className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-cyan-500 w-36"
                                    >
                                        <optgroup label={`${selectedBeast}专属属性`}>
                                            {beastMeta.specificKeys.map(k => (
                                                <option key={k} value={k}>
                                                    {activeRules[k]?.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="基础通用属性">
                                            {COMMON_KEYS.map(k => (
                                                <option key={k} value={k}>
                                                    {activeRules[k]?.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    </select>

                                    <div className="flex items-center gap-1 flex-1">
                                        <input
                                            type="number"
                                            step={currentRule?.gain && currentRule.gain < 1 ? 0.1 : 1}
                                            value={slot.val}
                                            onChange={(e) => handleValChange(idx, e.target.value)}
                                            placeholder="数值"
                                            className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500 w-full"
                                        />
                                        {currentRule?.unit && (
                                            <span className="text-xs text-slate-400 font-mono">
                                                {currentRule.unit}
                                            </span>
                                        )}
                                    </div>

                                    {slots.length > 1 && (
                                        <button
                                            onClick={() => removeSlot(idx)}
                                            className="text-slate-500 hover:text-rose-400 text-xs px-2 py-1 rounded"
                                            title="移除"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        {slots.length < 5 && (
                            <button
                                onClick={addSlot}
                                className="w-full py-2 rounded-xl border border-dashed border-slate-700/80 text-xs text-slate-400 hover:border-cyan-500/60 hover:text-cyan-300 transition-all font-bold"
                            >
                                + 添加一条属性 (最多5条)
                            </button>
                        )}
                    </div>
                </div>

                {/* 右侧：推算结果与游戏风格卡片 (6列) */}
                <div className="lg:col-span-6 flex flex-col gap-4">
                    {/* 综合品质总览卡片 */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <div>
                                <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">
                                    <span style={{ color: beastMeta.color }}>
                                        {isHero ? `英雄·${selectedBeast}` : `${selectedBeast}轩辕策`}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                                        Lv.{bookLevel}
                                    </span>
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    基于完美世界官方轩辕策成长线性公式演算
                                </p>
                            </div>

                            {overallScore !== null && (
                                <div className="text-right">
                                    <span className="text-[10px] text-slate-400 block leading-tight">平均极品度</span>
                                    <span className={clsx(
                                        'text-xl font-mono font-black',
                                        overallScore >= 90 ? 'text-amber-400' :
                                        overallScore >= 75 ? 'text-cyan-300' : 'text-slate-300'
                                    )}>
                                        {overallScore}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 各属性20级推算明细表 */}
                        <div className="space-y-3">
                            {evaluatedResults.map((item) => {
                                if (!item) return null;
                                return (
                                    <div
                                        key={item.key}
                                        className="bg-slate-950/60 p-3 rounded-xl border border-slate-850 flex flex-col gap-2"
                                    >
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-slate-200">
                                                {item.name}
                                            </span>
                                            <div className="flex items-center gap-2 font-mono text-xs">
                                                <span className="text-slate-400">
                                                    当前 Lv.{bookLevel}: <b className="text-slate-200">{item.inputNum}{item.unit}</b>
                                                </span>
                                                <span>→</span>
                                                <span className="text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                                                    满级 Lv.20: {item.to20}{item.unit}
                                                </span>
                                            </div>
                                        </div>

                                        {/* 满级数值进度条 */}
                                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                                            <span>最小 {item.min20}</span>
                                            <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden relative">
                                                <div
                                                    className={clsx(
                                                        'h-full rounded-full transition-all duration-300',
                                                        item.bili20 >= 90 ? 'bg-amber-400' :
                                                        item.bili20 >= 70 ? 'bg-cyan-400' : 'bg-slate-400'
                                                    )}
                                                    style={{ width: `${item.bili20}%` }}
                                                />
                                            </div>
                                            <span>天花板 {item.max20}</span>
                                            <span className={clsx(
                                                'font-bold w-10 text-right',
                                                item.bili20 >= 80 ? 'text-amber-300' : 'text-slate-400'
                                            )}>
                                                {item.bili20}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 游戏风格 Tooltip 拟真外观展示 */}
                        <GameTooltipShell
                            title={`${isHero ? '英雄·' : ''}${selectedBeast}轩辕策 (第${bookLevel}阶)`}
                            titleColor={beastMeta.color}
                            className="bg-[#0b0e14]/95 text-xs font-sans leading-relaxed border-slate-700/80"
                        >
                            <div className="text-[11px] text-slate-400 pb-1 border-b border-slate-800">
                                轩辕天书 · 策书属性加成
                            </div>
                            <div className="space-y-1 py-1 font-mono">
                                {evaluatedResults.map(item => (
                                    <div key={item?.key} className="flex justify-between text-[#11ff11]">
                                        <span>{item?.name}</span>
                                        <span>+{item?.inputNum}{item?.unit}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-1.5 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between font-mono">
                                <span>强化上限: 20 阶</span>
                                <span>满级预估已达 {overallScore}% 品相</span>
                            </div>
                        </GameTooltipShell>
                    </div>
                </div>
            </div>
        </div>
    );
};

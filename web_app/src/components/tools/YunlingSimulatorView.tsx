import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Play, RefreshCw, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts';
import { DataService } from '../../services/DataService';
import { EquipDetailCard } from '../compendium/EquipDetailCard';
import type { CuratedEquipItem } from '../../types';
import { getEquipQualityColor, getYunlingColor } from '../../constants/gameColorSystem';
import { SHENJI_SLOTS, type ShenjiSlot, type ShenjiQuality } from '../../utils/shenjiSim';
import {
    COST_CURVE_LABEL,
    COST_CURVES,
    DEFAULT_CONFIG,
    EQUIP_LUCK_PRESETS,
    LEVEL_ANNOUNCE,
    PERSON_LUCK_CAP,
    PERSON_LUCK_PRESETS,
    YUNLING_MAX,
    baseProbPct,
    costForTarget,
    curveForEquip,
    displayProbPct,
    drawOnce,
    expectedChain,
    expectedLevel,
    luckBreakdown,
    monteCarlo,
    rateOf,
    totalCurveCost,
    EQUIP_LUCK_TIERS,
    PERSON_LUCK_TIERS,
    type BaseMode,
    type DistributionStats,
    type YunlingConfig,
} from '../../utils/yunlingSim';

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
const PANEL_BG = 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)';
const MANUAL_MS = 620;
const AUTO_MS = 130;

const QUALITIES: ShenjiQuality[] = ['修武', '昭武', '彰武'];

interface LogRow {
    id: number;
    text: string;
    success: boolean;
    level: number;
}

/** 面板按钮（游戏蓝灰金属凸起） */
function btnStyle(enabled: boolean, tone: 'normal' | 'danger' = 'normal'): React.CSSProperties {
    if (!enabled) {
        return {
            background: 'rgba(16, 26, 36, 0.6)',
            border: '1px solid #203244',
            boxShadow: 'none',
            color: '#4a657c',
            cursor: 'not-allowed',
            fontFamily: SIM_FONT,
        };
    }
    if (tone === 'danger') {
        return {
            background: 'linear-gradient(180deg, #872e22 0%, #4f1710 100%)',
            border: '1px solid #b34739',
            boxShadow: '0 0 12px rgba(220,60,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
            color: '#ffffff',
            cursor: 'pointer',
            fontFamily: SIM_FONT,
        };
    }
    return {
        background: 'linear-gradient(180deg, #2b3d50 0%, #162432 100%)',
        border: '1px solid #416282',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 5px rgba(0,0,0,0.5)',
        color: '#edf5fc',
        cursor: 'pointer',
        fontFamily: SIM_FONT,
    };
}

function chipStyle(active: boolean, accent?: string): React.CSSProperties {
    const color = accent || '#4b759e';
    return {
        background: active
            ? 'linear-gradient(180deg, #273e54 0%, #152636 100%)'
            : 'linear-gradient(180deg, #131c26 0%, #0d141d 100%)',
        border: `1px solid ${active ? color : '#1e3042'}`,
        color: active ? (accent || '#e8f3fc') : '#5a738c',
        boxShadow: active ? `0 0 8px ${color}44, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
        fontFamily: SIM_FONT,
    };
}

const panelStyle: React.CSSProperties = {
    background: PANEL_BG,
    border: '1px solid #283e54',
    fontFamily: SIM_FONT,
    boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
};

const PanelTitle: React.FC<{ text: string; right?: React.ReactNode }> = ({ text, right }) => (
    <div
        className="relative flex items-center justify-between px-3 py-2 -mx-3.5 -mt-3.5 mb-3 rounded-t-[3px]"
        style={{ background: 'linear-gradient(180deg, #192636 0%, #101a24 100%)', borderBottom: '1px solid #283e54' }}
    >
        <div className="w-5" />
        <span
            className="text-[15px] font-bold tracking-[3px] select-none"
            style={{ color: '#f7f4bb', textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000' }}
        >
            {text}
        </span>
        <div className="flex items-center gap-2">{right ?? <div className="w-5" />}</div>
    </div>
);

/** 参数行：标签 + 数字输入 */
const NumField: React.FC<{
    label: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    onChange: (v: number) => void;
    suffix?: string;
    title?: string;
    /** label 后紧跟的档位读数（如 +5%） */
    hint?: string;
}> = ({ label, value, min = 0, max = 99999, step = 1, onChange, suffix, title, hint }) => (
    <label className="flex items-baseline justify-between gap-1.5 min-w-0" title={title}>
        <span className="text-[12.5px] text-[#7ea0bd] whitespace-nowrap shrink-0">
            {label}
            {hint && <b className="text-[11px] text-[#4ce0f0] font-normal ml-1">{hint}</b>}
        </span>
        <span className="flex-1 border-b border-dotted border-[#1e3346] translate-y-[-3px]" />
        <span className="flex items-center gap-1 shrink-0">
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v)));
                }}
                className="w-[62px] h-[24px] px-1.5 text-[12.5px] text-right tabular-nums rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0]"
            />
            {suffix && <span className="text-[11px] text-[#5b7894] w-[14px]">{suffix}</span>}
        </span>
    </label>
);

const fmtInt = (n: number): string => Math.round(n).toLocaleString('zh-CN');
/** 百分比读数：最多 2 位小数，去掉无意义的尾零（0.70 → 0.7，100.00 → 100） */
const fmtPct = (n: number): string => {
    const s = n.toFixed(2).replace(/\.?0+$/, '');
    return s === '' ? '0' : s;
};

export const YunlingSimulatorView: React.FC = () => {
    // ── 装备选择 ─────────────────────────────────────────────
    const [equips, setEquips] = useState<CuratedEquipItem[]>([]);
    const [slot, setSlot] = useState<ShenjiSlot>('武器');
    const [quality, setQuality] = useState<ShenjiQuality>('昭武');
    const [equipName, setEquipName] = useState<string | null>(null);

    // ── 概率参数 ─────────────────────────────────────────────
    const [cfg, setCfg] = useState<YunlingConfig>({ ...DEFAULT_CONFIG, personLuck: 100 });

    // ── 蕴灵运行态 ───────────────────────────────────────────
    // 默认从 +10 起（主流分水岭：+11 起才进入百万级消耗区间，也是玩家最常推演的起点）
    const [level, setLevel] = useState(10);
    const [streak, setStreak] = useState(0);
    const [totalTries, setTotalTries] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [target, setTarget] = useState(YUNLING_MAX);
    const [logs, setLogs] = useState<LogRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [auto, setAuto] = useState(false);
    const [barFill, setBarFill] = useState(0);
    const [barAnim, setBarAnim] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // ── 统计 ─────────────────────────────────────────────────
    const [stats, setStats] = useState<DistributionStats | null>(null);
    const [statsRange, setStatsRange] = useState<string>('');

    const stateRef = useRef({ level, streak, totalTries, totalCost });
    stateRef.current = { level, streak, totalTries, totalCost };
    const autoRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const barRef = useRef<number | null>(null);
    const logIdRef = useRef(0);

    useEffect(() => {
        let alive = true;
        DataService.getInstance()
            .getEquipList()
            .then((list) => { if (alive) setEquips(Array.isArray(list) ? list : []); })
            .catch(() => { });
        return () => { alive = false; };
    }, []);

    /** 可蕴灵的装备：六大部位 + 修武/昭武/彰武（神机体系）+ 具备炼器梯度 */
    const pool = useMemo(
        () => equips.filter((e) => SHENJI_SLOTS.includes(e.slot as ShenjiSlot) && (QUALITIES as string[]).includes(e.q) && Array.isArray(e.ref) && e.ref.length > 0),
        [equips]
    );
    const candidates = useMemo(() => pool.filter((e) => e.slot === slot && e.q === quality), [pool, slot, quality]);
    const equip = useMemo(
        () => candidates.find((e) => e.name === equipName) ?? candidates[0],
        [candidates, equipName]
    );

    useEffect(() => { setEquipName(null); }, [slot, quality]);

    /** 部位 / 品质决定月德符消耗曲线（腰带、袖甲的修武昭武吃折扣表） */
    useEffect(() => {
        if (!equip) return;
        const curve = curveForEquip(equip.slot, equip.q);
        setCfg((prev) => (prev.costCurve === curve ? prev : { ...prev, costCurve: curve }));
    }, [equip]);

    const stopAll = useCallback(() => {
        autoRef.current = false;
        setAuto(false);
        setBusy(false);
        if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
        if (barRef.current) { window.clearTimeout(barRef.current); barRef.current = null; }
        setBarFill(0);
        setBarAnim(false);
    }, []);

    useEffect(() => stopAll, [stopAll]);

    const pushLog = useCallback((row: Omit<LogRow, 'id'>) => {
        logIdRef.current += 1;
        const entry: LogRow = { ...row, id: logIdRef.current };
        setLogs((prev) => [entry, ...prev].slice(0, 12));
    }, []);

    const resetRun = useCallback(() => {
        stopAll();
        setLevel(0);
        setStreak(0);
        setTotalTries(0);
        setTotalCost(0);
        setLogs([]);
    }, [stopAll]);

    const resetStats = useCallback(() => { setStats(null); setStatsRange(''); }, []);

    /** 掷一手：读条 → 判定 */
    const draw = useCallback(
        (delay: number, onDone?: (success: boolean) => void) => {
            const cur = stateRef.current;
            if (cur.level >= YUNLING_MAX) { stopAll(); return; }

            setBusy(true);
            setBarAnim(false);
            setBarFill(0);
            barRef.current = window.setTimeout(() => {
                setBarAnim(true);
                setBarFill(1);
                barRef.current = null;
            }, 16);

            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                const lv = stateRef.current.level;
                const sk = stateRef.current.streak;
                if (lv >= YUNLING_MAX) { stopAll(); return; }

                const r = drawOnce(lv + 1, sk, cfg);
                const nextLevel = r.success ? Math.min(YUNLING_MAX, lv + 1) : lv;
                const nextStreak = r.success ? 0 : sk + 1;
                const spent = costForTarget(lv + 1, cfg.costCurve);

                setLevel(nextLevel);
                setStreak(nextStreak);
                setTotalTries(stateRef.current.totalTries + 1);
                setTotalCost(stateRef.current.totalCost + spent);
                setBusy(false);

                pushLog({
                    success: r.success,
                    level: nextLevel,
                    text: r.success
                        ? `灵化成功 · 蕴灵 +${nextLevel}（消耗 ${spent} 符）${LEVEL_ANNOUNCE[nextLevel] ? ` —— ${LEVEL_ANNOUNCE[nextLevel]}` : ''}`
                        : `蕴灵失败 · 累积幸运 +${cfg.luckGainPerFail}（本次成功率 ${fmtPct(r.prob * 100)}%，消耗 ${spent} 符）`,
                });

                // 读条跑满后瞬间清空（不做满→空回落动画）；先清再回调，连点会各自重新起条
                setBarAnim(false);
                setBarFill(0);
                onDone?.(r.success);
            }, delay);
        },
        [cfg, pushLog, stopAll]
    );

    const handleDraw = useCallback(() => {
        if (busy) return;
        draw(MANUAL_MS);
    }, [busy, draw]);

    /** 连点：从当前等级一路点到目标等级 */
    const startAuto = useCallback(() => {
        if (stateRef.current.level >= target) return;
        setAuto(true);
        autoRef.current = true;

        const loop = () => {
            if (!autoRef.current) return;
            if (stateRef.current.level >= target || stateRef.current.level >= YUNLING_MAX) {
                stopAll();
                return;
            }
            draw(AUTO_MS, () => {
                if (!autoRef.current) return;
                if (stateRef.current.level >= target || stateRef.current.level >= YUNLING_MAX) {
                    stopAll();
                    return;
                }
                window.setTimeout(loop, 30);
            });
        };
        loop();
    }, [draw, stopAll, target]);

    // ── 派生读数 ─────────────────────────────────────────────
    const nextLevel = Math.min(YUNLING_MAX, level + 1);
    const rate = rateOf(nextLevel);
    const basePct = baseProbPct(nextLevel, cfg.baseMode);
    const luck = luckBreakdown(cfg, streak);
    const curProb = level >= YUNLING_MAX ? 0 : displayProbPct(nextLevel, cfg, streak);
    const accumLuck = streak * cfg.luckGainPerFail;
    const levelExp = level >= YUNLING_MAX
        ? { tries: 0, unitCost: 0, cost: 0 }
        : expectedLevel(nextLevel, cfg);
    const chain = expectedChain(level, YUNLING_MAX, cfg);

    /** 关键档位（+11 ~ +15）速查：累积幸运归零起算 */
    const quickRows = useMemo(
        () =>
            [11, 12, 13, 14, 15].map((lv) => {
                const p = displayProbPct(lv, cfg, 0);
                const e = expectedLevel(lv, cfg);
                return { lv, p, tries: e.tries, cost: e.cost, unit: e.unitCost };
            }),
        [cfg]
    );

    const targetBlocked = level >= target;

    const updateCfg = (patch: Partial<YunlingConfig>) => setCfg((prev) => ({ ...prev, ...patch }));

    const runMonteCarlo = useCallback(() => {
        const from = stateRef.current.level;
        if (from >= YUNLING_MAX) return;
        const s = monteCarlo(from, YUNLING_MAX, cfg, 2000, 16);
        setStats(s);
        setStatsRange(`蕴灵 +${from} → +${YUNLING_MAX}`);
    }, [cfg]);

    return (
        <div className="w-full" style={{ containerType: 'inline-size' }}>
            <style>{`
                .yl-scroll::-webkit-scrollbar { width: 5px; }
                .yl-scroll::-webkit-scrollbar-track { background: rgba(8, 16, 24, 0.5); border-radius: 3px; }
                .yl-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #38536e 0%, #1d3346 100%);
                    border: 1px solid #4a6c8e; border-radius: 3px;
                }
                @container (min-width: 980px) {
                    .yl-layout { flex-direction: row !important; align-items: stretch !important; }
                    .yl-card-slot { width: 520px !important; min-width: 520px !important; flex: 0 0 520px !important; }
                    .yl-console { flex: 1 1 0% !important; min-width: 0 !important; }
                }
                @container (max-width: 979px) {
                    .yl-layout { flex-direction: column !important; }
                    .yl-card-slot, .yl-console { width: 100% !important; min-width: 0 !important; }
                }
            `}</style>

            <div className="yl-layout flex flex-col gap-3 w-full">
                {/* ══════════ 左屏：装备 + 概率参数 ══════════ */}
                <div className="yl-card-slot flex flex-col gap-3 min-w-0" style={{ containerType: 'inline-size' }}>
                    <div className="relative rounded-[4px] p-3.5 select-none" style={panelStyle}>
                        <PanelTitle text="神隐装备" />
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {QUALITIES.map((q) => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() => setQuality(q)}
                                        className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                                        style={chipStyle(quality === q, getEquipQualityColor(q))}
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {SHENJI_SLOTS.map((s) => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => setSlot(s)}
                                        className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                                        style={chipStyle(slot === s)}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                            <select
                                value={equip?.name ?? ''}
                                onChange={(e) => setEquipName(e.target.value)}
                                className="w-full h-[28px] px-1.5 text-[12.5px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0]"
                            >
                                {candidates.length === 0 && <option value="">该组合暂无蕴灵装备</option>}
                                {candidates.map((e) => (
                                    <option key={e.name} value={e.name}>
                                        {e.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {equip ? (
                        <EquipDetailCard
                            item={equip}
                            allEquips={equips}
                            refLevel={level}
                            onRefLevelChange={(lv) => { setLevel(lv); setStreak(0); }}
                            hideStepper
                            className="!max-w-none !bg-transparent !border-0 !shadow-none !backdrop-blur-none !p-0"
                        />
                    ) : (
                        <div className="rounded-[4px] p-6 text-center text-[13px] text-[#5b7894]" style={panelStyle}>
                            正在加载装备图鉴…
                        </div>
                    )}
                    {/* 参数面板 */}
                    <div className="relative rounded-[4px] p-3.5" style={panelStyle} data-yl="params">
                        <PanelTitle text="概率参数" />

                        <div className="mb-2.5">
                            <div className="text-[12px] text-[#7ea0bd] mb-1">基础概率口径</div>
                            <div className="flex flex-wrap gap-1.5">
                                {(['calibrated', 'floor', 'random', 'ceil'] as BaseMode[]).map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => updateCfg({ baseMode: m })}
                                        className="px-2.5 py-[3px] rounded-[2px] text-[12.5px]"
                                        style={chipStyle(cfg.baseMode === m)}
                                        title={m === 'calibrated' ? '按玩家实测手数反推：+13 80~120、+14 120~150、+15 150~190 手' : undefined}
                                    >
                                        {m === 'calibrated' ? '实测校准' : m === 'floor' ? '官方下限' : m === 'random' ? '区间随机' : '官方上限'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 gap-x-5 gap-y-1.5">
                            <NumField
                                label="装备幸运值"
                                hint={`+${fmtPct(luck.equipBonus * 100)}%`}
                                value={cfg.equipLuck}
                                max={1200}
                                onChange={(v) => updateCfg({ equipLuck: v })}
                                title="客户端表 281 装备幸运值：5/10/25/50/100/200/350/550/800/1200 → +3%~+40%"
                            />
                            <NumField
                                label="个人幸运值"
                                hint={`+${fmtPct(luck.personBonus * 100)}%${cfg.personLuck >= PERSON_LUCK_CAP ? '·已封顶' : ''}`}
                                value={cfg.personLuck}
                                max={4000}
                                onChange={(v) => updateCfg({ personLuck: v })}
                                title="客户端表 281 个人幸运值：25/50/100/200/550/1000/2000 → +2%~+15%。2000 点即封顶，再往上（如 4000）加成恒为 +15%，无额外增益"
                            />
                            <NumField
                                label="失败累积幸运"
                                value={cfg.luckGainPerFail}
                                min={0}
                                max={10}
                                onChange={(v) => updateCfg({ luckGainPerFail: v })}
                                title="每次失败累积的幸运值，计入装备幸运值（封顶 1200 → +40%），成功后归零（软保底）"
                            />
                            <NumField
                                label="长尾收敛"
                                value={cfg.converge}
                                min={0}
                                max={3}
                                step={0.25}
                                onChange={(v) => updateCfg({ converge: v })}
                                title="连续失败越久补偿越强，把几何分布长尾削平、两端收敛"
                            />
                            <NumField
                                label="硬保底手数"
                                value={cfg.pity}
                                min={0}
                                max={500}
                                onChange={(v) => updateCfg({ pity: v })}
                                title="连续失败达到 N 手必成；0 = 关闭"
                            />
                            <label className="flex items-center justify-between gap-2 min-w-0">
                                <span className="text-[12.5px] text-[#7ea0bd] whitespace-nowrap">连点目标</span>
                                <select
                                    value={target}
                                    onChange={(e) => setTarget(Number(e.target.value))}
                                    className="w-[74px] h-[24px] px-1 text-[12.5px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0]"
                                >
                                    {Array.from({ length: YUNLING_MAX }, (_, i) => i + 1).map((lv) => (
                                        <option key={lv} value={lv}>+{lv}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {/* 幸运值阶梯读数 + 快捷档位 */}
                        <div className="mt-2 space-y-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11.5px] text-[#5b7894] w-[62px] shrink-0">个人快捷</span>
                                <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                    {PERSON_LUCK_PRESETS.map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => updateCfg({ personLuck: v })}
                                            className="px-1.5 py-[2px] rounded-[2px] text-[11.5px] tabular-nums shrink-0"
                                            style={chipStyle(cfg.personLuck === v, '#4ce0f0')}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11.5px] text-[#5b7894] w-[62px] shrink-0">装备快捷</span>
                                <div className="flex items-center gap-1 min-w-0 flex-wrap">
                                    {EQUIP_LUCK_PRESETS.map((v) => (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => updateCfg({ equipLuck: v })}
                                            className="px-1.5 py-[2px] rounded-[2px] text-[11.5px] tabular-nums shrink-0"
                                            style={chipStyle(cfg.equipLuck === v, '#ffd94d')}
                                        >
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 关键档位期望速查 */}
                        <div className="mt-2.5 pt-2" style={{ borderTop: '1px solid #1a2a3b' }}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px] text-[#7ea0bd]">关键档位期望（累积幸运归零起算）</span>
                                <span className="text-[11px] text-[#4a657c] tabular-nums">
                                    {COST_CURVE_LABEL[cfg.costCurve]} · 逐级 {COST_CURVES[cfg.costCurve].slice(10).join('/')} 符
                                </span>
                            </div>
                            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] gap-x-3 gap-y-0.5 text-[12px] tabular-nums">
                                <span className="text-[#4a657c] text-[11px]">档位</span>
                                <span className="text-[#4a657c] text-[11px] text-right">单符</span>
                                <span className="text-[#4a657c] text-[11px] text-right">成功率</span>
                                <span className="text-[#4a657c] text-[11px] text-right">期望手数</span>
                                <span className="text-[#4a657c] text-[11px] text-right">期望月德符</span>
                                {quickRows.map((r) => (
                                    <React.Fragment key={r.lv}>
                                        <span className="border-b border-dotted border-[#1e3346]" style={{ color: getYunlingColor(r.lv) }}>+{r.lv - 1} → +{r.lv}</span>
                                        <span className="text-right text-[#6b89a8]">{r.unit}</span>
                                        <span className="text-right text-[#9adfff]">{fmtPct(r.p)}%</span>
                                        <span className="text-right text-[#d6e7f7]">{r.tries.toFixed(1)}</span>
                                        <span className="text-right text-[#ffd94d]">{fmtInt(r.cost)}</span>
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>

                        {showHelp && (
                            <div
                                className="mt-2.5 rounded-[3px] px-3 py-2 text-[12px] leading-[21px] yl-scroll"
                                style={{ background: 'rgba(16,32,48,.5)', border: '1px solid #2a415a', color: '#9adfff', maxHeight: 260, overflowY: 'auto' }}
                            >
                                <div className="font-bold text-[#ffd94d] mb-1">官方公式</div>
                                <div>实际成功率 = 基础概率 × (1 + 装备幸运值增益 + 个人幸运值增益)</div>
                                <div className="mt-1.5 font-bold text-[#ffd94d]">基础概率取哪个值？</div>
                                <div>· 官方只给区间，如 +11 为 6.67% ~ 100%、+13 为 1.52% ~ 32%。</div>
                                <div>· 若按「区间均匀随机」模拟，+11 的平均手数不到 2 手（社区实测 1.8 手左右），+13 的手数长尾能拖到 500 手以上。这与实际体感、论坛晒的消耗量级都不符。</div>
                                <div>· 结论：实际基础概率贴着<b>区间下限</b>走，但玩家实测手数比「下限」还要更长一截（+13 基本 80~120、+14 120~150、+15 150~190 手）。</div>
                                <div>· 本模拟器据此新增「<b>实测校准</b>」口径并设为默认：+13/+14/+15 的基础概率 = 官方下限 × 0.43 / 0.61 / 0.59，软保底窗口改为 +13 100~150、+14 135~203、+15 170~255（其余等级仍 250/300）。</div>
                                <div>· 官方下限 / 区间随机 / 官方上限 三档保留作对照实验。</div>
                                <div className="mt-1.5 font-bold text-[#ffd94d]">幸运值（客户端表 281 阶梯表）</div>
                                <div>· 装备幸运值：{EQUIP_LUCK_TIERS.map((t) => `${t.threshold}→${Math.round(t.bonus * 100)}%`).join(' / ')}</div>
                                <div>· 个人幸运值：{PERSON_LUCK_TIERS.map((t) => `${t.threshold}→${Math.round(t.bonus * 100)}%`).join(' / ')}（<b>2000 点封顶</b>，再往上如 4000 仍是 +15%，输入框允许填到 4000 只为便于验证）</div>
                                <div>· 幸运值不是线性换算，跨过阈值才拿到该档加成；两档加成<b>相加</b>后乘到基础概率上。</div>
                                <div>· 累积幸运：每失败一手 +N，成功归零 —— 即「蕴灵失败幸运值 +1」的软保底。默认计入<b>装备幸运值</b>档（封顶 1200 → +40%，与信息卡/游戏内表现一致），跨过阈值才抬升加成。</div>
                                <div className="mt-1.5 font-bold text-[#ffd94d]">月德符消耗（客户端表 280）</div>
                                <div>· 通用 {COST_CURVES.general.join('/')}（合计 {totalCurveCost('general')}）</div>
                                <div>· 腰带 {COST_CURVES.belt.join('/')}（合计 {totalCurveCost('belt')}）</div>
                                <div>· 袖甲 {COST_CURVES.cuff.join('/')}（合计 {totalCurveCost('cuff')}）</div>
                                <div>· 腰带 / 袖甲仅「修武 / 昭武」吃折扣表，彰武回落通用表；每手单价随目标等级递增。</div>
                                <div className="mt-1.5 font-bold text-[#ffd94d]">可选的收敛强化</div>
                                <div>· 长尾收敛：连续失败越久，额外补偿越强，把几何分布的长尾削平，结果向正态收敛。</div>
                                <div>· 硬保底：连续失败 N 手必成，两端彻底收敛（后期版本部分概率事件已具备）。</div>
                                <div className="mt-1.5 text-[11.5px] text-[#6b89a8]">* 基础成功率不在客户端（服务端下发），「取下限」与收敛参数均为社区实测反推的设计口径；幸运值与消耗为客户端实证值。</div>
                            </div>
                        )}
                    </div>
                </div>
                {/* ══════════ 右屏：蕴灵台 + 记录 + 数据实验室 ══════════ */}
                <div className="yl-console flex flex-col gap-3 min-w-0" style={{ containerType: 'inline-size' }}>
                    {/* 等级阶梯 */}
                    <div className="relative rounded-[4px] p-3.5" style={panelStyle}>
                        <PanelTitle
                            text="神隐蕴灵"
                            right={
                                <button
                                    type="button"
                                    onClick={() => setShowHelp((v) => !v)}
                                    style={{ color: showHelp ? '#ffd94d' : '#6b89a8' }}
                                    title="概率口径与设计说明"
                                    className="hover:text-[#9bc2e6] transition-colors"
                                >
                                    <HelpCircle className="w-4 h-4" />
                                </button>
                            }
                        />

                        {/* 等级阶梯 +0 ~ +15 */}
                        <div className="grid grid-cols-8 gap-1 mb-2.5">
                            {Array.from({ length: YUNLING_MAX + 1 }, (_, lv) => {
                                const reached = lv <= level;
                                const isCurrent = lv === level;
                                return (
                                    <button
                                        key={lv}
                                        type="button"
                                        onClick={() => { stopAll(); setLevel(lv); setStreak(0); }}
                                        className="h-[26px] rounded-[2px] text-[12.5px] tabular-nums transition-colors"
                                        style={{
                                            background: isCurrent
                                                ? 'linear-gradient(180deg, #2d465f 0%, #17293a 100%)'
                                                : reached
                                                    ? 'rgba(28, 48, 66, 0.85)'
                                                    : 'rgba(12, 20, 28, 0.85)',
                                            border: `1px solid ${isCurrent ? getYunlingColor(lv) : reached ? '#2c455d' : '#1b2a3a'}`,
                                            color: reached ? getYunlingColor(lv) : '#4b6478',
                                            boxShadow: isCurrent ? `0 0 8px ${getYunlingColor(lv)}66` : 'none',
                                            fontFamily: SIM_FONT,
                                        }}
                                        title={`设为蕴灵 +${lv}`}
                                    >
                                        {lv === 0 ? '0' : `+${lv}`}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 成功率与期望 */}
                        <div
                            className="rounded-[3px] px-3 py-2.5 mb-2.5"
                            style={{ background: 'rgba(8, 18, 28, 0.75)', border: '1px solid #21394f' }}
                        >
                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-[12.5px] text-[#7ea0bd]">
                                        {level >= YUNLING_MAX ? '已达上限' : `+${level} → +${nextLevel} 成功率`}
                                    </span>
                                    <span
                                        className="text-[24px] font-bold tabular-nums leading-none"
                                        style={{ color: level >= YUNLING_MAX ? '#5b7894' : '#4ce0f0', textShadow: '0 0 12px rgba(76,224,240,0.4)' }}
                                    >
                                        {level >= YUNLING_MAX ? '—' : `${fmtPct(curProb)}%`}
                                    </span>
                                </div>
                                <span className="text-[11.5px] text-[#5b7894] tabular-nums">
                                    基础 {fmtPct(basePct)}% × (1 + {fmtPct(luck.total * 100)}%）
                                </span>
                            </div>
                            <div className="mt-1.5 text-[11.5px] text-[#7ea0bd] tabular-nums flex flex-wrap gap-x-3 gap-y-0.5">
                                <span>官方区间 {rate.min}% ~ {rate.max}%</span>
                                <span className="text-[#5b7894]">
                                    装备幸运 {luck.equipPoints}
                                    <span className="text-[#9adfff]"> +{fmtPct(luck.equipBonus * 100)}%</span>
                                </span>
                                <span className="text-[#5b7894]">
                                    个人幸运 {luck.personPoints}
                                    <span className="text-[#9adfff]"> +{fmtPct(luck.personBonus * 100)}%</span>
                                </span>
                                <span className="text-[#ffd94d]">累积 {accumLuck}</span>
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] tabular-nums">
                                <span className="text-[#8892b0]">
                                    本级期望 <b className="text-[#d6e7f7]">{levelExp.tries.toFixed(1)}</b> 手
                                    <span className="text-[#4a657c]"> × {levelExp.unitCost} 符</span>
                                </span>
                                <span className="text-[#8892b0]">
                                    折合 <b className="text-[#d6e7f7]">{fmtInt(levelExp.cost)}</b> 月德符
                                </span>
                                <span className="text-[#8892b0]">
                                    冲满 +{YUNLING_MAX} 期望 <b className="text-[#ffd94d]">{fmtInt(chain.tries)}</b> 手
                                </span>
                                <span className="text-[#8892b0]">
                                    共 <b className="text-[#ffd94d]">{fmtInt(chain.cost)}</b> 月德符
                                </span>
                            </div>
                        </div>

                        {/* 读条 + 主按钮 */}
                        <div className="relative overflow-hidden mb-2.5" style={{ height: 8, borderRadius: 999, background: '#081219', border: '1px solid #182b38' }}>
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.round(barFill * 100)}%`,
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #0c7585 0%, #15b8cf 50%, #46e8fb 100%)',
                                    boxShadow: barFill > 0 ? '0 0 8px rgba(30,220,245,0.7)' : 'none',
                                    transition: barAnim ? `width ${(busy ? MANUAL_MS : AUTO_MS) - 20}ms linear` : 'none',
                                }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={handleDraw}
                                disabled={busy || level >= YUNLING_MAX}
                                className="flex-1 min-w-[110px] py-1.5 rounded-[3px] text-[13.5px] tracking-wider font-medium select-none"
                                style={btnStyle(!busy && level < YUNLING_MAX)}
                            >
                                蕴灵一手
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (autoRef.current) { stopAll(); return; }
                                    if (targetBlocked) return;
                                    startAuto();
                                }}
                                disabled={!auto && targetBlocked}
                                className="flex-1 min-w-[110px] py-1.5 rounded-[3px] text-[13.5px] tracking-wider font-medium select-none flex items-center justify-center gap-1"
                                style={btnStyle(auto || !targetBlocked, auto ? 'danger' : 'normal')}
                            >
                                {auto ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                {auto ? '停止' : `连点到 +${target}`}
                            </button>
                            <button
                                type="button"
                                onClick={resetRun}
                                className="px-3 py-1.5 rounded-[3px] text-[13px] select-none"
                                style={btnStyle(true)}
                                title="重置等级、手数与消耗"
                            >
                                重置
                            </button>
                        </div>

                        {/* 本次统计 */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] tabular-nums text-[#7ea0bd]">
                            <span>本次已用 <b className="text-[#d6e7f7]">{totalTries}</b> 手</span>
                            <span>消耗 <b className="text-[#ffd94d]">{fmtInt(totalCost)}</b> 月德符</span>
                            <span>
                                累积幸运 <b className="text-[#ffd94d]">{accumLuck}</b>
                                <span className="text-[#4a657c]">（失败 +{cfg.luckGainPerFail}/手）</span>
                            </span>
                        </div>
                    </div>

            {/* ══════════ 底部：日志 + 数据实验室 ══════════ */}
            <div className="grid grid-cols-1 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-3 mt-3 items-stretch">
                <div className="relative rounded-[4px] p-3.5 min-w-0 flex flex-col" style={panelStyle}>
                    <PanelTitle text="蕴灵记录" right={<span className="text-[11px] text-[#5b7894] tabular-nums">{logs.length}/12</span>} />
                    <div className="yl-scroll flex-1" style={{ minHeight: 208, maxHeight: 300, overflowY: 'auto' }}>
                        {logs.length === 0 && (
                            <div className="h-full text-center text-[12.5px] text-[#4a647a] flex items-center justify-center select-none">点击「蕴灵一手」开始</div>
                        )}
                        {logs.map((l) => (
                            <div
                                key={l.id}
                                className="text-[12.5px] leading-[22px] truncate"
                                style={{ color: l.success ? getYunlingColor(l.level) : '#8a9bb0' }}
                                title={l.text}
                            >
                                {l.success ? '◆ ' : '· '}{l.text}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative rounded-[4px] p-3.5 min-w-0 flex flex-col" style={panelStyle}>
                    <PanelTitle
                        text="数据实验室"
                        right={
                            <button
                                type="button"
                                onClick={runMonteCarlo}
                                disabled={level >= YUNLING_MAX}
                                className="px-2.5 py-[3px] rounded-[2px] text-[12px] flex items-center gap-1"
                                style={btnStyle(level < YUNLING_MAX)}
                            >
                                <Play className="w-3 h-3" />
                                跑 2000 次
                            </button>
                        }
                    />
                    {!stats ? (
                        <div className="flex-1 text-center text-[12.5px] text-[#4a647a] flex items-center justify-center px-4 select-none">
                            以当前装备与参数，蒙特卡洛模拟「{statsRange || `+${level} → +${YUNLING_MAX}`}」的手数分布
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] tabular-nums text-[#8892b0] mb-1">
                                <span className="text-[#5b7894]">{statsRange}</span>
                                <span>平均 <b className="text-[#4ce0f0]">{stats.mean.toFixed(1)}</b> 手</span>
                                <span>中位 <b className="text-[#d6e7f7]">{stats.median}</b></span>
                                <span>P90 <b className="text-[#ffd94d]">{stats.p90}</b></span>
                                <span>最坏 <b className="text-[#ff8080]">{stats.max}</b></span>
                                <span className="text-[#5b7894]">
                                    ≈ {fmtInt(stats.meanCost)} 符
                                </span>
                            </div>
                            <div style={{ height: 220 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart key={`${stats.runs}-${Math.round(stats.mean)}`} data={stats.bins} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                                        <CartesianGrid stroke="#1b2a3a" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: '#5b7894', fontSize: 10 }} stroke="#21394f" interval="preserveStartEnd" />
                                        <YAxis tick={{ fill: '#5b7894', fontSize: 10 }} stroke="#21394f" />
                                        <ReTooltip
                                            cursor={{ fill: 'rgba(76,224,240,0.08)' }}
                                            contentStyle={{ background: '#0b1520', border: '1px solid #2a415a', borderRadius: 3, fontFamily: SIM_FONT, fontSize: 12 }}
                                            labelStyle={{ color: '#9adfff' }}
                                            formatter={(value: any) => [`${value} 次`, '命中']}
                                            labelFormatter={(l) => `手数 ≥ ${l}`}
                                        />
                                        <Bar dataKey="count" fill="#15b8cf" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                                <span className="text-[11px] text-[#4a657c]">每个分箱统计落入该手数区间的次数（P95 以外并入末箱）</span>
                                <button type="button" onClick={resetStats} className="text-[11px] text-[#6b89a8] hover:text-[#9bc2e6] shrink-0">
                                    清空
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
                </div>
            </div>
        </div>
    );
};

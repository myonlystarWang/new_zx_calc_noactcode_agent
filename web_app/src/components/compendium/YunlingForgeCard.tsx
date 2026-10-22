import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { DataService } from '../../services/DataService';
import type { CuratedEquipItem } from '../../types';
import { getEquipQualityColor, getYunlingColor } from '../../constants/gameColorSystem';
import { SHENJI_SLOTS, type ShenjiSlot, type ShenjiQuality } from '../../utils/shenjiSim';
import { EquipDetailCard } from './EquipDetailCard';
import {
    DEFAULT_CONFIG,
    EQUIP_LUCK_TIERS,
    LEVEL_ANNOUNCE,
    YUNLING_MAX,
    costForTarget,
    curveForEquip,
    displayProbPct,
    drawOnce,
    expectedLevel,
    luckBreakdown,
    luckTierRange,
    type YunlingConfig,
} from '../../utils/yunlingSim';

export interface YunlingForgeCardProps {
    cardData?: {
        data?: unknown;
        initialQuality?: ShenjiQuality;
    };
    className?: string;
}

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
const FORGE_MS = 500;
const AUTO_MS = 500;
const BAR_W = 288;
/** 装备幸运值累积上限（对应表 281 最高档 1200 → +40%） */
const LUCK_CAP = 1200;

const QUALITIES: ShenjiQuality[] = ['修武', '昭武', '彰武'];

interface LevelRow {
    tries: number;
    cost: number;
}

const emptyRows = (): LevelRow[] => Array.from({ length: YUNLING_MAX }, () => ({ tries: 0, cost: 0 }));

const fmtInt = (n: number): string => Math.round(n).toLocaleString('zh-CN');
const fmtPct = (n: number): string => {
    const s = n.toFixed(2).replace(/\.?0+$/, '');
    return s === '' ? '0' : s;
};

/** 手数着色：≥30 黄、≥100 橙红 —— 一眼看出哪一级烧得最多 */
const triesColor = (n: number): string => {
    if (n >= 100) return '#ff9d78';
    if (n >= 30) return '#ffd94d';
    return '#e6f1fa';
};

/** #rrggbb → rgba(r,g,b,a)，用于让提示条跟随蕴灵等级色 */
const hexToRgba = (hex: string, alpha: number): string => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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

/**
 * 对话内嵌「装备蕴灵」轻量卡（仿神机属性锻造）
 *  · 左：神隐装备本体（隐藏神机洗炼池）+ 蕴灵按钮 + 1s 读条
 *  · 右：装备幸运值 0/100 进度、增益系数、当前档成功率与逐级手数/月德符流水
 * 失败 → 装备幸运值 +1；成功 → 蕴灵等级 +1，绿条提示（与神机「已命中预设目标」同语言）。
 */
export const YunlingForgeCard: React.FC<YunlingForgeCardProps> = ({ cardData, className }) => {
    const [equips, setEquips] = useState<CuratedEquipItem[]>([]);
    const [quality, setQuality] = useState<ShenjiQuality>(() => {
        const q = cardData?.initialQuality;
        return q && QUALITIES.includes(q) ? q : '昭武';
    });
    const [slot, setSlot] = useState<ShenjiSlot>('武器');
    const [equipName, setEquipName] = useState<string | null>(null);

    const [level, setLevel] = useState(0);
    const [equipLuck, setEquipLuck] = useState(0);
    const [personLuck, setPersonLuck] = useState(300);
    const [rows, setRows] = useState<LevelRow[]>(emptyRows);
    const [totalTries, setTotalTries] = useState(0);
    const [totalCost, setTotalCost] = useState(0);
    const [msg, setMsg] = useState<{ ok: boolean; level: number; title: string; sub: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [auto, setAuto] = useState(false);
    const [barFill, setBarFill] = useState(0);
    const [barAnim, setBarAnim] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    const stateRef = useRef({ level, equipLuck });
    stateRef.current = { level, equipLuck };
    const rowsRef = useRef(rows);
    rowsRef.current = rows;
    const autoRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const barRef = useRef<number | null>(null);
    const flowRef = useRef<HTMLDivElement | null>(null);

    // 流水新增行后自动滚到底（保留历史可见，累计才对得上）
    useEffect(() => {
        const el = flowRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [rows, level]);

    useEffect(() => {
        let alive = true;
        DataService.getInstance()
            .getEquipList()
            .then((list) => { if (alive) setEquips(Array.isArray(list) ? list : []); })
            .catch(() => { });
        return () => { alive = false; };
    }, []);

    const pool = useMemo(
        () => equips.filter((e) => SHENJI_SLOTS.includes(e.slot as ShenjiSlot) && (QUALITIES as string[]).includes(e.q) && Array.isArray(e.ref) && e.ref.length > 0),
        [equips]
    );
    const candidates = useMemo(() => pool.filter((e) => e.slot === slot && e.q === quality), [pool, slot, quality]);
    // 装备用 name 作选择键：equip_curated 里大量装备共用同一个 id（武器·昭武 54 件只落在 2 个 id 上），
    // 用 id 比较永远命中第一件，表现为「下拉选了不切换」。同一 slot + 品质内 name 唯一，可作稳定键。
    const equip = useMemo(
        () => candidates.find((e) => e.name === equipName) ?? candidates[0],
        [candidates, equipName]
    );

    useEffect(() => { setEquipName(null); }, [slot, quality]);

    const cfg: YunlingConfig = useMemo(
        () => ({
            ...DEFAULT_CONFIG,
            baseMode: 'floor',
            equipLuck,
            personLuck,
            // 累积幸运直接体现在装备幸运值上（失败 +1），不再走 streak
            luckGainPerFail: 0,
            costCurve: curveForEquip(equip?.slot, equip?.q),
        }),
        [equipLuck, personLuck, equip?.slot, equip?.q]
    );

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

    const resetAll = useCallback(() => {
        stopAll();
        setLevel(0);
        setEquipLuck(0);
        setRows(emptyRows());
        setTotalTries(0);
        setTotalCost(0);
        setMsg(null);
    }, [stopAll]);

    const resetForConfig = useCallback(() => {
        resetAll();
    }, [resetAll]);

    const handleQuality = (q: ShenjiQuality) => {
        if (q === quality) return;
        resetForConfig();
        setQuality(q);
    };
    const handleSlot = (s: ShenjiSlot) => {
        if (s === slot) return;
        resetForConfig();
        setSlot(s);
    };

    /** 掷一手：1s 读条 → 判定 */
    const draw = useCallback(
        (delay: number, onDone?: (success: boolean) => void) => {
            if (stateRef.current.level >= YUNLING_MAX) { stopAll(); return; }

            setBusy(true);
            setBarAnim(false);
            setBarFill(0);
            barRef.current = window.setTimeout(() => {
                setBarAnim(true);
                setBarFill(1);
                barRef.current = null;
            }, 20);

            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                const lv = stateRef.current.level;
                const luckNow = stateRef.current.equipLuck;
                if (lv >= YUNLING_MAX) { stopAll(); return; }

                const target = lv + 1;
                const unit = costForTarget(target, cfg.costCurve);
                const runCfg: YunlingConfig = { ...cfg, equipLuck: luckNow };
                const attempts = rowsRef.current[target - 1]?.tries ?? 0;
                const r = drawOnce(target, 0, runCfg, attempts);

                setTotalTries((v) => v + 1);
                setTotalCost((v) => v + unit);
                setRows((prev) => {
                    const next = prev.map((row) => ({ ...row }));
                    next[target - 1] = { tries: next[target - 1].tries + 1, cost: next[target - 1].cost + unit };
                    return next;
                });

                if (r.success) {
                    setLevel(target);
                    setMsg({
                        ok: true,
                        level: target,
                        title: `蕴灵成功 · 蕴灵 +${target}`,
                        sub: LEVEL_ANNOUNCE[target] || '',
                    });
                } else {
                    const nextLuck = Math.min(LUCK_CAP, luckNow + 1);
                    setEquipLuck(nextLuck);
                    setMsg({
                        ok: false,
                        level: lv,
                        title: '蕴灵失败，装备幸运值增加',
                        // 幸运值变化已在小框进度条上体现，提示条只留结果（用户 2026-10-22 要求）
                        sub: '',
                    });
                }

                setBusy(false);
                onDone?.(r.success);
            }, delay);
        },
        [cfg, stopAll]
    );

    const handleDraw = useCallback(() => {
        if (busy) return;
        draw(FORGE_MS);
    }, [busy, draw]);

    const startAuto = useCallback(() => {
        if (stateRef.current.level >= YUNLING_MAX) return;
        autoRef.current = true;
        setAuto(true);
        const loop = () => {
            if (!autoRef.current) return;
            if (stateRef.current.level >= YUNLING_MAX) { stopAll(); return; }
            draw(AUTO_MS, () => {
                if (!autoRef.current) return;
                if (stateRef.current.level >= YUNLING_MAX) { stopAll(); return; }
                window.setTimeout(loop, 20);
            });
        };
        loop();
    }, [draw, stopAll]);

    // ── 读数 ──
    const target = Math.min(YUNLING_MAX, level + 1);
    const luck = luckBreakdown(cfg, 0);
    /** 本级已失败手数：驱动软保底与读数 */
    const attemptsInLevel = rows[Math.min(target, YUNLING_MAX) - 1]?.tries ?? 0;
    const curProb = level >= YUNLING_MAX ? 0 : displayProbPct(target, cfg, 0, attemptsInLevel);
    const unitCost = level >= YUNLING_MAX ? 0 : costForTarget(target, cfg.costCurve);
    /** 进度条按「当前档 → 下一档」的区间走，避免 16/1200 时条几乎不可见 */
    const luckRange = luckTierRange(EQUIP_LUCK_TIERS, equipLuck);
    const luckPct = luckRange.hi > luckRange.lo
        ? Math.max(0, Math.min(100, Math.round(((equipLuck - luckRange.lo) / (luckRange.hi - luckRange.lo)) * 100)))
        : 100;

    /** 小框流水：只列已开始过的档位 + 当前档 */
    const flowRows = useMemo(() => {
        const out: { lv: number; row: LevelRow; done: boolean; current: boolean }[] = [];
        for (let lv = 1; lv <= YUNLING_MAX; lv++) {
            const row = rows[lv - 1];
            const done = level >= lv;
            const current = level + 1 === lv;
            if (row.tries > 0 || current) out.push({ lv, row, done, current });
        }
        return out;
    }, [rows, level]);

    return (
        <div className={`w-full ${className || ''}`} style={{ containerType: 'inline-size' }}>
            <style>{`
                .ylf-scroll::-webkit-scrollbar { width: 5px; }
                .ylf-scroll::-webkit-scrollbar-track { background: rgba(8, 16, 24, 0.5); border-radius: 3px; }
                .ylf-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #38536e 0%, #1d3346 100%);
                    border: 1px solid #4a6c8e; border-radius: 3px;
                }
                @container (min-width: 700px) {
                    .ylf-layout { flex-direction: row !important; align-items: stretch !important; }
                    .ylf-equip { flex: 1 1 0%; min-width: 0; }
                    .ylf-side { width: 284px !important; min-width: 284px !important; flex: 0 0 284px !important; }
                }
                @container (max-width: 699px) {
                    .ylf-layout { flex-direction: column !important; }
                    .ylf-side { width: 100% !important; min-width: 0 !important; }
                }
                /* 窄卡片：六件部位整组换到第二行，分隔线隐藏，装备下拉独占一行 */
                @container (max-width: 619px) {
                    .ylf-slots { flex: 1 1 100%; flex-wrap: wrap; }
                    .ylf-sep { display: none; }
                    .ylf-equip-select { flex: 1 1 100%; }
                }
            `}</style>

            <div
                className="w-full rounded-[4px] p-3.5 select-none"
                style={{
                    background: 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)',
                    border: '1px solid #283e54',
                    fontFamily: SIM_FONT,
                    boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
            >
                {/* 标题栏 */}
                <div
                    className="relative flex items-center justify-between px-3 py-2 -mx-3.5 -mt-3.5 mb-3 rounded-t-[3px]"
                    style={{ background: 'linear-gradient(180deg, #192636 0%, #101a24 100%)', borderBottom: '1px solid #283e54' }}
                >
                    <div className="w-[46px]" />
                    <span
                        className="text-[16px] font-bold tracking-[3px]"
                        style={{ color: '#f7f4bb', textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000' }}
                    >
                        装备蕴灵
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowHelp((v) => !v)}
                        style={{ color: showHelp ? '#ffd94d' : '#6b89a8' }}
                        title="蕴灵规则"
                        className="hover:text-[#9bc2e6] transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>

                {/* 品质 + 部位 + 装备：宽卡片三者同行；620~900 时下拉自然落到第二行；
                    窄于 620px 时六件部位整组换行、下拉独占一行 */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-2.5" style={{ borderBottom: '1px solid #1a2a3b' }}>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {QUALITIES.map((q) => (
                            <button
                                key={q}
                                type="button"
                                onClick={() => handleQuality(q)}
                                className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                                style={chipStyle(quality === q, getEquipQualityColor(q))}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                    <span className="ylf-sep mx-1 h-3.5 w-px shrink-0" style={{ background: '#22384d' }} />
                    <div className="ylf-slots flex items-center gap-1.5 shrink-0">
                        {SHENJI_SLOTS.map((s) => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => handleSlot(s)}
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
                        className="ylf-equip-select flex-1 min-w-[170px] h-[26px] px-1.5 text-[12.5px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0]"
                    >
                        {candidates.length === 0 && <option value="">该组合暂无蕴灵装备</option>}
                        {candidates.map((e) => (
                            <option key={e.name} value={e.name}>{e.name}</option>
                        ))}
                    </select>
                </div>

                {showHelp && (
                    <div
                        className="mb-3 rounded-[3px] px-3 py-2 text-[12.5px] leading-[22px]"
                        style={{ background: 'rgba(16,32,48,.5)', border: '1px solid #2a415a', color: '#c7e6f7' }}
                    >
                        <div>蕴灵最终成功率 = 基础概率 ×（1 + 装备幸运值增益系数 + 个人幸运值增益系数）</div>
                        <div>装备幸运值增益系数：5→3%、10→5%、25→8%、50→10%、100→12%（失败 +1）</div>
                        <div>个人幸运值增益系数：25→2%、100→5%、550→10%、1000→12%、2000→15%</div>
                        <div>单级最多 300 手：超过 250 手后每多失败一手成功率递增，第 300 手必成</div>
                    </div>
                )}

                {/* 左装备 + 右信息框 */}
                <div className="ylf-layout flex flex-col gap-3">
                    <div className="ylf-equip min-w-0">
                        {equip ? (
                            <EquipDetailCard
                                item={equip}
                                allEquips={equips}
                                refLevel={level}
                                onRefLevelChange={(lv) => { stopAll(); setLevel(lv); }}
                                hideStepper
                                hideShenjiPool
                                className="!max-w-none !bg-transparent !border-0 !shadow-none !backdrop-blur-none !p-0"
                            />
                        ) : (
                            <div className="text-center text-[13px] text-[#5b7894] py-20">正在加载装备图鉴…</div>
                        )}
                    </div>

                    {/* 右侧小框 */}
                    <div
                        className="ylf-side flex flex-col min-w-0 rounded-[3px] p-2.5"
                        style={{
                            background: 'linear-gradient(180deg, #0f1a24 0%, #0a1219 100%)',
                            border: '1px solid #233547',
                            boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.6)',
                        }}
                    >
                        {/* 装备幸运值 */}
                        <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[12.5px] text-[#9bb8d4]">装备幸运值</span>
                            <span className="text-[13px] tabular-nums" style={{ color: '#4ce0f0' }}>
                                <b className="text-[14.5px]">{equipLuck}</b>
                                <span className="text-[#7a92a9]">/{luckRange.hi || LUCK_CAP}</span>
                            </span>
                        </div>
                        <div
                            className="relative overflow-hidden mt-1 mb-2"
                            style={{ height: 10, borderRadius: 3, background: '#081219', border: '1px solid #1b3040' }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    width: `${luckPct}%`,
                                    background: 'linear-gradient(90deg, #0c7585 0%, #15b8cf 55%, #6ff0c8 100%)',
                                    boxShadow: equipLuck > 0 ? '0 0 8px rgba(30,220,245,0.55)' : 'none',
                                    transition: 'width .35s ease-out',
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[12.5px]">
                            <span className="text-[#9bb8d4]">装备幸运值增益系数</span>
                            <b className="tabular-nums" style={{ color: '#ffd94d' }}>+{fmtPct(luck.equipBonus * 100)}%</b>
                        </div>
                        <div className="flex items-center justify-between text-[12.5px] mt-1">
                            <span className="text-[#9bb8d4]">个人幸运值</span>
                            <span className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    value={personLuck}
                                    min={0}
                                    max={2000}
                                    onChange={(e) => setPersonLuck(Math.max(0, Math.min(2000, Number(e.target.value) || 0)))}
                                    className="w-[54px] h-[22px] px-1 text-[12.5px] text-right tabular-nums rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#e6f1fa] outline-none focus:border-[#4d82b0]"
                                />
                                <b className="tabular-nums w-[40px] text-right" style={{ color: '#4ce0f0' }}>
                                    +{fmtPct(luck.personBonus * 100)}%
                                </b>
                            </span>
                        </div>

                        <div className="my-2.5 h-px" style={{ background: '#1a2d3e' }} />

                        {/* 当前档成功率 */}
                        <div className="text-center">
                            <div className="text-[12px] text-[#9bb8d4]">
                                {level >= YUNLING_MAX ? '已达 +15' : `+${level} → +${target} 成功率`}
                            </div>
                            <div
                                className="text-[24px] font-bold tabular-nums leading-tight"
                                style={{ color: level >= YUNLING_MAX ? '#7a92a9' : '#4ce0f0', textShadow: '0 0 12px rgba(76,224,240,0.35)' }}
                            >
                                {level >= YUNLING_MAX ? '—' : `${fmtPct(curProb)}%`}
                            </div>
                            <div className="text-[12px] text-[#9bb8d4] mt-0.5 tabular-nums">
                                每手 <b className="text-[13px] text-[#ffd94d]">{unitCost}</b> 月德符
                            </div>
                        </div>

                        <div className="my-2 h-px" style={{ background: '#1a2d3e' }} />

                        {/* 逐级流水：等级 / 手数 / 月德符（表头省略，靠列对齐区分） */}
                        <div ref={flowRef} className="ylf-scroll flex-1" style={{ minHeight: 120, maxHeight: 176, overflowY: 'auto' }}>
                            {flowRows.length === 0 && (
                                <div className="text-[12px] text-[#5b7894] text-center pt-6">尚未开始</div>
                            )}
                            {flowRows.map(({ lv, row, done, current }) => {
                                const exp = expectedLevel(lv, cfg);
                                const started = row.tries > 0;
                                return (
                                    <div
                                        key={lv}
                                        className="grid grid-cols-[1fr_48px_108px] text-[12.5px] tabular-nums leading-[20px] px-1 rounded-[2px]"
                                        style={{
                                            background: current ? 'rgba(30, 55, 74, 0.55)' : 'transparent',
                                        }}
                                    >
                                        <span style={{ color: done ? getYunlingColor(lv) : current ? '#9adfff' : '#7a92a9' }}>
                                            +{lv - 1} → +{lv}
                                        </span>
                                        <span className="text-right" style={{ color: started ? triesColor(row.tries) : '#5b7894' }}>
                                            {started ? row.tries : `~${exp.tries.toFixed(0)}`}
                                            <span style={{ color: started ? '#e6f1fa' : '#5b7894' }}> 手</span>
                                        </span>
                                        <span className="text-right">
                                            <span style={{ color: started ? '#ffd94d' : '#5b7894' }}>
                                                {started ? fmtInt(row.cost) : `~${fmtInt(exp.cost)}`}
                                            </span>
                                            <span style={{ color: '#ffffff' }}> 月德符</span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-2 pt-2 text-[12.5px] tabular-nums" style={{ borderTop: '1px solid #1a2d3e' }}>
                            <div className="grid grid-cols-[1fr_48px_108px] items-baseline px-1">
                                <span className="text-[#9bb8d4]">合计</span>
                                <span className="text-right text-[13.5px]" style={{ color: '#e6f1fa' }}>{totalTries} 手</span>
                                <span className="text-right">
                                    <b className="text-[13.5px] text-[#ffd94d]">{fmtInt(totalCost)}</b>
                                    <span style={{ color: '#ffffff' }}> 月德符</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 结果提示（成功对齐神机「已命中预设目标」语言） */}
                {msg && (() => {
                    // 成功：+11 起跟随蕴灵等级色（+11 绿 / +12 蓝 / +13 黄 / +14 紫 / +15 红），低等级用常规成功绿
                    const accent = msg.ok ? (msg.level >= 11 ? getYunlingColor(msg.level) : '#6fe8a8') : '#eda392';
                    return (
                        <div
                            className="mt-2.5 rounded-[2px] px-2.5 py-1.5 text-center animate-in fade-in duration-150"
                            style={
                                msg.ok
                                    ? { background: hexToRgba(accent, 0.13), border: `1px solid ${hexToRgba(accent, 0.5)}` }
                                    : { background: '#2a1a17', border: '1px solid #6b3a30' }
                            }
                        >
                            <div
                                className={`text-[12.5px] font-medium leading-[18px] ${msg.ok ? 'animate-pulse' : ''}`}
                                style={{ color: accent, textShadow: msg.ok ? `0 0 10px ${hexToRgba(accent, 0.45)}` : 'none' }}
                            >
                                {msg.title}
                            </div>
                            {msg.sub && (
                                <div
                                    className="text-[11.5px] leading-[16px] mt-0.5"
                                    style={{ color: msg.ok ? hexToRgba(accent, 0.75) : '#a5715f' }}
                                >
                                    {msg.sub}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* 读条 + 按钮 */}
                <div className="relative mt-3">
                    <div className="mx-auto" style={{ width: BAR_W }}>
                        <div
                            className="relative overflow-hidden"
                            style={{
                                width: BAR_W,
                                height: 10,
                                borderRadius: 999,
                                background: '#081219',
                                border: `1px solid ${busy ? '#389bb5' : '#182b38'}`,
                                boxShadow: busy
                                    ? 'inset 0 0 6px rgba(0,200,220,0.3), 0 0 8px rgba(0,200,220,0.4)'
                                    : 'inset 0 1px 3px rgba(0,0,0,0.8)',
                                transition: 'border-color .15s, box-shadow .15s',
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.round(barFill * 100)}%`,
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #0c7585 0%, #15b8cf 50%, #46e8fb 100%)',
                                    boxShadow: barFill > 0 ? '0 0 8px rgba(30,220,245,0.7)' : 'none',
                                    transition: barAnim ? `width ${(busy ? FORGE_MS : AUTO_MS) - 20}ms linear` : 'none',
                                }}
                            />
                        </div>

                        <div className="flex gap-2.5 mt-2.5">
                            <button
                                type="button"
                                disabled={busy || level >= YUNLING_MAX}
                                onClick={handleDraw}
                                className="flex-1 py-1.5 rounded-[3px] text-[13px] tracking-wider font-medium transition-all whitespace-nowrap"
                                style={btnStyle(!busy && level < YUNLING_MAX)}
                            >
                                蕴灵
                            </button>
                            <button
                                type="button"
                                disabled={!auto && level >= YUNLING_MAX}
                                onClick={() => { if (autoRef.current) { stopAll(); return; } startAuto(); }}
                                className="flex-1 py-1.5 rounded-[3px] text-[14px] tracking-wider font-medium transition-all"
                                style={btnStyle(auto || level < YUNLING_MAX, auto ? 'danger' : 'normal')}
                            >
                                {auto ? '停止' : '连点到 +15'}
                            </button>
                            <button
                                type="button"
                                onClick={resetAll}
                                className="px-3 py-1.5 rounded-[3px] text-[13px] shrink-0"
                                style={btnStyle(true)}
                            >
                                重置
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

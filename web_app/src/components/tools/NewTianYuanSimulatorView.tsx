import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import {
    Sparkles,
    HelpCircle,
    Swords,
    Shirt,
    HardHat,
    RefreshCw,
    RotateCcw,
    Square,
    Gem,
    Coins,
    ChevronRight,
} from 'lucide-react';
import type { TianyuanData, TianyuanItem, RolledAttr, RefineResult } from '../../utils/newTianyuanSim';
import {
    attrDisplayValue,
    attrDestinyBonus,
    formatAttrValue,
    rollItem,
    refineOnce,
    applyRuixiang,
    totalDestiny,
    triggerProbabilityFor,
} from '../../utils/newTianyuanSim';

/** 识图带入的初始值：具体是哪一件天缘（部位全名）+ 天命等级 */
export interface TianyuanSeed {
    groupName?: string;
    level?: number;
}

const FONT_SONG = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';

const SLOT_ICON: Record<string, React.ReactNode> = {
    blade: <Swords className="w-8 h-8" />,
    armor: <Shirt className="w-8 h-8" />,
    helmet: <HardHat className="w-8 h-8" />,
};

/** 游戏原生部位图标（带品质边框） */
const SLOT_IMG: Record<string, string> = {
    blade: '/game_data/equip_icons/slot_%E6%AD%A6%E5%99%A8.png',
    armor: '/game_data/equip_icons/slot_%E8%A1%A3%E6%9C%8D.png',
    helmet: '/game_data/equip_icons/slot_%E5%A4%B4%E7%9B%94.png',
};

function attrLabel(def: { id: number; name: string; unit: string }): string {
    if (def.unit === '' && (def.id === 0 || def.id === 2 || def.id === 3)) return `固定${def.name}`;
    return def.name;
}

export const NewTianYuanSimulatorView: React.FC<{ seed?: TianyuanSeed | null }> = ({ seed }) => {
    const [data, setData] = useState<TianyuanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [pieceKey, setPieceKey] = useState<string>('helmet');
    const [item, setItem] = useState<TianyuanItem | null>(null);
    const [successRate, setSuccessRate] = useState(0.5);
    const [stock, setStock] = useState<number[]>([17, 21, 26]);
    const [running, setRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [flash, setFlash] = useState<{ idx: number; ts: number } | null>(null);
    const [ruixiangOpen, setRuixiangOpen] = useState(false);
    const itemRef = useRef<TianyuanItem | null>(null);

    useEffect(() => {
        itemRef.current = item;
    }, [item]);

    useEffect(() => {
        let alive = true;
        fetch('/game_data/new_tianyuan_data.json')
            .then((r) => r.json())
            .then((d: TianyuanData) => {
                if (!alive) return;
                setData(d);
                const bySeed = seed?.groupName
                    ? d.pieces.find((p) => p.name === seed.groupName || p.name.includes(seed.groupName!) || seed.groupName!.includes(p.shortName))
                    : undefined;
                const piece = bySeed ?? d.pieces.find((p) => p.key === 'helmet') ?? d.pieces[0];
                setPieceKey(piece.key);
                setItem(rollItem(piece, d.countProbabilities));
                setLoading(false);
            })
            .catch((e) => {
                console.error('加载 new_tianyuan_data.json 失败', e);
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seed?.groupName]);

    const piece = useMemo(() => data?.pieces.find((p) => p.key === pieceKey) ?? data?.pieces[0], [data, pieceKey]);

    const regenerate = useCallback(
        (key?: string) => {
            if (!data) return;
            const nextPiece = data.pieces.find((p) => p.key === (key ?? pieceKey)) ?? data.pieces[0];
            setRunning(false);
            setLogs([]);
            setRuixiangOpen(false);
            setStock([17, 21, 26]);
            setItem(rollItem(nextPiece, data.countProbabilities));
        },
        [data, pieceKey],
    );

    const pushLog = useCallback((text: string) => {
        setLogs((prev) => [text, ...prev].slice(0, 12));
    }, []);

    const doRefine = useCallback(() => {
        if (!data) return;
        const current = itemRef.current;
        if (!current) return;
        if (current.level >= data.refine.maxLevel) {
            setRunning(false);
            return;
        }

        const next: TianyuanItem = {
            ...current,
            attrs: current.attrs.map((a) => ({ ...a })),
            settled: { ...current.settled },
        };
        const res: RefineResult = refineOnce(next, data, successRate);
        itemRef.current = next;
        setItem(next);
        setStock((prev) => prev.map((v) => (v > 1 ? v - 1 : 99)));

        if (res.success) {
            pushLog(`+${res.from} → +${res.to} 成功`);
            if (res.destinyGain > 0) {
                const idx = res.destinyHits[res.destinyHits.length - 1];
                if (typeof idx === 'number') setFlash({ idx, ts: Date.now() });
            }
        } else {
            pushLog(res.to === res.from ? `+${res.from} 失败` : `+${res.from} → +${res.to} 失败`);
        }

        if (next.level >= data.refine.maxLevel) setRunning(false);
    }, [data, successRate, pushLog]);

    useEffect(() => {
        if (!running) return;
        const timer = window.setInterval(doRefine, 260);
        return () => window.clearInterval(timer);
    }, [running, doRefine]);

    useEffect(() => {
        if (!flash) return;
        const t = window.setTimeout(() => setFlash(null), 900);
        return () => window.clearTimeout(t);
    }, [flash]);

    if (loading) {
        return (
            <div className="zx-card p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>正在加载新版天缘数据...</span>
            </div>
        );
    }

    if (!data || !piece || !item) {
        return <div className="zx-card p-8 text-center text-rose-400">数据加载失败，请刷新重试。</div>;
    }

    const maxLevel = data.refine.maxLevel;
    const destiny = totalDestiny(item);
    const triggerP = triggerProbabilityFor(item.attrs.length, data.triggerProbabilities);
    const canRuixiang = !item.ruixiangUsed && data.refine.ruixiangLevels.includes(item.level);

    return (
        <div className="flex flex-col gap-4 w-full max-w-[920px] mx-auto">
            {/* ── 外部控制条 ───────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-slate-100">新版天缘模拟器</div>
                        <div className="text-[11px] text-slate-400">
                            官方概率 · 3/4/5 条 60/30/10 · 天命触发 60/80/100
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
                    {data.pieces.map((p) => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => {
                                setPieceKey(p.key);
                                regenerate(p.key);
                            }}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                                p.key === pieceKey
                                    ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300'
                                    : 'text-slate-400 hover:text-slate-200 border border-transparent',
                            )}
                        >
                            {p.shortName}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => regenerate()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重新开箱
                    </button>
                    <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        title="重置已停用：精炼等级与天命只能通过精炼变化"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs font-bold text-slate-600 opacity-50 cursor-not-allowed"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        重置精炼
                    </button>
                </div>
            </div>

            {/* ── 游戏窗口 1:1 ──────────────────────────────── */}
            <div
                data-nt-window
                className="relative w-full mx-auto rounded-[3px] overflow-hidden"
                style={{
                    maxWidth: 900,
                    border: '1px solid #5b4a2c',
                    boxShadow: '0 18px 60px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255, 214, 120, 0.06)',
                    background: 'linear-gradient(180deg, #10141d 0%, #070a10 100%)',
                }}
            >
                {/* 顶部标题条 */}
                <div
                    className="relative flex items-center justify-center h-10 select-none"
                    style={{
                        background: 'linear-gradient(180deg, #302716 0%, #171a21 100%)',
                        borderBottom: '1px solid #4a3d24',
                    }}
                >
                    <span style={{ color: '#ffd272', fontFamily: FONT_SONG, fontSize: 16, letterSpacing: 1 }}>
                        {piece.name}
                    </span>
                    <HelpCircle className="absolute right-3 w-4 h-4" style={{ color: '#8d7a4e' }} />
                </div>

                <div className="flex flex-col lg:flex-row" style={{ minHeight: 400 }}>
                    {/* 左：装备 tooltip */}
                    <div
                        className="w-full lg:w-[41%] px-4 pt-4 pb-3 flex flex-col gap-3 min-w-0"
                        style={{
                            background: 'linear-gradient(180deg, #0a0e16 0%, #05080e 100%)',
                            borderRight: '1px solid #242c3c',
                        }}
                    >
                        <div className="flex gap-3">
                            <div
                                className="relative w-[62px] h-[62px] shrink-0 rounded-[2px] flex items-center justify-center overflow-hidden"
                                style={{
                                    border: '1px solid #8a5bd6',
                                    background: 'radial-gradient(circle at 50% 35%, #3b2569 0%, #170e2b 72%)',
                                    color: '#d9c2ff',
                                    boxShadow: 'inset 0 0 14px rgba(138,91,214,0.5)',
                                }}
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {SLOT_ICON[piece.key] ?? <Swords className="w-8 h-8" />}
                                </div>
                                <img
                                    src={SLOT_IMG[piece.key]}
                                    alt={piece.shortName}
                                    className="relative w-full h-full object-cover"
                                    onError={(e) => {
                                        e.currentTarget.style.visibility = 'hidden';
                                    }}
                                />
                            </div>
                            <div className="flex flex-col justify-center gap-[2px]" style={{ fontFamily: FONT_SONG }}>
                                <InfoLine label="境界" value="飞升" />
                                <InfoLine label="种族" value="无" />
                                <InfoLine label="门派" value="无" />
                                <InfoLine label="等级" value="160" />
                            </div>
                        </div>

                        <div className="flex flex-col gap-[2px] pt-1" style={{ fontFamily: FONT_SONG }}>
                            <div className="text-[14.5px] leading-[24px]" style={{ color: '#ffd272' }}>
                                天缘+{item.level}
                                {item.level >= maxLevel && <span style={{ color: '#ffe9a8' }}>（天命祝福）</span>}
                            </div>

                            {item.attrs.map((attr, idx) => (
                                <AttrLine
                                    key={`${attr.def.id}-${idx}`}
                                    attr={attr}
                                    level={item.level}
                                    cumulative={data.destinyCumulative}
                                    highlight={flash?.idx === idx}
                                />
                            ))}

                            {item.attrs.length === 0 && <div className="text-[12px] text-slate-500">暂无天缘属性</div>}
                        </div>

                        <div className="mt-auto pt-6 text-[11px] leading-[19px]" style={{ color: '#6f7a8d', fontFamily: FONT_SONG }}>
                            <div>已绑定；已锁定；不会掉落；不可卖店</div>
                            <div>
                                当前天命点 <span style={{ color: '#ffd272' }}>{destiny}</span> / 10
                                <span className="mx-1.5" style={{ color: '#39414f' }}>|</span>
                                条目 {item.attrs.length} 条 · 触发率 {(triggerP * 100).toFixed(0)}%
                            </div>
                        </div>
                    </div>

                    {/* 右：天缘属性精炼 */}
                    <div
                        className="flex-1 px-5 pt-4 pb-4 flex flex-col gap-3 min-w-0"
                        style={{ background: 'linear-gradient(180deg, #0b1018 0%, #070b12 100%)' }}
                    >
                        <div className="relative flex items-center justify-center">
                            <span style={{ color: '#ffd272', fontFamily: FONT_SONG, fontSize: 16, letterSpacing: 1 }}>
                                天缘属性精炼
                            </span>
                            <HelpCircle className="absolute right-0 w-4 h-4" style={{ color: '#8d7a4e' }} />
                        </div>

                        {/* 材料槽 */}
                        <div className="flex items-start justify-center gap-4 pt-1.5">
                            <MaterialSlot icon={<Gem className="w-7 h-7" />} count={stock[0]} label="精炼石" tint="#6f8cff" />
                            <MaterialSlot icon={<Gem className="w-7 h-7" />} count={stock[1]} label="精炼石" tint="#58c98a" />
                            <MaterialSlot icon={<Gem className="w-7 h-7" />} count={stock[2]} label="精炼石" tint="#e3a24a" />
                            <button
                                type="button"
                                onClick={() => setRuixiangOpen((v) => !v)}
                                className="flex flex-col items-center gap-1 cursor-pointer group"
                                title="使用瑞祥符：指定一条属性获得 3 次天命强化"
                            >
                                <div
                                    className="relative w-[64px] h-[64px] rounded-[2px] flex items-center justify-center transition-all"
                                    style={{
                                        border: `1px solid ${ruixiangOpen ? '#ffd272' : '#6b5a33'}`,
                                        background: 'radial-gradient(circle at 50% 35%, #4a2f18 0%, #1a1108 76%)',
                                        color: '#ffcf6b',
                                        filter: canRuixiang ? 'none' : 'grayscale(0.35) brightness(0.9)',
                                    }}
                                >
                                    <Sparkles className="w-7 h-7" />
                                    <span className="absolute bottom-0 right-1 text-[10px] font-mono text-slate-200">
                                        {item.ruixiangUsed ? 0 : 1}
                                    </span>
                                </div>
                                <span className="text-[11.5px]" style={{ color: '#cfc6b4', fontFamily: FONT_SONG }}>
                                    祝福石
                                </span>
                            </button>
                        </div>

                        {/* 瑞祥符选属性 */}
                        {ruixiangOpen && (
                            <div className="rounded-[3px] border border-amber-500/30 bg-black/50 px-2.5 py-2">
                                <div className="text-[11px] text-amber-200/80 mb-1.5" style={{ fontFamily: FONT_SONG }}>
                                    指定一条属性，必定获得 {data.refine.ruixiangPoints} 次天命强化
                                    {!canRuixiang && (
                                        <span className="text-rose-300 ml-1">
                                            （需在 +{data.refine.ruixiangLevels.join('/+')} 使用，每件一次）
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {item.attrs.map((attr, idx) => (
                                        <button
                                            key={`${attr.def.id}-${idx}`}
                                            type="button"
                                            disabled={!canRuixiang}
                                            onClick={() => {
                                                const res = applyRuixiang(item, idx, data);
                                                if (res.ok) {
                                                    const next = { ...item, attrs: item.attrs.map((a) => ({ ...a })), ruixiangUsed: true };
                                                    setItem(next);
                                                    itemRef.current = next;
                                                    setRuixiangOpen(false);
                                                    setFlash({ idx, ts: Date.now() });
                                                    pushLog(`瑞祥符 → ${attr.def.name} 天命 +${res.gain}`);
                                                }
                                            }}
                                            className={clsx(
                                                'px-2 py-1 rounded-sm text-[11px] border transition-colors',
                                                canRuixiang
                                                    ? 'border-amber-500/40 text-amber-200 hover:bg-amber-500/20 cursor-pointer'
                                                    : 'border-slate-700 text-slate-500 cursor-not-allowed',
                                            )}
                                        >
                                            {attrLabel(attr.def)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 连续精炼 */}
                        <button
                            type="button"
                            onClick={() => setRunning((v) => !v)}
                            disabled={item.level >= maxLevel}
                            className={clsx(
                                'mx-auto mt-0.5 w-[220px] h-8 rounded-[2px] text-[13px] font-bold transition-all border',
                                item.level >= maxLevel ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-125',
                            )}
                            style={{
                                fontFamily: FONT_SONG,
                                color: '#ffe6a8',
                                borderColor: '#6b5a33',
                                background: 'linear-gradient(180deg, #3a2f1a 0%, #1d1810 100%)',
                            }}
                        >
                            {running ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <Square className="w-3 h-3" /> 停止连续精炼
                                </span>
                            ) : (
                                '连续精炼'
                            )}
                        </button>

                        {/* 花费金钱 */}
                        <div className="flex items-center justify-center gap-3 text-[12px]" style={{ fontFamily: FONT_SONG }}>
                            <span style={{ color: '#d6cbb4' }}>花费金钱</span>
                            <span
                                className="inline-flex items-center gap-1.5 px-3 py-[3px] rounded-[2px]"
                                style={{ background: '#05080e', border: '1px solid #2c3446' }}
                            >
                                <span className="font-mono text-[13px] min-w-[20px] text-right" style={{ color: '#f2f5fa' }}>
                                    {data.refine.costGold}
                                </span>
                                <Coins className="w-4 h-4" style={{ color: '#e8c76a' }} />
                                <span className="font-mono text-[12px] min-w-[12px] text-right ml-1.5" style={{ color: '#9aa5b8' }}>
                                    0
                                </span>
                                <Coins className="w-4 h-4" style={{ color: '#c8cfda' }} />
                                <span className="font-mono text-[12px] min-w-[12px] text-right ml-1.5" style={{ color: '#9aa5b8' }}>
                                    0
                                </span>
                                <Coins className="w-4 h-4" style={{ color: '#c08752' }} />
                            </span>
                        </div>

                        {/* 单次 / 取消 */}
                        <div className="flex items-center justify-center gap-4 pt-0.5">
                            <GameButton disabled={item.level >= maxLevel} onClick={doRefine}>
                                单次精炼
                            </GameButton>
                            <GameButton
                                onClick={() => {
                                    setRunning(false);
                                    setRuixiangOpen(false);
                                }}
                            >
                                取消
                            </GameButton>
                        </div>

                        {/* 规则红字 */}
                        <div className="mt-1 text-[12px] leading-[20px]" style={{ color: '#ff4141', fontFamily: FONT_SONG }}>
                            <div>1.精炼等级达到3、6、9、10级时有概率触发天命；</div>
                            <div>2.天缘属性的条目越多，触发天命的概率越大；</div>
                            <div>3.精炼等级为2、5、8级时可以使用瑞祥符，必定令指定属性触发3次天命强化；</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 模拟参数与日志 ─────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-200">精炼成功率</span>
                        <span className="font-mono text-amber-300 font-black">{(successRate * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min={5}
                        max={95}
                        step={1}
                        value={Math.round(successRate * 100)}
                        onChange={(e) => setSuccessRate(Number(e.target.value) / 100)}
                        className="w-full accent-amber-400 cursor-pointer"
                    />
                    <p className="text-[11px] text-slate-400 leading-5">
                        官方未公布天缘精炼成功率，此处为可调参数。失败掉 1 级，+3/+6/+9 为保底档。
                    </p>

                    <div className="grid grid-cols-3 gap-2">
                        <Stat label="当前等级" value={`+${item.level}`} />
                        <Stat label="天命点" value={`${destiny}/10`} />
                        <Stat label="条目数" value={`${item.attrs.length}`} />
                    </div>
                </div>

                <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-2 min-h-[168px]">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-200">精炼日志</span>
                        <span className="text-[11px] text-slate-500">最近 12 条</span>
                    </div>
                    <div className="flex flex-col gap-1 overflow-y-auto max-h-[132px] pr-1">
                        {logs.length === 0 && (
                            <span className="text-[11px] text-slate-500">点击「单次精炼」或「连续精炼」开始推演</span>
                        )}
                        {logs.map((l, i) => (
                            <div key={`${l}-${i}`} data-nt-log className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300">
                                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                                <span
                                    className={clsx(
                                        l.includes('失败') ? 'text-rose-300' : l.includes('成功') ? 'text-amber-300' : 'text-slate-300',
                                    )}
                                >
                                    {l}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── 理论上限对照（对齐 Excel） ─────────────────── */}
            <details className="bg-slate-900/70 border border-slate-800/80 rounded-2xl px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-200 select-none">
                    理论上限对照 · {piece.shortName}（天缘+10）
                    <span className="ml-2 text-[11px] font-normal text-slate-500">
                        天命+5 / +10 为天命点全部堆到同一条属性的极限
                    </span>
                </summary>
                <div className="overflow-x-auto mt-3">
                    <table className="w-full text-[11px] border-collapse">
                        <thead>
                            <tr className="text-slate-400 border-b border-slate-700/70">
                                <th className="text-left py-1.5 pr-2 font-semibold">属性</th>
                                <th className="text-right py-1.5 px-2 font-semibold">初始范围</th>
                                <th className="text-right py-1.5 px-2 font-semibold">每级+</th>
                                <th className="text-right py-1.5 px-2 font-semibold">概率</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-slate-300">天命+0</th>
                                <th className="text-right py-1.5 px-2 font-semibold text-amber-300/90">天命+5</th>
                                <th className="text-right py-1.5 pl-2 font-semibold text-amber-300">天命+10</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {piece.attributes.map((a) => {
                                const base = (a.max + 10 * a.perLevel) * a.displayScale;
                                const p5 = base + data.destinyCumulative[4] * a.perLevel * a.displayScale;
                                const p10 = base + data.destinyCumulative[9] * a.perLevel * a.displayScale;
                                return (
                                    <tr key={`${a.id}-${a.name}-${a.weight}`} className="text-slate-300">
                                        <td className="py-1.5 pr-2 whitespace-nowrap">{attrLabel(a)}</td>
                                        <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                                            {formatAttrValue(a, a.min * a.displayScale)} ~ {formatAttrValue(a, a.max * a.displayScale)}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-slate-400">
                                            +{formatAttrValue(a, a.perLevel * a.displayScale)}
                                        </td>
                                        <td className="py-1.5 px-2 text-right font-mono text-cyan-400">{(a.weight * 100).toFixed(1)}%</td>
                                        <td className="py-1.5 px-2 text-right font-mono">{formatAttrValue(a, base)}</td>
                                        <td className="py-1.5 px-2 text-right font-mono text-amber-200/80">{formatAttrValue(a, p5)}</td>
                                        <td className="py-1.5 pl-2 text-right font-mono text-amber-300 font-bold">{formatAttrValue(a, p10)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-5">
                    天命累计系数：{data.destinyCumulative.join(' / ')}（对应天命 +1 ~ +10）。
                    数据源：elements.data idx425 官方配置，与《新版天缘天命.xlsx》逐项一致。
                </p>
            </details>
        </div>
    );
};

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-baseline gap-2">
        <span style={{ color: '#8f9bb0', fontSize: 13.5 }}>{label}</span>
        <span style={{ color: '#e8edf5', fontSize: 13.5 }}>{value}</span>
    </div>
);

const AttrLine: React.FC<{
    attr: RolledAttr;
    level: number;
    cumulative: number[];
    highlight: boolean;
}> = ({ attr, level, cumulative, highlight }) => {
    const value = attrDisplayValue(attr, level, cumulative);
    const bonus = attrDestinyBonus(attr, cumulative);
    return (
        <div
            data-nt-row
            className={clsx(
                'flex items-baseline gap-2 rounded-sm px-1 -mx-1 transition-colors duration-500',
                highlight ? 'bg-amber-400/20' : 'bg-transparent',
            )}
            style={{ fontFamily: FONT_SONG, fontSize: 15.5, lineHeight: '25px' }}
            title={bonus > 0 ? `其中天命加成 +${formatAttrValue(attr.def, bonus)}` : undefined}
        >
            <span className="shrink-0" style={{ color: '#6cfb4b', width: 64 }}>
                {attr.destinyPoints > 0 ? `天命+${attr.destinyPoints}` : '天命'}
            </span>
            <span style={{ color: '#8d8dff' }}>
                {attrLabel(attr.def)} +{formatAttrValue(attr.def, value)}
            </span>
        </div>
    );
};

const MaterialSlot: React.FC<{ icon: React.ReactNode; count: number; label: string; tint: string }> = ({
    icon,
    count,
    label,
    tint,
}) => (
    <div className="flex flex-col items-center gap-1">
        <div
            className="relative w-[64px] h-[64px] rounded-[2px] flex items-center justify-center"
            style={{
                border: '1px solid #6b5a33',
                background: 'radial-gradient(circle at 50% 35%, #1b2436 0%, #080d15 78%)',
                color: tint,
            }}
        >
            <span style={{ filter: `drop-shadow(0 0 6px ${tint}99)` }}>{icon}</span>
            <span className="absolute bottom-0 right-1 text-[10px] font-mono text-slate-200">{count}</span>
        </div>
        <span className="text-[11.5px]" style={{ color: '#cfc6b4', fontFamily: FONT_SONG }}>
            {label}
        </span>
    </div>
);

const GameButton: React.FC<{ children: React.ReactNode; onClick?: () => void; disabled?: boolean }> = ({
    children,
    onClick,
    disabled,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={clsx(
            'w-[116px] h-[30px] rounded-[2px] text-[13px] font-bold transition-all border',
            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-125',
        )}
        style={{
            fontFamily: FONT_SONG,
            color: '#e9e2d2',
            borderColor: '#5a4c30',
            background: 'linear-gradient(180deg, #2a2419 0%, #15120d 100%)',
        }}
    >
        {children}
    </button>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div data-nt-stat className="rounded-lg bg-slate-950/60 border border-slate-800 px-2 py-1.5">
        <div className="text-[10px] text-slate-500">{label}</div>
        <div className="font-mono text-sm font-bold text-slate-200">{value}</div>
    </div>
);

export default NewTianYuanSimulatorView;

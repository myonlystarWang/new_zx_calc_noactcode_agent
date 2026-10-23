import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { HelpCircle, RotateCw, Square, X, Swords, Shirt, HardHat } from 'lucide-react';
import type { TianyuanData, TianyuanItem, RolledAttr, RefineResult } from '../../utils/newTianyuanSim';
import { NewTianyuanDetailCard, type NewTianyuanData as DetailTianyuanData } from './NewTianyuanDetailCard';
import {
    attrDisplayValue,
    attrDestinyBonus,
    formatAttrValue,
    rollItem,
    refineOnce,
    resetItem,
    totalDestiny,
} from '../../utils/newTianyuanSim';

export interface NewTianyuanSimCardProps {
    cardData?: {
        data?: TianyuanData;
        initialGroupName?: string;
    };
    className?: string;
}

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
const SUCCESS_RATE = 0.5;
/** 读条时长（对齐蕴灵 1s） */
const REFINE_MS = 1000;
/** 左窗属性区固定预留 7 条高度，鉴定出 3 条也不塌 */
const ATTR_SLOT_H = 7 * 22;
/** 装备基础属性蓝（与 EquipDetailCard / COLORS.STAT_BLUE 一致） */
const STAT_BLUE = '#8080ff';

/** 诛仙3 经典炼器等级色（0 白 + 1~10，17173 十六进制原值） */
const REFINE_COLORS = [
    '#ffffff', // +0
    '#f2d3ff', // +1
    '#bcffd2', // +2
    '#fff38e', // +3
    '#ffc0db', // +4
    '#ff00ff', // +5
    '#95aeff', // +6
    '#426aff', // +7
    '#6dffff', // +8
    '#45ff45', // +9
    '#c5ff54', // +10
];

const SLOT_IMG: Record<string, string> = {
    blade: '/game_data/equip_icons/tianyuan_blade.png',
    armor: '/game_data/equip_icons/tianyuan_armor.png',
    helmet: '/game_data/equip_icons/tianyuan_helmet.png',
};

const SLOT_FALLBACK: Record<string, React.ReactNode> = {
    blade: <Swords className="w-7 h-7" />,
    armor: <Shirt className="w-7 h-7" />,
    helmet: <HardHat className="w-7 h-7" />,
};

const CARD_STYLE: React.CSSProperties = {
    background: 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)',
    border: '1px solid #283e54',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    fontFamily: SIM_FONT,
};

const TITLE_BAR_STYLE: React.CSSProperties = {
    background: 'linear-gradient(180deg, #192636 0%, #101a24 100%)',
    borderBottom: '1px solid #283e54',
};

/** 标题样式与 ShenjiForgeCard 完全一致（16px / 3px 字距 / 米金 + 光晕） */
const TITLE_TEXT_STYLE: React.CSSProperties = {
    color: '#f7f4bb',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 3,
    textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000',
};

/** 神机同款切换按钮（须弥刃/甲/盔） */
function tabStyle(active: boolean): React.CSSProperties {
    return active
        ? {
              background: '#1b3348',
              border: '1px solid #5f8fc9',
              color: '#d6ecff',
              boxShadow: '0 0 8px rgba(70,232,251,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
              fontFamily: SIM_FONT,
          }
        : {
              background: '#0f1a26',
              border: '1px solid #2a415a',
              color: '#9fb6c9',
              fontFamily: SIM_FONT,
          };
}

/** 装备 tooltip 右侧竖排按钮（紫黑底 + 银紫边） */
const sideBtnStyle: React.CSSProperties = {
    background: 'linear-gradient(180deg, #2b2a45 0%, #17162a 100%)',
    border: '1px solid #574f86',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 5px rgba(0,0,0,0.5)',
    color: '#e6e1ff',
    borderRadius: 2,
    fontFamily: SIM_FONT,
    fontSize: 12,
    padding: '4px 0',
    cursor: 'pointer',
};

/** 蕴灵同款按钮 */
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

function attrLabel(def: { id: number; name: string; unit: string }): string {
    if (def.unit === '' && (def.id === 0 || def.id === 2 || def.id === 3)) return `固定${def.name}`;
    return def.name;
}

export const NewTianyuanSimCard: React.FC<NewTianyuanSimCardProps> = ({ cardData, className }) => {
    const [data, setData] = useState<TianyuanData | null>(cardData?.data ?? null);
    const [pieceKey, setPieceKey] = useState<string>('helmet');
    const [item, setItem] = useState<TianyuanItem | null>(null);
    const [busy, setBusy] = useState(false);
    const [auto, setAuto] = useState(false);
    const [barFill, setBarFill] = useState(0);
    const [barAnim, setBarAnim] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; level: number; title: string } | null>(null);
    const [flash, setFlash] = useState<number | null>(null);
    /** 已施加瑞祥符的属性下标（null = 未使用）；再点图标可回退 */
    const [blessIdx, setBlessIdx] = useState<number | null>(null);
    /** 瑞祥符属性选择面板是否展开（未选中前不消耗次数） */
    const [ruixiangOpen, setRuixiangOpen] = useState(false);
    /** 已选属性，等待下一次精炼（该次 100% 成功）后 +3 */
    const [pendingBless, setPendingBless] = useState<number | null>(null);
    /** 点左侧「精炼」后才打开右窗 */
    const [refineOpen, setRefineOpen] = useState(false);
    /** 展开新版天缘信息卡 */
    const [showInfo, setShowInfo] = useState(false);

    const itemRef = useRef<TianyuanItem | null>(null);
    const autoRef = useRef(false);
    const busyRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const barRef = useRef<number | null>(null);
    const pendingRef = useRef<number | null>(null);

    useEffect(() => {
        itemRef.current = item;
    }, [item]);
    useEffect(() => {
        busyRef.current = busy;
    }, [busy]);
    useEffect(() => {
        pendingRef.current = pendingBless;
    }, [pendingBless]);

    useEffect(() => {
        if (data) return;
        let alive = true;
        fetch('/game_data/new_tianyuan_data.json')
            .then((r) => r.json())
            .then((d: TianyuanData) => {
                if (alive) setData(d);
            })
            .catch((e) => console.error('加载 new_tianyuan_data.json 失败', e));
        return () => {
            alive = false;
        };
    }, [data]);

    useEffect(() => {
        if (!data || item) return;
        const seedName = cardData?.initialGroupName;
        const bySeed = seedName
            ? data.pieces.find((p) => p.name === seedName || p.name.includes(seedName) || seedName.includes(p.shortName))
            : undefined;
        const piece = bySeed ?? data.pieces.find((p) => p.key === 'helmet') ?? data.pieces[0];
        setPieceKey(piece.key);
        setItem(rollItem(piece, data.countProbabilities));
    }, [data, item, cardData?.initialGroupName]);

    const piece = useMemo(() => data?.pieces.find((p) => p.key === pieceKey) ?? data?.pieces[0], [data, pieceKey]);

    const stopAll = useCallback(() => {
        autoRef.current = false;
        setAuto(false);
        setBusy(false);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (barRef.current) {
            window.clearTimeout(barRef.current);
            barRef.current = null;
        }
        setBarFill(0);
        setBarAnim(false);
    }, []);

    useEffect(() => stopAll, [stopAll]);

    useEffect(() => {
        if (flash === null) return;
        const t = window.setTimeout(() => setFlash(null), 900);
        return () => window.clearTimeout(t);
    }, [flash]);

    const draw = useCallback(
        (delay: number, onDone?: (success: boolean) => void) => {
            if (!data) return;
            const current = itemRef.current;
            if (!current || current.level >= data.refine.maxLevel) {
                stopAll();
                return;
            }

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
                const cur = itemRef.current;
                if (!cur) return;
                if (cur.level >= data.refine.maxLevel) {
                    stopAll();
                    return;
                }

                const next: TianyuanItem = {
                    ...cur,
                    attrs: cur.attrs.map((a) => ({ ...a })),
                    settled: { ...cur.settled },
                };
                const blessIdxNow = pendingRef.current;
                const forced = blessIdxNow !== null;
                const res: RefineResult = refineOnce(next, data, forced ? 1 : SUCCESS_RATE);

                // 瑞祥符：本次必定成功，读条结束后指定属性 +3 次天命
                let blessGain = 0;
                if (forced && res.success && blessIdxNow !== null) {
                    const target = next.attrs[blessIdxNow];
                    if (target) {
                        for (let i = 0; i < data.refine.ruixiangPoints; i++) {
                            if (totalDestiny(next) >= 10) break;
                            target.destinyPoints = Math.min(10, target.destinyPoints + 1);
                            blessGain++;
                        }
                    }
                    pendingRef.current = null;
                    setPendingBless(null);
                }

                itemRef.current = next;
                setItem(next);

                if (res.success) {
                    const idx = res.destinyHits[res.destinyHits.length - 1];
                    if (typeof idx === 'number') setFlash(idx);
                    if (blessGain > 0 && blessIdxNow !== null) {
                        setBlessIdx(blessIdxNow);
                        setFlash(blessIdxNow);
                        setMsg({
                            ok: true,
                            level: next.level,
                            title: `天命祝福 · ${next.attrs[blessIdxNow]?.def.name ?? ''} +${blessGain}`,
                        });
                    } else {
                        setMsg({ ok: true, level: next.level, title: `精炼成功 · 天缘 +${next.level}` });
                    }
                } else {
                    setMsg({ ok: false, level: next.level, title: '精炼失败' });
                }

                setBusy(false);
                onDone?.(res.success);

                if (next.level >= data.refine.maxLevel) {
                    autoRef.current = false;
                    setAuto(false);
                }
            }, delay);
        },
        [data, stopAll],
    );

    const handleSingle = useCallback(() => {
        if (busyRef.current) return;
        draw(REFINE_MS);
    }, [draw]);

    const toggleAuto = useCallback(() => {
        if (autoRef.current) {
            stopAll();
            return;
        }
        if (!data) return;
        if ((itemRef.current?.level ?? 0) >= data.refine.maxLevel) return;
        autoRef.current = true;
        setAuto(true);
        const loop = () => {
            if (!autoRef.current) return;
            if (!data || (itemRef.current?.level ?? 0) >= data.refine.maxLevel) {
                stopAll();
                return;
            }
            draw(REFINE_MS, () => {
                if (!autoRef.current) return;
                window.setTimeout(loop, 20);
            });
        };
        loop();
    }, [data, draw, stopAll]);

    const regenerate = useCallback(
        (key?: string) => {
            if (!data) return;
            const nextPiece = data.pieces.find((p) => p.key === (key ?? pieceKey)) ?? data.pieces[0];
            stopAll();
            setMsg(null);
            setBlessIdx(null);
            setRuixiangOpen(false);
            setPendingBless(null);
            pendingRef.current = null;
            setItem(rollItem(nextPiece, data.countProbabilities));
        },
        [data, pieceKey, stopAll],
    );

    const resetLevel = useCallback(() => {
        stopAll();
        setMsg(null);
        setBlessIdx(null);
        setRuixiangOpen(false);
        setPendingBless(null);
        pendingRef.current = null;
        setItem((prev) => (prev ? resetItem(prev) : prev));
    }, [stopAll]);

    /** 瑞祥符：点一次施加（第一条属性 +3 天命），再点取消并回退 */
    const toggleRuixiang = useCallback(() => {
        if (!data || !item) return;

        // 已选中/已生效 → 撤销：回退天命并恢复可用
        if (item.ruixiangUsed) {
            const next: TianyuanItem = {
                ...item,
                attrs: item.attrs.map((a) => ({ ...a })),
                settled: { ...item.settled },
                ruixiangUsed: false,
            };
            if (blessIdx !== null) {
                const a = next.attrs[blessIdx];
                if (a) a.destinyPoints = Math.max(0, a.destinyPoints - data.refine.ruixiangPoints);
            }
            setItem(next);
            itemRef.current = next;
            setPendingBless(null);
            pendingRef.current = null;
            setBlessIdx(null);
            setMsg({ ok: false, level: next.level, title: '已取消瑞祥符' });
            return;
        }

        // 面板已展开 → 收起（不消耗）
        if (ruixiangOpen) {
            setRuixiangOpen(false);
            return;
        }
        if (!data.refine.ruixiangLevels.includes(item.level)) {
            setMsg({
                ok: false,
                level: item.level,
                title: `瑞祥符仅 +${data.refine.ruixiangLevels.join('/+')} 可用`,
            });
            return;
        }
        setRuixiangOpen(true);
    }, [data, item, ruixiangOpen, blessIdx]);

    /** 选中一条属性 → 就绪，下一次精炼必定成功并 +3 次天命 */
    const chooseRuixiang = useCallback(
        (idx: number) => {
            if (!data || !item || item.ruixiangUsed) return;
            // 等级限制：选项只在 +2/+5/+8 有效，等级变了就作废
            if (!data.refine.ruixiangLevels.includes(item.level)) {
                setRuixiangOpen(false);
                setMsg({
                    ok: false,
                    level: item.level,
                    title: `瑞祥符仅 +${data.refine.ruixiangLevels.join('/+')} 可用`,
                });
                return;
            }
            const attr = item.attrs[idx];
            if (!attr) return;
            const next: TianyuanItem = {
                ...item,
                attrs: item.attrs.map((a) => ({ ...a })),
                settled: { ...item.settled },
                ruixiangUsed: true,
            };
            setItem(next);
            itemRef.current = next;
            setPendingBless(idx);
            pendingRef.current = idx;
            setRuixiangOpen(false);
            setMsg({
                ok: true,
                level: next.level,
                title: `瑞祥符已就绪：下次精炼必定成功 · ${attr.def.name} +${data.refine.ruixiangPoints}`,
            });
        },
        [data, item],
    );

    // 等级离开 +2/+5/+8 时，未选中的面板自动收起，避免越级选择
    useEffect(() => {
        if (!data || !ruixiangOpen) return;
        if (!data.refine.ruixiangLevels.includes(item?.level ?? -1)) {
            setRuixiangOpen(false);
        }
    }, [data, item?.level, ruixiangOpen]);

    if (!data || !piece || !item) {
        return (
            <div className={clsx('w-full rounded-[4px] border border-[#283e54] bg-[#0c1219] p-4 text-[13px] text-[#7f9ab0]', className)}>
                正在载入新版天缘数据…
            </div>
        );
    }

    const maxLevel = data.refine.maxLevel;
    const canRuixiang = !item.ruixiangUsed && data.refine.ruixiangLevels.includes(item.level);
    const levelColor = REFINE_COLORS[Math.min(item.level, REFINE_COLORS.length - 1)];

    return (
        <div className={clsx('@container w-full min-w-0', className)}>
            <style>{`
                @container (min-width: 820px) {
                    .nt-sim-layout { flex-direction: row !important; align-items: flex-start !important; }
                    .nt-sim-left { width: 380px !important; max-width: 380px !important; flex: 0 0 380px !important; }
                    .nt-sim-right { width: 400px !important; max-width: 400px !important; flex-shrink: 0 !important; }
                }
                @container (max-width: 819px) {
                    .nt-sim-layout { flex-direction: column !important; }
                    .nt-sim-left, .nt-sim-right { width: 100% !important; max-width: 100% !important; }
                }
            `}</style>

            <div className="nt-sim-layout flex flex-col gap-3 w-full min-w-0" data-open={refineOpen ? 'true' : 'false'}>
                {/* ── 窗口 1：装备 ─────────────────────────── */}
                <div className="nt-sim-left w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE}>
                    <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                        <span style={TITLE_TEXT_STYLE}>{piece.name}</span>
                        <div className="absolute right-3 flex items-center gap-2">
                            <button type="button" onClick={() => regenerate()} title="重新鉴定" className="cursor-pointer hover:brightness-150">
                                <RotateCw className="w-3.5 h-3.5" style={{ color: '#5b7894' }} />
                            </button>
                            <HelpCircle className="w-3.5 h-3.5" style={{ color: '#5b7894' }} />
                        </div>
                    </div>

                    {/* 部位切换（神机同款按钮 + 上下分割） */}
                    <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid #283e54', background: '#0d1620' }}>
                        {data.pieces.map((p) => {
                            const active = p.key === pieceKey;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => {
                                        setPieceKey(p.key);
                                        regenerate(p.key);
                                    }}
                                    className="px-3.5 py-1.5 rounded-[3px] text-[12px] transition-colors cursor-pointer whitespace-nowrap"
                                    style={tabStyle(active)}
                                >
                                    {p.shortName}
                                </button>
                            );
                        })}
                    </div>

                    {/* 内容 + 右侧竖排按钮（鉴定 / 精炼 / 重置） */}
                    <div className="p-3 flex gap-2 flex-1 min-w-0">
                        <div className="flex-1 min-w-0 flex flex-col gap-3">
                            <div className="flex items-start gap-2.5">
                                <div className="relative w-[62px] h-[62px] shrink-0">
                                    <div className="absolute inset-0 flex items-center justify-center" style={{ color: '#d9c2ff' }}>
                                        {SLOT_FALLBACK[piece.key] ?? <Swords className="w-7 h-7" />}
                                    </div>
                                    <img
                                        src={SLOT_IMG[piece.key]}
                                        alt={piece.shortName}
                                        className="relative w-full h-full object-contain"
                                        onError={(e) => {
                                            e.currentTarget.style.visibility = 'hidden';
                                        }}
                                    />
                                </div>
                                <div className="min-w-0 flex flex-col justify-center gap-[1px] pt-0.5">
                                    <InfoLine label="境界" value="飞升" />
                                    <InfoLine label="种族" value="无" />
                                    <InfoLine label="门派" value="无" />
                                    <InfoLine label="等级" value="160" />
                                </div>
                            </div>

                            <div>
                                <div
                                    className="text-[14px] leading-[23px]"
                                    style={{ color: levelColor, textShadow: item.level > 0 ? `0 0 8px ${levelColor}55` : 'none' }}
                                >
                                    天缘+{item.level}
                                    {blessIdx !== null && <span>（天命祝福）</span>}
                                </div>
                                <div style={{ minHeight: ATTR_SLOT_H }} className="flex flex-col gap-[1px]">
                                    {item.attrs.map((attr, idx) => (
                                        <SimAttrLine
                                            key={`${attr.def.id}-${idx}`}
                                            attr={attr}
                                            level={item.level}
                                            cumulative={data.destinyCumulative}
                                            highlight={flash === idx}
                                        />
                                    ))}
                                </div>
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setShowInfo((v) => !v)}
                                        className="mt-1 text-[12px] cursor-pointer hover:brightness-125 transition-all"
                                        style={{ color: '#9adfff' }}
                                    >
                                        {showInfo ? '收起新天缘信息卡 ▲' : '查看新天缘信息卡 ▼'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="w-[62px] shrink-0 flex flex-col gap-2 pt-0.5">
                            <button type="button" onClick={() => regenerate()} style={sideBtnStyle} title="鉴定：重抽词条与初始值">
                                鉴定
                            </button>
                            <button
                                type="button"
                                onClick={() => setRefineOpen(true)}
                                disabled={refineOpen}
                                style={{ ...sideBtnStyle, opacity: refineOpen ? 0.45 : 1, cursor: refineOpen ? 'default' : 'pointer' }}
                                title={refineOpen ? '精炼窗口已打开' : '打开天缘属性精炼窗口'}
                            >
                                精炼
                            </button>
                            <button type="button" onClick={resetLevel} style={sideBtnStyle} title="重置：保留词条，等级与天命清零">
                                重置
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── 窗口 2：天缘属性精炼（点「精炼」后才出现） ───── */}
                {refineOpen && (
                <div className="nt-sim-right w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE}>
                    <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                        <span style={TITLE_TEXT_STYLE}>天缘属性精炼</span>
                        <button
                            type="button"
                            onClick={() => {
                                stopAll();
                                setRefineOpen(false);
                            }}
                            className="absolute right-3 cursor-pointer hover:brightness-150"
                            title="关闭精炼窗口"
                        >
                            <X className="w-3.5 h-3.5" style={{ color: '#8aa0b8' }} />
                        </button>
                    </div>

                    <div className="p-3 flex flex-col gap-2.5 flex-1">
                        {/* 祝福石：图标 + 使用/取消（选中后可再次点击撤销） */}
                        <div className="flex flex-col items-center gap-1">
                            <button
                                type="button"
                                onClick={toggleRuixiang}
                                className="relative w-[54px] h-[54px] rounded-[2px] flex items-center justify-center cursor-pointer transition-all overflow-hidden"
                                style={{
                                    border: `1px solid ${ruixiangOpen || item.ruixiangUsed ? '#46e8fb' : '#2f4a62'}`,
                                    background: 'radial-gradient(circle at 50% 35%, #1b3346 0%, #0a141d 76%)',
                                }}
                                title={
                                    item.ruixiangUsed
                                        ? '取消瑞祥符（回退本次天命）'
                                        : canRuixiang
                                          ? '使用瑞祥符：展开属性列表，选择一条 +3 次天命'
                                          : `瑞祥符仅 +${data.refine.ruixiangLevels.join('/+')} 可用`
                                }
                            >
                                <img
                                    src="/game_data/equip_icons/ruixiang_rune.png"
                                    alt="瑞祥符"
                                    className="w-full h-full object-cover"
                                    style={{ filter: item.ruixiangUsed ? 'none' : 'grayscale(0.4) brightness(0.85)' }}
                                />
                                <span className="absolute bottom-0 right-0.5 text-[9px] font-mono" style={{ color: '#c7e4f5' }}>
                                    {item.ruixiangUsed ? 0 : 1}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={toggleRuixiang}
                                className="text-[11px] cursor-pointer hover:brightness-125 transition-all"
                                style={{ color: item.ruixiangUsed || ruixiangOpen ? '#ff8080' : '#9adfff' }}
                            >
                                {item.ruixiangUsed || ruixiangOpen ? '取消使用瑞祥符' : '使用瑞祥符'}
                            </button>
                        </div>

                        {/* 属性选择（点击使用瑞祥符后出现，选中才消耗次数） */}
                        {ruixiangOpen && !item.ruixiangUsed && (
                            <div className="rounded-[3px] border border-[#3c678f]/50 bg-black/50 px-2 py-1.5">
                                <div className="flex flex-wrap justify-center gap-1">
                                    {item.attrs.map((attr, idx) => (
                                        <button
                                            key={`${attr.def.id}-${idx}`}
                                            type="button"
                                            onClick={() => chooseRuixiang(idx)}
                                            className="px-1.5 py-0.5 rounded-sm text-[10.5px] border border-[#3c678f] text-[#9adfff] hover:bg-[#1e3a50] cursor-pointer"
                                        >
                                            {attrLabel(attr.def)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 结果提示 */}
                        {msg && (
                            <div
                                className="rounded-[2px] px-2.5 py-1.5 text-center animate-in fade-in duration-150"
                                style={
                                    msg.ok
                                        ? { background: 'rgba(111,232,168,0.13)', border: '1px solid rgba(111,232,168,0.5)' }
                                        : { background: '#2a1a17', border: '1px solid #6b3a30' }
                                }
                            >
                                <div
                                    className={clsx('text-[12.5px] font-medium leading-[18px]', msg.ok && 'animate-pulse')}
                                    style={{
                                        color: msg.ok ? '#6fe8a8' : '#eda392',
                                        textShadow: msg.ok ? '0 0 10px rgba(111,232,168,0.45)' : 'none',
                                    }}
                                >
                                    {msg.title}
                                </div>
                            </div>
                        )}

                        {/* 读条 + 按钮（收窄，对齐神机锻造） */}
                        <div className="mx-auto w-full max-w-[240px]">
                            <div
                                className="relative overflow-hidden w-full"
                                style={{
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
                                        transition: barAnim ? `width ${REFINE_MS - 20}ms linear` : 'none',
                                    }}
                                />
                            </div>

                            <div className="flex gap-2.5 mt-2.5">
                                <button
                                    type="button"
                                    disabled={busy || item.level >= maxLevel}
                                    onClick={handleSingle}
                                    className="flex-1 py-1.5 rounded-[3px] text-[13px] tracking-wider font-medium transition-all whitespace-nowrap"
                                    style={btnStyle(!busy && item.level < maxLevel)}
                                >
                                    单次精炼
                                </button>
                                <button
                                    type="button"
                                    disabled={!auto && item.level >= maxLevel}
                                    onClick={toggleAuto}
                                    className="flex-1 py-1.5 rounded-[3px] text-[13px] tracking-wider font-medium transition-all whitespace-nowrap"
                                    style={btnStyle(auto || item.level < maxLevel, auto ? 'danger' : 'normal')}
                                >
                                    {auto ? (
                                        <span className="inline-flex items-center justify-center gap-1">
                                            <Square className="w-3 h-3" /> 停止
                                        </span>
                                    ) : (
                                        '连续精炼'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* 规则：蓝字 + 红字关键词 */}
                        <div className="text-[12px] leading-[20px]" style={{ color: '#9adfff' }}>
                            <div>
                                1.精炼等级达到<span style={{ color: '#ff4d4d' }}>3.6.9.10级</span>时有概率触发天命；
                            </div>
                            <div>
                                2.天缘属性的<span style={{ color: '#ff4d4d' }}>条目越多</span>，触发天命的概率越大；
                            </div>
                            <div>
                                3.在精炼等级为<span style={{ color: '#ff4d4d' }}>2.5.8级</span>时可以使用
                                <span style={{ color: '#ff4d4d' }}>瑞祥符</span>，必定令指定属性触发
                                <span style={{ color: '#ff4d4d' }}>3次</span>天命强化；
                            </div>
                        </div>
                    </div>
                </div>
                )}
            </div>

            {showInfo && (
                <div className="mt-3 w-full">
                    <NewTianyuanDetailCard
                        cardData={{
                            data: data as unknown as DetailTianyuanData,
                            initialGroupName: piece.name,
                            initialLevel: item.level,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

const InfoLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex items-baseline gap-2 leading-[19px]">
        <span style={{ color: '#e8edf5', fontSize: 12.5 }}>{label}</span>
        <span style={{ color: '#ffffff', fontSize: 12.5 }}>{value}</span>
    </div>
);

const SimAttrLine: React.FC<{
    attr: RolledAttr;
    level: number;
    cumulative: number[];
    highlight: boolean;
}> = ({ attr, level, cumulative, highlight }) => {
    const value = attrDisplayValue(attr, level, cumulative);
    const bonus = attrDestinyBonus(attr, cumulative);
    const destinyColor = REFINE_COLORS[Math.min(attr.destinyPoints, REFINE_COLORS.length - 1)];
    return (
        <div
            className={clsx('flex items-baseline gap-1.5 rounded-sm px-0.5 -mx-0.5 transition-colors duration-500', highlight ? 'bg-cyan-400/20' : '')}
            style={{ fontFamily: SIM_FONT, fontSize: 14, lineHeight: '22px' }}
            title={bonus > 0 ? `其中天命加成 +${formatAttrValue(attr.def, bonus)}` : undefined}
        >
            <span className="shrink-0 whitespace-nowrap" style={{ color: destinyColor, width: 62 }}>
                {attr.destinyPoints > 0 ? `天命+${attr.destinyPoints}` : '天命'}
            </span>
            <span className="min-w-0 whitespace-nowrap" style={{ color: STAT_BLUE }}>
                {attrLabel(attr.def)} +{formatAttrValue(attr.def, value)}
            </span>
        </div>
    );
};

export default NewTianyuanSimCard;

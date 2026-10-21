import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { DataService } from '../../services/DataService';
import type { CuratedEquipItem } from '../../types';
import { getEquipQualityColor } from '../../constants/gameColorSystem';
import {
    SHENJI_QUALITIES,
    SHENJI_SLOTS,
    TIER_NAMES,
    buildShenjiPools,
    formatShenjiValue,
    rollShenjiPools,
    type ShenjiQuality,
    type ShenjiRoll,
    type ShenjiSlot,
} from '../../utils/shenjiSim';

export interface ShenjiForgeCardProps {
    cardData?: { data?: unknown };
    className?: string;
}

/** 配色取自参考站 zx.res111.com/ninglingqi.html（深蓝青 + 金色强调） */
const C = {
    panelBg: 'linear-gradient(180deg,#0d1b2a 0%,#0a1522 55%,#081120 100%)',
    panelBorder: '#2b5473',
    headBg: 'linear-gradient(180deg,#123049,#0b1c2c)',
    title: '#8fd8ff',
    name: '#9adfff',
    gold: '#ffd94d',
    btnBg: 'linear-gradient(180deg,#2b5a7d,#173951)',
    btnBorder: '#4d86ad',
    btnText: '#dff3ff',
    primaryBg: 'linear-gradient(180deg,#3f8dc0,#1d5a85)',
    primaryBorder: '#6db7e6',
    divider: 'rgba(28,58,82,.45)',
    muted: '#41586c',
};

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
const FORGE_MS = 1000;
const BAR_W = 216;

const TIER_HEX = ['#ffffff', '#11ff11', '#aa32ff', '#ffdc50', '#ff0000'];

function renderValue(roll: ShenjiRoll): string {
    return `+${formatShenjiValue(roll.value, roll.decimal)}${roll.percent ? '%' : ''}`;
}

/** 六种部位的线条图标（stroke 绘制，无填充） */
const SlotIcon: React.FC<{ slot: ShenjiSlot; color: string; size?: number }> = ({ slot, color, size = 30 }) => {
    const common = {
        fill: 'none',
        stroke: color,
        strokeWidth: 1.4,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
    };
    const shapes: Record<string, React.ReactNode> = {
        武器: (
            <>
                <path d="M12 2.6 L13.7 6.6 V13 H10.3 V6.6 Z" {...common} />
                <path d="M8.4 13.3 H15.6" {...common} />
                <path d="M12 13.3 V19" {...common} />
                <path d="M10.3 19.5 H13.7" {...common} />
            </>
        ),
        头盔: (
            <>
                <path d="M5.6 13.6 V10.6 A6.4 6.4 0 0 1 18.4 10.6 V13.6" {...common} />
                <path d="M4.4 13.6 H19.6" {...common} />
                <path d="M9.2 13.6 V16.4" {...common} />
                <path d="M14.8 13.6 V16.4" {...common} />
                <path d="M9.2 16.4 H14.8" {...common} />
            </>
        ),
        衣服: (
            <>
                <path d="M9.2 3.8 H14.8 L19.4 6.2 L17.9 10.2 L16.1 9.4 V20.2 H7.9 V9.4 L6.1 10.2 L4.6 6.2 Z" {...common} />
                <path d="M9.6 3.9 A2.4 2.4 0 0 0 14.4 3.9" {...common} />
            </>
        ),
        靴子: (
            <>
                <path d="M8.6 3.6 H13.4 V13.8 L17.6 16.4 V20.2 H6.4 V16.4 L8.6 13.8 Z" {...common} />
                <path d="M8.6 7.4 H13.4" {...common} />
            </>
        ),
        腰带: (
            <>
                <path d="M3.6 9.6 H20.4 V14.4 H3.6 Z" {...common} />
                <path d="M9.9 9.6 V14.4" {...common} />
                <path d="M14.1 9.6 V14.4" {...common} />
            </>
        ),
        袖甲: (
            <>
                <path d="M8 6.4 A4 2.2 0 0 0 16 6.4" {...common} />
                <path d="M8 6.4 V17.6" {...common} />
                <path d="M16 6.4 V17.6" {...common} />
                <path d="M8 17.6 A4 2.2 0 0 0 16 17.6" {...common} />
                <path d="M8 12 H16" {...common} />
            </>
        ),
    };
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block' }}>
            {shapes[slot]}
        </svg>
    );
};

/** 单侧属性面板 */
const ForgePanel: React.FC<{
    side: 'left' | 'right';
    slot: ShenjiSlot;
    quality: ShenjiQuality;
    rolls: ShenjiRoll[];
    onChoose?: () => void;
    chooseEnabled: boolean;
}> = ({ side, slot, quality, rolls, onChoose, chooseEnabled }) => {
    const qColor = getEquipQualityColor(quality);
    return (
        <div
            className="relative flex flex-col rounded px-3 pt-3 pb-2.5 min-w-0"
            style={{ background: C.panelBg, border: `1px solid ${C.panelBorder}`, fontFamily: SIM_FONT }}
        >
            <div className="flex justify-center">
                <div
                    className="flex items-center justify-center rounded-sm"
                    style={{
                        width: 52,
                        height: 52,
                        background: 'linear-gradient(160deg,#16273c 0%,#0c1826 60%,#081220 100%)',
                        border: `1px solid ${qColor}`,
                        boxShadow: `0 0 12px ${qColor}44, inset 0 0 10px rgba(0,0,0,.6)`,
                    }}
                >
                    <SlotIcon slot={slot} color={qColor} size={32} />
                </div>
            </div>

            <div className="flex-1 mt-3 space-y-[6px] text-[14px] leading-[22px] min-h-[66px]">
                {rolls.length === 0 && (
                    <div className="text-center text-[13px] pt-2" style={{ color: C.muted }}>
                        {side === 'left' ? '暂无神机属性' : '点击下方【锻造】生成'}
                    </div>
                )}
                {rolls.map((r, i) => (
                    <div key={`${r.name}-${i}`} className="flex items-baseline justify-between gap-2">
                        <span className="truncate" style={{ color: r.color }}>
                            {r.isJi ? '极· ' : ''}神机 {r.name}
                        </span>
                        <span className="tabular-nums shrink-0" style={{ color: r.color }}>
                            {renderValue(r)}
                        </span>
                    </div>
                ))}
            </div>

            <div className="flex justify-center mt-2.5">
                <button
                    type="button"
                    disabled={!chooseEnabled}
                    onClick={chooseEnabled ? onChoose : undefined}
                    className="px-3.5 py-[3px] rounded-sm text-[13px] transition-colors"
                    style={{
                        background: chooseEnabled ? C.btnBg : 'rgba(18,30,48,.7)',
                        border: `1px solid ${chooseEnabled ? C.btnBorder : '#22384d'}`,
                        color: chooseEnabled ? C.btnText : C.muted,
                        cursor: chooseEnabled ? 'pointer' : 'not-allowed',
                        fontFamily: SIM_FONT,
                    }}
                >
                    {side === 'left' ? '选择锻造前' : '选择锻造后'}
                </button>
            </div>
        </div>
    );
};

export type YunlingTier = 11 | 13 | 15;

export const ShenjiForgeCard: React.FC<ShenjiForgeCardProps> = ({ className }) => {
    const [equips, setEquips] = useState<CuratedEquipItem[]>([]);
    const [quality, setQuality] = useState<ShenjiQuality>('昭武');
    const [slot, setSlot] = useState<ShenjiSlot>('武器');
    const [yunling, setYunling] = useState<YunlingTier>(15);
    const [left, setLeft] = useState<ShenjiRoll[]>([]);
    const [right, setRight] = useState<ShenjiRoll[]>([]);
    const [forging, setForging] = useState(false);
    const [auto, setAuto] = useState(false);
    /** 读条填充宽度（0~1）。读完停在 1，下次锻造才瞬间归零 */
    const [barFill, setBarFill] = useState(0);
    /** 是否启用过渡动画（归零那一刻必须关掉，否则会看到倒退） */
    const [barAnim, setBarAnim] = useState(false);
    const [forgeCount, setForgeCount] = useState(0);
    const [showHelp, setShowHelp] = useState(false);

    const timerRef = useRef<number | null>(null);
    const resetRef = useRef<number | null>(null);
    const autoRef = useRef(false);

    useEffect(() => {
        let alive = true;
        DataService.getInstance()
            .getEquipList()
            .then((list) => { if (alive) setEquips(Array.isArray(list) ? list : []); })
            .catch(() => { });
        return () => { alive = false; };
    }, []);

    const pools = useMemo(() => buildShenjiPools(equips, slot, quality, yunling), [equips, slot, quality, yunling]);
    const poolReady = pools.length > 0 && pools.every((p) => p.length > 0);

    const stopAll = useCallback(() => {
        autoRef.current = false;
        setAuto(false);
        setForging(false);
        if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
        if (resetRef.current) { window.clearTimeout(resetRef.current); resetRef.current = null; }
    }, []);

    useEffect(() => stopAll, [stopAll]);

    const resetForNewConfig = useCallback(() => {
        stopAll();
        setLeft([]);
        setRight([]);
        setForgeCount(0);
        setBarAnim(false);
        setBarFill(0);
    }, [stopAll]);

    const handleQualityChange = (q: ShenjiQuality) => {
        if (q === quality) return;
        resetForNewConfig();
        setQuality(q);
    };

    const handleSlotChange = (s: ShenjiSlot) => {
        if (s === slot) return;
        resetForNewConfig();
        setSlot(s);
    };

    const handleYunlingChange = (y: YunlingTier) => {
        if (y === yunling) return;
        resetForNewConfig();
        setYunling(y);
    };

    const runOnce = useCallback(
        (onDone?: () => void) => {
            if (!poolReady) { onDone?.(); return; }
            setForging(true);
            // 第一步：关过渡，瞬间归零（无倒退动画）
            setBarAnim(false);
            setBarFill(0);
            // 第二步：下一拍开启过渡走到满格；读完保持满格不回退
            resetRef.current = window.setTimeout(() => {
                setBarAnim(true);
                setBarFill(1);
                resetRef.current = null;
            }, 20);
            timerRef.current = window.setTimeout(() => {
                setRight(rollShenjiPools(pools));
                setForgeCount((c) => c + 1);
                setForging(false);
                timerRef.current = null;
                onDone?.();
            }, FORGE_MS);
        },
        [pools, poolReady]
    );

    const handleForge = useCallback(() => { if (!forging) runOnce(); }, [forging, runOnce]);

    const handleAutoToggle = useCallback(() => {
        if (autoRef.current) { stopAll(); return; }
        autoRef.current = true;
        setAuto(true);
        const loop = () => {
            if (!autoRef.current) return;
            runOnce(() => { if (autoRef.current) window.setTimeout(loop, 120); });
        };
        loop();
    }, [runOnce, stopAll]);

    const handleChoose = useCallback(
        (side: 'left' | 'right') => {
            stopAll();
            if (side === 'right') setLeft(right);
            setRight([]);
        },
        [right, stopAll]
    );

    const chipStyle = (active: boolean, activeColor?: string): React.CSSProperties => ({
        background: active ? 'rgba(63,141,192,.28)' : 'rgba(12,29,46,.85)',
        border: `1px solid ${active ? (activeColor || C.primaryBorder) : '#22384d'}`,
        color: active ? (activeColor || '#ffffff') : C.muted,
        boxShadow: active ? `0 0 8px ${(activeColor || C.primaryBorder)}55` : 'none',
        fontFamily: SIM_FONT,
    });

    const btnBase: React.CSSProperties = {
        flex: 1,
        padding: '4px 0',
        borderRadius: 2,
        fontSize: 13,
        fontFamily: SIM_FONT,
        textAlign: 'center',
        transition: 'background .15s',
    };

    return (
        <div
            className={`@container w-full max-w-xl rounded p-3 ${className || ''}`}
            style={{
                background: '#0b0f16 radial-gradient(ellipse at top, #16202e 0%, #0b0f16 70%)',
                border: `1px solid ${C.panelBorder}`,
                fontFamily: SIM_FONT,
                boxShadow: '0 10px 32px rgba(0,0,0,.6)',
            }}
        >
            {/* 标题栏 */}
            <div
                className="flex items-center justify-between px-2 py-1.5 -mx-3 -mt-3 mb-2.5 rounded-t"
                style={{ background: C.headBg, borderBottom: `1px solid ${C.panelBorder}` }}
            >
                <span className="text-[15px] tracking-[2px]" style={{ color: C.title, textShadow: '0 0 12px rgba(80,180,255,.6)' }}>
                    神机属性锻造
                </span>
                <button type="button" onClick={() => setShowHelp((v) => !v)} style={{ color: showHelp ? C.gold : '#5d7794' }} title="洗练规则">
                    <HelpCircle className="w-4 h-4" />
                </button>
            </div>

            {/* 品质 + 蕴灵 */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                {SHENJI_QUALITIES.map((q) => (
                    <button key={q} type="button" onClick={() => handleQualityChange(q)} className="px-2.5 py-[2px] rounded-sm text-[13px] transition-colors" style={chipStyle(quality === q, getEquipQualityColor(q))}>
                        {q}
                    </button>
                ))}
                <span className="mx-1 h-3.5 w-px" style={{ background: C.divider }} />
                {[11, 13, 15].map((y) => (
                    <button key={y} type="button" onClick={() => handleYunlingChange(y as YunlingTier)} className="px-2.5 py-[2px] rounded-sm text-[13px] transition-colors" style={chipStyle(yunling === y)}>
                        +{y}
                    </button>
                ))}
            </div>

            {/* 部位（纯文字胶囊） */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2.5 pb-2" style={{ borderBottom: `1px solid ${C.divider}` }}>
                {SHENJI_SLOTS.map((s) => (
                    <button key={s} type="button" onClick={() => handleSlotChange(s)} className="px-2.5 py-[2px] rounded-sm text-[13px] transition-colors" style={chipStyle(slot === s)}>
                        {s}
                    </button>
                ))}
                {!poolReady && <span className="text-[11px]" style={{ color: '#ff8080' }}>该组合暂无神机池</span>}
            </div>

            {showHelp && (
                <div className="mb-2.5 rounded-sm px-2.5 py-2 text-[12px] leading-[20px]" style={{ background: 'rgba(20,60,95,.25)', border: `1px solid ${C.panelBorder}`, color: '#9adfff' }}>
                    <div>· 每条属性独立抽取：先按属性出现概率选词条，再按档位概率选 5 档之一。</div>
                    <div>· 五档取值为固定值：第一档 = 区间下限（白），第五档 = 区间上限（红·极·）。</div>
                    <div>· 档位概率：+11 池 34/33/18/10/5，+13 池 38/33/17/8/3，+15 池 42/33/16/7/2。</div>
                    <div>· 条数由蕴灵决定：+11 一条、+13 两条、+15 三条，依次取 +11 / +13 / +15 池。</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                        {TIER_NAMES.map((n, i) => (
                            <span key={n} className="flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: TIER_HEX[i] }} />
                                <span style={{ color: TIER_HEX[i] }}>{i === 4 ? '红（极·）' : n}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* 左右面板 */}
            <div className="grid grid-cols-1 @md:grid-cols-[1fr_auto_1fr] items-stretch gap-2">
                <ForgePanel
                    side="left"
                    slot={slot}
                    quality={quality}
                    rolls={left}
                    chooseEnabled={left.length > 0 && !forging}
                    onChoose={() => handleChoose('left')}
                />
                <div className="flex items-center justify-center">
                    <span className="text-[18px] leading-none rotate-90 @md:rotate-0" style={{ color: '#6fa8d8' }}>→</span>
                </div>
                <ForgePanel
                    side="right"
                    slot={slot}
                    quality={quality}
                    rolls={right}
                    chooseEnabled={right.length > 0 && !forging}
                    onChoose={() => handleChoose('right')}
                />
            </div>

            {/* 读条 + 等宽按钮：整组居中，次数向右顺延不参与居中 */}
            <div className="relative mt-3">
                <div className="mx-auto" style={{ width: BAR_W }}>
                    <div
                        className="relative overflow-hidden"
                        style={{
                            width: BAR_W,
                            height: 12,
                            borderRadius: 999,
                            background: 'linear-gradient(180deg,#0a1a20,#061216)',
                            border: `1px solid ${forging ? '#2ad8e0' : '#1b3742'}`,
                            boxShadow: forging
                                ? 'inset 0 0 10px rgba(0,220,220,.25), 0 0 10px rgba(0,220,220,.45)'
                                : 'inset 0 1px 4px rgba(0,0,0,.9)',
                            transition: 'border-color .15s, box-shadow .15s',
                        }}
                    >
                        <div
                            style={{
                                height: '100%',
                                width: `${Math.round(barFill * 100)}%`,
                                borderRadius: 999,
                                background: 'linear-gradient(90deg,#0096a8 0%,#00e8f0 45%,#6fffff 60%,#00d0da 100%)',
                                boxShadow: barFill > 0 ? '0 0 12px rgba(0,255,255,.75), inset 0 1px 2px rgba(255,255,255,.6)' : 'none',
                                transition: barAnim ? `width ${FORGE_MS - 20}ms linear` : 'none',
                            }}
                        />
                    </div>

                    <div className="flex gap-2 mt-2">
                        <button
                            type="button"
                            disabled={!poolReady || forging}
                            onClick={handleForge}
                            style={{
                                ...btnBase,
                                background: poolReady && !forging ? C.btnBg : 'rgba(18,30,48,.7)',
                                border: `1px solid ${poolReady && !forging ? C.btnBorder : '#22384d'}`,
                                color: poolReady && !forging ? C.btnText : C.muted,
                                cursor: poolReady && !forging ? 'pointer' : 'not-allowed',
                            }}
                        >
                            锻造
                        </button>
                        <button
                            type="button"
                            disabled={!poolReady}
                            onClick={handleAutoToggle}
                            style={{
                                ...btnBase,
                                background: auto ? 'linear-gradient(180deg,#8a3a2b,#5c2117)' : C.primaryBg,
                                border: `1px solid ${auto ? '#c07050' : C.primaryBorder}`,
                                color: poolReady ? '#ffffff' : C.muted,
                                cursor: poolReady ? 'pointer' : 'not-allowed',
                                boxShadow: auto ? '0 0 10px rgba(200,90,60,.5)' : 'none',
                            }}
                        >
                            {auto ? '停止' : '自动锻造'}
                        </button>
                    </div>
                </div>

                <span
                    className="absolute whitespace-nowrap text-[11px] tabular-nums"
                    style={{ left: 'calc(50% + 116px)', bottom: 7, color: '#5d7794', fontFamily: SIM_FONT }}
                >
                    已锻造 <b style={{ color: C.gold }}>{forgeCount}</b> 次
                </span>
            </div>
        </div>
    );
};

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
    cardData?: {
        data?: unknown;
        initialQuality?: ShenjiQuality;
    };
    className?: string;
}

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
const FORGE_MS = 1000;
const BAR_W = 216;

/** 六类部位来自寻宝天行真实客户端图标（袖甲来自原版客户端提取） */
const SLOT_IMAGE_MAP: Record<ShenjiSlot, string> = {
    '武器': '/game_data/equip_icons/79821.png',   // 绝峰·昭武
    '头盔': '/game_data/equip_icons/90812.png',   // 绝峰衔日盔·昭武（男）
    '衣服': '/game_data/equip_icons/85782.png',   // 绝峰衔日甲·昭武（男）
    '靴子': '/game_data/equip_icons/96240.png',   // 绝峰衔日靴·昭武（男）
    '腰带': '/game_data/equip_icons/105681.png',  // 绝峰衔日腰带·昭武（男）
    '袖甲': '/game_data/equip_icons/cuff_34.png',  // 绝峰衔日钏/腕
};

const TIER_HEX = ['#ffffff', '#4fbc3c', '#b446ff', '#ffd94d', '#f80000'];

function renderValue(roll: ShenjiRoll): string {
    return `+${formatShenjiValue(roll.value, roll.decimal)}${roll.percent ? '%' : ''}`;
}

/** 备用线条图标（仅在图片网络异常时优雅降级） */
const SlotIconFallback: React.FC<{ slot: ShenjiSlot; color: string; size?: number }> = ({ slot, color, size = 26 }) => {
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

/** 单侧属性面板（1:1 游戏卡片还原） */
const ForgePanel: React.FC<{
    side: 'left' | 'right';
    slot: ShenjiSlot;
    quality: ShenjiQuality;
    rolls: ShenjiRoll[];
    onChoose?: () => void;
    chooseEnabled: boolean;
}> = ({ side, slot, quality, rolls, onChoose, chooseEnabled }) => {
    const qColor = getEquipQualityColor(quality);
    const [imgErr, setImgErr] = useState(false);

    // 当切换部位时重置图片错误状态
    useEffect(() => {
        setImgErr(false);
    }, [slot]);

    return (
        <div
            className="relative flex flex-col rounded-[3px] px-3 pt-3 pb-2.5 min-w-0"
            style={{
                background: 'linear-gradient(180deg, #13202e 0%, #0d1620 100%)',
                border: '1px solid #233547',
                boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.6)',
                fontFamily: SIM_FONT,
            }}
        >
            {/* 装备方格：诛仙经典双层暗金金属背包格 */}
            <div className="flex justify-center">
                <div
                    className="relative flex items-center justify-center select-none"
                    style={{
                        width: 44,
                        height: 44,
                        background: '#0a121b',
                        border: '2px solid #8e7a4b',
                        boxShadow: 'inset 0 0 5px rgba(0,0,0,0.9), 0 0 6px rgba(142,122,75,0.3)',
                        borderRadius: 2,
                    }}
                >
                    {/* 金色四角微角装饰 */}
                    <div className="absolute -top-[2px] -left-[2px] w-[3px] h-[3px] bg-[#d5ba75]" />
                    <div className="absolute -top-[2px] -right-[2px] w-[3px] h-[3px] bg-[#d5ba75]" />
                    <div className="absolute -bottom-[2px] -left-[2px] w-[3px] h-[3px] bg-[#d5ba75]" />
                    <div className="absolute -bottom-[2px] -right-[2px] w-[3px] h-[3px] bg-[#d5ba75]" />

                    {!imgErr ? (
                        <img
                            src={SLOT_IMAGE_MAP[slot]}
                            alt={slot}
                            onError={() => setImgErr(true)}
                            className="pointer-events-none select-none"
                            style={{ width: 34, height: 34, objectFit: 'contain' }}
                        />
                    ) : (
                        <SlotIconFallback slot={slot} color={qColor} size={28} />
                    )}
                </div>
            </div>

            {/* 属性区域：高度固定并支持游戏风格细滚动条 */}
            <div
                className="shenji-scroll flex-1 mt-3 px-1 text-[13px] leading-[26px]"
                style={{
                    height: 98,
                    minHeight: 98,
                    maxHeight: 98,
                    overflowY: 'auto',
                }}
            >
                {rolls.length === 0 && (
                    <div className="text-center text-[13px] pt-7 select-none" style={{ color: '#4a647a' }}>
                        {side === 'left' ? '暂无神机属性' : '点击下方【锻造】生成'}
                    </div>
                )}
                {rolls.map((r, i) => (
                    <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-2.5">
                        <span className="truncate tracking-wide" style={{ color: r.color }}>
                            {r.isJi ? '极·神机 ' : '神机 '}{r.name}
                        </span>
                        <span className="tabular-nums shrink-0 font-medium" style={{ color: r.color }}>
                            {renderValue(r)}
                        </span>
                    </div>
                ))}
            </div>

            {/* 底部选择按钮：游戏经典蓝灰金属凸起小按钮 */}
            <div className="flex justify-center mt-2.5">
                <button
                    type="button"
                    disabled={!chooseEnabled}
                    onClick={chooseEnabled ? onChoose : undefined}
                    className="px-4 py-1 rounded-[3px] text-[13px] transition-all select-none"
                    style={{
                        background: chooseEnabled
                            ? 'linear-gradient(180deg, #263a50 0%, #152433 100%)'
                            : 'rgba(16, 26, 36, 0.6)',
                        border: `1px solid ${chooseEnabled ? '#3d5d7d' : '#1e3042'}`,
                        boxShadow: chooseEnabled
                            ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(0,0,0,0.5)'
                            : 'none',
                        color: chooseEnabled ? '#e6f1fa' : '#456077',
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

export const ShenjiForgeCard: React.FC<ShenjiForgeCardProps> = ({ cardData, className }) => {
    const [equips, setEquips] = useState<CuratedEquipItem[]>([]);
    const [quality, setQuality] = useState<ShenjiQuality>(() => {
        const q = cardData?.initialQuality;
        return q && SHENJI_QUALITIES.includes(q) ? q : '昭武';
    });
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
            setBarAnim(false);
            setBarFill(0);
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
        background: active
            ? 'linear-gradient(180deg, #273e54 0%, #152636 100%)'
            : 'linear-gradient(180deg, #131c26 0%, #0d141d 100%)',
        border: `1px solid ${active ? (activeColor || '#4b759e') : '#1e3042'}`,
        color: active ? (activeColor || '#e8f3fc') : '#5a738c',
        boxShadow: active ? `0 0 8px ${(activeColor || '#4b759e')}44, inset 0 1px 0 rgba(255,255,255,0.15)` : 'none',
        fontFamily: SIM_FONT,
    });

    return (
        <div
            className={`@container w-full max-w-xl rounded-[4px] p-3.5 ${className || ''}`}
            style={{
                background: 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)',
                border: '1px solid #283e54',
                fontFamily: SIM_FONT,
                boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
        >
            {/* 注入细滚动条样式 */}
            <style>{`
                .shenji-scroll::-webkit-scrollbar {
                    width: 5px;
                }
                .shenji-scroll::-webkit-scrollbar-track {
                    background: rgba(8, 16, 24, 0.5);
                    border-radius: 3px;
                }
                .shenji-scroll::-webkit-scrollbar-thumb {
                    background: linear-gradient(180deg, #38536e 0%, #1d3346 100%);
                    border: 1px solid #4a6c8e;
                    border-radius: 3px;
                }
                .shenji-scroll::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(180deg, #4d7196 0%, #294863 100%);
                }
            `}</style>

            {/* 标题栏：米金字体居中 */}
            <div
                className="relative flex items-center justify-between px-3 py-2 -mx-3.5 -mt-3.5 mb-3 rounded-t-[3px]"
                style={{
                    background: 'linear-gradient(180deg, #192636 0%, #101a24 100%)',
                    borderBottom: '1px solid #283e54',
                }}
            >
                <div className="w-5" />
                <span
                    className="text-[16px] font-bold tracking-[3px] select-none"
                    style={{
                        color: '#f7f4bb',
                        textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000',
                    }}
                >
                    神机属性锻造
                </span>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setShowHelp((v) => !v)}
                        style={{ color: showHelp ? '#ffd94d' : '#6b89a8' }}
                        title="洗练规则"
                        className="hover:text-[#9bc2e6] transition-colors"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 品质 + 蕴灵 */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {SHENJI_QUALITIES.map((q) => (
                    <button
                        key={q}
                        type="button"
                        onClick={() => handleQualityChange(q)}
                        className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                        style={chipStyle(quality === q, getEquipQualityColor(q))}
                    >
                        {q}
                    </button>
                ))}
                <span className="mx-1 h-3.5 w-px" style={{ background: '#22384d' }} />
                {[11, 13, 15].map((y) => (
                    <button
                        key={y}
                        type="button"
                        onClick={() => handleYunlingChange(y as YunlingTier)}
                        className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                        style={chipStyle(yunling === y)}
                    >
                        +{y}
                    </button>
                ))}
            </div>

            {/* 部位 */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 pb-2.5" style={{ borderBottom: '1px solid #1a2a3b' }}>
                {SHENJI_SLOTS.map((s) => (
                    <button
                        key={s}
                        type="button"
                        onClick={() => handleSlotChange(s)}
                        className="px-2.5 py-[3px] rounded-[2px] text-[13px] transition-colors"
                        style={chipStyle(slot === s)}
                    >
                        {s}
                    </button>
                ))}
                {!poolReady && <span className="text-[11px] ml-2" style={{ color: '#ff8080' }}>该组合暂无神机池</span>}
            </div>

            {showHelp && (
                <div
                    className="mb-3 rounded-[3px] px-3 py-2 text-[12px] leading-[22px]"
                    style={{
                        background: 'rgba(16,32,48,.5)',
                        border: '1px solid #2a415a',
                        color: '#9adfff',
                    }}
                >
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

            {/* 左右属性卡片区 */}
            <div className="grid grid-cols-1 @md:grid-cols-[1fr_auto_1fr] items-stretch gap-2.5">
                <ForgePanel
                    side="left"
                    slot={slot}
                    quality={quality}
                    rolls={left}
                    chooseEnabled={left.length > 0 && !forging}
                    onChoose={() => handleChoose('left')}
                />

                {/* 居中过渡箭头：游戏原版质感箭头 */}
                <div className="flex items-center justify-center select-none pointer-events-none px-1">
                    <img
                        src="/game_data/equip_icons/game_arrow.png"
                        alt="->"
                        className="w-[46px] h-[32px] object-contain opacity-80 hidden @md:block"
                        onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                    />
                    <span className="text-[20px] leading-none rotate-90 @md:hidden text-[#4e749a]">↓</span>
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

            {/* 读条 + 锻造按钮 */}
            <div className="relative mt-3.5">
                <div className="mx-auto" style={{ width: BAR_W }}>
                    <div
                        className="relative overflow-hidden"
                        style={{
                            width: BAR_W,
                            height: 10,
                            borderRadius: 999,
                            background: '#081219',
                            border: `1px solid ${forging ? '#389bb5' : '#182b38'}`,
                            boxShadow: forging
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
                                transition: barAnim ? `width ${FORGE_MS - 20}ms linear` : 'none',
                            }}
                        />
                    </div>

                    <div className="flex gap-2.5 mt-2.5">
                        <button
                            type="button"
                            disabled={!poolReady || forging}
                            onClick={handleForge}
                            className="flex-1 py-1.5 rounded-[3px] text-[14px] tracking-wider transition-all font-medium select-none"
                            style={{
                                background: poolReady && !forging
                                    ? 'linear-gradient(180deg, #2b3d50 0%, #162432 100%)'
                                    : 'rgba(16, 26, 36, 0.6)',
                                border: `1px solid ${poolReady && !forging ? '#416282' : '#203244'}`,
                                boxShadow: poolReady && !forging
                                    ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.5)'
                                    : 'none',
                                color: poolReady && !forging ? '#edf5fc' : '#4a657c',
                                cursor: poolReady && !forging ? 'pointer' : 'not-allowed',
                                fontFamily: SIM_FONT,
                            }}
                        >
                            锻造
                        </button>
                        <button
                            type="button"
                            disabled={!poolReady}
                            onClick={handleAutoToggle}
                            className="flex-1 py-1.5 rounded-[3px] text-[14px] tracking-wider transition-all font-medium select-none"
                            style={{
                                background: auto
                                    ? 'linear-gradient(180deg, #872e22 0%, #4f1710 100%)'
                                    : poolReady
                                        ? 'linear-gradient(180deg, #274563 0%, #142a3d 100%)'
                                        : 'rgba(16, 26, 36, 0.6)',
                                border: `1px solid ${auto ? '#b34739' : poolReady ? '#3c678f' : '#203244'}`,
                                boxShadow: auto
                                    ? '0 0 12px rgba(220,60,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : poolReady
                                        ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.5)'
                                        : 'none',
                                color: poolReady ? '#ffffff' : '#4a657c',
                                cursor: poolReady ? 'pointer' : 'not-allowed',
                                fontFamily: SIM_FONT,
                            }}
                        >
                            {auto ? '停止' : '自动锻造'}
                        </button>
                    </div>
                </div>

                <span
                    className="absolute whitespace-nowrap text-[12px] tabular-nums select-none"
                    style={{ left: 'calc(50% + 122px)', bottom: 8, color: '#5b7894', fontFamily: SIM_FONT }}
                >
                    已锻造 <b style={{ color: '#ffd94d', fontWeight: 600 }}>{forgeCount}</b> 次
                </span>
            </div>
        </div>
    );
};

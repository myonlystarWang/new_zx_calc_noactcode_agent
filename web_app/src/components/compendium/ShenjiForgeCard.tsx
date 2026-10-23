import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { DataService } from '../../services/DataService';
import type { CuratedEquipItem } from '../../types';
import { getEquipQualityColor } from '../../constants/gameColorSystem';
import {
    SHENJI_QUALITIES,
    SHENJI_SLOTS,
    TIER_NAMES,
    buildShenjiPools,
    findShenjiEquip,
    getShenjiPool,
    formatShenjiValue,
    rollShenjiPools,
    matchAutoForgeTarget,
    getShenjiAttrDisplayName,
    getShenjiTierRates,
    type AutoForgeTarget,
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
const FORGE_MS = 500;
const BAR_W = 216;

/**
 * 六部位 × 三品质图标，36×36 原始像素。
 *
 * 来源：寻宝天行 `zx/png/<id>.png`（青云·男·修武 5 张、鬼王·男·彰武头盔 1 张）。
 * 品质差异只在外框：修武 = 暗金框 + 白角；昭武 = 青白框 + 青角；彰武 = 橙金框 + 青宝石角。
 *
 * 合成（非原图）说明：
 * - 袖甲：昭武/修武两版以腰带同品质图为框模板，中央 24×24 内圈贴 cuff_34 物品。
 * - 彰武全 6 张：以彰武头盔 115828 整图为框模板，中央内圈贴各部位昭武物品。
 */
const SLOT_IMAGE_MAP: Record<ShenjiQuality, Record<ShenjiSlot, string>> = {
    修武: {
        武器: '/game_data/equip_icons/shenji/xiuwu_weapon.png',
        头盔: '/game_data/equip_icons/shenji/xiuwu_helmet.png',
        衣服: '/game_data/equip_icons/shenji/xiuwu_armor.png',
        靴子: '/game_data/equip_icons/shenji/xiuwu_boots.png',
        腰带: '/game_data/equip_icons/shenji/xiuwu_belt.png',
        袖甲: '/game_data/equip_icons/shenji/xiuwu_cuff.png',
    },
    昭武: {
        武器: '/game_data/equip_icons/shenji/zhaowu_weapon.png',
        头盔: '/game_data/equip_icons/shenji/zhaowu_helmet.png',
        衣服: '/game_data/equip_icons/shenji/zhaowu_armor.png',
        靴子: '/game_data/equip_icons/shenji/zhaowu_boots.png',
        腰带: '/game_data/equip_icons/shenji/zhaowu_belt.png',
        袖甲: '/game_data/equip_icons/shenji/zhaowu_cuff.png',
    },
    彰武: {
        武器: '/game_data/equip_icons/shenji/zhangwu_weapon.png',
        头盔: '/game_data/equip_icons/shenji/zhangwu_helmet.png',
        衣服: '/game_data/equip_icons/shenji/zhangwu_armor.png',
        靴子: '/game_data/equip_icons/shenji/zhangwu_boots.png',
        腰带: '/game_data/equip_icons/shenji/zhangwu_belt.png',
        袖甲: '/game_data/equip_icons/shenji/zhangwu_cuff.png',
    },
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
            className="relative flex flex-col rounded-[3px] px-2.5 pt-2.5 pb-2 min-w-0"
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
                            src={SLOT_IMAGE_MAP[quality][slot]}
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
                className="shenji-scroll flex-1 mt-3 px-1 text-[12.5px] leading-[26px]"
                style={{
                    height: 98,
                    minHeight: 98,
                    maxHeight: 98,
                    overflowY: 'auto',
                }}
            >
                {rolls.length === 0 && (
                    <div className="text-center text-[12.5px] pt-7 select-none" style={{ color: '#4a647a' }}>
                        {side === 'left' ? '暂无神机属性' : '点击下方【锻造】生成'}
                    </div>
                )}
                {rolls.map((r, i) => {
                    const displayName = getShenjiAttrDisplayName(r);
                    const fullName = `${r.isJi ? '极·神机 ' : '神机 '}${displayName}`;
                    return (
                        <div
                            key={`${r.name}-${i}`}
                            className="flex items-center justify-between gap-2 whitespace-nowrap"
                            title={`${fullName} ${renderValue(r)}`}
                        >
                            <span className="text-[12.5px] tracking-tight shrink-0" style={{ color: r.color }}>
                                {fullName}
                            </span>
                            <span className="tabular-nums shrink-0 font-medium text-[12.5px] pl-1" style={{ color: r.color }}>
                                {renderValue(r)}
                            </span>
                        </div>
                    );
                })}
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

const BASE_QUALITY_OPTIONS = [
    { value: 0, label: '无基础品质', color: '#9bb8d4' },
    { value: 1, label: '白 (及以上)', color: '#ffffff' },
    { value: 2, label: '绿 (及以上)', color: '#4fbc3c' },
    { value: 3, label: '紫 (及以上)', color: '#b446ff' },
    { value: 4, label: '橙 (及以上)', color: '#ffd94d' },
    { value: 5, label: '红 (极·)', color: '#f80000' },
];

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

    /** 是否显示自动锻造设置面板（默认关闭，点击自动锻造打开） */
    const [showAutoPanel, setShowAutoPanel] = useState(false);
    /** 预设目标属性（属性1、属性2、属性3） */
    const [targets, setTargets] = useState<AutoForgeTarget[]>([
        { attrName: '无', minTier: 0 },
        { attrName: '无', minTier: 0 },
        { attrName: '无', minTier: 0 },
    ]);
    const targetsRef = useRef(targets);
    targetsRef.current = targets;
    /** 达成目标的提示信息 */
    const [targetHitMsg, setTargetHitMsg] = useState<string | null>(null);

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

    /** 当前部位的 +11/+13/+15 五档概率文案（体验调整值，随部位变化） */
    const tierRateText = useMemo(
        () => [11, 13, 15].map((l) => `+${l} 池 ${getShenjiTierRates(slot, l).join('/')}`).join('，'),
        [slot]
    );

    /** 「两条红 / 三条红」期望文案：由 +15 池红档概率实时推导（r² 关系，改红档自动同步） */
    const redComboText = useMemo(() => {
        const rates = getShenjiTierRates(slot, 15);
        const r = rates[4] / rates.reduce((a, b) => a + b, 0);
        const two = 3 * r * r * (1 - r);
        const three = r * r * r;
        return `约 1/${Math.round(1 / two)} 出两条红、约 1/${Math.round(1 / three)} 出三条红`;
    }, [slot]);

    // 装备载体与三个档位池的备选词条名
    const equip = useMemo(() => findShenjiEquip(equips, slot, quality), [equips, slot, quality]);
    const pool11 = useMemo(() => getShenjiPool(equip, quality, 11), [equip, quality]);
    const pool13 = useMemo(() => getShenjiPool(equip, quality, 13), [equip, quality]);
    const pool15 = useMemo(() => getShenjiPool(equip, quality, 15), [equip, quality]);

    const attrOptions11 = useMemo(() => Array.from(new Set(pool11.map((a) => getShenjiAttrDisplayName(a)))), [pool11]);
    const attrOptions13 = useMemo(() => Array.from(new Set(pool13.map((a) => getShenjiAttrDisplayName(a)))), [pool13]);
    const attrOptions15 = useMemo(() => Array.from(new Set(pool15.map((a) => getShenjiAttrDisplayName(a)))), [pool15]);
    const attrOptionsBySlot = useMemo(() => [attrOptions11, attrOptions13, attrOptions15], [attrOptions11, attrOptions13, attrOptions15]);

    // 部位或品质切换后，如果目标词条在对应池中不存在，则自动重置为“无”
    useEffect(() => {
        setTargets((prev) =>
            prev.map((t, idx) => {
                const validOptions = attrOptionsBySlot[idx] ?? [];
                if (t.attrName !== '无' && !validOptions.includes(t.attrName)) {
                    return { ...t, attrName: '无' };
                }
                return t;
            })
        );
    }, [attrOptionsBySlot]);

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
        setTargetHitMsg(null);
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
        (onDone?: (newRolls: ShenjiRoll[]) => void) => {
            if (!poolReady) { onDone?.([]); return; }
            setForging(true);
            setBarAnim(false);
            setBarFill(0);
            resetRef.current = window.setTimeout(() => {
                setBarAnim(true);
                setBarFill(1);
                resetRef.current = null;
            }, 20);
            timerRef.current = window.setTimeout(() => {
                const rolled = rollShenjiPools(pools, slot);
                setRight(rolled);
                setForgeCount((c) => c + 1);
                setForging(false);
                timerRef.current = null;
                onDone?.(rolled);
            }, FORGE_MS);
        },
        [pools, poolReady, slot]
    );

    const handleForge = useCallback(() => {
        if (!forging) {
            setTargetHitMsg(null);
            runOnce();
        }
    }, [forging, runOnce]);

    const startAutoForge = useCallback(() => {
        if (!poolReady) return;
        setTargetHitMsg(null);
        autoRef.current = true;
        setAuto(true);
        setShowAutoPanel(true);

        const loop = () => {
            if (!autoRef.current) return;
            runOnce((rolled) => {
                if (!autoRef.current) return;
                // 检查是否命中预设目标
                const isHit = matchAutoForgeTarget(rolled, targetsRef.current, pools.length);
                if (isHit) {
                    stopAll();
                    setTargetHitMsg('已命中预设目标！自动停止锻造');
                    return;
                }
                if (autoRef.current) {
                    window.setTimeout(loop, 120);
                }
            });
        };
        loop();
    }, [poolReady, pools.length, runOnce, stopAll]);

    const handleAutoToggle = useCallback(() => {
        if (autoRef.current) {
            stopAll();
            return;
        }
        setShowAutoPanel((prev) => !prev);
    }, [stopAll]);

    const handleTargetAttrNameChange = (index: number, attrName: string) => {
        setTargets((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], attrName };
            return next;
        });
        setTargetHitMsg(null);
    };

    const handleTargetMinTierChange = (index: number, minTier: number) => {
        setTargets((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], minTier };
            return next;
        });
        setTargetHitMsg(null);
    };

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
            className={`w-full ${className || ''}`}
            style={{ containerType: 'inline-size' }}
        >
            {/* 注入细滚动条样式与原生容器查询响应式规则 */}
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

                /* 宽屏未分屏（容器宽度 >= 860px）：两列并排，主卡片弹性伸展尽可能占满对话框宽度 */
                @container (min-width: 860px) {
                    .shenji-flex-layout {
                        flex-direction: row !important;
                        align-items: flex-start !important;
                    }
                    .shenji-main-card {
                        flex: 1 1 0% !important;
                        width: auto !important;
                        min-width: 520px !important;
                    }
                    .shenji-auto-card {
                        width: 330px !important;
                        max-width: 330px !important;
                        flex-shrink: 0 !important;
                    }
                }

                /* 分屏或窄屏（容器宽度 < 860px）：全宽垂直瀑布流，左分屏体验保持不变 */
                @container (max-width: 859px) {
                    .shenji-flex-layout {
                        flex-direction: column !important;
                    }
                    .shenji-main-card {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                    .shenji-auto-card {
                        width: 100% !important;
                        max-width: 100% !important;
                    }
                }
            `}</style>

            <div className="shenji-flex-layout flex flex-col gap-3 w-full">
                {/* 左侧主卡片：神机属性锻造 */}
                <div
                    className="shenji-main-card @container w-full rounded-[4px] p-3.5"
                    style={{
                        background: 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)',
                        border: '1px solid #283e54',
                        fontFamily: SIM_FONT,
                        boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                >

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
                        <div>· 档位概率（{slot}，模拟器体验调整值，非游戏内实测）：{tierRateText}。</div>
                        <div>· 按此概率：{redComboText}。</div>
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
                                        : showAutoPanel
                                            ? 'rgba(16, 26, 36, 0.6)'
                                            : poolReady
                                                ? 'linear-gradient(180deg, #274563 0%, #142a3d 100%)'
                                                : 'rgba(16, 26, 36, 0.6)',
                                    border: `1px solid ${auto ? '#b34739' : showAutoPanel ? '#1a2938' : poolReady ? '#3c678f' : '#203244'}`,
                                    boxShadow: auto
                                        ? '0 0 12px rgba(220,60,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                                        : showAutoPanel
                                            ? 'none'
                                            : poolReady
                                                ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 5px rgba(0,0,0,0.5)'
                                                : 'none',
                                    color: auto ? '#ffffff' : showAutoPanel ? '#4a657c' : poolReady ? '#ffffff' : '#4a657c',
                                    cursor: poolReady ? 'pointer' : 'not-allowed',
                                    fontFamily: SIM_FONT,
                                }}
                                title={showAutoPanel && !auto ? '自动锻造面板已开启（点击可收起）' : undefined}
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

            {/* 右侧并排 / 窄屏纵向堆叠：自动锻造独立窗口（与游戏实机 1:1 还原） */}
            {showAutoPanel && (
                <div
                    className="shenji-auto-card w-full rounded-[4px] p-3.5 select-none"
                    style={{
                        background: 'linear-gradient(180deg, #131b24 0%, #0c1219 100%)',
                        border: '1px solid #283e54',
                        fontFamily: SIM_FONT,
                        boxShadow: '0 12px 36px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                >
                    {/* 标题栏：米金字体居中，右上角帮助与关闭 */}
                    <div
                        className="relative flex items-center justify-between px-3 py-1.5 -mx-3.5 -mt-3.5 mb-2.5 rounded-t-[3px]"
                        style={{
                            background: 'linear-gradient(180deg, #192636 0%, #101a24 100%)',
                            borderBottom: '1px solid #283e54',
                        }}
                    >
                        <div className="w-5" />
                        <span
                            className="text-[15px] font-bold tracking-[2px]"
                            style={{
                                color: '#f7f4bb',
                                textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000',
                            }}
                        >
                            自动锻造
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => {
                                    if (auto) stopAll();
                                    setShowAutoPanel(false);
                                }}
                                className="w-5 h-5 flex items-center justify-center rounded-full text-[#8ea8c2] hover:text-[#ffffff] hover:bg-[#284159] transition-colors"
                                title="关闭自动锻造"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* 红色规则说明：与原版客户端完全一致 */}
                    <div
                        className="px-1 py-1 mb-3 text-[12px] leading-[18px] text-[#e04538]"
                        style={{ textShadow: '0 1px 2px #000000' }}
                    >
                        <div>根据预设属性自动锻造</div>
                        <div>只有当锻造后的神机属性相匹配且对应品质等于或者高于预设品质时方会停止锻造。</div>
                    </div>

                    {/* 3行预设属性目标：窄屏绝对防换行布局 */}
                    <div className="space-y-2.5">
                        {[0, 1, 2].map((i) => {
                            const unlocked = i < pools.length;
                            const level = i === 0 ? 11 : i === 1 ? 13 : 15;
                            const options = attrOptionsBySlot[i] ?? [];
                            const curTarget = targets[i] ?? { attrName: '无', minTier: 0 };
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-2 ${unlocked ? '' : 'opacity-35 pointer-events-none'}`}
                                >
                                    <span className="w-[50px] shrink-0 text-[13px] text-[#7ea0bd] font-medium whitespace-nowrap">
                                        属性{i + 1}:
                                    </span>
                                    <select
                                        disabled={!unlocked}
                                        value={unlocked ? curTarget.attrName : `需蕴灵+${level}解锁`}
                                        onChange={(e) => handleTargetAttrNameChange(i, e.target.value)}
                                        className="flex-1 min-w-0 h-[28px] px-1.5 text-[12px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0] truncate"
                                        title={unlocked ? curTarget.attrName : `需蕴灵+${level}解锁`}
                                    >
                                        {!unlocked ? (
                                            <option value={`需蕴灵+${level}解锁`}>需蕴灵+{level}解锁</option>
                                        ) : (
                                            <>
                                                <option value="无">无</option>
                                                {options.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </>
                                        )}
                                    </select>
                                    <select
                                        disabled={!unlocked}
                                        value={curTarget.minTier}
                                        onChange={(e) => handleTargetMinTierChange(i, Number(e.target.value))}
                                        className="w-[96px] shrink-0 h-[28px] px-1 text-[12px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0]"
                                    >
                                        {BASE_QUALITY_OPTIONS.map((q) => (
                                            <option key={q.value} value={q.value} style={{ color: q.color }}>
                                                {q.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>

                    {/* 达成目标时的动态提示 */}
                    {targetHitMsg && (
                        <div className="mt-3 text-center text-[12px] py-1.5 px-2 rounded-[2px] bg-[#143324] border border-[#276e4c] text-[#6fe8a8] font-medium animate-pulse">
                            {targetHitMsg}
                        </div>
                    )}

                    {/* 底部控制按钮（开始锻造/停止锻造，无神机石道具方格） */}
                    <div className="flex gap-2.5 pt-3 mt-3 border-t border-[#1a2d40]">
                        <button
                            type="button"
                            disabled={!poolReady || auto}
                            onClick={startAutoForge}
                            className="flex-1 py-1.5 rounded-[3px] text-[13px] tracking-wider transition-all font-medium select-none"
                            style={{
                                background: poolReady && !auto
                                    ? 'linear-gradient(180deg, #274563 0%, #142a3d 100%)'
                                    : 'rgba(16, 26, 36, 0.6)',
                                border: `1px solid ${poolReady && !auto ? '#3c678f' : '#203244'}`,
                                boxShadow: poolReady && !auto
                                    ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)'
                                    : 'none',
                                color: poolReady && !auto ? '#ffffff' : '#4a657c',
                                cursor: poolReady && !auto ? 'pointer' : 'not-allowed',
                            }}
                        >
                            开始锻造
                        </button>
                        <button
                            type="button"
                            disabled={!auto}
                            onClick={stopAll}
                            className="flex-1 py-1.5 rounded-[3px] text-[13px] tracking-wider transition-all font-medium select-none"
                            style={{
                                background: auto
                                    ? 'linear-gradient(180deg, #872e22 0%, #4f1710 100%)'
                                    : 'rgba(16, 26, 36, 0.6)',
                                border: `1px solid ${auto ? '#b34739' : '#203244'}`,
                                boxShadow: auto
                                    ? '0 0 12px rgba(220,60,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                                    : 'none',
                                color: auto ? '#ffffff' : '#4a657c',
                                cursor: auto ? 'pointer' : 'not-allowed',
                            }}
                        >
                            停止锻造
                        </button>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

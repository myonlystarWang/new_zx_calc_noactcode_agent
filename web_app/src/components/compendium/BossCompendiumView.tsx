import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Swords } from 'lucide-react';
import clsx from 'clsx';
import { chipCls, chipCountCls } from '../ui/chipStyles';
import { pinyin } from 'pinyin-pro';
import { DataService } from '../../services/DataService';
import type { Dungeon, Monster } from '../../types';
import { formatNumber } from '../../utils/format';

interface BossCompendiumViewProps {
    focusDungeonId?: string | null;
    focusMonsterId?: string | null;
    onNavigateCalculator?: (dungeonId: string, monsterId: string) => void;
    /** 用户手动切换副本（含「全部」）时回调，用于把选择回写入 URL 的 ?d= */
    onDungeonChange?: (dungeonId: string) => void;
    /**
     * 外部定位意图（?d= / ?m=）处理完毕后的回调，由上层清空定位意图。
     * ⚠️ 必须由本组件触发：CompendiumView 要到 activePrimaryTab 切到 boss 的那次渲染才挂载本组件，
     *    若它提前 consume，本组件挂载时 focusDungeonId 已是 undefined → 深链失效。
     */
    onSearchConsumed?: () => void;
}

// 副本难度配色映射
const DIFFICULTY_CONFIG: Record<string, { label: string; badge: string }> = {
    '简单': { label: '简单', badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
    '中等': { label: '中等', badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
    '较难': { label: '较难', badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
    '难': { label: '难', badge: 'bg-orange-500/15 border-orange-500/30 text-orange-400' },
    '极难': { label: '极难', badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
};

// 副本分类定义
type DungeonCategory = 'all' | 'tben' | 'tuanben' | 'trials';

const DUNGEON_CATEGORIES: { id: DungeonCategory; label: string }[] = [
    { id: 'all', label: '全部副本' },
    { id: 'tben', label: 'T本（T16-T21）' },
    { id: 'tuanben', label: '团本（兽神、空桑、天帝、流波）' },
    { id: 'trials', label: '历练与试炼（四象七、悬夜林）' },
];

// 二级筛选简写映射
const DUNGEON_SHORT_LABELS: Record<string, string> = {
    HUIMENG_LINGYUN_T16: 'T16',
    HUIMENG_LINGYUN_T17: 'T17',
    HUIMENG_LINGYUN_T18: 'T18',
    ZHENHAI_DUANLANG_T19: 'T19',
    ZHENHAI_DUANLANG_T20: 'T20',
    ZHENHAI_DUANLANG_T21: 'T21',
    SHOUSHEN_JIANGLIN_HARD: '兽神困难',
    JIEQI_KONGSANG_NORMAL: '空桑初识',
    JIEQI_KONGSANG_HARD: '空桑困难',
    TIANDI_BAOKU_NORMAL: '天帝1',
    TIANDI_BAOKU_MEDIUM: '天帝2',
    TIANDI_BAOKU_HARD: '天帝3',
    LIU_BO_JING_BIAN_CHUSHI: '流波初识',
    LIU_BO_JING_BIAN_HARD: '流波困难',
    SIXIANG_QI: '四象七',
    XUANYELIN_QIWEI_WUGONG: '悬夜林',
};

// 预设排序权重（与用户列出顺序完全一致）
const DUNGEON_ORDER_MAP: Record<string, number> = {
    HUIMENG_LINGYUN_T16: 10,
    HUIMENG_LINGYUN_T17: 20,
    HUIMENG_LINGYUN_T18: 30,
    ZHENHAI_DUANLANG_T19: 40,
    ZHENHAI_DUANLANG_T20: 50,
    ZHENHAI_DUANLANG_T21: 60,
    SHOUSHEN_JIANGLIN_HARD: 110,
    JIEQI_KONGSANG_NORMAL: 120,
    JIEQI_KONGSANG_HARD: 130,
    TIANDI_BAOKU_NORMAL: 140,
    TIANDI_BAOKU_MEDIUM: 150,
    TIANDI_BAOKU_HARD: 160,
    LIU_BO_JING_BIAN_CHUSHI: 170,
    LIU_BO_JING_BIAN_HARD: 180,
    SIXIANG_QI: 210,
    XUANYELIN_QIWEI_WUGONG: 220,
};

const getDungeonCategory = (dungeonId: string): DungeonCategory => {
    if (dungeonId.startsWith('HUIMENG_LINGYUN') || dungeonId.startsWith('ZHENHAI_DUANLANG')) return 'tben';
    if (
        dungeonId.startsWith('TIANDI_BAOKU') ||
        dungeonId.startsWith('LIU_BO_JING_BIAN') ||
        dungeonId.startsWith('JIEQI_KONGSANG') ||
        dungeonId.startsWith('SHOUSHEN_JIANGLIN')
    ) return 'tuanben';
    return 'trials';
};

export const BossCompendiumView: React.FC<BossCompendiumViewProps> = ({
    focusDungeonId,
    focusMonsterId,
    onNavigateCalculator,
    onDungeonChange,
    onSearchConsumed,
}) => {
    const service = useMemo(() => DataService.getInstance(), []);
    const dungeons: Dungeon[] = useMemo(() => service.getDungeons(), [service]);

    const [activeCategory, setActiveCategory] = useState<DungeonCategory>('all');
    const [selectedDungeonId, setSelectedDungeonId] = useState<string>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [highlightMonsterId, setHighlightMonsterId] = useState<string | null>(null);

    // 统计各分类下的首领数量
    const categoryCounts = useMemo(() => {
        const counts: Record<DungeonCategory, number> = {
            all: 0,
            tben: 0,
            tuanben: 0,
            trials: 0,
        };
        for (const d of dungeons) {
            const cat = getDungeonCategory(d.DungeonID);
            const mCount = d.Monsters?.length || 0;
            counts.all += mCount;
            counts[cat] += mCount;
        }
        return counts;
    }, [dungeons]);

    // onSearchConsumed 在 App 里是内联箭头函数（每次渲染新引用），放进 effect 依赖会导致
    // 每次渲染重跑定位（重复滚动）。用 ref 持有，effect 只依赖真正的定位参数。
    const onSearchConsumedRef = useRef(onSearchConsumed);
    onSearchConsumedRef.current = onSearchConsumed;

    // 响应外部跳转定位（?d= 副本选中 / ?m= Boss 高亮滚动）
    // consume 放在本组件内、且在所有 setState 之后，保证定位真正落地后才清空意图。
    useEffect(() => {
        if (!focusDungeonId && !focusMonsterId) {
            onSearchConsumedRef.current?.();
            return;
        }

        if (focusDungeonId) {
            const targetDungeon = dungeons.find((d) => d.DungeonID === focusDungeonId);
            if (targetDungeon) {
                setSelectedDungeonId(targetDungeon.DungeonID);
                setActiveCategory(getDungeonCategory(targetDungeon.DungeonID));
            } else {
                // 非法/已失效的 DungeonID（手改 URL、数据改名）→ 回落「全部」，避免筛成空列表
                setSelectedDungeonId('all');
            }
        }
        if (focusMonsterId) {
            setHighlightMonsterId(focusMonsterId);
        }

        const timer = setTimeout(() => {
            if (focusMonsterId) {
                const el = document.getElementById(`boss-card-${focusMonsterId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-400');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
                }
            }
            onSearchConsumedRef.current?.();
        }, 150);
        return () => clearTimeout(timer);
    }, [focusDungeonId, focusMonsterId, dungeons]);

    // 当前大类下的副本列表（按规范顺序排列）
    const categoryDungeons = useMemo(() => {
        const list = activeCategory === 'all'
            ? dungeons
            : dungeons.filter((d) => getDungeonCategory(d.DungeonID) === activeCategory);
        return [...list].sort((a, b) => (DUNGEON_ORDER_MAP[a.DungeonID] || 999) - (DUNGEON_ORDER_MAP[b.DungeonID] || 999));
    }, [dungeons, activeCategory]);

    // 过滤渲染副本与首领列表
    const filteredGroups = useMemo(() => {
        const kw = searchKeyword.trim().toLowerCase();

        return categoryDungeons
            .map((dungeon) => {
                // 如果非搜索模式且选定了单一副本，只匹配该副本
                if (!kw && selectedDungeonId !== 'all' && dungeon.DungeonID !== selectedDungeonId) {
                    return null;
                }

                let monsters = dungeon.Monsters || [];

                // 搜索关键字检索（支持副本名、BOSS名、拼音缩写及全拼）
                if (kw) {
                    const shortName = DUNGEON_SHORT_LABELS[dungeon.DungeonID] || '';
                    const dungeonNameMatch =
                        dungeon.DungeonName.toLowerCase().includes(kw) ||
                        shortName.toLowerCase().includes(kw);

                    if (!dungeonNameMatch) {
                        monsters = monsters.filter((m) => {
                            const name = m.MonsterName.toLowerCase();
                            if (name.includes(kw)) return true;
                            const pyArr = pinyin(m.MonsterName, { toneType: 'none', type: 'array' }) as string[];
                            const pyFull = pyArr.join('').toLowerCase();
                            const pyInitials = pyArr.map((s) => s[0]).join('').toLowerCase();
                            return pyFull.includes(kw) || pyInitials.includes(kw);
                        });
                    }
                }

                if (monsters.length === 0) return null;

                return {
                    dungeon,
                    monsters,
                };
            })
            .filter((g): g is { dungeon: Dungeon; monsters: Monster[] } => g !== null);
    }, [categoryDungeons, selectedDungeonId, searchKeyword]);

    return (
        <div className="w-full flex flex-col gap-4 animate-in fade-in duration-300">
            {/* 筛选面板：一级分类 + 二级难度 + 搜索。
                两行之间 gap-3(12px)，与「职业状态一览」的减益/增益组保持同一密度 */}
            <div className="flex flex-col gap-3 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/60">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {DUNGEON_CATEGORIES.map((cat) => {
                        const isSelected = activeCategory === cat.id;
                        const count = categoryCounts[cat.id] || 0;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSelectedDungeonId('all');
                                }}
                                className={chipCls(isSelected)}
                            >
                                <span>{cat.label}</span>
                                <span className={chipCountCls(isSelected)}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                        <button
                            onClick={() => {
                                setSelectedDungeonId('all');
                                onDungeonChange?.('all');
                            }}
                            className={chipCls(selectedDungeonId === 'all')}
                        >
                            全部
                        </button>
                        {categoryDungeons.map((d) => {
                            const isSelected = selectedDungeonId === d.DungeonID;
                            const shortLabel = DUNGEON_SHORT_LABELS[d.DungeonID] || d.DungeonName;
                            return (
                                <button
                                    key={d.DungeonID}
                                    onClick={() => {
                                        setSelectedDungeonId(d.DungeonID);
                                        onDungeonChange?.(d.DungeonID);
                                    }}
                                    className={chipCls(isSelected)}
                                >
                                    {shortLabel}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative flex-1 sm:max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜索 BOSS 名字 / 副本 (支持拼音)..."
                            className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-7 py-1 text-xs md:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 transition-colors"
                        />
                        {searchKeyword && (
                            <button
                                onClick={() => setSearchKeyword('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. 副本与 Boss 卡片列表 */}
            {filteredGroups.length === 0 ? (
                <div className="zx-card p-12 text-center text-slate-500 flex flex-col items-center gap-3">
                    <Search className="w-8 h-8 text-slate-600" />
                    <p className="text-sm">未找到与“{searchKeyword}”相匹配的副本或 BOSS 数据</p>
                    <button
                        onClick={() => {
                            setSearchKeyword('');
                            setSelectedDungeonId('all');
                            setActiveCategory('all');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-500/30 transition-all"
                    >
                        重置搜索与筛选
                    </button>
                </div>
            ) : (
                filteredGroups.map(({ dungeon, monsters }) => {
                    const diffMeta = DIFFICULTY_CONFIG[dungeon.difficulty || '中等'] || DIFFICULTY_CONFIG['中等'];

                    return (
                        <div key={dungeon.DungeonID} className="flex flex-col gap-3">
                            {/* 副本标题栏 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 bg-slate-900/60 border border-slate-800/70 rounded-xl">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full"></span>
                                    <h3 className="text-sm font-black text-slate-100 tracking-wide">
                                        {dungeon.DungeonName}
                                    </h3>
                                    <span className={clsx('text-[11px] font-bold px-2 py-0.2 rounded-md border', diffMeta.badge)}>
                                        {diffMeta.label}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                        {monsters.length} 位首领/目标
                                    </span>
                                </div>
                                {dungeon.Description && (
                                    <div className="text-xs text-slate-400 line-clamp-1 max-w-md hidden sm:block">
                                        {dungeon.Description}
                                    </div>
                                )}
                            </div>

                            {/* Boss 卡片网格：3列响应式流式卡片 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {monsters.map((monster) => (
                                    <BossCard
                                        key={monster.MonsterID}
                                        monster={monster}
                                        dungeon={dungeon}
                                        isHighlighted={highlightMonsterId === monster.MonsterID}
                                        onNavigateCalculator={onNavigateCalculator}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

/** 单个 Boss 卡片：方案 B（结构化矩阵数据表） */
const BossCard: React.FC<{
    monster: Monster;
    dungeon: Dungeon;
    isHighlighted: boolean;
    onNavigateCalculator?: (dungeonId: string, monsterId: string) => void;
}> = ({ monster, dungeon, isHighlighted, onNavigateCalculator }) => {
    const mods = monster.MonsterAttributeModifiers || {};
    const displayAttrs = monster.displayAttributes || {};

    // 核心减爆伤
    const critDmgRed = mods.MonsterCriticalDamagePercentReduction ?? displayAttrs.critDamageReduction ?? 0;

    // 气血数据解析
    const health = displayAttrs.health ?? mods.MonsterHealth;
    const healthBars = displayAttrs.healthBars ?? 1;
    const hasHealthBars = displayAttrs.health && displayAttrs.healthBars && displayAttrs.healthBars > 1;

    // 构建结构化矩阵数据项清单
    interface MatrixItem {
        label: string;
        value: string;
        highlight?: boolean;
    }

    const matrixItems: MatrixItem[] = [];

    // 属性顺序（用户指定）：总气血、单条气血、气血条数、减暴击、减爆伤、防御、攻击、
    // 暴击率、暴击伤害、无视减免、伤害减免、技能躲闪、伤害压缩。有值才显示。
    const critRateRed = displayAttrs.critRateReduction ?? mods.MonsterCriticalHitRateReduction;
    const critDmgRedRaw = mods.MonsterCriticalDamagePercentReduction ?? displayAttrs.critDamageReduction;
    const defense = displayAttrs.defense ?? mods.MonsterDefense;
    const attack = displayAttrs.attack;
    const critRate = displayAttrs.critRate;
    const critDamage = displayAttrs.critDamage;
    const ignoreReduction = displayAttrs.ignoreReduction;
    const damageReduction = displayAttrs.damageReduction;
    const skillDodge = displayAttrs.skillDodge;
    const dmgComp = displayAttrs.damageCompression ?? mods.DamageCompressionPercent;

    // 1. 气血（核心指标）
    if (health) {
        if (hasHealthBars) {
            matrixItems.push({ label: '总气血', value: formatNumber(health * healthBars), highlight: true });
            matrixItems.push({ label: '单条气血', value: formatNumber(health), highlight: true });
            matrixItems.push({ label: '气血条数', value: `${healthBars} 条` });
        } else {
            matrixItems.push({ label: '总气血', value: formatNumber(health), highlight: true });
        }
    }

    // 2. 按指定顺序依次追加（有值才显示）
    if (critRateRed !== undefined && critRateRed !== null) {
        matrixItems.push({ label: '减暴击', value: `${critRateRed}%` });
    }
    if (critDmgRedRaw !== undefined && critDmgRedRaw !== null) {
        matrixItems.push({ label: '减爆伤', value: `${critDmgRedRaw}%` });
    }
    if (defense !== undefined && defense !== null) {
        matrixItems.push({ label: '防御', value: formatNumber(defense) });
    }
    if (critRate !== undefined && critRate !== null) {
        matrixItems.push({ label: '暴击率', value: `${critRate}%` });
    }
    if (critDamage !== undefined && critDamage !== null) {
        matrixItems.push({ label: '暴击伤害', value: `${critDamage}%` });
    }
    if (attack !== undefined && attack !== null) {
        matrixItems.push({ label: '攻击', value: formatNumber(attack) });
    }
    if (ignoreReduction !== undefined && ignoreReduction !== null) {
        matrixItems.push({ label: '无视减免', value: `${ignoreReduction}%` });
    }
    if (skillDodge !== undefined && skillDodge !== null) {
        matrixItems.push({ label: '技能躲闪', value: `${skillDodge}` });
    }
    if (damageReduction !== undefined && damageReduction !== null) {
        matrixItems.push({ label: '减免伤害', value: `${damageReduction}` });
    }
    if (dmgComp !== undefined && dmgComp !== null) {
        matrixItems.push({ label: '伤害压缩', value: `${dmgComp}%` });
    }

    const isBoss = (monster as any).role !== 'add';

    return (
        <div
            id={`boss-card-${monster.MonsterID}`}
            className={clsx(
                'group rounded-xl p-4 transition-all duration-200 border bg-slate-900/85 hover:border-cyan-500/40 hover:bg-slate-900/95 flex flex-col justify-start gap-3.5 shadow-md',
                isHighlighted
                    ? 'border-cyan-400 bg-cyan-950/25 ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]'
                    : 'border-slate-800/80'
            )}
        >
            {/* 1. 头部：首领名 + 关卡 + 等级 + 核心减爆伤徽章 + 测算按钮 */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 gap-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="w-1.5 h-4.5 bg-cyan-400 rounded-full shrink-0"></span>
                    <h4 className="text-[15px] font-black text-slate-100 tracking-wide group-hover:text-cyan-300 transition-colors truncate">
                        {monster.MonsterName}
                    </h4>
                    <span
                        className={clsx(
                            'px-1.5 py-0.2 rounded text-[11px] font-bold border shrink-0',
                            isBoss
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                : 'bg-slate-700/40 border-slate-600/40 text-slate-400'
                        )}
                    >
                        {isBoss ? '首领' : '小怪'}
                    </span>
                    {monster.DungeonLevel ? (
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">
                            · 第 {monster.DungeonLevel} 关
                        </span>
                    ) : null}
                    {(displayAttrs.level || (monster as any).MonsterLevel) ? (
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                            Lv.{displayAttrs.level || (monster as any).MonsterLevel}
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* 减爆伤直接在右上角作为最显眼的核心抗性徽章 */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]">
                        <span className="text-[10px] text-cyan-400/80 font-medium">减爆伤</span>
                        <span className="font-mono font-black text-sm tracking-tight text-cyan-200">
                            {critDmgRed > 0 ? `${critDmgRed}%` : '基础'}
                        </span>
                    </div>

                    {onNavigateCalculator && (
                        <button
                            onClick={() => onNavigateCalculator(dungeon.DungeonID, monster.MonsterID)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300 text-xs font-bold transition-all shrink-0 hover:scale-105"
                            title="将此 BOSS 带入计算器测算技能伤害"
                        >
                            <Swords className="w-3.5 h-3.5 text-cyan-400" />
                            <span>测算</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 2. 属性矩阵网格 (Scheme B: 键左、值右的整齐单元格) */}
            {matrixItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                    {matrixItems.map((item, idx) => (
                        <div
                            key={idx}
                            className={clsx(
                                'flex items-center justify-between px-2.5 py-1.5 rounded-lg border transition-colors',
                                item.highlight
                                    ? 'bg-rose-950/20 border-rose-500/30'
                                    : 'bg-slate-950/60 border-slate-800/60'
                            )}
                        >
                            <span className="text-slate-400 text-[11px] whitespace-nowrap shrink-0 mr-1.5">{item.label}</span>
                            <span
                                className={clsx(
                                    'font-mono font-bold text-xs shrink-0 whitespace-nowrap',
                                    item.highlight ? 'text-rose-300' : 'text-slate-200'
                                )}
                            >
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="px-3 py-2 rounded-lg bg-slate-950/40 border border-slate-800/40 text-center text-xs text-slate-500 font-mono">
                    首领其他实战抗性数据录入中
                </div>
            )}
        </div>
    );
};

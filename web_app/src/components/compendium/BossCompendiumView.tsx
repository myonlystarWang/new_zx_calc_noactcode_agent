import React, { useState, useMemo, useEffect } from 'react';
import { Search, X, Crosshair, Shield, Heart, Zap, Swords, Filter } from 'lucide-react';
import clsx from 'clsx';
import { pinyin } from 'pinyin-pro';
import { DataService } from '../../services/DataService';
import type { Dungeon, Monster } from '../../types';
import { formatNumber } from '../../utils/format';

interface BossCompendiumViewProps {
    focusDungeonId?: string | null;
    focusMonsterId?: string | null;
    onNavigateCalculator?: (dungeonId: string, monsterId: string) => void;
}

// 副本难度配色映射
const DIFFICULTY_CONFIG: Record<string, { label: string; badge: string }> = {
    '简单': { label: '简单', badge: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
    '中等': { label: '中等', badge: 'bg-blue-500/15 border-blue-500/30 text-blue-400' },
    '较难': { label: '较难', badge: 'bg-amber-500/15 border-amber-500/30 text-amber-400' },
    '难': { label: '难', badge: 'bg-orange-500/15 border-orange-500/30 text-orange-400' },
    '极难': { label: '极难', badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400' },
};

// 副本大类归类
type DungeonCategory = 'all' | 'highTier' | 'events' | 'classicTeam' | 'trials';

const DUNGEON_CATEGORIES: { id: DungeonCategory; label: string }[] = [
    { id: 'all', label: '全部副本' },
    { id: 'highTier', label: '高阶挑战 (T19~T21)' },
    { id: 'events', label: '特殊活动 (宝库/流波)' },
    { id: 'classicTeam', label: '经典团队 (T16~T18)' },
    { id: 'trials', label: '历练与试炼' },
];

const getDungeonCategory = (dungeonId: string): DungeonCategory => {
    if (dungeonId.startsWith('ZHENHAI_DUANLANG')) return 'highTier';
    if (dungeonId.startsWith('TIANDI_BAOKU') || dungeonId.startsWith('LIU_BO_JING_BIAN')) return 'events';
    if (dungeonId.startsWith('HUIMENG_LINGYUN')) return 'classicTeam';
    return 'trials';
};

export const BossCompendiumView: React.FC<BossCompendiumViewProps> = ({
    focusDungeonId,
    focusMonsterId,
    onNavigateCalculator,
}) => {
    const service = useMemo(() => DataService.getInstance(), []);
    const dungeons: Dungeon[] = useMemo(() => service.getDungeons(), [service]);

    const [activeCategory, setActiveCategory] = useState<DungeonCategory>('all');
    const [selectedDungeonId, setSelectedDungeonId] = useState<string>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [highlightMonsterId, setHighlightMonsterId] = useState<string | null>(null);

    // 统计总数据
    const totalBossCount = useMemo(() => {
        return dungeons.reduce((acc, d) => acc + (d.Monsters?.length || 0), 0);
    }, [dungeons]);

    // 响应搜索跳转定位
    useEffect(() => {
        if (focusDungeonId) {
            setSelectedDungeonId(focusDungeonId);
            const targetDungeon = dungeons.find((d) => d.DungeonID === focusDungeonId);
            if (targetDungeon) {
                setActiveCategory(getDungeonCategory(targetDungeon.DungeonID));
            }
        }
        if (focusMonsterId) {
            setHighlightMonsterId(focusMonsterId);
            // 滚动到对应卡片
            const timer = setTimeout(() => {
                const el = document.getElementById(`boss-card-${focusMonsterId}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('ring-2', 'ring-cyan-400');
                    setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
                }
            }, 150);
            return () => clearTimeout(timer);
        }
    }, [focusDungeonId, focusMonsterId, dungeons]);

    // 根据分类过滤副本
    const categoryDungeons = useMemo(() => {
        if (activeCategory === 'all') return dungeons;
        return dungeons.filter((d) => getDungeonCategory(d.DungeonID) === activeCategory);
    }, [dungeons, activeCategory]);

    // 根据选择的副本或搜索关键字过滤展示的列表
    const filteredGroups = useMemo(() => {
        const kw = searchKeyword.trim().toLowerCase();

        return dungeons
            .map((dungeon) => {
                // 如果指定了单副本且非搜索全部，按所选副本过滤
                if (!kw && selectedDungeonId !== 'all' && dungeon.DungeonID !== selectedDungeonId) {
                    return null;
                }

                // 如果按大分类过滤且在非关键字搜索状态下
                if (!kw && selectedDungeonId === 'all' && activeCategory !== 'all') {
                    if (getDungeonCategory(dungeon.DungeonID) !== activeCategory) {
                        return null;
                    }
                }

                let monsters = dungeon.Monsters || [];

                // 关键字与拼音检索（同时支持副本名检索和怪物名检索）
                if (kw) {
                    const dungeonNameMatch = dungeon.DungeonName.toLowerCase().includes(kw);
                    if (!dungeonNameMatch) {
                        monsters = monsters.filter((m) => {
                            const name = m.MonsterName.toLowerCase();
                            if (name.includes(kw)) return true;
                            // 拼音首字母与全拼匹配
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
    }, [dungeons, selectedDungeonId, activeCategory, searchKeyword]);

    return (
        <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
            {/* 顶栏概览与搜索操作面板 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 sm:px-5 shadow-lg">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        <Crosshair className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-wide flex items-center gap-2">
                            副本 BOSS 抗性与属性速查
                            <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                                {dungeons.length} 副本 · {totalBossCount} 首领
                            </span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            全副本首领核心减爆伤、总血量、防御及抗性基准直览，支持一键带入战力计算器测算
                        </p>
                    </div>
                </div>

                {/* 搜索框 */}
                <div className="relative w-full lg:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="检索 BOSS 名字 / 副本 (拼音如 kl)"
                        className="w-full bg-slate-950/70 border border-slate-700/70 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                    />
                    {searchKeyword && (
                        <button
                            onClick={() => setSearchKeyword('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* 分类切换 Pills */}
            <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                    <div className="flex items-center gap-1.5 text-slate-400 font-bold mr-1 flex-shrink-0">
                        <Filter className="w-3.5 h-3.5 text-cyan-400" />
                        <span>难度类别:</span>
                    </div>
                    {DUNGEON_CATEGORIES.map((cat) => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setActiveCategory(cat.id);
                                    setSelectedDungeonId('all');
                                }}
                                className={clsx(
                                    'px-3 py-1.5 rounded-xl font-bold transition-all border whitespace-nowrap flex-shrink-0',
                                    isActive
                                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                                )}
                            >
                                {cat.label}
                            </button>
                        );
                    })}
                </div>

                {/* 副本细分切换 Tabs（横向胶囊单行） */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 text-xs no-scrollbar">
                    <button
                        onClick={() => setSelectedDungeonId('all')}
                        className={clsx(
                            'px-2.5 py-1 rounded-lg font-bold transition-all border whitespace-nowrap flex-shrink-0',
                            selectedDungeonId === 'all'
                                ? 'bg-cyan-500/25 border-cyan-400/60 text-cyan-200'
                                : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:text-slate-200'
                        )}
                    >
                        全部包含 ({categoryDungeons.length})
                    </button>
                    {categoryDungeons.map((d) => {
                        const isSelected = selectedDungeonId === d.DungeonID;
                        const diffMeta = DIFFICULTY_CONFIG[d.difficulty || '中等'] || DIFFICULTY_CONFIG['中等'];
                        return (
                            <button
                                key={d.DungeonID}
                                onClick={() => setSelectedDungeonId(d.DungeonID)}
                                className={clsx(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all border whitespace-nowrap flex-shrink-0',
                                    isSelected
                                        ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 font-bold'
                                        : 'bg-slate-900/40 border-slate-800/70 text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                                )}
                            >
                                <span>{d.DungeonName}</span>
                                <span className={clsx('text-[10px] px-1 py-0.2 rounded border', diffMeta.badge)}>
                                    {d.difficulty || '普通'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 列表渲染 */}
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
                            {/* 副本横幅 */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="w-1.5 h-4 bg-cyan-400 rounded-full"></span>
                                    <h3 className="text-sm sm:text-base font-black text-slate-100 tracking-wide">
                                        {dungeon.DungeonName}
                                    </h3>
                                    <span className={clsx('text-xs font-bold px-2 py-0.5 rounded-md border', diffMeta.badge)}>
                                        {diffMeta.label}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">
                                        共 {monsters.length} 位怪物
                                    </span>
                                </div>
                                <div className="text-xs text-slate-400 line-clamp-1 max-w-md hidden sm:block">
                                    {dungeon.Description}
                                </div>
                            </div>

                            {/* Boss 卡片网格 */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {monsters.map((monster) => {
                                    const mods = monster.MonsterAttributeModifiers || {};
                                    const displayAttrs = monster.displayAttributes || {};

                                    // 核心减爆伤
                                    const critDmgRed =
                                        mods.MonsterCriticalDamagePercentReduction ??
                                        displayAttrs.critDamageReduction ??
                                        0;

                                    // 气血
                                    const health = displayAttrs.health ?? mods.MonsterHealth;
                                    const healthBars = displayAttrs.healthBars ?? 1;
                                    const totalHealth = health ? health * healthBars : undefined;

                                    // 防御
                                    const defense = displayAttrs.defense ?? mods.MonsterDefense;

                                    // 减暴击率
                                    const critRateRed =
                                        displayAttrs.critRateReduction ??
                                        mods.MonsterCriticalHitRateReduction;

                                    // 伤害压缩比
                                    const dmgComp =
                                        displayAttrs.damageCompression ??
                                        mods.DamageCompressionPercent;

                                    const isBoss = (monster as any).role !== 'add';
                                    const isHighlighted = highlightMonsterId === monster.MonsterID;

                                    return (
                                        <div
                                            key={monster.MonsterID}
                                            id={`boss-card-${monster.MonsterID}`}
                                            className={clsx(
                                                'zx-card p-4 flex flex-col justify-between gap-3 border transition-all duration-300 relative group hover:border-cyan-500/50 hover:shadow-[0_8px_24px_rgba(6,182,212,0.12)]',
                                                isHighlighted
                                                    ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                                                    : 'border-slate-800/80 bg-slate-900/60'
                                            )}
                                        >
                                            {/* 卡片头部 */}
                                            <div className="flex items-start justify-between gap-2 border-b border-slate-800/70 pb-2.5">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className="text-sm font-black text-slate-100 group-hover:text-cyan-300 transition-colors">
                                                            {monster.MonsterName}
                                                        </h4>
                                                        <span
                                                            className={clsx(
                                                                'text-[10px] px-1.5 py-0.2 rounded font-bold border',
                                                                isBoss
                                                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                                                                    : 'bg-slate-700/40 border-slate-600/40 text-slate-400'
                                                            )}
                                                        >
                                                            {isBoss ? '首领' : '小怪'}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                                        {monster.DungeonLevel ? (
                                                            <span>第 {monster.DungeonLevel} 关</span>
                                                        ) : (
                                                            <span>关卡目标</span>
                                                        )}
                                                        {(monster as any).MonsterLevel && (
                                                            <span>· 等级 {(monster as any).MonsterLevel}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* 带入计算器快捷按钮 */}
                                                {onNavigateCalculator && (
                                                    <button
                                                        onClick={() =>
                                                            onNavigateCalculator(dungeon.DungeonID, monster.MonsterID)
                                                        }
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold transition-all whitespace-nowrap shadow-sm hover:scale-105"
                                                        title="将此 BOSS 带入计算器测算技能伤害"
                                                    >
                                                        <Swords className="w-3.5 h-3.5 text-cyan-400" />
                                                        <span>测算</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* 核心抗性大看板：减爆伤 */}
                                            <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-950/40 via-slate-900/60 to-slate-950/70 border border-cyan-500/20 flex items-center justify-between shadow-inner">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                                                        <Zap className="w-3 h-3 text-cyan-400" />
                                                        核心减爆伤
                                                    </span>
                                                    <span className="text-[10px] text-slate-500">暴伤需高于此值生效</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xl sm:text-2xl font-mono font-black text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                                                        {critDmgRed > 0 ? `${critDmgRed}%` : '基础'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 辅助属性规格四宫格 */}
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                {/* 总气血 */}
                                                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/70 flex flex-col gap-0.5">
                                                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                        <Heart className="w-3 h-3 text-rose-400" />
                                                        气血总值
                                                    </span>
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {totalHealth !== undefined
                                                            ? formatNumber(totalHealth)
                                                            : '实测中'}
                                                    </span>
                                                </div>

                                                {/* 防御 */}
                                                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/70 flex flex-col gap-0.5">
                                                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                        <Shield className="w-3 h-3 text-amber-400" />
                                                        怪物防御
                                                    </span>
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {defense !== undefined ? formatNumber(defense) : '实测中'}
                                                    </span>
                                                </div>

                                                {/* 减暴击率 */}
                                                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/70 flex flex-col gap-0.5">
                                                    <span className="text-[11px] text-slate-400">减暴击率</span>
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {critRateRed !== undefined ? `${critRateRed}%` : '-'}
                                                    </span>
                                                </div>

                                                {/* 伤害压缩比 */}
                                                <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/70 flex flex-col gap-0.5">
                                                    <span className="text-[11px] text-slate-400">伤害压缩</span>
                                                    <span className="font-mono font-bold text-slate-200">
                                                        {dmgComp !== undefined ? `${dmgComp}%` : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

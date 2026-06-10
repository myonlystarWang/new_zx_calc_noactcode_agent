import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Flame, Target, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { DataService } from '../../services/DataService';

interface BossConfigPanelProps {
    selectedDungeonId: string;
    selectedBossId: string;
    customBossHp: string;
    onDungeonChange: (id: string) => void;
    onBossChange: (id: string) => void;
    onHpChange: (hp: string) => void;
    // Dynamic run states
    inspectBossHp?: number;
    startingHp?: number;
}

export const BossConfigPanel: React.FC<BossConfigPanelProps> = ({
    selectedDungeonId,
    selectedBossId,
    customBossHp,
    onDungeonChange,
    onBossChange,
    onHpChange,
    inspectBossHp,
    startingHp
}) => {
    const service = DataService.getInstance();
    const dungeons = service.getDungeons();

    const currentDungeon = dungeons.find(d => d.DungeonID === selectedDungeonId) || dungeons[0];
    const monsters = currentDungeon?.Monsters || [];
    const currentBoss = monsters.find(m => m.MonsterID === selectedBossId) || monsters[0];

    const [isDetailsExpanded, setIsDetailsExpanded] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Flatten all bosses across all dungeons for fuzzy search
    const allBosses = useMemo(() => {
        return dungeons.flatMap(d => d.Monsters.map(m => ({
            ...m,
            dungeonId: d.DungeonID,
            dungeonName: d.DungeonName,
            difficulty: d.difficulty
        })));
    }, [dungeons]);

    // Filtered bosses list based on search query
    const filteredBosses = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return allBosses.filter(b => 
            b.MonsterName.toLowerCase().includes(query) || 
            b.dungeonName.toLowerCase().includes(query)
        );
    }, [allBosses, searchQuery]);

    // Handle clicking outside of fuzzy search dropdown to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset boss selection if dungeon changes and current boss is not in new dungeon
    useEffect(() => {
        if (currentDungeon && !monsters.some(m => m.MonsterID === selectedBossId) && monsters.length > 0) {
            onBossChange(monsters[0].MonsterID);
        }
    }, [selectedDungeonId, monsters, selectedBossId, onBossChange, currentDungeon]);

    const handleDungeonSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onDungeonChange(e.target.value);
    };

    const handleBossSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onBossChange(e.target.value);
    };

    const getBossHealth = () => {
        if (!currentBoss) return 0;
        return currentBoss.MonsterAttributeModifiers.MonsterHealth || 0;
    };

    const getCompressionText = (rate?: number) => {
        if (rate === undefined) return '无';
        return `${rate}%`;
    };

    return (
        <div className="flex flex-col justify-between h-full">

            <div>
                {/* Boss HUD Header */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-3">
                    <div className="p-1 rounded bg-red-500/10 border border-red-500/20">
                        <Target className="w-4 h-4 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-100 tracking-wide">首领目标槽 (Target HUD)</h3>
                        <p className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase leading-none">Enemy Status</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Boss Fuzzy Search Box */}
                    <div ref={searchRef} className="relative z-30">
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onFocus={() => setIsSearchFocused(true)}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="🔍 输入 Boss 姓名或副本搜索一秒锁定..."
                                className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-red-500/40 transition-colors"
                            />
                            <Search className="w-3.5 h-3.5 text-slate-650 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        </div>

                        {/* Search Dropdown list */}
                        {isSearchFocused && filteredBosses.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl overflow-y-auto max-h-[180px] z-50">
                                {filteredBosses.map(b => (
                                    <div
                                        key={b.MonsterID}
                                        onClick={() => {
                                            onDungeonChange(b.dungeonId);
                                            onBossChange(b.MonsterID);
                                            setSearchQuery('');
                                            setIsSearchFocused(false);
                                        }}
                                        className="p-2 hover:bg-red-500/10 hover:text-red-350 text-slate-300 font-semibold text-xs transition-colors cursor-pointer border-b border-slate-900 last:border-b-0 flex items-center justify-between"
                                    >
                                        <span>第{b.DungeonLevel}关: {b.MonsterName}</span>
                                        <span className="text-[10px] text-slate-550 italic font-normal">
                                            {b.dungeonName} ({b.difficulty || '普通'})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Simulated Game Boss Target Frame (Health bar HUD) */}
                    {currentBoss && (
                        <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-2.5 relative">
                            {/* Simulated Target Icon */}
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-red-400">BOSS</span>
                                    <span className="text-[11px] font-bold text-slate-100">{currentBoss.MonsterName}</span>
                                </div>
                                <span className="text-[9px] font-bold font-mono text-slate-500 bg-slate-900 px-1.5 py-0.2 rounded border border-slate-850">
                                    LV.170
                                </span>
                            </div>

                            {/* Large Red HP Bar */}
                            {(() => {
                                const hpToDisplay = inspectBossHp !== undefined ? inspectBossHp : (customBossHp ? parseFloat(customBossHp) || getBossHealth() : getBossHealth());
                                const maxHpToDisplay = startingHp !== undefined ? startingHp : (customBossHp ? parseFloat(customBossHp) || getBossHealth() : getBossHealth());
                                const hpPercent = maxHpToDisplay > 0 ? parseFloat(((hpToDisplay / maxHpToDisplay) * 100).toFixed(1)) : 100;
                                return (
                                    <div className="w-full h-4 bg-red-950/80 rounded border border-red-900/60 relative overflow-hidden flex items-center justify-center">
                                        {/* HP progress filler */}
                                        <div 
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-800 to-rose-600 transition-all duration-300"
                                            style={{ width: `${hpPercent}%` }}
                                        ></div>
                                        <span className="relative z-10 text-[9px] font-bold text-slate-100 font-mono tracking-wider text-shadow">
                                            {Math.round(hpToDisplay).toLocaleString()} / {Math.round(maxHpToDisplay).toLocaleString()} ({hpPercent}%)
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Standard Selection Inputs & HP Overrides */}
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">选择副本</label>
                            <select
                                value={selectedDungeonId}
                                onChange={handleDungeonSelect}
                                className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-red-500/40"
                            >
                                {dungeons.map(d => (
                                    <option key={d.DungeonID} value={d.DungeonID}>
                                        {d.DungeonName} {d.difficulty ? `(${d.difficulty})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-1">选择 Boss 关卡</label>
                            <select
                                value={selectedBossId}
                                onChange={handleBossSelect}
                                className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-red-500/40"
                            >
                                {monsters.map(m => (
                                    <option key={m.MonsterID} value={m.MonsterID}>
                                        第{m.DungeonLevel}关: {m.MonsterName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                                Boss 血量上限覆盖 (可选)
                            </label>
                            <span className="text-[8px] font-mono text-slate-500">
                                当前原生: {getBossHealth().toLocaleString()}
                            </span>
                        </div>
                        <input
                            type="text"
                            value={customBossHp}
                            onChange={(e) => onHpChange(e.target.value)}
                            placeholder="如果不填，将采用副本原生属性值"
                            className="w-full bg-slate-950/80 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-semibold focus:outline-none focus:border-red-500/40"
                        />
                    </div>

                    {/* Expandable Attributes Display */}
                    <div className="border-t border-slate-900/60 pt-2.5">
                        <button
                            type="button"
                            onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                            className="w-full flex items-center justify-between text-[10px] font-bold text-slate-450 hover:text-slate-350 transition-colors"
                        >
                            <span>首领详细免伤/抗性数据</span>
                            {isDetailsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isDetailsExpanded && currentBoss && (
                            <div className="bg-slate-950/40 border border-slate-900 rounded-xl p-2.5 mt-2 space-y-1.5 text-[10px] text-slate-400 animate-in fade-in duration-200">
                                <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                                    <span>防御力</span>
                                    <span className="font-mono text-slate-200">
                                        {currentBoss.MonsterAttributeModifiers.MonsterDefense?.toLocaleString() ?? 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                                    <span>伤害压缩比例</span>
                                    <span className="font-mono text-red-400 font-bold">
                                        {getCompressionText(currentBoss.MonsterAttributeModifiers.DamageCompressionPercent)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                                    <span>御暴击率</span>
                                    <span className="font-mono text-slate-200">
                                        {currentBoss.MonsterAttributeModifiers.MonsterCriticalHitRateReduction ?? 0}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                                    <span>御暴击伤害</span>
                                    <span className="font-mono text-slate-200">
                                        {currentBoss.MonsterAttributeModifiers.MonsterCriticalDamagePercentReduction ?? 0}%
                                    </span>
                                </div>
                                <div className="flex items-start gap-1 pt-1.5 text-[9px] text-amber-500 font-semibold leading-normal">
                                    <Flame className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>免伤机制：当前首领具备防御与专属压缩比例，对极高爆发及多段伤害有明显的压缩收益。</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../../services/DataService';
import type { CuratedEquipItem } from '../../types';
import { GameTooltipShell } from '../ui/GameColorText';
import {
    Shield,
    Search,
    X,
    Sliders,
    Sparkles,
    CheckCircle2,
    Lock,
    Award,
    Layers
} from 'lucide-react';
import clsx from 'clsx';
import { chipCls, CHIP_ROW_BASE } from '../ui/chipStyles';

const QUALITY_COLOR_MAP: Record<string, {
    text: string;
    bg: string;
    border: string;
    badge: string;
}> = {
    神隐: {
        text: 'text-amber-300',
        bg: 'bg-amber-500/15',
        border: 'border-amber-500/40 hover:border-amber-500/70',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    },
    彰武: {
        text: 'text-rose-400',
        bg: 'bg-rose-500/15',
        border: 'border-rose-500/40 hover:border-rose-500/70',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    },
    昭武: {
        text: 'text-purple-400',
        bg: 'bg-purple-500/15',
        border: 'border-purple-500/40 hover:border-purple-500/70',
        badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
    },
    修武: {
        text: 'text-cyan-400',
        bg: 'bg-cyan-500/15',
        border: 'border-cyan-500/40 hover:border-cyan-500/70',
        badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
    },
};

function getRefKey(it: CuratedEquipItem): 'atk' | 'def' | 'hp' | 'mp' | null {
    let best: 'atk' | 'def' | 'hp' | 'mp' | null = null;
    let bv = -1;
    if (it.atk && it.atk[1] > bv) {
        bv = it.atk[1];
        best = 'atk';
    }
    const K: ('def' | 'hp' | 'mp')[] = ['def', 'hp', 'mp'];
    for (const k of K) {
        const v = it[k] || 0;
        if (v > bv) {
            bv = v;
            best = k;
        }
    }
    return best;
}

export const EquipCompendiumView: React.FC = () => {
    const [equipList, setEquipList] = useState<CuratedEquipItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [qualityFilter, setQualityFilter] = useState<string>('all');
    const [slotFilter, setSlotFilter] = useState<string>('all');
    const [profFilter, setProfFilter] = useState<string>('all');
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [selectedItem, setSelectedItem] = useState<CuratedEquipItem | null>(null);
    const [refLevel, setRefLevel] = useState<number>(11); // 默认 +11 (主流档位)

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        DataService.getInstance().getEquipList()
            .then(data => {
                if (mounted) {
                    setEquipList(data);
                    setLoading(false);
                    // 默认高亮彰武或第一件
                    const defaultItem = data.find(x => x.q === '彰武' && x.slot === '衣服') || data[0];
                    if (defaultItem) setSelectedItem(defaultItem);
                }
            })
            .catch(err => {
                if (mounted) {
                    setError(err instanceof Error ? err.message : String(err));
                    setLoading(false);
                }
            });
        return () => { mounted = false; };
    }, []);

    // 门派选项提取
    const availableProfs = useMemo(() => {
        const set = new Set<string>();
        for (const item of equipList) {
            for (const p of item.prof || []) {
                set.add(p);
            }
        }
        return Array.from(set).sort();
    }, [equipList]);

    // 过滤装备列表
    const filteredList = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return equipList.filter(item => {
            if (qualityFilter !== 'all' && item.q !== qualityFilter) return false;
            if (slotFilter !== 'all' && item.slot !== slotFilter) return false;
            if (genderFilter !== 'all') {
                if (genderFilter === '无' && item.g) return false;
                if (genderFilter !== '无' && item.g !== genderFilter) return false;
            }
            if (profFilter !== 'all') {
                if (!item.prof || !item.prof.includes(profFilter)) return false;
            }
            if (q) {
                const combined = `${item.name} ${item.slot} ${item.q} ${(item.prof || []).join(' ')}`.toLowerCase();
                if (!combined.includes(q)) return false;
            }
            return true;
        });
    }, [equipList, qualityFilter, slotFilter, profFilter, genderFilter, searchQuery]);

    // 选中的装备当前强化加成
    const currentRefBonus = useMemo(() => {
        if (!selectedItem || !selectedItem.ref || refLevel <= 0) return 0;
        return selectedItem.ref[refLevel - 1] || 0;
    }, [selectedItem, refLevel]);

    const targetRefKey = useMemo(() => {
        if (!selectedItem) return null;
        return getRefKey(selectedItem);
    }, [selectedItem]);

    if (loading) {
        return (
            <div className="zx-card p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>正在加载精选装备图鉴数据...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="zx-card p-8 text-center text-rose-400 border border-rose-500/30 bg-rose-500/10">
                加载装备图鉴失败：{error}
            </div>
        );
    }

    const qTheme = selectedItem ? (QUALITY_COLOR_MAP[selectedItem.q] || QUALITY_COLOR_MAP['修武']) : QUALITY_COLOR_MAP['修武'];

    return (
        <div className="flex flex-col gap-4">
            {/* 顶栏控制栏 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-3.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-wide">
                                    精选装备图鉴 (修武 / 昭武 / 彰武 / 神隐)
                                </h2>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                    {filteredList.length} / {equipList.length} 件
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                支持武器、头盔、衣服、靴子主流装备 0~+15 炼器递增、附加属性阶梯解锁与神机属性对照
                            </p>
                        </div>
                    </div>

                    {/* 搜索 */}
                    <div className="relative w-full lg:w-72">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="检索装备名称、门派..."
                            className="w-full bg-slate-950/70 border border-slate-700/60 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 筛选标签行 */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-800/60">
                    {/* 品质选择 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 w-16">
                            <Award className="w-3.5 h-3.5" /> 品质:
                        </span>
                        <div className={CHIP_ROW_BASE}>
                            {[
                                { id: 'all', label: '全部品质' },
                                { id: '神隐', label: '神隐品质' },
                                { id: '彰武', label: '彰武品质' },
                                { id: '昭武', label: '昭武品质' },
                                { id: '修武', label: '修武品质' },
                            ].map(qItem => (
                                <button
                                    key={qItem.id}
                                    onClick={() => setQualityFilter(qItem.id)}
                                    className={chipCls(qualityFilter === qItem.id)}
                                >
                                    {qItem.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 部位选择 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 w-16">
                            <Layers className="w-3.5 h-3.5" /> 部位:
                        </span>
                        <div className={CHIP_ROW_BASE}>
                            {[
                                { id: 'all', label: '全部部位' },
                                { id: '武器', label: '武器' },
                                { id: '衣服', label: '衣服' },
                                { id: '头盔', label: '头盔' },
                                { id: '靴子', label: '靴子' },
                            ].map(sItem => (
                                <button
                                    key={sItem.id}
                                    onClick={() => setSlotFilter(sItem.id)}
                                    className={chipCls(slotFilter === sItem.id)}
                                >
                                    {sItem.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 门派与性别过滤下拉行 */}
                    <div className="flex items-center gap-4 flex-wrap text-xs pt-1">
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-semibold w-16">门派限制:</span>
                            <select
                                value={profFilter}
                                onChange={(e) => setProfFilter(e.target.value)}
                                className="bg-slate-950/70 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                            >
                                <option value="all">全部门派</option>
                                {availableProfs.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs font-semibold">性别:</span>
                            <select
                                value={genderFilter}
                                onChange={(e) => setGenderFilter(e.target.value)}
                                className="bg-slate-950/70 border border-slate-700/60 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/60"
                            >
                                <option value="all">全部性别</option>
                                <option value="男">男</option>
                                <option value="女">女</option>
                                <option value="无">通用(无限制)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* 主展示区：Master-Detail 布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左栏：装备卡片网格列表 (lg: 7列) */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                    {filteredList.length === 0 ? (
                        <div className="zx-card p-12 text-center text-slate-500">
                            没有找到匹配的装备，请调整检索词或筛选条件
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[820px] overflow-y-auto pr-1 no-scrollbar">
                            {filteredList.map(item => {
                                const isSelected = selectedItem?.id === item.id;
                                const itemTheme = QUALITY_COLOR_MAP[item.q] || QUALITY_COLOR_MAP['修武'];

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedItem(item)}
                                        className={clsx(
                                            'p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-2.5',
                                            isSelected
                                                ? clsx(itemTheme.bg, itemTheme.border, 'shadow-lg ring-1 ring-cyan-400/40')
                                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-750'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={clsx('font-black text-sm tracking-wide', itemTheme.text)}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                                    <span>{item.slot}</span>
                                                    <span>·</span>
                                                    <span>{item.lv}级</span>
                                                    {item.prof && item.prof.length > 0 && (
                                                        <>
                                                            <span>·</span>
                                                            <span className="text-slate-300 truncate max-w-[140px]">
                                                                {item.prof.join('、')}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0', itemTheme.badge)}>
                                                {item.q}
                                            </span>
                                        </div>

                                        {/* 基础属性概要 */}
                                        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300 bg-slate-950/40 p-2 rounded-lg border border-slate-850">
                                            {item.atk && (
                                                <span>攻击 {item.atk[0]}-{item.atk[1]}</span>
                                            )}
                                            {item.def !== undefined && (
                                                <span>防御 +{item.def}</span>
                                            )}
                                            {item.hp !== undefined && (
                                                <span>气血 +{item.hp}</span>
                                            )}
                                            {item.mp !== undefined && (
                                                <span>真气 +{item.mp}</span>
                                            )}
                                            {item.ad && item.ad.length > 0 && (
                                                <span className="text-slate-500 ml-auto font-sans">
                                                    附加 {item.ad.length} 条
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 右栏：保真装备详细 Tooltip + 0~+15 炼器交互 (lg: 5列, sticky) */}
                <div className="lg:col-span-5 sticky top-20 flex flex-col gap-3">
                    {selectedItem ? (
                        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4">
                            {/* 标题栏与品质徽章 */}
                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className={clsx('text-lg font-black tracking-wide', qTheme.text)}>
                                            {selectedItem.name}
                                        </h3>
                                        {refLevel > 0 && (
                                            <span className="font-mono font-bold text-amber-400 text-base">
                                                +{refLevel}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                        {selectedItem.slot} · {selectedItem.q}品质 · {selectedItem.lv}级
                                    </div>
                                </div>
                                <span className={clsx('text-xs font-bold px-2 py-0.5 rounded border font-mono', qTheme.badge)}>
                                    {selectedItem.q}
                                </span>
                            </div>

                            {/* 炼器强化滑块与快捷等级按钮 (+0 ~ +15) */}
                            <div className="flex flex-col gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>炼器强化等级:</span>
                                        <span className="font-mono font-bold text-amber-400 text-sm">
                                            +{refLevel}
                                        </span>
                                    </span>
                                    {currentRefBonus > 0 && (
                                        <span className="font-mono text-cyan-300 font-bold text-xs bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded">
                                            强化加成: +{currentRefBonus}
                                        </span>
                                    )}
                                </div>

                                {/* 滑块 */}
                                <input
                                    type="range"
                                    min={0}
                                    max={15}
                                    step={1}
                                    value={refLevel}
                                    onChange={(e) => setRefLevel(Number(e.target.value))}
                                    className="w-full accent-cyan-400 cursor-pointer"
                                />

                                {/* 快捷档位选择网格 */}
                                <div className="grid grid-cols-8 gap-1 pt-1">
                                    {[0, 1, 3, 5, 7, 9, 10, 11, 12, 13, 14, 15].map(lv => (
                                        <button
                                            key={lv}
                                            onClick={() => setRefLevel(lv)}
                                            className={clsx(
                                                'py-1 rounded text-xs font-mono font-bold transition-all text-center',
                                                refLevel === lv
                                                    ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                            )}
                                        >
                                            +{lv}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 游戏保真 Tooltip 面板 */}
                            <GameTooltipShell
                                title={`${selectedItem.name} ${refLevel > 0 ? `+${refLevel}` : ''}`}
                                titleColor={selectedItem.q === '神隐' ? '#ffcb4a' : selectedItem.q === '彰武' ? '#ff4d4f' : selectedItem.q === '昭武' ? '#b37feb' : '#36cfc9'}
                                className="border-slate-700/80 bg-[#0c1017]/95 text-xs font-sans leading-relaxed"
                            >
                                <div className="space-y-1 pb-2 border-b border-slate-800/80">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">品质：</span>
                                        <span className={clsx('font-bold', qTheme.text)}>{selectedItem.q}品质</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">部位：</span>
                                        <span className="text-slate-200">{selectedItem.slot}</span>
                                    </div>

                                    {/* 攻击力 (含炼器强化) */}
                                    {selectedItem.atk && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">攻击：</span>
                                            <span className="font-mono font-bold text-slate-100">
                                                {selectedItem.atk[0] + (targetRefKey === 'atk' ? currentRefBonus : 0)} - {selectedItem.atk[1] + (targetRefKey === 'atk' ? currentRefBonus : 0)}
                                                {targetRefKey === 'atk' && currentRefBonus > 0 && (
                                                    <span className="text-cyan-400 font-bold ml-1.5">
                                                        (+{currentRefBonus})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {/* 防御力 */}
                                    {selectedItem.def !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">防御：</span>
                                            <span className="font-mono font-bold text-slate-100">
                                                +{selectedItem.def + (targetRefKey === 'def' ? currentRefBonus : 0)}
                                                {targetRefKey === 'def' && currentRefBonus > 0 && (
                                                    <span className="text-cyan-400 font-bold ml-1.5">
                                                        (+{currentRefBonus})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {/* 气血 */}
                                    {selectedItem.hp !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">气血：</span>
                                            <span className="font-mono font-bold text-slate-100">
                                                +{selectedItem.hp + (targetRefKey === 'hp' ? currentRefBonus : 0)}
                                                {targetRefKey === 'hp' && currentRefBonus > 0 && (
                                                    <span className="text-cyan-400 font-bold ml-1.5">
                                                        (+{currentRefBonus})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {/* 真气 */}
                                    {selectedItem.mp !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">真气：</span>
                                            <span className="font-mono font-bold text-slate-100">
                                                +{selectedItem.mp + (targetRefKey === 'mp' ? currentRefBonus : 0)}
                                                {targetRefKey === 'mp' && currentRefBonus > 0 && (
                                                    <span className="text-cyan-400 font-bold ml-1.5">
                                                        (+{currentRefBonus})
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {selectedItem.rng && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">攻击距离：</span>
                                            <span className="text-slate-200">{selectedItem.rng}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">等级限制：</span>
                                        <span className="text-slate-200">{selectedItem.lv} 级</span>
                                    </div>
                                    {selectedItem.xz && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">修真限制：</span>
                                            <span className="text-slate-200">{selectedItem.xz}</span>
                                        </div>
                                    )}
                                    {selectedItem.prof && selectedItem.prof.length > 0 && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">门派限制：</span>
                                            <span className="text-slate-200">{selectedItem.prof.join('、')}</span>
                                        </div>
                                    )}
                                    {selectedItem.g && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">性别限制：</span>
                                            <span className="text-slate-200">{selectedItem.g}</span>
                                        </div>
                                    )}
                                    {selectedItem.dura && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">耐久：</span>
                                            <span className="text-slate-200">{selectedItem.dura}</span>
                                        </div>
                                    )}
                                </div>

                                {/* 附加属性列表 (根据 refLevel 动态判断激活与锁定) */}
                                {selectedItem.ad && selectedItem.ad.length > 0 && (
                                    <div className="py-2 border-b border-slate-800/80">
                                        <div className="text-[11px] font-bold text-amber-300 pb-1 flex items-center justify-between">
                                            <span>附加属性:</span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                激活 {selectedItem.ad.filter(a => refLevel >= a.l).length} / {selectedItem.ad.length}
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            {selectedItem.ad.map((attr, aIdx) => {
                                                const isUnlocked = refLevel >= attr.l;
                                                return (
                                                    <div
                                                        key={aIdx}
                                                        className={clsx(
                                                            'flex items-center justify-between py-0.5 text-xs font-mono transition-colors',
                                                            isUnlocked
                                                                ? 'text-[#11ff11] font-medium'
                                                                : 'text-slate-500 opacity-60'
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            {isUnlocked ? (
                                                                <CheckCircle2 className="w-3 h-3 text-[#11ff11]" />
                                                            ) : (
                                                                <Lock className="w-3 h-3 text-slate-500" />
                                                            )}
                                                            <span>{attr.d || attr.n}</span>
                                                        </div>
                                                        {attr.l > 0 && (
                                                            <span className={clsx(
                                                                'text-[10px] px-1.5 py-0.2 rounded border',
                                                                isUnlocked
                                                                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                                            )}>
                                                                +{attr.l} 解锁
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 神机属性 (可抽取洗炼词条池) */}
                                {selectedItem.sj && (
                                    <div className="pt-2 flex flex-col gap-2">
                                        <div className="text-[11px] font-bold text-orange-400 flex items-center gap-1">
                                            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                                            <span>神机洗炼属性池:</span>
                                        </div>
                                        {Object.entries(selectedItem.sj).map(([groupKey, bonusList]) => {
                                            if (!bonusList || bonusList.length === 0) return null;
                                            return (
                                                <div key={groupKey} className="space-y-1.5">
                                                    {[11, 13, 15].map(tier => {
                                                        const tierItems = bonusList.filter(b => b.l === tier);
                                                        if (tierItems.length === 0) return null;
                                                        const isUnlocked = refLevel >= tier;

                                                        return (
                                                            <div
                                                                key={tier}
                                                                className={clsx(
                                                                    'p-2 rounded-lg border text-xs flex flex-col gap-1',
                                                                    isUnlocked
                                                                        ? 'bg-orange-950/30 border-orange-500/40 text-orange-200'
                                                                        : 'bg-slate-900/60 border-slate-800 text-slate-500 opacity-60'
                                                                )}
                                                            >
                                                                <div className="flex items-center justify-between font-mono font-bold">
                                                                    <span className={isUnlocked ? 'text-orange-400' : 'text-slate-500'}>
                                                                        +{tier} 档位神机池 ({groupKey})
                                                                    </span>
                                                                    <span className="text-[10px]">
                                                                        {isUnlocked ? '当前已激活' : '需炼器 +' + tier}
                                                                    </span>
                                                                </div>
                                                                <div className="space-y-0.5 pl-1 font-mono text-[11px]">
                                                                    {tierItems.map((bi, bIdx) => (
                                                                        <div key={bIdx} className="truncate">
                                                                            · {bi.d}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </GameTooltipShell>

                            {/* 完整 +1~+15 炼器递增数值表 (速查小矩阵) */}
                            {selectedItem.ref && (
                                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 text-xs flex flex-col gap-2">
                                    <span className="text-slate-400 font-bold flex items-center justify-between">
                                        <span>+1 至 +15 炼器数值递增表:</span>
                                        <span className="text-[10px] text-slate-500">点击任意等阶直接切换</span>
                                    </span>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {selectedItem.ref.slice(0, 15).map((bonus, idx) => {
                                            const lv = idx + 1;
                                            const isActive = refLevel === lv;
                                            return (
                                                <button
                                                    key={lv}
                                                    onClick={() => setRefLevel(lv)}
                                                    className={clsx(
                                                        'p-1.5 rounded-lg border text-center transition-all flex flex-col items-center',
                                                        isActive
                                                            ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                                                            : 'bg-slate-900/80 border-slate-800/80 text-slate-400 hover:bg-slate-800'
                                                    )}
                                                >
                                                    <span className="text-[10px] font-mono text-slate-500 leading-tight">+{lv}</span>
                                                    <span className="text-xs font-mono font-bold text-slate-200 mt-0.5">+{bonus}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="zx-card p-12 text-center text-slate-500">
                            请从左侧列表选择一件装备查看详细属性与炼器数值
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

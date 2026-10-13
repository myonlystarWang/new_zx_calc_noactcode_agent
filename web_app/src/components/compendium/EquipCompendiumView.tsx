import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataService } from '../../services/DataService';
import type { CuratedEquipItem } from '../../types';
import {
    Shield,
    Search,
    X,
    Layers,
    Award
} from 'lucide-react';
import clsx from 'clsx';
import { chipCls, CHIP_ROW_BASE } from '../ui/chipStyles';
import { EquipDetailCard } from './EquipDetailCard';

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

export const EquipCompendiumView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [equipList, setEquipList] = useState<CuratedEquipItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [qualityFilter, setQualityFilter] = useState<string>('all');
    const [slotFilter, setSlotFilter] = useState<string>('all');
    const [profFilter, setProfFilter] = useState<string>('all');
    const [genderFilter, setGenderFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [selectedItem, setSelectedItem] = useState<CuratedEquipItem | null>(null);

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

    // 响应 URL 参数变化同步切换当前高亮装备
    useEffect(() => {
        if (equipList.length === 0) return;
        const nameParam = searchParams.get('name');
        if (nameParam) {
            const matched = equipList.find(x => x.name === nameParam);
            if (matched) {
                setSelectedItem(matched);
            }
        }
    }, [searchParams, equipList]);

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

                                        {/* 附加条目概要 */}
                                        <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-850">
                                            <span className="text-slate-400 font-sans">
                                                可洗炼附加属性
                                            </span>
                                            <span className="font-mono text-cyan-400 font-semibold">
                                                {item.ad?.length || 0} 条
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 右栏：保真装备详细 Tooltip + 强化步进交互 (lg: 5列, sticky) */}
                <div className="lg:col-span-5 sticky top-20 flex flex-col gap-3">
                    {selectedItem ? (
                        <EquipDetailCard item={selectedItem} />
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

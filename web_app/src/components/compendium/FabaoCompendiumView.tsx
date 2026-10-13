import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataService } from '../../services/DataService';
import type { FabaoItem } from '../../types';
import { stripGameColor } from '../ui/GameColorText';
import {
    Sparkles,
    Search,
    X,
    Filter,
    Zap,
    Layers
} from 'lucide-react';
import clsx from 'clsx';
import { chipCls, CHIP_ROW_BASE } from '../ui/chipStyles';
import { FabaoDetailCard } from './FabaoDetailCard';

const EFFECT_TAG_OPTIONS = [
    { id: 'all', label: '全部特效' },
    { id: '破防', label: '破防/降防', keywords: ['破防', '降防', '防御尽散', '降低目标防御'] },
    { id: '增伤', label: '增伤/易伤', keywords: ['增伤', '易伤', '递增伤害', '受到伤害增加'] },
    { id: '暴击', label: '暴击/爆伤', keywords: ['致命一击率', '致命一击伤害', '暴击'] },
    { id: '驱散', label: '解控/驱散', keywords: ['驱除', '清除不利', '解控'] },
    { id: '流失', label: '气血流失', keywords: ['气血流失', '损失气血', '流失自身'] },
    { id: '控制', label: '强控/限制', keywords: ['眩晕', '魅惑', '定身', '虚弱', '禁食', '冰冻', '昏睡'] },
];

export const FabaoCompendiumView: React.FC = () => {
    const [searchParams] = useSearchParams();
    const [fabaoList, setFabaoList] = useState<FabaoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [tagFilter, setTagFilter] = useState<string>('all');

    const [selectedFabao, setSelectedFabao] = useState<FabaoItem | null>(null);

    // 加载数据
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        DataService.getInstance().getFabaoList()
            .then(data => {
                if (mounted) {
                    setFabaoList(data);
                    setLoading(false);
                    // 默认高亮选中 URL 参数指定的法宝，或者天琊，或者第一件法宝
                    const nameParam = searchParams.get('name');
                    const targetItem = nameParam ? data.find(x => x.名称 === nameParam) : null;
                    const defaultItem = targetItem || data.find(x => x.名称 === '天琊') || data[0];
                    if (defaultItem) setSelectedFabao(defaultItem);
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

    // 响应 URL 参数变化同步切换当前高亮法宝
    useEffect(() => {
        if (fabaoList.length === 0) return;
        const nameParam = searchParams.get('name');
        if (nameParam) {
            const matched = fabaoList.find(x => x.名称 === nameParam);
            if (matched) {
                setSelectedFabao(matched);
            }
        }
    }, [searchParams, fabaoList]);



    // 过滤检索列表
    const filteredList = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const selectedTagObj = EFFECT_TAG_OPTIONS.find(t => t.id === tagFilter);

        return fabaoList.filter(item => {
            // 类型过滤
            if (typeFilter !== 'all' && item.类型 !== typeFilter) return false;

            // 等级过滤
            if (levelFilter !== 'all') {
                const itemLv = String(item.等级 || '');
                if (levelFilter === '75down') {
                    if (Number(itemLv) > 75) return false;
                } else if (itemLv !== levelFilter) {
                    return false;
                }
            }

            // 特效标签过滤
            if (tagFilter !== 'all' && selectedTagObj && selectedTagObj.keywords) {
                const specJson = JSON.stringify(item.技能特效 || {});
                const matchKeyword = selectedTagObj.keywords.some(kw => specJson.includes(kw));
                if (!matchKeyword) return false;
            }

            // 搜索关键字（法宝名、技能名、描述文本、特效内容）
            if (q) {
                const plainDesc = item.描述_纯文本 || stripGameColor(item.描述_原始 || '');
                const skillName = item.skillName || '';
                const name = item.名称 || '';
                const specText = JSON.stringify(item.技能特效 || '');
                const combined = `${name} ${skillName} ${plainDesc} ${specText}`.toLowerCase();
                if (!combined.includes(q)) return false;
            }

            return true;
        });
    }, [fabaoList, searchQuery, typeFilter, levelFilter, tagFilter]);



    if (loading) {
        return (
            <div className="zx-card p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span>正在加载法宝图鉴数据...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="zx-card p-8 text-center text-rose-400 border border-rose-500/30 bg-rose-500/10">
                加载法宝图鉴失败：{error}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {/* 顶部控制栏与检索 */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-3.5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-100 tracking-wide">
                                    精选法宝图鉴
                                </h2>
                                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    {filteredList.length} / {fabaoList.length} 件
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                汇集诛仙3主流战斗法宝、传承（承）与真·法宝特技、多段攻击与破防易伤机制
                            </p>
                        </div>
                    </div>

                    {/* 实时搜索 */}
                    <div className="relative w-full lg:w-72">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="检索法宝名称、技能名、破防/易伤..."
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
                    {/* 类型过滤 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 w-16">
                            <Layers className="w-3.5 h-3.5" /> 类型:
                        </span>
                        <div className={CHIP_ROW_BASE}>
                            {[
                                { id: 'all', label: '全部' },
                                { id: '通用法宝', label: '通用法宝' },
                                { id: '门派法宝', label: '门派法宝' },
                                { id: '种族法宝', label: '种族法宝' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTypeFilter(t.id)}
                                    className={chipCls(typeFilter === t.id)}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 等级过滤 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 w-16">
                            <Filter className="w-3.5 h-3.5" /> 等级:
                        </span>
                        <div className={CHIP_ROW_BASE}>
                            {[
                                { id: 'all', label: '全部等级' },
                                { id: '135', label: '135 级 (主流)' },
                                { id: '105', label: '105 级' },
                                { id: '75down', label: '75 级及以下' },
                            ].map(lv => (
                                <button
                                    key={lv.id}
                                    onClick={() => setLevelFilter(lv.id)}
                                    className={chipCls(levelFilter === lv.id)}
                                >
                                    {lv.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 机制特效快捷标签 */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="text-slate-400 text-xs font-semibold flex items-center gap-1 w-16">
                            <Zap className="w-3.5 h-3.5 text-amber-400" /> 特效:
                        </span>
                        <div className={`${CHIP_ROW_BASE} overflow-x-auto`}>
                            {EFFECT_TAG_OPTIONS.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setTagFilter(opt.id)}
                                    className={chipCls(tagFilter === opt.id)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 主展示区：Master-Detail 布局（左侧列表卡片，右侧保真 Tooltip 与交互） */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* 左栏：法宝卡片网格列表 (lg: 7列) */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                    {filteredList.length === 0 ? (
                        <div className="zx-card p-12 text-center text-slate-500">
                            没有找到符合条件的法宝，请调整检索词或筛选条件
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[820px] overflow-y-auto pr-1 no-scrollbar">
                            {filteredList.map(item => {
                                const isSelected = selectedFabao?.id === item.id;
                                const lvNum = Number(item.等级);
                                const isHighLevel = lvNum >= 135;
                                const variantsCount = Object.keys(item.技能特效 || {}).length;

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedFabao(item)}
                                        className={clsx(
                                            'p-3.5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-2.5',
                                            isSelected
                                                ? 'bg-purple-950/40 border-purple-400/70 shadow-[0_0_16px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/50'
                                                : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-750'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={clsx(
                                                        'font-black text-sm tracking-wide',
                                                        isHighLevel ? 'text-amber-300' : 'text-slate-100'
                                                    )}>
                                                        {item.名称}
                                                    </span>
                                                    {item.等级 && (
                                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/60">
                                                            {item.等级}级
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-cyan-400 font-medium mt-1 truncate">
                                                    特技: {item.skillName || '法宝特技'}
                                                </div>
                                            </div>

                                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 border border-slate-700/60">
                                                    {item.类型 || '法宝'}
                                                </span>
                                                {variantsCount > 1 && (
                                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                                                        承/真 ({variantsCount})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* 右栏：保真游戏原生展示面板 (lg: 5列, sticky) */}
                <div className="lg:col-span-5 sticky top-20 flex flex-col gap-3">
                    {selectedFabao ? (
                        <FabaoDetailCard fabao={selectedFabao} />
                    ) : (
                        <div className="zx-card p-12 text-center text-slate-500">
                            请从左侧列表选择一件法宝查看详细技能与数值
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

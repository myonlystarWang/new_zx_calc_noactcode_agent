import React, { useState, useMemo, useEffect } from 'react';
import clsx from 'clsx';
import type { CuratedEquipItem } from '../../types';
import {
    GAME_COLORS,
    getYunlingColor,
    getEquipQualityColor
} from '../../constants/gameColorSystem';
import { getEquipSeries } from '../../utils/equipSeries';
import { DataService } from '../../services/DataService';

export interface EquipDetailCardProps {
    item: CuratedEquipItem;
    initialRefLevel?: number;
    className?: string;
    allEquips?: CuratedEquipItem[];
}

const YUNLING_SLOTS = ['武器', '头盔', '帽子', '衣服', '靴子', '鞋', '袖甲', '护腕'];

function formatAttrText(text: string): string {
    if (!text) return '';
    let res = text;
    // 将 "生命上限" 映射为 "气血"，"真气上限" 映射为 "真气"
    res = res.replace(/生命上限/g, '气血');
    res = res.replace(/真气上限/g, '真气');

    // 1. 【致命减免】在UI上映射为【被致命一击的概率减少】
    res = res.replace(/致命减免/g, '被致命一击的概率减少');

    // 2. 【伤害减免】百分比词条映射为【减免伤害】（避免误替换 "无视伤害减免" 或 "减免伤害固定值"）
    res = res.replace(/(?<!无视(?:人物)?)伤害减免(?!\s*固定值)/g, '减免伤害');

    // 3. 【对怪增伤】百分比词条映射为【对怪物伤害增加】
    res = res.replace(/对怪增伤/g, '对怪物伤害增加');
    res = res.replace(/对怪物造成伤害/g, '对怪物伤害增加');

    // 4. 风云印类【魂元】词条映射为【魂元道引】
    res = res.replace(/魂元(?!道引)/g, '魂元道引');

    // 5. 【技能躲闪 +25.00%】修改为【增加技能躲闪 25.00】
    res = res.replace(/(?:增加)?技能躲闪\s*[+＋]\s*([\d\.]+)(?:%)?/g, '增加技能躲闪 $1');

    // 6. 【技能命中 +15.00%】修改为【增加技能命中 15.00】
    res = res.replace(/(?:增加)?技能命中\s*[+＋]\s*([\d\.]+)(?:%)?/g, '增加技能命中 $1');

    // 7. 神机洗炼属性池等数值区间中的 ~ 替换为 " - "
    res = res.replace(/~/g, ' - ');

    // 如果 + 或 - 前面紧挨着非空白字符，补充一个空格，对齐游戏原生规范（如 "攻击 +36.00%"）
    return res.replace(/([^\s])([+\-＋－])/g, '$1 $2');
}

function getRefKey(it: CuratedEquipItem): 'atk' | 'def' | 'hp' | 'mp' | null {
    const slot = it.slot || '';
    if (slot === '武器' || it.atk) return 'atk';
    if (slot === '衣服') return 'def';
    if (slot === '袖甲' || slot === '护腕') return 'mp';
    if (['靴子', '鞋', '头盔', '帽子', '腰带'].includes(slot)) return 'hp';
    if (it.hp) return 'hp';
    if (it.def) return 'def';
    if (it.mp) return 'mp';
    return null;
}

function parseAttrAndRate(raw: string) {
    const match = raw.match(/^(.*?)\s*[(（]([\d\.]+%?)[)）]\s*$/);
    if (match) {
        return {
            attrText: formatAttrText(match[1]),
            rateText: match[2].endsWith('%') ? match[2] : `${match[2]}%`
        };
    }
    return {
        attrText: formatAttrText(raw),
        rateText: null
    };
}

function parseAdAttr(str: string): { key: string; val: number; unit: string } | null {
    if (!str) return null;
    const m = str.match(/^(.*?)\s*[+＋]\s*([\d\.]+)(%?)$/) || str.match(/^(.*?)\s+([\d\.]+)(%?)$/);
    if (m) {
        const key = m[1].replace(/^[·\s]+/, '').trim();
        const val = parseFloat(m[2]);
        const unit = m[3] || '';
        if (!isNaN(val)) {
            return { key, val, unit };
        }
    }
    return null;
}

export const EquipDetailCard: React.FC<EquipDetailCardProps> = ({
    item,
    initialRefLevel,
    className,
    allEquips
}) => {
    // 当前呈现的装备对象（支持在同系升降阶时切换）
    const [currentItem, setCurrentItem] = useState<CuratedEquipItem>(item);
    const [equipList, setEquipList] = useState<CuratedEquipItem[]>(allEquips || []);

    // 默认高亮 +11（主流分水岭档位），或用户指令中指定的阶位
    const [refLevel, setRefLevel] = useState<number>(initialRefLevel ?? 11);

    // 是否展开未激活的「神机洗炼属性池」
    const [showLockedPool, setShowLockedPool] = useState<boolean>(false);

    // 当父级传入的 item 改变时同步更新
    useEffect(() => {
        setCurrentItem(item);
    }, [item]);

    // 装备全集数据同步与异步兜底加载
    useEffect(() => {
        if (allEquips && allEquips.length > 0) {
            setEquipList(allEquips);
            return;
        }
        DataService.getInstance().getEquipList()
            .then(list => {
                if (Array.isArray(list)) setEquipList(list);
            })
            .catch(err => {
                console.warn('Load equip list for series failed:', err);
            });
    }, [allEquips]);

    // 提取当前装备的进化系列信息（金身、法身、战罡、锦囊、印、项链、戒指等）
    const seriesInfo = useMemo(() => {
        return getEquipSeries(currentItem, equipList);
    }, [currentItem, equipList]);

    // 下一阶装备对象（用于计算同系装备升级增量）
    const nextItem = useMemo(() => {
        if (!seriesInfo || seriesInfo.currentIndex >= seriesInfo.items.length - 1) return null;
        return seriesInfo.items[seriesInfo.currentIndex + 1] || null;
    }, [seriesInfo]);

    // 判断当前装备是否属于蕴灵炼器范畴（防具/武器且具备 ref 梯度）
    const hasYunling = useMemo(() => {
        return Boolean(currentItem.ref && currentItem.ref.length > 0 && YUNLING_SLOTS.includes(currentItem.slot || ''));
    }, [currentItem.ref, currentItem.slot]);

    // 格式化装备全名，防止（男）（男）重复
    const cleanName = useMemo(() => {
        let name = currentItem.name || '';
        const hasGenderInName = /[（(][男女][）)]/.test(name);
        if (!hasGenderInName && currentItem.g) {
            name += `（${currentItem.g}）`;
        }
        return name;
    }, [currentItem.name, currentItem.g]);

    const qualityColor = useMemo(() => getEquipQualityColor(currentItem.q, currentItem.name), [currentItem.q, currentItem.name]);
    const yunlingColor = useMemo(() => getYunlingColor(refLevel), [refLevel]);
    const titleColor = hasYunling ? yunlingColor : qualityColor;
    const targetRefKey = useMemo(() => getRefKey(currentItem), [currentItem]);

    // 计算当前 +N 阶炼器数值加成
    const currentRefBonus = useMemo(() => {
        if (!hasYunling || !currentItem.ref || refLevel === 0) return 0;
        const idx = Math.min(refLevel - 1, currentItem.ref.length - 1);
        return currentItem.ref[idx] || 0;
    }, [hasYunling, currentItem.ref, refLevel]);

    // 下一阶炼器加成与净增量
    const nextRefGain = useMemo(() => {
        if (!hasYunling || !currentItem.ref || refLevel >= 15) return null;
        const nextBonus = currentItem.ref[refLevel] || 0;
        return nextBonus - currentRefBonus;
    }, [hasYunling, currentItem.ref, refLevel, currentRefBonus]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0 max-w-xl',
            className
        )}>
            {/* 1:1 游戏实机与寻宝天行原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 装备头部区域：两层式布局，彻底解决分屏长装备名截断与按钮挤压问题 */}
                <div className="pb-2 mb-2 border-b border-[#1f293d]/80 flex flex-col gap-1.5 min-w-0">
                    {/* 第 1 行：完整装备名称（全宽展示，无省略号截断，允许整词自然换行） */}
                    <div
                        className="font-bold text-[13px] sm:text-[14px] leading-snug break-words"
                        style={{ color: titleColor }}
                    >
                        {hasYunling ? `${cleanName}（蕴灵 +${refLevel}）` : cleanName}
                    </div>

                    {/* 第 2 行：品质/部位微标 与 强化/升降阶步进控制台（左右分栏，永不挤占名称空间） */}
                    <div className="flex items-center justify-between gap-2 min-w-0 flex-wrap">
                        {/* 左侧：品质与部位胶囊 */}
                        <div className="flex items-center gap-1.5 text-[11px] font-sans">
                            {currentItem.q && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-amber-300/90 border border-amber-500/20 whitespace-nowrap">
                                    {currentItem.q}品质
                                </span>
                            )}
                            {currentItem.slot && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                                    {currentItem.slot}
                                </span>
                            )}
                        </div>

                        {/* 右侧：步进推演控制（右侧并排，强制不换行） */}
                        {/* 1. 蕴灵装备：强化 -1 / 强化 +1 */}
                        {hasYunling && (
                            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                                <button
                                    type="button"
                                    onClick={() => setRefLevel(prev => Math.max(0, prev - 1))}
                                    disabled={refLevel <= 0}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                        refLevel <= 0
                                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                    )}
                                >
                                    强化 -1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRefLevel(prev => Math.min(15, prev + 1))}
                                    disabled={refLevel >= 15}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                        refLevel >= 15
                                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                            : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                    )}
                                >
                                    强化 +1
                                </button>
                            </div>
                        )}

                        {/* 2. 同系装备（金身、法身、大乘战罡、锦囊、印、项链、戒指等）：等级 -1 / 等级 +1 */}
                        {!hasYunling && seriesInfo && seriesInfo.items.length > 1 && (
                            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap ml-auto">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (seriesInfo.currentIndex > 0) {
                                            setCurrentItem(seriesInfo.items[seriesInfo.currentIndex - 1]);
                                        }
                                    }}
                                    disabled={seriesInfo.currentIndex <= 0}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                        seriesInfo.currentIndex <= 0
                                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                            : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:text-white'
                                    )}
                                >
                                    等级 -1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (seriesInfo.currentIndex < seriesInfo.items.length - 1) {
                                            setCurrentItem(seriesInfo.items[seriesInfo.currentIndex + 1]);
                                        }
                                    }}
                                    disabled={seriesInfo.currentIndex >= seriesInfo.items.length - 1}
                                    className={clsx(
                                        'px-2 py-0.5 rounded text-[11px] sm:text-xs font-bold transition-all border font-sans whitespace-nowrap cursor-pointer',
                                        seriesInfo.currentIndex >= seriesInfo.items.length - 1
                                            ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                            : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                    )}
                                >
                                    等级 +1
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 攻击距离（武器专属，纯白字） */}
                {currentItem.rng !== undefined && (
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        攻击距离 {currentItem.rng.toFixed(2)}
                    </div>
                )}

                {/* 基础攻击（经典游戏蓝 #8080ff，炼器加成直接合并不分行、不带右侧括号） */}
                {currentItem.atk && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>
                            基础攻击 {currentItem.atk[0] + (hasYunling && targetRefKey === 'atk' ? currentRefBonus : 0)} － {currentItem.atk[1] + (hasYunling && targetRefKey === 'atk' ? currentRefBonus : 0)}
                        </span>
                        {hasYunling && targetRefKey === 'atk' && nextRefGain !== null && nextRefGain > 0 && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (强化 +{nextRefGain})
                            </span>
                        )}
                        {!hasYunling && nextItem && nextItem.atk && nextItem.atk[1] > currentItem.atk[1] && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.atk[1] - currentItem.atk[1]})
                            </span>
                        )}
                    </div>
                )}

                {/* 命中与躲闪（常见于法身、金身、印） */}
                {currentItem.hit !== undefined && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>命中 ＋{currentItem.hit}</span>
                        {!hasYunling && nextItem && nextItem.hit !== undefined && nextItem.hit > currentItem.hit && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.hit - currentItem.hit})
                            </span>
                        )}
                    </div>
                )}
                {currentItem.dod !== undefined && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>躲闪 ＋{currentItem.dod}</span>
                        {!hasYunling && nextItem && nextItem.dod !== undefined && nextItem.dod > currentItem.dod && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.dod - currentItem.dod})
                            </span>
                        )}
                    </div>
                )}

                {/* 防御力（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {currentItem.def !== undefined && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>
                            基础防御 ＋{currentItem.def + (hasYunling && targetRefKey === 'def' ? currentRefBonus : 0)}
                        </span>
                        {hasYunling && targetRefKey === 'def' && nextRefGain !== null && nextRefGain > 0 && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (强化 +{nextRefGain})
                            </span>
                        )}
                        {!hasYunling && nextItem && nextItem.def !== undefined && nextItem.def > currentItem.def && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.def - currentItem.def})
                            </span>
                        )}
                    </div>
                )}

                {/* 基础气血（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {currentItem.hp !== undefined && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>
                            基础气血 ＋{currentItem.hp + (hasYunling && targetRefKey === 'hp' ? currentRefBonus : 0)}
                        </span>
                        {hasYunling && targetRefKey === 'hp' && nextRefGain !== null && nextRefGain > 0 && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (强化 +{nextRefGain})
                            </span>
                        )}
                        {!hasYunling && nextItem && nextItem.hp !== undefined && nextItem.hp > currentItem.hp && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.hp - currentItem.hp})
                            </span>
                        )}
                    </div>
                )}

                {/* 基础真气（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {currentItem.mp !== undefined && (
                    <div className="flex items-center justify-between" style={{ color: GAME_COLORS.STAT_BLUE }}>
                        <span>
                            基础真气 ＋{currentItem.mp + (hasYunling && targetRefKey === 'mp' ? currentRefBonus : 0)}
                        </span>
                        {hasYunling && targetRefKey === 'mp' && nextRefGain !== null && nextRefGain > 0 && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (强化 +{nextRefGain})
                            </span>
                        )}
                        {!hasYunling && nextItem && nextItem.mp !== undefined && nextItem.mp > currentItem.mp && (
                            <span className="text-emerald-400 font-sans text-[11px] font-medium">
                                (升级 +{nextItem.mp - currentItem.mp})
                            </span>
                        )}
                    </div>
                )}

                {/* 附加属性列表：未激活前缀为灰色的 (+X)，激活后展示为经典游戏蓝 */}
                {currentItem.ad && currentItem.ad.length > 0 && (
                    <div>
                        {currentItem.ad.map((attr, aIdx) => {
                            const isUnlocked = !hasYunling || refLevel >= attr.l;
                            const formattedText = formatAttrText(attr.d || attr.n);
                            const displayText = !isUnlocked && attr.l > 0
                                ? `(+${attr.l})${formattedText}`
                                : formattedText;

                            // 同系阶位升级差值推演
                            let upgradeDiffText: string | null = null;
                            if (!hasYunling && nextItem && nextItem.ad) {
                                const parsedCurr = parseAdAttr(attr.d || attr.n);
                                if (parsedCurr) {
                                    const matchedNext = nextItem.ad.find(na => {
                                        const pNext = parseAdAttr(na.d || na.n);
                                        return pNext && pNext.key === parsedCurr.key;
                                    });
                                    if (matchedNext) {
                                        const pNext = parseAdAttr(matchedNext.d || matchedNext.n);
                                        if (pNext && pNext.val > parsedCurr.val) {
                                            const diff = +(pNext.val - parsedCurr.val).toFixed(2);
                                            upgradeDiffText = `(升级 +${diff}${parsedCurr.unit})`;
                                        }
                                    }
                                }
                            }

                            return (
                                <div
                                    key={aIdx}
                                    style={{
                                        color: isUnlocked ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>{displayText}</span>
                                    {upgradeDiffText && (
                                        <span className="text-emerald-400 font-sans text-[11px] font-medium ml-1.5 whitespace-nowrap">
                                            {upgradeDiffText}
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 神机属性洗炼池：仅当装备支持蕴灵且具备神机属性时展示 */}
                {hasYunling && currentItem.sj && Object.entries(currentItem.sj).length > 0 && (
                    <div className="mt-2 pt-1 border-t border-[#1c2436]/60 flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[12px] font-bold text-amber-300">
                            <span>神机洗炼属性池:</span>
                            <button
                                type="button"
                                onClick={() => setShowLockedPool(prev => !prev)}
                                className="text-[11px] text-cyan-400 hover:underline cursor-pointer font-sans font-normal"
                            >
                                {showLockedPool ? '仅显示已激活档位' : '展开未激活档位池'}
                            </button>
                        </div>
                        {Object.entries(currentItem.sj).map(([groupKey, bonusList]) => {
                            if (!bonusList || bonusList.length === 0) return null;
                            return (
                                <div key={groupKey} className="space-y-1">
                                    {[11, 13, 15].map(tier => {
                                        const tierItems = bonusList.filter(b => b.l === tier);
                                        if (tierItems.length === 0) return null;
                                        const isUnlocked = refLevel >= tier;
                                        const shouldShowList = isUnlocked || showLockedPool;

                                        return (
                                            <div
                                                key={tier}
                                                className="text-[12px] pl-1"
                                            >
                                                <div
                                                    className="font-semibold flex items-center justify-between text-[11px] mb-0.5 opacity-90"
                                                    style={{
                                                        color: isUnlocked ? '#ffd272' : GAME_COLORS.TEXT_LOCKED
                                                    }}
                                                >
                                                    <span>+{tier}档位</span>
                                                    <span>{isUnlocked ? '已激活' : '需蕴灵 +' + tier}</span>
                                                </div>
                                                {shouldShowList && tierItems.map((bi, bIdx) => {
                                                    const parsed = parseAttrAndRate(bi.d);
                                                    return (
                                                        <div
                                                            key={bIdx}
                                                            className="pl-2 flex items-center justify-between text-[13px] leading-[22px]"
                                                            style={{
                                                                color: isUnlocked ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED
                                                            }}
                                                        >
                                                            <span>· {parsed.attrText}</span>
                                                            {parsed.rateText && (
                                                                <span className="text-[11px] font-sans" style={{ color: isUnlocked ? '#8892b0' : GAME_COLORS.TEXT_LOCKED }}>
                                                                    概率 {parsed.rateText}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 底部属性与穿戴要求（寻宝天行与游戏客户端 1:1 标准） */}
                <div className="mt-2.5 pt-2 border-t border-[#1c2436]/60 text-[12px] leading-5 space-y-0.5">
                    <div style={{ color: GAME_COLORS.OWNER_ORANGE }}>
                        已绑定；已锁定；不会掉落；不可卖店
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        穿戴要求：
                        {currentItem.prof && currentItem.prof.length > 0 && currentItem.prof[0] !== '通用' && (
                            <span style={{ color: GAME_COLORS.PURE_RED }}>
                                {currentItem.prof.join('、')}，
                            </span>
                        )}
                        {currentItem.xz && (
                            <span style={{ color: GAME_COLORS.PURE_RED }}>
                                {currentItem.xz}，
                            </span>
                        )}
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            {currentItem.lv ? `${currentItem.lv}级` : '105级'}
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        无法交易
                    </div>
                    {currentItem.price !== undefined && (
                        <div style={{ color: GAME_COLORS.WHITE }}>
                            价格 {Math.floor(currentItem.price / 100) || 1} 银
                        </div>
                    )}
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        {currentItem.slot}
                    </div>
                </div>
            </div>
        </div>
    );
};

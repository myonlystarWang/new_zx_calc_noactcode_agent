import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import type { CuratedEquipItem } from '../../types';
import {
    GAME_COLORS,
    getYunlingColor,
    getEquipQualityColor
} from '../../constants/gameColorSystem';

export interface EquipDetailCardProps {
    item: CuratedEquipItem;
    className?: string;
}

const YUNLING_SLOTS = ['武器', '头盔', '帽子', '衣服', '靴子', '鞋', '袖甲', '护腕'];

function formatAttrText(text: string): string {
    if (!text) return '';
    let res = text;
    // 将 "生命上限" 映射为 "气血"，"真气上限" 映射为 "真气"
    res = res.replace(/生命上限/g, '气血');
    res = res.replace(/真气上限/g, '真气');
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

export const EquipDetailCard: React.FC<EquipDetailCardProps> = ({
    item,
    className
}) => {
    // 默认高亮 +11（主流分水岭档位）
    const [refLevel, setRefLevel] = useState<number>(11);

    // 判断当前装备是否属于蕴灵炼器范畴（防具/武器且具备 ref 梯度）
    const hasYunling = useMemo(() => {
        return Boolean(item.ref && item.ref.length > 0 && YUNLING_SLOTS.includes(item.slot || ''));
    }, [item.ref, item.slot]);

    // 格式化装备全名，防止（男）（男）重复
    const cleanName = useMemo(() => {
        let name = item.name || '';
        const hasGenderInName = /[（(][男女][）)]/.test(name);
        if (!hasGenderInName && item.g) {
            name += `（${item.g}）`;
        }
        return name;
    }, [item.name, item.g]);

    const qualityColor = useMemo(() => getEquipQualityColor(item.q, item.name), [item.q, item.name]);
    const yunlingColor = useMemo(() => getYunlingColor(refLevel), [refLevel]);
    const titleColor = hasYunling ? yunlingColor : qualityColor;
    const targetRefKey = useMemo(() => getRefKey(item), [item]);

    // 计算当前 +N 阶炼器数值加成
    const currentRefBonus = useMemo(() => {
        if (!hasYunling || !item.ref || refLevel === 0) return 0;
        const idx = Math.min(refLevel - 1, item.ref.length - 1);
        return item.ref[idx] || 0;
    }, [hasYunling, item.ref, refLevel]);

    return (
        <div className={clsx(
            'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left',
            className
        )}>
            {/* 1:1 游戏实机与寻宝天行原生 Tooltip 视效容器 */}
            <div
                className="rounded-xl p-4 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.35)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 首行装备名称与强化步进按钮：移除单独顶栏与胶囊，强化按钮直接放置于右上角 */}
                <div
                    className="font-bold text-[14px] pb-1.5 mb-2 border-b border-[#1f293d]/80 flex items-center justify-between"
                    style={{ color: titleColor }}
                >
                    <span>
                        {hasYunling ? `${cleanName}（蕴灵 +${refLevel}）` : cleanName}
                    </span>

                    {hasYunling && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setRefLevel(prev => Math.max(0, prev - 1))}
                                disabled={refLevel <= 0}
                                className={clsx(
                                    'px-2 py-0.5 rounded text-xs font-bold transition-all border font-sans',
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
                                    'px-2 py-0.5 rounded text-xs font-bold transition-all border font-sans',
                                    refLevel >= 15
                                        ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                                        : 'bg-cyan-600/30 border-cyan-500/50 text-cyan-200 hover:bg-cyan-600/50 hover:text-white'
                                )}
                            >
                                强化 +1
                            </button>
                        </div>
                    )}
                </div>

                {/* 攻击距离（武器专属，纯白字） */}
                {item.rng !== undefined && (
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        攻击距离 {item.rng.toFixed(2)}
                    </div>
                )}

                {/* 基础攻击（经典游戏蓝 #8080ff，炼器加成直接合并不分行、不带右侧括号） */}
                {item.atk && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础攻击 {item.atk[0] + (hasYunling && targetRefKey === 'atk' ? currentRefBonus : 0)} － {item.atk[1] + (hasYunling && targetRefKey === 'atk' ? currentRefBonus : 0)}
                    </div>
                )}

                {/* 命中与躲闪（常见于法身、金身） */}
                {item.hit !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        命中 ＋{item.hit}
                    </div>
                )}
                {item.dod !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        躲闪 ＋{item.dod}
                    </div>
                )}

                {/* 防御力（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {item.def !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础防御 ＋{item.def + (hasYunling && targetRefKey === 'def' ? currentRefBonus : 0)}
                    </div>
                )}

                {/* 基础气血（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {item.hp !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础气血 ＋{item.hp + (hasYunling && targetRefKey === 'hp' ? currentRefBonus : 0)}
                    </div>
                )}

                {/* 基础真气（经典游戏蓝 #8080ff，炼器加成直接合并不分行） */}
                {item.mp !== undefined && (
                    <div style={{ color: GAME_COLORS.STAT_BLUE }}>
                        基础真气 ＋{item.mp + (hasYunling && targetRefKey === 'mp' ? currentRefBonus : 0)}
                    </div>
                )}

                {/* 附加属性列表：未激活前缀为灰色的 (+X)，激活后展示为经典游戏蓝 */}
                {item.ad && item.ad.length > 0 && (
                    <div>
                        {item.ad.map((attr, aIdx) => {
                            const isUnlocked = !hasYunling || refLevel >= attr.l;
                            const formattedText = formatAttrText(attr.d || attr.n);
                            const displayText = !isUnlocked && attr.l > 0
                                ? `(+${attr.l})${formattedText}`
                                : formattedText;
                            return (
                                <div
                                    key={aIdx}
                                    style={{
                                        color: isUnlocked ? GAME_COLORS.STAT_BLUE : GAME_COLORS.TEXT_LOCKED,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <span>{displayText}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 神机属性洗炼池：仅当装备支持蕴灵且具备神机属性时展示 */}
                {hasYunling && item.sj && Object.entries(item.sj).length > 0 && (
                    <div className="mt-2 pt-1 border-t border-[#1c2436]/60 flex flex-col gap-1">
                        <div className="text-[12px] font-bold text-amber-300">
                            神机洗炼属性池:
                        </div>
                        {Object.entries(item.sj).map(([groupKey, bonusList]) => {
                            if (!bonusList || bonusList.length === 0) return null;
                            return (
                                <div key={groupKey} className="space-y-1">
                                    {[11, 13, 15].map(tier => {
                                        const tierItems = bonusList.filter(b => b.l === tier);
                                        if (tierItems.length === 0) return null;
                                        const isUnlocked = refLevel >= tier;

                                        return (
                                            <div
                                                key={tier}
                                                className="text-[12px] pl-1"
                                                style={{
                                                    color: isUnlocked ? '#ffd272' : GAME_COLORS.TEXT_LOCKED
                                                }}
                                            >
                                                <div className="font-semibold flex items-center justify-between text-[11px] mb-0.5 opacity-90">
                                                    <span>+{tier}档位</span>
                                                    <span>{isUnlocked ? '已激活' : '需蕴灵 +' + tier}</span>
                                                </div>
                                                {tierItems.map((bi, bIdx) => (
                                                    <div key={bIdx} className="pl-2">
                                                        · {formatAttrText(bi.d)}
                                                    </div>
                                                ))}
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
                        {item.prof && item.prof.length > 0 && item.prof[0] !== '通用' && (
                            <span style={{ color: GAME_COLORS.PURE_RED }}>
                                {item.prof.join('、')}，
                            </span>
                        )}
                        {item.xz && (
                            <span style={{ color: GAME_COLORS.PURE_RED }}>
                                {item.xz}，
                            </span>
                        )}
                        <span style={{ color: GAME_COLORS.PURE_RED }}>
                            {item.lv ? `${item.lv}级` : '105级'}
                        </span>
                    </div>
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        无法交易
                    </div>
                    {item.price !== undefined && (
                        <div style={{ color: GAME_COLORS.WHITE }}>
                            价格 {Math.floor(item.price / 100) || 1} 银
                        </div>
                    )}
                    <div style={{ color: GAME_COLORS.WHITE }}>
                        {item.slot}
                    </div>
                </div>
            </div>
        </div>
    );
};

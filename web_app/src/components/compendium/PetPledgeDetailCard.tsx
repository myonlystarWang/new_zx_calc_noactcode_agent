import React, { useState, useMemo } from 'react';
import clsx from 'clsx';
import { GAME_COLORS } from '../../constants/gameColorSystem';

export interface PetStatItem {
    name: string;
    floor: number;
    ceiling: number;
    unit: string;
    highlight?: string;
}

export interface PetPledgeCategory {
    id: string;
    shortName: string;
    name: string;
    example: string;
    tag: string;
    stats: PetStatItem[];
}

export interface PetPledgeDetailCardProps {
    cardData?: {
        initialPetId?: string;
        showCompareDefault?: boolean;
    };
    className?: string;
}

// 5 大类宠物结誓属性池数据（满星 20 星基准）
const PET_CATEGORIES: PetPledgeCategory[] = [
    {
        id: 'common',
        shortName: '普通宠物',
        name: '丛林山猪',
        example: '宠物商店购买',
        tag: '普通宠物',
        stats: [
            { name: '攻击百分比', floor: 9.0, ceiling: 20.0, unit: '%' },
            { name: '基础气血', floor: 11000, ceiling: 16000, unit: '' },
            { name: '基础防御', floor: 1890, ceiling: 2801, unit: '' },
            { name: '基础真气', floor: 11000, ceiling: 16000, unit: '' },
            { name: '防御百分比', floor: 9.3, ceiling: 19.0, unit: '%' },
            { name: '基础攻击', floor: 1700, ceiling: 3000, unit: '' },
            { name: '气血百分比', floor: 5.0, ceiling: 10.0, unit: '%' },
            { name: '真气百分比', floor: 5.0, ceiling: 10.0, unit: '%' }
        ]
    },
    {
        id: 'special_old',
        shortName: '昆仑修罗',
        name: '昆仑修罗',
        example: '打金宝宝',
        tag: '旧版特殊',
        stats: [
            { name: '攻击百分比', floor: 9.0, ceiling: 24.0, unit: '%', highlight: '上限24.0%' },
            { name: '基础气血', floor: 11000, ceiling: 19000, unit: '', highlight: '上限19000' },
            { name: '基础防御', floor: 1890, ceiling: 3360, unit: '' },
            { name: '基础真气', floor: 11000, ceiling: 19000, unit: '', highlight: '上限19000' },
            { name: '防御百分比', floor: 9.3, ceiling: 22.8, unit: '%' },
            { name: '基础攻击', floor: 1700, ceiling: 3600, unit: '', highlight: '上限3600' },
            { name: '气血百分比', floor: 5.0, ceiling: 12.0, unit: '%', highlight: '上限12.0%' },
            { name: '真气百分比', floor: 5.0, ceiling: 12.0, unit: '%', highlight: '上限12.0%' }
        ]
    },
    {
        id: 'feitianshu',
        shortName: '飞天鼠',
        name: '飞天鼠',
        example: '副本「捉住那只飞天鼠」产出',
        tag: '偏重气血',
        stats: [
            { name: '攻击百分比', floor: 9.0, ceiling: 20.0, unit: '%' },
            { name: '基础气血', floor: 14850, ceiling: 25650, unit: '', highlight: '气血特化 25650' },
            { name: '基础防御', floor: 1890, ceiling: 3360, unit: '' },
            { name: '基础真气', floor: 11000, ceiling: 19000, unit: '' },
            { name: '防御百分比', floor: 9.3, ceiling: 22.8, unit: '%' },
            { name: '基础攻击', floor: 2295, ceiling: 4860, unit: '', highlight: '高下限 2295' },
            { name: '气血百分比', floor: 6.8, ceiling: 16.2, unit: '%', highlight: '上限16.2%' },
            { name: '真气百分比', floor: 5.0, ceiling: 12.0, unit: '%' }
        ]
    },
    {
        id: 'bobo',
        shortName: '波波',
        name: '波波',
        example: '流波钓鱼「暗海神秘之箱」产出',
        tag: '偏重真气',
        stats: [
            { name: '攻击百分比', floor: 9.0, ceiling: 20.0, unit: '%' },
            { name: '基础气血', floor: 11000, ceiling: 19000, unit: '' },
            { name: '基础防御', floor: 1890, ceiling: 3360, unit: '' },
            { name: '基础真气', floor: 14850, ceiling: 25650, unit: '', highlight: '真气特化 25650' },
            { name: '防御百分比', floor: 9.3, ceiling: 22.8, unit: '%' },
            { name: '基础攻击', floor: 2295, ceiling: 4860, unit: '', highlight: '高下限 2295' },
            { name: '气血百分比', floor: 5.0, ceiling: 12.0, unit: '%' },
            { name: '真气百分比', floor: 6.8, ceiling: 16.2, unit: '%', highlight: '上限16.2%' }
        ]
    },
    {
        id: 'pengpeng',
        shortName: '鹏鹏',
        name: '鹏鹏',
        example: '鸿蒙古地「金鹏圣物」捕获',
        tag: '全能天花板',
        stats: [
            { name: '攻击百分比', floor: 9.0, ceiling: 20.0, unit: '%' },
            { name: '基础气血', floor: 15000, ceiling: 30000, unit: '', highlight: '全服最高 30000' },
            { name: '基础防御', floor: 2000, ceiling: 4000, unit: '', highlight: '全服最高 4000' },
            { name: '基础真气', floor: 15000, ceiling: 30000, unit: '', highlight: '全服最高 30000' },
            { name: '防御百分比', floor: 10.0, ceiling: 25.0, unit: '%', highlight: '全服最高 25.0%' },
            { name: '基础攻击', floor: 2300, ceiling: 5700, unit: '', highlight: '全服最高 5700' },
            { name: '气血百分比', floor: 8.5, ceiling: 20.0, unit: '%', highlight: '全服最高 20.0%' },
            { name: '真气百分比', floor: 8.5, ceiling: 20.0, unit: '%', highlight: '全服最高 20.0%' }
        ]
    }
];

// 对比表行项目定义
const COMPARISON_ROWS = [
    { label: '攻击', unit: '', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '基础攻击') },
    { label: '气血', unit: '', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '基础气血') },
    { label: '真气', unit: '', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '基础真气') },
    { label: '攻击百分比', unit: '%', maxPetId: 'special_old', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '攻击百分比') },
    { label: '气血百分比', unit: '%', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '气血百分比') },
    { label: '真气百分比', unit: '%', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '真气百分比') },
    { label: '基础防御', unit: '', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '基础防御') },
    { label: '防御百分比', unit: '%', maxPetId: 'pengpeng', getRange: (p: PetPledgeCategory) => p.stats.find(s => s.name === '防御百分比') }
];

export const PetPledgeDetailCard: React.FC<PetPledgeDetailCardProps> = ({
    cardData,
    className
}) => {
    // 当前选中的宠物分类（默认丛林山猪或通过参数指定）
    const [selectedId, setSelectedId] = useState<string>(() => {
        if (cardData?.initialPetId) {
            const match = PET_CATEGORIES.find(
                p => p.id === cardData.initialPetId || p.name.includes(cardData.initialPetId!) || p.shortName === cardData.initialPetId
            );
            if (match) return match.id;
        }
        return 'common';
    });

    // 是否展开对比表（与佩章未激活隐藏属性池折叠机制完全一致）
    const [showCompare, setShowCompare] = useState<boolean>(cardData?.showCompareDefault ?? false);

    const currentPet = useMemo(() => {
        return PET_CATEGORIES.find(p => p.id === selectedId) || PET_CATEGORIES[0];
    }, [selectedId]);

    return (
        <div
            className={clsx(
                'bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-2xl backdrop-blur-md flex flex-col gap-3 text-left w-full min-w-0',
                className
            )}
        >
            {/* 五大类宠物结誓分类切换 Capsule Tabs（与项链/佩章 100% 统一规范） */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px] font-sans">
                {PET_CATEGORIES.map(p => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={clsx(
                            'px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors border whitespace-nowrap',
                            p.id === selectedId
                                ? 'bg-cyan-500/25 text-cyan-200 border-cyan-500/50 shadow-sm'
                                : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                        )}
                    >
                        {p.shortName}
                    </button>
                ))}
            </div>

            {/* 1:1 游戏实机 Tooltip 视效容器（装备/佩章统一风格） */}
            <div
                className="rounded-xl p-3 sm:p-3.5 text-[13px] leading-[22px] border border-[#232c3d] bg-[#070b12]/95 shadow-2xl min-w-0 select-text"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                }}
            >
                {/* 宠物名称区域：纯白名称 + （定位描述） + 分割横线 + 最右侧展开/收起对比按钮 */}
                <div className="pb-1.5 mb-1.5 border-b border-[#1f293d]/80 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center min-w-0">
                        {/* <span style={{ color: GAME_COLORS.BRIGHT_GREEN }}>宠物种类：</span> */}
                        <span style={{ color: GAME_COLORS.WHITE, fontWeight: 'bold', fontSize: '14px' }}>
                            {currentPet.name}
                        </span>
                        <span className="text-xs text-slate-400 ml-1 font-sans">
                            （{currentPet.tag}）
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowCompare(!showCompare)}
                        className="px-2 py-0.5 rounded text-[11px] bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors shrink-0 font-sans cursor-pointer"
                    >
                        {showCompare ? '收起5类上限对比' : '展开5类上限对比'}
                    </button>
                </div>

                {/* 装备状态（橙红色 不会掉落，1:1 游戏实机） */}
                <div style={{ color: GAME_COLORS.OWNER_ORANGE }} className="font-medium text-[13px] mb-1">
                    不会掉落
                </div>
                {/* 基础修炼星等 */}
                {/* <div className="flex items-center mt-0.5">
                    <span style={{ color: GAME_COLORS.BRIGHT_GREEN }}>基础修炼星等：</span>
                    <span style={{ color: GAME_COLORS.WHITE, fontWeight: 'bold' }}>20</span>
                </div> */}

                {/* 结誓属性标题 */}
                <div
                    // className="mt-1 font-bold">
                    className="flex items-center justify-between text-[12px] font-bold text-amber-300">
                    {/* style={{ color: GAME_COLORS.BRIGHT_GREEN }} */}

                    结誓属性：
                </div>

                {/* 结誓属性列表（采用游戏原版绿色，范围紧跟属性名） */}
                <div className="mt-0.5 space-y-0.5 font-mono">
                    {currentPet.stats.map((attr, idx) => (
                        <div
                            key={attr.name}
                            className="flex items-center text-[13px] py-0.5"
                        >
                            <span style={{ color: GAME_COLORS.BRIGHT_GREEN }}>属性{idx + 1}:&nbsp;</span>
                            <span style={{ color: GAME_COLORS.BRIGHT_GREEN }}>{attr.name}</span>
                            <span style={{ color: GAME_COLORS.BRIGHT_GREEN }} className="ml-1.5">
                                (&nbsp;{attr.floor}{attr.unit} - {attr.ceiling}{attr.unit}&nbsp;)
                            </span>
                        </div>
                    ))}
                </div>

                {/* 展开后的 5 类宠物上限全景对比表（支持横向自适应滚动，杜绝换行挤压） */}
                {showCompare && (
                    <div className="mt-2.5 pt-2 border-t border-[#1c2436] overflow-x-auto rounded">
                        <table className="min-w-[480px] w-full text-xs text-left border-collapse font-mono whitespace-nowrap">
                            <thead>
                                <tr className="bg-[#121929] text-slate-300 border-b border-[#1e293b]">
                                    <th className="py-1 px-2 font-sans whitespace-nowrap">结誓属性</th>
                                    <th className="py-1 px-1.5 border-l border-[#1e293b] text-center font-sans whitespace-nowrap">普通</th>
                                    <th className="py-1 px-1.5 border-l border-[#1e293b] text-center font-sans whitespace-nowrap">昆仑修罗</th>
                                    <th className="py-1 px-1.5 border-l border-[#1e293b] text-center font-sans text-emerald-300 whitespace-nowrap">飞天鼠</th>
                                    <th className="py-1 px-1.5 border-l border-[#1e293b] text-center font-sans text-cyan-300 whitespace-nowrap">波波</th>
                                    <th className="py-1 px-1.5 border-l border-[#1e293b] text-center font-sans text-amber-300 whitespace-nowrap">鹏鹏</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1c2436] text-[11px]">
                                {COMPARISON_ROWS.map((row, idx) => (
                                    <tr
                                        key={row.label}
                                        className={clsx(
                                            idx % 2 === 0 ? 'bg-[#0b101b]' : 'bg-[#0e1422]',
                                            'hover:bg-[#162035] transition-colors'
                                        )}
                                    >
                                        <td className="py-1 px-2 font-medium text-slate-200 font-sans whitespace-nowrap">
                                            {row.label}
                                        </td>
                                        {PET_CATEGORIES.map(p => {
                                            const stat = row.getRange(p);
                                            const isMax = p.id === row.maxPetId;
                                            return (
                                                <td
                                                    key={p.id}
                                                    className={clsx(
                                                        'py-1 px-1.5 border-l border-[#1e293b] text-center whitespace-nowrap',
                                                        isMax ? 'text-amber-300 font-bold bg-amber-950/20' : 'text-slate-300'
                                                    )}
                                                >
                                                    {stat ? (
                                                        <span>
                                                            {stat.floor}{stat.unit} - {stat.ceiling}{stat.unit}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-600">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PetPledgeDetailCard;

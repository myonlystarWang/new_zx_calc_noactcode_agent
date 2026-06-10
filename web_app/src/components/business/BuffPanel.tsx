import React from 'react';
import { Card } from '../ui/Card';
import { TotalPowerCard } from './ResultsSection';
import { BuffSelector } from './BuffSelector';

export const BuffPanel: React.FC = () => {
    return (
        <div className="flex flex-col gap-6">
            {/* Buff Selector - Moved back to top of middle column */}
            <BuffSelector />

            {/* Total Power Score */}
            <TotalPowerCard />

            {/* Dungeon Data Explanation */}
            <Card title="使用说明">
                <div className="text-sm text-slate-400 space-y-3">
                    <div>
                        <strong className="text-[var(--theme-accent)]">副本战力计算：</strong>
                        <p className="mt-1 ml-4 text-xs text-slate-400">基于当前角色属性、技能配置和增益状态，计算对各副本怪物的平均输出能力。</p>
                    </div>
                    <div>
                        <strong className="text-[var(--theme-primary)]">战力评分：</strong>
                        <p className="mt-1 ml-4 text-xs text-slate-400">Σ(技能平均伤害 × 权重) → 副本平均 → 加权总分。</p>
                    </div>
                    <div>
                        <strong className="text-[var(--theme-accent)]">技能权重：</strong>
                        <p className="mt-1 ml-4 text-xs text-slate-400">每个技能有不同的重要性权重，反映该技能在实战中的使用频率和战略价值。高权重技能对总战力影响更大。</p>
                    </div>
                    <div>
                        <strong className="text-[var(--theme-primary)]">综合评分：</strong>
                        <p className="mt-1 ml-4 text-xs text-slate-400">综合战力是所有副本战力的加权平均值。</p>
                    </div>
                    <div className="pt-2 border-t border-slate-700/50">
                        <p className="text-xs text-slate-550">
                            💡 提示：点击副本卡片可展开查看每个怪物和技能的详细伤害数据。
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};

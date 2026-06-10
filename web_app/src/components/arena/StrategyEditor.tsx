import React, { useState } from 'react';
import { ArrowUp, ArrowDown, Plus, Trash2, ListOrdered } from 'lucide-react';
import type { Skill, DpsStrategyConfig, ManualTimelineAction } from '../../types';

const DEFAULT_START_TIME_MS = 5000;

interface StrategyEditorProps {
    dpsSkills: Skill[];
    strategy: DpsStrategyConfig;
    onStrategyChange: (newStrategy: DpsStrategyConfig) => void;
}

export const StrategyEditor: React.FC<StrategyEditorProps> = ({
    dpsSkills,
    strategy,
    onStrategyChange
}) => {
    const [selectedSkillToAdd, setSelectedSkillToAdd] = useState<string>(dpsSkills[0]?.SkillID || '');
    
    // Manual timeline row inputs
    const [newTimeMs, setNewTimeMs] = useState<number>(0);
    const [newSkillId, setNewSkillId] = useState<string>(dpsSkills[0]?.SkillID || '');
    const [newTarget, setNewTarget] = useState<string>('boss');
    const newOnUnavailable = 'SKIP';

    const handleTypeChange = (type: 'SKILL_BAR' | 'FIXED_ROTATION' | 'MANUAL_TIMELINE') => {
        const startTimeMs = strategy.type === 'MANUAL_TIMELINE'
            ? DEFAULT_START_TIME_MS
            : strategy.startTimeMs ?? DEFAULT_START_TIME_MS;

        if (type === 'MANUAL_TIMELINE') {
            onStrategyChange({
                type: 'MANUAL_TIMELINE',
                actions: []
            });
        } else if (type === 'FIXED_ROTATION') {
            onStrategyChange({
                type: 'FIXED_ROTATION',
                skillIds: dpsSkills.slice(0, 5).map(s => s.SkillID),
                startTimeMs,
                waitMs: 0
            });
        } else {
            onStrategyChange({
                type: 'SKILL_BAR',
                skillIds: dpsSkills.slice(0, 5).map(s => s.SkillID),
                startTimeMs,
                scanMode: 'FROM_FIRST_EACH_DECISION',
                waitMs: 0
            });
        }
    };

    // --- SKILL BAR / FIXED ROTATION handlers ---
    const handleMoveSkill = (index: number, direction: 'up' | 'down') => {
        if (strategy.type === 'MANUAL_TIMELINE') return;
        const newIds = [...strategy.skillIds];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newIds.length) return;

        // Swap
        const temp = newIds[index];
        newIds[index] = newIds[targetIndex];
        newIds[targetIndex] = temp;

        onStrategyChange({
            ...strategy,
            skillIds: newIds
        } as DpsStrategyConfig);
    };

    const handleRemoveSkill = (index: number) => {
        if (strategy.type === 'MANUAL_TIMELINE') return;
        const removedSkillId = strategy.skillIds[index];
        const newIds = strategy.skillIds.filter((_, i) => i !== index);
        const nextExpiry = { ...(strategy.skillExpiryMs || {}) };
        if (removedSkillId && !newIds.includes(removedSkillId)) {
            delete nextExpiry[removedSkillId];
        }
        onStrategyChange({
            ...strategy,
            skillIds: newIds,
            skillExpiryMs: Object.keys(nextExpiry).length > 0 ? nextExpiry : undefined
        } as DpsStrategyConfig);
    };

    const handleAddSkill = () => {
        if (strategy.type === 'MANUAL_TIMELINE') return;
        if (!selectedSkillToAdd) return;
        const newIds = [...strategy.skillIds, selectedSkillToAdd];
        onStrategyChange({
            ...strategy,
            skillIds: newIds
        } as DpsStrategyConfig);
    };

    const handleSkillExpiryChange = (skillId: string, valueSeconds: number) => {
        if (strategy.type === 'MANUAL_TIMELINE') return;
        const nextExpiry = { ...(strategy.skillExpiryMs || {}) };
        const expiryMs = Math.max(0, Math.round((valueSeconds || 0) * 1000));
        if (expiryMs > 0) {
            nextExpiry[skillId] = expiryMs;
        } else {
            delete nextExpiry[skillId];
        }
        onStrategyChange({
            ...strategy,
            skillExpiryMs: Object.keys(nextExpiry).length > 0 ? nextExpiry : undefined
        } as DpsStrategyConfig);
    };

    // --- MANUAL TIMELINE handlers ---
    const handleAddTimelineAction = () => {
        if (strategy.type !== 'MANUAL_TIMELINE') return;
        const newAction: ManualTimelineAction = {
            timeMs: newTimeMs,
            skillId: newSkillId,
            targetActorId: newTarget,
            onUnavailable: newOnUnavailable
        };
        const newActions = [...strategy.actions, newAction].sort((a, b) => a.timeMs - b.timeMs);
        onStrategyChange({
            ...strategy,
            actions: newActions
        });
    };

    const handleRemoveTimelineAction = (index: number) => {
        if (strategy.type !== 'MANUAL_TIMELINE') return;
        const newActions = strategy.actions.filter((_, i) => i !== index);
        onStrategyChange({
            ...strategy,
            actions: newActions
        });
    };

    const handleClearTimeline = () => {
        if (strategy.type !== 'MANUAL_TIMELINE') return;
        onStrategyChange({
            ...strategy,
            actions: []
        });
    };

    return (
        <div className="flex flex-col justify-between h-full">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                    <ListOrdered className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-bold text-slate-100 tracking-wide">输出技能释放策略</h3>
                </div>

                <div className="flex gap-1.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
                    <button
                        type="button"
                        onClick={() => handleTypeChange('SKILL_BAR')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            strategy.type === 'SKILL_BAR'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                        法宝技能栏
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeChange('FIXED_ROTATION')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            strategy.type === 'FIXED_ROTATION'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                        固定技能循环
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTypeChange('MANUAL_TIMELINE')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            strategy.type === 'MANUAL_TIMELINE'
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                : 'text-slate-400 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                        手动时间轴
                    </button>
                </div>
            </div>

            {/* Content for SKILL_BAR and FIXED_ROTATION */}
            {strategy.type !== 'MANUAL_TIMELINE' && (
                <div className="space-y-5">
                    {/* Scan Mode / Wait settings */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/30 p-4 border border-slate-800/60 rounded-xl">
                        {strategy.type === 'SKILL_BAR' && (
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">扫描检索机制</label>
                                <select
                                    value={strategy.scanMode || 'FROM_FIRST_EACH_DECISION'}
                                    onChange={(e) => onStrategyChange({
                                        ...strategy,
                                        scanMode: e.target.value as any
                                    })}
                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-cyan-500/50"
                                >
                                    <option value="FROM_FIRST_EACH_DECISION">从头起每次首位扫描 (常规法宝栏)</option>
                                    <option value="CONTINUE_POINTER">指针顺延轮询机制</option>
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">判定决策延迟 (waitMs)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={strategy.waitMs || 0}
                                    onChange={(e) => onStrategyChange({
                                        ...strategy,
                                        waitMs: parseInt(e.target.value) || 0
                                    })}
                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-cyan-500/50"
                                    min="0"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">MS</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">主输出开打延迟</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={(strategy.startTimeMs ?? 0) / 1000}
                                    onChange={(e) => onStrategyChange({
                                        ...strategy,
                                        startTimeMs: Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 1000))
                                    } as DpsStrategyConfig)}
                                    className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-cyan-500/50"
                                    min="0"
                                    step="0.1"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">S</span>
                            </div>
                        </div>
                    </div>

                    {/* Skill List Drag & Drop Simulation */}
                    <div>
                        <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">技能判定队列</span>
                        
                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                            {strategy.skillIds.map((skillId, index) => {
                                const skill = dpsSkills.find(s => s.SkillID === skillId);
                                return (
                                    <div
                                        key={`${skillId}-${index}`}
                                        className="flex flex-col gap-2 p-3 bg-slate-950/40 hover:bg-slate-950/80 border border-slate-850 rounded-xl transition-all group sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-5 h-5 rounded-full bg-slate-850 border border-slate-800 text-slate-500 flex items-center justify-center text-[10px] font-bold">
                                                {index + 1}
                                            </span>
                                            <div>
                                                <span className="text-xs font-bold text-slate-200">{skill?.SkillName || skillId}</span>
                                                {skill && (
                                                    <span className="text-[10px] text-slate-500 ml-2 font-medium">
                                                        CD: {skill.Cooldown}s / 释放: {skill.CastTime}s
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                            <label className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1">
                                                <span className="text-[10px] font-bold text-slate-500">过期</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.1"
                                                    value={(strategy.skillExpiryMs?.[skillId] || 0) / 1000}
                                                    onChange={(event) => handleSkillExpiryChange(skillId, parseFloat(event.target.value) || 0)}
                                                    className="w-16 bg-transparent text-right text-xs font-bold text-slate-200 outline-none"
                                                    title="该技能释放后的判定过期时间，未到时间时扫描会跳过；0 表示只按 CD 判断"
                                                />
                                                <span className="text-[10px] font-bold text-slate-600">S</span>
                                            </label>
                                            <button
                                                type="button"
                                                disabled={index === 0}
                                                onClick={() => handleMoveSkill(index, 'up')}
                                                className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-400 hover:text-slate-200 transition-colors"
                                                title="上移"
                                            >
                                                <ArrowUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                disabled={index === strategy.skillIds.length - 1}
                                                onClick={() => handleMoveSkill(index, 'down')}
                                                className="p-1 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent rounded text-slate-400 hover:text-slate-200 transition-colors"
                                                title="下移"
                                            >
                                                <ArrowDown className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSkill(index)}
                                                className="p-1 hover:bg-red-500/10 hover:text-red-400 rounded text-slate-400 transition-colors ml-1"
                                                title="移出"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {strategy.skillIds.length === 0 && (
                                <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                                    当前释放判定队列为空，请在下方添加技能
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Add skill section */}
                    <div className="flex items-center gap-2 pt-1.5 border-t border-slate-800/40">
                        <select
                            value={selectedSkillToAdd}
                            onChange={(e) => setSelectedSkillToAdd(e.target.value)}
                            className="flex-1 bg-slate-950/80 border border-slate-800 text-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                        >
                            {dpsSkills.map(s => (
                                <option key={s.SkillID} value={s.SkillID}>
                                    {s.SkillName} (CD: {s.Cooldown}s / 释: {s.CastTime}s)
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={handleAddSkill}
                            className="px-4 py-2 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-300 font-bold rounded-xl text-xs transition-all flex items-center gap-1 shrink-0"
                        >
                            <Plus className="w-3.5 h-3.5" /> 添加至列表
                        </button>
                    </div>
                </div>
            )}

            {/* Content for MANUAL_TIMELINE */}
            {strategy.type === 'MANUAL_TIMELINE' && (
                <div className="space-y-4">
                    {/* Add action row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-950/30 p-3 border border-slate-800/60 rounded-xl items-end">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">触发时间 (ms)</label>
                            <input
                                type="number"
                                value={newTimeMs}
                                onChange={(e) => setNewTimeMs(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">施放技能</label>
                            <select
                                value={newSkillId}
                                onChange={(e) => setNewSkillId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                            >
                                {dpsSkills.map(s => (
                                    <option key={s.SkillID} value={s.SkillID}>{s.SkillName}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">目标</label>
                            <select
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold focus:outline-none"
                            >
                                <option value="boss">Boss 目标</option>
                                <option value="dps">自身 (SELF)</option>
                            </select>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={handleAddTimelineAction}
                                className="w-full py-1.5 bg-cyan-500/15 border border-cyan-500/30 hover:bg-cyan-500/25 text-cyan-300 font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" /> 添加动作
                            </button>
                        </div>
                    </div>

                    {/* Timeline List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">动作时间轴流水</span>
                            {strategy.actions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearTimeline}
                                    className="text-[10px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                                >
                                    <Trash2 className="w-3 h-3" /> 清空时间轴
                                </button>
                            )}
                        </div>

                        <div className="border border-slate-850 rounded-xl overflow-hidden">
                            <div className="max-h-[240px] overflow-y-auto scrollbar-thin">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-950/50 text-slate-500 border-b border-slate-850 font-bold">
                                            <th className="py-2.5 px-3">时间点 (ms)</th>
                                            <th className="py-2.5 px-3">施放技能</th>
                                            <th className="py-2.5 px-3">施法目标</th>
                                            <th className="py-2.5 px-3 text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-850/40">
                                        {strategy.actions.map((act, index) => {
                                            const skill = dpsSkills.find(s => s.SkillID === act.skillId);
                                            return (
                                                <tr key={index} className="hover:bg-slate-950/35 text-slate-300">
                                                    <td className="py-2 px-3 font-mono text-cyan-400/90 font-bold">
                                                        {act.timeMs} ms
                                                    </td>
                                                    <td className="py-2 px-3 font-semibold">
                                                        {skill?.SkillName || act.skillId}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-400">
                                                        {act.targetActorId === 'boss' ? 'Boss 目标' : '自身'}
                                                    </td>
                                                    <td className="py-2 px-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveTimelineAction(index)}
                                                            className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                                                            title="删除动作"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5 inline" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {strategy.actions.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="text-center py-8 text-slate-500 font-medium">
                                                    无配置动作，请使用上方表单在对应时间点添加施法指令。
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

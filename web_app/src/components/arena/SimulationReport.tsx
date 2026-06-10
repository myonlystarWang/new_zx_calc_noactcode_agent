import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, ReferenceLine } from 'recharts';
import { Clock, Zap, Swords, BookOpen, AlertCircle, FileText, CheckCircle2, Play, Pause, RotateCcw, Activity, BarChart2, Eye } from 'lucide-react';
import type { SimulationResult } from '../../types';
import clsx from 'clsx';

type DamageAuditRecord = NonNullable<SimulationResult['damageAuditRecords']>[number];

interface SimulationReportProps {
    result: SimulationResult;
    baselineResult?: SimulationResult;
    onSetBaseline: () => void;
    onClearBaseline: () => void;
    currentTimeMs: number;
    setCurrentTimeMs: React.Dispatch<React.SetStateAction<number>>;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    playbackSpeed: number;
    setPlaybackSpeed: (speed: number) => void;
}

export const SimulationReport: React.FC<SimulationReportProps> = ({
    result,
    baselineResult,
    onSetBaseline,
    onClearBaseline,
    currentTimeMs,
    setCurrentTimeMs,
    isPlaying,
    setIsPlaying,
    playbackSpeed,
    setPlaybackSpeed
}) => {
    const [activeTab, setActiveTab] = useState<'curve' | 'breakdown' | 'scrubber' | 'audit' | 'logs'>('curve');
    const [logTypeFilter, setLogTypeFilter] = useState<string>('ALL');
    const [logSearch, setLogSearch] = useState<string>('');
    const [showFullLogs, setShowFullLogs] = useState<boolean>(false);
    const [auditWindowSeconds, setAuditWindowSeconds] = useState<number>(5);

    const durationSeconds = result.summary.DpsDurationMs / 1000;
    const isKilled = result.boss.currentHealth <= 0;

    // Format numbers helper (million/billion localization)
    const formatLargeNumber = (num: number): string => {
        if (num >= 100000000) {
            return `${(num / 100000000).toFixed(2)} 亿`;
        }
        if (num >= 10000) {
            return `${(num / 10000).toFixed(2)} 万`;
        }
        return Math.round(num).toLocaleString();
    };

    const formatDamage = (damage: number): string => {
        return formatLargeNumber(damage);
    };

    const formatPercentValue = (value: number | undefined): string => `${((value ?? 0)).toFixed(1)}%`;

    const formatSignedPercentValue = (value: number | undefined): string => {
        const safeValue = value ?? 0;
        const sign = safeValue > 0 ? '+' : '';
        return `${sign}${safeValue.toFixed(1)}%`;
    };

    const formatBuffSummary = (effects: object, fields: { key: string; label: string; percent?: boolean }[]): string => {
        const keyedEffects = effects as Record<string, number | undefined>;
        const parts = fields
            .map(field => {
                const value = keyedEffects[field.key];
                if (value === undefined || value === 0) return '';
                const displayValue = field.percent ? formatSignedPercentValue(value) : `${value > 0 ? '+' : ''}${formatLargeNumber(value)}`;
                return `${field.label}${displayValue}`;
            })
            .filter(Boolean);
        return parts.length > 0 ? parts.join(' / ') : '无';
    };

    const getAuditEffectSpeed = (record: DamageAuditRecord, effectId: string): number => {
        return record.ActiveEffects
            .filter(effect => effect.EffectId === effectId)
            .reduce((max, effect) => Math.max(max, effect.BuffEffects.BuffSpeedPercentEffect ?? 0), 0);
    };

    const formatCastSpeedMultiplierSummary = (record: DamageAuditRecord): string => {
        const hasZgddSwift = record.ActiveEffects.some(effect => effect.EffectId === 'ZS_BUFF_ZGDD_SPEED');
        const swiftSpeed = hasZgddSwift ? 50 : getAuditEffectSpeed(record, 'ZS_BUFF_QXHS_SPEED');
        const dragonSpeed = getAuditEffectSpeed(record, 'ZS_BUFF_LZYY_SPEED');
        if (swiftSpeed === 0 && dragonSpeed === 0) return '';

        const multiplier = (1 + swiftSpeed / 100) * (1 + dragonSpeed / 100);
        const equivalentSpeed = (multiplier - 1) * 100;
        const parts = [
            swiftSpeed !== 0 ? `迅疾 ${formatSignedPercentValue(swiftSpeed)}` : '',
            dragonSpeed !== 0 ? `龙战 ${formatSignedPercentValue(dragonSpeed)}` : ''
        ].filter(Boolean);

        return `施法加速 ${parts.join(' × ')} = 等效 ${formatSignedPercentValue(equivalentSpeed)}`;
    };

    const auditRecords = result.damageAuditRecords || [];
    const visibleAuditRecords = useMemo(() => {
        const windowSeconds = Number.isFinite(auditWindowSeconds) ? Math.max(0, auditWindowSeconds) : 0;
        if (windowSeconds <= 0) return auditRecords;
        return auditRecords.filter(record => record.TimeMs <= windowSeconds * 1000);
    }, [auditRecords, auditWindowSeconds]);



    // Recharts Curve Data
    const chartData = useMemo(() => {
        const seconds = Math.ceil(durationSeconds);
        const data = [];

        const baseDuration = baselineResult ? baselineResult.summary.DpsDurationMs / 1000 : 0;
        const baseSeconds = Math.ceil(baseDuration);
        const maxSeconds = Math.max(seconds, baseSeconds);

        const isKilledResult = result.boss.currentHealth <= 0;

        for (let t = 0; t <= maxSeconds; t++) {
            let dps = 0;
            let hpPercent = 100;
            if (t <= seconds) {
                const hits = result.hitRecords.filter(h => h.TimeMs >= t * 1000 && h.TimeMs < (t + 1) * 1000);
                const secondDamage = hits.reduce((sum, h) => sum + h.DamageApplied, 0);
                dps = Math.round(secondDamage);

                const hitsBefore = result.hitRecords.filter(h => h.TimeMs <= (t + 1) * 1000);
                if (hitsBefore.length > 0) {
                    const lastHit = hitsBefore[hitsBefore.length - 1];
                    hpPercent = Math.max(0, (lastHit.BossHpAfter / result.boss.startingHealth) * 100);
                } else {
                    hpPercent = 100;
                }
                if (t === seconds && isKilledResult) {
                    hpPercent = 0;
                }
            }

            let baseDps = 0;
            let baseHpPercent = 100;
            if (baselineResult && t <= baseSeconds) {
                const hits = baselineResult.hitRecords.filter(h => h.TimeMs >= t * 1000 && h.TimeMs < (t + 1) * 1000);
                const secondDamage = hits.reduce((sum, h) => sum + h.DamageApplied, 0);
                baseDps = Math.round(secondDamage);

                const hitsBefore = baselineResult.hitRecords.filter(h => h.TimeMs <= (t + 1) * 1000);
                if (hitsBefore.length > 0) {
                    const lastHit = hitsBefore[hitsBefore.length - 1];
                    baseHpPercent = Math.max(0, (lastHit.BossHpAfter / baselineResult.boss.startingHealth) * 100);
                } else {
                    baseHpPercent = 100;
                }
                if (t === baseSeconds && baselineResult.boss.currentHealth <= 0) {
                    baseHpPercent = 0;
                }
            }

            data.push({
                time: `${t}s`,
                '当前秒伤害': dps,
                '当前血量比': parseFloat(hpPercent.toFixed(1)),
                ...(baselineResult ? {
                    '基准秒伤害': baseDps,
                    '基准血量比': parseFloat(baseHpPercent.toFixed(1))
                } : {})
            });
        }
        return data;
    }, [result, baselineResult, durationSeconds]);

    // Data for Skill Breakdown (Horizontal Bar Chart)
    const skillBreakdownData = useMemo(() => {
        return result.summary.SkillBreakdown.map(item => ({
            name: item.SkillName,
            '伤害量': item.TotalDamage,
            '释放次数': item.HitCount,
            '占比': parseFloat(((item.TotalDamage / result.summary.TotalDamage) * 100).toFixed(1))
        })).sort((a, b) => b.伤害量 - a.伤害量);
    }, [result]);

    // Extract Buff Timeline Swimlanes
    const swimlanes = useMemo(() => {
        const dpsId = result.hitRecords[0]?.ActorId || 'zhushuang_dps';
        const bossId = result.boss.monsterId;
        const totalDurationMs = result.summary.DpsDurationMs;

        const instanceMap: Record<string, { effectId: string; effectName: string; targetId: string; start: number; end: number }> = {};

        result.events.forEach(event => {
            if (event.status !== 'PROCESSED') return;

            if (event.type === 'BUFF_APPLY') {
                const data = event.data || {};
                const instanceId = data.appliedInstanceId as string;
                const effectId = data.appliedEffectId as string;
                const effectName = (data.effect as any)?.EffectName || effectId;
                const targetId = event.targetId || 'boss';
                const start = event.timeMs;
                const end = data.appliedEndTimeMs as number;

                if (instanceId) {
                    instanceMap[instanceId] = { effectId, effectName, targetId, start, end };
                }

                const replacedIds = data.replacedInstanceIds as string[];
                if (Array.isArray(replacedIds)) {
                    replacedIds.forEach(id => {
                        if (instanceMap[id]) {
                            instanceMap[id].end = event.timeMs;
                        }
                    });
                }
            } else if (event.type === 'BUFF_EXPIRE') {
                const data = event.data || {};
                const instanceId = data.instanceId as string;
                if (instanceId && instanceMap[instanceId]) {
                    instanceMap[instanceId].end = event.timeMs;
                }
            }
        });

        const groups: Record<string, { effectName: string; targetId: string; intervals: { start: number; end: number }[] }> = {};

        Object.values(instanceMap).forEach(inst => {
            if (inst.targetId !== dpsId && inst.targetId !== bossId) return;

            const key = `${inst.targetId}::${inst.effectId}`;
            if (!groups[key]) {
                groups[key] = {
                    effectName: inst.effectName,
                    targetId: inst.targetId,
                    intervals: []
                };
            }

            const clampedEnd = Math.min(inst.end, totalDurationMs);
            if (clampedEnd > inst.start) {
                groups[key].intervals.push({ start: inst.start, end: clampedEnd });
            }
        });

        return Object.values(groups).map(group => {
            const sorted = [...group.intervals].sort((a, b) => a.start - b.start);
            const merged: { start: number; end: number }[] = [];

            sorted.forEach(interval => {
                if (merged.length === 0) {
                    merged.push(interval);
                } else {
                    const last = merged[merged.length - 1];
                    if (interval.start <= last.end + 50) {
                        last.end = Math.max(last.end, interval.end);
                    } else {
                        merged.push(interval);
                    }
                }
            });

            return {
                key: `${group.targetId}::${group.effectName}`,
                effectName: group.effectName,
                isBoss: group.targetId === bossId,
                intervals: merged
            };
        }).filter(g => g.intervals.length > 0);
    }, [result]);

    // Extract active Buffs/Debuffs
    const activeBuffs = useMemo(() => {
        return swimlanes
            .filter(lane => !lane.isBoss)
            .map(lane => {
                const activeInterval = lane.intervals.find(interval => 
                    currentTimeMs >= interval.start && currentTimeMs <= interval.end
                );
                if (!activeInterval) return null;
                return {
                    name: lane.effectName,
                    remainingMs: activeInterval.end - currentTimeMs,
                    totalMs: activeInterval.end - activeInterval.start
                };
            })
            .filter(Boolean) as { name: string; remainingMs: number; totalMs: number }[];
    }, [swimlanes, currentTimeMs]);

    const activeDebuffs = useMemo(() => {
        return swimlanes
            .filter(lane => lane.isBoss)
            .map(lane => {
                const activeInterval = lane.intervals.find(interval => 
                    currentTimeMs >= interval.start && currentTimeMs <= interval.end
                );
                if (!activeInterval) return null;
                return {
                    name: lane.effectName,
                    remainingMs: activeInterval.end - currentTimeMs,
                    totalMs: activeInterval.end - activeInterval.start
                };
            })
            .filter(Boolean) as { name: string; remainingMs: number; totalMs: number }[];
    }, [swimlanes, currentTimeMs]);

    // Log filter
    const filteredLogs = useMemo(() => {
        return result.events
            .filter(e => e.timeMs <= currentTimeMs)
            .filter(e => {
                if (logTypeFilter !== 'ALL' && e.type !== logTypeFilter) return false;
                if (logSearch) {
                    const query = logSearch.toLowerCase();
                    const msgMatch = e.message?.toLowerCase().includes(query) ?? false;
                    const skillMatch = e.skillId?.toLowerCase().includes(query) ?? false;
                    const actorMatch = e.actorId?.toLowerCase().includes(query) ?? false;
                    return msgMatch || skillMatch || actorMatch;
                }
                return true;
            });
    }, [result, logTypeFilter, logSearch, currentTimeMs]);

    // Format logs for rendering
    const formatEventToChinese = (event: any) => {
        const ACTOR_NAMES: Record<string, string> = {
            'zhushuang_dps': '主输出(逐霜)',
            'tianyin_sup': '辅助(天音)',
            'fenxiang_sup': '辅助(焚香)',
            'zhaoming_sup': '辅助(昭冥)',
            'yingzhao_sup': '辅助(英招)',
            'tianhua_sup': '辅助(天华)'
        };
        const getActorName = (id?: string) => {
            if (!id) return '未知';
            if (ACTOR_NAMES[id]) return ACTOR_NAMES[id];
            for (const key of Object.keys(ACTOR_NAMES)) {
                const short = key.replace('_sup', '');
                if (id.startsWith(short)) return ACTOR_NAMES[key];
            }
            return id;
        };

        const data = event.data || {};
        const skillName = data.skillName || event.skillId || '普通攻击';
        const actorName = getActorName(event.actorId);
        const targetName = getActorName(event.targetId);

        switch (event.type) {
            case 'CAST_START':
                return `【${actorName}】施放【${skillName}】`;
            case 'CAST_COMPLETE':
                return `【${actorName}】完成【${skillName}】`;
            case 'HIT': {
                const dmg = data.damageApplied || 0;
                const segmentIdx = data.segmentIndex != null ? data.segmentIndex + 1 : 1;
                const totalSegs = data.totalSegments || 1;
                return `【${actorName}】的【${skillName}】(第${segmentIdx}/${totalSegs}段) 命中首领造成 ${formatLargeNumber(dmg)}`;
            }
            case 'BUFF_APPLY': {
                const effectName = data.effect?.EffectName || data.appliedEffectId || '状态';
                const durationSec = (data.appliedEndTimeMs - event.timeMs) / 1000;
                return `【${targetName}】获得【${effectName}】(持续${durationSec.toFixed(1)}s)`;
            }
            case 'BUFF_EXPIRE': {
                const effectName = data.effectName || data.effectId || '状态';
                return `【${targetName}】的【${effectName}】失效`;
            }
            case 'COOLDOWN_READY':
                return `【${actorName}】的【${skillName}】就绪`;
            default:
                return event.message || `战斗事件 #${event.sequence}`;
        }
    };

    const comparisonMetrics = useMemo(() => {
        if (!baselineResult) return null;

        const timeDiff = durationSeconds - (baselineResult.summary.DpsDurationMs / 1000);
        const timeDiffPct = (timeDiff / (baselineResult.summary.DpsDurationMs / 1000)) * 100;

        const dpsDiff = result.summary.AverageDps - baselineResult.summary.AverageDps;
        const dpsDiffPct = (dpsDiff / baselineResult.summary.AverageDps) * 100;

        return {
            timeDiff,
            timeDiffPct,
            dpsDiff,
            dpsDiffPct
        };
    }, [result, baselineResult, durationSeconds]);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* A/B Comparison Laboratory Banner */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.3)] rounded-2xl p-5 relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none"></div>
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                        方案对比实验室 (A/B Test Suite)
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-medium">
                        您可以将当前模拟结果锁定为 “基准方案 A”，接着修改配置（如职业属性或技能循环），重新进行仿真。系统将对比二者的秒级 DPS 伤害曲线与击杀效率。
                    </p>
                </div>
                <div className="flex gap-2.5 shrink-0 relative z-10">
                    {!baselineResult ? (
                        <button
                            type="button"
                            onClick={onSetBaseline}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-900/20 active:scale-95 transition-all"
                        >
                            锁定为基准方案 A
                        </button>
                    ) : (
                        <>
                            <div className="bg-indigo-500/10 px-3.5 py-2 rounded-xl border border-indigo-500/20 text-xs flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                <span className="font-bold text-indigo-300">基准方案 A 已锁定</span>
                            </div>
                            <button
                                type="button"
                                onClick={onClearBaseline}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs active:scale-95 transition-all border border-slate-700"
                            >
                                清除基准
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* A/B Comparison Result metrics */}
            {comparisonMetrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 shadow-lg relative overflow-hidden">
                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">通关时间对比</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-black text-slate-100 font-mono">
                                    {durationSeconds.toFixed(2)}s <span className="text-xs text-slate-500 font-normal">vs {((baselineResult?.summary.DpsDurationMs || 0)/1000).toFixed(2)}s</span>
                                </span>
                            </div>
                        </div>
                        <span className={clsx(
                            "text-xs font-black px-2.5 py-1 rounded-xl shadow-md",
                            comparisonMetrics.timeDiff <= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        )}>
                            {comparisonMetrics.timeDiff <= 0 ? '↑ 提速' : '↓ 变慢'} {Math.abs(comparisonMetrics.timeDiff).toFixed(2)}s ({Math.abs(comparisonMetrics.timeDiffPct).toFixed(1)}%)
                        </span>
                    </div>

                    <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl flex items-center justify-between">
                        <div>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">平均 DPS 对比</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xl font-black text-slate-100 font-mono">
                                    {formatDamage(result.summary.AverageDps)} <span className="text-xs text-slate-550 font-normal">vs {formatDamage(baselineResult?.summary.AverageDps || 0)}</span>
                                </span>
                            </div>
                        </div>
                        <span className={clsx(
                            "text-xs font-black px-2.5 py-1 rounded-xl shadow-md",
                            comparisonMetrics.dpsDiff >= 0 ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        )}>
                            {comparisonMetrics.dpsDiff >= 0 ? '↑ 提升' : '↓ 降低'} {Math.abs(comparisonMetrics.dpsDiffPct).toFixed(1)}%
                        </span>
                    </div>
                </div>
            )}

            {/* Core Stats HUD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                            <Clock className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">战斗耗时</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
                            {durationSeconds.toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-500 font-bold">秒</span>
                    </div>
                    <span className={clsx(
                        "text-[10px] font-bold mt-3 inline-flex items-center gap-1.5",
                        isKilled ? 'text-green-400' : 'text-amber-500'
                    )}>
                        {isKilled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {isKilled ? '击杀成功' : '超时截止'}
                    </span>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Zap className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">秒级平均 DPS</span>
                    </div>
                    <div className="flex items-baseline mt-1">
                        <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight drop-shadow-[0_0_8px_rgba(52,211,153,0.15)]">
                            {formatDamage(result.summary.AverageDps)}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-3 font-semibold leading-none">
                        累计伤害折算 / 有效时间
                    </span>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                            <Swords className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">累计总伤</span>
                    </div>
                    <div className="flex items-baseline mt-1">
                        <span className="text-2xl font-black text-slate-100 font-mono tracking-tight">
                            {formatDamage(result.summary.TotalDamage)}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-3 font-semibold leading-none">
                        团队所有成员伤害总额
                    </span>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 p-4 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all">
                    <div className="flex items-center gap-2 text-slate-400 mb-1.5">
                        <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">首领关卡信息</span>
                    </div>
                    <div className="flex flex-col mt-1 leading-normal">
                        <span className="text-sm font-black text-slate-200 truncate">
                            {result.boss.monsterName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase mt-0.5">
                            HP: {formatDamage(result.boss.startingHealth)}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-3 font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        剩余血量: {((result.boss.currentHealth / result.boss.startingHealth) * 100).toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Results Presentation Hub (Tabs selection for Curve, Breakdown, Scrubber, and Logs) */}
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
                {/* Tabs bar */}
                <div className="flex overflow-x-auto border-b border-slate-800/80 bg-slate-900/20 p-2 gap-1">
                    {[
                        { id: 'curve', label: '秒伤血线曲线', icon: <Activity className="w-4 h-4" /> },
                        { id: 'breakdown', label: '输出技能占比', icon: <BarChart2 className="w-4 h-4" /> },
                        { id: 'scrubber', label: '时空回溯沙盘', icon: <Clock className="w-4 h-4" /> },
                        { id: 'audit', label: `伤害审计${auditRecords.length > 0 ? `(${auditRecords.length})` : ''}`, icon: <Eye className="w-4 h-4" /> },
                        { id: 'logs', label: '战斗事件流水', icon: <FileText className="w-4 h-4" /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 relative",
                                activeTab === tab.id
                                    ? "bg-slate-800 text-cyan-400 shadow-md border border-slate-700"
                                    : "text-slate-500 hover:text-slate-350 hover:bg-slate-800/40"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyan-400 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Tab content panel */}
                <div className="p-5 min-h-[360px] flex flex-col justify-between bg-slate-950/15">
                    {/* Tab 1: Curve chart */}
                    {activeTab === 'curve' && (
                        <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col justify-between">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-slate-350 leading-relaxed">实时战斗秒级 DPS 与 Boss 状态曲线 (Damage & HP Curve)</span>
                                <span className="text-[10px] text-cyan-400 font-bold bg-cyan-400/5 px-2 py-0.5 rounded border border-cyan-400/10 font-mono">
                                    回放时间: {(currentTimeMs / 1000).toFixed(3)}s
                                </span>
                            </div>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="primaryGlow" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--theme-primary)" stopOpacity={0.2}/>
                                                <stop offset="95%" stopColor="var(--theme-primary)" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                                        <XAxis dataKey="time" stroke="#475569" style={{ fontSize: 9, fontFamily: 'monospace' }} />
                                        <YAxis yAxisId="left" stroke="var(--theme-primary)" tickFormatter={formatLargeNumber} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                                        <YAxis yAxisId="right" orientation="right" stroke="var(--theme-accent)" domain={[0, 100]} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: 12, color: '#f8fafc', fontSize: 10, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
                                            formatter={(value: any, name: any) => {
                                                const nameStr = String(name || '');
                                                if (nameStr.includes('伤害')) {
                                                    return [formatLargeNumber(Number(value) || 0), nameStr];
                                                }
                                                return [`${value}%`, nameStr];
                                            }}
                                        />
                                        <ReferenceLine yAxisId="left" x={`${Math.round(currentTimeMs / 1000)}s`} stroke="var(--theme-primary)" strokeWidth={1.5} strokeDasharray="3 3" />
                                        <Line yAxisId="left" type="monotone" dataKey="当前秒伤害" stroke="var(--theme-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                                        <Line yAxisId="right" type="monotone" dataKey="当前血量比" stroke="var(--theme-accent)" strokeWidth={2} dot={false} />
                                        {baselineResult && (
                                            <>
                                                <Line yAxisId="left" type="monotone" dataKey="基准秒伤害" stroke="var(--theme-primary)" strokeWidth={1.2} strokeDasharray="4 4" dot={false} opacity={0.4} />
                                                <Line yAxisId="right" type="monotone" dataKey="基准血量比" stroke="var(--theme-accent)" strokeWidth={1.2} strokeDasharray="4 4" dot={false} opacity={0.4} />
                                            </>
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Breakdown chart */}
                    {activeTab === 'breakdown' && (
                        <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col justify-between">
                            <span className="block text-xs font-bold text-slate-350">各输出技能伤害占比图 (Skill Damage Breakdown)</span>
                            <div className="h-[280px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={skillBreakdownData} layout="vertical" margin={{ top: 0, right: 15, left: -15, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} horizontal={false} />
                                        <XAxis type="number" stroke="#475569" tickFormatter={formatLargeNumber} style={{ fontSize: 9, fontFamily: 'monospace' }} />
                                        <YAxis dataKey="name" type="category" stroke="#94a3b8" style={{ fontSize: 10, fontWeight: 'bold' }} width={80} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: '#0b1329', borderColor: '#1e293b', borderRadius: 12, color: '#f8fafc', fontSize: 10, border: '1px solid rgba(255,255,255,0.08)' }} 
                                            formatter={(value: any, _name: any, props: any) => {
                                                return [
                                                    <span key="val" className="font-mono text-cyan-400 font-bold">{formatDamage(value)} ({props.payload.占比}%)</span>,
                                                    '伤害占比'
                                                ];
                                            }}
                                        />
                                        <Bar dataKey="伤害量" fill="var(--theme-primary)" radius={[0, 4, 4, 0]} barSize={14} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Tab 3: Scrubber sandtable */}
                    {activeTab === 'scrubber' && (
                        <div className="space-y-6 animate-in fade-in duration-300 flex-1">
                            {/* Media Controller Bar */}
                            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/40 p-3.5 border border-slate-800/60 rounded-2xl shadow-inner">
                                {/* Control Buttons */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPlaying(false);
                                            setCurrentTimeMs(0);
                                        }}
                                        className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all active:scale-95"
                                        title="回到起点"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (currentTimeMs >= result.summary.DpsDurationMs) {
                                                setCurrentTimeMs(0);
                                                setIsPlaying(true);
                                            } else {
                                                setIsPlaying(!isPlaying);
                                            }
                                        }}
                                        className="p-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 rounded-xl transition-all active:scale-95"
                                        title={isPlaying ? '暂停' : '播放'}
                                    >
                                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPlaying(false);
                                            setCurrentTimeMs(prev => Math.max(0, prev - 100));
                                        }}
                                        className="px-2 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-[10px] font-bold font-mono transition-all active:scale-95"
                                        title="后退 100ms"
                                    >
                                        -100ms
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsPlaying(false);
                                            setCurrentTimeMs(prev => Math.min(result.summary.DpsDurationMs, prev + 100));
                                        }}
                                        className="px-2 py-1.5 bg-slate-950/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-[10px] font-bold font-mono transition-all active:scale-95"
                                        title="前进 100ms"
                                    >
                                        +100ms
                                    </button>
                                </div>

                                {/* Timeline Slider */}
                                <div className="flex-1 w-full flex items-center gap-3">
                                    <span className="text-[10px] font-bold font-mono text-slate-650">0.00s</span>
                                    <input
                                        type="range"
                                        min={0}
                                        max={result.summary.DpsDurationMs}
                                        step={100}
                                        value={currentTimeMs}
                                        onChange={(e) => {
                                            setIsPlaying(false);
                                            setCurrentTimeMs(parseInt(e.target.value) || 0);
                                        }}
                                        className="flex-1 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                                    />
                                    <span className="text-[10px] font-bold font-mono text-slate-650">
                                        {durationSeconds.toFixed(2)}s
                                    </span>
                                </div>

                                {/* Speed Selection */}
                                <div className="flex items-center gap-1.5 shrink-0 bg-slate-950/80 p-1 rounded-xl border border-slate-850">
                                    {([0.5, 1, 2, 5, 10] as const).map(speed => (
                                        <button
                                            key={speed}
                                            type="button"
                                            onClick={() => setPlaybackSpeed(speed)}
                                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                playbackSpeed === speed
                                                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                                                    : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {speed}x
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Head indicators */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-2 mb-3">
                                        <span className="text-xs font-black text-slate-200">角色状态监测 (Active Buffs)</span>
                                        <span className="text-[10px] text-cyan-400 bg-cyan-400/5 px-2 py-0.5 rounded border border-cyan-400/10 font-bold tracking-wide">
                                            BUFFS: {activeBuffs.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
                                        {activeBuffs.map(buff => {
                                            const pct = buff.totalMs > 0 ? (buff.remainingMs / buff.totalMs) * 100 : 100;
                                            return (
                                                <div key={buff.name} className="bg-slate-950/40 p-2 rounded-xl border border-slate-900 flex flex-col justify-between gap-1 shadow-sm">
                                                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-350">
                                                        <span className="truncate max-w-[90px]">{buff.name}</span>
                                                        <span className="font-mono text-cyan-400 font-bold">
                                                            {(buff.remainingMs / 1000).toFixed(1)}s
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-cyan-400 h-full transition-all duration-75"
                                                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {activeBuffs.length === 0 && (
                                            <div className="col-span-2 text-center py-6 text-xs text-slate-600 border border-dashed border-slate-900 rounded-xl">
                                                当前无生效 Buff 增益
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-2xl flex flex-col justify-between">
                                    <div className="flex items-center justify-between border-b border-slate-900/60 pb-2 mb-3">
                                        <span className="text-xs font-black text-slate-200">首领状态监测 (Target Debuffs)</span>
                                        <span className="text-[10px] text-rose-450 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10 font-bold tracking-wide">
                                            DEBUFFS: {activeDebuffs.length}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1">
                                        {activeDebuffs.map(debuff => {
                                            const pct = debuff.totalMs > 0 ? (debuff.remainingMs / debuff.totalMs) * 100 : 100;
                                            return (
                                                <div key={debuff.name} className="bg-slate-950/40 p-2 rounded-xl border border-slate-900 flex flex-col justify-between gap-1 shadow-sm">
                                                    <div className="flex justify-between items-center text-[10px] font-semibold text-slate-350">
                                                        <span className="truncate max-w-[90px]">{debuff.name}</span>
                                                        <span className="font-mono text-rose-400 font-bold">
                                                            {(debuff.remainingMs / 1000).toFixed(1)}s
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                                                        <div
                                                            className="bg-rose-400 h-full transition-all duration-75"
                                                            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {activeDebuffs.length === 0 && (
                                            <div className="col-span-2 text-center py-6 text-xs text-slate-600 border border-dashed border-slate-900 rounded-xl">
                                                当前首领身上无 Debuff 状态
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Buff/Debuff Swimlanes Area */}
                            <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-2xl">
                                <span className="block text-xs font-bold text-slate-200 mb-1">各增益/减益状态生效时间段 (Swimlanes Timeline)</span>
                                <span className="block text-[10px] text-slate-500 mb-4 font-semibold">多彩横条代表增益周期（横向为时间轴，点击刻度回溯）。</span>
                                <div className="space-y-3 max-h-[180px] overflow-y-auto pr-1">
                                    {swimlanes.map(lane => (
                                        <div key={lane.key} className="flex items-center gap-3">
                                            <div className="w-[100px] shrink-0 text-right leading-tight">
                                                <span className="text-xs font-bold text-slate-300 block truncate" title={lane.effectName}>
                                                    {lane.effectName}
                                                </span>
                                                <span className={clsx(
                                                    "text-[8px] font-bold px-1.5 py-0.2 rounded border font-mono tracking-wider",
                                                    lane.isBoss ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
                                                )}>
                                                    {lane.isBoss ? '首领' : '主角'}
                                                </span>
                                            </div>

                                            <div className="flex-1 h-4 bg-slate-950/80 rounded border border-slate-900 relative overflow-hidden">
                                                {lane.intervals.map((interval, i) => {
                                                    const leftPercent = (interval.start / result.summary.DpsDurationMs) * 100;
                                                    const widthPercent = ((interval.end - interval.start) / result.summary.DpsDurationMs) * 100;
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={clsx(
                                                                "absolute inset-y-1 rounded-sm border-x transition-all duration-300",
                                                                lane.isBoss ? "bg-rose-500/20 border-rose-500/30" : "bg-cyan-500/20 border-cyan-500/30"
                                                            )}
                                                            style={{
                                                                left: `${leftPercent}%`,
                                                                width: `${widthPercent}%`
                                                            }}
                                                            title={`生效期: ${(interval.start/1000).toFixed(2)}s ~ ${(interval.end/1000).toFixed(2)}s`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {swimlanes.length === 0 && (
                                        <div className="text-center py-10 text-xs text-slate-600 border border-dashed border-slate-900 rounded-xl">
                                            模拟周期内未监测到生效状态
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab 4: Damage audit */}
                    {activeTab === 'audit' && (
                        <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                                <div>
                                    <span className="font-bold text-slate-200">逐段伤害审计</span>
                                    <p className="mt-1 text-[11px] text-slate-500">
                                        启用伤害审计后重新仿真，会记录每段命中的属性、我方增益、Boss 减益和最终公式口径。
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/50 px-2 py-1 text-[10px] font-black text-slate-400">
                                        窗口
                                        <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={auditWindowSeconds}
                                            onChange={(event) => setAuditWindowSeconds(Math.max(0, Number(event.target.value) || 0))}
                                            className="h-6 w-14 rounded-md border border-slate-800 bg-slate-900 px-1.5 text-right font-mono text-[10px] text-slate-100 outline-none focus:border-cyan-500/60"
                                        />
                                        s
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setAuditWindowSeconds(5)}
                                        className={clsx(
                                            'rounded-lg border px-2.5 py-1 text-[10px] font-black transition-colors',
                                            auditWindowSeconds === 5
                                                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                                                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                                        )}
                                    >
                                        5s
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAuditWindowSeconds(0)}
                                        className={clsx(
                                            'rounded-lg border px-2.5 py-1 text-[10px] font-black transition-colors',
                                            auditWindowSeconds <= 0
                                                ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
                                                : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-slate-200'
                                        )}
                                    >
                                        全部
                                    </button>
                                    <span className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-black text-cyan-200">
                                        显示 {visibleAuditRecords.length} / 总 {auditRecords.length}
                                    </span>
                                </div>
                            </div>

                            {auditRecords.length === 0 ? (
                                <div className="min-h-[260px] rounded-2xl border border-dashed border-slate-800 bg-slate-950/35 grid place-items-center text-center">
                                    <div>
                                        <AlertCircle className="mx-auto h-7 w-7 text-slate-600" />
                                        <p className="mt-3 text-xs font-bold text-slate-500">本次结果未包含伤害审计</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-h-[430px] overflow-auto rounded-2xl border border-slate-850 bg-slate-950/45">
                                    <table className="min-w-[1280px] w-full text-left text-[11px] border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400">
                                            <tr className="border-b border-slate-850">
                                                <th className="px-3 py-2 font-black">时间</th>
                                                <th className="px-3 py-2 font-black">技能/段</th>
                                                <th className="px-3 py-2 font-black">伤害</th>
                                                <th className="px-3 py-2 font-black">角色有效属性</th>
                                                <th className="px-3 py-2 font-black">我方增益</th>
                                                <th className="px-3 py-2 font-black">Boss 减益(入公式)</th>
                                                <th className="px-3 py-2 font-black">Boss 减益(显示)</th>
                                                <th className="px-3 py-2 font-black">乘区</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visibleAuditRecords.map((record, index) => (
                                                <tr key={`${record.TimeMs}-${record.SkillId}-${record.HitIndex}-${index}`} className="border-b border-slate-900/80 text-slate-300 hover:bg-slate-900/45">
                                                    <td className="px-3 py-2 font-mono text-cyan-300">{(record.TimeMs / 1000).toFixed(3)}s</td>
                                                    <td className="px-3 py-2">
                                                        <span className="block font-black text-slate-100">{record.SkillName}</span>
                                                        <span className="font-mono text-slate-500">第 {record.HitIndex}/{record.HitCount} 段</span>
                                                    </td>
                                                    <td className="px-3 py-2 font-black text-red-200">{formatDamage(record.DamageApplied)}</td>
                                                    <td className="px-3 py-2 leading-relaxed">
                                                        攻击 {formatLargeNumber(record.EffectiveAttributes.CharacterMinAttack)}-{formatLargeNumber(record.EffectiveAttributes.CharacterMaxAttack)}
                                                        <br />
                                                        气血 {formatLargeNumber(record.EffectiveAttributes.CharacterHealth)} / 真气 {formatLargeNumber(record.EffectiveAttributes.CharacterMana)}
                                                        <br />
                                                        防御 {formatLargeNumber(record.EffectiveAttributes.CharacterDefense)} / 爆伤 {formatPercentValue(record.Formula.baseCriticalDamageAfterCap)}
                                                    </td>
                                                    <td className="px-3 py-2 leading-relaxed">
                                                        {formatBuffSummary(record.CombinedBuffTotals, [
                                                            { key: 'BuffFocusPercentEffect', label: '专注', percent: true },
                                                            { key: 'BuffHolyWrathPercentEffect', label: '巫咒', percent: true },
                                                            { key: 'BuffCriticalDamagePercentEffect', label: '爆伤', percent: true },
                                                            { key: 'BuffManaPercentEffect', label: '真气', percent: true },
                                                            { key: 'BuffAttackPercentEffect', label: '攻击', percent: true }
                                                        ])}
                                                        {formatCastSpeedMultiplierSummary(record) && (
                                                            <>
                                                                <br />
                                                                <span className="text-amber-200">{formatCastSpeedMultiplierSummary(record)}</span>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 leading-relaxed">
                                                        绿点 {formatSignedPercentValue(record.Formula.buffMonsterCriticalDamagePercentAfterCap)}
                                                        <span className="text-slate-500"> / cap前 {formatSignedPercentValue(record.Formula.buffMonsterCriticalDamagePercentBeforeCap)}</span>
                                                        <br />
                                                        易伤 {formatSignedPercentValue(record.Formula.buffMonsterHarmedPercentAfterCap)}
                                                        <span className="text-slate-500"> / cap前 {formatSignedPercentValue(record.Formula.buffMonsterHarmedPercentBeforeCap)}</span>
                                                        {record.Formula.ybjhGreenMultiplierActive && (
                                                            <span className="block text-emerald-300">炎兵灸魂: 绿点 x2</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 leading-relaxed">
                                                        {formatBuffSummary(record.BossDebuffTotalsDisplayed, [
                                                            { key: 'BuffMonsterCriticalDamagePercentEffect', label: '绿点', percent: true },
                                                            { key: 'BuffMonsterHarmedPercentEffect', label: '易伤', percent: true },
                                                            { key: 'BuffMonsterCritRateIncreaseEffect', label: '紫点', percent: true },
                                                            { key: 'BuffDefenseFixedEffect', label: '破防' }
                                                        ])}
                                                    </td>
                                                    <td className="px-3 py-2 leading-relaxed">
                                                        爆伤 {(record.Formula.multipliers.critMultiplier).toFixed(3)}x / 技能 {(record.Formula.multipliers.skillDamageBonusMultiplier).toFixed(3)}x
                                                        <br />
                                                        对怪 {(record.Formula.multipliers.characterMonsterDamageIncreaseMultiplier).toFixed(3)}x / 易伤 {(record.Formula.multipliers.monsterHarmedMultiplier).toFixed(3)}x
                                                        <br />
                                                        专注 {(record.Formula.multipliers.focusMultiplier).toFixed(3)}x / 巫咒 {(record.Formula.multipliers.holyWrathMultiplier).toFixed(3)}x
                                                        {record.Formula.multipliers.damageCompressionMultiplier !== undefined && (
                                                            <>
                                                                <br />
                                                                压缩 {(record.Formula.multipliers.damageCompressionMultiplier).toFixed(3)}x
                                                            </>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 5: Logs */}
                    {activeTab === 'logs' && (
                        <div className="space-y-4 animate-in fade-in duration-300 flex-1 flex flex-col justify-between">
                            {/* Search and Filters */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/20 p-3 border border-slate-850 rounded-2xl">
                                <div className="flex items-center gap-2 text-xs font-black text-slate-200">
                                    <FileText className="w-4 h-4 text-cyan-400" />
                                    <span>仿真时空事件浏览器</span>
                                </div>

                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <input
                                        type="text"
                                        placeholder="过滤事件..."
                                        value={logSearch}
                                        onChange={(e) => setLogSearch(e.target.value)}
                                        className="bg-slate-950 border border-slate-850 text-slate-200 placeholder-slate-600 rounded-xl px-3 py-1 text-xs focus:outline-none w-full sm:w-32 focus:border-cyan-500/40"
                                    />
                                    <select
                                        value={logTypeFilter}
                                        onChange={(e) => setLogTypeFilter(e.target.value)}
                                        className="bg-slate-950 border border-slate-850 text-slate-350 rounded-xl px-3 py-1 text-xs focus:outline-none shrink-0"
                                    >
                                        <option value="ALL">全部事件</option>
                                        <option value="CAST_START">施法开始</option>
                                        <option value="CAST_COMPLETE">施法完成</option>
                                        <option value="HIT">命中结算</option>
                                        <option value="BUFF_APPLY">增益生效</option>
                                        <option value="BUFF_EXPIRE">增益失效</option>
                                        <option value="COOLDOWN_READY">冷却完毕</option>
                                    </select>
                                </div>
                            </div>

                            {/* Logs render */}
                            <div className="border border-slate-900 rounded-2xl bg-slate-950/30 overflow-hidden flex-1">
                                <div className="max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <tbody>
                                            {filteredLogs.slice(showFullLogs ? -500 : -25).map(log => (
                                                <tr key={log.sequence} className="border-b border-slate-900/60 hover:bg-slate-900/10 text-slate-350 font-medium transition-all">
                                                    <td className="py-2 px-4 font-mono text-cyan-400 font-bold w-[70px] shrink-0 bg-slate-900/5">
                                                        {(log.timeMs / 1000).toFixed(3)}s
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-300">
                                                        {formatEventToChinese(log)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredLogs.length === 0 && (
                                                <tr>
                                                    <td className="text-center py-12 text-slate-650 italic">
                                                        无已发生或符合筛选过滤的事件
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Show All Toggle */}
                            {filteredLogs.length > 25 && (
                                <div className="text-center pt-1.5 border-t border-slate-900/50">
                                    <button
                                        type="button"
                                        onClick={() => setShowFullLogs(!showFullLogs)}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-cyan-400 transition-colors"
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        {showFullLogs ? '收起多余日志 (仅看近25条)' : `显示全部历史日志 (共 ${filteredLogs.length} 条)`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

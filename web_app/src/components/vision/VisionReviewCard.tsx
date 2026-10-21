import React, { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Copy, Check, ArrowRight, Sliders, Info } from 'lucide-react';
import type { FieldCell, RecognizedPanel } from '../../services/vision/types';
import { kindLabel } from '../../services/vision/fieldRegistry';
import { mapToEngine } from '../../services/vision/mapToEngine';

export interface VisionReviewCardProps {
    panel: RecognizedPanel;
    /** 带入计算器：只写有值的项，缺项不覆盖 */
    onImport?: (panel: RecognizedPanel) => void;
    /** 算副本秒伤（本期禁用，Phase C 接引擎） */
    onSimulate?: (panel: RecognizedPanel) => void;
    /** 存为档案（localStorage） */
    onArchive?: (panel: RecognizedPanel) => void;
    onPeek?: (image: string) => void;
    className?: string;
}

const fmtNum = (v: number | string | null): string => {
    if (v === null || v === '') return '—';
    if (typeof v === 'string') return v;
    return v.toLocaleString();
};

const withUnit = (cell: FieldCell): string => {
    if (cell.value === null || cell.value === '') return '';
    if (cell.unit === 'percent') return `${cell.value}%`;
    if (cell.unit === 'text') return String(cell.value);
    return fmtNum(cell.value);
};

/** 单元格：行式（label 左 / 值右），保证窄栏也不会把标签折成竖排 */
const FieldRow: React.FC<{
    cell: FieldCell;
    editing: boolean;
    onChange: (v: number | null) => void;
    onStartEdit: () => void;
}> = ({ cell, editing, onChange, onStartEdit }) => {
    const absent = cell.status === 'absent' || cell.status === 'invalid' || cell.status === 'unreadable';
    const dim = !cell.engine;

    return (
        <div
            data-field-key={cell.key}
            data-field-status={cell.status}
            className={clsx(
                'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 border transition-colors',
                absent ? 'bg-black/20 border-dashed border-slate-700' : 'bg-black/40 border-white/5',
                cell.status === 'low_confidence' && 'border-amber-600/40'
            )}
        >
            <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0" title={cell.reason || undefined}>
                {cell.label}
            </span>
            {editing ? (
                <input
                    type="number"
                    autoFocus
                    defaultValue={cell.value === null ? '' : String(cell.value)}
                    onBlur={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-24 bg-black/60 border border-cyan-500/40 rounded px-1.5 py-0.5 text-right font-mono text-xs text-slate-100 outline-none"
                />
            ) : (
                <button
                    type="button"
                    onClick={onStartEdit}
                    className={clsx(
                        'font-mono text-xs whitespace-nowrap shrink-0 cursor-text',
                        absent ? 'text-amber-600/90 font-normal text-[11px]' : dim ? 'text-slate-400 font-normal' : 'text-slate-100 font-bold'
                    )}
                >
                    {absent
                        ? (cell.reason || '未识别 · 点此填写')
                        : withUnit(cell)}
                </button>
            )}
        </div>
    );
};

export const VisionReviewCard: React.FC<VisionReviewCardProps> = ({
    panel,
    onImport,
    onSimulate,
    onArchive,
    onPeek,
    className
}) => {
    const [overrides, setOverrides] = useState<Record<string, number | null>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [archived, setArchived] = useState(false);

    /** 覆盖用户手改的值，并重算引擎快照 */
    const live = useMemo<RecognizedPanel>(() => {
        if (Object.keys(overrides).length === 0) return panel;
        const fields = panel.fields.map(f => {
            if (!(f.key in overrides)) return f;
            const v = overrides[f.key];
            return {
                ...f,
                value: v,
                status: (v === null ? 'absent' : 'ok') as FieldCell['status'],
                source: (v === null ? 'none' : 'user') as FieldCell['source'],
                confidence: v === null ? 0 : 1
            };
        });
        const next = { ...panel, fields };
        next.engine = mapToEngine(next);
        return next;
    }, [panel, overrides]);

    const setField = useCallback((key: string, v: number | null) => {
        setOverrides(prev => ({ ...prev, [key]: v }));
        setEditingKey(null);
    }, []);

    const simulateBlocked = useMemo(() => {
        if (live.degraded) return '识图功能受限，请先手填关键属性';
        if (live.kind === 'character_panel') {
            const missing = live.engine.missingRequired;
            if (missing.length > 0) {
                const zh: Record<string, string> = {
                    CharacterMinAttack: '最小攻',
                    CharacterMaxAttack: '最大攻',
                    CharacterCriticalHitDamagePercent: '致命伤害',
                    CharacterMonsterDamageIncreasePercent: '对怪增伤'
                };
                return `先补齐：${missing.map(m => zh[m] || m).join('、')}`;
            }
            return '算副本秒伤将在下一阶段接入（需选副本 + BOSS）';
        }
        return '该体系暂不支持秒伤推演';
    }, [live]);

    const copyJson = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify({ kind: live.kind, fields: live.fields.map(f => ({ key: f.key, value: f.value, status: f.status })), engine: live.engine }, null, 2));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard 不可用时忽略 */ }
    };

    const headerTitle = live.kind === 'xyc'
        ? [live.xyc?.beast ? `${live.xyc.beast}<${live.xyc.bookName || '策'}>` : '轩辕策', live.xyc?.heroVersion ? '·英雄版' : ''].join('')
        : live.kind === 'tianyuan'
            ? '天缘属性'
            : (live.character?.classRaw || '角色属性面板');

    const factionText = live.character?.factionRaw;

    return (
        <div
            data-testid="vision-review-card"
            data-kind={live.kind}
            data-degraded={live.degraded ? '1' : '0'}
            className={clsx(
                '@container w-full max-w-xl rounded-xl border bg-[#121824] p-3.5 sm:p-4 shadow-md',
                live.degraded ? 'border-amber-600/30' : 'border-cyan-500/20',
                className
            )}
        >
            {/* 头部 */}
            <div className="flex flex-col gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-4 rounded-full bg-cyan-400 shrink-0" />
                        <h4 className="text-[15px] font-black text-slate-100 tracking-wide truncate">{headerTitle}</h4>
                        {factionText && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold border bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shrink-0">
                                {factionText}
                            </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-bold border bg-slate-700/40 border-slate-600/40 text-slate-300 shrink-0">
                            {kindLabel(live.kind)}
                        </span>
                    </div>
                    {live.imageRef && onPeek && (
                        <button
                            type="button"
                            data-action="peek"
                            onClick={() => onPeek(live.imageRef!)}
                            className="text-[11px] text-slate-400 hover:text-cyan-300 shrink-0 transition-colors"
                        >
                            只看原图
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pl-3.5 text-[11px]">
                    {live.character?.levelRaw && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                            {live.character.levelRaw} 级
                        </span>
                    )}
                    {live.xyc?.tier && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-lime-300 border border-lime-700/40 whitespace-nowrap">{live.xyc.tier}</span>
                    )}
                    {typeof live.xyc?.stars === 'number' && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-amber-300 border border-amber-700/40 whitespace-nowrap font-mono">
                            {'★'.repeat(Math.max(0, Math.min(5, live.xyc.stars)))}
                        </span>
                    )}
                    {typeof live.xyc?.washUsed === 'number' && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap font-mono">
                            洗炼 {live.xyc.washUsed}/10
                        </span>
                    )}
                    {!live.degraded && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 whitespace-nowrap font-mono">
                            识别 {live.fields.filter(f => f.status === 'ok').length}/{live.fields.length}
                        </span>
                    )}
                    {live.provider && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 whitespace-nowrap font-mono text-[10px]">
                            {live.provider.replace('cf-workers-ai:', 'cf/')}
                        </span>
                    )}
                </div>
            </div>

            {/* 降级条 */}
            {live.degraded && (
                <div data-testid="vision-degraded" className="mt-3 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-700/30 text-[11px] text-amber-300/90 leading-relaxed">
                    识图功能受限：当前没有可用的视觉模型，下面的数值一个都没有识别到。你可以手工填写，或稍后重试。
                </div>
            )}

            {/* 资源条（仅角色属性面板） */}
            {live.kind === 'character_panel' && live.bars && (live.bars.hpMax || live.bars.mpMax) && (
                <div className="mt-3 flex flex-col gap-1.5">
                    {([
                        ['气血', live.bars.hpCur, live.bars.hpMax, 'from-red-800 to-red-500'],
                        ['真气', live.bars.mpCur, live.bars.mpMax, 'from-blue-800 to-blue-500'],
                        ['第三槽', live.bars.thirdCur, live.bars.thirdMax, 'from-violet-800 to-violet-500']
                    ] as const).map(([label, cur, max, grad]) => (
                        max ? (
                            <div key={label} className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                                    <div
                                        className={clsx('h-full rounded-full bg-gradient-to-r', grad)}
                                        style={{ width: `${Math.max(4, Math.min(100, ((cur || max) / Number(max)) * 100))}%` }}
                                    />
                                </div>
                                <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap min-w-[104px] text-right">
                                    {cur ? `${fmtNum(cur)} / ${fmtNum(max)}` : fmtNum(max)}
                                </span>
                            </div>
                        ) : null
                    ))}
                </div>
            )}

            {/* 字段区：行式，容器查询换列 */}
            <div className={clsx('mt-3 grid gap-x-3.5 gap-y-1', live.kind === 'character_panel' ? 'grid-cols-1 @[480px]:grid-cols-2' : 'grid-cols-1 @[480px]:grid-cols-2')}>
                {live.fields.map(cell => (
                    <FieldRow
                        key={cell.key}
                        cell={cell}
                        editing={editingKey === cell.key}
                        onChange={v => setField(cell.key, v)}
                        onStartEdit={() => setEditingKey(cell.key)}
                    />
                ))}
            </div>

            {/* 轩辕策 tooltip 细节 */}
            {live.kind === 'xyc' && live.advSkill && (live.advSkill.name || live.advSkill.variant) && (
                <div className="mt-3 pt-2.5 border-t border-white/5 text-[11px] text-slate-300">
                    <span className="text-slate-400">（进阶技能）</span>
                    <span className="text-violet-200 font-semibold ml-1">{live.advSkill.name || '—'}</span>
                    {live.advSkill.variant && <span className="text-slate-300 ml-1">《{live.advSkill.variant}》</span>}
                    {typeof live.advSkill.level === 'number' && <span className="text-slate-400 ml-1 font-mono">{live.advSkill.level} 级</span>}
                </div>
            )}

            {/* 词条（若有） */}
            {Array.isArray(live.attrs) && live.attrs.length > 0 && (
                <div className="mt-2 flex flex-col gap-0.5">
                    {live.attrs.map((a, i) => (
                        <div key={i} className="flex items-baseline gap-1.5 text-xs">
                            <span className="text-slate-500 text-[10px]">⊙</span>
                            <span className="text-slate-300 min-w-[76px]">{a.name}</span>
                            <span className="font-mono font-bold text-slate-100">{a.value}</span>
                            {a.wash && <span className="font-mono text-[11px] text-emerald-400">({a.wash})</span>}
                            {a.extra && <span className="font-mono text-[11px] text-rose-400">({a.extra})</span>}
                        </div>
                    ))}
                </div>
            )}

            {/* 未进卡项计数 */}
            {live.extraCount > 0 && (
                <div className="mt-2 text-[11px] text-slate-500 pl-0.5">
                    另有 {live.extraCount} 项已记录（不参与计算）
                </div>
            )}

            {/* 校验提示 */}
            {live.issues.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600/90 leading-relaxed">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{live.issues.slice(0, 3).join('；')}</span>
                </div>
            )}

            {/* 隐藏 JSON：给本地 e2e 断言用，不占视觉 */}
            <pre data-testid="panel-json" className="hidden">{JSON.stringify({ kind: live.kind, fields: live.fields.map(f => ({ k: f.key, v: f.value, s: f.status })), engine: live.engine })}</pre>

            {/* 操作区 */}
            <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={copyJson}
                    className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 text-[11px] flex items-center gap-1.5 transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已复制' : '复制 JSON'}</span>
                </button>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        data-action="simulate"
                        data-disabled-reason={onSimulate ? undefined : simulateBlocked}
                        disabled={!onSimulate}
                        onClick={() => onSimulate?.(live)}
                        title={onSimulate ? '按当前面板与所选副本来算' : simulateBlocked}
                        className={clsx(
                            'px-3 py-1.5 rounded-lg text-xs border transition-colors',
                            onSimulate
                                ? 'bg-cyan-600/20 hover:bg-cyan-600/40 border-cyan-500/30 text-cyan-200'
                                : 'bg-white/3 border-white/6 text-slate-500 cursor-not-allowed'
                        )}
                    >
                        算副本秒伤
                    </button>
                    <button
                        type="button"
                        data-action="import"
                        onClick={() => onImport?.(live)}
                        className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <span>带入计算器</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        data-action="archive"
                        onClick={() => { onArchive?.(live); setArchived(true); }}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs transition-colors"
                    >
                        {archived ? '已存' : '存为档案'}
                    </button>
                </div>
            </div>

            {/* 提示行：为什么不能算 */}
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                <Sliders className="w-3 h-3" />
                <span>点任意数值可直接改；改完引擎快照即时重算</span>
            </div>
        </div>
    );
};

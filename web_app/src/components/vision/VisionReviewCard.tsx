import React, { useCallback, useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Copy, Check, ArrowRight, Info, AlertTriangle } from 'lucide-react';
import type { FieldCell, RecognizedPanel } from '../../services/vision/types';
import { fieldDef } from '../../services/vision/fieldRegistry';
import { DataService } from '../../services/DataService';
import {
    buildXycCeiling,
    buildTianyuanCeiling,
    fmtCeilingValue,
    worstRow,
    type CeilingReport
} from '../../services/vision/ceiling';
import { mapToEngine } from '../../services/vision/mapToEngine';
import { classCoverage } from '../../services/vision/classCoverage';
import {
    runPanelSimulation,
    resolveDefaultBuffs,
    COMBAT_BUFF_LABELS,
    type CalculationTrace,
    type CombatBuffs,
    type SimTarget
} from '../../services/vision/runPanelSimulation';
import { DungeonBossPicker } from './DungeonBossPicker';
import { GAME_COLORS, getRefineLevelColor } from '../../constants/gameColorSystem';

/** 与轩辕策信息卡（XycTomeDetailCard）同字体：游戏 tooltip 版式 */
const FONT_SONG = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';
/** 括号内红色差异值：取项目内既有「彰武红」，纯 #ff0000 在深底过刺 */
const BRACKET_RED = '#ff4d4f';
/** 角色面板数值色：对齐游戏 C 界面的青蓝（不是轩辕策 tooltip 的 #8080ff 紫蓝） */
const PANEL_CYAN = '#63d2ea';

/**
 * 虚线可点改的单元格：与角色面板那套一致（点数字 → 输入框，Enter/失焦提交，Esc 取消）。
 * 天缘 / 轩辕策的「天命+N、词条值、等级、品阶」都走它，避免每处写一遍输入框。
 */
function InlineEdit({
    value,
    display,
    onCommit,
    kind = 'text',
    width = '4.5rem',
    className,
    style,
    title,
    align = 'right',
    variant = 'underline'
}: {
    value: string | number | null | undefined;
    /** 非编辑态的展示文本（默认 = value）；编辑框里仍只放裸值，避免把括号一起改进去 */
    display?: string;
    onCommit: (v: string) => void;
    kind?: 'text' | 'number';
    width?: string;
    className?: string;
    /** 只给非编辑态（徽章配色用，编辑框里不该带等级色） */
    style?: React.CSSProperties;
    title?: string;
    align?: 'left' | 'right';
    /** underline = 下底虚线（正文数值）；badge = 带底色的胶囊（天缘的「天命+N」这种标签） */
    variant?: 'underline' | 'badge';
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    if (editing) {
        return (
            <input
                autoFocus
                type={kind === 'number' ? 'number' : 'text'}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={() => { setEditing(false); onCommit(draft); }}
                onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(false);
                }}
                className={clsx(
                    'bg-black/60 border border-cyan-500/40 rounded px-1 py-0 font-mono text-[11px] text-slate-100 outline-none',
                    align === 'right' ? 'text-right' : 'text-left',
                    className
                )}
                style={{ width }}
            />
        );
    }
    const shown = display ?? (value === null || value === undefined || value === '' ? '—' : String(value));
    return (
        <button
            type="button"
            onClick={() => { setDraft(String(value ?? '')); setEditing(true); }}
            title={title || '点此修改'}
            style={style}
            className={clsx(
                'cursor-text whitespace-nowrap',
                variant === 'badge'
                    ? 'px-1.5 py-[1px] rounded border transition-colors'
                    : 'border-b border-dashed border-white/25 hover:border-cyan-400/80',
                align === 'right' ? 'text-right' : 'text-left',
                className
            )}
        >
            {shown}
        </button>
    );
}

/**
 * 「怎么截图才识别得准」——识图翻车时最有用的一块。
 * 贴在降级 / 算不出差距的位置：玩家不知道要截哪块区域，是这类问题最大的来源。
 */
/** 全屏截图 / 超宽长图的判定：面积过大或长宽比失衡，模型会把界面文字一起读进来 */
function isImageTooBig(size?: { w: number; h: number } | null): boolean {
    if (!size) return false;
    return size.w * size.h > 2_600_000 || Math.max(size.w, size.h) / Math.max(1, Math.min(size.w, size.h)) > 2.2;
}

function CaptureGuide({ defaultOpen = false, size }: { defaultOpen?: boolean; size?: { w: number; h: number } | null }) {
    const tooBig = isImageTooBig(size);
    return (
        <details
            open={defaultOpen}
            data-testid="vision-capture-guide"
            className="mt-2.5 rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2"
        >
            <summary className="cursor-pointer text-[11.5px] font-bold text-slate-300 select-none">
                怎么截图才识别得准（点开看）
                {tooBig && <span className="ml-1.5 text-amber-400 font-normal">· 这张图范围偏大</span>}
            </summary>
            {tooBig && size && (
                <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-400 leading-snug">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>这张图 {size.w}×{size.h}，范围偏大：模型会把界面文字一起读进来，小字也更容易糊。建议只截面板那一块再发。</span>
                </div>
            )}
            <ul className="mt-1.5 flex flex-col gap-1 text-[11px] text-slate-400 leading-snug list-disc pl-4">
                <li><span className="text-slate-300 font-bold">一张图只截一个面板</span>：裁到面板边缘，别带聊天框 / 背包 / 地面背景。</li>
                <li><span className="text-slate-300 font-bold">角色属性</span>：C 键面板，要含顶部「气血 / 真气」条 + 下面 5 行（攻击…技能躲闪）。</li>
                <li><span className="text-slate-300 font-bold">天缘</span>：要含标题「上玄佑万辰须弥甲/刃/盔」+「天缘+N」+ 全部「天命+N 属性 值」行。掉落预览图没有天缘等级，算不了差距。</li>
                <li><span className="text-slate-300 font-bold">轩辕策</span>：要含书名（青龙〈青囊玉书〉·英雄版）+ 品阶星级 + 洗炼次数 + 等级 + 全部属性行与进阶技能。</li>
                <li>字太小就把游戏界面拉窄放大再截；长边别超过 1600px，超了会被压缩反而更糊。</li>
            </ul>
        </details>
    );
}

export interface VisionReviewCardProps {
    panel: RecognizedPanel;
    /** 带入计算器：只写有值的项，缺项不覆盖 */
    onImport?: (panel: RecognizedPanel) => void;
    /** 算副本秒伤（战力指数） */
    onSimulate?: (panel: RecognizedPanel) => void;
    /** 轩辕策：带 seed 打开模拟器（系别 / 普通·英雄 / 品阶 / 进阶技能） */
    onOpenXyc?: (seed: { beast?: string; isHero?: boolean; level?: number; advSkill?: RecognizedPanel['advSkill'] }) => void;
    /** 天缘：新天缘（上玄佑万…）带 seed 打开词条池；旧天缘交给旧天缘图鉴 */
    onOpenTianyuan?: (seed: { groupName?: string; level?: number; name?: string; isNew: boolean }) => void;
    onPeek?: (image: string) => void;
    className?: string;
}

const fmtNum = (v: number | string | null): string => {
    if (v === null || v === '') return '—';
    if (typeof v === 'string') return v;
    return v.toLocaleString();
};

/**
 * 通道回执的可读化：把 `cf-workers-ai:@cf/mistralai/mistral-small-3.1-24b-instruct: … | …`
 * 拆成一条通道一行，并去掉前缀，只留模型短名。诊断要留，但玩家不该被裸 provider 串糊脸。
 */
const prettyIssues = (issues: string[]): string[] =>
    issues
        .flatMap(s => String(s).split(/\s+\|\s+/))
        .map(s => s.replace(/^[a-z][a-z0-9-]*:@cf\/[^/]+\//i, '').replace(/-instruct\b/g, ''))
        .filter(Boolean);

const withUnit = (cell: FieldCell): string => {
    if (cell.value === null || cell.value === '') return '';
    if (cell.unit === 'percent') return `${cell.value}%`;
    if (cell.unit === 'text') return String(cell.value);
    return fmtNum(cell.value);
};

/**
 * 游戏面板行（1:1）：左侧标签、右侧数值，无外框，行间一条极淡分隔线。
 * 观感对齐游戏 C 界面——两列、标签左、数值右、同一行左右并排。
 */
const GameRow: React.FC<{
    cell: FieldCell;
    editing: boolean;
    onChange: (v: number | null) => void;
    onStartEdit: () => void;
    span?: boolean;
}> = ({ cell, editing, onChange, onStartEdit, span }) => {
    const absent = cell.status === 'absent' || cell.status === 'unreadable';
    const bad = cell.status === 'invalid';
    const dim = !cell.engine;
    // 游戏里所有数值都是青蓝；不参与计算的那几项降透明度，一眼分主次
    const valueColor = bad
        ? BRACKET_RED
        : absent
            ? '#d99a3c'
            : dim
                ? 'rgba(99,210,234,0.5)'
                : PANEL_CYAN;

    return (
        <div
            data-field-key={cell.key}
            data-field-status={cell.status}
            className={clsx(
                'flex items-center justify-between gap-1.5 @[400px]:gap-2 min-w-0 px-0.5 py-[3px] border-b border-white/[0.04]',
                span && 'col-span-full'
            )}
            style={{ fontFamily: FONT_SONG, letterSpacing: '0.3px' }}
        >
            <span
                className="whitespace-nowrap shrink-0 text-[12px] @[400px]:text-[13px]"
                style={{ color: GAME_COLORS.WHITE }}
                title={cell.reason || undefined}
            >
                {cell.label}
            </span>
            {editing ? (
                <input
                    type="number"
                    autoFocus
                    defaultValue={cell.value === null ? '' : String(cell.value)}
                    onBlur={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    className="w-16 @[400px]:w-24 bg-black/60 border border-cyan-500/40 rounded px-1.5 py-0.5 text-right font-mono text-xs text-slate-100 outline-none"
                />
            ) : dim ? (
                /* 不参与伤害计算：只展示、不给改（改了也不影响结果，给入口反而误导） */
                <span
                    className="font-mono whitespace-nowrap shrink-0 text-right text-[12px] @[400px]:text-[13px]"
                    style={{ color: bad ? BRACKET_RED : 'rgba(99,210,234,0.42)' }}
                    title={cell.raw ? `原文「${cell.raw}」· 该项不参与伤害计算` : '该项不参与伤害计算'}
                >
                    {absent ? '—' : withUnit(cell)}
                </span>
            ) : (
                <button
                    type="button"
                    onClick={onStartEdit}
                    title={cell.reason || (cell.raw ? `原文「${cell.raw}」` : '点此填写')}
                    className={clsx(
                        // min-w-0 + truncate：移动端两列窄容器里「点此填写」不得把整行顶出卡外
                        'font-mono whitespace-nowrap shrink-0 min-w-0 overflow-hidden text-ellipsis cursor-text text-right pb-[1px]',
                        'border-b border-dashed transition-colors text-[12px] @[400px]:text-[13px]',
                        bad
                            ? 'border-rose-400/60 hover:border-rose-300'
                            : absent
                                ? 'text-[11px] @[400px]:text-[12px] border-amber-500/50 hover:border-amber-300'
                                : 'font-bold border-white/20 hover:border-cyan-400/80'
                    )}
                    style={{ color: valueColor }}
                >
                    {absent ? (cell.reason || '点此填写') : withUnit(cell)}
                </button>
            )}
        </div>
    );
};

/** 攻击 min–max 合并行：对齐游戏「攻击: 12559-13172」一格显示，两个数字各自可改 */
const AttackRangeRow: React.FC<{
    min: FieldCell;
    max?: FieldCell;
    editingKey: string | null;
    onEdit: (key: string | null) => void;
    onChange: (key: string, v: number | null) => void;
}> = ({ min, max, editingKey, onEdit, onChange }) => {
    const bad = min.status === 'invalid' || max?.status === 'invalid';
    const num = (cell?: FieldCell) => {
        if (!cell || cell.value === null) return '—';
        return fmtNum(cell.value);
    };
    const editor = (cell: FieldCell) => (
        <input
            type="number"
            autoFocus
            defaultValue={cell.value === null ? '' : String(cell.value)}
            onBlur={e => onChange(cell.key, e.target.value === '' ? null : Number(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="w-14 @[400px]:w-20 bg-black/60 border border-cyan-500/40 rounded px-1 py-0.5 text-right font-mono text-xs text-slate-100 outline-none"
        />
    );

    return (
        <div
            data-field-key="attackRange"
            data-field-status={bad ? 'invalid' : min.status}
            className="flex items-center justify-between gap-2 min-w-0 px-0.5 py-[3px] border-b border-white/[0.04]"
            style={{ fontFamily: FONT_SONG, letterSpacing: '0.3px' }}
        >
            <span className="whitespace-nowrap shrink-0 text-[12px] @[400px]:text-[13px]" style={{ color: GAME_COLORS.WHITE }}>
                攻击
            </span>
            <span className="flex items-baseline gap-0.5 shrink-0 font-mono text-[12px] @[400px]:text-[13px] font-bold" style={{ color: bad ? BRACKET_RED : PANEL_CYAN }}>
                {min && editingKey === min.key ? editor(min) : (
                    <button type="button" onClick={() => onEdit(min.key)} className="cursor-text border-b border-dashed border-white/20 hover:border-cyan-400/80 transition-colors" title="点此修改最小攻">
                        {num(min)}
                    </button>
                )}
                <span className="px-0.5 opacity-70">-</span>
                {max && editingKey === max.key ? editor(max) : (
                    <button type="button" onClick={() => max && onEdit(max.key)} className="cursor-text border-b border-dashed border-white/20 hover:border-cyan-400/80 transition-colors" title="点此修改最大攻">
                        {num(max)}
                    </button>
                )}
            </span>
        </div>
    );
};

export const VisionReviewCard: React.FC<VisionReviewCardProps> = ({
    panel,
    onImport,
    onSimulate,
    onOpenXyc,
    onOpenTianyuan,
    onPeek,
    className
}) => {
    const [overrides, setOverrides] = useState<Record<string, number | null>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    /** 天缘 / 轩辕策的标题级信息（部位、天命等级、四系、版本、品阶、等级、洗炼次数）手改覆盖 */
    const [meta, setMeta] = useState<{
        part?: string; tianyuanLevel?: number;
        beast?: string; heroVersion?: boolean; tier?: string; level?: number; washUsed?: number; stars?: number;
    }>({});
    /** 词条行手改（按行号），只覆盖展示用的文本 / 天命档 */
    const [attrEdits, setAttrEdits] = useState<Record<number, { name?: string; value?: string; tianming?: number; wash?: string; extra?: string }>>({});
    const patchMeta = useCallback((patch: Record<string, unknown>) => setMeta(prev => ({ ...prev, ...patch })), []);
    const patchAttr = useCallback((idx: number, patch: { name?: string; value?: string; tianming?: number; wash?: string; extra?: string }) => {
        setAttrEdits(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), ...patch } }));
    }, []);

    /** 覆盖用户手改的值，并重算引擎快照 */
    const live = useMemo<RecognizedPanel>(() => {
        const hasFieldOv = Object.keys(overrides).length > 0;
        const hasMeta = Object.keys(meta).length > 0;
        const hasAttr = Object.keys(attrEdits).length > 0;
        if (!hasFieldOv && !hasMeta && !hasAttr) return panel;
        const fields = hasFieldOv
            ? panel.fields.map(f => {
                if (!(f.key in overrides)) return f;
                const v = overrides[f.key];
                return {
                    ...f,
                    value: v,
                    status: (v === null ? 'absent' : 'ok') as FieldCell['status'],
                    source: (v === null ? 'none' : 'user') as FieldCell['source'],
                    confidence: v === null ? 0 : 1
                };
            })
            : panel.fields;
        const attrs = hasAttr
            ? (panel.attrs || []).map((a, i) => ({ ...a, ...(attrEdits[i] || {}) }))
            : panel.attrs;
        const next: RecognizedPanel = { ...panel, fields, attrs };
        if (panel.kind === 'xyc') next.xyc = { ...panel.xyc, ...meta };
        if (panel.kind === 'tianyuan') next.tianyuan = { ...panel.tianyuan, ...meta };
        next.engine = mapToEngine(next);
        return next;
    }, [panel, overrides, meta, attrEdits]);

    const setField = useCallback((key: string, v: number | null) => {
        setOverrides(prev => ({ ...prev, [key]: v }));
        setEditingKey(null);
    }, []);

    /**
     * 满属性对照：按图里声称的等级 / 天缘+N 折算上限。
     * 数据走 DataService 的缓存（xyc_refine 214KB / new_tianyuan_data 24KB），只在需要时拉。
     */
    const [ceiling, setCeiling] = useState<CeilingReport | null>(null);
    const attrsKey = useMemo(
        // 天命档也要进 key：改「天命+N」会改上限，不进 key 就不会重算
        () => (live.attrs || []).map(a => `${a.name}${a.value}#${a.tianming ?? ''}`).join('|'),
        [live.attrs]
    );
    useEffect(() => {
        let alive = true;
        setCeiling(null);
        const ds = DataService.getInstance();
        (async () => {
            try {
                if (live.kind === 'xyc') {
                    const data = await ds.getXycRefine();
                    if (alive) setCeiling(buildXycCeiling(live, data));
                } else if (live.kind === 'tianyuan') {
                    const data = await ds.getNewTianYuanData();
                    if (alive) setCeiling(buildTianyuanCeiling(live, data));
                }
            } catch (e) {
                console.warn('满属性数据加载失败，跳过差距计算', e);
            }
        })();
        return () => { alive = false; };
    }, [live.kind, attrsKey, live.xyc?.level, live.xyc?.heroVersion, live.xyc?.tier, live.xyc?.beast, live.tianyuan?.tianyuanLevel, live.tianyuan?.part, live.tianyuan?.name]);

    const ceilingWorst = useMemo(() => worstRow(ceiling), [ceiling]);

    /** 原图尺寸：用来判断「这是不是一张范围过大的全屏截图」 */
    const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
    useEffect(() => {
        const src = panel.imageRef;
        if (!src || !src.startsWith('data:')) return;
        const img = new Image();
        img.onload = () => setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = src;
        return () => { img.onload = null; };
    }, [panel.imageRef]);

    // 职业覆盖：技能池为空（如昭冥·仙）直接禁用，绝不借其它职业技能
    const coverage = useMemo(
        () => (live.kind === 'character_panel'
            ? classCoverage(live.character?.classRaw, live.character?.factionRaw)
            : null),
        [live.kind, live.character?.classRaw, live.character?.factionRaw]
    );

    const [target, setTarget] = useState<SimTarget | null>(null);

    /** 副本默认 T17：选择器保持原样（仍显示「请选择」），但逻辑上不必选，不选就按 T17 算 */
    const defaultTarget = useMemo<SimTarget | null>(() => {
        try {
            const svc = DataService.getInstance();
            const list = svc.getDungeons() || [];
            const d = list.find(x => String(x.DungeonName || '').includes('T17'));
            if (!d) return null;
            const mons = (svc.getDungeonsMonsters() || {})[d.DungeonID] || [];
            const boss: any = mons.find((m: any) => m.role !== 'add') || mons[0];
            if (!boss) return null;
            return {
                dungeonId: d.DungeonID,
                dungeonName: d.DungeonName,
                bossId: boss.MonsterID,
                bossName: boss.MonsterName || boss.MonsterID
            };
        } catch {
            return null;
        }
    }, []);
    const effectiveTarget = target ?? defaultTarget;
    const [buffs, setBuffs] = useState<CombatBuffs>(() => resolveDefaultBuffs());
    const [sim, setSim] = useState<{ running: boolean; trace?: CalculationTrace; error?: string }>({ running: false });

    const missingZh: Record<string, string> = {
        CharacterMinAttack: '最小攻',
        CharacterMaxAttack: '最大攻',
        CharacterCriticalHitDamagePercent: '致命伤害',
        CharacterMonsterDamageIncreasePercent: '对怪增伤'
    };

    /** 禁用理由（按优先级）：降级 → 体系 → 职业覆盖 → 缺字段 → 未选副本 */
    const blockedReason = useMemo(() => {
        if (live.degraded) return '识图功能受限，请先手填关键属性';
        if (live.kind !== 'character_panel') return '该体系暂不支持秒伤推演';
        if (live.character?.classUnknown) return '职业未识别，请先在计算器里手动选职业';
        if (coverage && !coverage.ok) return coverage.reason || '职业 / 阵营不可用';
        const missing = live.engine.missingRequired;
        if (missing.length > 0) return `先补齐：${missing.map(m => missingZh[m] || m).join('、')}`;
        return null;
    }, [live, coverage]);

    const doSimulate = useCallback(() => {
        if (blockedReason || !effectiveTarget) return;
        setSim({ running: true });
        try {
            const out = runPanelSimulation(live, effectiveTarget, buffs);
            if (out.ok) setSim({ running: false, trace: out.trace });
            else setSim({ running: false, error: out.message });
        } catch (e: any) {
            setSim({ running: false, error: e?.message || '引擎计算失败' });
        }
    }, [blockedReason, effectiveTarget, live, buffs]);

    const fmtBig = (n: number): string => {
        if (!Number.isFinite(n)) return '—';
        if (n >= 1e8) return `${(n / 1e8).toFixed(2)} 亿`;
        if (n >= 1e4) return `${(n / 1e4).toFixed(1)} 万`;
        return n.toLocaleString();
    };

    /** 复制属性数据：给人看的纯文本（可直接贴群里/存档），不是给程序看的 JSON */
    const copyAttrs = async () => {
        try {
            const lines: string[] = [];
            const who = [live.character?.classRaw, live.character?.factionRaw].filter(Boolean).join('·');
            if (who) lines.push(`${who}${live.character?.levelRaw ? ` ${live.character.levelRaw} 级` : ''}`);
            if (live.kind === 'xyc') {
                const t = [
                    live.xyc?.beast ? `${live.xyc.beast}策` : '',
                    live.xyc?.tier || '',
                    live.xyc?.heroVersion ? '英雄版' : ''
                ].filter(Boolean).join(' ');
                if (t) lines.push(t);
            }
            for (const a of live.attrs || []) {
                lines.push(`${a.name} ${a.value}${a.wash ? `(${a.wash})` : ''}`);
            }
            if (live.kind === 'character_panel') {
                if (live.bars?.hpMax) lines.push(`气血 ${live.bars.hpMax}`);
                if (live.bars?.mpMax) lines.push(`真气 ${live.bars.mpMax}`);
            }
            for (const item of gridItems) {
                if (item.type === 'attack') {
                    lines.push(`攻击 ${fmtNum(attackMin?.value ?? null)}-${fmtNum(attackMax?.value ?? null)}`);
                    continue;
                }
                if (item.cell.value === null || item.cell.value === '') continue;
                lines.push(`${item.cell.label} ${withUnit(item.cell)}`);
            }
            for (const b of COMBAT_BUFF_LABELS) {
                lines.push(`${b.label} ${buffs[b.key]}${b.unit}`);
            }
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard 不可用时忽略 */ }
    };

    /**
     * 角色面板的栅格：按游戏行序两列排；攻击 min–max 合并成一格；
     * 气血/真气永久由顶部资源条承担 —— 资源条现在是常驻的（没识别到也能点着填），
     * 栅格里再放一份「气血上限 / 真气上限」就是重复且挤爆窄容器。
     */
    const gridItems = useMemo(() => {
        if (live.kind !== 'character_panel') {
            // 天缘：名称/部位已经上了新 body（部位 tab + 金色标题），栅格里再列一遍就是重复
            if (live.kind === 'tianyuan') return [];
            return live.fields
                .filter(f => live.kind === 'xyc'
                    ? (f.key === 'level' || f.status !== 'ok')
                    : (f.status === 'ok' || f.status === 'low_confidence'))
                .map(f => ({ type: 'single' as const, cell: f, span: false }));
        }
        const items: Array<{ type: 'single'; cell: FieldCell; span: boolean } | { type: 'attack' }> = [];
        const skipped = new Set<string>();
        for (const cell of live.fields) {
            const def = fieldDef(live.kind, cell.key);
            if (def?.hideInGrid) continue;
            if (skipped.has(cell.key)) continue;
            if (cell.key === 'attackMin') {
                const maxCell = live.fields.find(f => f.key === 'attackMax');
                if (maxCell) skipped.add('attackMax');
                items.push({ type: 'attack' });
                continue;
            }
            items.push({ type: 'single', cell, span: Boolean(def?.manual) });
        }
        return items;
    }, [live]);

    const attackMin = live.fields.find(f => f.key === 'attackMin');
    const attackMax = live.fields.find(f => f.key === 'attackMax');

    const headerTitle = live.kind === 'xyc'
        ? [live.xyc?.beast ? `${live.xyc.beast}<${live.xyc.bookName || '策'}>` : '轩辕策', live.xyc?.heroVersion ? '·英雄版' : ''].join('')
        : live.kind === 'tianyuan'
            ? (live.tianyuan?.name || '天缘属性')
            : (live.character?.classRaw || '角色属性面板');

    const factionText = live.character?.factionRaw;
    const classUnknown = Boolean(live.character?.classUnknown);

    /** 新天缘判定（用户口径）：识别成「上玄佑万」就是新天缘，其余走旧天缘。
        OCR 常把「上玄佑」读成「上古佑」（实测），所以「万辰」也算命中，否则新天缘会被送去旧图鉴。 */
    const tianyuanName = live.tianyuan?.name || String(live.fields.find(f => f.key === 'name')?.value ?? '');
    const tianyuanPart = live.tianyuan?.part || String(live.fields.find(f => f.key === 'part')?.value ?? '');
    const isNewTianyuan = live.kind === 'tianyuan'
        && (/上玄佑万|万辰/.test(tianyuanName) || /上玄佑万|万辰/.test(tianyuanPart));

    /** 天缘等级色：与新天缘模拟器同一套炼器色阶（+0 白 … +10 黄绿），玩家认过的颜色不能变 */
    const tianyuanLevel = typeof live.tianyuan?.tianyuanLevel === 'number' ? live.tianyuan.tianyuanLevel : 0;
    const tianyuanLevelColor = getRefineLevelColor(tianyuanLevel);

    return (
        <div
            data-testid="vision-review-card"
            data-kind={live.kind}
            data-degraded={live.degraded ? '1' : '0'}
            data-class-unknown={classUnknown ? '1' : '0'}
            className={clsx(
                '@container w-full max-w-md rounded-xl border bg-[#121824] p-3.5 sm:p-4 shadow-md',
                live.degraded ? 'border-amber-600/30' : 'border-cyan-500/20',
                className
            )}
        >
            {/* 头部：天缘卡的金色标题、天缘等级、逐行天命档都由下方 body 承担，
                再叠一层同名头部就是纯重复 —— 非降级态只保留「只看原图」入口 */}
            {live.kind === 'tianyuan' && !live.degraded ? (
                live.imageRef && onPeek ? (
                    <div className="flex justify-end">
                        <button
                            type="button"
                            data-action="peek"
                            onClick={() => onPeek(live.imageRef!)}
                            className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
                        >
                            只看原图
                        </button>
                    </div>
                ) : null
            ) : (
            <div className="flex flex-col gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-1.5 h-4 rounded-full bg-cyan-400 shrink-0" />
                        <h4
                            className="text-[15px] font-black text-slate-100 tracking-wide truncate"
                            style={live.kind === 'xyc' ? { fontFamily: FONT_SONG, color: '#ffd272' } : undefined}
                        >
                            {headerTitle}
                        </h4>
                        {classUnknown && (
                            <span
                                data-testid="class-unknown"
                                className="px-1.5 py-0.5 rounded text-[11px] font-bold border bg-rose-500/15 border-rose-500/50 text-rose-300 shrink-0 flex items-center gap-1"
                            >
                                <AlertTriangle className="w-3 h-3" />
                                职业未识别
                            </span>
                        )}
                        {factionText && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold border bg-cyan-500/15 border-cyan-500/40 text-cyan-300 shrink-0">
                                {factionText}
                            </span>
                        )}
                        {live.tianyuan?.suffix && (
                            <span className="px-1.5 py-0.5 rounded text-[11px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shrink-0">
                                {live.tianyuan.suffix}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {live.imageRef && onPeek && (
                            <button
                                type="button"
                                data-action="peek"
                                onClick={() => onPeek(live.imageRef!)}
                                className="text-[11px] text-slate-400 hover:text-cyan-300 transition-colors"
                            >
                                只看原图
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pl-3.5 text-[11px]">
                    {live.character?.levelRaw && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap">
                            {live.character.levelRaw} 级
                        </span>
                    )}
                    {live.xyc?.tier && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-200 border border-cyan-500/50 whitespace-nowrap font-bold">{live.xyc.tier}</span>
                    )}
                    {typeof live.xyc?.stars === 'number' && (
                        <span
                            className="px-1.5 py-0.5 rounded bg-slate-800/60 border border-slate-700/50 whitespace-nowrap tracking-[1px]"
                            style={{ color: GAME_COLORS.GOLD_AMBER }}
                        >
                            {'★'.repeat(Math.max(0, Math.min(10, live.xyc.stars)))}
                        </span>
                    )}
                    {typeof live.xyc?.washUsed === 'number' && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300 border border-slate-700/50 whitespace-nowrap font-mono">
                            洗炼 {live.xyc.washUsed}/10
                        </span>
                    )}
                    {live.kind === 'tianyuan' && typeof live.tianyuan?.tianyuanLevel === 'number' && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-lime-300 border border-lime-700/40 whitespace-nowrap font-mono">
                            天缘 +{live.tianyuan.tianyuanLevel}
                        </span>
                    )}
                    {!live.degraded && (live.kind === 'tianyuan' ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 whitespace-nowrap font-mono">
                            天命 ×{live.attrs?.length ?? 0}
                        </span>
                    ) : (
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/50 whitespace-nowrap font-mono">
                            识别 {live.fields.filter(f => f.status === 'ok' || f.status === 'low_confidence').length}/{live.fields.length}
                        </span>
                    ))}
                </div>
            </div>
            )}

            {/* 降级条：说清「为什么一个数都没采信」，不再一律甩一句「没有可用的视觉模型」 */}
            {live.degraded && (
                <div data-testid="vision-degraded" className="mt-3 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-700/30 text-[11px] text-amber-300/90 leading-relaxed">
                    {live.degradedReason === 'non_standard'
                        ? '这张图没通过「标准面板」校验，所以一个数值都没有采信。下面的空卡可以手工填写，或截完整面板（含顶部气血真气条 / 全部天命词条行）重传。'
                        : live.degradedReason === 'no_key'
                            ? '服务端没配置视觉模型通道，这次没有识别到任何数值。下面的空卡可以手工填写。'
                            : '识图通道这次没拿到结果（超时 / 额度 / 解析失败），一个数值都没有采信。下面的空卡可以手工填写，或稍后重试。'}
                </div>
            )}

            {/* 降级时直接把「怎么截」摊开：这是玩家最需要的一条信息 */}
            {live.degraded && <CaptureGuide defaultOpen size={imgSize} />}

            {/* 职业未识别：带入时职业会置空，必须先说清楚 */}
            {classUnknown && (
                <div
                    data-testid="vision-class-unknown"
                    className="mt-3 px-3 py-2 rounded-lg bg-rose-950/30 border border-rose-700/40 text-[11px] text-rose-200/90 leading-relaxed flex items-start gap-1.5"
                >
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                        图里的职业名「{live.character?.classRaw}」在职业表里找不到（多半是识别错了）。
                        带入计算器时<b className="text-rose-100">职业会被置空</b>，请在右侧手动选一次职业，否则秒伤算不了。
                    </span>
                </div>
            )}

            {/* 资源条（仅角色属性面板）：数值居中压在条内，对齐游戏 C 界面。
                气血/真气是引擎必填项，条**常驻**——没识别到时给一条空条也能点着填上限，
                否则这两项既没条、又在栅格里被 hideInGrid 掉，等于无处可填。
                「当前值」不参与伤害计算、只决定条长，所以不给改；点数字改的是「上限」（进引擎）。 */}
            {live.kind === 'character_panel' && (
                <div className="mt-3 flex flex-col gap-1">
                    {([
                        ['气血', live.bars?.hpCur, live.bars?.hpMax, 'from-red-950/95 via-red-800/90 to-red-600/85', 'health'],
                        ['真气', live.bars?.mpCur, live.bars?.mpMax, 'from-blue-950/95 via-blue-800/90 to-blue-600/85', 'mana'],
                        ['第三槽', live.bars?.thirdCur, live.bars?.thirdMax, 'from-violet-950/95 via-violet-800/90 to-violet-600/85', '']
                    ] as const).map(([label, cur, max, grad, fieldKey]) => {
                        const cell = fieldKey ? live.fields.find(f => f.key === fieldKey) : undefined;
                        // 第三槽没数据就不占位；气血/真气有 cell 就必须出条（哪怕是空的）
                        if (!max && !cell) return null;
                        const editing = Boolean(cell && editingKey === cell.key);
                        const bad = cell?.status === 'invalid';
                        const empty = !max;
                        const pct = empty ? 0 : Math.max(4, Math.min(100, ((cur || max) / Number(max)) * 100));
                        return (
                            <div
                                key={label}
                                data-field-key={fieldKey || undefined}
                                data-field-status={cell?.status}
                                data-bar={label}
                                title={empty ? `${label}：未识别，点此填写上限` : `${label}：${fmtNum(cur || max)} / ${fmtNum(max)}`}
                                className="relative h-7 @[420px]:h-[21px] rounded-full bg-white/[0.04] border border-white/10 overflow-hidden"
                            >
                                <div
                                    className={clsx('absolute inset-y-0 left-0 bg-gradient-to-r', grad)}
                                    style={{ width: `${pct}%` }}
                                />
                                {editing && cell ? (
                                    <input
                                        type="number"
                                        autoFocus
                                        defaultValue={cell.value === null ? '' : String(cell.value)}
                                        onBlur={e => setField(cell.key, e.target.value === '' ? null : Number(e.target.value))}
                                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                        className="absolute inset-0 w-full bg-black/85 px-2 text-center font-mono text-[11px] font-bold text-slate-100 outline-none"
                                    />
                                ) : empty ? (
                                    <button
                                        type="button"
                                        disabled={!cell}
                                        onClick={() => cell && setEditingKey(cell.key)}
                                        title={`${label}上限未识别，点此填写（进引擎的值）`}
                                        className="absolute inset-0 min-h-0 flex items-center justify-center px-2 whitespace-nowrap font-mono leading-none"
                                        style={{ fontFamily: FONT_SONG }}
                                    >
                                        <span
                                            className="text-[11px] pb-[1px] border-b border-dashed"
                                            style={{
                                                color: bad ? BRACKET_RED : '#d99a3c',
                                                borderColor: bad ? 'rgba(251,113,133,0.6)' : 'rgba(217,154,60,0.55)'
                                            }}
                                        >
                                            {label}未识别 · 点此填写上限
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        disabled={!cell}
                                        onClick={() => cell && setEditingKey(cell.key)}
                                        title={cell ? '点数字可改「上限」' : undefined}
                                        className={clsx(
                                            // min-h-0 必须有：移动端全局有 button{min-height:28px}，
                                            // 撑高后居中基准变成 28px，数字会被压到条底并被 overflow 裁掉
                                            'absolute inset-0 min-h-0 flex items-center justify-center gap-1 px-2 whitespace-nowrap font-mono leading-none',
                                            cell ? 'cursor-text' : 'cursor-default'
                                        )}
                                        style={{ fontFamily: FONT_SONG, textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                                    >
                                        <span className="font-mono text-[11px]" style={{ color: bad ? BRACKET_RED : '#ffffff' }}>
                                            {cur ? String(cur) : '—'}
                                        </span>
                                        <span className="text-[11px] text-white/45">/</span>
                                        <span
                                            className="font-mono text-[11px] font-bold"
                                            style={{
                                                color: bad ? BRACKET_RED : '#ffffff',
                                                // 用 text-decoration 而不是 border-bottom：
                                                // border 会让这一格比左边的当前值高 1px，两个数字的视觉中心就错开了
                                                textDecoration: cell && fieldKey ? 'underline dashed' : 'none',
                                                textDecorationColor: bad ? 'rgba(251,113,133,0.75)' : 'rgba(255,255,255,0.5)',
                                                textDecorationThickness: '1px',
                                                textUnderlineOffset: '3px',
                                                textDecorationSkipInk: 'none'
                                            }}
                                        >
                                            {String(max)}
                                        </span>
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 字段区：按游戏行序两列排（攻击 min–max 合并一格）。
                轩辕策的书系/书名/品阶/星级/洗炼已由头部徽章承担，卡内只留「等级」。 */}
            <div className={clsx('mt-3 grid gap-y-0', live.kind === 'character_panel' ? 'grid-cols-2 gap-x-2 @[400px]:gap-x-4' : 'grid-cols-1 gap-x-4')}>
                {gridItems.map((item, i) => {
                    if (item.type === 'attack') {
                        return (
                            <AttackRangeRow
                                key="attackRange"
                                min={attackMin as FieldCell}
                                max={attackMax}
                                editingKey={editingKey}
                                onEdit={setEditingKey}
                                onChange={setField}
                            />
                        );
                    }
                    return (
                        <GameRow
                            key={item.cell.key + i}
                            cell={item.cell}
                            editing={editingKey === item.cell.key}
                            onChange={v => setField(item.cell.key, v)}
                            onStartEdit={() => setEditingKey(item.cell.key)}
                            span={item.span}
                        />
                    );
                })}
            </div>

            {/* 轩辕策：识别到的四系 / 版本 / 品阶 / 等级 / 洗炼次数都能改 —— 这五个字段任意一个错，
                满属性对照就会整体算错（池是按「系 × 版本 × 品阶」取的）。 */}
            {live.kind === 'xyc' && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5" data-testid="vision-xyc-meta">
                    <div className="flex items-center gap-1">
                        {['青龙', '白虎', '朱雀', '玄武'].map(b => {
                            const on = String(live.xyc?.beast || '') === b;
                            return (
                                <button
                                    key={b}
                                    type="button"
                                    data-beast={b}
                                    onClick={() => patchMeta({ beast: b })}
                                    title={`四系决定词条池（${b}）`}
                                    className={clsx(
                                        'px-1.5 py-0.5 rounded text-[11px] border transition-colors cursor-pointer',
                                        on
                                            ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/60 font-bold'
                                            : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/60'
                                    )}
                                >
                                    {b}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => patchMeta({ heroVersion: !live.xyc?.heroVersion })}
                        title="普通版 / 英雄版：英雄版各词条上限更高"
                        className={clsx(
                            'px-1.5 py-0.5 rounded text-[11px] border transition-colors cursor-pointer',
                            live.xyc?.heroVersion
                                ? 'bg-amber-500/20 text-amber-200 border-amber-400/60 font-bold'
                                : 'text-slate-400 border-slate-700 hover:text-slate-200'
                        )}
                    >
                        {live.xyc?.heroVersion ? '英雄版' : '普通版'}
                    </button>
                    <select
                        value={live.xyc?.tier || '六品'}
                        onChange={e => patchMeta({ tier: e.target.value })}
                        title="品阶：决定词条池档位"
                        className="px-1 py-0.5 rounded text-[11px] bg-slate-800 border border-slate-700 text-slate-200 outline-none cursor-pointer"
                    >
                        {['一品', '二品', '三品', '四品', '五品', '六品'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>等级</span>
                        <button
                            type="button"
                            onClick={() => patchMeta({ level: Math.max(1, (live.xyc?.level ?? 1) - 1) })}
                            className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:text-white cursor-pointer"
                        >
                            −
                        </button>
                        <InlineEdit
                            value={live.xyc?.level ?? '—'}
                            kind="number"
                            width="2.4rem"
                            className="font-mono text-[11px] text-slate-100"
                            title="等级：直接填 1~20（词条上限按等级逐级上涨）"
                            onCommit={v => {
                                const n = Number(v.replace(/[^\d]/g, ''));
                                patchMeta({ level: Number.isFinite(n) && n > 0 ? Math.max(1, Math.min(20, n)) : undefined });
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => patchMeta({ level: Math.min(20, (live.xyc?.level ?? 1) + 1) })}
                            className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-cyan-600/30 border border-cyan-500/50 text-cyan-200 hover:text-white cursor-pointer"
                        >
                            +
                        </button>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                        <span>洗炼</span>
                        <InlineEdit
                            value={live.xyc?.washUsed}
                            kind="number"
                            width="2.6rem"
                            className="font-mono text-[11px] text-slate-100"
                            title="洗炼次数（不参与满值计算，只做记录）"
                            onCommit={v => patchMeta({ washUsed: v.trim() === '' ? undefined : Number(v) })}
                        />
                    </div>
                </div>
            )}

            {/* 轩辕策：属性 + 进阶技能，1:1 还原游戏 tooltip 版式（对齐 XycTomeDetailCard）
                —— 属性名与数值统一游戏蓝，括号内绿=洗炼、红=额外，进阶技能排在属性下方同款蓝字 */}
            {live.kind === 'xyc' && ((live.attrs?.length || 0) > 0 || Boolean(live.advSkill?.name || live.advSkill?.variant)) && (
                <div
                    className="mt-3 rounded-xl border border-[#232c3d] bg-[#070b12]/95 px-3 py-2.5 flex flex-col gap-1 min-w-0"
                    style={{
                        fontFamily: FONT_SONG,
                        letterSpacing: '0.3px',
                        boxShadow: 'inset 0 0 16px rgba(16, 28, 48, 0.35)'
                    }}
                >
                    {(live.attrs || []).map((a, i) => (
                        <div key={i} className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0 text-[13px] leading-[22px] min-w-0" style={{ color: GAME_COLORS.STAT_BLUE }}>
                            <span className="shrink-0">·</span>
                            <InlineEdit
                                value={a.name}
                                width="5rem"
                                align="left"
                                title="属性名（要能在词条池里对上，否则算不出满值）"
                                className="text-[13px]"
                                onCommit={v => patchAttr(i, { name: v.trim() })}
                            />
                            <InlineEdit
                                value={a.value}
                                width="4.5rem"
                                align="left"
                                title="词条主值（括号里的洗炼增量不计入差距）"
                                className="font-mono text-[13px]"
                                onCommit={v => patchAttr(i, { value: v.trim() })}
                            />
                            {a.wash && (
                                <span style={{ color: GAME_COLORS.MINT_GREEN }}>
                                    <InlineEdit
                                        value={a.wash}
                                        display={`(${a.wash})`}
                                        width="4rem"
                                        align="left"
                                        title="洗炼增量（只展示，不计入差距）"
                                        className="font-mono text-[12px]"
                                        onCommit={v => patchAttr(i, { wash: v.trim() })}
                                    />
                                </span>
                            )}
                            {a.extra && (
                                <span style={{ color: BRACKET_RED }}>
                                    <InlineEdit
                                        value={a.extra}
                                        display={`(${a.extra})`}
                                        width="4rem"
                                        align="left"
                                        title="额外增量（只展示，不计入差距）"
                                        className="font-mono text-[12px]"
                                        onCommit={v => patchAttr(i, { extra: v.trim() })}
                                    />
                                </span>
                            )}
                        </div>
                    ))}
                    {(live.advSkill?.name || live.advSkill?.variant) && (
                        <div className="text-[13px] leading-[22px] min-w-0 truncate" style={{ color: GAME_COLORS.STAT_BLUE }}>
                            （进阶技能）{live.advSkill?.name || '—'}
                            {live.advSkill?.variant && `《${live.advSkill.variant}》`}
                            {typeof live.advSkill?.level === 'number' && ` ${live.advSkill.level} 级`}
                        </div>
                    )}
                </div>
            )}

            {/* 天缘：金色标题（带天缘等级）+ 逐行天命档 + 词条行；词条与天命档都可点改，改完满值对照实时重算。
                部位（甲/刃/盔）与天缘等级不再给切换控件 —— 标题已经写明，2026-10-30 用户口径去掉 */}
            {live.kind === 'tianyuan' && (
                <div
                    data-testid="vision-tianyuan-body"
                    className="mt-3 rounded-xl border border-[#232c3d] bg-[#070b12]/95 px-3 py-2.5 flex flex-col gap-2 min-w-0"
                    style={{ fontFamily: FONT_SONG, letterSpacing: '0.3px', boxShadow: 'inset 0 0 16px rgba(16, 28, 48, 0.35)' }}
                >
                    <div className="font-bold text-[14px] leading-snug break-words" style={{ color: '#ffd272' }}>
                        {live.tianyuan?.name || String(live.fields.find(f => f.key === 'name')?.value ?? '天缘')}
                        <span
                            className="text-[12.5px] font-normal ml-1 whitespace-nowrap"
                            style={{
                                color: tianyuanLevelColor,
                                textShadow: tianyuanLevel > 0 ? `0 0 8px ${tianyuanLevelColor}55` : 'none'
                            }}
                        >
                            天缘 +{tianyuanLevel}
                            {tianyuanLevel >= 10 ? '（天命祝福）' : ''}
                        </span>
                        {live.tianyuan?.suffix && <span className="text-[12px] text-emerald-300 ml-1">（{live.tianyuan.suffix}）</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                        {(live.attrs || []).map((a, i) => {
                            const n = typeof a.tianming === 'number' && Number.isFinite(a.tianming) ? a.tianming : 0;
                            return (
                                <div
                                    key={i}
                                    data-tianyuan-attr={i}
                                    className="flex items-baseline gap-1.5 text-[13px] leading-[22px] min-w-0 flex-wrap"
                                    style={{ color: GAME_COLORS.STAT_BLUE }}
                                >
                                    <InlineEdit
                                        value={n}
                                        display={n > 0 ? `天命+${n}` : '天命'}
                                        kind="number"
                                        variant="badge"
                                        width="3rem"
                                        align="left"
                                        title={
                                            n > 0
                                                ? `天命+${n}：这一行吃「前 ${n} 档」累计额外系数（每行各算各的）。点数字可改`
                                                : '天命：这一行没吃额外档。点一下可以改成 +1~+10'
                                        }
                                        // 天命档沿用炼器色阶：+5 品红、+1 淡紫、0 白 —— 与新天缘模拟器完全一致
                                        className="font-mono text-[10.5px] shrink-0"
                                        style={{
                                            color: getRefineLevelColor(n),
                                            borderColor: `${getRefineLevelColor(n)}59`,
                                            background: `${getRefineLevelColor(n)}1f`,
                                            textShadow: n > 0 ? `0 0 8px ${getRefineLevelColor(n)}55` : 'none'
                                        }}
                                        onCommit={v => {
                                            const num = Number(String(v).replace(/[+\s]/g, ''));
                                            patchAttr(i, { tianming: Number.isFinite(num) && String(v).trim() !== '' ? Math.max(0, Math.min(10, Math.round(num))) : 0 });
                                        }}
                                    />
                                    <InlineEdit
                                        value={a.name}
                                        width="4.5rem"
                                        align="left"
                                        title="属性名（要能在属性表里对上，否则算不出满值）"
                                        className="text-[13px]"
                                        onCommit={v => patchAttr(i, { name: v.trim() })}
                                    />
                                    <InlineEdit
                                        value={a.value}
                                        width="4.5rem"
                                        align="left"
                                        title="词条主值（括号里的洗炼增量不计入差距）"
                                        className="font-mono font-bold text-[13px]"
                                        onCommit={v => patchAttr(i, { value: v.trim() })}
                                    />
                                    {a.wash && <span className="font-mono text-[11px] text-emerald-400">({a.wash})</span>}
                                    {a.extra && <span className="font-mono text-[11px] text-rose-400">({a.extra})</span>}
                                </div>
                            );
                        })}
                    </div>
                    <div className="text-[10.5px] text-slate-500 leading-snug whitespace-nowrap overflow-hidden text-ellipsis">
                        「天命+N」决定该行吃的额外档，点数字可改
                    </div>
                </div>
            )}

            {/* 满属性对照：贴天缘 / 轩辕策图，玩家真正要的是「离满还差多少」。
                满值按图里声称的等级 / 天缘+N 折算（轩辕策 = 池上限 + step×等级；天缘 = initMax + 等级×每级增益 + 天命档） */}
            {(live.kind === 'xyc' || live.kind === 'tianyuan') && ceiling && (
                <div data-testid="vision-ceiling" className="mt-2.5 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px] font-bold text-slate-200">满属性对照</span>
                        {ceiling.overall !== null && (
                            <span className="font-mono text-[12px] text-cyan-300" title="各词条完成度的平均值">
                                {Math.round(ceiling.overall * 100)}%
                            </span>
                        )}
                    </div>
                    {/* 口径行：天缘会带「（图上没有等级行）」这类说明，窄卡下允许折行，别截成省略号 */}
                    <div className="mt-0.5 text-[10px] text-slate-500 leading-snug" title={ceiling.basis}>
                        {ceiling.basis} · 按同等级理论上限折算
                    </div>

                    {ceiling.rows.length > 0 && (
                        <div className="mt-2 flex flex-col gap-1.5">
                            {ceiling.rows.map((r, i) => {
                                const pctW = Math.round(r.pct * 100);
                                const barColor = r.pct >= 0.95 ? '#34d399' : r.pct >= 0.85 ? '#22d3ee' : '#f59e0b';
                                return (
                                    <div
                                        key={`${r.name}-${i}`}
                                        className="min-w-0"
                                        data-ceiling-row={r.name}
                                        title={r.note}
                                    >
                                        <div className="flex items-baseline gap-1.5 text-[11.5px] min-w-0">
                                            <span className="text-slate-300 shrink-0 truncate max-w-[45%]">{r.name}</span>
                                            {typeof r.destiny === 'number' && r.destiny > 0 && (
                                                <span className="shrink-0 font-mono text-[9.5px] text-fuchsia-300/80">+{r.destiny}</span>
                                            )}
                                            <span className="flex-1 min-w-2" />
                                            <span className="font-mono text-slate-100 shrink-0">{fmtCeilingValue(r.current, r.unit)}</span>
                                            {/* 四舍五入导致当前值比上限高 0.1 时按「已满」处理，满值就显示当前值 —— 否则出现「7.2% / 7.1% 已满」的自相矛盾 */}
                                            <span className="font-mono text-slate-500 shrink-0">/ {fmtCeilingValue(Math.max(r.ceiling, r.current), r.unit)}</span>
                                            <span
                                                className={clsx('font-mono shrink-0 text-right w-[54px]', r.diff < 0 ? 'text-rose-400' : r.diff <= 0 ? 'text-emerald-400' : 'text-amber-300')}
                                                title={`完成度 ${pctW}%`}
                                            >
                                                {r.diff < 0 ? '超上限' : r.diff <= 0 ? '已满' : `-${fmtCeilingValue(r.diff, r.unit)}`}
                                            </span>
                                        </div>
                                        <div className="mt-1 h-[3px] rounded-full bg-white/10 overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${pctW}%`, background: r.diff < 0 ? '#fb7185' : barColor }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {ceiling.rows.length > 0 && !ceilingWorst && ceiling.rows.every(r => r.diff >= 0) && (
                        <div className="mt-2 text-[11px] text-emerald-400">全部词条已达同等级上限。</div>
                    )}

                    {ceilingWorst && ceiling.rows.length > 0 && (
                        <div className="mt-2 text-[11px] text-slate-400 leading-snug">
                            最短板：<span className="text-amber-300">{ceilingWorst.name}</span>
                            {' '}差 {fmtCeilingValue(ceilingWorst.diff, ceilingWorst.unit)}（{Math.round(ceilingWorst.pct * 100)}%）
                        </div>
                    )}

                    {ceiling.warnings.map((w, i) => (
                        <div key={i} className="mt-1.5 flex items-start gap-1.5 text-[10.5px] text-amber-500/90 leading-snug">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="min-w-0">{w}</span>
                        </div>
                    ))}

                    {ceiling.rows.some(r => r.wash || r.extra) && (
                        <div className="mt-1.5 text-[10px] text-slate-500">
                            括号内洗炼增量只展示，未计入差距（当前值一律取括号前的主值）。
                        </div>
                    )}
                </div>
            )}

            {/* 算不出差距（缺等级 / 缺天缘+N / 部位或系对不上）时，直接给「该截哪块」 */}
            {(live.kind === 'xyc' || live.kind === 'tianyuan') && ceiling && ceiling.rows.length === 0 && (
                <CaptureGuide defaultOpen size={imgSize} />
            )}

            {/* 未进卡项计数 */}
            {live.extraCount > 0 && (
                <div className="mt-2 text-[11px] text-slate-500 pl-0.5">
                    另有 {live.extraCount} 项已记录（不参与计算）
                </div>
            )}

            {/* 角色面板认不全 / 图范围明显偏大时给截图指引，默认折叠，不抢视线 */}
            {!live.degraded && (
                (live.kind === 'character_panel' && (live.quality === 'partial' || live.engine.missingRequired.length > 0))
                || isImageTooBig(imgSize)
            ) && <CaptureGuide size={imgSize} />}

            {/* 校验提示：正常结果直接列问题；降级时把每通道回执收进「技术详情」，
                裸串（cf-workers-ai:@cf/mistralai/...）对玩家没有任何意义 */}
            {live.issues.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-600/90 leading-relaxed">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    {live.degraded ? (
                        <details className="min-w-0">
                            <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-300">
                                识别技术详情（{prettyIssues(live.issues).length} 条通道回执）
                            </summary>
                            <div className="mt-1 flex flex-col gap-1 font-mono text-[10px] text-slate-500 break-all">
                                {prettyIssues(live.issues).map((s, i) => (
                                    <span key={i}>{s}</span>
                                ))}
                            </div>
                        </details>
                    ) : (
                        <span>{live.issues.slice(0, 3).join('；')}</span>
                    )}
                </div>
            )}

            {/* 隐藏 JSON：给本地 e2e 断言用，不占视觉 */}
            <pre data-testid="panel-json" className="hidden">{JSON.stringify({ kind: live.kind, fields: live.fields.map(f => ({ k: f.key, v: f.value, s: f.status })), engine: live.engine })}</pre>

            {/* 战斗增益四项（默认值来自 combat_buffs.json，可改） */}
            {live.kind === 'character_panel' && (
                <div className="mt-2.5 pt-2.5 border-t border-white/5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] text-slate-400">战斗增益（团队，已给默认值）</span>
                        <span className="text-[10px] text-slate-500">与战力计算器同口径</span>
                    </div>
                    {/* 与上方属性行同一套排版：标签左（SimSun 白）、数值右（青蓝 + 蓝色虚线底） */}
                    <div className="grid grid-cols-2 gap-x-2 @[400px]:gap-x-4">
                        {COMBAT_BUFF_LABELS.map(b => (
                            <label
                                key={b.key}
                                className="flex items-center justify-between gap-1.5 @[400px]:gap-2 min-w-0 px-0.5 py-[3px] border-b border-white/[0.04]"
                                style={{ fontFamily: FONT_SONG, letterSpacing: '0.3px' }}
                            >
                                <span className="whitespace-nowrap shrink-0 text-[12px] @[400px]:text-[13px]" style={{ color: GAME_COLORS.WHITE }}>
                                    {b.label}
                                </span>
                                <span className="flex items-baseline shrink-0 border-b border-dashed border-white/20 focus-within:border-cyan-400/80 transition-colors">
                                    <input
                                        type="number"
                                        data-buff-key={b.key}
                                        value={Number.isFinite(buffs[b.key]) ? buffs[b.key] : ''}
                                        onChange={e => {
                                            const v = e.target.value === '' ? 0 : Number(e.target.value);
                                            setBuffs(prev => ({ ...prev, [b.key]: Number.isFinite(v) ? v : 0 }));
                                        }}
                                        className="num-inline bg-transparent text-right font-mono text-[12px] @[400px]:text-[13px] font-bold outline-none focus:text-cyan-300 transition-colors"
                                        style={{ color: PANEL_CYAN }}
                                    />
                                    {b.unit && (
                                        <span className="font-mono text-[11px] opacity-70" style={{ color: PANEL_CYAN }}>{b.unit}</span>
                                    )}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* 副本 / BOSS 选择 + 结果（仅角色属性面板） */}
            {live.kind === 'character_panel' && (
                <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-col gap-2">
                    <DungeonBossPicker value={target} onChange={setTarget} disabled={!coverage?.ok || classUnknown} />

                    {sim.trace && (
                        <div data-testid="sim-result" className="rounded-lg bg-black/30 border border-white/5 p-2.5 flex flex-col gap-1.5">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-[10px] text-slate-500">战力指数</span>
                                    <span className="font-mono text-sm font-black text-amber-300">{fmtBig(sim.trace.result.power)}</span>
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-[10px] text-slate-500">对</span>
                                    <span className="text-xs text-slate-300">{sim.trace.result.bossName}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap text-[10px] text-slate-500 font-mono">
                                <span>{target?.dungeonName}</span>
                                <span>trace {sim.trace.attrsHash}</span>
                                <span>{sim.trace.engineFn}</span>
                                <span>buffs {sim.trace.buffIds.length}</span>
                            </div>
                            {(sim.trace.filledWithZero.length > 0 || sim.trace.buffNote) && (
                                <div className="text-[10px] text-amber-600/80 leading-relaxed">
                                    {sim.trace.filledWithZero.length > 0 && <>未识别按 0 计入：{sim.trace.filledWithZero.map(k => k.replace('Character', '')).join('、')}；</>}
                                    {sim.trace.buffNote}
                                </div>
                            )}
                        </div>
                    )}

                    {sim.error && (
                        <div data-testid="sim-error" className="text-[11px] text-rose-400/90 leading-relaxed">
                            计算未完成：{sim.error}
                        </div>
                    )}
                </div>
            )}

            {/* 操作区：**不做 sticky**。吸底按钮会盖住「满属性对照」的最后 1~2 行 ——
                而玩家正是冲着那几行结论来的，遮挡比多点一次滚动糟糕得多 */}
            <div className="relative z-10 -mx-3.5 sm:-mx-4 mt-3 px-3.5 sm:px-4 pt-2.5 pb-1 border-t border-white/5 bg-[#121824]">
            <div className="flex items-center gap-2 flex-wrap">
                {/* 只有角色属性面板才谈得上「带入计算器」：轩辕策/天缘没有引擎属性，带过去是空操作 */}
                {live.kind === 'character_panel' && (
                    <button
                        type="button"
                        data-action="import"
                        onClick={() => onImport?.(live)}
                        className="w-full @[420px]:w-auto px-4 py-2 @[420px]:py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-300 text-slate-900 text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                    >
                        <span>带入计算器</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                )}
                    {live.kind === 'tianyuan' && onOpenTianyuan && (
                        <button
                            type="button"
                            data-action="open-tianyuan"
                            data-tianyuan-kind={isNewTianyuan ? 'new' : 'old'}
                            onClick={() => {
                                const part = tianyuanPart.replace(/^上玄佑万辰须弥/, '');
                                const level = live.tianyuan?.tianyuanLevel
                                    ?? live.fields.find(f => f.key === 'tianyuanLevel')?.value;
                                onOpenTianyuan({
                                    isNew: isNewTianyuan,
                                    name: tianyuanName || tianyuanPart,
                                    groupName: isNewTianyuan && part ? `上玄佑万辰须弥${part}` : undefined,
                                    level: typeof level === 'number' ? level : Number(level)
                                });
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-black transition-colors shadow-sm"
                        >
                            {isNewTianyuan ? '查新天缘词条池' : '查旧天缘图鉴'}
                        </button>
                    )}
                    {live.kind === 'xyc' && onOpenXyc && (
                        <button
                            type="button"
                            data-action="open-xyc"
                            onClick={() => onOpenXyc({
                                beast: live.xyc?.beast,
                                isHero: live.xyc?.heroVersion,
                                level: live.xyc?.level,
                                advSkill: live.advSkill
                            })}
                            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-900 text-xs font-black transition-colors shadow-sm"
                        >
                            打开轩辕策模拟
                        </button>
                    )}
                {/* 秒伤推演还没接完，先置灰，别让用户点了以为坏了 */}
                {live.kind === 'character_panel' && (
                    <button
                        type="button"
                        data-action="simulate"
                        data-disabled-reason={blockedReason || undefined}
                        disabled
                        onClick={() => (onSimulate ? onSimulate(live) : doSimulate())}
                        title={blockedReason || '秒伤推演还在开发中，先用「带入计算器」'}
                        className="px-3 py-1.5 rounded-lg text-xs border bg-white/[0.03] border-white/[0.06] text-slate-500 cursor-not-allowed flex items-center gap-1.5"
                    >
                        <span>算副本秒伤</span>
                    </button>
                )}
                <button
                    type="button"
                    data-action="copy-data"
                    onClick={copyAttrs}
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? '已复制' : '复制属性数据'}</span>
                </button>
            </div>

                {/* 提示行：只有角色面板才有「灰字不参与计算」这回事，天缘/轩辕策不再挂说明
                    （2026-10-30 用户口径：最底部那行不需要） */}
                {live.kind === 'character_panel' && (
                    <div data-testid="vision-hint" className="mt-1.5 text-[11px] text-slate-400 leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis">
                        虚线底可点改（回车生效）；<span className="text-slate-500">灰字不参与计算</span>
                    </div>
                )}
            </div>
        </div>
    );
};

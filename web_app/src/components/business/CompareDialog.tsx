import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowLeftRight,
    ChevronRight,
    Info,
    Layers,
    Sparkles,
    Swords,
    Target,
    X,
} from 'lucide-react';
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import type { Preset } from '../../hooks/usePresets';
import { formatNumber } from '../../utils/format';
import { FACTION_LABELS } from '../../utils/shareSnapshot';
import {
    comparePresets,
    DUNGEON_CATEGORY_LABELS,
    DUNGEON_CATEGORY_ORDER,
    type CompareResult,
    type DungeonCategory,
    type MonsterCompareRow,
} from '../../utils/presetCompare';

/**
 * Step 12.1：A/B 方案对比（弹窗版）
 *
 * 用户拍板：
 * - 做成计算器页上的弹窗（独立路由页「回不去」）且**宽度只包住内容**：数据只有三列，
 *   弹窗用 `max-w-3xl` + `max-h` 自适应高度，不再拉成 1152px 的大宽页
 * - 表格布局 **A 值 ｜ 项目名 ｜ B 值**：两侧数值紧贴中间的项目名，**中间列真正居中**
 * - 不放「载入」按钮：切换当前方案在计算器页的「属性方案」下拉里做，弹窗保持纯只读（避免误覆盖当前配置）
 * - 「交换 A/B」保留并**居中**：与下方表格的中间列对齐，一行呈 [基准A] … [⇄] … [对比B] 的三列结构
 * - **差值不做单独的列，但一定放在数值的外侧**：贴近中间项目名的永远是真实数值，Δ + 占比甩到最外；
 *   绿色只给 Δ 胶囊，数值本身用灰白深浅分主次；相等时两侧都不标
 * - 技能伤害只取**单段**值，步进/多段技能（如苍龙啸）取**最后一段**
 * - **列身份条**（固定头部，选择器行下方）：A/B 两侧的职业·阵营常驻可见，替代原各区块表头
 * - **技能表不同的对比**（数据实证：重叠只有「完全一致 / 完全无交集」两种形态）：
 *   共有技能对齐对比；单侧技能名字进各自侧、按伤害排名配对接续，不再用「—」占位留空洞
 *
 * 只读对比：本弹窗不改动计算器当前配置；只有点「载入」才把该方案写回计算器。
 * 方案列表由 PresetManager 传入（同一份 usePresets 状态），避免两处各自持有一份导致方案名不同步。
 */

/**
 * 列模板：A 值（右对齐）｜项目名（居中）｜B 值（左对齐）
 * 左右两格等宽 → 中间列才是真正居中（多一列 Δ 会把中列挤偏约 70px）。
 */
const ROW_GRID =
    'grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)] items-center gap-x-2 md:gap-x-3';

interface CompareDialogProps {
    presets: Preset[];
    activePresetId: string | null;
    onClose: () => void;
}

/**
 * 数值单元格：**真实数值贴中间列，差值（涨幅）甩到最外侧**（2026-09-17 用户返工）。
 *
 * 顺序左右镜像（「外侧」= 远离中间的项目名那一侧）：
 *   左列（右对齐）＝ [Δ 胶囊] [占比] [数值 单位]
 *   右列（左对齐）＝ [数值 单位] [占比] [Δ 胶囊]
 * 之前把 Δ 内联在数值**后面**，右对齐一渲染，Δ 反而贴到了中列、数值被顶到外侧，
 * 左右两侧的真实数据离项目名一远一近，根本没法对读。
 *
 * 配色：数值只用灰阶分主次（高侧亮白加粗 / 相等中性 / 低侧压暗），
 * **绿色是全行唯一的彩色，且只给 Δ 胶囊**——数值和涨幅同色会糊成一片，看不出哪块是数据、哪块是涨幅。
 */
const ValueCell: React.FC<{
    v: number | null;
    other: number | null;
    unit?: string;
    missingLabel?: string;
    align?: 'left' | 'right';
    share?: number | null;
}> = ({ v, other, unit = '', missingLabel = '未启用', align = 'right', share = null }) => {
    const side = align === 'right' ? 'text-right justify-end' : 'text-left justify-start';
    if (v === null) return <span className={clsx(side, 'text-slate-400')}>{missingLabel}</span>;

    const diff = other === null ? null : v - other;
    const higher = diff !== null && diff > 0;
    const pct = higher && other ? (diff / Math.abs(other)) * 100 : null;

    // 主次只靠灰阶：高侧亮白加粗，相等 / 无从比较中性，低侧压暗
    const toneCls = higher ? 'text-slate-100 font-bold' : diff === null || diff === 0 ? 'text-slate-300' : 'text-slate-400';

    const valueGroup = (
        <>
            <span className={toneCls}>{formatNumber(v)}</span>
            {unit && <span className="text-[10px] text-slate-400">{unit}</span>}
        </>
    );
    const shareGroup = share !== null && share !== undefined && (
        <span className="text-[10px] text-slate-400">{share.toFixed(0)}%</span>
    );
    const deltaGroup = higher && (
        // 与数值之间额外留 8px（叠在 gap-1 之上）：用户反馈「涨幅离原始数据太近」会误读成一个数
        <span
            className={clsx(
                'whitespace-nowrap rounded border border-emerald-500/30 bg-emerald-500/10 px-1 font-bold text-[10px] text-emerald-300 md:text-xs',
                align === 'right' ? 'mr-2' : 'ml-2',
            )}
        >
            +{formatNumber(diff)}
            {unit}
            {pct !== null && <span className="ml-1">{pct.toFixed(1)}%</span>}
        </span>
    );

    return (
        <span className={clsx('flex items-baseline gap-1 font-mono tabular-nums', side)}>
            {align === 'right' ? (
                <>
                    {deltaGroup}
                    {shareGroup}
                    {valueGroup}
                </>
            ) : (
                <>
                    {valueGroup}
                    {shareGroup}
                    {deltaGroup}
                </>
            )}
        </span>
    );
};

/**
 * 区块标题行：**说明紧跟标题左对齐**（不用 justify-between）。
 * 弹窗只有 768px 宽，标题在左、说明甩到最右会出现 400px 空白，两者关联要靠横跨整行去"猜"；
 * 挤在一个视觉块里、放不下时自动折行，比两端对齐更好读。
 */
const SectionTitle: React.FC<{ icon: React.ReactNode; title: string; hint?: string }> = ({ icon, title, hint }) => (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 shrink-0">
            <span className="w-1 h-4 bg-gradient-to-b from-cyan-500 to-blue-500 rounded-full"></span>
            {icon}
            {title}
        </h3>
        {hint && <span className="text-[11px] text-slate-400 leading-snug">{hint}</span>}
    </div>
);

const PANEL = 'bg-slate-900/70 border border-slate-800/80 rounded-2xl shadow-lg';

export const CompareDialog: React.FC<CompareDialogProps> = ({ presets, activePresetId, onClose }) => {
    const { buffs, classes } = useApp();

    const [aId, setAId] = useState<string | null>(
        () => (activePresetId && presets.some((p) => p.id === activePresetId) ? activePresetId : presets[0]?.id ?? null),
    );
    const [bId, setBId] = useState<string | null>(
        () => presets.find((p) => p.id !== (activePresetId ?? presets[0]?.id))?.id ?? null,
    );

    const presetA = useMemo(() => presets.find((p) => p.id === aId) ?? null, [presets, aId]);
    const presetB = useMemo(() => presets.find((p) => p.id === bId) ?? null, [presets, bId]);

    const result: CompareResult | null = useMemo(() => {
        if (!presetA || !presetB) return null;
        try {
            return comparePresets(presetA, presetB, buffs);
        } catch (err) {
            console.error('方案对比计算失败:', err);
            return null;
        }
    }, [presetA, presetB, buffs]);

    const [openDungeons, setOpenDungeons] = useState<Set<string>>(() => new Set());
    const [openBosses, setOpenBosses] = useState<Set<string>>(() => new Set());
    const [openSkillLegend, setOpenSkillLegend] = useState(false);

    // 技能占比只在「技能表不同」时需要：同门派同阵营可直接左右对读，再显示百分比是噪音
    const showSkillShare = !!result && !result.identicalBuild;

    const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
        setter((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Esc 关闭 + 锁定背景滚动
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const classLabel = (preset: Preset | null): string => {
        if (!preset) return '—';
        const name = classes.find((c) => c.ClassID === preset.classId)?.ClassName || preset.classId;
        return `${name} · ${FACTION_LABELS[preset.faction] || preset.faction}`;
    };

    const setSide = (side: 'a' | 'b', id: string) => (side === 'a' ? setAId(id) : setBId(id));

    const handleSwap = () => {
        if (!aId || !bId) return;
        setAId(bId);
        setBId(aId);
    };

    const selectCls = (tone: 'a' | 'b') =>
        clsx(
            'h-8 w-[132px] md:w-[200px] shrink-0 rounded-lg border bg-slate-950/70 px-2 text-xs font-bold outline-none transition-colors [color-scheme:dark]',
            tone === 'a'
                ? 'border-cyan-500/50 text-cyan-300 focus:border-cyan-400'
                : 'border-slate-700 text-slate-200 focus:border-slate-500',
        );

    /**
     * 列身份条：A/B 两侧的职业·阵营，放在**固定头部**（选择器行正下方），滚动到任何深度都可见。
     * 原先各区块内的表头（A 名｜属性｜B 名）已删除——由本条统一承担「谁在哪一列」的标识，避免重复。
     * 水平加 mx 与数据行对齐：数据行在面板内（面板 p-2.5/md:p-3），头部水平内边距与主体一致（px-3/md:px-4）。
     */
    const colHeadBar = (
        <div
            data-compare-colhead
            className={clsx(ROW_GRID, 'mx-2.5 md:mx-3 pb-1.5 border-b border-slate-800/60 text-[11px] font-bold')}
        >
            <span className="text-right truncate text-cyan-300" title={`方案 A：${classLabel(presetA)}`}>
                <span className="md:hidden">A</span>
                <span className="hidden md:inline">A {classLabel(presetA)}</span>
            </span>
            <span className="text-center text-slate-400">项目</span>
            <span className="text-left truncate text-slate-200" title={`方案 B：${classLabel(presetB)}`}>
                <span className="md:hidden">B</span>
                <span className="hidden md:inline">B {classLabel(presetB)}</span>
            </span>
        </div>
    );

    const renderBossRow = (m: MonsterCompareRow) => {
        const isOpen = openBosses.has(m.monsterId);
        // 技能表重叠只有两种形态（game_data 实证）：同 build 完全一致 / 跨阵营·跨职业完全无交集。
        // 共有技能对齐对比；单侧技能按伤害排名左右配对接续（名字进各自侧），不再用「—」占位留空洞。
        const shared = m.skills.filter((s) => s.a !== null && s.b !== null);
        const onlyA = m.skills.filter((s) => s.a !== null && s.b === null);
        const onlyB = m.skills.filter((s) => s.b !== null && s.a === null);
        const soloRowCount = Math.max(onlyA.length, onlyB.length);
        return (
            <React.Fragment key={m.monsterId}>
                <button
                    type="button"
                    data-monster-row={m.monsterId}
                    onClick={() => toggle(setOpenBosses, m.monsterId)}
                    aria-expanded={isOpen}
                    className={clsx(ROW_GRID, 'py-1.5 text-[11px] md:text-xs rounded-lg px-1 -mx-1 transition-colors hover:bg-slate-800/40')}
                >
                    <ValueCell v={m.a} other={m.b} />
                    <span className="flex items-center justify-center gap-1.5 min-w-0 pl-5">
                        <ChevronRight className={clsx('w-3 h-3 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-90')} />
                        <span className="text-slate-300 truncate" title={m.name}>{m.name}</span>
                        <span className="hidden md:inline text-[10px] text-slate-400 shrink-0">
                            {onlyA.length > 0 && onlyB.length > 0 ? `(${onlyA.length}+${onlyB.length})` : `(${m.skills.length})`}
                        </span>
                    </span>
                    <ValueCell v={m.b} other={m.a} align="left" />
                </button>

                {/* 第三层：逐技能（按需渲染，不展开就不算不占位）
                    共有技能（按归一化名匹配，含跨阵营同源变体）排在前面对齐对比；
                    单侧技能接续在后：名字跟数值在同一侧（数值复用 ValueCell，样式与全表一致），
                    中列放「仅A/仅B」归属标记——既填住中列又不冒充可对比的技能名。 */}
                {isOpen && (
                    <>
                        {shared.map((sk) => (
                            <div
                                key={sk.skillId}
                                data-skill-row={sk.skillId}
                                className={clsx(ROW_GRID, 'py-1 text-[11px] rounded-lg px-1 -mx-1 transition-colors hover:bg-slate-800/30')}
                            >
                                <ValueCell v={sk.a} other={sk.b} share={showSkillShare ? sk.shareA : null} />
                                <span className="flex items-center justify-center gap-1.5 min-w-0 pl-9">
                                    <span
                                        className="text-slate-400 truncate"
                                        title={sk.nameA && sk.nameB ? `A：${sk.nameA} ／ B：${sk.nameB}` : sk.name}
                                    >
                                        {sk.name}
                                    </span>
                                </span>
                                <ValueCell v={sk.b} other={sk.a} share={showSkillShare ? sk.shareB : null} align="left" />
                            </div>
                        ))}
                        {shared.length > 0 && soloRowCount > 0 && (
                            <div className={clsx(ROW_GRID, 'py-0.5 text-[10px] text-slate-400')}>
                                <span />
                                <span className="text-center">↓ 以下技能仅单侧拥有，不参与差值对比</span>
                                <span />
                            </div>
                        )}
                        {Array.from({ length: soloRowCount }, (_, i) => {
                            const a = onlyA[i];
                            const b = onlyB[i];
                            const rowKey = a?.skillId ?? b?.skillId ?? `solo-${i}`;
                            return (
                                <div
                                    key={rowKey}
                                    data-skill-row={rowKey}
                                    className={clsx(ROW_GRID, 'py-1 text-[11px] rounded-lg px-1 -mx-1 transition-colors hover:bg-slate-800/30')}
                                >
                                    <span className="flex items-baseline justify-end gap-1.5 min-w-0">
                                        {a && <span className="text-slate-400 truncate" title={a.name}>{a.name}</span>}
                                        {a && <ValueCell v={a.a} other={null} share={showSkillShare ? a.shareA : null} />}
                                    </span>
                                    <span className="flex items-center justify-between min-w-0 px-1.5">
                                        {a && (
                                            <span className="shrink-0 text-[9px] leading-none px-1 py-0.5 rounded border border-cyan-500/25 bg-cyan-500/10 text-cyan-300/80 font-bold">
                                                仅A
                                            </span>
                                        )}
                                        {b && (
                                            <span className="shrink-0 text-[9px] leading-none px-1 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-400 font-bold">
                                                仅B
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex items-baseline justify-start gap-1.5 min-w-0">
                                        {b && <ValueCell v={b.b} other={null} share={showSkillShare ? b.shareB : null} align="left" />}
                                        {b && <span className="text-slate-400 truncate" title={b.name}>{b.name}</span>}
                                    </span>
                                </div>
                            );
                        })}
                    </>
                )}
            </React.Fragment>
        );
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 md:p-6">
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-hidden />

            <div
                role="dialog"
                aria-modal="true"
                aria-label="方案对比"
                className="relative w-full max-w-3xl max-h-[92vh] md:max-h-[88vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/80 overflow-hidden"
            >
                {/* ---- 头部（固定） ---- */}
                <div className="shrink-0 border-b border-slate-800 bg-slate-900/60 px-3 md:px-4 py-3 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-base md:text-lg font-black text-slate-100 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-cyan-400" />
                                方案对比
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                并排比较两套属性的面板值、增益与各副本 BOSS 的逐技能伤害。纯只读：不回写计算器，要切换当前方案请关闭本弹窗、用「属性方案」下拉。
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="关闭方案对比"
                            title="关闭（Esc）"
                            className="shrink-0 p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* 选择器行：三列结构，A 组靠左 / ⇄ 居中 / B 组靠右 —— 与下方表格的「A 值｜项目名｜B 值」三列对齐
                        （切换当前方案请回计算器用「属性方案」下拉，此处不提供写操作） */}
                    <div
                        data-compare-selector-row
                        className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center md:gap-x-3"
                    >
                        <div className="flex items-center gap-1.5 min-w-0 md:justify-self-start">
                            <span className="h-8 inline-flex items-center px-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-bold shrink-0">
                                基准 A
                            </span>
                            <select
                                data-compare-select="a"
                                aria-label="基准方案 A"
                                className={selectCls('a')}
                                value={aId ?? ''}
                                onChange={(e) => setSide('a', e.target.value)}
                            >
                                {presets.map((p) => (
                                    <option key={p.id} value={p.id} disabled={p.id === bId}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            data-compare-swap
                            onClick={handleSwap}
                            title="交换 A / B（差值方向随之翻转）"
                            aria-label="交换方案 A 与方案 B"
                            className="h-8 px-2 rounded-lg border border-slate-700 bg-slate-950/60 text-slate-300 hover:text-white hover:border-slate-500 transition-colors shrink-0 justify-self-center"
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-1.5 min-w-0 md:justify-self-end">
                            <span className="h-8 inline-flex items-center px-2.5 rounded-lg bg-slate-800/70 border border-slate-700/70 text-slate-300 text-xs font-bold shrink-0">
                                对比 B
                            </span>
                            <select
                                data-compare-select="b"
                                aria-label="对比方案 B"
                                className={selectCls('b')}
                                value={bId ?? ''}
                                onChange={(e) => setSide('b', e.target.value)}
                            >
                                {presets.map((p) => (
                                    <option key={p.id} value={p.id} disabled={p.id === aId}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 列身份条：滚到任何深度都能看到左右两列各是哪套职业·阵营 */}
                    {colHeadBar}

                    {result && !result.identicalBuild && (
                        <p className="flex items-start gap-2 text-[11px] text-slate-400">
                            <Info className="w-3.5 h-3.5 mt-px shrink-0 text-cyan-400" />
                            两套方案的职业或阵营不同时，技能按名字匹配（同源变体如「苍龙啸·煞 / 苍龙啸·禅」视为同一技能）：
                            同名的排在前面对齐对比；仅单侧拥有的技能按伤害降序接续排在后面，不参与差值对比。
                            BOSS 行与副本行的差值始终是两侧总伤之差。
                        </p>
                    )}
                </div>

                {/* ---- 主体（滚动） ---- */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 md:p-4 flex flex-col gap-5">
                    {!result || !presetA || !presetB ? (
                        <div className={clsx(PANEL, 'p-6 text-sm text-slate-300')}>对比数据不可用，请重新选择方案。</div>
                    ) : (
                        <>
                            {/* 角色属性 */}
                            <section className="flex flex-col gap-2.5">
                                <SectionTitle
                                    icon={<Target className="w-3.5 h-3.5 text-cyan-400" />}
                                    title="角色属性"
                                    hint="数值贴着中间项目名，较高一侧的差值标绿放在最外侧"
                                />
                                <div className={clsx(PANEL, 'p-2.5 md:p-3 flex flex-col gap-1')}>
                                    {result.attributes.map((row) => (
                                        <div key={row.key} data-attr-row={row.key} className={clsx(ROW_GRID, 'py-1.5 text-[11px] md:text-sm')}>
                                            <ValueCell v={row.a} other={row.b} />
                                            <span className="text-center text-slate-300 truncate" title={row.label}>{row.label}</span>
                                            <ValueCell v={row.b} other={row.a} align="left" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 生效增益 */}
                            <section className="flex flex-col gap-2.5">
                                <SectionTitle
                                    icon={<Sparkles className="w-3.5 h-3.5 text-cyan-400" />}
                                    title="生效增益"
                                    hint="数值为主体设定值 · 未启用侧不参与计算"
                                />
                                <div className={clsx(PANEL, 'p-2.5 md:p-3 flex flex-col gap-1')}>
                                    {result.buffs.map((row) => (
                                        <div key={row.buffId} data-buff-row={row.buffId} className={clsx(ROW_GRID, 'py-1.5 text-[11px] md:text-sm')}>
                                            <ValueCell v={row.a} other={row.b} unit={row.a === null ? '' : row.unit} />
                                            <span className="text-center text-slate-300 truncate" title={row.name}>{row.name}</span>
                                            <ValueCell v={row.b} other={row.a} unit={row.b === null ? '' : row.unit} align="left" />
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* 副本伤害（副本 → BOSS → 技能 三层钻取） */}
                            <section className="flex flex-col gap-2.5">
                                <SectionTitle
                                    icon={<Swords className="w-3.5 h-3.5 text-cyan-400" />}
                                    title="副本伤害对比"
                                    hint="点开 BOSS → 再点开每个技能"
                                />
                                <div className={clsx(PANEL, 'p-2.5 md:p-3 flex flex-col gap-1')}>
                                    {DUNGEON_CATEGORY_ORDER.map((cat: DungeonCategory) => {
                                        const rows = result.dungeons.filter((d) => d.category === cat);
                                        if (rows.length === 0) return null;
                                        return (
                                            <React.Fragment key={cat}>
                                                <div className="pt-2 pb-1 text-center text-[11px] font-bold text-slate-400">
                                                    {DUNGEON_CATEGORY_LABELS[cat]}
                                                </div>
                                                {rows.map((d) => {
                                                    const isOpen = openDungeons.has(d.dungeonId);
                                                    return (
                                                        <React.Fragment key={d.dungeonId}>
                                                            <button
                                                                type="button"
                                                                data-dungeon-row={d.dungeonId}
                                                                onClick={() => toggle(setOpenDungeons, d.dungeonId)}
                                                                aria-expanded={isOpen}
                                                                className={clsx(ROW_GRID, 'py-1.5 text-[11px] md:text-sm rounded-lg px-1 -mx-1 transition-colors hover:bg-slate-800/40')}
                                                            >
                                                                <ValueCell v={d.a} other={d.b} />
                                                                <span className="flex items-center justify-center gap-1.5 min-w-0">
                                                                    <ChevronRight className={clsx('w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform', isOpen && 'rotate-90')} />
                                                                    <span className="text-slate-200 truncate" title={d.name}>{d.name}</span>
                                                                    <span className="hidden md:inline text-[10px] text-slate-400 shrink-0">
                                                                        ({d.monsters.length})
                                                                    </span>
                                                                </span>
                                                                <ValueCell v={d.b} other={d.a} align="left" />
                                                            </button>
                                                            {isOpen && d.monsters.map(renderBossRow)}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                                <div className="flex flex-col gap-1 text-[11px] text-slate-400">
                                    <p>
                                        伤害口径：单个技能 = 该技能的单段平均伤害（多段 / 步进技能如苍龙啸只取最后一段）；
                                        BOSS = 该 BOSS 全部输出技能之和；副本 = 本内 BOSS 的均值。与计算器页的「综合战力」（技能加权和）不是同一口径。
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setOpenSkillLegend((v) => !v)}
                                        className="w-fit text-[11px] text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                                    >
                                        {openSkillLegend ? '收起说明' : '技能行怎么读？'}
                                    </button>
                                    {openSkillLegend && (
                                        <ul className="list-disc pl-5 flex flex-col gap-0.5">
                                            <li>技能按名字匹配（去掉「·煞 / ·禅 / ·玄」阵营变体段）：同名的排在前面对齐对比，较高的一侧带绿色差值胶囊，数值用灰白深浅分主次。</li>
                                            <li>单侧独有的技能接续排在后面：名字跟数值在同一侧（数值样式与全表一致），左右按伤害排名配对，中列的「仅A / 仅B」标记归属；不参与差值对比。</li>
                                            <li>共有技能的单元格左右镜像：<span className="text-slate-300">真实数值贴着中间的项目名</span>，差值与占比放在最外侧。</li>
                                            <li>门派 / 阵营不同时，技能行会带占该 BOSS 总伤的百分比，用来判断「谁在哪打得多」；BOSS 行的差值 = 两侧总伤之差，始终可比。</li>
                                        </ul>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    );
};

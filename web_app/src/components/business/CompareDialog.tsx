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

    /** 表头：A 方案名（右）｜项目类别（中）｜B 方案名（左） */
    const renderTableHead = (first: string) => (
        <div className={clsx(ROW_GRID, 'pb-2 border-b border-slate-800/80 text-[11px] text-slate-400 font-bold')}>
            <span className="text-right truncate" title={`方案 A：${classLabel(presetA)}`}>
                <span className="md:hidden">A</span>
                <span className="hidden md:inline">A {classLabel(presetA)}</span>
            </span>
            <span className="text-center">{first}</span>
            <span className="text-left truncate" title={`方案 B：${classLabel(presetB)}`}>
                <span className="md:hidden">B</span>
                <span className="hidden md:inline">B {classLabel(presetB)}</span>
            </span>
        </div>
    );

    const renderBossRow = (m: MonsterCompareRow) => {
        const isOpen = openBosses.has(m.monsterId);
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
                        <span className="hidden md:inline text-[10px] text-slate-400 shrink-0">({m.skills.length})</span>
                    </span>
                    <ValueCell v={m.b} other={m.a} align="left" />
                </button>

                {/* 第三层：逐技能（按需渲染，不展开就不算不占位） */}
                {isOpen && m.skills.map((sk) => (
                    <div
                        key={sk.skillId}
                        data-skill-row={sk.skillId}
                        className={clsx(ROW_GRID, 'py-1 text-[11px] rounded-lg px-1 -mx-1 transition-colors hover:bg-slate-800/30')}
                    >
                        <ValueCell v={sk.a} other={sk.b} share={showSkillShare ? sk.shareA : null} missingLabel="—" />
                        <span className="flex items-center justify-center gap-1.5 min-w-0 pl-9">
                            <span className="text-slate-400 truncate" title={sk.name}>{sk.name}</span>
                            {sk.delta === null && (
                                <span className="shrink-0 text-[9px] px-1 py-px rounded border border-slate-700 text-slate-400">
                                    {sk.a === null ? '仅 B' : '仅 A'}
                                </span>
                            )}
                        </span>
                        <ValueCell v={sk.b} other={sk.a} share={showSkillShare ? sk.shareB : null} missingLabel="—" align="left" />
                    </div>
                ))}
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

                    {result && !result.identicalBuild && (
                        <p className="flex items-start gap-2 text-[11px] text-slate-400">
                            <Info className="w-3.5 h-3.5 mt-px shrink-0 text-cyan-400" />
                            两套方案的门派或阵营不同（技能表不完全相同）：重叠技能可直接比较，单侧独有的技能只在对应列有值，
                            可结合技能后的「占比」横向参考。
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
                                    {renderTableHead('属性')}
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
                                    {renderTableHead('增益')}
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
                                    {renderTableHead('副本 / BOSS / 技能')}
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
                                            <li>技能行按「两侧技能 ID 的并集」展开，按较大的那侧伤害降序；某侧没有该技能时显示「—」。</li>
                                            <li>每行只有较高的一侧带绿色差值胶囊（「+差值 + 幅度」，幅度以较低一侧为基数）；数值本身只用灰白深浅分主次：高侧亮白加粗、低侧压暗。</li>
                                            <li>单元格左右镜像：<span className="text-slate-300">真实数值贴着中间的项目名</span>，差值与占比放在最外侧，两侧数值才能贴着同一个项目名对读。</li>
                                            <li>门派 / 阵营不同时，技能名后会带占该 BOSS 总伤的百分比，用来判断「谁在哪打得多」。</li>
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

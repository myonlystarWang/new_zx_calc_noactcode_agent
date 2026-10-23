import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, RotateCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { DataService } from '../../services/DataService';
import {
    WASH_ITEMS,
    TIER_COLORS,
    TIER_NAMES,
    attrValueAt,
    canRollSkill,
    formatAttrValue,
    getPool,
    identifyBook,
    makeRng,
    tierOfValue,
    wash as washBook,
    type XycBeast,
    type XycBook,
    type XycRefineData,
    type XycVersion,
    type XycWashMode,
} from '../../utils/xycRefineSim';

/**
 * 轩辕策洗练模拟器（对话内嵌卡）
 *
 * 版式 1:1 还原游戏「轩辕策」物品窗：标题金条 + 左侧书页框 + 右侧 tooltip 属性列 + 底部 4 键
 * （镶嵌 / 升级 / 分解 / 洗炼）；右侧为洗练窗口（大衍奇术 / 一元道契 / 太乙宝函）。
 *
 * 数据：`/game_data/xyc_refine.json`（脚本 `scripts/build_xyc_refine_data.mjs`
 * 从客户端 elements.data 表 213/214/215 解包，含条数概率 / 五档概率 / 12 条属性出现概率 / 技能等级概率）
 */

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';

const CARD_STYLE: React.CSSProperties = {
    background: 'linear-gradient(180deg, #101a22 0%, #0a1016 100%)',
    border: '1px solid #2a4054',
    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    fontFamily: SIM_FONT,
};

const TITLE_BAR_STYLE: React.CSSProperties = {
    background: 'linear-gradient(180deg, #1a2937 0%, #0f1922 100%)',
    borderBottom: '1px solid #2a4054',
};

const TITLE_TEXT_STYLE: React.CSSProperties = {
    color: '#f7f4bb',
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 3,
    textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000',
};

/** 游戏 tooltip 三色：书名金 / 警示橙 / 属性蓝 / 技能淡紫蓝 / 品阶青 */
const C_BOOK = '#ffb14d';
const C_WARN = '#ff6a3d';
const C_STAT = '#8080ff';
const C_SKILL = '#a8b4ff';
const C_TIER = '#67e8f9';
const C_GRADE = '#7fb2ff';

function tabStyle(active: boolean): React.CSSProperties {
    return active
        ? {
              background: '#1b3348',
              border: '1px solid #5f8fc9',
              color: '#d6ecff',
              boxShadow: '0 0 8px rgba(70,232,251,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
              fontFamily: SIM_FONT,
          }
        : {
              background: '#0f1a26',
              border: '1px solid #2a415a',
              color: '#7f9ab0',
              fontFamily: SIM_FONT,
          };
}

function btnStyle(enabled: boolean, tone: 'normal' | 'gold' = 'normal'): React.CSSProperties {
    if (!enabled) {
        return {
            background: 'rgba(16, 26, 36, 0.6)',
            border: '1px solid #22303f',
            color: '#4b5f70',
            borderRadius: 3,
            fontFamily: SIM_FONT,
            fontSize: 12,
            cursor: 'not-allowed',
        };
    }
    return tone === 'gold'
        ? {
              background: 'linear-gradient(180deg, #4a3a1c 0%, #2a2110 100%)',
              border: '1px solid #a5822f',
              color: '#ffe6a8',
              borderRadius: 3,
              fontFamily: SIM_FONT,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), 0 2px 6px rgba(0,0,0,0.5)',
          }
        : {
              background: 'linear-gradient(180deg, #1c3348 0%, #101d2a 100%)',
              border: '1px solid #3d6382',
              color: '#cfe6f7',
              borderRadius: 3,
              fontFamily: SIM_FONT,
              fontSize: 12,
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.5)',
          };
}

/** 游戏里属性行前的「⊘」圆形禁止符号 */
const SlotMark: React.FC = () => (
    <svg width="12" height="12" viewBox="0 0 16 16" className="shrink-0 mr-1" style={{ display: 'inline-block', verticalAlign: '-1px' }}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke={C_STAT} strokeWidth="1.3" />
        <line x1="3.9" y1="12.1" x2="12.1" y2="3.9" stroke={C_STAT} strokeWidth="1.3" />
    </svg>
);

interface LogEntry {
    key: number;
    n: number;
    mode: XycWashMode;
    tier: number;
    lines: string[];
    gotSkill: boolean;
    skillText: string;
}

export interface XycWashCardProps {
    cardData?: {
        data?: unknown;
        initialBeast?: string;
        initialVersion?: string;
        initialGrade?: number;
        initialOcc?: string;
        initialLevel?: number;
    };
    className?: string;
}

const BEAST_ORDER: XycBeast[] = ['青龙', '白虎', '朱雀', '玄武'];
const VERSION_ORDER: XycVersion[] = ['普通', '典藏', '英雄'];
const OCC_ORDER = ['鬼王', '青云', '合欢', '天音', '鬼道', '焚香', '九黎', '烈山', '怀光', '天华', '辰皇', '太昊', '牵机', '英招', '破军', '青罗', '归云', '画影', '逐霜', '惊岚', '昭冥', '涅羽', '百灵', '长生堂', '万毒', '炼血', '释罗'];

export const XycWashCard: React.FC<XycWashCardProps> = ({ cardData, className }) => {
    const [data, setData] = useState<XycRefineData | null>(null);
    const [loadErr, setLoadErr] = useState<string | null>(null);

    const initialBeast = (BEAST_ORDER as string[]).includes(cardData?.initialBeast || '')
        ? (cardData!.initialBeast as XycBeast)
        : '白虎';
    const initialVersion = (VERSION_ORDER as string[]).includes(cardData?.initialVersion || '')
        ? (cardData!.initialVersion as XycVersion)
        : '普通';

    const [beast, setBeast] = useState<XycBeast>(initialBeast);
    const [version, setVersion] = useState<XycVersion>(initialVersion);
    const [grade, setGrade] = useState<number>(6);
    const [occ, setOcc] = useState<string>(OCC_ORDER.includes(cardData?.initialOcc || '') ? cardData!.initialOcc! : '鬼王');
    const [level, setLevel] = useState<number>(() => {
        const lv = cardData?.initialLevel;
        return typeof lv === 'number' ? Math.min(20, Math.max(1, lv)) : 1;
    });

    const [book, setBook] = useState<XycBook | null>(null);
    const [mode, setMode] = useState<XycWashMode>('attr');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [lastChanged, setLastChanged] = useState<string[]>([]);
    const [helpOpen, setHelpOpen] = useState(false);
    const [flash, setFlash] = useState(0);

    const rngRef = useRef(makeRng((Date.now() ^ 0x5f3a) >>> 0));
    const logSeq = useRef(0);

    useEffect(() => {
        let alive = true;
        DataService.getInstance()
            .getXycRefine()
            .then((d: XycRefineData) => {
                if (alive) setData(d as XycRefineData);
            })
            .catch((e: unknown) => {
                if (alive) setLoadErr(String((e as Error)?.message || e));
            });
        return () => {
            alive = false;
        };
    }, []);

    const pool = useMemo(() => (data ? getPool(data, version, beast, grade) : null), [data, version, beast, grade]);

    const regenerate = useCallback(() => {
        if (!data) return;
        const next = identifyBook(data, { version, beast, grade, level, occ }, rngRef.current);
        setBook(next);
        setLogs([]);
        setLastChanged([]);
    }, [data, version, beast, grade, level, occ]);

    // 数据/配置变化后重新鉴定（等级变化不重置书，只改显示）
    const identKey = `${version}|${beast}|${grade}|${occ}`;
    useEffect(() => {
        if (!data) return;
        regenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, identKey]);

    useEffect(() => {
        setBook((prev) => (prev ? { ...prev, level } : prev));
    }, [level]);

    // 典藏 / 英雄 只开放六品；英雄目前只开放青龙、白虎
    useEffect(() => {
        if (version !== '普通' && grade !== 6) setGrade(6);
        if (version === '英雄' && !['青龙', '白虎'].includes(beast)) setBeast('青龙');
    }, [version, grade, beast]);

    const skillEligible = data ? canRollSkill(data, beast, grade, book?.attrCount ?? 0) : false;
    const remain = book ? Math.max(0, book.washMax - book.washUsed) : 0;
    const canWash = Boolean(book) && remain > 0 && (mode !== 'skill' || skillEligible);

    const runWash = useCallback(
        (times: number) => {
            if (!data || !book) return;
            let cur = book;
            const newLogs: LogEntry[] = [];
            let changedLines: string[] = [];
            for (let i = 0; i < times; i++) {
                if (cur.washUsed >= cur.washMax) break;
                if (mode === 'skill' && !canRollSkill(data, cur.beast, cur.grade, cur.attrCount)) break;
                const res = washBook(data, cur, mode, occ, rngRef.current);
                cur = res.book;
                const lines: string[] = [];
                for (const ch of res.changed) {
                    if (ch.kind === 'attr') {
                        const def = data.attrs[String(ch.id)];
                        if (!def) continue;
                        const b = ch.before === null ? null : formatAttrValue(data, ch.id, ch.before + (pool?.attrs.find((a) => a.id === ch.id)?.step ?? 0) * cur.level);
                        const a = ch.after === null ? '—' : formatAttrValue(data, ch.id, ch.after + (pool?.attrs.find((x) => x.id === ch.id)?.step ?? 0) * cur.level);
                        lines.push(`${def.name} ${b ?? '—'} → ${a}`);
                    } else {
                        lines.push(`技能 ${ch.before ?? '无'} → ${ch.after ?? '无'}`);
                    }
                }
                const skillText = cur.skill ? `${cur.skill.name} ${cur.skill.level}级` : '无技能';
                newLogs.unshift({
                    key: ++logSeq.current,
                    n: cur.washUsed,
                    mode,
                    tier: cur.tier,
                    lines: lines.slice(0, 4),
                    gotSkill: res.gotSkill,
                    skillText,
                });                if (i === times - 1 || times === 1) changedLines = lines.slice(0, 4);
            }
            setBook(cur);
            setLogs((prev) => [...newLogs, ...prev].slice(0, 12));
            setLastChanged(changedLines);
            setFlash((f) => f + 1);
        },
        [data, book, mode, occ, pool]
    );

    const raiseWashMax = useCallback(() => {
        if (!data) return;
        setBook((prev) => {
            if (!prev) return prev;
            const heroBeast = prev.version === '英雄' && ['青龙', '白虎'].includes(prev.beast);
            const cap = heroBeast ? data.meta.heroWashMaxWithItem : data.meta.washMaxWithItem;
            return { ...prev, washMax: Math.max(prev.washMax, cap) };
        });
    }, [data]);

    if (loadErr) {
        return (
            <div className={clsx('w-full rounded-[4px] border border-[#3a2a2a] bg-[#140e0e] p-3 text-[12px] text-[#d99]', className)}>
                轩辕策洗练数据加载失败：{loadErr}
            </div>
        );
    }

    if (!data || !pool || !book) {
        return (
            <div className={clsx('w-full rounded-[4px] border border-[#283e54] bg-[#0c1219] p-4 text-[13px] text-[#7f9ab0]', className)}>
                正在载入轩辕策洗练数据（客户端 elements.data 表 213/214/215）…
            </div>
        );
    }

    const bookName = data.books[beast]?.bookName || '轩辕策';
    const gradeName = data.meta.gradeNames[grade - 1] || '六品';
    const attrRows = book.attrs.map((roll) => {
        const def = data.attrs[String(roll.id)];
        const raw = attrValueAt(pool, roll, book.level);
        const tier = tierOfValue(pool, roll.id, roll.base);
        return { id: roll.id, name: def?.name || `属性${roll.id}`, text: formatAttrValue(data, roll.id, raw), tier };
    });
    const skillProbPct = (pool.skillProb * 100).toFixed(0);
    const tierProbs = pool.tierProbs;

    return (
        <div className={clsx('@container w-full min-w-0', className)}>
            <style>{`
                @container (min-width: 800px) {
                    .xyc-layout { flex-direction: row !important; align-items: flex-start !important; }
                    .xyc-left { width: 330px !important; max-width: 330px !important; flex: 0 0 330px !important; }
                    .xyc-right { flex: 1 1 auto !important; min-width: 0 !important; }
                }
                @container (max-width: 799px) {
                    .xyc-layout { flex-direction: column !important; }
                    .xyc-left, .xyc-right { width: 100% !important; max-width: 100% !important; }
                }
            `}</style>

            <div className="xyc-layout flex flex-col gap-3 w-full min-w-0">
                {/* ───────── 窗口 1：轩辕策物品窗（1:1 游戏） ───────── */}
                <div className="xyc-left w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE} data-xyc-book="1">
                    <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                        <span style={TITLE_TEXT_STYLE}>
                            {beast}
                            <span style={{ color: '#f7f4bb' }}>&lt;{bookName}&gt;</span>
                        </span>
                        <div className="absolute right-3 flex items-center gap-2">
                            <button type="button" onClick={regenerate} title="重新鉴定（重抽条数与数值）" className="cursor-pointer hover:brightness-150">
                                <RotateCw className="w-3.5 h-3.5" style={{ color: '#5b7894' }} />
                            </button>
                            <button type="button" onClick={() => setHelpOpen((v) => !v)} title="概率公示" className="cursor-pointer hover:brightness-150">
                                <HelpCircle className="w-3.5 h-3.5" style={{ color: '#5b7894' }} />
                            </button>
                        </div>
                    </div>

                    {/* 四系切换 */}
                    <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ borderBottom: '1px solid #2a4054', background: '#0b141c' }}>
                        {BEAST_ORDER.map((b) => (
                            <button
                                key={b}
                                type="button"
                                onClick={() => setBeast(b)}
                                className="flex-1 px-1 py-1 rounded-[3px] text-[12px] transition-colors cursor-pointer whitespace-nowrap"
                                style={{
                                    ...tabStyle(b === beast),
                                    color: b === beast ? '#d6ecff' : '#7f9ab0',
                                }}
                            >
                                {b}
                            </button>
                        ))}
                    </div>

                    {/* 图标 + tooltip */}
                    <div className="p-2.5 flex gap-2.5 min-w-0">
                        <div className="relative w-[142px] h-[142px] shrink-0 rounded-[3px] overflow-hidden">
                            <img
                                src="/game_data/equip_icons/xyc_book.png"
                                alt={bookName}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.visibility = 'hidden';
                                }}
                            />
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 text-[13px] leading-[21px]">
                            <div style={{ color: C_BOOK }} className="truncate">
                                {beast}&lt;{bookName}&gt;
                            </div>
                            <div style={{ color: C_WARN }} className="text-[12px]">
                                不会掉落
                            </div>
                            <div style={{ color: C_GRADE }} className="text-[12px] flex items-center gap-1">
                                <span>{gradeName}</span>
                                <span style={{ color: '#ffdc50' }}>{'★'.repeat(grade >= 6 ? 3 : grade >= 4 ? 2 : 1)}</span>
                                {version !== '普通' && <span style={{ color: '#ffd272' }}>·{version}版</span>}
                            </div>
                            <div style={{ color: C_STAT }} className="text-[12px]">
                                洗练次数 {remain}/{book.washMax}
                            </div>
                            <div style={{ color: C_STAT }} className="text-[12px]">
                                等级 {book.level}
                            </div>

                            <div className="flex flex-col mt-0.5">
                                {attrRows.map((row, idx) => (
                                    <div key={`${row.id}-${idx}`} className="flex items-center min-w-0" style={{ color: C_STAT }}>
                                        <SlotMark />
                                        <span className="truncate text-[12px]">
                                            {row.name} +{row.text}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {book.skill ? (
                                <div className="text-[12px] mt-0.5 break-words" style={{ color: C_SKILL }}>
                                    （进阶技能）{book.skill.name} {book.skill.level}级
                                </div>
                            ) : (
                                skillEligible && (
                                    <div className="text-[12px] mt-0.5" style={{ color: '#4b6478' }}>
                                        （进阶技能）未洗出
                                    </div>
                                )
                            )}

                            <div className="mt-auto pt-1 text-[12px]" style={{ color: C_TIER }}>
                                &lt;{gradeName}&gt;
                                <span className="ml-2 text-[11px]" style={{ color: '#4b6478' }}>
                                    {book.attrCount} 条属性
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 底部四键（对应游戏：镶嵌 / 升级 / 分解 / 洗炼） */}
                    <div className="grid grid-cols-2 gap-1.5 px-2.5 pb-2.5" style={{ borderTop: '1px solid #2a4054', paddingTop: 8 }}>
                        <button type="button" disabled title="镶嵌：本站不模拟镶嵌槽位" style={{ ...btnStyle(false), padding: '5px 0' }}>
                            镶嵌
                        </button>
                        <button
                            type="button"
                            onClick={() => setLevel((v) => Math.min(data.meta.maxLevel, v + 1))}
                            disabled={book.level >= data.meta.maxLevel}
                            title="升级：属性数值按每级固定增益提升"
                            style={{ ...btnStyle(book.level < data.meta.maxLevel), padding: '5px 0' }}
                        >
                            升级
                        </button>
                        <button type="button" disabled title="分解：本站不模拟分解产出" style={{ ...btnStyle(false), padding: '5px 0' }}>
                            分解
                        </button>
                        <button
                            type="button"
                            onClick={() => document.getElementById('xyc-wash-anchor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                            title="洗练：右侧道具洗练面板"
                            style={{ ...btnStyle(true, 'gold'), padding: '5px 0', fontWeight: 700 }}
                        >
                            洗炼
                        </button>
                    </div>
                </div>

                {/* ───────── 窗口 2：洗练 ───────── */}
                <div id="xyc-wash-anchor" className="xyc-right w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE}>
                    <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                        <span style={TITLE_TEXT_STYLE}>洗 练</span>
                        <div className="absolute right-3 flex items-center gap-2">
                            <span className="text-[11px]" style={{ color: '#5b7894' }}>
                                {remain}/{book.washMax}
                            </span>
                        </div>
                    </div>

                    {/* 配置区：版本 / 品阶 / 门派 */}
                    <div className="px-3 py-2 flex flex-col gap-1.5" style={{ background: '#0b141c', borderBottom: '1px solid #2a4054' }}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] w-[30px]" style={{ color: '#5b7894' }}>
                                版本
                            </span>
                            {VERSION_ORDER.map((v) => {
                                const disabled = v === '英雄' && !['青龙', '白虎'].includes(beast);
                                return (
                                    <button
                                        key={v}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => setVersion(v)}
                                        className="px-2.5 py-0.5 rounded-[3px] text-[12px] cursor-pointer disabled:cursor-not-allowed"
                                        style={{ ...tabStyle(v === version), opacity: disabled ? 0.35 : 1 }}
                                        title={disabled ? '英雄版目前只开放青龙与白虎' : undefined}
                                    >
                                        {v}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] w-[30px]" style={{ color: '#5b7894' }}>
                                品阶
                            </span>
                            {data.meta.gradeNames.filter((_g, i) => version === '普通' || i === 5).map((g, i) => {
                                const gv = version === '普通' ? i + 1 : 6;
                                const disabled = false;
                                return (
                                    <button
                                        key={g}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => setGrade(gv)}
                                        className="px-2 py-0.5 rounded-[3px] text-[12px] cursor-pointer disabled:cursor-not-allowed"
                                        style={{ ...tabStyle(gv === grade), opacity: disabled ? 0.3 : 1 }}
                                    >
                                        {g.replace('品', '')}
                                    </button>
                                );
                            })}
                            <span className="text-[11px] hidden @[520px]:inline" style={{ color: '#4b6478' }}>
                                {version !== '普通' ? '（典藏/英雄仅六品）' : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] w-[30px]" style={{ color: '#5b7894' }}>
                                门派
                            </span>
                            <select
                                value={occ}
                                onChange={(e) => setOcc(e.target.value)}
                                className="bg-[#0f1a26] border border-[#2a415a] rounded-[3px] px-1.5 py-0.5 text-[12px] outline-none cursor-pointer"
                                style={{ color: '#cfe6f7', fontFamily: SIM_FONT }}
                                title="决定进阶技能从哪个门派的技能池里抽"
                            >
                                {OCC_ORDER.map((o) => (
                                    <option key={o} value={o}>
                                        {o}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[11px] ml-auto" style={{ color: '#4b6478' }}>
                                条数 {book.attrCount} · 技能 {skillEligible ? `${skillProbPct}%` : '不可出'}
                            </span>
                        </div>
                    </div>

                    {/* 三种洗练道具 */}
                    <div className="px-3 py-2 grid grid-cols-1 gap-1.5" style={{ borderBottom: '1px solid #2a4054' }}>
                        {WASH_ITEMS.map((it) => {
                            const active = it.mode === mode;
                            const blocked = it.mode === 'skill' && !skillEligible;
                            return (
                                <button
                                    key={it.mode}
                                    type="button"
                                    onClick={() => setMode(it.mode)}
                                    className="text-left px-2 py-1.5 rounded-[3px] cursor-pointer transition-colors"
                                    style={{
                                        background: active ? 'linear-gradient(180deg, #1b3348 0%, #12212e 100%)' : '#0b141c',
                                        border: `1px solid ${active ? '#5f8fc9' : '#22303f'}`,
                                        opacity: blocked ? 0.5 : 1,
                                    }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[12.5px] font-bold" style={{ color: active ? '#d6ecff' : '#8fb0c8' }}>
                                            {it.name}
                                        </span>
                                        <span className="text-[11px] px-1 rounded-[2px]" style={{ background: '#12212e', color: active ? '#67e8f9' : '#4b6478' }}>
                                            {it.short}
                                        </span>
                                        {blocked && <span className="text-[10px] ml-auto" style={{ color: '#a5654b' }}>当前书不适用</span>}
                                    </div>
                                    <div className="text-[11px] leading-[16px] mt-0.5" style={{ color: '#5b7894' }}>
                                        {it.desc}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* 操作区 */}
                    <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => runWash(1)}
                                disabled={!canWash}
                                className="flex-1 py-1.5 rounded-[3px] text-[12.5px] font-bold"
                                style={btnStyle(canWash, 'gold')}
                            >
                                洗练一次
                            </button>
                            <button type="button" onClick={() => runWash(10)} disabled={!canWash} className="px-2.5 py-1.5 rounded-[3px] text-[12px]" style={btnStyle(canWash)}>
                                连洗 10
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#5b7894' }}>
                            <span>
                                剩余次数 <b style={{ color: remain > 0 ? '#67e8f9' : '#ff6a3d' }}>{remain}</b>/{book.washMax}
                            </span>
                            {book.washMax < (book.version === '英雄' && ['青龙', '白虎'].includes(book.beast) ? data.meta.heroWashMaxWithItem : data.meta.washMaxWithItem) && (
                                <button
                                    type="button"
                                    onClick={raiseWashMax}
                                    className="ml-auto px-2 py-0.5 rounded-[2px] cursor-pointer"
                                    style={{ background: '#241a2e', border: '1px solid #5a4a7a', color: '#d8c7ff' }}
                                    title="消耗「轩辕拾遗录」提升洗练次数上限"
                                >
                                    使用轩辕拾遗录
                                </button>
                            )}
                        </div>

                        {/* 本次结果 */}
                        {lastChanged.length > 0 && (
                            <div
                                key={flash}
                                className="rounded-[3px] px-2 py-1.5 text-[11.5px] leading-[18px]"
                                style={{ background: 'rgba(20,32,44,0.9)', border: '1px solid #22303f' }}
                            >
                                <div className="flex items-center gap-1 mb-0.5" style={{ color: '#f7f4bb' }}>
                                    <Sparkles className="w-3 h-3" style={{ color: '#ffdc50' }} />
                                    第 {book.washUsed} 次 · 品质【
                                    <span style={{ color: TIER_COLORS[book.tier] }}>{TIER_NAMES[book.tier]}</span>】
                                </div>
                                {lastChanged.map((line, i) => (
                                    <div key={i} style={{ color: '#8fb0c8' }}>
                                        {line}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 历史记录 */}
                        {logs.length > 0 && (
                            <div className="flex flex-col gap-0.5 max-h-[132px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                                {logs.map((l) => (
                                    <div key={l.key} className="text-[11px] leading-[17px] flex items-start gap-1" style={{ color: '#5b7894' }}>
                                        <span className="shrink-0" style={{ color: '#4b6478' }}>
                                            #{l.n}
                                        </span>
                                        <span className="shrink-0" style={{ color: TIER_COLORS[l.tier] }}>
                                            {TIER_NAMES[l.tier]}
                                        </span>
                                        <span className="min-w-0 truncate" style={{ color: l.gotSkill ? '#a8b4ff' : '#5b7894' }}>
                                            {l.lines[0] || '无变化'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 概率公示 */}
                    <div style={{ borderTop: '1px solid #2a4054' }}>
                        <button
                            type="button"
                            onClick={() => setHelpOpen((v) => !v)}
                            className="w-full flex items-center justify-between px-3 py-1.5 text-[11.5px] cursor-pointer"
                            style={{ color: '#7f9ab0' }}
                        >
                            <span>洗练概率公示（客户端实证）</span>
                            {helpOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        {helpOpen && (
                            <div className="px-3 pb-2 flex flex-col gap-1.5 text-[11px] leading-[17px]" style={{ color: '#6f8aa0' }}>
                                <div>
                                    <span style={{ color: '#9adfff' }}>属性条数</span>（洗练不改变条数，仅鉴定决定）：
                                    {Object.entries(pool.attrCountProbs)
                                        .filter(([, p]) => p > 0)
                                        .map(([c, p]) => `${c}条 ${(p * 100).toFixed(0)}%`)
                                        .join(' / ')}
                                </div>
                                <div>
                                    <span style={{ color: '#9adfff' }}>数值品质档</span>（每条 20% 区间，整本一次掷档）：
                                    {tierProbs.map((p, i) => (
                                        <span key={i}>
                                            <span style={{ color: TIER_COLORS[i] }}>{TIER_NAMES[i]}</span>
                                            {(p * 100).toFixed(0)}%{' '}
                                        </span>
                                    ))}
                                </div>
                                <div>
                                    <span style={{ color: '#9adfff' }}>进阶技能</span>：出现率 {skillProbPct}%（{gradeName}
                                    {version !== '普通' ? `·${version}` : ''}），等级 {data.skill.levelProbsHigh.map((p) => `${(p * 100).toFixed(0)}%`).join('/')}（1/2/3 级）
                                    {grade <= 4 ? '，三/四品只出 1~2 级' : ''}；系别《英雄/大地/天空/碧海》各 25%。朱雀、玄武永远无技能。
                                </div>
                                <div>
                                    <span style={{ color: '#9adfff' }}>属性出现概率</span>：
                                    {pool.attrs
                                        .map((a) => `${data.attrs[String(a.id)]?.name} ${(a.prob * 100).toFixed(0)}%`)
                                        .join(' / ')}
                                </div>
                                <div style={{ color: '#4b6478' }}>
                                    数据源：elements.data 表 213（书）/ 214（属性池 + 条数 + 五档 + 技能概率）/ 215（技能等级概率）。洗练次数上限 10，可用「轩辕拾遗录」提至 25；青龙·英雄 / 白虎·英雄 可至 30。
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default XycWashCard;

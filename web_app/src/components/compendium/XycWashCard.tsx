import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCw } from 'lucide-react';
import clsx from 'clsx';
import { DataService } from '../../services/DataService';
import {
    WASH_ITEMS,
    attrValueAt,
    canRollSkill,
    formatAttrValue,
    getPool,
    identifyBook,
    makeRng,
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
 * （鉴定 / 升级 / 分解 / 洗炼）。版本 / 门派收在左窗同一行，点「洗炼」才展开右侧洗练窗
 * （大衍奇术 / 一元道契 / 太乙宝函 三键并排 + 读条）。
 *
 * 数据：`/game_data/xyc_refine.json`（脚本 `scripts/build_xyc_refine_data.mjs`
 * 从客户端 elements.data 表 213/214/215 解包，含条数概率 / 五档概率 / 12 条属性出现概率 / 技能等级概率）
 */

const SIM_FONT = '"SimSun", "宋体", "Microsoft YaHei", sans-serif';

/** 单次洗练读条时长（对齐天缘模拟器 REFINE_MS） */
const WASH_MS = 1000;
/** 左窗「鉴定」读条时长 */
const IDENTIFY_MS = 1000;
/** 左窗「升级」读条时长（比鉴定快） */
const UPGRADE_MS = 500;
/** 品阶固定六品（2026-10-26 用户要求删除品阶选择行） */
const GRADE = 6;

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

/** 游戏 tooltip 配色：书名金 / 警示橙 / 属性蓝（六品与进阶技能同色）/ 品阶淡蓝（属性行禁止符号） */
const C_BOOK = '#ffb14d';
const C_WARN = '#ff6a3d';
const C_STAT = '#8080ff';
const C_GRADE = '#7fb2ff';
/** 洗练次数 / 等级等中性信息：与其它信息卡一致的白 */
const C_WHITE = '#ffffff';

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

/** 已展开态：与禁用灰同色，但仍可点击（再点收起） */
const MUTED_BTN: React.CSSProperties = {
    ...btnStyle(false),
    cursor: 'pointer',
};

/** 游戏里属性行前的「⊘」圆形禁止符号 */
const SlotMark: React.FC = () => (
    <svg width="12" height="12" viewBox="0 0 16 16" className="shrink-0 mr-1" style={{ display: 'inline-block', verticalAlign: '-1px' }}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke={C_GRADE} strokeWidth="1.3" />
        <line x1="3.9" y1="12.1" x2="12.1" y2="3.9" stroke={C_GRADE} strokeWidth="1.3" />
    </svg>
);

/** 本次洗练的属性变化行（结构化，便于排版） */
interface ChangeLine {
    name: string;
    from: string;
    to: string;
    isSkill?: boolean;
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
/** 典藏版已下线（2026-10-26），只保留 普通 / 英雄 */
const VERSION_ORDER: XycVersion[] = ['普通', '英雄'];

/** 四系 × 普通/英雄 的策书图标（2026-10-26 用户提供） */
const BOOK_ICONS: Record<string, string> = {
    '青龙|0': '/game_data/equip_icons/xyc_qinglong.png',
    '青龙|1': '/game_data/equip_icons/xyc_qinglong_hero.png',
    '白虎|0': '/game_data/equip_icons/xyc_baihu.png',
    '白虎|1': '/game_data/equip_icons/xyc_baihu_hero.png',
    '朱雀|0': '/game_data/equip_icons/xyc_zhuque.png',
    '朱雀|1': '/game_data/equip_icons/xyc_zhuque_hero.png',
    '玄武|0': '/game_data/equip_icons/xyc_xuanwu.png',
    '玄武|1': '/game_data/equip_icons/xyc_xuanwu_hero.png',
};
const OCC_ORDER = ['鬼王', '青云', '合欢', '天音', '鬼道', '焚香', '九黎', '烈山', '怀光', '天华', '辰皇', '太昊', '牵机', '英招', '破军', '青罗', '归云', '画影', '逐霜', '惊岚', '昭冥', '涅羽', '百灵', '长生堂', '万毒', '炼血', '释罗'];

/** 三种洗练道具图标（客户端物品 id：68829 / 68830 / 68828） */
const ITEM_ICONS: Record<XycWashMode, { src: string; ch: string }> = {
    attr: { src: '/game_data/equip_icons/xyc_item_68829.png', ch: '术' },
    skill: { src: '/game_data/equip_icons/xyc_item_68830.png', ch: '契' },
    both: { src: '/game_data/equip_icons/xyc_item_68828.png', ch: '函' },
};

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
    const [occ, setOcc] = useState<string>(OCC_ORDER.includes(cardData?.initialOcc || '') ? cardData!.initialOcc! : '鬼王');
    const [level, setLevel] = useState<number>(() => {
        const lv = cardData?.initialLevel;
        return typeof lv === 'number' ? Math.min(20, Math.max(1, lv)) : 1;
    });

    const [book, setBook] = useState<XycBook | null>(null);
    const [mode, setMode] = useState<XycWashMode>('attr');
    const [changeLines, setChangeLines] = useState<ChangeLine[]>([]);
    const [changeSeq, setChangeSeq] = useState(0);
    /** 右侧洗练窗默认收起，点左窗「洗炼」才展开 */
    const [washOpen, setWashOpen] = useState(false);

    /** 读条（对齐天缘模拟器：busy + barFill/barAnim） */
    const [busy, setBusy] = useState(false);
    const [barFill, setBarFill] = useState(0);
    const [barAnim, setBarAnim] = useState(false);
    const busyRef = useRef(false);
    const timerRef = useRef<number | null>(null);
    const barRef = useRef<number | null>(null);

    /** 左窗「鉴定 / 升级」读条 */
    const [leftBusy, setLeftBusy] = useState(false);
    const [leftFill, setLeftFill] = useState(0);
    const [leftAnim, setLeftAnim] = useState(false);
    const [leftDur, setLeftDur] = useState(IDENTIFY_MS);
    const leftBusyRef = useRef(false);
    const leftTimerRef = useRef<number | null>(null);
    const leftBarRef = useRef<number | null>(null);

    const rngRef = useRef(makeRng((Date.now() ^ 0x5f3a) >>> 0));
    /** 洗练过程中的最新书（避免闭包拿到旧 state） */
    const bookRef = useRef<XycBook | null>(null);
    /** 本次洗练的起点快照：id → 变化前数值 */
    const accRef = useRef<Map<number, number | null>>(new Map());
    const skillAccRef = useRef<{ before: string | null } | null>(null);

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

    const pool = useMemo(() => (data ? getPool(data, version, beast, GRADE) : null), [data, version, beast]);

    useEffect(() => {
        bookRef.current = book;
    }, [book]);

    const regenerate = useCallback(() => {
        if (!data) return;
        const next = identifyBook(data, { version, beast, grade: GRADE, level, occ }, rngRef.current);
        setBook(next);
        bookRef.current = next;
        setChangeLines([]);
    }, [data, version, beast, level, occ]);

    // 数据/配置变化后重新鉴定（等级变化不重置书，只改显示）
    const identKey = `${version}|${beast}|${occ}`;
    useEffect(() => {
        if (!data) return;
        regenerate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, identKey]);

    useEffect(() => {
        setBook((prev) => (prev ? { ...prev, level } : prev));
    }, [level]);

    const stopBar = useCallback(() => {
        busyRef.current = false;
        setBusy(false);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (barRef.current) {
            window.clearTimeout(barRef.current);
            barRef.current = null;
        }
        setBarFill(0);
        setBarAnim(false);
    }, []);

    /** 一轮洗练跑完：清计时器、解除忙碌，但读条停在满格（与天缘一致） */
    const finishBar = useCallback(() => {
        busyRef.current = false;
        setBusy(false);
        if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (barRef.current) {
            window.clearTimeout(barRef.current);
            barRef.current = null;
        }
    }, []);

    useEffect(() => stopBar, [stopBar]);

    const stopLeftBar = useCallback(() => {
        leftBusyRef.current = false;
        setLeftBusy(false);
        if (leftTimerRef.current) {
            window.clearTimeout(leftTimerRef.current);
            leftTimerRef.current = null;
        }
        if (leftBarRef.current) {
            window.clearTimeout(leftBarRef.current);
            leftBarRef.current = null;
        }
        setLeftFill(0);
        setLeftAnim(false);
    }, []);

    useEffect(() => stopLeftBar, [stopLeftBar]);

    /** 左窗读条：跑满后执行 onDone，进度条停在满格 */
    const runLeftBar = useCallback((ms: number, onDone: () => void) => {
        if (busyRef.current || leftBusyRef.current) return;
        leftBusyRef.current = true;
        setLeftBusy(true);
        setLeftDur(ms);
        setLeftAnim(false);
        setLeftFill(0);
        leftBarRef.current = window.setTimeout(() => {
            leftBarRef.current = null;
            setLeftAnim(true);
            setLeftFill(1);
        }, 20);
        leftTimerRef.current = window.setTimeout(() => {
            leftTimerRef.current = null;
            onDone();
            leftBusyRef.current = false;
            setLeftBusy(false);
        }, ms);
    }, []);

    const skillEligible = data ? canRollSkill(data, beast, GRADE, book?.attrCount ?? 0) : false;
    /** 剩余可洗次数：用满后必须消耗「轩辕拾遗录」提升上限 */
    const washLeft = book ? Math.max(0, book.washMax - book.washUsed) : 0;
    const canWash = Boolean(book) && washLeft > 0 && (mode !== 'skill' || skillEligible);

    const toggleWash = useCallback(() => {
        setWashOpen((prev) => {
            const next = !prev;
            if (next) {
                requestAnimationFrame(() => {
                    document.getElementById('xyc-wash-anchor')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            }
            return next;
        });
    }, []);

    /** 把本次累计快照与当前书对比，生成「本次洗练属性变化」 */
    const buildChangeLines = useCallback((): ChangeLine[] => {
        const cur = bookRef.current;
        if (!data || !cur || !pool) return [];
        const finalMap = new Map(cur.attrs.map((a) => [a.id, a.base]));
        const out: ChangeLine[] = [];
        for (const [id, before] of accRef.current) {
            const after = finalMap.has(id) ? finalMap.get(id)! : null;
            if (before === null && after === null) continue;
            if (before !== null && after !== null && Math.abs(before - after) < 1e-9) continue;
            const def = data.attrs[String(id)];
            if (!def) continue;
            const step = pool.attrs.find((a) => a.id === id)?.step ?? 0;
            out.push({
                name: def.name,
                from: before === null ? '—' : formatAttrValue(data, id, before + step * cur.level),
                to: after === null ? '—' : formatAttrValue(data, id, after + step * cur.level),
            });
        }
        const curSkill = cur.skill ? `${cur.skill.name} ${cur.skill.level}级` : '无';
        if (skillAccRef.current && skillAccRef.current.before !== curSkill) {
            out.push({ name: '进阶技能', from: skillAccRef.current.before ?? '无', to: curSkill, isSkill: true });
        }
        return out;
    }, [data, pool]);

    /** 执行一手洗练（不动读条） */
    const applyOneWash = useCallback((): boolean => {
        const cur = bookRef.current;
        if (!data || !cur) return false;
        if (cur.washUsed >= cur.washMax) return false;
        if (mode === 'skill' && !canRollSkill(data, cur.beast, cur.grade, cur.attrCount)) return false;
        const res = washBook(data, cur, mode, occ, rngRef.current);
        bookRef.current = res.book;
        setBook(res.book);
        for (const ch of res.changed) {
            if (ch.kind === 'attr') {
                if (!accRef.current.has(ch.id)) accRef.current.set(ch.id, ch.before);
            } else if (!skillAccRef.current) {
                skillAccRef.current = { before: ch.before };
            }
        }
        return true;
    }, [data, mode, occ]);

    /** 洗练：逐次读条（单次 1 手，连洗最多 10 手），对齐天缘模拟器节奏 */
    const runWash = useCallback(
        (times: number) => {
            if (busyRef.current || !data || !bookRef.current) return;
            accRef.current = new Map();
            skillAccRef.current = null;
            setChangeLines([]);
            busyRef.current = true;
            setBusy(true);

            let remaining = times;
            const step = () => {
                if (!busyRef.current) return;
                const cur = bookRef.current;
                const blocked =
                    !cur ||
                    cur.washUsed >= cur.washMax ||
                    (mode === 'skill' && !canRollSkill(data, cur.beast, cur.grade, cur.attrCount));
                if (remaining <= 0 || blocked) {
                    finishBar();
                    setChangeLines(buildChangeLines());
                    setChangeSeq((s) => s + 1);
                    return;
                }

                setBarAnim(false);
                setBarFill(0);
                barRef.current = window.setTimeout(() => {
                    barRef.current = null;
                    setBarAnim(true);
                    setBarFill(1);
                }, 20);

                timerRef.current = window.setTimeout(() => {
                    timerRef.current = null;
                    applyOneWash();
                    remaining -= 1;
                    setChangeLines(buildChangeLines());
                    setChangeSeq((s) => s + 1);
                    step();
                }, WASH_MS);
            };
            step();
        },
        [data, mode, applyOneWash, buildChangeLines, finishBar]
    );

    const raiseWashMax = useCallback(() => {
        if (!data) return;
        setBook((prev) => {
            if (!prev) return prev;
            const heroBeast = prev.version === '英雄' && ['青龙', '白虎'].includes(prev.beast);
            const cap = heroBeast ? data.meta.heroWashMaxWithItem : data.meta.washMaxWithItem;
            const next = { ...prev, washMax: Math.max(prev.washMax, cap) };
            bookRef.current = next;
            return next;
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
    const gradeName = data.meta.gradeNames[GRADE - 1] || '六品';
    const attrRows = book.attrs.map((roll) => {
        const def = data.attrs[String(roll.id)];
        const raw = attrValueAt(pool, roll, book.level);
        return { id: roll.id, name: def?.name || `属性${roll.id}`, text: formatAttrValue(data, roll.id, raw) };
    });
    const heroBeast = book.version === '英雄' && ['青龙', '白虎'].includes(book.beast);
    const washCap = heroBeast ? data.meta.heroWashMaxWithItem : data.meta.washMaxWithItem;
    /** 洗练次数用满后，才允许消耗「轩辕拾遗录」提升上限 */
    const canRaiseMax = washLeft === 0 && book.washMax < washCap;
    const nextWashCap = Math.max(book.washMax, washCap);

    return (
        <div className={clsx('@container w-full min-w-0', className)}>
            <style>{`
                @container (min-width: 800px) {
                    .xyc-layout { flex-direction: row !important; align-items: flex-start !important; }
                    .xyc-left { width: 460px !important; max-width: 460px !important; flex: 0 0 460px !important; }
                    .xyc-right { width: 300px !important; max-width: 300px !important; flex: 0 0 300px !important; }
                }
                @container (max-width: 799px) {
                    .xyc-layout { flex-direction: column !important; }
                    .xyc-left, .xyc-right { width: 100% !important; max-width: 100% !important; }
                }
                /* 桌面分屏（面板 400~520）：左边距收窄，保住技能行 12px 不缩、不折行 */
                @container (max-width: 470px) {
                    .xyc-book-body { margin-left: 18px !important; }
                }
                /* 手机窄屏才缩图标与左边距 */
                @container (max-width: 340px) {
                    .xyc-book-icon { width: 72px !important; height: 72px !important; }
                    .xyc-book-body { margin-left: 12px !important; }
                    .xyc-skill-line { font-size: 11px !important; }
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

                    {/* 版本 + 门派（同一行，无文字标签；下拉样式对齐蕴灵模拟器） */}
                    <div className="flex items-center gap-1.5 px-2.5 py-2" style={{ borderBottom: '1px solid #2a4054', background: '#0b141c' }}>
                        {VERSION_ORDER.map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setVersion(v)}
                                className="px-2.5 py-1 rounded-[3px] text-[12px] cursor-pointer whitespace-nowrap"
                                style={tabStyle(v === version)}
                            >
                                {v}
                            </button>
                        ))}
                        <select
                            value={occ}
                            onChange={(e) => setOcc(e.target.value)}
                            className="ml-auto h-[26px] w-[104px] px-1.5 text-[12.5px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0] cursor-pointer shrink-0"
                            style={{ fontFamily: SIM_FONT }}
                            title="门派：决定进阶技能从哪个门派的技能池里抽"
                        >
                            {OCC_ORDER.map((o) => (
                                <option key={o} value={o}>
                                    {o}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 图标 + tooltip：属性块在图标右侧空间里居中，两侧留白均分（不再贴左导致右边空一大片） */}
                    <div className="p-2.5 flex min-w-0">
                        <div className="xyc-book-icon relative w-[120px] h-[120px] shrink-0 rounded-[3px] overflow-hidden">
                            <img
                                src={BOOK_ICONS[`${beast}|${version === '英雄' ? 1 : 0}`] || '/game_data/equip_icons/xyc_book.png'}
                                alt={bookName}
                                className="w-full h-full object-contain"
                                style={{ imageRendering: 'pixelated' }}
                                onError={(e) => {
                                    e.currentTarget.style.visibility = 'hidden';
                                }}
                            />
                        </div>

                        <div className="xyc-book-body ml-10 flex-1 min-w-0 flex flex-col gap-0.5 text-[13px] leading-[21px]">
                            <div style={{ color: C_BOOK }} className="flex flex-wrap items-baseline">
                                <span>
                                    {beast}&lt;{bookName}&gt;
                                </span>
                                {version === '英雄' && <span style={{ color: '#ffd272', whiteSpace: 'nowrap' }}>·英雄版</span>}
                            </div>
                            <div style={{ color: C_WARN }} className="text-[12px]">
                                不会掉落
                            </div>
                            <div style={{ color: C_STAT }} className="text-[12px] flex items-center gap-1">
                                <span>{gradeName}</span>
                                <span style={{ color: '#ffdc50' }}>★★★</span>
                            </div>
                            <div style={{ color: C_WHITE }} className="text-[12px]">
                                洗练次数 {book.washUsed}/{book.washMax}
                            </div>
                            <div style={{ color: C_WHITE }} className="text-[12px]">
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

                            {book.skill && (
                                <div className="xyc-skill-line text-[12px] mt-0.5 break-words" style={{ color: C_STAT }}>
                                    （进阶技能）{book.skill.name} {book.skill.level}级
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 底部读条 + 四键（对应游戏：鉴定 / 升级 / 分解 / 洗炼） */}
                    <div className="px-2.5 pb-2.5" style={{ borderTop: '1px solid #2a4054', paddingTop: 8 }}>
                        <div
                            className="relative overflow-hidden w-full mb-2"
                            style={{
                                height: 10,
                                borderRadius: 999,
                                background: '#081219',
                                border: `1px solid ${leftBusy ? '#389bb5' : '#182b38'}`,
                                boxShadow: leftBusy
                                    ? 'inset 0 0 6px rgba(0,200,220,0.3), 0 0 8px rgba(0,200,220,0.4)'
                                    : 'inset 0 1px 3px rgba(0,0,0,0.8)',
                                transition: 'border-color .15s, box-shadow .15s',
                            }}
                        >
                            <div
                                style={{
                                    height: '100%',
                                    width: `${Math.round(leftFill * 100)}%`,
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #0c7585 0%, #15b8cf 50%, #46e8fb 100%)',
                                    boxShadow: leftFill > 0 ? '0 0 8px rgba(30,220,245,0.7)' : 'none',
                                    transition: leftAnim ? `width ${leftDur - 20}ms linear` : 'none',
                                }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            <button
                                type="button"
                                onClick={() => runLeftBar(IDENTIFY_MS, regenerate)}
                                disabled={busy || leftBusy}
                                title="鉴定：重新随机属性条目与数值（洗练次数归零）"
                                style={{ ...btnStyle(!busy && !leftBusy), padding: '5px 0' }}
                            >
                                鉴定
                            </button>
                            <button
                                type="button"
                                onClick={() => runLeftBar(UPGRADE_MS, () => setLevel((v) => Math.min(data.meta.maxLevel, v + 1)))}
                                disabled={busy || leftBusy || book.level >= data.meta.maxLevel}
                                title="升级：属性数值按每级固定增益提升"
                                style={{ ...btnStyle(!busy && !leftBusy && book.level < data.meta.maxLevel), padding: '5px 0' }}
                            >
                                升级
                            </button>
                            <button type="button" disabled title="增加洗练次数：本站暂不模拟" style={{ ...btnStyle(false), padding: '5px 0' }}>
                                增加洗练次数
                            </button>
                            <button
                                type="button"
                                onClick={toggleWash}
                                disabled={busy || leftBusy}
                                title={washOpen ? '收起洗练面板' : '洗炼：展开右侧道具洗练面板'}
                                style={{
                                    ...(washOpen && !busy && !leftBusy ? MUTED_BTN : btnStyle(!busy && !leftBusy)),
                                    padding: '5px 0',
                                }}
                            >
                                洗炼
                            </button>
                        </div>
                    </div>
                </div>

                {/* ───────── 窗口 2：洗练（点「洗炼」才展开） ───────── */}
                {washOpen && (
                    <div id="xyc-wash-anchor" className="xyc-right w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE}>
                        <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                            <span style={TITLE_TEXT_STYLE}>洗 练</span>
                        </div>

                        {/* 三种洗练道具：只放图标，点图标切换，选中态高亮 */}
                        <div className="px-3 py-3 flex items-center justify-center gap-5" style={{ borderBottom: '1px solid #2a4054' }}>
                            {WASH_ITEMS.map((it) => {
                                const active = it.mode === mode;
                                const blocked = it.mode === 'skill' && !skillEligible;
                                const icon = ITEM_ICONS[it.mode];
                                return (
                                    <button
                                        key={it.mode}
                                        type="button"
                                        onClick={() => setMode(it.mode)}
                                        disabled={busy || leftBusy}
                                        title={`${it.name} · ${it.short}：${it.desc}`}
                                        className="relative w-11 h-11 rounded-[2px] overflow-hidden flex items-center justify-center cursor-pointer transition-all disabled:cursor-not-allowed"
                                        style={{
                                            background: active
                                                ? 'linear-gradient(180deg, #1b3348 0%, #12212e 100%)'
                                                : 'linear-gradient(180deg, #0d1922 0%, #070d13 100%)',
                                            border: `1px solid ${active ? '#5f8fc9' : '#22303f'}`,
                                            boxShadow: active
                                                ? '0 0 10px rgba(70,232,251,0.35), inset 0 1px 0 rgba(255,255,255,0.12)'
                                                : 'inset 0 1px 3px rgba(0,0,0,0.6)',
                                            opacity: blocked || busy ? 0.45 : 1,
                                        }}
                                    >
                                        <span
                                            className="absolute inset-0 flex items-center justify-center text-[14px]"
                                            style={{ color: active ? '#8fb0c8' : '#3d5a72', fontFamily: SIM_FONT }}
                                        >
                                            {icon.ch}
                                        </span>
                                        <img
                                            src={icon.src}
                                            alt={it.name}
                                            className="relative w-full h-full object-contain"
                                            style={{ imageRendering: 'pixelated' }}
                                            onError={(e) => {
                                                e.currentTarget.style.opacity = '0';
                                            }}
                                        />
                                    </button>
                                );
                            })}
                        </div>

                        {/* 操作区 */}
                        <div className="px-3 py-2 flex flex-col gap-2">
                            {/* 读条（对齐天缘模拟器） */}
                            <div
                                className="relative overflow-hidden w-full"
                                style={{
                                    height: 10,
                                    borderRadius: 999,
                                    background: '#081219',
                                    border: `1px solid ${busy ? '#389bb5' : '#182b38'}`,
                                    boxShadow: busy
                                        ? 'inset 0 0 6px rgba(0,200,220,0.3), 0 0 8px rgba(0,200,220,0.4)'
                                        : 'inset 0 1px 3px rgba(0,0,0,0.8)',
                                    transition: 'border-color .15s, box-shadow .15s',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        width: `${Math.round(barFill * 100)}%`,
                                        borderRadius: 999,
                                        background: 'linear-gradient(90deg, #0c7585 0%, #15b8cf 50%, #46e8fb 100%)',
                                        boxShadow: barFill > 0 ? '0 0 8px rgba(30,220,245,0.7)' : 'none',
                                        transition: barAnim ? `width ${WASH_MS - 20}ms linear` : 'none',
                                    }}
                                />
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => runWash(1)}
                                    disabled={!canWash || busy || leftBusy}
                                    className="flex-1 py-1.5 rounded-[3px] text-[12.5px] font-bold"
                                    style={btnStyle(canWash && !busy && !leftBusy)}
                                >
                                    洗练一次
                                </button>
                                <button
                                    type="button"
                                    onClick={() => runWash(10)}
                                    disabled={!canWash || busy || leftBusy}
                                    className="flex-1 py-1.5 rounded-[3px] text-[12.5px] font-bold"
                                    style={btnStyle(canWash && !busy && !leftBusy)}
                                >
                                    连洗 10
                                </button>
                            </div>

                            {canRaiseMax && (
                                <button
                                    type="button"
                                    onClick={raiseWashMax}
                                    className="w-full py-1 rounded-[3px] text-[11.5px] cursor-pointer"
                                    style={{ background: '#241a2e', border: '1px solid #5a4a7a', color: '#d8c7ff' }}
                                    title="洗练次数已用满，消耗「轩辕拾遗录」提升洗练次数上限"
                                >
                                    使用轩辕拾遗录（洗练上限 {book.washMax} → {nextWashCap}）
                                </button>
                            )}

                            {/* 本次洗练属性变化 */}
                            {changeLines.length > 0 && (
                                <div
                                    key={changeSeq}
                                    className="rounded-[3px] overflow-hidden animate-in fade-in duration-150"
                                    style={{
                                        border: '1px solid #2a4054',
                                        background: 'linear-gradient(180deg, rgba(20,32,46,0.95) 0%, rgba(10,16,24,0.95) 100%)',
                                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                                    }}
                                >
                                    <div
                                        className="flex items-center gap-1.5 px-2.5 py-[5px]"
                                        style={{ borderBottom: '1px solid #1e2d3d', background: 'linear-gradient(180deg, rgba(38,62,88,0.45) 0%, rgba(20,32,46,0.2) 100%)' }}
                                    >
                                        <span
                                            className="text-[12.5px] font-bold tracking-wide"
                                            style={{
                                                color: '#f7f4bb',
                                                fontFamily: SIM_FONT,
                                                textShadow: '0 0 10px rgba(247,244,187,0.35), 0 1px 2px #000000',
                                            }}
                                        >
                                            本次洗练属性变化：
                                        </span>
                                    </div>
                                    <div className="px-2.5 py-1.5 flex flex-col gap-[3px]">
                                        {changeLines.map((line, i) => (
                                            <div key={i} className="flex items-baseline gap-2 min-w-0 text-[11.5px] leading-[18px]">
                                                <span
                                                    className="shrink-0 w-[96px] truncate"
                                                    style={{ color: line.isSkill ? '#9adfff' : C_STAT }}
                                                >
                                                    {line.name}
                                                </span>
                                                <span className="flex items-baseline gap-1 font-mono min-w-0">
                                                    <span style={{ color: '#5b7894' }}>{line.from}</span>
                                                    <span style={{ color: '#3d6382' }}>→</span>
                                                    <span style={{ color: line.to === '—' ? '#5b7894' : '#dbe7f5', fontWeight: 700 }}>{line.to}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default XycWashCard;

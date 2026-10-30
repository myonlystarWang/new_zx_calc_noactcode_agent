import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Square, X, Share2 } from 'lucide-react';
import { XycTomeDetailCard } from './XycTomeDetailCard';
import { useDomShare } from '../share/useDomShare';
import clsx from 'clsx';
import { DataService } from '../../services/DataService';
import {
    WASH_ITEMS,
    SPECIAL_WASH_LOCK_MAX,
    attrValueAt,
    canRollSkill,
    formatAttrValue,
    getPool,
    identifyBook,
    inSpecialWash,
    makeRng,
    nextWashStep,
    washMaxStages,
    specialSkillOptions,
    specialWash,
    specialWashLeft,
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
/** 「升级失败」红字停留时长（只提示失败本身，不带等级/概率） */
const UPGRADE_TIP_MS = 500;
/**
 * 升级成功率表：下标 = 当前等级（0~19），值 = 升到下一级的成功率。
 * 等级越高越难升：0→1 95% 起步，逐级递减到 19→20 的 15%。
 * 客户端 elements.data 表 213/214/215 未暴露这张表，数值为本站设定；
 * 若拿到官方概率，直接改这一行即可（长度须为 20）。
 */
const UPGRADE_RATES = [
    0.95, 0.92, 0.89, 0.86, 0.82, 0.78, 0.74, 0.7, 0.65, 0.6,
    0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.26, 0.22, 0.18, 0.15,
];

/** 当前等级对应的升级成功率（满级沿用最后一项，仅用于文案展示） */
function upgradeRateAt(level: number): number {
    return UPGRADE_RATES[Math.min(Math.max(level, 0), UPGRADE_RATES.length - 1)];
}
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

/**
 * 按钮样式：**文字口径与神机锻造卡完全一致**
 * （13px · font-weight 500 · letter-spacing 0.05em · 启用 #edf5fc / 禁用 #4a657c），
 * 底色/描边也用神机那套蓝灰金属。原先轩辕策自用一套偏青的配色 + 无字距无字重，
 * 两卡并排时按钮文字观感不一致（2026-10-26 用户反馈）。
 */
function btnStyle(enabled: boolean, tone: 'normal' | 'danger' = 'normal'): React.CSSProperties {
    if (!enabled) {
        return {
            background: 'rgba(16, 26, 36, 0.6)',
            border: '1px solid #203244',
            color: '#4a657c',
            borderRadius: 3,
            fontFamily: SIM_FONT,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.05em',
            cursor: 'not-allowed',
        };
    }
    if (tone === 'danger') {
        return {
            background: 'linear-gradient(180deg, #872e22 0%, #4f1710 100%)',
            border: '1px solid #b34739',
            color: '#ffffff',
            borderRadius: 3,
            fontFamily: SIM_FONT,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            boxShadow: '0 0 12px rgba(220,60,40,0.5), inset 0 1px 0 rgba(255,255,255,0.2)',
        };
    }
    return {
        background: 'linear-gradient(180deg, #274563 0%, #142a3d 100%)',
        border: '1px solid #3c678f',
        color: '#edf5fc',
        borderRadius: 3,
        fontFamily: SIM_FONT,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '0.05em',
        cursor: 'pointer',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)',
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
    /** 变化方向：1 提升（绿）/ -1 下降（红）/ 0 无（技能行等） */
    dir?: 1 | -1 | 0;
    /** 增量文案：+371 / −1.6% / 新增 / 移除 */
    deltaStr?: string;
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
    /** 底部「轩辕策信息卡」展开态 + 懒加载的规则数据（与新天缘精炼卡同款交互） */
    const [showInfo, setShowInfo] = useState(false);
    const [tomeData, setTomeData] = useState<{ rules: any; meta: any } | null>(null);

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
        return typeof lv === 'number' ? Math.min(20, Math.max(0, lv)) : 0;
    });

    const [book, setBook] = useState<XycBook | null>(null);
    const [mode, setMode] = useState<XycWashMode>('attr');
    const [changeLines, setChangeLines] = useState<ChangeLine[]>([]);
    const [changeSeq, setChangeSeq] = useState(0);
    /** 升级失败提示（0.5s 后自动消失；固定高度占位，不顶动布局） */
    const [upgradeTip, setUpgradeTip] = useState<string | null>(null);
    /** 上限提升成功提示（消耗了哪种轩辕拾遗录、上限从多少到多少），绿色，与失败的红色提示共用同一行 */
    const [raiseTip, setRaiseTip] = useState<string | null>(null);
    /** 右侧洗练窗默认收起，点左窗「洗炼」才展开 */
    const [washOpen, setWashOpen] = useState(false);
    /** 特殊洗练：锁定的属性 id（≤2，点左窗属性行切换）与自选的必得技能 id */
    const [lockIds, setLockIds] = useState<number[]>([]);
    const [specialSkillId, setSpecialSkillId] = useState<number | null>(null);
    const lockRef = useRef<number[]>([]);
    const skillSelRef = useRef<number | null>(null);
    const setLocks = useCallback((ids: number[]) => {
        lockRef.current = ids;
        setLockIds(ids);
    }, []);
    const setSkillSel = useCallback((id: number | null) => {
        skillSelRef.current = id;
        setSpecialSkillId(id);
    }, []);

    /** 读条（对齐天缘模拟器：busy + barFill/barAnim） */
    const [busy, setBusy] = useState(false);
    /** 连续洗练：自动循环，直到次数用尽或手动「停止」（对齐新天缘连续精炼） */
    const [auto, setAuto] = useState(false);
    const [barFill, setBarFill] = useState(0);
    const [barAnim, setBarAnim] = useState(false);
    const busyRef = useRef(false);
    const autoRef = useRef(false);
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

    /** 鉴定 = 换一本新的：属性重掷 + 洗练次数归零 + **等级归 0**（升到 20 靠「升级」逐级点） */
    const regenerate = useCallback(() => {
        if (!data) return;
        autoRef.current = false;
        setAuto(false);
        setUpgradeTip(null);
        const next = identifyBook(data, { version, beast, grade: GRADE, level: 0, occ }, rngRef.current);
        setBook(next);
        bookRef.current = next;
        setChangeLines([]);
        setLevel(0);
        // 换书后旧的锁定词条已不存在，特殊洗练的自选技能也按新书重置
        setLocks([]);
        setSkillSel(null);
    }, [data, version, beast, occ, setLocks, setSkillSel]);

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

    /** 特殊洗练：锁定项随书变化自动剪枝（普通洗练会把未锁词条整组换掉） */
    useEffect(() => {
        if (!book) return;
        const valid = lockRef.current.filter((id) => book.attrs.some((a) => a.id === id));
        if (valid.length !== lockRef.current.length) setLocks(valid);
    }, [book, setLocks]);

    /** 特殊洗练：保证自选技能落在当前 青龙/白虎 × 职业 的技能池里（切门派、切系别、换书都重建） */
    useEffect(() => {
        if (!data) return;
        const list = specialSkillOptions(data, beast, occ);
        const cur = skillSelRef.current;
        if (list.length === 0) {
            if (cur !== null) setSkillSel(null);
            return;
        }
        if (cur !== null && list.some((s) => s.id === cur)) return;
        const onBook = bookRef.current?.skill;
        const prefer = onBook && list.some((s) => s.id === onBook.id) ? onBook.id : list[0].id;
        setSkillSel(prefer);
    }, [data, beast, occ, book, setSkillSel]);

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

    /** 一轮洗练跑完：清计时器、解除忙碌（读条已在 washOnce 里瞬间清空） */
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

    useEffect(
        () => () => {
            autoRef.current = false;
            stopBar();
        },
        [stopBar],
    );

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

    /** 左窗读条：跑满后瞬间清空，再执行 onDone（不做满→空回落动画） */
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
            leftBusyRef.current = false;
            setLeftBusy(false);
            // 读条跑满后瞬间清空（不做满→空回落动画），再执行 onDone
            setLeftAnim(false);
            setLeftFill(0);
            onDone();
        }, ms);
    }, []);

    const skillEligible = data ? canRollSkill(data, beast, GRADE, book?.attrCount ?? 0) : false;
    /** 剩余可洗次数：用满后必须消耗「轩辕拾遗录」提升上限 */
    const washLeft = book ? Math.max(0, book.washMax - book.washUsed) : 0;
    /** 特殊洗练区间：青龙/白虎 英雄版 且 已洗满 25 次（上限须先由「相易」提到 30） */
    const specialMode = Boolean(book && inSpecialWash(book));
    const specialLeft = book ? specialWashLeft(book) : 0;
    /** 特殊洗练可选技能（本职业 3 级技能） */
    const specialSkills = useMemo(() => (data ? specialSkillOptions(data, beast, occ) : []), [data, beast, occ]);
    const toggleLock = useCallback(
        (id: number) => {
            if (busyRef.current || leftBusyRef.current) return;
            const cur = lockRef.current;
            if (cur.includes(id)) {
                setLocks(cur.filter((x) => x !== id));
                return;
            }
            if (cur.length >= SPECIAL_WASH_LOCK_MAX) return;
            setLocks([...cur, id]);
        },
        [setLocks],
    );
    /** 特殊洗练不看道具模式（三道具同时消耗），但必须已选好必得技能 */
    const canWash = specialMode
        ? Boolean(book) && washLeft > 0 && specialSkillId !== null
        : Boolean(book) && washLeft > 0 && (mode !== 'skill' || skillEligible);

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

    /** 展开/收起底部「轩辕策信息卡」：首次展开时懒加载规则与书目元数据（不拖慢洗练卡首屏） */
    const toggleInfo = useCallback(async () => {
        if (!showInfo && !tomeData) {
            try {
                const [rules, meta] = await Promise.all([
                    DataService.getInstance().getXycRules(),
                    DataService.getInstance().getXycTomeMeta(),
                ]);
                setTomeData({ rules, meta });
            } catch {
                setTomeData(null);
            }
        }
        setShowInfo((v) => !v);
    }, [showInfo, tomeData]);


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
            const fromStr = before === null ? '—' : formatAttrValue(data, id, before + step * cur.level);
            const toStr = after === null ? '—' : formatAttrValue(data, id, after + step * cur.level);
            // 显示值完全一致（小数四舍五入后相同）的行没有意义，直接不列（如 33 → 33）
            if (before !== null && after !== null && fromStr === toStr) continue;
            // 变化方向与增量：新增/移除单独标记；数值差用「显示值」相减，避免与左右两列对不上
            let dir: 1 | -1 | 0 = 0;
            let deltaStr: string | undefined;
            if (before === null && after !== null) {
                dir = 1;
                deltaStr = '新增';
            } else if (before !== null && after === null) {
                dir = -1;
                deltaStr = '移除';
            } else {
                const numOf = (s: string) => {
                    const m = s.match(/-?\d+(?:\.\d+)?/);
                    return m ? parseFloat(m[0]) : null;
                };
                const a = numOf(fromStr);
                const b = numOf(toStr);
                if (a !== null && b !== null) {
                    const d = b - a;
                    if (Math.abs(d) > 0.049) {
                        dir = d > 0 ? 1 : -1;
                        const isPct = toStr.includes('%');
                        const abs = isPct ? Math.abs(d).toFixed(1) : String(Math.round(Math.abs(d)));
                        deltaStr = `${d > 0 ? '+' : '−'}${abs}${isPct ? '%' : ''}`;
                    }
                }
            }
            out.push({ name: def.name, from: fromStr, to: toStr, dir, deltaStr });
        }
        const curSkill = cur.skill ? `${cur.skill.name} ${cur.skill.level}级` : '无';
        // 展示只保留「书名+等级」（天空2级 / 碧海1级），避免整串太长换行；比较仍用完整串
        const shortSkill = (s: string | null): string => {
            if (!s) return '无';
            const m = s.match(/《(.+?)》\s*(\d+)级/);
            return m ? `${m[1]}${m[2]}级` : s;
        };
        if (skillAccRef.current && skillAccRef.current.before !== curSkill) {
            const fromS = shortSkill(skillAccRef.current.before);
            const toS = shortSkill(curSkill);
            // 方向按「技能等级升降」判定：升绿 / 降红 / 同级换书不判方向；习得与失去单独标记
            const lvOf = (s: string): number | null => {
                const m = s.match(/(\d+)级/);
                return m ? parseInt(m[1], 10) : null;
            };
            const lvA = lvOf(fromS);
            const lvB = lvOf(toS);
            let sDir: 1 | -1 | 0 = 0;
            let sDelta: string | undefined;
            if (fromS === '无' && toS !== '无') {
                sDir = 1;
                sDelta = '习得';
            } else if (toS === '无' && fromS !== '无') {
                sDir = -1;
                sDelta = '失去';
            } else if (lvA !== null && lvB !== null) {
                if (lvB > lvA) {
                    sDir = 1;
                    sDelta = `+${lvB - lvA}级`;
                } else if (lvB < lvA) {
                    sDir = -1;
                    sDelta = `−${lvA - lvB}级`;
                }
            }
            out.push({
                name: '进阶技能',
                from: fromS,
                to: toS,
                isSkill: true,
                dir: sDir,
                deltaStr: sDelta,
            });
        }
        return out;
    }, [data, pool]);

    /** 执行一手洗练（不动读条）：满 25 次后自动走特殊洗练分支 */
    const applyOneWash = useCallback((): boolean => {
        const cur = bookRef.current;
        if (!data || !cur) return false;
        if (cur.washUsed >= cur.washMax) return false;
        const special = inSpecialWash(cur);
        if (!special && mode === 'skill' && !canRollSkill(data, cur.beast, cur.grade, cur.attrCount)) return false;
        if (special && skillSelRef.current === null) return false;
        const res = special
            ? specialWash(data, cur, { lockIds: lockRef.current, skillId: skillSelRef.current }, occ, rngRef.current)
            : washBook(data, cur, mode, occ, rngRef.current);
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

    /** 还能不能再洗一手（次数用尽 / 技能洗练条件不满足） */
    const washBlocked = useCallback((): boolean => {
        const cur = bookRef.current;
        if (!data || !cur) return true;
        if (cur.washUsed >= cur.washMax) return true;
        if (inSpecialWash(cur)) return skillSelRef.current === null;
        if (mode === 'skill' && !canRollSkill(data, cur.beast, cur.grade, cur.attrCount)) return true;
        return false;
    }, [data, mode]);

    /** 开一轮洗练会话：清空「本次变化」累计，进入忙碌态 */
    const beginWashSession = useCallback(() => {
        accRef.current = new Map();
        skillAccRef.current = null;
        setChangeLines([]);
        busyRef.current = true;
        setBusy(true);
    }, []);

    /** 跑一手：起读条 → WASH_MS 后落结果并刷新变化行 → onDone */
    const washOnce = useCallback(
        (onDone: () => void) => {
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
                setChangeLines(buildChangeLines());
                setChangeSeq((s) => s + 1);
                // 读条跑满后瞬间清空（不做满→空回落动画）；先清再回调，连点会各自重新起条
                setBarAnim(false);
                setBarFill(0);
                onDone();
            }, WASH_MS);
        },
        [applyOneWash, buildChangeLines],
    );

    /** 单次洗练（读条一次即结束） */
    const runWash = useCallback(() => {
        if (busyRef.current || autoRef.current || !data || !bookRef.current) return;
        beginWashSession();
        if (washBlocked()) {
            finishBar();
            return;
        }
        washOnce(() => finishBar());
    }, [data, beginWashSession, washBlocked, washOnce, finishBar]);

    /** 连续洗练：不断开新的一手，直到次数用尽 / 条件不满足 / 点「停止」 */
    const toggleAuto = useCallback(() => {
        if (autoRef.current) {
            autoRef.current = false;
            setAuto(false);
            stopBar();
            return;
        }
        if (busyRef.current || leftBusyRef.current || !data || !bookRef.current) return;
        if (washBlocked()) return;
        beginWashSession();
        autoRef.current = true;
        setAuto(true);
        const loop = () => {
            if (!autoRef.current) return;
            // 洗到 25 次进入特殊洗练时自动停手：锁定哪两条、必得哪个技能要玩家自己选，
            // 不能连着把 5 次额度烧掉（这 5 次是整本最贵的部分）
            if (bookRef.current && inSpecialWash(bookRef.current)) {
                autoRef.current = false;
                setAuto(false);
                finishBar();
                return;
            }
            if (washBlocked()) {
                autoRef.current = false;
                setAuto(false);
                finishBar();
                return;
            }
            washOnce(() => {
                if (!autoRef.current) return;
                loop();
            });
        };
        loop();
    }, [data, beginWashSession, washBlocked, washOnce, finishBar, stopBar]);

    const raiseWashMax = useCallback(() => {
        if (!data) return;
        const cur = bookRef.current;
        if (!cur) return;
        // 次数没用满时不允许提升（游戏里「增加洗练次数」只在洗满后可用）
        if (cur.washUsed < cur.washMax) return;
        const step = nextWashStep(data, cur.version, cur.beast, cur.washMax);
        if (!step) return;
        const updated = { ...cur, washMax: step.to };
        bookRef.current = updated;
        setBook(updated);
        setRaiseTip(`消耗「${step.item}」· 上限 ${cur.washMax} → ${step.to}（+${step.add}）`);
        window.setTimeout(() => setRaiseTip(null), 2000);
    }, [data]);

    /** 分享：hook 必须挂在提前 return 之前 —— React hooks 规则，
        否则数据加载完成的那次渲染 hooks 数量变多，整页报「Rendered more hooks」直接崩。 */
    const shareCardRef = useRef<HTMLDivElement>(null);
    const { busy: shareBusy, share: shareDom } = useDomShare();

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

    const handleShareCard = () => {
        void shareDom({
            node: shareCardRef.current,
            kicker: '诛仙 3 · 轩辕策洗练模拟',
            name: `${beast}〈${bookName}〉`,
            mode: 'xyc',
            prefix: '轩辕策',
        });
    };

    const gradeName = data.meta.gradeNames[GRADE - 1] || '六品';
    const attrRows = book.attrs.map((roll) => {
        const def = data.attrs[String(roll.id)];
        const raw = attrValueAt(pool, roll, book.level);
        return { id: roll.id, name: def?.name || `属性${roll.id}`, text: formatAttrValue(data, roll.id, raw) };
    });
    /** 本策最终能达到的上限（青龙/白虎英雄版 30，其余 25） */
    const washCap = washMaxStages(data, book.version, book.beast).at(-1) ?? data.meta.baseWashMax;
    /** 洗练次数用满后，才允许消耗「轩辕拾遗录」提升上限；一次只升一档，每档绑一种道具 */
    const nextStep = nextWashStep(data, book.version, book.beast, book.washMax);
    const canRaiseMax = washLeft === 0 && nextStep !== null;

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
                /* 属性 + 进阶技能是**一个整体**，左缘必须与属性行严格对齐 ——
                   所以不能用「技能行自己跨出去」的办法（会破坏左对齐）。
                   正确做法：文字列按「最长一行」取宽（width: max-content，等价于不换行时的宽度），
                   剩下的横向空间全部让给图标 —— 技能名越长，图标越小，文字列越宽。
                   图标留 40px 下限、左边距 14px，只有极端长名（19 字≈280px）才会退回换行。 */
                .xyc-book-body {
                    flex: 0 0 auto !important;
                    width: max-content !important;
                    max-width: calc(100% - 48px) !important;
                }
                .xyc-book-icon {
                    flex: 0 1 120px !important;
                    width: auto !important;
                    min-width: 36px !important;
                    height: auto !important;
                    aspect-ratio: 1 / 1 !important;
                    align-self: flex-start !important;
                }
                /* 桌面分屏（面板 400~520）：左边距收窄 */
                @container (max-width: 470px) {
                    .xyc-book-body { margin-left: 12px !important; }
                }
                /* 更窄（手机）：左右内边距各让 4px 出来给文字列，
                   360 视口下文字列才能从 209 涨到 217，容下「（进阶技能）玄阳火典III 《天空》 1级」(216)。 */
                @container (max-width: 340px) {
                    .xyc-book-row { padding-left: 6px !important; padding-right: 6px !important; }
                }
                /* 宽卡（PC 未分屏，书窗 460）：按钮组/读条不再锁 216，但也不铺满整卡，
                   收到 340（每键约 165）—— 比 216 舒展、又不至于像铺满时那样空。
                   两列间距仍是 gap-2.5(10px)，与神机/蕴灵两列按钮组一致。 */
                @container (min-width: 420px) {
                    .xyc-wide { max-width: 340px !important; }
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
                            <button
                                type="button"
                                onClick={handleShareCard}
                                disabled={shareBusy}
                                title={shareBusy ? '正在生成图片…' : '分享这张卡（长图）'}
                                className="transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                style={{ color: '#6ff0c8' }}
                            >
                                <Share2 className="w-3.5 h-3.5" />
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
                    <div ref={shareCardRef} data-share-root className="xyc-book-row p-2.5 flex min-w-0">
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
                                {version === '英雄' && <span style={{ whiteSpace: 'nowrap' }}>·英雄版</span>}
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
                            {specialMode && (
                                <div className="text-[12px]" style={{ color: '#ffbe50' }}>
                                    特殊洗练 · 剩 {specialLeft} 次
                                </div>
                            )}
                            <div style={{ color: C_WHITE }} className="text-[12px]">
                                等级 {book.level}
                            </div>

                            <div className="flex flex-col mt-0.5">
                                {attrRows.map((row, idx) => {
                                    const locked = lockIds.includes(row.id);
                                    const lockable = specialMode && !busy && !leftBusy;
                                    const full = lockIds.length >= SPECIAL_WASH_LOCK_MAX && !locked;
                                    return (
                                        <div
                                            key={`${row.id}-${idx}`}
                                            onClick={lockable ? () => toggleLock(row.id) : undefined}
                                            title={
                                                specialMode
                                                    ? locked
                                                        ? '点击取消锁定'
                                                        : full
                                                          ? `最多锁定 ${SPECIAL_WASH_LOCK_MAX} 条`
                                                          : '点击锁定这条属性（特殊洗练后不变）'
                                                    : undefined
                                            }
                                            className={clsx(
                                                'flex items-center min-w-0 rounded-[2px] -mx-1 px-1',
                                                lockable && (locked || !full) ? 'cursor-pointer' : undefined,
                                            )}
                                            style={{
                                                color: C_STAT,
                                                background: locked ? 'rgba(255,190,80,0.14)' : undefined,
                                                boxShadow: locked ? 'inset 0 0 0 1px rgba(255,190,80,0.45)' : undefined,
                                            }}
                                            data-xyc-attr={row.id}
                                            data-xyc-lock={locked ? '1' : undefined}
                                        >
                                            <SlotMark />
                                            <span className="truncate text-[12px] flex-1 min-w-0">
                                                {row.name} +{row.text}
                                            </span>
                                            {locked && (
                                                <span className="shrink-0 ml-1 text-[10.5px] leading-none" style={{ color: '#ffbe50' }}>
                                                    锁定
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {specialMode && (
                                <div className="text-[11px] mt-0.5 leading-[16px]" style={{ color: '#a8813c' }}>
                                    点属性行锁定（{lockIds.length}/{SPECIAL_WASH_LOCK_MAX}）
                                </div>
                            )}

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
                            className="relative overflow-hidden xyc-wide mx-auto w-full max-w-[216px] mb-2"
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

                        {/* 四键与神机锻造按钮组完全对齐：216 宽度轴、10px 间距（按钮各 103） */}
                        <div className="grid grid-cols-2 gap-2.5 xyc-wide mx-auto w-full max-w-[216px]">
                            <button
                                type="button"
                                onClick={() => runLeftBar(IDENTIFY_MS, regenerate)}
                                disabled={busy || leftBusy}
                                title="鉴定：重新随机属性条目与数值（洗练次数与等级归零）"
                                style={{ ...btnStyle(!busy && !leftBusy), padding: '6px 0' }}
                            >
                                鉴定
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    // 先跑读条，读条结束才判定成败（失败也要走完读条）
                                    runLeftBar(UPGRADE_MS, () => {
                                        const from = bookRef.current?.level ?? 0;
                                        if (Math.random() >= upgradeRateAt(from)) {
                                            setUpgradeTip('升级失败');
                                            window.setTimeout(() => setUpgradeTip(null), UPGRADE_TIP_MS);
                                            return;
                                        }
                                        setUpgradeTip(null);
                                        setLevel((v) => Math.min(data.meta.maxLevel, v + 1));
                                    });
                                }}
                                disabled={busy || leftBusy || book.level >= data.meta.maxLevel}
                                title={`升级：等级越高越难（当前 ${book.level} → ${Math.min(data.meta.maxLevel, book.level + 1)} 成功率 ${Math.round(upgradeRateAt(book.level) * 100)}%）`}
                                style={{ ...btnStyle(!busy && !leftBusy && book.level < data.meta.maxLevel), padding: '6px 0' }}
                            >
                                升级
                            </button>
                            <button
                                type="button"
                                onClick={raiseWashMax}
                                disabled={!canRaiseMax || busy || leftBusy}
                                title={
                                    canRaiseMax && nextStep
                                        ? `消耗 1 个「${nextStep.item}」：洗练上限 ${book.washMax} → ${nextStep.to}（+${nextStep.add} 次）\n同时激活六品轩辕策 ${nextStep.star} 星；该操作不改变属性与技能`
                                        : washLeft > 0
                                          ? '洗练次数用满后才能提升上限'
                                          : `当前上限已是 ${book.washMax} 次（本策上限 ${washCap} 次）`
                                }
                                style={{ ...btnStyle(canRaiseMax && !busy && !leftBusy), padding: '6px 0' }}
                            >
                                <span className="inline-flex items-center justify-center gap-1 min-w-0">
                                    {nextStep && (
                                        <img
                                            src={`/game_data/equip_icons/${nextStep.icon}`}
                                            alt={nextStep.item}
                                            className="w-[16px] h-[16px] object-contain shrink-0"
                                            style={{ imageRendering: 'pixelated' }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    )}
                                    <span className="whitespace-nowrap">增加洗练次数</span>
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={toggleWash}
                                disabled={busy || leftBusy}
                                title={washOpen ? '收起洗练面板' : '洗炼：展开右侧道具洗练面板'}
                                style={{
                                    ...(washOpen && !busy && !leftBusy ? MUTED_BTN : btnStyle(!busy && !leftBusy)),
                                    padding: '6px 0',
                                }}
                            >
                                洗炼
                            </button>
                        </div>

                        {/* 分享引导文案：紧随操作按钮下方 */}
                        <div
                            className="mt-1.5 text-center text-[11.5px] whitespace-nowrap select-none transition-colors"
                            style={{ color: (book?.washUsed ?? 0) > 0 ? '#86a8c7' : '#47637f' }}
                        >
                            点击右上角分享，一键生成高清长图
                        </div>

                        {/* 升级结果提示：固定 16px 高占位，失败文案出现/消失都不顶动布局 */}
                        <div
                            className="h-4 mt-1 text-center text-[11px] leading-4 font-sans truncate"
                            style={{ color: raiseTip ? '#6ee7a8' : '#f87171' }}
                        >
                            {raiseTip || upgradeTip || ''}
                        </div>

                        {/* 底部：展开/收起轩辕策属性信息卡（与新天缘精炼卡同款，左对齐） */}
                        <div>
                            <button
                                type="button"
                                onClick={toggleInfo}
                                className="mt-1 text-[12px] cursor-pointer hover:brightness-125 transition-all"
                                style={{ color: '#9adfff' }}
                            >
                                {showInfo ? '收起轩辕策信息卡 ▲' : '查看轩辕策信息卡 ▼'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* ───────── 窗口 2：洗练（点「洗炼」才展开） ───────── */}
                {washOpen && (
                    <div id="xyc-wash-anchor" className="xyc-right w-full min-w-0 rounded-[4px] overflow-hidden flex flex-col" style={CARD_STYLE}>
                        <div className="relative flex items-center justify-center px-3 py-2" style={TITLE_BAR_STYLE}>
                            <span style={TITLE_TEXT_STYLE}>{specialMode ? '特 殊 洗 练' : '洗 练'}</span>
                            {/* 右上角关闭：与神机「自动锻造」面板同款，收起后可从左卡「洗炼」按钮再展开 */}
                            <button
                                type="button"
                                onClick={toggleWash}
                                disabled={busy}
                                title="关闭洗练面板"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-[#8ea8c2] hover:text-[#ffffff] hover:bg-[#284159] transition-colors disabled:cursor-not-allowed"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* 三种洗练道具：只放图标，点图标切换，选中态高亮。
                            特殊洗练（25 次后）改为三道具同时消耗，不再可选模式。 */}
                        {specialMode ? (
                            <div
                                className="px-3 py-2.5 flex flex-col gap-2"
                                style={{
                                    borderBottom: '1px solid #2a4054',
                                    background: 'linear-gradient(180deg, rgba(120,80,20,0.28) 0%, rgba(60,40,10,0.10) 100%)',
                                }}
                            >
                                <div className="flex items-center justify-center gap-3">
                                    {(['both', 'attr', 'skill'] as XycWashMode[]).map((m) => (
                                        <div
                                            key={m}
                                            className="relative w-8 h-8 rounded-[2px] overflow-hidden flex items-center justify-center"
                                            style={{
                                                background: 'linear-gradient(180deg, #1b3348 0%, #12212e 100%)',
                                                border: '1px solid #a8813c',
                                                boxShadow: '0 0 8px rgba(255,190,80,0.25), inset 0 1px 0 rgba(255,255,255,0.12)',
                                            }}
                                            title={WASH_ITEMS.find((w) => w.mode === m)?.name}
                                        >
                                            <img
                                                src={ITEM_ICONS[m].src}
                                                alt={WASH_ITEMS.find((w) => w.mode === m)?.name}
                                                className="w-full h-full object-contain"
                                                style={{ imageRendering: 'pixelated' }}
                                                onError={(e) => {
                                                    e.currentTarget.style.opacity = '0';
                                                }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="text-center text-[11.5px] leading-[16px]" style={{ color: '#ffd08a' }}>
                                    特殊洗练 · 剩 {specialLeft} 次
                                    <br />
                                    太乙宝函 + 大衍奇术 + 一元道契 同时消耗
                                </div>
                            </div>
                        ) : (
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
                        )}

                        {/* 特殊洗练：必得技能（本职业 3 级技能）+ 锁定槽（≤2，洗后不变） */}
                        {specialMode && (
                            <div className="px-3 py-2 flex flex-col gap-2" style={{ borderBottom: '1px solid #2a4054' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[11.5px] shrink-0 w-[54px] whitespace-nowrap" style={{ color: '#8fb0c8' }}>
                                        必得技能
                                    </span>
                                    <select
                                        value={specialSkillId ?? ''}
                                        onChange={(e) => setSkillSel(Number(e.target.value))}
                                        disabled={busy || leftBusy || specialSkills.length === 0}
                                        className="flex-1 min-w-0 h-[26px] px-1.5 text-[12px] rounded-[2px] bg-[#08121c] border border-[#21394f] text-[#d6e7f7] outline-none focus:border-[#4d82b0] cursor-pointer disabled:cursor-not-allowed"
                                        style={{ fontFamily: SIM_FONT }}
                                        title="特殊洗练洗前自选本职业 3 级技能，洗后必得该技能"
                                    >
                                        {specialSkills.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-[11.5px] shrink-0 w-[54px] whitespace-nowrap" style={{ color: '#8fb0c8' }}>
                                        锁定
                                    </span>
                                    <div className="flex-1 min-w-0 flex items-center gap-1.5">
                                        {Array.from({ length: SPECIAL_WASH_LOCK_MAX }).map((_, i) => {
                                            const id = lockIds[i];
                                            const has = id !== undefined;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={has ? () => toggleLock(id) : undefined}
                                                    disabled={busy || leftBusy}
                                                    className="flex-1 min-w-0 h-[26px] px-1.5 text-[12px] rounded-[2px] truncate"
                                                    style={{
                                                        background: has ? 'rgba(255,190,80,0.14)' : '#08121c',
                                                        border: `1px ${has ? 'solid #a8813c' : 'dashed #21394f'}`,
                                                        color: has ? '#ffd08a' : '#4a657c',
                                                        cursor: has ? 'pointer' : 'default',
                                                        fontFamily: SIM_FONT,
                                                    }}
                                                    title={has ? '点击取消锁定' : '点击左侧属性行锁定（最多 2 条）'}
                                                >
                                                    {has ? data.attrs[String(id)]?.name ?? `属性${id}` : '空'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="text-[10.5px] leading-[15px]" style={{ color: '#6f8ba4' }}>
                                    锁定条洗后种类与数值均不变；未锁 {Math.max(0, book.attrCount - lockIds.length)} 条种类与数值都会重掷
                                </div>
                            </div>
                        )}

                        {/* 操作区 */}
                        <div className="px-3 py-2 flex flex-col gap-2">
                            {/* 读条（对齐天缘模拟器） */}
                            <div
                                className="relative overflow-hidden xyc-wide mx-auto w-full max-w-[216px]"
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

                            <div className="flex items-center gap-2.5 xyc-wide mx-auto w-full max-w-[216px]">
                                <button
                                    type="button"
                                    onClick={runWash}
                                    disabled={!canWash || busy || leftBusy}
                                    className="flex-1 py-1.5 rounded-[3px] text-[12.5px] font-bold whitespace-nowrap"
                                    style={btnStyle(canWash && !busy && !leftBusy)}
                                >
                                    洗练一次
                                </button>
                                <button
                                    type="button"
                                    onClick={toggleAuto}
                                    disabled={!auto && (!canWash || busy || leftBusy)}
                                    className="flex-1 py-1.5 rounded-[3px] text-[12.5px] font-bold whitespace-nowrap"
                                    style={btnStyle(auto || (canWash && !leftBusy), auto ? 'danger' : 'normal')}
                                    title={
                                        auto
                                            ? '停止连续洗练'
                                            : `连续洗练：自动逐次洗练，直到次数用尽（剩 ${washLeft} 次）或点「停止」`
                                    }
                                >
                                    {auto ? (
                                        <span className="inline-flex items-center justify-center gap-1">
                                            <Square className="w-3 h-3" /> 停止
                                        </span>
                                    ) : (
                                        '连续洗练'
                                    )}
                                </button>
                            </div>

                            {/* 本次洗练属性变化 */}
                            {changeLines.length > 0 && (
                                <div
                                    key={changeSeq}
                                    data-xyc-change
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
                                        {changeLines.map((line, i) => {
                                            // 绿加红减：提升绿、下降红、无变化（技能行）保持白
                                            const upColor = '#4ade80';
                                            const downColor = '#f87171';
                                            const toColor =
                                                line.dir === 1 ? upColor : line.dir === -1 ? downColor : line.to === '—' ? '#5b7894' : '#dbe7f5';
                                            const deltaColor = line.dir === 1 ? upColor : downColor;
                                            return (
                                                <div
                                                    key={i}
                                                    data-xyc-change-row={line.name}
                                                    data-xyc-change-to={line.to}
                                                    data-xyc-change-from={line.from}
                                                    className="flex items-baseline gap-2 min-w-0 text-[11.5px] leading-[18px] whitespace-nowrap"
                                                    style={{ letterSpacing: line.isSkill ? '0.6px' : undefined }}
                                                >
                                                    <span
                                                        className="shrink-0 w-[96px] truncate"
                                                        style={{ color: line.isSkill ? '#9adfff' : C_STAT }}
                                                    >
                                                        {line.name}
                                                    </span>
                                                    <span className="flex items-baseline font-mono min-w-0 whitespace-nowrap">
                                                        <span style={{ color: '#5b7894' }}>{line.from}</span>
                                                        {/* 箭头左右各留一个空格（nbsp 防止被折叠） */}
                                                        <span style={{ color: '#3d6382' }}>{'\u00A0→\u00A0'}</span>
                                                        <span style={{ color: toColor, fontWeight: 700 }}>{line.to}</span>
                                                    </span>
                                                    {line.deltaStr && (
                                                        <span
                                                            className="ml-auto shrink-0 font-mono font-bold text-[11px] tabular-nums"
                                                            style={{ color: deltaColor }}
                                                            title={line.dir === 1 ? '本次提升' : '本次下降'}
                                                        >
                                                            {line.deltaStr}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 底部展开的轩辕策属性信息卡：四系 × 普通/英雄 的属性区间与每级增益（数据懒加载） */}
            {showInfo && tomeData && (
                <div className="mt-3 w-full">
                    <XycTomeDetailCard
                        cardData={{
                            rules: tomeData.rules,
                            meta: tomeData.meta,
                            initialBeast: beast,
                            initialHero: version === '英雄',
                            initialLevel: book.level,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default XycWashCard;

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import { DataService } from '../services/DataService';
import type { SubTab } from './compendium/CompendiumView';

export type SearchTarget =
    | { tab: 'compendium'; sub: SubTab; item?: string }
    | { tab: 'calculator'; dungeonId: string; monsterId: string };

interface IndexEntry {
    label: string;
    group: string;          // 显示用分类
    sub?: SubTab;           // 资料图鉴子页
    item?: string;          // 具体项（用于定位）
    dungeonId?: string;     // Boss 跳转用
    monsterId?: string;
    target: SearchTarget;
    keywords?: string[];    // 别名，用于匹配
    pyFull?: string;        // 全拼（无声调）
    pyInitials?: string;    // 拼音首字母
}

/** 计算中文文本的全拼与首字母（忽略非字母字符） */
function toPinyin(text: string): { full: string; initials: string } {
    const arr = pinyin(text, { toneType: 'none', type: 'array' }) as string[];
    const syllables = arr.filter(t => /^[a-z]+$/i.test(t));
    return {
        full: syllables.join('').toLowerCase(),
        initials: syllables.map(s => s[0]).join('').toLowerCase(),
    };
}

const SUB_PAGE_ENTRIES: IndexEntry[] = [
    { label: '极致无视攻略', group: '资料图鉴 / 极致无视攻略', sub: 'ignore', target: { tab: 'compendium', sub: 'ignore' }, keywords: ['无视', '易伤', '无视减免'] },
    { label: '极致减免伤害攻略', group: '资料图鉴 / 极致减免攻略', sub: 'reduction', target: { tab: 'compendium', sub: 'reduction' }, keywords: ['减免', '减伤', '减伤伤害'] },
    { label: '极致减暴击攻略', group: '资料图鉴 / 极致减暴击攻略', sub: 'critReduction', target: { tab: 'compendium', sub: 'critReduction' }, keywords: ['减暴', '暴击减免', '减暴击'] },
    { label: '极致怪增攻略', group: '资料图鉴 / 极致怪增攻略', sub: 'monsterDamageBonus', target: { tab: 'compendium', sub: 'monsterDamageBonus' }, keywords: ['怪增', '怪物增伤', '增伤', '怪物伤害'] },
    { label: '极致躲闪攻略', group: '资料图鉴 / 极致躲闪攻略', sub: 'dodge', target: { tab: 'compendium', sub: 'dodge' }, keywords: ['躲闪', '闪避'] },
    { label: '各职业状态', group: '资料图鉴 / 各职业状态', sub: 'support', target: { tab: 'compendium', sub: 'support' }, keywords: ['职业', '辅助', '易伤职业', '辅助职业', '状态', '专注值参考', '专注'] },
];

function buildIndex(): IndexEntry[] {
    const service = DataService.getInstance();
    const entries: IndexEntry[] = [...SUB_PAGE_ENTRIES];

    // 各职业状态（辅助 + 输出阵营变体，如 逐霜仙/逐霜魔佛）
    const roles = service.getSupportRoles();
    if (roles) {
        for (const r of roles.roles) {
            const isDps = r.rating === '输出';
            entries.push({
                label: r.name,
                group: '资料图鉴 / 各职业状态',
                sub: 'support',
                item: r.name,
                target: { tab: 'compendium', sub: 'support', item: r.name },
                keywords: [r.name, r.faction, isDps ? '输出' : '辅助'],
            });
        }
    }

    // 专注值参考（通用项）
    const focusRef = service.getSkillMeta()?.focusReference;
    if (focusRef) {
        for (const g of focusRef.general ?? []) {
            entries.push({
                label: g.name,
                group: '资料图鉴 / 各职业状态',
                sub: 'support',
                item: '专注值参考',
                target: { tab: 'compendium', sub: 'support', item: '专注值参考' },
                keywords: [g.name, '专注', '通用'],
            });
        }
    }

    // 极致属性攻略（无视/减免/减暴击）
    const guide = service.getAttributeCeilingGuide();
    if (guide) {
        const map: Record<string, { sub: SubTab; group: string }> = {
            ignore: { sub: 'ignore', group: '极致无视' },
            reduction: { sub: 'reduction', group: '极致减免' },
            critReduction: { sub: 'critReduction', group: '极致减暴击' },
        };
        for (const [key, section] of Object.entries(guide.sections)) {
            const m = map[key];
            if (!m) continue;
            for (const row of section.rows) {
                entries.push({
                    label: row.item,
                    group: m.group,
                    sub: m.sub,
                    item: row.item,
                    target: { tab: 'compendium', sub: m.sub, item: row.item },
                });
            }
        }
    }

    // 属性来源（怪增/躲闪）
    const lists = service.getStatSourceLists();
    if (lists) {
        const map: Record<string, { sub: SubTab; group: string }> = {
            monsterDamageBonus: { sub: 'monsterDamageBonus', group: '资料图鉴 / 极致怪增攻略' },
            dodge: { sub: 'dodge', group: '资料图鉴 / 极致躲闪攻略' },
        };
        for (const [key, section] of Object.entries(lists.sections)) {
            const m = map[key];
            if (!m) continue;
            for (const row of section.sources) {
                entries.push({
                    label: row.item,
                    group: m.group,
                    sub: m.sub,
                    item: row.item,
                    target: { tab: 'compendium', sub: m.sub, item: row.item },
                });
            }
            if (section.conditionals) {
                for (const row of section.conditionals) {
                    entries.push({
                        label: row.item,
                        group: m.group,
                        sub: m.sub,
                        item: row.item,
                        target: { tab: 'compendium', sub: m.sub, item: row.item },
                    });
                }
            }
        }
    }

    // Boss / 小怪 —— 仅纳入「有对应副本卡片」且怪物真实存在于该副本的条目，保证搜索跳转可命中
    const monsters = service.getDungeonsMonsters();
    const dungeonMap = new Map(service.getDungeons().map(d => [d.DungeonID, d]));
    if (monsters) {
        for (const [dungeonId, list] of Object.entries(monsters)) {
            const d = dungeonMap.get(dungeonId);
            if (!d) continue; // 跳过无卡片副本（如 T21_ADDS、SHOUSHEN_HARD）
            for (const m of list) {
                const name = (m as any).MonsterName || (m as any).name;
                const id = (m as any).MonsterID || (m as any).MonsterId;
                if (!name || !id) continue;
                if (!d.Monsters.some(mm => mm.MonsterID === id)) continue;
                const dungeonName = d.DungeonName || dungeonId;
                entries.push({
                    label: name,
                    group: `属性战力计算器 / ${dungeonName}`,
                    dungeonId,
                    monsterId: id,
                    target: { tab: 'calculator', dungeonId, monsterId: id },
                    keywords: [name, dungeonName, dungeonId],
                });
            }
        }
    }

    // 为每条目补算拼音（全拼 + 首字母），支持首字母模糊搜索（如 天华→th、赤索→cs）
    return entries.map(e => {
        const { full, initials } = toPinyin(e.label + ' ' + (e.keywords?.join(' ') || ''));
        return { ...e, pyFull: full, pyInitials: initials };
    });
}

function matchEntries(index: IndexEntry[], query: string): IndexEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: { e: IndexEntry; score: number }[] = [];
    for (const e of index) {
        const hay = (e.label + ' ' + (e.keywords?.join(' ') || '')).toLowerCase();
        const idx = hay.indexOf(q);
        if (idx >= 0) {
            // 中文/原文直接命中：越靠前越优先
            scored.push({ e, score: 100 - idx });
            continue;
        }
        // 拼音首字母（如 th / cs）优先于全拼（如 tianhua）
        if (e.pyInitials && e.pyInitials.includes(q)) {
            scored.push({ e, score: 60 - e.pyInitials.indexOf(q) });
            continue;
        }
        if (e.pyFull && e.pyFull.includes(q)) {
            scored.push({ e, score: 50 - e.pyFull.indexOf(q) });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 25).map(s => s.e);
}

function Highlighted({ text, query }: { text: string; query: string }) {
    const q = query.trim();
    if (!q) return <>{text}</>;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q.toLowerCase());
    if (idx < 0) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-cyan-500/30 text-cyan-200 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
            {text.slice(idx + q.length)}
        </>
    );
}

export const GlobalSearch: React.FC<{ onNavigate: (t: SearchTarget) => void }> = ({ onNavigate }) => {
    const [focused, setFocused] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const index = useMemo(() => buildIndex(), []);
    const results = useMemo(() => matchEntries(index, query), [index, query]);
    const showDropdown = focused || (query.length > 0 && results.length > 0);

    useEffect(() => { setActive(0); }, [query]);

    // 点击外部关闭下拉（失焦延迟已在 onBlur 处理）
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setFocused(false);
            }
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const choose = (e: IndexEntry) => {
        onNavigate(e.target);
        setQuery('');
        setFocused(false);
        inputRef.current?.blur();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (results.length === 0) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
        else if (e.key === 'Escape') { setFocused(false); inputRef.current?.blur(); }
    };

    return (
        <div ref={containerRef} className="relative flex-shrink-0">
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        // 延迟关闭，避免 mousedown 选结果前触发 blur
                        setTimeout(() => {
                            if (!containerRef.current?.contains(document.activeElement)) {
                                setFocused(false);
                            }
                        }, 120);
                    }}
                    placeholder="搜索…"
                    title="搜索攻略、职业、Boss"
                    className="bg-slate-900/70 border border-slate-700/60 rounded-lg pl-8 pr-7 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/70 focus:bg-slate-900 w-[110px] sm:w-[160px] md:w-[220px] transition-colors"
                />
                {query && (
                    <button
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {showDropdown && results.length > 0 && (
                    <div className="absolute z-50 mt-1 w-[260px] sm:w-[320px] max-h-[420px] overflow-y-auto bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl py-1">
                        {results.map((e, i) => (
                            <button
                                key={i}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={(e_) => { e_.preventDefault(); choose(e); }}
                                className={clsxActive(i === active)}
                            >
                                <span className="flex flex-col items-start text-left min-w-0 flex-1 overflow-hidden">
                                    <span className="text-sm text-slate-100 truncate w-full">
                                        <Highlighted text={e.label} query={query} />
                                    </span>
                                    <span className="text-[10px] text-cyan-400/60 truncate w-full">{e.group}</span>
                                </span>
                                {query.trim() && /^[a-z]+$/i.test(query.trim()) && e.pyInitials && (
                                    <span
                                        className="text-[10px] text-slate-500 font-mono ml-2 flex-shrink-0"
                                        title={`拼音：${e.pyInitials}`}
                                    >
                                        {e.pyInitials.slice(0, 4)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const clsxActive = (active: boolean) =>
    `w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${active ? 'bg-cyan-500/15' : 'hover:bg-slate-800/60'}`;

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { buildSearchIndex, matchFlat } from './search/searchIndex';
import type { CompiledSearchItem, SearchTarget } from './search/searchIndex';

// 统一从共享搜索层导出 SearchTarget，兼容 App/Header/ResultsSection/CompendiumView/SkillsView 的既有引用
export type { SearchTarget } from './search/searchIndex';

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
    const listRef = useRef<HTMLDivElement>(null);

    // 与首页 Ctrl+K 命令面板共用同一份索引与匹配规则
    const index = useMemo(() => buildSearchIndex(), []);
    const results = useMemo(() => matchFlat(index, query), [index, query]);
    const showDropdown = focused || (query.length > 0 && results.length > 0);

    useEffect(() => {
        setActive(0);
        if (listRef.current) listRef.current.scrollTop = 0;
    }, [query]);

    useEffect(() => {
        if (!listRef.current) return;
        if (active === 0) {
            listRef.current.scrollTop = 0;
            return;
        }
        const activeEl = listRef.current.children[active] as HTMLElement | undefined;
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }, [active]);

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

    const choose = (e: CompiledSearchItem) => {
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
                    title="搜索攻略、职业、Boss、技能"
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
                    <div ref={listRef} className="absolute z-50 mt-1 w-[260px] sm:w-[320px] max-h-[420px] overflow-y-auto bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl backdrop-blur-xl py-1">
                        {results.map((e, i) => (
                            <button
                                key={`${e.category}-${e.label}-${i}`}
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

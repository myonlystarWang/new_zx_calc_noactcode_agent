import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calculator, ChevronDown, Crosshair, Swords, Target, Users } from 'lucide-react';
import clsx from 'clsx';
import { GlobalSearch } from '../GlobalSearch';
import type { SearchTarget } from '../GlobalSearch';
import { ROUTE, buildPathFromTarget, primaryTabFromPath } from '../../routes';
import { CURRENT_VERSION, hasUnseenChangelog } from '../../utils/changelogSeen';

/** Header 自身即为路由消费者：激活态取自 URL，导航写入 URL（无需外部 props） */
const NAV_TABS = [
    { id: 'calculator', short: '战力', full: '属性战力计算器', path: ROUTE.calculator },
    { id: 'arena', short: '模拟', full: '副本模拟训练场', path: ROUTE.arena },
    { id: 'compendium', short: '资料库', full: '全景战斗资料库', path: ROUTE.ceiling },
] as const;

/**
 * 资料库子入口（Step 12.3）——让 Header 的入口与首页对齐。
 * 其中「职业状态一览」在首页只出现在数据胶囊里，这里是它的全局入口。
 */
const COMPENDIUM_MENU: { label: string; path: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { label: '极致属性攻略', path: ROUTE.ceiling, icon: Target },
    { label: '职业技能速查', path: ROUTE.skills, icon: Swords },
    { label: '职业状态一览', path: ROUTE.support, icon: Users },
    { label: '副本 BOSS 速查', path: ROUTE.boss, icon: Crosshair },
];

const NAV_BTN_BASE =
    'whitespace-nowrap px-2 sm:px-3 py-1.5 md:py-2 text-xs md:text-sm font-bold transition-all duration-300 border backdrop-blur-md flex-shrink-0 flex items-center gap-1';
const NAV_BTN_ON = 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]';
const NAV_BTN_OFF = 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300';

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const activeTab = primaryTabFromPath(pathname);

    // 「NEW」角标：当前构建版本 > 上次已读版本时显示（Step 11.4）。
    // 更新日志页自身不显示角标——ChangelogPage 挂载时才写入已读，而 Header 的 effect 会先跑，
    // 只靠 pathname 重算会出现「已在本页却仍显示 NEW」的一帧，故此处直接按路径短路。
    const onChangelogPage = pathname.startsWith(ROUTE.changelog);
    const [showNewBadge, setShowNewBadge] = useState(() => !onChangelogPage && hasUnseenChangelog());

    useEffect(() => {
        setShowNewBadge(!onChangelogPage && hasUnseenChangelog());
    }, [onChangelogPage]);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // ---- 资料库下拉（Step 12.3）----
    // 桌面 hover 展开、触屏由尾部 caret 点击开合（触屏没有 hover）；
    // 点主体按钮的行为与原来一致：不在资料库时进资料库默认子页，已在资料库则不跳转。
    //
    // ⚠️ 面板必须 Portal 到 body 并用 position:fixed：导航行容器是 `overflow-x-auto`，
    //    而 overflow-x:auto 会让 overflow-y 的计算值也变成 auto → 绝对定位的面板会被**裁掉**
    //    （DOM 在、aria-expanded=true、能点，但完全看不见）。
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
    const closeTimerRef = useRef<number | null>(null);
    const menuWrapRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const currentSubPath = COMPENDIUM_MENU.find((m) => pathname.startsWith(m.path))?.path;

    const placeMenu = () => {
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) setMenuPos({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    };

    const openMenu = () => {
        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
        placeMenu();
        setMenuOpen(true);
    };

    const scheduleCloseMenu = () => {
        if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
        // 留一点缓冲：鼠标从按钮移到面板要跨 6px 空隙，直接关会闪断
        closeTimerRef.current = window.setTimeout(() => setMenuOpen(false), 140);
    };

    useEffect(() => () => {
        if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    }, []);

    // 路由变化即收起（点菜单项 / 浏览器前进后退都算）
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!menuOpen) return;
        const handleOutsideDown = (e: MouseEvent) => {
            const t = e.target as Node;
            if (menuWrapRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            setMenuOpen(false);
        };
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        document.addEventListener('mousedown', handleOutsideDown);
        document.addEventListener('keydown', handleEsc);
        window.addEventListener('resize', placeMenu);
        return () => {
            document.removeEventListener('mousedown', handleOutsideDown);
            document.removeEventListener('keydown', handleEsc);
            window.removeEventListener('resize', placeMenu);
        };
    }, [menuOpen]);

    const handleSearchNavigate = (t: SearchTarget) => navigate(buildPathFromTarget(t));

    return (
        <header className="w-full py-1.5 md:py-2 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-[100] shadow-lg shadow-slate-900/50">
            <div className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* 品牌区：Logo 与标题两个可点目标都回首页；版本徽章独立成按钮进更新日志
                    （不能把版本按钮嵌进品牌按钮里——HTML 不允许 button 嵌套 button） */}
                <div className="group flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(ROUTE.home)}
                        className="cursor-pointer select-none transition-transform active:scale-95"
                        title="点击返回首页"
                        aria-label="返回首页"
                    >
                        <span className="block p-1.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20 group-hover:border-cyan-400/50 group-hover:shadow-cyan-500/40 transition-all">
                            <Calculator className="w-5 h-5 md:w-6 md:h-6 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                        </span>
                    </button>
                    <div>
                        <button
                            type="button"
                            onClick={() => navigate(ROUTE.home)}
                            className="block text-left cursor-pointer select-none transition-transform active:scale-95"
                            title="点击返回首页"
                        >
                            <h1 className="text-xl md:text-2xl font-black text-gradient tracking-tight drop-shadow-sm group-hover:brightness-110 transition-all">
                                诛仙3 战斗实验室
                            </h1>
                        </button>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <p className="text-sm text-slate-400 font-mono tracking-wider flex items-center gap-2">
                                {/* 版本号来自 package.json（构建期 __APP_VERSION__ 注入），点击进更新日志 */}
                                <button
                                    type="button"
                                    onClick={() => navigate(ROUTE.changelog)}
                                    className="relative px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-cyan-400/80 text-xs font-bold hover:bg-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
                                    title={`查看更新日志（当前 V ${CURRENT_VERSION}）`}
                                    aria-label={`查看更新日志，当前版本 V ${CURRENT_VERSION}${showNewBadge ? '，有新版本' : ''}`}
                                >
                                    V {CURRENT_VERSION}
                                    {showNewBadge && (
                                        <span
                                            className="absolute -top-2 -right-3 px-1 py-px rounded-full bg-rose-500 text-white text-[9px] font-black leading-tight shadow-sm shadow-rose-500/50"
                                            aria-hidden
                                        >
                                            NEW
                                        </span>
                                    )}
                                </button>
                            </p>

                            <span id="busuanzi_container_site_uv" className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/30 px-2 py-0.5 rounded-full border border-slate-700/30 whitespace-nowrap">
                                <span>访客: <span id="busuanzi_value_site_uv" className="font-mono text-slate-400">--</span></span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 self-end md:self-auto w-full md:w-auto">
                    {activeTab !== 'home' && <GlobalSearch onNavigate={handleSearchNavigate} />}
                    <div className="flex-1 md:flex-none flex items-center justify-end gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
                        {NAV_TABS.map((tab) => {
                            if (tab.id !== 'compendium') {
                                return (
                                    <button
                                        key={tab.id}
                                        // 与原 tab 模型行为一致：点当前所在栏目不跳转（避免在资料库子页误重置回默认子页）
                                        onClick={() => {
                                            if (activeTab !== tab.id) navigate(tab.path);
                                        }}
                                        className={clsx(
                                            NAV_BTN_BASE,
                                            'rounded-xl',
                                            activeTab === tab.id ? NAV_BTN_ON : NAV_BTN_OFF,
                                        )}
                                        title={tab.full}
                                        aria-label={tab.full}
                                    >
                                        <span className="md:hidden">{tab.short}</span>
                                        <span className="hidden md:inline">{tab.full}</span>
                                    </button>
                                );
                            }

                            // 资料库：主体按钮 + 尾部 caret 两个按钮（避免 button 嵌套 button；
                            // caret 同时解决触屏无法 hover 的问题）
                            return (
                                <div
                                    key={tab.id}
                                    ref={menuWrapRef}
                                    className="relative flex-shrink-0"
                                    onMouseEnter={openMenu}
                                    onMouseLeave={scheduleCloseMenu}
                                >
                                    <div className="flex items-stretch">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMenuOpen(false);
                                                if (activeTab !== tab.id) navigate(tab.path);
                                            }}
                                            className={clsx(
                                                NAV_BTN_BASE,
                                                'rounded-l-xl rounded-r-none border-r-0',
                                                activeTab === tab.id ? NAV_BTN_ON : NAV_BTN_OFF,
                                            )}
                                            title={tab.full}
                                            aria-label={tab.full}
                                        >
                                            <span className="md:hidden">{tab.short}</span>
                                            <span className="hidden md:inline">{tab.full}</span>
                                        </button>
                                        <button
                                            type="button"
                                            ref={triggerRef}
                                            data-lib-menu-trigger
                                            onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
                                            aria-haspopup="menu"
                                            aria-expanded={menuOpen}
                                            aria-label="展开资料库子入口"
                                            title="展开资料库子入口"
                                            className={clsx(
                                                NAV_BTN_BASE,
                                                'rounded-r-xl rounded-l-none px-1 sm:px-1.5',
                                                activeTab === tab.id ? NAV_BTN_ON : NAV_BTN_OFF,
                                            )}
                                        >
                                            <ChevronDown
                                                className={clsx('w-3.5 h-3.5 transition-transform', menuOpen && 'rotate-180')}
                                            />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 下拉面板：Portal 到 body + position:fixed，避开导航行 overflow-x-auto 的裁剪 */}
            {menuOpen && menuPos && createPortal(
                <div
                    ref={menuRef}
                    data-lib-menu
                    role="menu"
                    aria-label="资料库子入口"
                    style={{ top: menuPos.top, right: menuPos.right }}
                    onMouseEnter={openMenu}
                    onMouseLeave={scheduleCloseMenu}
                    className="fixed z-[9999] w-44 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-2xl shadow-black/70 flex flex-col gap-1"
                >
                    {COMPENDIUM_MENU.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = currentSubPath === item.path;
                        return (
                            <button
                                key={item.path}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    setMenuOpen(false);
                                    navigate(item.path);
                                }}
                                className={clsx(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors',
                                    isCurrent
                                        ? 'bg-cyan-500/15 text-cyan-300'
                                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white',
                                )}
                            >
                                <Icon className={clsx('w-3.5 h-3.5 shrink-0', isCurrent ? 'text-cyan-400' : 'text-slate-500')} />
                                {item.label}
                            </button>
                        );
                    })}
                </div>,
                document.body,
            )}
        </header>
    );
};

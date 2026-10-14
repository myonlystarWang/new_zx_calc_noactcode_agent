import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ROUTE } from '../../routes';
import { TianShuLogo } from '../ui/TianShuLogo';

export const Header: React.FC = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const onChangelogPage = pathname.startsWith(ROUTE.changelog);
    const onAboutPage = pathname.startsWith(ROUTE.about);

    useEffect(() => {
        const script = document.createElement('script');
        script.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    const handleOpenGuestbook = () => {
        if (pathname !== ROUTE.home) {
            navigate(ROUTE.home);
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-zx-workspace', { detail: { mode: 'guestbook' } }));
            }, 100);
        } else {
            window.dispatchEvent(new CustomEvent('open-zx-workspace', { detail: { mode: 'guestbook' } }));
        }
    };

    return (
        <header className="w-full py-3.5 px-4 sm:px-6 border-b border-white/5 bg-[#05080f]/60 backdrop-blur-xl sticky top-0 z-[100] transition-all shrink-0">
            <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
                {/* 品牌区：点击 Logo 与标题直接返回首页 */}
                <button
                    type="button"
                    onClick={() => navigate(ROUTE.home)}
                    className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer select-none text-left transition-transform active:scale-95"
                    title="天书万象 AI · 点击返回主页"
                    aria-label="返回主页"
                >
                    <span className="block p-1 bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-amber-500/20 rounded-xl border border-cyan-500/30 group-hover:border-cyan-400/50 shadow-sm shadow-cyan-500/20 transition-all">
                        <TianShuLogo size={28} className="transition-transform group-hover:scale-105" />
                    </span>
                    <span className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-amber-300 tracking-tight group-hover:brightness-110 transition-all">
                        天书万象 AI
                    </span>
                </button>

                {/* 统计打桩占位（绝对定位零尺寸隔离，供不蒜子无感知计数，彻底杜绝居中数字跳出） */}
                <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
                    <span id="busuanzi_container_site_uv">
                        <span id="busuanzi_value_site_uv" />
                    </span>
                </div>

                {/* 右侧导航项：【更新动态】 -> 【意见反馈】 -> 【关于本站】 */}
                <div className="flex items-center gap-5 sm:gap-7 text-xs sm:text-sm font-medium">
                    <button
                        type="button"
                        onClick={() => navigate(ROUTE.changelog)}
                        className={clsx(
                            'flex items-center gap-1.5 transition-colors cursor-pointer select-none py-1',
                            onChangelogPage ? 'text-cyan-300 font-bold' : 'text-slate-300 hover:text-cyan-300'
                        )}
                        title="查看天书全知大模型更新动态与排期"
                        aria-label="更新动态"
                    >
                        <span>更新动态</span>
                        <span
                            className="px-1.5 py-0.5 rounded-full bg-rose-500/90 text-white text-[9px] font-black leading-none shadow-sm shadow-rose-500/40"
                            aria-hidden
                        >
                            NEW
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenGuestbook}
                        className="transition-colors cursor-pointer select-none py-1 text-slate-300 hover:text-cyan-300"
                        title="仙友留言板与意见反馈"
                        aria-label="意见反馈"
                    >
                        <span>意见反馈</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(ROUTE.about)}
                        className={clsx(
                            'transition-colors cursor-pointer select-none py-1',
                            onAboutPage ? 'text-cyan-300 font-bold' : 'text-slate-300 hover:text-cyan-300'
                        )}
                        title="查看关于本站愿景与理念"
                        aria-label="关于本站"
                    >
                        <span>关于本站</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

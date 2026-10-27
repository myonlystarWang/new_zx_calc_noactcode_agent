import React from 'react';
import { InstallEntry } from '../pwa/InstallGuide';

interface FooterProps {
    activeTab?: string;
}

export const Footer: React.FC<FooterProps> = () => {
    return (
        <footer className="w-full pb-4 pt-3 bg-transparent relative z-10 shrink-0 select-none">
            {/* 顶部微光渐变分割线（中间微亮、两端隐没，不切割宇宙星空画布） */}
            <div className="w-full max-w-2xl mx-auto h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-3" />

            <div className="w-full max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 [&>*]:leading-none gap-y-1 text-xs tracking-normal text-center text-slate-500">
                <span className="whitespace-nowrap">&copy; 2026 天书万象 AI</span>
                {/* 作者署名：窄屏（<640px）隐藏，避免 footer 折成两行。
                    完整署名在「关于本站」页有展示，footer 在移动端优先保证导航项（安装 / 概率表）单行可点。 */}
                <span className="hidden sm:inline-flex items-center gap-x-3">
                    <span className="text-slate-700 select-none" aria-hidden="true">·</span>
                    <span className="whitespace-nowrap">
                        {/* 390px 下「Created with pride by」要占 136px，加完安装入口必然换行 */}
                        <span className="hidden md:inline">Created with pride by </span>
                        <span className="text-slate-400 hover:text-slate-200 transition-colors cursor-default">
                            星耀-萝卜
                        </span>
                    </span>
                </span>
                {/* PWA 安装入口：已安装时组件自己返回 null，这里不用判断 */}
                <InstallEntry
                    separator
                    className="min-h-0 tap-40 text-slate-400 hover:text-cyan-300 border-b border-dotted border-slate-600/70"
                />
                {/* 概率速查：独立静态页（/data/），给玩家一个入口，同时给页面带来真实访问信号。
                    target=_blank 避免跳走后丢失聊天状态；站内有「打开模拟器」回首页。 */}
                <span className="text-slate-700 select-none" aria-hidden="true">·</span>
                <a
                    href="/data/"
                    target="_blank"
                    rel="noopener"
                    className="whitespace-nowrap min-h-0 tap-40 text-slate-400 hover:text-cyan-300 border-b border-dotted border-slate-600/70 transition-colors"
                >
                    概率表
                </a>
            </div>
        </footer>
    );
};

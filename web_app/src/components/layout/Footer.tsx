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

            <div className="w-full max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs tracking-normal text-center text-slate-500">
                <span className="whitespace-nowrap">&copy; 2026 天书万象 AI</span>
                <span className="text-slate-700 select-none" aria-hidden="true">·</span>
                <span className="whitespace-nowrap">
                    {/* 390px 下「Created with pride by」要占 136px，加完安装入口必然换行，
                        手机端缩成「by」。桌面端文案不变。 */}
                    <span className="hidden sm:inline">Created with pride by </span>
                    <span className="sm:hidden">by </span>
                    <span className="text-slate-400 hover:text-slate-200 transition-colors cursor-default">
                        星耀-萝卜
                    </span>
                </span>
                {/* PWA 安装入口：已安装时组件自己返回 null，这里不用判断 */}
                <InstallEntry
                    separator
                    className="text-slate-400 hover:text-cyan-300 underline decoration-dotted underline-offset-2"
                />
            </div>
        </footer>
    );
};

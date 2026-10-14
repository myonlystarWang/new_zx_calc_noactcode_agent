import React from 'react';

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
                    Created with pride by{' '}
                    <span className="text-slate-400 hover:text-slate-200 transition-colors cursor-default">
                        星耀-萝卜
                    </span>
                </span>
            </div>
        </footer>
    );
};

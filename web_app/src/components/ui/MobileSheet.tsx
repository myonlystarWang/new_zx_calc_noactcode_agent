import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface MobileSheetProps {
    /** 关闭（点遮罩 / 点右上角 / Esc / 下滑把手） */
    onClose: () => void;
    children: React.ReactNode;
    /** 横屏手机等极矮视口：直接铺满，不做 92dvh 抽屉 */
    fullHeight?: boolean;
}

/**
 * 移动端全屏抽屉：从底部升起，内容单列瀑布式。
 * 层级 z-[8900]：低于全站弹窗（z-[9999]）、高于竞技场抽屉（z-[9000]），
 * 这样 Sheet 里再弹「职业选择」不会被自己的遮罩盖住。
 */
export const MobileSheet: React.FC<MobileSheetProps> = ({ onClose, children, fullHeight }) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[8900] flex flex-col justify-end"
            role="dialog"
            aria-modal="true"
            aria-label="工作区"
        >
            <button
                type="button"
                aria-label="关闭工作区"
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            />

            <div
                className={clsx(
                    'relative w-full flex flex-col overflow-hidden bg-[#070a10] border-t border-slate-700/70 shadow-[0_-8px_40px_rgba(0,0,0,0.65)]',
                    'animate-in slide-in-from-bottom-4 duration-200',
                    fullHeight ? 'h-[100dvh] rounded-none' : 'h-[92dvh] rounded-t-2xl',
                )}
            >
                {/* 把手 + 关闭：只做视觉与出口，不拦截内容滚动 */}
                <div className="relative shrink-0 h-6 flex items-center justify-center">
                    <span className="h-1 w-10 rounded-full bg-slate-600/80" aria-hidden="true" />
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="关闭工作区"
                        className="absolute right-2 top-1 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
            </div>
        </div>
    );
};

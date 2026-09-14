import React, { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';

interface FooterProps {
    activeTab?: 'home' | 'calculator' | 'arena' | 'compendium' | 'skills';
}

export const Footer: React.FC<FooterProps> = ({ activeTab = 'calculator' }) => {
    const [copied, setCopied] = useState(false);
    const wechatId = "Myonly_sTar12345678";

    const handleCopy = async () => {
        try {
            // Try modern Clipboard API first (requires secure context HTTPS or localhost)
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(wechatId);
            } else {
                // Fallback for HTTP / Mobile / Older Browsers
                const textArea = document.createElement("textarea");
                textArea.value = wechatId;

                // Ensure it's not visible but part of DOM
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                textArea.setAttribute("readonly", "");

                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (!successful) throw new Error('Copy failed');
            }

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    return (
        <footer className="w-full py-2.5 md:py-3 mt-auto border-t border-slate-800/40 bg-slate-900/20 backdrop-blur-sm">
            <div
                className={`w-full mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-slate-400 transition-all duration-300 ${
                    activeTab === 'home' ? 'max-w-[1240px]' : 'max-w-[1760px]'
                }`}
            >
                <div className="text-xs font-mono tracking-wider text-center md:text-left">
                    <p className="text-slate-400">&copy; 2024 诛仙3副本战斗实验室</p>
                    <p className="mt-1 text-slate-500 text-[11px]">Designed & Developed by 星耀-萝卜</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* WeChat Contact */}
                    <div
                        onClick={handleCopy}
                        className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/60 cursor-pointer transition-all active:scale-95 select-none"
                        title="点击复制微信号"
                    >
                        <div
                            className={`p-1.5 rounded-full transition-colors ${
                                copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-cyan-400'
                            }`}
                        >
                            {copied ? <Check className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                        </div>
                        <span
                            className={`text-xs font-medium tracking-wide transition-colors ${
                                copied ? 'text-emerald-400 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                            }`}
                        >
                            {copied ? '已复制微信号' : `WeChat: ${wechatId}`}
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

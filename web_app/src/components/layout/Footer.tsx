import React, { useState } from 'react';
import { MessageSquare, Check } from 'lucide-react';

export const Footer: React.FC = () => {
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
            // Optional: Show an alert or toast on failure
            // alert('复制失败，请手动复制');
        }
    };

    return (
        <footer className="w-full py-3 mt-4 border-t border-slate-800/50 bg-slate-900/50 backdrop-blur-sm">
            <div className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400">
                <div className="text-xs font-mono tracking-wider text-center md:text-left">
                    <p>&copy; 2024 诛仙3副本战斗实验室</p>
                    <p className="mt-1 text-slate-500">Designed & Developed by 星耀-萝卜</p>
                </div>

                <div className="flex items-center gap-6">
                    {/* WeChat Contact */}
                    <div
                        onClick={handleCopy}
                        className="group flex items-center gap-2 cursor-pointer transition-all hover:text-cyan-400 active:scale-95"
                        title="点击复制微信号"
                    >
                        <div className={`p-2 rounded-full transition-colors ${copied ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 group-hover:bg-cyan-500/10'}`}>
                            {copied ? <Check className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                        </div>
                        <span className={`text-sm font-medium transition-colors ${copied ? 'text-green-400' : ''}`}>
                            {copied ? '已复制微信号' : `WeChat: ${wechatId}`}
                        </span>
                    </div>


                </div>
            </div>
        </footer>
    );
};

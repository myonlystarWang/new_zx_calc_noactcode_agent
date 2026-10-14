import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Check } from 'lucide-react';
import { ROUTE } from '../../routes';

import type { PrimaryTab } from '../../routes';

interface FooterProps {
    activeTab?: PrimaryTab;
}

// 暂时封掉右侧 WeChat 入口（2026-09-16），需要恢复显示时改为 true 即可
const SHOW_WECHAT = false;

export const Footer: React.FC<FooterProps> = ({ activeTab = 'calculator' }) => {
    const navigate = useNavigate();
    const [contactCopied, setContactCopied] = useState(false);
    const wechatId = "Myonly_sTar12345678";

    const copyWechat = async () => {
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

            setContactCopied(true);
            setTimeout(() => setContactCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    };

    const handleOpenGuestbook = () => {
        if (activeTab !== 'home') {
            navigate(ROUTE.home);
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('open-zx-workspace', { detail: { mode: 'guestbook' } }));
            }, 100);
        } else {
            window.dispatchEvent(new CustomEvent('open-zx-workspace', { detail: { mode: 'guestbook' } }));
        }
    };

    return (
        <footer className="w-full py-2 mt-auto border-t border-slate-800/40 bg-slate-900/20 backdrop-blur-sm">
            <div
                className={`w-full mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-slate-400 transition-all duration-300 ${
                    activeTab === 'home' ? 'max-w-5xl' : 'max-w-[1760px]'
                }`}
            >
                <div className="text-xs font-mono tracking-wider text-center md:text-left">
                    <p
                        className="text-slate-400"
                        title="数据来源于游戏内实测，仅供参考，不构成官方攻略，如有出入以游戏实际为准"
                    >
                        &copy; {new Date().getFullYear()} 诛仙3副本战斗实验室 · 免责声明
                    </p>
                    <p className="mt-1 text-slate-500 text-[11px] flex items-center justify-center md:justify-start gap-2">
                        <span>Designed & Developed by 星耀-萝卜</span>
                        <span className="text-slate-700" aria-hidden>·</span>
                        {/* 更新日志入口（Step 11）：与版本徽章同源，方便回看每次更新 */}
                        <button
                            type="button"
                            onClick={() => navigate(ROUTE.changelog)}
                            className="text-slate-500 hover:text-cyan-400 underline-offset-2 hover:underline cursor-pointer transition-colors"
                            title="查看更新日志"
                            aria-label="查看更新日志"
                        >
                            更新日志 (v 1.1.10)
                        </button>
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* 意见反馈：点击直达留言板 */}
                    <button
                        type="button"
                        onClick={handleOpenGuestbook}
                        className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/60 cursor-pointer transition-all active:scale-95 select-none"
                        title="打开仙友留言板与反馈墙"
                        aria-label="意见反馈：直达仙友留言板"
                    >
                        <div className="p-1.5 rounded-full bg-slate-800 text-slate-400 group-hover:text-cyan-400 transition-colors">
                            <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-medium tracking-wide text-slate-400 group-hover:text-slate-200 transition-colors">
                            意见反馈
                        </span>
                    </button>

                    {/* WeChat Contact（暂时封掉，恢复时改 SHOW_WECHAT 为 true） */}
                    {SHOW_WECHAT && (
                        <button
                            type="button"
                            onClick={() => copyWechat()}
                            className="group flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 hover:bg-slate-800/60 cursor-pointer transition-all active:scale-95 select-none"
                            title="点击复制微信号"
                            aria-label="点击复制微信号"
                        >
                            <div
                                className={`p-1.5 rounded-full transition-colors ${
                                    contactCopied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400 group-hover:text-cyan-400'
                                }`}
                            >
                                {contactCopied ? <Check className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                            </div>
                            <span
                                className={`text-xs font-medium tracking-wide transition-colors ${
                                    contactCopied ? 'text-emerald-400 font-semibold' : 'text-slate-400 group-hover:text-slate-200'
                                }`}
                            >
                                {contactCopied ? '已复制微信号' : `WeChat: ${wechatId}`}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </footer>
    );
};

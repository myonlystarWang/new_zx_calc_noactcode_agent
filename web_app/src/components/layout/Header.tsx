import React, { useEffect } from 'react';
import { Calculator } from 'lucide-react';

interface HeaderProps {
    activeTab: 'calculator' | 'arena';
    onTabChange: (tab: 'calculator' | 'arena') => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = '//busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    return (
        <header className="w-full py-2 md:py-3 mb-4 md:mb-5 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-[100] shadow-lg shadow-slate-900/50">
            <div className="w-full max-w-[1760px] mx-auto px-4 xl:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                        <Calculator className="w-5 h-5 md:w-6 md:h-6 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-black text-gradient tracking-tight drop-shadow-sm">
                            诛仙3副本战斗实验室
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <p className="text-sm text-slate-400 font-mono tracking-wider flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-cyan-400/80 text-xs font-bold">V 2.1.1</span>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span>by 星耀-萝卜</span>
                            </p>

                            <span id="busuanzi_container_site_uv" className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/30 px-2 py-0.5 rounded-full border border-slate-700/30 whitespace-nowrap">
                                <span>访客: <span id="busuanzi_value_site_uv" className="font-mono text-slate-400">--</span></span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                    <button
                        onClick={() => onTabChange('calculator')}
                        className={`px-3 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 border backdrop-blur-md ${
                            activeTab === 'calculator'
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                                : 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                    >
                        属性战力计算器
                    </button>
                    <button
                        onClick={() => onTabChange('arena')}
                        className={`px-3 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 border backdrop-blur-md ${
                            activeTab === 'arena'
                                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                                : 'bg-slate-850 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                    >
                        副本模拟训练场
                    </button>
                </div>
            </div>
        </header>
    );
};

import React, { useEffect } from 'react';
import { Calculator } from 'lucide-react';

export const Header: React.FC = () => {
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
        <header className="w-full py-4 md:py-6 mb-6 md:mb-8 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-[100] shadow-lg shadow-slate-900/50">
            <div className="container mx-auto px-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
                        <Calculator className="w-6 h-6 md:w-8 md:h-8 text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-gradient tracking-tight drop-shadow-sm">
                            诛仙3副本战力计算器
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <p className="text-sm text-slate-400 font-mono tracking-wider flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/50 text-cyan-400/80 text-xs font-bold">V 2.1.1</span>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span>by 星耀-萝卜</span>
                            </p>

                            <span id="busuanzi_container_site_uv" className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/30 px-2 py-0.5 rounded-full border border-slate-700/30 whitespace-nowrap">
                                {/* <Users className="w-3 h-3" /> */}
                                <span >访客: <span id="busuanzi_value_site_uv" className="font-mono text-slate-400">--</span></span>
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                </div>
            </div>
        </header>
    );
};

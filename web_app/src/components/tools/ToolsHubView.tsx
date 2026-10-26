import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Radio, Compass, Sparkles, Dices } from 'lucide-react';
import clsx from 'clsx';
import { ROUTE } from '../../routes';
import { ServerRadarView } from './ServerRadarView';
import { XycSimulatorView } from './XycSimulatorView';
import { NewTianYuanSimulatorView } from './NewTianYuanSimulatorView';
import { YunlingSimulatorView } from './YunlingSimulatorView';

export type ToolSubTab = 'server' | 'xyc' | 'newtianyuan' | 'yunling';

export const TOOLS_CONFIG: { id: ToolSubTab; label: string; path: string; icon: React.ReactNode; desc: string }[] = [
    {
        id: 'server',
        label: '开服雷达监测',
        path: ROUTE.serverRadar,
        icon: <Radio className="w-4 h-4 text-cyan-400" />,
        desc: '维护日毫秒级声光提醒'
    },
    {
        id: 'xyc',
        label: '轩辕策模拟器',
        path: ROUTE.xycSimulator,
        icon: <Compass className="w-4 h-4 text-teal-400" />,
        desc: '四系书型品相与 1~20 阶成长推算'
    },
    {
        id: 'newtianyuan',
        label: '新天缘精炼',
        path: ROUTE.newTianYuan,
        icon: <Sparkles className="w-4 h-4 text-amber-400" />,
        desc: '须弥装备天缘与天命理论上限'
    },
    {
        id: 'yunling',
        label: '神隐蕴灵',
        path: ROUTE.yunlingSimulator,
        icon: <Dices className="w-4 h-4 text-rose-400" />,
        desc: '神隐蕴灵概率与月德符消耗推演'
    },
];

interface ToolsHubViewProps {
    activeTool?: ToolSubTab;
}

export const ToolsHubView: React.FC<ToolsHubViewProps> = ({ activeTool }) => {
    const navigate = useNavigate();
    const { toolSeg } = useParams<{ toolSeg: string }>();
    const [searchParams] = useSearchParams();
    const zhanQuParam = searchParams.get('zhanQu') || undefined;
    const serverParam = searchParams.get('server') || undefined;

    const currentTab: ToolSubTab = (toolSeg as ToolSubTab) || activeTool || 'server';

    return (
        <div className="flex flex-col gap-6 pb-12 w-full max-w-[1760px] mx-auto px-4 xl:px-6 pt-4">
            {/* 顶栏大标题与工具导航切换 */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 flex items-center gap-3">
                        <span className="w-1.5 h-7 bg-gradient-to-b from-amber-500 to-cyan-500 rounded-full" />
                        微工具实验室
                    </h1>
                    <div className="text-xs text-slate-400 font-mono">
                        四大高保真微工具 · 毫秒级探测 · 1:1 数值还原
                    </div>
                </div>

                {/* 3 大核心微工具导航切换 Pills */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {TOOLS_CONFIG.map((t) => {
                        const isActive = currentTab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => navigate(t.path)}
                                className={clsx(
                                    'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap',
                                    isActive
                                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                                        : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                )}
                            >
                                {t.icon}
                                <span>{t.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 工具主体展示 */}
            {currentTab === 'server' && (
                <ServerRadarView initialZhanQu={zhanQuParam} initialServerName={serverParam} />
            )}
            {currentTab === 'xyc' && <XycSimulatorView />}
            {currentTab === 'newtianyuan' && <NewTianYuanSimulatorView />}
            {currentTab === 'yunling' && <YunlingSimulatorView />}
        </div>
    );
};

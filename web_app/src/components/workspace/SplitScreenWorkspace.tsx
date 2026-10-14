import React from 'react';
import {
  Calculator,
  MessageSquare,
  Radio,
  Compass,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Layers
} from 'lucide-react';
import clsx from 'clsx';
import { useApp } from '../../context/AppContext';
import { AttributePanel } from '../business/AttributePanel';
import { BuffPanel } from '../business/BuffPanel';
import { ResultSection } from '../business/ResultsSection';
import { GuestbookPanel } from './GuestbookPanel';
import { ServerRadarView } from '../tools/ServerRadarView';
import { XycSimulatorView } from '../tools/XycSimulatorView';
import { NewTianYuanSimulatorView } from '../tools/NewTianYuanSimulatorView';

export type WorkspaceMode =
  | 'calc'
  | 'guestbook'
  | 'server'
  | 'xyc'
  | 'newtianyuan'
  | 'ninglingqi';

export interface SplitScreenWorkspaceProps {
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

const WORKSPACE_TABS: { id: WorkspaceMode; label: string; icon: React.ReactNode }[] = [
  { id: 'calc', label: '战力计算器', icon: <Calculator className="w-3.5 h-3.5" /> },
  { id: 'guestbook', label: '仙友留言板', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'server', label: '开服雷达', icon: <Radio className="w-3.5 h-3.5" /> },
  { id: 'xyc', label: '轩辕策四象', icon: <Compass className="w-3.5 h-3.5" /> },
  { id: 'newtianyuan', label: '神级天缘', icon: <Sparkles className="w-3.5 h-3.5" /> },
  { id: 'ninglingqi', label: '凝灵契模拟', icon: <Layers className="w-3.5 h-3.5" /> },
];

export const SplitScreenWorkspace: React.FC<SplitScreenWorkspaceProps> = ({
  mode,
  onModeChange,
  isMaximized,
  onToggleMaximize,
  onClose,
}) => {
  const { userCharacter, updateCharacterAttributes } = useApp();

  return (
    <div className="flex flex-col h-full bg-[#080c14] border-l border-slate-800/80 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
      {/* 顶部控制栏 */}
      <div className="py-2 px-3 sm:px-4 border-b border-slate-800/80 bg-[#0d121c]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        {/* 左侧模块切换 Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {WORKSPACE_TABS.map((tab) => {
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onModeChange(tab.id)}
                className={clsx(
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap border cursor-pointer',
                  isActive
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                )}
                title={tab.label}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 右侧视窗控制：最大化 / 还原 / 关闭 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMaximize}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors border border-white/5"
            title={isMaximized ? '还原分屏 (双轨对照)' : '最大化工作区 (全屏模式)'}
            aria-label={isMaximized ? '还原分屏' : '最大化工作区'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-300 transition-colors border border-white/5"
            title="关闭右侧工作区 (返回居中对话)"
            aria-label="关闭工作区"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 工作区主内容呈现 */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#070a10]">
        {mode === 'calc' && (
          <div className="p-3 sm:p-4 max-w-[1760px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-4 animate-in fade-in duration-200">
            {/* 左栏：属性录入 */}
            <div className="xl:col-span-4 flex flex-col">
              <AttributePanel
                attributes={userCharacter.BaseAttributes}
                onChange={updateCharacterAttributes}
              />
            </div>

            {/* 中栏：增益勾选 */}
            <div className="xl:col-span-4 flex flex-col">
              <BuffPanel onNavigateToFocus={() => {}} />
            </div>

            {/* 右栏：测算结果 */}
            <div className="xl:col-span-4 flex flex-col">
              <div className="xl:sticky xl:top-2 flex-1">
                <ResultSection searchNav={null} onSearchConsumed={() => {}} />
              </div>
            </div>
          </div>
        )}

        {mode === 'guestbook' && <GuestbookPanel />}

        {mode === 'server' && (
          <div className="p-4 max-w-[1760px] mx-auto">
            <ServerRadarView />
          </div>
        )}

        {mode === 'xyc' && (
          <div className="p-4 max-w-[1760px] mx-auto">
            <XycSimulatorView />
          </div>
        )}

        {mode === 'newtianyuan' && (
          <div className="p-4 max-w-[1760px] mx-auto">
            <NewTianYuanSimulatorView />
          </div>
        )}

        {mode === 'ninglingqi' && (
          <div className="p-6 max-w-4xl mx-auto flex flex-col items-center justify-center text-center py-16 space-y-4">
            <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300">
              <Layers className="w-10 h-10 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">凝灵契 1:1 洗练推演引擎</h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              严格对照游戏内凝灵契属性网格、属性锁定规则、数值波动、秘效激活条件与凝灵材料消耗推算，将在后续版本全面升级。
            </p>
            <div className="flex items-center gap-2 text-xs text-cyan-400 font-mono bg-cyan-950/60 px-3 py-1.5 rounded-full border border-cyan-800/40">
              <span>状态：数值模型已就绪 · 即将接入</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

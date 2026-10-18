import React from 'react';
import {
  Calculator,
  Swords,
  Radio,
  Compass,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttributePanel } from '../business/AttributePanel';
import { BuffPanel } from '../business/BuffPanel';
import { ResultSection } from '../business/ResultsSection';
import { SimulationArena } from '../arena/SimulationArena';
import { ServerRadarView } from '../tools/ServerRadarView';
import { XycSimulatorView } from '../tools/XycSimulatorView';
import { NewTianYuanSimulatorView } from '../tools/NewTianYuanSimulatorView';
import {
  WORKSPACE_TAG,
  WORKSPACE_TAG_ICON,
  WORKSPACE_MAXIMIZE_BUTTON,
  WORKSPACE_CLOSE_BUTTON
} from '../ui/accentButtonStyles';

export type WorkspaceMode =
  | 'calc'
  | 'arena'
  | 'server'
  | 'xyc'
  | 'newtianyuan'
  | 'ninglingqi';

export interface SplitScreenWorkspaceProps {
  mode: WorkspaceMode;
  params?: {
    zhanQu?: string;
    serverName?: string;
    serverId?: string;
    [key: string]: any;
  };
  onModeChange?: (mode: WorkspaceMode) => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
}

const FEATURE_META: Record<WorkspaceMode, { label: string; icon: React.ReactNode }> = {
  calc: { label: '战力计算器', icon: <Calculator className={WORKSPACE_TAG_ICON} /> },
  arena: { label: '副本训练场', icon: <Swords className={WORKSPACE_TAG_ICON} /> },
  server: { label: '开服雷达', icon: <Radio className={WORKSPACE_TAG_ICON} /> },
  xyc: { label: '轩辕策属性', icon: <Compass className={WORKSPACE_TAG_ICON} /> },
  newtianyuan: { label: '天缘属性', icon: <Sparkles className={WORKSPACE_TAG_ICON} /> },
  ninglingqi: { label: '凝灵契模拟', icon: <Layers className={WORKSPACE_TAG_ICON} /> },
};

export const SplitScreenWorkspace: React.FC<SplitScreenWorkspaceProps> = ({
  mode,
  params,
  isMaximized,
  onToggleMaximize,
  onClose,
}) => {
  const { userCharacter, updateCharacterAttributes } = useApp();
  const currentMeta = FEATURE_META[mode] || FEATURE_META.calc;

  return (
    <div className="relative flex flex-col h-full bg-[#080c14] border-l border-slate-800/80 shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300">
      {/* 统一顶栏格式：5个功能统一保留该顶栏 */}
      <div className="py-2 px-3 sm:px-4 border-b border-slate-800/80 bg-[#0d121c]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        {/* 顶栏最左侧：该功能的名字带框，精致暗调科技感风格 */}
        <div className="flex items-center">
          <div className={WORKSPACE_TAG}>
            {currentMeta.icon}
            <span>{currentMeta.label}</span>
          </div>
        </div>

        {/* 顶栏最右侧：放大/还原 和 关闭 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleMaximize}
            className={WORKSPACE_MAXIMIZE_BUTTON}
            title={isMaximized ? '还原分屏 (双轨对照)' : '最大化工作区 (全屏模式)'}
            aria-label={isMaximized ? '还原分屏' : '最大化工作区'}
          >
            {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={WORKSPACE_CLOSE_BUTTON}
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
          <div className="calc-container-root @container p-3 sm:p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            <div className="calc-two-col-grid grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* 左列：全部输入项（方案/职业/阵营/属性/增益）+ 综合战力评分 */}
              <div className="calc-col-inputs md:col-span-6 flex flex-col gap-4">
                <AttributePanel
                  attributes={userCharacter.BaseAttributes}
                  onChange={updateCharacterAttributes}
                />
                <BuffPanel onNavigateToFocus={() => {}} />
              </div>

              {/* 右列：副本战力分析（原版 3D 轮播） */}
              <div className="calc-col-results md:col-span-6 flex flex-col">
                <div className="flex-1">
                  <ResultSection searchNav={null} onSearchConsumed={() => {}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'arena' && (
          <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-200">
            <SimulationArena />
          </div>
        )}

        {mode === 'server' && (
          <div className="p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            <ServerRadarView
              initialZhanQu={params?.zhanQu}
              initialServerName={params?.serverName}
              initialServerId={params?.serverId}
            />
          </div>
        )}

        {mode === 'xyc' && (
          <div className="p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            <XycSimulatorView />
          </div>
        )}

        {mode === 'newtianyuan' && (
          <div className="p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
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

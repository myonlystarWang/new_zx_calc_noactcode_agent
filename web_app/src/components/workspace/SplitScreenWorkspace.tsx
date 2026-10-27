import React, { Suspense } from 'react';
import {
  Calculator,
  Swords,
  Radio,
  Compass,
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Layers,
  Hammer
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AttributePanel } from '../business/AttributePanel';
import { BuffPanel } from '../business/BuffPanel';
import { ResultSection } from '../business/ResultsSection';
// 五个重页面改成按需加载：训练场 3200 行、模拟器各几百行，全塞进主包会拖慢首屏。
// 计算器（AttributePanel/BuffPanel/ResultsSection）保持同步加载，它是默认视图。
const SimulationArena = React.lazy(() => import('../arena/SimulationArena').then(m => ({ default: m.SimulationArena })));
const ServerRadarView = React.lazy(() => import('../tools/ServerRadarView').then(m => ({ default: m.ServerRadarView })));
const XycSimulatorView = React.lazy(() => import('../tools/XycSimulatorView').then(m => ({ default: m.XycSimulatorView })));
const NewTianYuanSimulatorView = React.lazy(() => import('../tools/NewTianYuanSimulatorView').then(m => ({ default: m.NewTianYuanSimulatorView })));
const YunlingSimulatorView = React.lazy(() => import('../tools/YunlingSimulatorView').then(m => ({ default: m.YunlingSimulatorView })));
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
  | 'ninglingqi'
  | 'yunling';

export interface SplitScreenWorkspaceProps {
  mode: WorkspaceMode;
  params?: {
    zhanQu?: string;
    serverName?: string;
    serverId?: string;
    [key: string]: any;
  };
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  /** 移动端抽屉内渲染：去掉左边框/滑入动画，隐藏最大化与关闭（由抽屉自己提供） */
  inSheet?: boolean;
}

const FEATURE_META: Record<WorkspaceMode, { label: string; icon: React.ReactNode }> = {
  calc: { label: '战力计算器', icon: <Calculator className={WORKSPACE_TAG_ICON} /> },
  arena: { label: '副本训练场', icon: <Swords className={WORKSPACE_TAG_ICON} /> },
  server: { label: '开服雷达', icon: <Radio className={WORKSPACE_TAG_ICON} /> },
  xyc: { label: '轩辕策属性', icon: <Compass className={WORKSPACE_TAG_ICON} /> },
  newtianyuan: { label: '天缘属性', icon: <Sparkles className={WORKSPACE_TAG_ICON} /> },
  ninglingqi: { label: '凝灵契模拟', icon: <Layers className={WORKSPACE_TAG_ICON} /> },
  yunling: { label: '装备蕴灵', icon: <Hammer className={WORKSPACE_TAG_ICON} /> },
};

export const SplitScreenWorkspace: React.FC<SplitScreenWorkspaceProps> = ({
  mode,
  params,
  isMaximized,
  onToggleMaximize,
  onClose,
  inSheet = false,
}) => {
  const { userCharacter, updateCharacterAttributes } = useApp();
  const currentMeta = FEATURE_META[mode] || FEATURE_META.calc;

  return (
    <div className={`relative flex flex-col h-full bg-[#080c14] overflow-hidden ${inSheet ? '' : 'border-l border-slate-800/80 shadow-2xl animate-in slide-in-from-right-4 duration-300'}`}>
      {/* 统一顶栏格式：5个功能统一保留该顶栏 */}
      <div className="py-2 px-3 sm:px-4 border-b border-slate-800/80 bg-[#0d121c]/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
        {/* 顶栏最左侧：该功能的名字带框，精致暗调科技感风格 */}
        <div className="flex items-center">
          <div className={WORKSPACE_TAG}>
            {currentMeta.icon}
            <span>{currentMeta.label}</span>
          </div>
        </div>

        {/* 顶栏最右侧：放大/还原 和 关闭（抽屉模式下由抽屉提供关闭，这里不显示） */}
        {!inSheet && (
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
        )}
      </div>

      {/* 工作区主内容呈现 */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-[#070a10]">
        <Suspense
          fallback={
            <div className="h-full min-h-[240px] grid place-items-center">
              <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" aria-label="加载中" />
            </div>
          }
        >
        {mode === 'calc' && (
          <div className="calc-container-root @container p-3 sm:p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            {/* 两栏由 .calc-two-col-grid 的容器查询（≥640px）驱动，不用 md: 视口断点：
                分屏面板里视口可能 1440，但面板只有 400 —— 视口断点会把 12 栏硬塞进 400px。 */}
            <div className="calc-two-col-grid grid grid-cols-1 gap-4 items-start">
              {/* 左列：全部输入项（方案/职业/阵营/属性/增益）+ 综合战力评分 */}
              <div className="calc-col-inputs flex flex-col gap-4">
                <AttributePanel
                  attributes={userCharacter.BaseAttributes}
                  onChange={updateCharacterAttributes}
                />
                <BuffPanel onNavigateToFocus={() => {}} />
              </div>

              {/* 右列：副本战力分析（原版 3D 轮播） */}
              <div className="calc-col-results flex flex-col">
                <div className="flex-1">
                  <ResultSection searchNav={null} onSearchConsumed={() => {}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === 'arena' && (
          /* @container：面板宽度才是竞技场的真实可用宽（视口宽 ≠ 面板宽）。
             保留 h-full 让宽面板下三栏铺满、不出现多余滚动；不设 overflow-hidden，
             窄面板（<900）时内容自然撑高，由外层 overflow-y-auto 接管滚动。 */
          <div className="@container h-full flex flex-col min-h-0 animate-in fade-in duration-200">
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
            <XycSimulatorView
              seed={{
                beast: params?.xycBeast,
                isHero: params?.xycIsHero,
                level: params?.xycLevel,
                advSkill: params?.xycAdvSkill
              }}
            />
          </div>
        )}

        {mode === 'newtianyuan' && (
          <div className="p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            <NewTianYuanSimulatorView seed={{ groupName: params?.tyGroupName, level: params?.tyLevel }} />
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

        {mode === 'yunling' && (
          <div className="p-3 sm:p-4 max-w-[1760px] mx-auto animate-in fade-in duration-200">
            <YunlingSimulatorView />
          </div>
        )}
        </Suspense>
      </div>
    </div>
  );
};

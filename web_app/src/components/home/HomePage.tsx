import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Plus,
  X,
  Calculator,
  Zap,
  Shield,
  BookOpen,
  SlidersHorizontal,
  Cpu
} from 'lucide-react';
import clsx from 'clsx';
import type { SearchTarget } from '../GlobalSearch';
import { Footer } from '../layout/Footer';
import { HomeAIChatStage } from './HomeAIChatStage';
import { SplitScreenWorkspace, type WorkspaceMode } from '../workspace/SplitScreenWorkspace';
import { MobileSheet } from '../ui/MobileSheet';
import { useIsMobile, useIsShortViewport } from '../../hooks/useMediaQuery';
import { useSplitDrag } from '../workspace/useSplitDrag';
import { ChatPlusMenu } from '../chat/ChatPlusMenu';
import { CopilotService, type CopilotMessage, TOP_HUB_OPTIONS, isNotFoundReply } from '../../services/CopilotService';
import { buildVisionMessage } from '../../services/vision/buildVisionMessage';
import { DataService } from '../../services/DataService';
import { CelestialStage } from './CelestialStage';
import { CosmicStarCanvas } from './CosmicStarCanvas';


interface HomePageProps {
  onSearchNavigate: (target: SearchTarget) => void;
}

interface WorkspaceState {
  isOpen: boolean;
  mode: WorkspaceMode;
  isMaximized: boolean;
  params?: any;
}

export const HomePage: React.FC<HomePageProps> = ({ onSearchNavigate: _onSearchNavigate }) => {
  // 对话流状态
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<CopilotMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  // 输入框左侧 + 号菜单展开状态
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  // 双轨分屏工作区状态
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>({
    isOpen: false,
    mode: 'calc',
    isMaximized: false,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 首页标题文字区：该区域内星空微粒淡出，保证标题/副标题可读
  const heroTextBoxRef = useRef<HTMLDivElement>(null);
  const copilot = useMemo(() => CopilotService.getInstance(), []);

  // 双轨分屏：左右可拖拽分隔条
  const { leftWidth, isResizing, onSplitterPointerDown } = useSplitDrag();

  // 手机（含横屏）不走左右分屏，改为全屏抽屉：左栏最小 460px 会把右栏顶出视口
  const isMobile = useIsMobile();
  const isShortViewport = useIsShortViewport();

  // 监听全局 Ctrl+V 粘贴截图
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              setAttachedImage(event.target?.result as string);
              inputRef.current?.focus();
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // 打开主页时异步静默提取 Copilot 意图与图鉴核心数据，避免用户第一次提问时等待数据下载
  useEffect(() => {
    DataService.getInstance().preloadCopilotData();
  }, []);


  // 快捷键 Ctrl+K 聚焦输入框
  useEffect(() => {
    const handleKeyDown = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'k' || ev.key === 'K')) {
        ev.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 监听外部打开工作台事件 (来自 Header 或其他入口)
  useEffect(() => {
    const handleOpenWorkspace = (e: any) => {
      const mode = (e.detail?.mode as WorkspaceMode) || 'calc';
      setIsChatActive(true);
      setWorkspaceState({
        isOpen: true,
        mode,
        isMaximized: false,
      });
    };

    const handleOpenCopilot = (e: any) => {
      if (e.detail?.prompt) {
        handleStartAiChat(e.detail.prompt);
      } else {
        setIsChatActive(true);
      }
    };

    window.addEventListener('open-zx-workspace', handleOpenWorkspace);
    window.addEventListener('open-zx-copilot', handleOpenCopilot);
    return () => {
      window.removeEventListener('open-zx-workspace', handleOpenWorkspace);
      window.removeEventListener('open-zx-copilot', handleOpenCopilot);
    };
  }, []);

  // 发起 AI 对话
  const handleStartAiChat = async (promptText: string, imageBase64?: string | null) => {
    const text = promptText.trim();
    const img = imageBase64 || attachedImage;
    if (!text && !img) return;

    setIsChatActive(true);
    inputRef.current?.blur();

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text || (img ? '[发送了游戏截图]' : ''),
      image: img || undefined,
      time: timeStr,
    };

    setChatMessages([userMsg]);
    setAttachedImage(null);
    setQuery('');
    setIsAiLoading(true);

    try {
      if (img) {
        const diag = await copilot.diagnoseImage(img, text);
        setChatMessages((prev) => [...prev, buildVisionMessage(diag, img, timeStr)]);
      } else {
        const localMatch = await copilot.matchLocalIntent(text);
        if (localMatch) {
          setChatMessages((prev) => [...prev, localMatch]);
          if (localMatch.cardData?.workspaceMode) {
            setWorkspaceState({
              isOpen: true,
              mode: localMatch.cardData.workspaceMode,
              isMaximized: false,
              params: localMatch.cardData.workspaceParams,
            });
          }
        } else {
          const reply = await copilot.chatText(text);
          const isNotFound = isNotFoundReply(reply);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              time: timeStr,
              cardType: isNotFound ? 'top_hub' : undefined,
              cardData: isNotFound
                ? {
                  title: '全景分类导航',
                  options: TOP_HUB_OPTIONS,
                }
                : undefined,
            },
          ]);
        }
      }
    } catch (err) {
      console.error('AI chat error:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: '推演过程发生异常，请重试。',
          time: timeStr,
        },
      ]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 后续追加对话
  const handleFollowUpMessage = async (text: string, image?: string, displayText?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      // displayText：hub「其他」等按钮的玩家可见文案（实际查询用 text 机器词，不外泄）
      text: (displayText?.trim() || trimmed || (image ? '[发送了游戏截图]' : '')),
      image,
      time: timeStr,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      if (image) {
        const diag = await copilot.diagnoseImage(image, trimmed);
        setChatMessages((prev) => [...prev, buildVisionMessage(diag, image, timeStr)]);
      } else {
        const localMatch = await copilot.matchLocalIntent(trimmed);
        if (localMatch) {
          setChatMessages((prev) => [...prev, localMatch]);
          if (localMatch.cardData?.workspaceMode) {
            setWorkspaceState({
              isOpen: true,
              mode: localMatch.cardData.workspaceMode,
              isMaximized: false,
              params: localMatch.cardData.workspaceParams,
            });
          }
        } else {
          const history = chatMessages.slice(-4).map((m) => ({
            role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text,
          }));
          const reply = await copilot.chatText(trimmed, history);
          const isNotFound = isNotFoundReply(reply);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              time: timeStr,
              cardType: isNotFound ? 'top_hub' : undefined,
              cardData: isNotFound
                ? {
                  title: '全景分类导航',
                  options: TOP_HUB_OPTIONS,
                }
                : undefined,
            },
          ]);
        }
      }
    } catch (err) {
      console.error('Follow-up error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
        inputRef.current?.focus();
      };
      reader.readAsDataURL(file);
    }
  };

  // 快捷微工具药丸点击：直接滑开右侧对应工作区
  const handleOpenMicroTool = (mode: WorkspaceMode) => {
    setIsPlusMenuOpen(false);
    setIsChatActive(true);
    setWorkspaceState({
      isOpen: true,
      mode,
      isMaximized: false,
    });
  };

  // 1. 对话展开态（含居中全宽态、桌面双轨分屏态、手机全屏抽屉态）
  if (isChatActive) {
    // 手机不再左右分屏：左栏最小 460px > 390 视口，右栏会被顶出屏幕（iPhone 上表现为一片空白）
    const useSheet = isMobile && workspaceState.isOpen;

    return (
      <div className="w-full flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧 AI 窄栏 / 居中主栏 */}
        {(!workspaceState.isMaximized || isMobile) && (
          <div
            style={workspaceState.isOpen && !isMobile ? { width: leftWidth } : undefined}
            className={clsx(
              'flex flex-col h-full overflow-hidden bg-[#080c14]',
              workspaceState.isOpen && !isMobile
                ? 'shrink-0 border-r border-slate-800/80'
                : 'flex-1 max-w-[1020px] mx-auto w-full',
              !isResizing && 'transition-[width] duration-300'
            )}
          >
            <HomeAIChatStage
              messages={chatMessages}
              isLoading={isAiLoading}
              onSendMessage={handleFollowUpMessage}
              onBackToHome={() => {
                setIsChatActive(false);
                setWorkspaceState((prev) => ({ ...prev, isOpen: false }));
                setChatMessages([]);
                setAttachedImage(null);
                setQuery('');
              }}
              isSplitOpen={workspaceState.isOpen}
              onToggleSplit={() =>
                setWorkspaceState((prev) => ({
                  ...prev,
                  isOpen: !prev.isOpen,
                  isMaximized: false,
                }))
              }
              onOpenSplitWorkspace={(mode, params) =>
                setWorkspaceState({
                  isOpen: true,
                  mode,
                  isMaximized: false,
                  params,
                })
              }
            />
          </div>
        )}

        {/* 左右分屏拖拽分隔条（仅桌面） */}
        {workspaceState.isOpen && !workspaceState.isMaximized && !isMobile && (
          <div
            onPointerDown={onSplitterPointerDown}
            className={clsx(
              'relative w-1.5 shrink-0 cursor-col-resize group',
              isResizing ? 'bg-cyan-400/70' : 'bg-slate-800/80 hover:bg-cyan-500/40'
            )}
            title="拖动调整分屏宽度"
            role="separator"
            aria-orientation="vertical"
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-slate-700/40 group-hover:bg-cyan-300/80 pointer-events-none" />
          </div>
        )}

        {/* 右侧多功能工作区（仅桌面） */}
        {workspaceState.isOpen && !isMobile && (
          <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            <SplitScreenWorkspace
              mode={workspaceState.mode}
              params={workspaceState.params}
              onModeChange={(m) => setWorkspaceState((prev) => ({ ...prev, mode: m }))}
              isMaximized={workspaceState.isMaximized}
              onToggleMaximize={() =>
                setWorkspaceState((prev) => ({
                  ...prev,
                  isMaximized: !prev.isMaximized,
                }))
              }
              onClose={() =>
                setWorkspaceState((prev) => ({
                  ...prev,
                  isOpen: false,
                  isMaximized: false,
                }))
              }
            />
          </div>
        )}

        {/* 手机：全屏抽屉（内容单列瀑布式，由容器查询自适应） */}
        {useSheet && (
          <MobileSheet
            fullHeight={isShortViewport}
            onClose={() =>
              setWorkspaceState((prev) => ({ ...prev, isOpen: false, isMaximized: false }))
            }
          >
            <SplitScreenWorkspace
              mode={workspaceState.mode}
              params={workspaceState.params}
              onModeChange={(m) => setWorkspaceState((prev) => ({ ...prev, mode: m }))}
              isMaximized
              onToggleMaximize={() => { }}
              onClose={() =>
                setWorkspaceState((prev) => ({ ...prev, isOpen: false, isMaximized: false }))
              }
              inSheet
            />
          </MobileSheet>
        )}
      </div>
    );
  }

  // 2. 初始主页：定稿版 Moonshot 风格月相浑天视觉全知推演台
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden relative cosmic-bg select-none">
      {/* 背景动态深空星河微粒 Canvas（标题文字区自动净空） */}
      <CosmicStarCanvas avoidRef={heroTextBoxRef} />

      {/* 主舞台居中容器 (微上浮 -mt-2，黄金视线聚焦) */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10 -mt-2 min-h-0">
        <div className="w-full max-w-4xl flex flex-col items-center text-center">

          {/* 浑天月相太极星核动效天体 */}
          <CelestialStage onClick={() => inputRef.current?.focus()} />

          {/* 核心主标题与愿景副标题（此区域不绘制星空微粒，避免星点穿透文字） */}
          <div ref={heroTextBoxRef} className="space-y-2 mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-[34px] font-black tracking-tight aurora-text">
              天书万象 AI · 诛仙全知大模型
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-serif-sc tracking-[0.22em] text-shadow">
              天地不仁以万物为刍狗 · 天书通晓诛仙万象规则
            </p>
          </div>

          {/* 现代化 AI 输入栏 (全功能交互：集成 + 号微菜单与快捷发送) */}
          <div className="relative w-full max-w-2xl bg-[#090d18]/95 border-2 border-slate-700/60 focus-within:border-cyan-500/80 focus-within:shadow-[0_0_35px_rgba(6,182,212,0.3)] rounded-2xl p-2 transition-all shadow-2xl">
            {/* 左侧 + 号微工具菜单 */}
            <ChatPlusMenu
              isOpen={isPlusMenuOpen}
              onClose={() => setIsPlusMenuOpen(false)}
              onSelectUpload={() => fileInputRef.current?.click()}
              onSelectWorkspace={(mode) => handleOpenMicroTool(mode)}
              onSendMessage={(q) => handleStartAiChat(q)}
              placement="down"
            />

            {/* 已选截图预载小卡片 */}
            {attachedImage && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={attachedImage}
                    alt="Attachment"
                    className="w-8 h-8 rounded-lg object-cover border border-cyan-400/40"
                  />
                  <span className="text-xs text-cyan-200 font-medium">已就绪 C 界面截图（回车启动诊断推演）</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="移除截图"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center px-1.5 py-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* + 号微菜单展开按钮 */}
              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                title={isPlusMenuOpen ? '收起工作台菜单' : '战术工作台与全知工具 (+)'}
                className={clsx(
                  'p-1.5 bg-transparent border-0 outline-none transition-colors cursor-pointer shrink-0 rounded-lg hover:bg-white/5',
                  isPlusMenuOpen ? 'text-cyan-300' : 'text-slate-400 hover:text-cyan-300'
                )}
              >
                {isPlusMenuOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>

              {/* 输入文本框 */}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleStartAiChat(query, attachedImage);
                  }
                }}
                placeholder={
                  attachedImage
                    ? '已粘贴截图，输入补充指令或直接回车启动推演...'
                    : '问点什么，比如四灵本元，神机洗练，昭武衣服，苍龙啸，新天缘等...'
                }
                className="flex-1 min-w-0 bg-transparent text-slate-100 placeholder-slate-500 text-[16px] md:text-sm focus:outline-none px-1 py-1.5"
              />

              {/* 发送按钮 */}
              <button
                type="button"
                onClick={() => {
                  if (!query.trim() && !attachedImage) {
                    inputRef.current?.focus();
                    return;
                  }
                  handleStartAiChat(query, attachedImage);
                }}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/30 cursor-pointer shrink-0 active:scale-95 ml-2"
                title="发送至天书大模型 (Enter)"
              >
                <Send className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>

          {/* 快捷微工具引导药丸 (间距适度拉大，呼吸感提升) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl w-full pt-5 sm:pt-6">
            <button
              type="button"
              onClick={() => handleStartAiChat('装备')}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">装备属性</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartAiChat('技能')}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-emerald-500/30 text-xs text-slate-300 hover:text-emerald-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">技能图鉴</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartAiChat('玩法攻略')}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-indigo-500/30 text-xs text-slate-300 hover:text-indigo-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">玩法攻略</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceState({ isOpen: true, mode: 'calc', isMaximized: false });
                handleStartAiChat('计算实战战力');
              }}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-amber-500/30 text-xs text-slate-300 hover:text-amber-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">伤害计算</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartAiChat('属性测算')}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-fuchsia-500/30 text-xs text-slate-300 hover:text-fuchsia-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-fuchsia-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">属性测算</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartAiChat('各类模拟器')}
              className="pill-btn group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-sky-500/30 text-xs text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">各类模拟器</span>
            </button>
          </div>
        </div>
      </div>

      {/* 极简 Apple 风格单行页脚 */}
      <Footer activeTab="home" />
    </div>
  );
};

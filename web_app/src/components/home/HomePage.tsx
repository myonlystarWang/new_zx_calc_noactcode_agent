import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Send,
  Plus,
  X,
  Calculator,
  Zap,
  Shield,
  Radio,
  Sparkles
} from 'lucide-react';
import clsx from 'clsx';
import type { SearchTarget } from '../GlobalSearch';
import { TianShuLogo } from '../ui/TianShuLogo';
import { Footer } from '../layout/Footer';
import { HomeAIChatStage } from './HomeAIChatStage';
import { SplitScreenWorkspace, type WorkspaceMode } from '../workspace/SplitScreenWorkspace';
import { ChatPlusMenu } from '../chat/ChatPlusMenu';
import { CopilotService, type CopilotMessage } from '../../services/CopilotService';

interface HomePageProps {
  onSearchNavigate: (target: SearchTarget) => void;
}

interface WorkspaceState {
  isOpen: boolean;
  mode: WorkspaceMode;
  isMaximized: boolean;
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
  const copilot = useMemo(() => CopilotService.getInstance(), []);

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

    // 当用户输入“计算”、“测算”或带有计算意图时，自动拉开右侧工作区分屏
    if (text.includes('计算') || text.includes('测算') || text.includes('秒伤') || text.includes('战力')) {
      setWorkspaceState({
        isOpen: true,
        mode: 'calc',
        isMaximized: false,
      });
    }

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
        let assistantMsg: CopilotMessage;

        if (diag.mode === 'c_panel' && diag.cPanelData) {
          const dmg = copilot.calculateT20Damage(diag.cPanelData);
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `${diag.rawExplanation}\n\n已通过确定性战斗引擎测算出该面板在【${dmg.dungeonName}】的实战战力（见下方诊断报告）：`,
            time: timeStr,
            cardType: 'c_panel_diag',
            cardData: {
              cPanel: diag.cPanelData,
              damage: dmg,
            },
          };
        } else if (diag.mode === 'xyc' && diag.xycData) {
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `${diag.rawExplanation}\n\n识别到【${diag.xycData.beast}】轩辕策（当前 ${diag.xycData.level} 阶），点击卡片可直接进入四象模拟器：`,
            time: timeStr,
            cardType: 'xyc_diag',
            cardData: {
              title: `${diag.xycData.beast}轩辕策`,
              route: `/tools/xyc?beast=${encodeURIComponent(diag.xycData.beast)}&lvl=${diag.xycData.level}`,
              desc: '支持四象 1~20 阶成长推算与极品毕业度评级',
            },
          };
        } else {
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: diag.rawExplanation || '已完成图像特征解析。',
            time: timeStr,
          };
        }
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else {
        const localMatch = await copilot.matchLocalIntent(text);
        if (localMatch) {
          setChatMessages((prev) => [...prev, localMatch]);
        } else {
          const reply = await copilot.chatText(text);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              time: timeStr,
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
  const handleFollowUpMessage = async (text: string, image?: string) => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;

    if (trimmed.includes('计算') || trimmed.includes('测算') || trimmed.includes('秒伤') || trimmed.includes('战力')) {
      setWorkspaceState({
        isOpen: true,
        mode: 'calc',
        isMaximized: false,
      });
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const userMsg: CopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: trimmed || (image ? '[发送了游戏截图]' : ''),
      image,
      time: timeStr,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsAiLoading(true);

    try {
      if (image) {
        const diag = await copilot.diagnoseImage(image, trimmed);
        let assistantMsg: CopilotMessage;

        if (diag.mode === 'c_panel' && diag.cPanelData) {
          const dmg = copilot.calculateT20Damage(diag.cPanelData);
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `${diag.rawExplanation}\n\n已测算在【${dmg.dungeonName}】的实战战力：`,
            time: timeStr,
            cardType: 'c_panel_diag',
            cardData: {
              cPanel: diag.cPanelData,
              damage: dmg,
            },
          };
        } else if (diag.mode === 'xyc' && diag.xycData) {
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `${diag.rawExplanation}\n\n识别到【${diag.xycData.beast}】轩辕策（当前 ${diag.xycData.level} 阶）：`,
            time: timeStr,
            cardType: 'xyc_diag',
            cardData: {
              title: `${diag.xycData.beast}轩辕策`,
              route: `/tools/xyc?beast=${encodeURIComponent(diag.xycData.beast)}&lvl=${diag.xycData.level}`,
              desc: '支持四象 1~20 阶成长推算与极品毕业度评级',
            },
          };
        } else {
          assistantMsg = {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: diag.rawExplanation || '已完成图像特征解析。',
            time: timeStr,
          };
        }
        setChatMessages((prev) => [...prev, assistantMsg]);
      } else {
        const localMatch = await copilot.matchLocalIntent(trimmed);
        if (localMatch) {
          setChatMessages((prev) => [...prev, localMatch]);
        } else {
          const history = chatMessages.slice(-4).map((m) => ({
            role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.text,
          }));
          const reply = await copilot.chatText(trimmed, history);
          setChatMessages((prev) => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: reply,
              time: timeStr,
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
    setIsChatActive(true);
    setWorkspaceState({
      isOpen: true,
      mode,
      isMaximized: false,
    });
  };


  // 1. 对话展开态（含居中全宽态与双轨分屏态）
  if (isChatActive) {
    return (
      <div className="w-full flex-1 min-h-0 flex overflow-hidden">
        {/* 左侧 AI 窄栏 / 居中主栏 */}
        {!workspaceState.isMaximized && (
          <div
            className={clsx(
              'flex flex-col h-full overflow-hidden transition-all duration-300',
              workspaceState.isOpen
                ? 'w-[420px] shrink-0 border-r border-slate-800/80 bg-[#080c14]'
                : 'flex-1 max-w-[960px] mx-auto w-full'
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
              onOpenSplitWorkspace={(mode) =>
                setWorkspaceState({
                  isOpen: true,
                  mode,
                  isMaximized: false,
                })
              }
            />
          </div>
        )}

        {/* 右侧多功能工作区 */}
        {workspaceState.isOpen && (
          <div className="flex-1 min-w-0 h-full overflow-hidden flex flex-col">
            <SplitScreenWorkspace
              mode={workspaceState.mode}
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
      </div>
    );
  }

  // 2. 初始未对话状态 (ChatGPT 范式纯粹大模型工作台)
  return (
    <div className="w-full flex-1 min-h-0 flex flex-col justify-between overflow-hidden relative">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 min-h-0 overflow-y-auto">
        <div className="w-full max-w-4xl flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-400">
          {/* 居中天书品牌与全新八卦神经元矢量 Logo */}
          <div className="flex flex-col items-center space-y-3.5">
            <div className="p-3.5 sm:p-4 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-purple-500/10 to-amber-500/20 border border-cyan-500/30 shadow-[0_0_35px_rgba(6,182,212,0.3)]">
              <TianShuLogo size={80} className="animate-spin-slow" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-amber-300 tracking-tight drop-shadow-md py-1">
                天书万象 AI · 诛仙全知大模型
              </h1>
              <p className="text-sm sm:text-base text-slate-400 font-serif tracking-widest text-shadow">
                天地不仁以万物为刍狗 · 天书通晓诛仙万象规则
              </p>
            </div>
          </div>

          {/* 现代化 ChatGPT 风格输入容器 (含左侧 + 号弹窗菜单，加宽至 max-w-3xl) */}
          <div className="relative w-full max-w-3xl bg-[#0d121c]/95 border-2 border-slate-700/60 focus-within:border-cyan-500/80 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.25)] rounded-2xl p-2 transition-all shadow-xl">
            {/* 左侧 + 号悬浮微工具与操作菜单 */}
            <ChatPlusMenu
              isOpen={isPlusMenuOpen}
              onClose={() => setIsPlusMenuOpen(false)}
              onSelectUpload={() => fileInputRef.current?.click()}
              onSelectWorkspace={(mode) => handleOpenMicroTool(mode)}
              placement="down"
            />

            {/* 已选图片浮层 */}
            {attachedImage && (
              <div className="mb-2 px-3 py-1.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={attachedImage}
                    alt="Attachment"
                    className="w-8 h-8 rounded-lg object-cover border border-cyan-400/40"
                  />
                  <span className="text-xs text-cyan-200 font-medium">已就绪 C 界面截图（将触发智能打桩测算）</span>
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

            <div className="flex items-center gap-2 px-2 py-1">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* ChatGPT 风格 + 号展开菜单按钮 (纯透明无底色无边框，仅加号本身响应 hover 变色) */}
              <button
                type="button"
                onClick={() => setIsPlusMenuOpen((prev) => !prev)}
                title={isPlusMenuOpen ? '收起工作台菜单' : '战术工作台与全知工具 (+)'}
                className={clsx(
                  'p-2 bg-transparent border-0 outline-none transition-colors cursor-pointer shrink-0',
                  isPlusMenuOpen
                    ? 'text-cyan-300'
                    : 'text-slate-400 hover:text-cyan-300'
                )}
              >
                {isPlusMenuOpen ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              </button>

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
                    : '问点什么，比如昭武、技能、法宝、伤害等...'
                }
                className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 text-sm focus:outline-none px-2 py-1.5"
              />

              <button
                type="button"
                onClick={() => {
                  if (!query.trim() && !attachedImage) {
                    inputRef.current?.focus();
                    return;
                  }
                  handleStartAiChat(query, attachedImage);
                }}
                className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/30 cursor-pointer shrink-0 active:scale-95"
                title="发送至天书大模型 (Enter)"
              >
                <Send className="w-4 h-4 text-slate-950" />
              </button>
            </div>
          </div>

          {/* 核心战术功能直达短小引导药丸 (移至对话框下方，与输入框同宽对齐) */}
          <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl w-full pt-1">
            <button
              type="button"
              onClick={() => handleStartAiChat('昭武')}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-cyan-500/30 hover:border-cyan-400/70 text-xs text-slate-300 hover:text-cyan-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Shield className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">装备属性</span>
            </button>

            <button
              type="button"
              onClick={() => handleStartAiChat('技能')}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-emerald-500/30 hover:border-emerald-400/70 text-xs text-slate-300 hover:text-emerald-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">技能描述</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceState({ isOpen: true, mode: 'calc', isMaximized: false });
                handleStartAiChat('计算实战战力');
              }}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-amber-500/30 hover:border-amber-400/70 text-xs text-slate-300 hover:text-amber-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Calculator className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">伤害计算</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceState({ isOpen: true, mode: 'server', isMaximized: false });
                handleStartAiChat('开服雷达');
              }}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-sky-500/30 hover:border-sky-400/70 text-xs text-slate-300 hover:text-sky-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Radio className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">开服检测</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWorkspaceState({ isOpen: true, mode: 'xyc', isMaximized: false });
                handleStartAiChat('轩辕策');
              }}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0e1422]/90 hover:bg-[#151f35] border border-purple-500/30 hover:border-purple-400/70 text-xs text-slate-300 hover:text-purple-300 transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">各类模拟器</span>
            </button>
          </div>
        </div>
      </div>

      {/* 恢复主分支 footer，并始终贴附于页面最底部 */}
      <Footer activeTab="home" />
    </div>
  );
};

import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  Calculator,
  Radio,
  Compass,
  Sparkles,
  Swords,
  Scroll
} from 'lucide-react';
import type { WorkspaceMode } from '../workspace/SplitScreenWorkspace';

export interface ChatPlusMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUpload: () => void;
  onSelectWorkspace: (mode: WorkspaceMode) => void;
  onSendMessage?: (query: string) => void;
  placement?: 'down' | 'up';
}

export const ChatPlusMenu: React.FC<ChatPlusMenuProps> = ({
  isOpen,
  onClose,
  onSelectUpload,
  onSelectWorkspace,
  onSendMessage,
  placement = 'down',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部自动收起
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToolClick = (mode: WorkspaceMode) => {
    onSelectWorkspace(mode);
    onClose();
  };

  const handleSendMessageClick = (query: string) => {
    if (onSendMessage) {
      onSendMessage(query);
    }
    onClose();
  };

  const isDown = placement === 'down';

  // 菜单项：战力/雷达 + 旧天缘 + 宸极凝灵契，轩辕策保留为 disabled 放在最下方
  const menuItems = [
    {
      id: 'upload',
      icon: Paperclip,
      title: '上传截图',
      desc: '从电脑中上传角色属性界面 / 轩辕策截图进行智能诊断',
      onClick: () => {
        onSelectUpload();
        onClose();
      },
    },
    {
      id: 'calc',
      icon: Calculator,
      title: '战力计算器',
      desc: '属性录入 · 增益勾选 · T20/团本秒伤推演',
      onClick: () => handleToolClick('calc'),
    },
    {
      id: 'arena',
      icon: Swords,
      title: '副本训练场',
      desc: '多角色逐秒实战仿真 · 技能循环与伤害报表统计',
      onClick: () => handleToolClick('arena'),
    },
    {
      id: 'server',
      icon: Radio,
      title: '开服雷达',
      desc: '9 大战区 33 服务器毫秒级心跳探测与声光提醒',
      onClick: () => handleToolClick('server'),
    },
    {
      id: 'tianyuan_old',
      icon: Sparkles,
      title: '旧天缘属性',
      desc: '4 大部位天缘词条池 · 1~10 级满级总属性推导',
      onClick: () => handleSendMessageClick('旧天缘'),
    },
    {
      id: 'ninglingqi',
      icon: Scroll,
      title: '宸极凝灵契',
      desc: '12 孔属性池 · 官方稀有/暴伤上限规则速查',
      onClick: () => handleSendMessageClick('凝灵契'),
    },
    {
      id: 'xyc',
      icon: Compass,
      title: '轩辕策属性',
      desc: '1~20 阶反推初始属性与极品毕业度评级',
      disabled: true,
      onClick: undefined,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{ backgroundColor: '#0c1220' }}
      className={`absolute ${isDown ? 'top-full left-0 mt-1.5' : 'bottom-full left-0 mb-1.5'
        } w-full bg-[#0c1220] border border-slate-700/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-1.5 z-50 animate-in fade-in ${isDown ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
        } duration-150 select-none`}
    >
      {/* 滚动容器：精准限高到刚好在 footer 之上，超出时展示精致滚动条 */}
      <div className="space-y-0.5 max-h-[175px] sm:max-h-[185px] overflow-y-auto pr-1 menu-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = Boolean(item.disabled);
          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={isDisabled ? undefined : item.onClick}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1 rounded-lg text-left transition-colors select-none ${isDisabled
                ? 'opacity-40 cursor-not-allowed bg-transparent'
                : 'hover:bg-white/[0.07] active:bg-white/10 group cursor-pointer'
                }`}
            >
              <Icon
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${isDisabled ? 'text-slate-500' : 'text-slate-400 group-hover:text-cyan-300'
                  }`}
                strokeWidth={1.75}
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  className={`text-[12.5px] font-medium transition-colors shrink-0 ${isDisabled ? 'text-slate-400' : 'text-slate-100 group-hover:text-cyan-300'
                    }`}
                >
                  {item.title}
                </span>
                <span
                  className={`text-[11.5px] transition-colors truncate ${isDisabled ? 'text-slate-500' : 'text-slate-400 group-hover:text-slate-300'
                    }`}
                >
                  {item.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

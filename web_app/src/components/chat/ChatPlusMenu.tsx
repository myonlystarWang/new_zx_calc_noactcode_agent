import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  Calculator,
  Radio,
  Swords,
  Shield,
  Zap,
  BookOpen,
  SlidersHorizontal,
  Cpu,
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

interface MenuItem {
  id: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick?: () => void;
}

// 菜单项：与首页快捷药丸一一对齐，额外保留置顶「上传截图」与「副本训练场」
const menuItems: MenuItem[] = [
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
      id: 'server',
      icon: Radio,
      title: '开服雷达',
      desc: '9 大战区 33 服务器毫秒级心跳探测与声光提醒',
      onClick: () => handleToolClick('server'),
    },
    {
      id: 'arena',
      icon: Swords,
      title: '副本训练场',
      desc: '多角色逐秒实战仿真 · 技能循环与伤害报表统计',
      onClick: () => handleToolClick('arena'),
    },
    {
      id: 'equip',
      icon: Shield,
      title: '装备属性',
      desc: '装备图鉴 · 天缘 / 蕴灵 / 神机词条速查',
      onClick: () => handleSendMessageClick('装备'),
    },
    {
      id: 'skill',
      icon: Zap,
      title: '技能图鉴',
      desc: '全职业技能、四代与造化被动、伤害系数速查',
      onClick: () => handleSendMessageClick('技能'),
    },
    {
      id: 'guide',
      icon: BookOpen,
      title: '玩法攻略',
      desc: '副本机制、毕业路线与实战打法',
      onClick: () => handleSendMessageClick('玩法攻略'),
    },
    {
      id: 'calc',
      icon: Calculator,
      title: '伤害计算',
      desc: '属性录入 · 增益勾选 · T20/团本秒伤推演',
      onClick: () => {
        onSelectWorkspace('calc');
        handleSendMessageClick('计算实战战力');
      },
    },
    {
      id: 'measure',
      icon: SlidersHorizontal,
      title: '属性测算',
      desc: '面板属性逐项测算与增益折算',
      onClick: () => handleSendMessageClick('属性测算'),
    },
    {
      id: 'sim',
      icon: Cpu,
      title: '各类模拟器',
      desc: '神机洗练 / 蕴灵模拟 / 新天缘模拟',
      onClick: () => handleSendMessageClick('各类模拟器'),
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

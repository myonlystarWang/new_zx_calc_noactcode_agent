import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  Calculator,
  Radio,
  Compass,
  Sparkles,
  Swords,
  Scroll,
  Hammer,
  Gem
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

// 菜单项：根据用户需求调整为 8 项纯速查与分屏工具
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
      id: 'silin_benyuan',
      icon: Compass,
      title: '四灵本元',
      desc: '伏龙鼎四灵 × 1~5阶全词条与满级折算速查',
      onClick: () => handleSendMessageClick('四灵本元'),
    },
    {
      id: 'shenji',
      icon: Hammer,
      title: '神机洗练',
      desc: '修武/昭武/彰武 × 6 部位 · 蕴灵档位概率锻造模拟',
      onClick: () => handleSendMessageClick('神机洗练'),
    },
    {
      id: 'yunling',
      icon: Gem,
      title: '装备蕴灵',
      desc: '神隐蕴灵 +1~+15 · 幸运值与月德符消耗逐手模拟',
      // ⛔ 数据实验室（右侧分屏）入口已关闭（2026-10-22）：恢复时改回 handleToolClick('yunling')
      onClick: () => handleSendMessageClick('装备蕴灵'),
    },
    {
      id: 'tianyuan',
      icon: Sparkles,
      title: '天缘属性',
      desc: '旧天缘天命四大部位与新天缘须弥系列分类卡',
      onClick: () => handleSendMessageClick('天缘属性'),
    },
    {
      id: 'ninglingqi',
      icon: Scroll,
      title: '宸极凝灵契',
      desc: '12 孔属性池 · 官方稀有/暴伤上限规则速查',
      onClick: () => handleSendMessageClick('凝灵契'),
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

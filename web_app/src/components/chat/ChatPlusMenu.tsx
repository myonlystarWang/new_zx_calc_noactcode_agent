import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  Calculator,
  Radio,
  Compass,
  Sparkles,
  Swords
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { WorkspaceMode } from '../workspace/SplitScreenWorkspace';

export interface ChatPlusMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUpload: () => void;
  onSelectWorkspace: (mode: WorkspaceMode) => void;
  placement?: 'down' | 'up';
}

export const ChatPlusMenu: React.FC<ChatPlusMenuProps> = ({
  isOpen,
  onClose,
  onSelectUpload,
  onSelectWorkspace,
  placement = 'down',
}) => {
  const navigate = useNavigate();
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

  const handleArenaClick = () => {
    navigate('/arena');
    onClose();
  };

  const isDown = placement === 'down';

  // 精简后的 6 个核心工具项（已移除：仙友留言、凝灵契、更新日志）
  const menuItems = [
    {
      id: 'upload',
      icon: Paperclip,
      title: '上传截图',
      desc: '从电脑中上传 C 界面 / 轩辕策截图进行智能打桩诊断',
      onClick: () => {
        onSelectUpload();
        onClose();
      },
    },
    {
      id: 'calc',
      icon: Calculator,
      title: '战力计算',
      desc: '属性录入 · 增益勾选 · T20/团本秒伤推演',
      onClick: () => handleToolClick('calc'),
    },
    {
      id: 'server',
      icon: Radio,
      title: '开服雷达',
      desc: '9 大战区 33 服毫秒心跳探测与声光提醒',
      onClick: () => handleToolClick('server'),
    },
    {
      id: 'xyc',
      icon: Compass,
      title: '轩辕策',
      desc: '1~20 阶反推初始底子与极品毕业度评级',
      onClick: () => handleToolClick('xyc'),
    },
    {
      id: 'tianyuan',
      icon: Sparkles,
      title: '神级天缘',
      desc: '须弥装备天缘与天命属性理论上限推演',
      onClick: () => handleToolClick('newtianyuan'),
    },
    {
      id: 'arena',
      icon: Swords,
      title: '训练场',
      desc: '多角色逐秒实战仿真 · 技能循环与伤害报表',
      onClick: handleArenaClick,
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{ backgroundColor: '#0c1220' }}
      className={`absolute ${
        isDown ? 'top-full left-0 mt-1.5' : 'bottom-full left-0 mb-1.5'
      } w-full bg-[#0c1220] border border-slate-700/80 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl p-1.5 z-50 animate-in fade-in ${
        isDown ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
      } duration-150 select-none`}
    >
      {/* 滚动容器：精准限高到刚好在 footer 之上，超出时展示精致滚动条 */}
      <div className="space-y-0.5 max-h-[175px] sm:max-h-[185px] overflow-y-auto pr-1 menu-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className="w-full flex items-center gap-2.5 px-2.5 py-1 rounded-lg text-left hover:bg-white/[0.07] active:bg-white/10 transition-colors group cursor-pointer"
            >
              <Icon
                className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0"
                strokeWidth={1.75}
              />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[12.5px] text-slate-100 group-hover:text-cyan-300 font-medium transition-colors shrink-0">
                  {item.title}
                </span>
                <span className="text-[11.5px] text-slate-400 group-hover:text-slate-300 transition-colors truncate">
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

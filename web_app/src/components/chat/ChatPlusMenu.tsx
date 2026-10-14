import React, { useRef, useEffect } from 'react';
import {
  Paperclip,
  Calculator,
  MessageSquare,
  Radio,
  Compass,
  Sparkles,
  Layers,
  Swords,
  ScrollText
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

  const handleChangelogClick = () => {
    navigate('/changelog');
    onClose();
  };

  const isDown = placement === 'down';

  return (
    <div
      ref={menuRef}
      className={`absolute ${
        isDown ? 'top-full left-0 mt-2.5' : 'bottom-full left-0 mb-2.5'
      } w-full bg-[#0d1424]/98 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in ${
        isDown ? 'slide-in-from-top-2' : 'slide-in-from-bottom-2'
      } duration-150 select-none`}
    >
      <div className="space-y-1 max-h-[380px] sm:max-h-[440px] overflow-y-auto no-scrollbar">
        {/* 1. 上传截图 */}
        <button
          type="button"
          onClick={() => {
            onSelectUpload();
            onClose();
          }}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Paperclip className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              上传截图
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              从电脑中上传 C 界面 / 轩辕策截图进行智能打桩诊断
            </span>
          </div>
        </button>

        {/* 2. 战力推演计算器 */}
        <button
          type="button"
          onClick={() => handleToolClick('calc')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Calculator className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              战力计算
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              属性录入 · 增益勾选 · T20/团本秒伤推演
            </span>
          </div>
        </button>

        {/* 3. 开服雷达 */}
        <button
          type="button"
          onClick={() => handleToolClick('server')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Radio className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              开服雷达
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              9 大战区 33 服毫秒心跳探测与声光提醒
            </span>
          </div>
        </button>

        {/* 4. 轩辕策四象 */}
        <button
          type="button"
          onClick={() => handleToolClick('xyc')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Compass className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              轩辕策
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              1~20 阶反推初始底子与极品毕业度评级
            </span>
          </div>
        </button>

        {/* 5. 神级天缘 */}
        <button
          type="button"
          onClick={() => handleToolClick('newtianyuan')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              神级天缘
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              须弥装备天缘与天命属性理论上限推演
            </span>
          </div>
        </button>

        {/* 6. 凝灵契模拟器 */}
        <button
          type="button"
          onClick={() => handleToolClick('ninglingqi')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Layers className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              凝灵契
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              属性网格 · 属性锁定 · 秘效与消耗仿真
            </span>
          </div>
        </button>

        {/* 7. 副本模拟训练场 */}
        <button
          type="button"
          onClick={handleArenaClick}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <Swords className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              训练场
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              多角色逐秒实战仿真 · 技能循环与伤害报表
            </span>
          </div>
        </button>

        {/* 8. 仙友留言反馈墙 */}
        <button
          type="button"
          onClick={() => handleToolClick('guestbook')}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <MessageSquare className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              仙友留言
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              战术心得 · 数值捉虫 · 新功能催更
            </span>
          </div>
        </button>

        {/* 9. 系统更新日志 */}
        <button
          type="button"
          onClick={handleChangelogClick}
          className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-left hover:bg-white/[0.06] active:bg-white/10 transition-colors group cursor-pointer"
        >
          <ScrollText className="w-4 h-4 text-slate-400 group-hover:text-cyan-300 transition-colors shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs sm:text-[13px] font-bold text-slate-100 group-hover:text-cyan-300 transition-colors shrink-0">
              更新日志
            </span>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors truncate">
              查看天书全知大模型最新版本排期与功能动态
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};

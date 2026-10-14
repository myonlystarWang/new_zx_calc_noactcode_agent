import React from 'react';
import { TianShuLogo } from '../ui/TianShuLogo';

interface CelestialStageProps {
  onClick?: () => void;
}

export const CelestialStage: React.FC<CelestialStageProps> = ({ onClick }) => {
  return (
    <div
      onClick={onClick}
      className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center cursor-pointer mb-3 select-none transition-transform duration-300 hover:scale-105"
      title="天书浑天太极星核 · 点击唤醒智能交互"
    >
      {/* 外部极光色散日冕光晕 (幽邃深空微光) */}
      <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-cyan-500/20 via-indigo-600/15 to-amber-400/10 blur-xl celestial-glow pointer-events-none" />

      {/* 外部外层：日全食贝利珠纯白流光弧 (r=88，外层巡弋，22s 逆转) */}
      <svg
        className="absolute inset-0 w-full h-full orbit-outer-white pointer-events-none"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <filter id="csBeadGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* 外层纯白光弧 (长约 110 度) */}
        <circle
          cx="100"
          cy="100"
          r="88"
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="110 440"
          opacity="0.95"
        />
        {/* 贝利珠耀斑聚光星点 */}
        <circle cx="100" cy="12" r="2.6" fill="#ffffff" filter="url(#csBeadGlow)" />
      </svg>

      {/* 外部内层：玄青至浅金日冕渐变弧 (r=78，内层快巡弋，14s 逆转，与外层隔离 10px 形成双星追逐) */}
      <svg
        className="absolute inset-0 w-full h-full orbit-inner-cyan pointer-events-none"
        viewBox="0 0 200 200"
        fill="none"
      >
        <defs>
          <linearGradient id="csInnerEclipseRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#818cf8" stopOpacity="0.75" />
            <stop offset="85%" stopColor="#fbbf24" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <filter id="csInnerCoronaBlur">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* 内层柔光渐变长弧 (长约 150 度) */}
        <circle
          cx="100"
          cy="100"
          r="78"
          stroke="url(#csInnerEclipseRim)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="150 340"
          filter="url(#csInnerCoronaBlur)"
        />
      </svg>

      {/* 逆向旋转的八卦星轨金环 (26s 逆转) */}
      <div className="absolute inset-2.5 rounded-full border border-amber-400/25 border-dashed orbit-slow-ccw pointer-events-none" />
      {/* 逆向旋转的青灵星轨点环 (26s 逆转) */}
      <div
        className="absolute inset-6 rounded-full border border-cyan-400/20 orbit-slow-ccw pointer-events-none"
        style={{ borderStyle: 'dotted' }}
      />

      {/* 浑天球本体：深邃墨色球体 + 核心八卦神经元全息投影 */}
      <div className="relative w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-[#070b14] border border-cyan-500/40 shadow-[inset_0_0_30px_rgba(34,211,238,0.25)] flex items-center justify-center overflow-hidden">
        {/* 内部量子扫描光栅线 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(6,182,212,0.08)_51%)] bg-[length:100%_4px] pointer-events-none" />

        {/* 正式天书万象 AI 完整 Logo (高精矢量八卦神经元太极印，18s 顺时针自转 + 内部微动效) */}
        <TianShuLogo
          size={160}
          className="w-36 h-36 sm:w-40 sm:h-40 animate-spin-slow drop-shadow-[0_0_24px_rgba(34,211,238,0.35)]"
          animated={true}
        />
      </div>
    </div>
  );
};

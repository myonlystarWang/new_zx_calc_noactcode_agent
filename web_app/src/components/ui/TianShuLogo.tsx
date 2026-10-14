import React from 'react';

interface TianShuLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export const TianShuLogo: React.FC<TianShuLogoProps> = ({ size = 32, className = '', animated = false }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="天书万象 AI Logo"
    >
      <defs>
        {/* 背景渐变 */}
        <radialGradient id="tsBgGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#162032" />
          <stop offset="60%" stopColor="#0b0f17" />
          <stop offset="100%" stopColor="#070a10" />
        </radialGradient>

        {/* 玄青灵光渐变 */}
        <linearGradient id="tsCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0891b2" />
        </linearGradient>

        {/* 浅金道芒渐变 */}
        <linearGradient id="tsGoldGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>

        {/* 混合光晕 */}
        <linearGradient id="tsDualGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>

        {/* 辉光滤镜 */}
        <filter id="tsGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* 底盘微光圆 */}
      <circle cx="50" cy="50" r="48" fill="url(#tsBgGrad)" stroke="#1e293b" strokeWidth="1" />

      {/* 外圈：八卦太极道印能量星轨 */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="url(#tsCyanGrad)"
        strokeWidth="1.2"
        strokeDasharray="4 2"
        opacity="0.65"
      />
      <circle
        cx="50"
        cy="50"
        r="41"
        stroke="url(#tsGoldGrad)"
        strokeWidth="0.8"
        strokeDasharray="16 4 2 4"
        opacity="0.8"
      />

      {/* 八卦方位道标星轨点 (8个基准卦位) */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 50 + 44 * Math.cos(rad);
        const y1 = 50 + 44 * Math.sin(rad);
        const x2 = 50 + 47 * Math.cos(rad);
        const y2 = 50 + 47 * Math.sin(rad);
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={deg % 90 === 0 ? '#22d3ee' : '#fbbf24'}
            strokeWidth={deg % 90 === 0 ? '1.8' : '1.2'}
            strokeLinecap="round"
            opacity="0.85"
          />
        );
      })}

      {/* 太极双鱼玄气流线 */}
      <path
        d="M 50 18 A 16 16 0 0 1 50 50 A 16 16 0 0 0 50 82 A 32 32 0 0 1 50 18 Z"
        fill="url(#tsCyanGrad)"
        opacity="0.14"
      />
      <path
        className={animated ? 'animate-taiji-lum' : undefined}
        d="M 50 18 A 16 16 0 0 1 50 50 A 16 16 0 0 0 50 82"
        stroke="url(#tsCyanGrad)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#tsGlow)"
        opacity="0.85"
      />

      {/* 核心内芯：天书竹简几何光束展开与神经元网络交织 */}
      <g className={animated ? 'animate-slips-lum' : undefined}>
        <rect x="36" y="27" width="4" height="46" rx="2" fill="url(#tsCyanGrad)" opacity="0.35" />
        <rect x="44" y="23" width="4" height="54" rx="2" fill="url(#tsDualGrad)" opacity="0.75" />
        <rect x="52" y="23" width="4" height="54" rx="2" fill="url(#tsDualGrad)" opacity="0.75" />
        <rect x="60" y="27" width="4" height="46" rx="2" fill="url(#tsGoldGrad)" opacity="0.35" />
      </g>

      {/* 神经元节点互联连线 */}
      <path
        d="M 32 38 L 46 32 L 54 44 L 68 36"
        stroke="#67e8f9"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M 32 62 L 46 56 L 54 68 L 68 62"
        stroke="#fbbf24"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.8"
      />
      {/* 突触量子数据流脉冲 */}
      <path
        className={animated ? 'animate-data-stream' : undefined}
        d="M 46 32 L 54 68 M 54 44 L 46 56"
        stroke="#c084fc"
        strokeWidth="1.3"
        strokeDasharray="3 3"
        opacity="0.9"
      />

      {/* 神经元聚能光斑结点 (交替呼吸脉冲) */}
      <g className={animated ? 'animate-node-pulse-1' : undefined}>
        <circle cx="32" cy="38" r="2.2" fill="#22d3ee" filter="url(#tsGlow)" />
        <circle cx="54" cy="44" r="3" fill="#ffffff" stroke="#fbbf24" strokeWidth="1" />
        <circle cx="46" cy="56" r="3" fill="#ffffff" stroke="#22d3ee" strokeWidth="1" />
        <circle cx="68" cy="62" r="2.2" fill="#fbbf24" filter="url(#tsGlow)" />
      </g>
      <g className={animated ? 'animate-node-pulse-2' : undefined}>
        <circle cx="46" cy="32" r="2.8" fill="#ffffff" stroke="#22d3ee" strokeWidth="1" />
        <circle cx="68" cy="36" r="2.2" fill="#fbbf24" filter="url(#tsGlow)" />
        <circle cx="32" cy="62" r="2.2" fill="#22d3ee" filter="url(#tsGlow)" />
        <circle cx="54" cy="68" r="2.8" fill="#ffffff" stroke="#fbbf24" strokeWidth="1" />
      </g>

      {/* 中央全知天目星芒 (强律动微聚光) */}
      <g className={animated ? 'animate-eye-beacon' : undefined}>
        <circle cx="50" cy="50" r="4.2" fill="#ffffff" filter="url(#tsGlow)" />
        <circle cx="50" cy="50" r="2.2" fill="#22d3ee" />
      </g>
    </svg>
  );
};

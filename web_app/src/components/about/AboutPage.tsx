import React from 'react';
import { TianShuLogo } from '../ui/TianShuLogo';

export const AboutPage: React.FC = () => {
  return (
    <div className="w-full min-h-full bg-[#070a10] text-slate-100 flex flex-col justify-between select-none">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 md:py-20 max-w-6xl mx-auto w-full">
        {/* 上方艺术线框卡片（仿照 Moonshot 极简美学） */}
        <div className="w-[380px] sm:w-[440px] max-w-full border border-white/20 bg-black/60 shadow-[0_0_50px_rgba(0,0,0,0.8)] mb-16 sm:mb-20">
          {/* 卡片头部标头 */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-white/20 font-serif">
            <span className="text-xl tracking-wide text-slate-100 font-medium">About</span>
            <div className="flex items-center gap-2">
              <TianShuLogo size={18} />
              <span className="text-xl tracking-wider text-cyan-300 font-semibold">TianShu AI</span>
            </div>
          </div>

          {/* 卡片留白区与极简艺术琴键图腾 */}
          <div className="pt-16 pb-0 flex flex-col items-center justify-end">
            <div className="w-full border-t border-white/20 bg-white">
              {/* 极简矢量黑白琴键 */}
              <svg viewBox="0 0 280 90" className="w-full h-auto block" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 14 个白键底槽 */}
                {Array.from({ length: 14 }).map((_, i) => (
                  <rect
                    key={`white-${i}`}
                    x={i * 20}
                    y={0}
                    width={20}
                    height={90}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth="1.2"
                  />
                ))}

                {/* 黑键组：2键-3键-2键-3键 律动结构 */}
                {[
                  13, 33,
                  73, 93, 113,
                  153, 173,
                  213, 233, 253
                ].map((bx, idx) => (
                  <rect
                    key={`black-${idx}`}
                    x={bx}
                    y={0}
                    width={14}
                    height={56}
                    fill="#000000"
                  />
                ))}
              </svg>
            </div>
          </div>
        </div>

        {/* 下方三栏愿景与哲学阐释 */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-left">
          {/* 左栏：标语与愿景 */}
          <div className="space-y-3">
            <h2 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
              我们的愿景
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 font-serif leading-relaxed">
              天地不仁以万物为刍狗 · 天书通晓诛仙万象规则
            </p>
          </div>

          {/* 中栏：第一性原理 */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p className="text-slate-400 font-serif">
              从浩瀚的诛仙世界走来，数以百计的门派分支、复杂的装备克制与深邃的副本机制，曾让无数仙友在迷乱中摸索。
            </p>
            <p>
              选择确立天书万象，是因为我们相信，真正强大的战术洞察，不应被冗杂的数据与晦涩的公式所壁垒。
            </p>
            <p>
              我们的第一性原理很简单：把确定性战斗推演与全知大模型深度融合。这不仅是一场关于数值的计算竞赛，而是一场关于游戏世界智能上限的永恒追问——模型思考越深，仙友行道越远。
            </p>
          </div>

          {/* 右栏：开放与普惠 */}
          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p className="text-slate-400 font-serif">
              通用智能不专属于任何一家机构、任何一片土地，它终将流向仙友们触手可及的每一个角落。我们愿做点亮诛仙战术智能的那群人——以严谨的数值工程和技术理想主义的固执，以及与千万仙友共同创造的诚意。
            </p>
            <p>
              我们坚信，当全知智能真正普惠的那一天到来，每一位仙友都能打破属性与流派的桎梏，随心所驭——去推演，去探索，去成为更完整的自己。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

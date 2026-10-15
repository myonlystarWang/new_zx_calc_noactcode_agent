import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE } from '../../routes';
import {
  Award,
  GitBranch,
  MessageSquare,
  ShieldCheck,
  Code2,
  Heart
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-full bg-[#05080f] text-slate-100 flex flex-col justify-between select-none">
      <div className="flex-1 flex flex-col items-center px-4 sm:px-6 py-10 md:py-16 max-w-4xl mx-auto w-full space-y-12 sm:space-y-14">
        {/* 顶部 Hero 标头区（无Logo与顶部胶囊，保留大标题、道风引言、平台定位与4项核心指标） */}
        <div className="flex flex-col items-center text-center max-w-3xl w-full">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-amber-300 mb-4">
            天书万象 AI · 诛仙全知大模型
          </h1>

          <p className="text-sm sm:text-base text-slate-400 font-serif-sc tracking-[0.22em] text-shadow mb-6">
            天地不仁以万物为刍狗 · 天书通晓诛仙万象规则
          </p>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl text-center">
            这是一个由诛仙资深老玩家打造的一站式诛仙战术推理与全域数据库平台。
            我们沉淀了海量真实的客户端底层数据，首创了高保真实战伤害计算公式与属性加权边际贡献分析体系，
            并结合诛仙全知大模型与丰富的装备属性模拟器，让每一位仙友的属性养成、装备抉择与副本实战都拥有确凿的数据支撑。
          </p>

          {/* 4 大核心关键指标看板 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full mt-8 pt-6 border-t border-slate-800/80">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-300 font-mono">
                17,000+
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">真实装备属性图</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300 font-mono">
                2,500+
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">全职业技能法宝</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-300 font-mono">
                97+
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">副本BOSS属性</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex flex-col items-center shadow-sm">
              <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300 font-mono">
                10ms
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">极速技能伤害计算</span>
            </div>
          </div>
        </div>

        {/* 运转机制：天书万象怎么工作 (借鉴 aihot 的轻量 Pipeline 管道) */}
        {/* <div className="w-full space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>天书万象是怎么运转的？</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">全量底层数据 · 数学建模 · 0ms本地推演</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs flex items-center justify-center font-mono">1</span>
                <span>真实客户端底层数据</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                全量逆向客户端原始参数，收录修武/昭武/彰武装备 0~+15 炼器阶梯与神机洗炼池、人神天脉全系技能、97 副本 BOSS 隐性抗性减免，杜绝凭空揣测。
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-xs flex items-center justify-center font-mono">2</span>
                <span>独创伤害公式与边际分析</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                首创高保真实战非线性伤害拟合公式，运用高等数学偏导数加权分析，计算每一项属性微小增量对实战秒伤的收益，彻底告别盲目堆属性与玄学配装。
              </p>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs flex items-center justify-center font-mono">3</span>
                <span>0ms 确定性边缘推演</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                100% 运行于仙友本地浏览器与静态边缘，无任何网络延迟与算力等待。结合四象轩辕策、神级天缘等趣味模拟矩阵，随时推演毕业期望。
              </p>
            </div>
          </div>
        </div> */}

        {/* 做这个站的人 (借鉴 aihot 的创作者自述与社区互动卡片) */}
        <div className="w-full p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900/60 via-[#0b101c]/80 to-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-5 shadow-lg">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-amber-500/30 border border-cyan-500/40 flex items-center justify-center text-slate-100 font-bold text-xs shrink-0">
                萝卜
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  做这个站的人：<span className="text-cyan-300">星耀-萝卜</span>
                </h4>
                <span className="text-[11px] text-slate-500">19年诛仙老玩家 · 数据与算法爱好者</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              天书万象 AI 一直在持续进化和修正。所有的更新细节与排期都记录在
              <button
                type="button"
                onClick={() => navigate(ROUTE.changelog)}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 mx-1 cursor-pointer font-medium"
              >
                更新动态
              </button>
              中；如果你在游戏实测中发现任何公式误差，或有新工具与攻略建议，随时来
              <button
                type="button"
                onClick={() => navigate(ROUTE.feedback)}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 mx-1 cursor-pointer font-medium"
              >
                仙友留言板
              </button>
              告诉我。
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate(ROUTE.changelog)}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <span>更新动态</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTE.feedback)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs text-amber-300 hover:text-amber-200 transition-all font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-950/20"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>仙友留言板</span>
            </button>
          </div>
        </div>

        {/* 我们的初心与致谢 (Craftsmanship & Heart) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start border-t border-slate-800/80 pt-10">
          <div className="md:col-span-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
              <Award className="w-4 h-4 text-amber-400" />
              <span>初心与致谢</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-100 tracking-tight leading-snug">
              让诛仙的数据回归真实，让攻略真正可算、可验
            </h3>
            <p className="text-xs text-slate-500 font-serif-sc">
              Created with passion & precision by 星耀-萝卜
            </p>
          </div>

          <div className="md:col-span-7 space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              从河阳城到青云之巅，诛仙已走过十几数载春秋。随着版本更迭，系统日益繁复，无数仙友在养成与配装中往往只能依靠碎片化的经验摸索，
              付出了大量的试错代价。
            </p>
            <p>
              我们创建天书万象的初衷非常简单：<strong className="text-slate-100">不搞弄虚作假的虚浮名利，只做实事求是的科学推演</strong>。
              每一条装备词条、每一个技能描述、每一份副本数据，每一次伤害数据，都经过我们与多位热爱诛仙的技术仙友逐项对照校验证实。
            </p>
            <p>
              愿天书万象 AI 能成为每一位仙友行道诛仙路上的得力智囊——去推演，去探索，把每一份热爱与心血，都用在最值得的刀刃上。
            </p>
          </div>
        </div>

        {/* 纯净开源原则 */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-800/60 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <ShieldCheck className="w-4 h-4 text-cyan-400/80 shrink-0" />
            <span>100% 静态边缘计算 · 零隐私上传</span>
          </div>
          <div className="flex items-center gap-2 justify-center">
            <Code2 className="w-4 h-4 text-amber-400/80 shrink-0" />
            <span>真实数据全量开放 · 拒绝任何虚假宣传</span>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-end">
            <Heart className="w-4 h-4 text-rose-400/80 shrink-0" />
            <span>纯粹由热爱驱动 · 与全服仙友共建</span>
          </div>
        </div>
      </div>
    </div>
  );
};

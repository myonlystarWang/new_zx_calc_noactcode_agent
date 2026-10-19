import React, { useState, useMemo } from 'react';
import { Sparkles, Link as LinkIcon, Flame } from 'lucide-react';

export interface FashionSkillLinkage {
    sourceSkill: string;
    effect: string;
}

export interface FashionSkillItem {
    id: string;
    zodiac: string;
    year: number;
    yearName: string;
    packageName: string;
    skillName: string;
    skillType: string;
    castTime: string;
    costMp: number;
    cooldown: number;
    cooldownText: string;
    baseEffect: string;
    linkageEffects: FashionSkillLinkage[];
    tags: string[];
}

export interface FashionSkillData {
    systemName?: string;
    category?: string;
    source?: string;
    description?: string;
    skills?: FashionSkillItem[];
}

export interface FashionSkillDetailCardProps {
    cardData?: {
        data?: FashionSkillData;
        initialSkillId?: string;
        initialZodiac?: string;
        activeJinshe?: boolean;
        activeZhushi?: boolean;
    };
    className?: string;
}

export const FashionSkillDetailCard: React.FC<FashionSkillDetailCardProps> = ({ cardData, className }) => {
    const data = cardData?.data;
    const skills = data?.skills || [];

    const [activeSkillId, setActiveSkillId] = useState<string>(() => {
        if (cardData?.initialSkillId) return cardData.initialSkillId;
        if (cardData?.initialZodiac) {
            const found = skills.find((s) => s.zodiac === cardData.initialZodiac);
            if (found) return found.id;
        }
        return skills[0]?.id || 'tiger_fuxing';
    });

    // 联动推演开关
    const [enableJinshe, setEnableJinshe] = useState<boolean>(() => {
        return cardData?.activeJinshe ?? true;
    });
    const [enableZhushi, setEnableZhushi] = useState<boolean>(() => {
        return cardData?.activeZhushi ?? true;
    });

    const [showLinkageMatrix, setShowLinkageMatrix] = useState(false);

    const activeSkill = useMemo(() => {
        return skills.find((s) => s.id === activeSkillId) || skills[0];
    }, [skills, activeSkillId]);

    if (!activeSkill) return null;

    // 是否有金蛇狂舞联动
    const hasJinsheLink = activeSkill.linkageEffects.some((l) => l.sourceSkill.includes('金蛇狂舞'));
    // 是否有诸事顺利联动
    const hasZhushiLink = activeSkill.linkageEffects.some((l) => l.sourceSkill.includes('诸事顺利'));

    return (
        <div className={`w-full max-w-xl bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 text-xs font-sans shadow-xl select-none ${className || ''}`}>
            {/* 顶部标题栏与徽标 */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-2 mb-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-[#f43f5e] shadow-[0_0_8px_#f43f5e]"></span>
                    <span className="text-[13px] font-bold text-white tracking-wide">
                        {data?.systemName || '贺岁时装技能图鉴'}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#f43f5e]/15 border border-[#f43f5e]/30 text-[#fda4af]">
                        十二生肖贺岁装
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#38bdf8]/15 border border-[#38bdf8]/30 text-[#7dd3fc]">
                        {activeSkill.year}年 · {activeSkill.zodiac}
                    </span>
                </div>
                <button
                    onClick={() => setShowLinkageMatrix(!showLinkageMatrix)}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-[#1e293b]/70 hover:bg-[#334155] text-[#38bdf8] text-[11px] transition-colors border border-[#38bdf8]/20"
                >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>{showLinkageMatrix ? '收起矩阵' : '联动矩阵'}</span>
                </button>
            </div>

            {/* 十二生肖选择滑条/胶囊 */}
            <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                    <span className="text-[#94a3b8]">选择生肖时装技能：</span>
                    <span className="text-[#fda4af] font-medium">
                        {activeSkill.yearName} · 《{activeSkill.skillName}》
                    </span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                    {skills.map((s) => {
                        const isActive = s.id === activeSkillId;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setActiveSkillId(s.id)}
                                className={`flex flex-col items-center justify-center py-1 rounded transition-all text-center ${
                                    isActive
                                        ? 'bg-[#f43f5e] text-white font-bold shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                                        : 'bg-[#1e293b]/70 text-[#94a3b8] hover:bg-[#1e293b] hover:text-white'
                                }`}
                                title={`${s.yearName}：${s.skillName}`}
                            >
                                <span className="text-[12px] leading-tight">{s.zodiac}</span>
                                <span className="text-[9px] scale-90 opacity-80 leading-tight">'{String(s.year).slice(2)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 技能高保真展示面板 */}
            <div className="bg-[#0f172a]/80 rounded border border-[#1e293b] p-3 mb-2.5">
                <div className="flex items-start justify-between border-b border-[#1e293b]/70 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded bg-[#1e293b] border border-[#f43f5e]/40 flex items-center justify-center text-[#fda4af] shadow-inner font-bold text-sm">
                            {activeSkill.zodiac}
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-[#fecdd3] tracking-wide">
                                    {activeSkill.skillName}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#f43f5e]/20 text-[#fda4af] border border-[#f43f5e]/30">
                                    {activeSkill.skillType}
                                </span>
                            </div>
                            <span className="text-[10px] text-[#64748b] block mt-0.5">
                                来源礼包：{activeSkill.packageName}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 技能规格参数 */}
                <div className="grid grid-cols-3 gap-2 bg-[#0b0f19]/70 rounded p-1.5 mb-2.5 text-[11px] border border-[#1e293b]/50">
                    <div>
                        <span className="text-[#64748b]">施法时间：</span>
                        <span className="text-[#e2e8f0] font-medium ml-1">{activeSkill.castTime}</span>
                    </div>
                    <div>
                        <span className="text-[#64748b]">消耗真气：</span>
                        <span className="text-[#e2e8f0] font-medium ml-1">{activeSkill.costMp > 0 ? `${activeSkill.costMp}点` : '0点'}</span>
                    </div>
                    <div>
                        <span className="text-[#64748b]">冷却时间：</span>
                        <span className="text-[#38bdf8] font-medium ml-1">
                            {enableZhushi && activeSkill.id === 'snake_jinshe'
                                ? '12分钟 (720秒)'
                                : enableJinshe && activeSkill.id === 'dragon_longteng'
                                ? '12分钟 (720秒)'
                                : activeSkill.cooldownText}
                        </span>
                    </div>
                </div>

                {/* 基础技能效果 */}
                <div className="mb-2.5">
                    <span className="text-[11px] font-semibold text-[#94a3b8] block mb-1">【基础特技效果】</span>
                    <p className="text-[#cbd5e1] text-[11px] leading-relaxed bg-[#0b0f19]/40 p-2 rounded border border-[#1e293b]/40 whitespace-pre-line">
                        {activeSkill.baseEffect}
                    </p>
                </div>

                {/* 联动强化测算与预览 */}
                {(hasJinsheLink || hasZhushiLink || activeSkill.linkageEffects.length > 0) && (
                    <div className="bg-[#1e1e2f]/50 rounded border border-[#818cf8]/30 p-2.5 mb-2">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1 text-[#a5b4fc] font-semibold text-[11px]">
                                <Sparkles className="w-3.5 h-3.5 text-[#818cf8]" />
                                <span>生肖联动增强推演</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {hasJinsheLink && (
                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[#cbd5e1]">
                                        <input
                                            type="checkbox"
                                            checked={enableJinshe}
                                            onChange={(e) => setEnableJinshe(e.target.checked)}
                                            className="rounded border-[#475569] text-[#818cf8] focus:ring-0 w-3 h-3 cursor-pointer"
                                        />
                                        <span>金蛇狂舞联动</span>
                                    </label>
                                )}
                                {hasZhushiLink && (
                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-[#cbd5e1]">
                                        <input
                                            type="checkbox"
                                            checked={enableZhushi}
                                            onChange={(e) => setEnableZhushi(e.target.checked)}
                                            className="rounded border-[#475569] text-[#f43f5e] focus:ring-0 w-3 h-3 cursor-pointer"
                                        />
                                        <span>诸事顺利联动</span>
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* 强化效果列表 */}
                        <div className="space-y-1.5">
                            {activeSkill.linkageEffects.map((l, idx) => {
                                const isJinshe = l.sourceSkill.includes('金蛇狂舞');
                                const isZhushi = l.sourceSkill.includes('诸事顺利');
                                const isActive = (isJinshe && enableJinshe) || (isZhushi && enableZhushi) || (!isJinshe && !isZhushi);

                                return (
                                    <div
                                        key={idx}
                                        className={`p-1.5 rounded border transition-colors ${
                                            isActive
                                                ? 'bg-[#312e81]/30 border-[#6366f1]/50 text-[#c7d2fe]'
                                                : 'bg-[#18181b]/40 border-[#27272a] text-[#71717a]'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="font-semibold text-[10px] flex items-center gap-1">
                                                <Flame className={`w-3 h-3 ${isActive ? 'text-[#f59e0b]' : 'text-[#71717a]'}`} />
                                                {l.sourceSkill}
                                            </span>
                                            <span className={`text-[9px] px-1 rounded ${
                                                isActive ? 'bg-[#10b981]/20 text-[#34d399]' : 'bg-[#27272a] text-[#71717a]'
                                            }`}>
                                                {isActive ? '已激活生效' : '未勾选激活'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] leading-tight">{l.effect}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 技能标签 */}
                <div className="flex items-center gap-1 flex-wrap pt-1">
                    {activeSkill.tags.map((tag, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-[#1e293b]/80 text-[#94a3b8] text-[10px] border border-[#334155]">
                            #{tag}
                        </span>
                    ))}
                </div>
            </div>

            {/* 联动矩阵折叠抽屉 */}
            {showLinkageMatrix && (
                <div className="bg-[#0f172a] rounded border border-[#1e293b] p-2.5 mb-2 text-[11px] animate-fadeIn">
                    <div className="text-[#38bdf8] font-bold mb-1.5 flex items-center gap-1">
                        <LinkIcon className="w-3.5 h-3.5" />
                        <span>生肖时装技能代际联动总览</span>
                    </div>
                    <div className="space-y-2 text-[#94a3b8]">
                        <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                            <span className="text-[#f59e0b] font-semibold block mb-0.5">
                                1. 蛇年【金蛇狂舞】联动群（强化虎/兔/龙 3大生肖技能）：
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10px] text-[#cbd5e1]">
                                <li><strong>虎·福星高照</strong>：追加无敌与免负面 3 次（共 6 次）</li>
                                <li><strong>兔·玉阙玄天</strong>：真气降为 0、解控+3、抗性+17、移速持续+5秒</li>
                                <li><strong>龙·龙腾四海</strong>：解控+1、回蓝+10000、冷却减少 180 秒</li>
                            </ul>
                        </div>
                        <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                            <span className="text-[#f43f5e] font-semibold block mb-0.5">
                                2. 猪年【诸事顺利】大联动群（被动大赋能虎至狗 9大生肖技能）：
                            </span>
                            <p className="text-[10px] text-[#cbd5e1] leading-relaxed">
                                福星高照逆转逆转状态；玉阙玄天移速额外+0.8m/s；龙腾四海5秒免不利；金蛇狂舞CD-180秒；天马行空反弹率升至100%；三阳开泰回复+20%抗性+5%；灵猴兆瑞免冰冻5秒；金鸡迎春持续延长60秒；白云苍狗额外降躲闪10点、增暴率10%、增爆伤20%。
                            </p>
                        </div>
                        <div className="bg-[#0b0f19] p-2 rounded border border-[#1e293b]">
                            <span className="text-[#a855f7] font-semibold block mb-0.5">
                                3. 特殊机制联动：
                            </span>
                            <ul className="list-disc list-inside space-y-0.5 pl-1 text-[10px] text-[#cbd5e1]">
                                <li><strong>羊·三阳开泰</strong>：永久激活三大主角时装特技隐藏效果</li>
                                <li><strong>鸡·金鸡迎春</strong>：彩凤/扶桑被动强化天罡云体/战意技能（CD-60s）</li>
                                <li><strong>牛·牛转乾坤</strong>：直接重置核心爆发技能【神力爆发】的冷却时间</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* 底部元数据 */}
            <div className="text-[10px] text-[#64748b] flex items-center justify-between pt-1">
                <span>{data?.source || '来源：官方论坛权威数据帖（夜深篱落一灯明整理）'}</span>
                <span>数据完整校验 · 支持联动推演</span>
            </div>
        </div>
    );
};

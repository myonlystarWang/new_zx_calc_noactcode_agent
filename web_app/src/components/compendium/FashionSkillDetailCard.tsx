import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { GameColorText } from '../ui/GameColorText';

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
    };
    className?: string;
}

interface ExactFashionSkillDisplay {
    header: React.ReactNode;
    bodyGameColorText: string;
}

/**
 * 1:1 游戏实机截图精细化配置（福星高照、玉阙玄天、龙腾四海、金蛇狂舞）
 * 严格保持与未名斩<煞>完全相同的游戏原版色彩码：
 * 紫色：^aa32ff
 * 绿色：^11ff11
 * 天蓝：^11aaff
 * 金黄：^ffcb4a
 * 纯白：^ffffff
 */
const EXACT_SKILL_DISPLAYS: Record<string, ExactFashionSkillDisplay> = {
    // 1. 福星高照（虎年 · 自身祝福）
    tiger_fuxing: {
        header: (
            <div className="space-y-0.5">
                <div className="text-white font-bold text-[13.5px]">福星高照</div>
                <div style={{ color: '#11aaff' }} className="text-[12.5px]">自身祝福</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff清除自身^ffcb4a6^ffffff个负面状态，并令自身免',
            '^ffffff疫伤害和负面状态^ffcb4a3^ffffff次，效果最多持',
            '^ffffff续^ffcb4a30^ffffff秒，冷却时间^ffcb4a5^ffffff分钟。',
            '',
            '^aa32ff『 金蛇狂舞 · 加强版 』',
            '^11ff11追加自身免疫伤害和负面状态^ffcb4a3^11ff11次。'
        ].join('\n')
    },

    // 2. 玉阙玄天（兔年 · 祝福 · 1秒施放）
    rabbit_yuque: {
        header: (
            <div className="flex items-center justify-between text-[13px]">
                <span style={{ color: '#11aaff' }} className="font-bold text-[13.5px]">玉阙玄天</span>
                <span className="text-white text-[12.5px]">祝福  1秒施放</span>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffcb4a皎然银辉冰玉兔，沐洒天河碧婵宫。',
            '',
            '^ffffff消耗真气：120点',
            '^ffffff冷却时间：300秒',
            '^11ff11立即清除自身^ffcb4a3^11ff11个负面状态，同时^ffcb4a20^11ff11秒',
            '^11ff11内自身所有抗性提升^ffcb4a53^11ff11点，移动速度增',
            '^11ff11加^ffcb4a4.2^11ff11米/秒，坐骑移动速度^ffcb4a1.0^11ff11米/秒。',
            '^11ff11施法时令你获得一个常态效果，^ffcb4a3600^11ff11秒',
            '^11ff11内增加自身攻击力^ffcb4a118^11ff11点。',
            '',
            '^aa32ff『 金蛇狂舞 · 加强版 』',
            '^11ff11消耗真气降为^ffcb4a0^11ff11。',
            '^11ff11追加清除自身负面状态^ffcb4a3^11ff11个。',
            '^11ff11抗性提升追加^ffcb4a17^11ff11点，持续时间延长^ffcb4a5^11ff11秒。',
            '^11ff11追加^ffcb4a5^11ff11秒加速时间。'
        ].join('\n')
    },

    // 3. 龙腾四海（龙年 · 祝福技能 · 1秒施放）
    dragon_longteng: {
        header: (
            <div className="space-y-0.5">
                <div className="text-white font-bold text-[13.5px]">龙腾四海</div>
                <div style={{ color: '#11aaff' }} className="text-[12.5px]">祝福技能</div>
                <div className="text-white text-[12.5px]">1 秒施放</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^11aaff0 真气',
            '^ffffff1分钟内增强吃药效果^ffcb4a100%^ffffff，清除自',
            '^ffffff身及队伍成员^ffcb4a2^ffffff个负面状态，^ffcb4a25^ffffff秒内',
            '^ffffff增加技能命中^ffcb4a40^ffffff点，^ffcb4a900^ffffff秒内增加自',
            '^ffffff身防御^ffcb4a70^ffffff点，^ffcb4a200^ffffff秒内持续回复真气',
            '^ffcb4a20000^ffffff点，冷却时间^ffcb4a900^ffffff秒。',
            '',
            '^aa32ff『 金蛇狂舞 · 加强版 』',
            '^11ff11追加清除自身与队伍成员负面状态^ffcb4a1^11ff11个。',
            '^11ff11追加持续恢复真气^ffcb4a10000^11ff11点。',
            '^11ff11冷却时间减少^ffcb4a180^11ff11秒。'
        ].join('\n')
    },

    // 4. 金蛇狂舞（蛇年 · 自身祝福 · 联动引擎）
    snake_jinshe: {
        header: (
            <div className="space-y-0.5">
                <div className="text-white font-bold text-[13.5px]">金蛇狂舞</div>
                <div style={{ color: '#11aaff' }} className="text-[12.5px]">自身祝福</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff自身在^ffcb4a3600^ffffff秒内增加自身攻击力^ffcb4a200^ffffff点，在^ffcb4a900^ffffff秒',
            '^ffffff内共回复^ffcb4a72000^ffffff气血，^ffcb4a25^ffffff秒内增加自身技能躲闪',
            '^ffcb4a20^ffffff点且缩短自身释法速度^ffcb4a20%^ffffff，冷却时间^ffcb4a15^ffffff分钟。',
            '^aa32ff『 金蛇狂舞 』^11ff11分别被动强化^aa32ff『 龙腾四海 』^11ff11、^aa32ff『 玉',
            '^aa32ff阙玄天 』^11ff11、^aa32ff『 福星高照 』^11ff11的部分技能效果'
        ].join('\n')
    },

    // 5. 天马行空（马年 · 自身祝福）
    horse_tianma: {
        header: (
            <div className="space-y-0.5">
                <div className="text-white font-bold text-[13.5px]">天马行空</div>
                <div style={{ color: '#11aaff' }} className="text-[12.5px]">自身祝福</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff自身在^ffcb4a10^ffffff秒内免疫致命一击和多种负面状态，并且',
            '^ffffff有^ffcb4a30%^ffffff概率反弹技能效果^ffcb4a4^ffffff次，立刻回复自身最大元',
            '^ffffff力值^ffcb4a50%^ffffff，^ffcb4a900^ffffff秒内回复自身气血^ffcb4a72000^ffffff点，^ffcb4a900^ffffff秒内回',
            '^ffffff复自身真气^ffcb4a72000^ffffff点，冷却时间^ffcb4a15^ffffff分钟。',
            '^ff2222技能反弹效果仅对^11ff11玩家目标生效'
        ].join('\n')
    },

    // 6. 三阳开泰（羊年 · 自身祝福）
    goat_sanyang: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#11aaff' }} className="font-bold text-[13.5px]">三阳开泰</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">三阳交泰，日新惟良。</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff自身祝福',
            '^ffffff施法时间：1秒',
            '^ffffff消耗真气：360点',
            '^ffffff冷却时间：360秒',
            '^11ff11效果一：立即回复自身30%的气血、真气、元力；',
            '^11ff11效果二：提高所有抗性10%持续30秒，可与其他抗性增益效果叠加；',
            '^11ff11永久生效：激活三大主角时装特技的隐藏效果，包含经典版及荣耀版。'
        ].join('\n')
    },

    // 7. 灵猴兆瑞（猴年 · 自身祝福）
    monkey_linghou: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#11aaff' }} className="font-bold text-[13.5px]">灵猴兆瑞</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">通变化，知休咎，万物皆明。</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff自身祝福',
            '^11aaff施法时间：1秒',
            '^11aaff消耗真气：666点',
            '^11aaff冷却时间：360秒',
            '^ffffff当自身受到^11ff11魅惑^ffffff及部分^11ff11移动受阻类^ffffff效果时，使用后有',
            '^ffcb4a50%^ffffff概率缩短受控制时间^ffcb4a80%^ffffff，并反弹状态类攻击给',
            '^ffffff施放该状态的目标，持续^ffcb4a10^ffffff秒，计算目标抗性；同时',
            '^ffffff增加自身致命一击率，效果与自身当前致命一击率相关，',
            '^ffcb4a60^ffffff秒内增强吃药效果^ffcb4a50%^ffffff。',
            '^11aaff本命：^aa32ff灵明通悟——有^ffcb4a50%^aa32ff概率直接解除魅惑及部分',
            '^aa32ff移动受阻效果。'
        ].join('\n')
    },

    // 8. 金鸡迎春（鸡年 · 自身祝福）
    rooster_jinji: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#aa32ff' }} className="font-bold text-[13.5px]">金鸡迎春</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">金鸡迎春，瑞满乾坤</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^ffffff自身祝福',
            '^ffffff施法时间：1秒',
            '^ffffff消耗真气：2017点',
            '^ffffff冷却时间：360秒',
            '^ffcb4a300^ffffff秒内增加自身致命一击伤害^ffcb4a27%^ffffff，额外增加自身攻击',
            '^ffffff力和防御力^ffcb4a360^ffffff点。',
            '^aa32ff彩凤 ^11aaff被动增强^11ff11天罡云体^11aaff技能，令其冷却时间下降^ffcb4a60^11aaff秒，',
            '^11aaff并依据其技能级别提升最终祝福效果',
            '^aa32ff扶桑 ^11aaff被动增强^11ff11天罡战意^11aaff技能，令其冷却时间降低^ffcb4a60^11aaff秒，',
            '^11aaff并依据其技能级别提升最终祝福效果'
        ].join('\n')
    },

    // 9. 白云苍狗（狗年 · 单体诅咒）
    dog_baiyun: {
        header: (
            <div className="space-y-0.5">
                <div className="text-white font-bold text-[13.5px]">白云苍狗</div>
                <div style={{ color: '#11aaff' }} className="text-[12.5px]">单体诅咒</div>
                <div className="text-white text-[12.5px]">1秒释放</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^11aaff1000真气',
            '^ffffff降低目标技能闪躲^ffcb4a30^ffffff点，增加目标被致命一击概率，',
            '^ffffff效果与自身致命一击率相关，最多增加目标被致命一击概率^ffcb4a40%^ffffff，',
            '^ffffff增加目标受到的致命一击伤害，效果与自身致命一击伤害相关，',
            '^ffffff最多增加目标受到的致命一击伤害^ffcb4a100%^ffffff，持续^ffcb4a20^ffffff秒。',
            '',
            '^ffffff冷却时间^ffcb4a360^ffffff秒。'
        ].join('\n')
    },

    // 10. 诸事顺利（猪年 · 被动增强）
    boar_zhushi: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#aa32ff' }} className="font-bold text-[13.5px]">诸事顺利</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">金猪护佑，诸事顺遂。</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^aa32ff被动',
            '^11aaff被动增强^11ff11福星高照^11aaff技能，令其可额外清除自身的逆转状态。',
            '^11aaff被动增强^11ff11玉阙玄天^11aaff技能，令自身移动速度额外增加^ffcb4a0.8^11aaff米/秒。',
            '^11aaff被动增强^11ff11龙腾四海^11aaff技能，令自身^ffcb4a5^11aaff秒内免疫大部分不利效果。',
            '^11aaff被动增强^11ff11金蛇狂舞^11aaff技能，令其冷却时间降低^ffcb4a180^11aaff秒。',
            '^11aaff被动增强^11ff11天马行空^11aaff技能，令其反弹技能概率提升至^ffcb4a100%^11aaff。',
            '^11aaff被动增强^11ff11三阳开泰^11aaff技能，令其回复效果增加^ffcb4a20%^11aaff，提抗效果增加^ffcb4a5%^11aaff。',
            '^11aaff被动增强^11ff11灵猴兆瑞^11aaff技能，令自身额外获得免疫冰冻效果^ffcb4a5^11aaff秒。',
            '^11aaff被动增强^11ff11金鸡迎春^11aaff技能，令自身增加爆伤、攻击和防御效果持续时间延长^ffcb4a60^11aaff秒。',
            '^11aaff被动增强^11ff11白云苍狗^11aaff技能，令其额外降低目标技能闪躲^ffcb4a10^11aaff点，',
            '^11aaff额外增加目标被致命一击概率^ffcb4a10%^11aaff，被致命一击伤害^ffcb4a20%^11aaff。'
        ].join('\n')
    },

    // 11. 乐不思鼠（鼠年 · 被动增强）
    rat_lebu: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#aa32ff' }} className="font-bold text-[13.5px]">乐不思鼠</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">百福临门常有余，祥云瑞气聚鼠年！</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^aa32ff被动',
            '^11aaff被动增强^11ff11天罡步尘^11aaff技能，令其每级可额外',
            '^11aaff提升自身技能闪躲^ffcb4a1^11aaff点，持续^ffcb4a30^11aaff秒。',
            '^11aaff被动增强^11ff11天罡浩气^11aaff技能，令其每级可额外',
            '^11aaff减免自身受到的致命一击伤害^ffcb4a1%^11aaff。'
        ].join('\n')
    },

    // 12. 牛转乾坤（牛年 · 自身祝福）
    ox_niuzhuan: {
        header: (
            <div className="space-y-0.5">
                <div style={{ color: '#aa32ff' }} className="font-bold text-[13.5px]">牛转乾坤</div>
                <div style={{ color: '#ffcb4a' }} className="text-[12.5px]">春迎鸿福人兴旺，牛转乾坤好运来。</div>
            </div>
        ),
        bodyGameColorText: [
            '',
            '^11aaff自身祝福',
            '^11aaff施法时间 ^ffcb4a1 ^11aaff秒',
            '^11aaff真气消耗 ^ffffff2021 ^11aaff点',
            '^11aaff技能冷却 ^ffcb4a600 ^11aaff秒',
            '',
            '^ffffff立即清除自身^11ff11神力爆发^ffffff技能的冷却。'
        ].join('\n')
    }
};

/**
 * 通用数字高亮提取（数字与百分比标黄）
 */
function highlightNumbersInText(text: string, baseColorHex = 'ffffff'): string {
    if (!text) return '';
    return text.replace(/(\d+(\.\d+)?%?)/g, `^ffcb4a$1^${baseColorHex}`);
}

function buildDefaultSkillDisplay(skill: FashionSkillItem): ExactFashionSkillDisplay {
    const header = (
        <div className="space-y-0.5">
            <div className="text-white font-bold text-[13.5px]">{skill.skillName}</div>
            <div style={{ color: '#11aaff' }} className="text-[12.5px]">{skill.skillType}</div>
            {skill.castTime && skill.castTime !== '瞬发' && (
                <div className="text-white text-[12.5px]">{skill.castTime}施放</div>
            )}
        </div>
    );

    const lines: string[] = [''];

    // 消耗与冷却
    if (skill.costMp > 0 || skill.cooldown > 0) {
        if (skill.costMp > 0) {
            lines.push(`^ffffff消耗真气：${skill.costMp}点`);
        }
        if (skill.cooldownText) {
            lines.push(`^ffffff冷却时间：${skill.cooldownText}`);
        }
    }

    // 正文
    if (skill.baseEffect) {
        lines.push(`^ffffff${highlightNumbersInText(skill.baseEffect, 'ffffff')}`);
    }

    // 联动效果
    if (skill.linkageEffects && skill.linkageEffects.length > 0) {
        skill.linkageEffects.forEach((l) => {
            lines.push('');
            lines.push(`^aa32ff『 ${l.sourceSkill} 』`);
            lines.push(`^11ff11${highlightNumbersInText(l.effect, '11ff11')}`);
        });
    }

    return {
        header,
        bodyGameColorText: lines.join('\n')
    };
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

    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const updateScrollState = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        setCanScrollLeft(el.scrollLeft > 4);
        setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }, []);

    const scrollToActiveItem = useCallback((smooth = true) => {
        const el = scrollRef.current;
        if (!el) return;
        const activeBtn = el.querySelector<HTMLElement>('[data-active="true"]');
        if (activeBtn) {
            const containerLeft = el.getBoundingClientRect().left;
            const containerWidth = el.clientWidth;
            const itemLeft = activeBtn.getBoundingClientRect().left;
            const itemWidth = activeBtn.clientWidth;
            const offset = (itemLeft - containerLeft) - (containerWidth / 2 - itemWidth / 2);
            el.scrollBy({
                left: offset,
                behavior: smooth ? 'smooth' : 'auto'
            });
        }
        setTimeout(updateScrollState, 220);
    }, [updateScrollState]);

    useEffect(() => {
        updateScrollState();
        const handleResize = () => updateScrollState();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateScrollState]);

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToActiveItem(true);
        }, 50);
        return () => clearTimeout(timer);
    }, [activeSkillId, scrollToActiveItem]);

    // 滚轮横向滑动
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const handleWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
                updateScrollState();
            }
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [updateScrollState]);

    const handleScrollStep = (direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const step = 200;
        el.scrollBy({
            left: direction === 'left' ? -step : step,
            behavior: 'smooth'
        });
        setTimeout(updateScrollState, 220);
    };

    const activeSkill = useMemo(() => {
        return skills.find((s) => s.id === activeSkillId) || skills[0];
    }, [skills, activeSkillId]);

    const displayData = useMemo(() => {
        if (!activeSkill) return null;
        if (EXACT_SKILL_DISPLAYS[activeSkill.id]) {
            return EXACT_SKILL_DISPLAYS[activeSkill.id];
        }
        return buildDefaultSkillDisplay(activeSkill);
    }, [activeSkill]);

    if (!activeSkill || !displayData) return null;

    return (
        <div className={clsx('w-full min-w-0 max-w-full flex flex-col gap-3 select-none', className)}>
            {/* 0. 顶层十二生肖技能切换栏：占满 AI 对话框完整宽度 w-full */}
            <div className="relative flex items-center bg-[#0a0f18]/80 border border-slate-800/80 rounded-lg p-1 gap-1.5 w-full">
                {canScrollLeft && (
                    <button
                        type="button"
                        onClick={() => handleScrollStep('left')}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                        title="向左滚动"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                )}

                <div
                    ref={scrollRef}
                    className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
                >
                    {skills.map((s) => {
                        const isActive = s.id === activeSkillId;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                data-active={isActive ? 'true' : 'false'}
                                onClick={() => setActiveSkillId(s.id)}
                                className={clsx(
                                    'px-2.5 py-1 rounded text-xs transition-all shrink-0 cursor-pointer',
                                    isActive
                                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 font-bold shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                                )}
                            >
                                {s.skillName}
                            </button>
                        );
                    })}
                </div>

                {canScrollRight && (
                    <button
                        type="button"
                        onClick={() => handleScrollStep('right')}
                        className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors shrink-0 cursor-pointer"
                        title="向右滚动"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* 1. 下方核心技能卡片：1:1 游戏实机原生 Tooltip 视效容器，右侧预留约6个字符余量 */}
            <div
                className="rounded-xl p-3.5 sm:p-4 pr-8 sm:pr-10 text-[13px] leading-[22px] border border-[#2d3a4d] bg-[#0c1420]/95 shadow-2xl min-w-0 flex flex-col gap-1 w-fit min-w-[340px] sm:min-w-[440px] max-w-[530px]"
                style={{
                    fontFamily: '"SimSun", "宋体", "Microsoft YaHei", sans-serif',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 16px rgba(16, 28, 48, 0.4)',
                    letterSpacing: '0.3px'
                }}
            >
                {/* 技能头部：技能名、类型与施法时间（无多余标签） */}
                {displayData.header}

                {/* 技能正文：1:1 游戏原生色彩码（白字/鲜绿字，数字金黄，加强版紫字） */}
                <div className="text-[13px] leading-[22px]">
                    <GameColorText text={displayData.bodyGameColorText} />
                </div>
            </div>
        </div>
    );
};


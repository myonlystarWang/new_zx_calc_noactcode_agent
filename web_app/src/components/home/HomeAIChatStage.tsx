import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    Plus,
    Send,
    X,
    ExternalLink,
    RefreshCw,
    Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    type CopilotMessage,
    type BossCandidateItem
} from '../../services/CopilotService';
import { DataService } from '../../services/DataService';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { FabaoDetailCard } from '../compendium/FabaoDetailCard';
import { EquipDetailCard } from '../compendium/EquipDetailCard';
import { SkillDetailCard } from '../compendium/SkillDetailCard';
import { BossDetailCard } from '../compendium/BossDetailCard';
import { ClassStatusCard } from '../compendium/ClassStatusCard';
import { PeizhangDetailCard } from '../compendium/PeizhangDetailCard';
import { JiuwenlangDetailCard } from '../compendium/JiuwenlangDetailCard';
import { OldTianyuanDetailCard } from '../compendium/OldTianyuanDetailCard';
import { NewTianyuanDetailCard } from '../compendium/NewTianyuanDetailCard';
import { NewTianyuanSimCard } from '../compendium/NewTianyuanSimCard';
import { XycTomeDetailCard } from '../compendium/XycTomeDetailCard';
import { XycWashCard } from '../compendium/XycWashCard';
import { XingsuDetailCard } from '../compendium/XingsuDetailCard';
import { BaoshiDetailCard } from '../compendium/BaoshiDetailCard';
import { SilinBenyuanCard } from '../compendium/SilinBenyuanCard';
import { FashionSkillDetailCard } from '../compendium/FashionSkillDetailCard';
import { NinglingqiDetailCard } from '../compendium/NinglingqiDetailCard';
import { PetPledgeDetailCard } from '../compendium/PetPledgeDetailCard';
import { ZhenlingUpgradeCard } from '../compendium/ZhenlingUpgradeCard';
import { FabaoUpgradeCard } from '../compendium/FabaoUpgradeCard';
import { ShenjiForgeCard } from '../compendium/ShenjiForgeCard';
import { YunlingForgeCard } from '../compendium/YunlingForgeCard';
import { CeilingDetailCard } from '../compendium/CeilingDetailCard';
import { CandidateSelectorBar } from './CandidateSelectorBar';
import { GameColorText } from '../ui/GameColorText';
import { ACCENT_BUTTON, ACCENT_BUTTON_ICON } from '../ui/accentButtonStyles';
import { useApp } from '../../context/AppContext';
import { VisionReviewCard } from '../vision/VisionReviewCard';
import type { RecognizedPanel } from '../../services/vision/types';
import { ChatPlusMenu } from '../chat/ChatPlusMenu';
import type { WorkspaceMode } from '../workspace/SplitScreenWorkspace';
import type { FabaoItem, CuratedEquipItem, CuratedSkillItem } from '../../types';
import { trackCardClick } from '../../utils/track';

/**
 * card_click 的主体名：className / slot / title 取第一个有值的。
 * 没有它只知道「有人点了技能查询」，不知道「哪个职业的技能查询」。
 */
const cardSubject = (cd: any): string =>
    String(cd?.className || cd?.slot || cd?.title || '').slice(0, 16);

export interface WorkspaceParams {
    zhanQu?: string;
    serverName?: string;
    serverId?: string;
    [key: string]: any;
}

interface HomeAIChatStageProps {
    messages: CopilotMessage[];
    isLoading: boolean;
    onSendMessage: (text: string, image?: string, displayText?: string) => void;
    onBackToHome: () => void;
    isSplitOpen?: boolean;
    onToggleSplit?: () => void;
    onOpenSplitWorkspace?: (mode: WorkspaceMode, params?: WorkspaceParams) => void;
}

export const HomeAIChatStage: React.FC<HomeAIChatStageProps> = ({
    messages,
    isLoading,
    onSendMessage,
    onBackToHome,
    isSplitOpen = false,
    onToggleSplit: _onToggleSplit,
    onOpenSplitWorkspace,
}) => {
    const navigate = useNavigate();
    const { updateCharacterAttributes, updateCharacterClass, selectDungeon, userCharacter } = useApp();

    const handleBringToCalculator = useCallback((dungeonId: string, monsterId: string) => {
        selectDungeon(dungeonId, monsterId);
        if (onOpenSplitWorkspace) {
            onOpenSplitWorkspace('calc');
        } else {
            navigate('/calculator');
        }
    }, [selectDungeon, onOpenSplitWorkspace, navigate]);

    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
    /** 手机输入舱可用宽度仅 ~250px，长占位文案会被截掉一半 */
    const isMobile = useIsMobile();

    // 候选列表选中的索引状态（按消息 ID 索引）
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<Record<string, number>>({});


    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const lastUserMsgElRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    const focusChatInput = useCallback(() => {
        // 移动端不自动聚焦，避免弹出软键盘遮挡聊天流与卡片
        if (isMobile) return;

        // 若用户当前正在划词选择文本，绝不强行夺焦，保障鼠标复制体验
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            return;
        }
        // 若当前光标正处于其他微调输入框或选择器中，不强行夺焦
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') && active !== chatInputRef.current) {
            return;
        }
        // 使用 preventScroll 避免视口强制滚动跳跃
        chatInputRef.current?.focus({ preventScroll: true });
    }, [isMobile]);

    // 1. 页面初次加载/刷新时自动锁定焦点
    useEffect(() => {
        focusChatInput();
    }, [focusChatInput]);

    // 2. AI 回复加载完成后（isLoading 由 true 转 false）重新锁定焦点（仅在未划词时）
    useEffect(() => {
        if (!isLoading) {
            const timer = setTimeout(() => {
                focusChatInput();
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [isLoading, focusChatInput]);

    const lastUserMsgId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender === 'user') return messages[i].id;
        }
        return null;
    }, [messages]);

    const scrollToLatestUserMsg = useCallback(() => {
        if (lastUserMsgElRef.current) {
            lastUserMsgElRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }, []);

    useEffect(() => {
        const t1 = setTimeout(scrollToLatestUserMsg, 60);
        const t2 = setTimeout(scrollToLatestUserMsg, 240);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [messages, isLoading, scrollToLatestUserMsg]);

    // 监听全局 Ctrl+V 粘贴截图
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            setSelectedImage(event.target?.result as string);
                        };
                        reader.readAsDataURL(blob);
                        e.preventDefault();
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleSend = () => {
        const text = inputText.trim();
        if (!text && !selectedImage) return;

        onSendMessage(text, selectedImage || undefined);
        setInputText('');
        setSelectedImage(null);
        if (isMobile) {
            chatInputRef.current?.blur();
        } else {
            setTimeout(focusChatInput, 20);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSelectedImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    /** 校对新卡：只写识别到的键，缺项保留计算器当前值（绝不补默认数） */
    const handleImportReviewPanel = (panel: RecognizedPanel) => {
        const dataService = DataService.getInstance();
        const classes = dataService.getClasses() || [];
        const clsRaw = panel.character?.classRaw;
        const classObj = clsRaw ? classes.find(c => c.ClassName === clsRaw || c.ClassID === clsRaw) : undefined;
        const f = panel.character?.factionRaw;
        const faction = f === '佛' ? 'FO' : f === '魔' ? 'MO' : f === '仙' ? 'XIAN' : undefined;
        if (classObj) updateCharacterClass(classObj.ClassID, faction || 'XIAN');

        const attrs = panel.engine.attrs as Record<string, number>;
        if (Object.keys(attrs).length > 0) {
            // 只覆盖识别到的键，其余保留计算器当前值
            updateCharacterAttributes({ ...userCharacter.BaseAttributes, ...attrs });
        }

        if (onOpenSplitWorkspace) {
            onOpenSplitWorkspace('calc');
        } else {
            navigate('/calculator');
        }
    };

    /** 轩辕策：把「系 / 普通·英雄 / 品阶 / 进阶技能」带进模拟器 */
    const handleOpenXyc = (seed: { beast?: string; isHero?: boolean; level?: number; advSkill?: any }) => {
        if (onOpenSplitWorkspace) {
            onOpenSplitWorkspace('xyc', {
                xycBeast: seed.beast,
                xycIsHero: seed.isHero,
                xycLevel: seed.level,
                xycAdvSkill: seed.advSkill
            });
        } else {
            navigate('/tools/xyc');
        }
    };

    /** 天缘分流（用户口径）：上玄佑万 → 新天缘词条池（带 seed）；其它 → 旧天缘图鉴（走 L1 意图） */
    const handleOpenTianyuan = (seed: { groupName?: string; level?: number; name?: string; isNew: boolean }) => {
        if (seed.isNew) {
            if (onOpenSplitWorkspace) {
                onOpenSplitWorkspace('newtianyuan', { tyGroupName: seed.groupName, tyLevel: seed.level });
            } else {
                navigate('/tools/newtianyuan');
            }
            return;
        }
        // 旧天缘没有模拟器，只有图鉴卡：用正常意图链路取卡
        onSendMessage(`旧天缘 ${seed.name || ''}`.trim());
    };

    const handleArchivePanel = (panel: RecognizedPanel) => {
        try {
            const key = 'zx_panel_archive_v1';
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            const label = [panel.character?.classRaw, panel.character?.factionRaw].filter(Boolean).join('·') || '面板';
            list.push({ at: new Date().toISOString(), name: `${label} ${new Date().toLocaleString()}`, panel });
            localStorage.setItem(key, JSON.stringify(list.slice(-50)));
        } catch {
            /* 配额满时静默，不打断对话 */
        }
    };

    return (
        <div
            className={clsx(
                'flex flex-col h-full bg-[#0b0e14]/95 overflow-hidden transition-all duration-300',
                isSplitOpen
                    ? 'w-full rounded-none border-none'
                    : 'w-full max-w-[1020px] mx-auto rounded-2xl border border-white/10 shadow-2xl my-1'
            )}
        >
            {/* 顶部控制栏：固定顶部不滚动 */}
            <div className="py-2.5 px-4 backdrop-blur-xl bg-[#0b0e14]/95 border-b border-white/10 flex items-center justify-between rounded-t-2xl shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={onBackToHome}
                        className={ACCENT_BUTTON}
                        title="返回天书主页"
                    >
                        <ArrowLeft className={ACCENT_BUTTON_ICON} />
                        <span>返回主页</span>
                    </button>
                </div>

                {/* {onToggleSplit && !isSplitOpen && (
                    <button
                        type="button"
                        onClick={onToggleSplit}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                        title="展开右侧战力推演与微工具工作区"
                    >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>右侧工作区</span>
                    </button>
                )} */}
            </div>

            {/* 消息对话主画卷：独立定高内部滚动区，不再让全局窗口拉伸 */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-5 space-y-6 min-h-0">
                {messages.map((msg) => {
                    const isUser = msg.sender === 'user';
                    const isLastUserMsg = msg.id === lastUserMsgId;

                    return (
                        <div
                            key={msg.id}
                            ref={isLastUserMsg ? (el) => { lastUserMsgElRef.current = el; } : undefined}
                            className={clsx(
                                'flex flex-col animate-in fade-in duration-200 scroll-mt-4',
                                isUser ? 'items-end' : 'items-start'
                            )}
                        >
                            {/* 发送者标签 */}
                            <div className="flex items-center gap-1.5 mb-1.5 px-1 text-[11px] font-medium text-slate-400">
                                <span>{isUser ? '你' : '天书万象 AI'}</span>
                                <span className="text-[10px] text-slate-600">· {msg.time}</span>
                            </div>

                            {/* 消息主体容器 */}
                            <div
                                className={clsx(
                                    'rounded-2xl text-sm leading-relaxed transition-all',
                                    isUser
                                        ? 'max-w-[85%] sm:max-w-[75%] px-4 py-2.5 bg-gradient-to-r from-[#17253d] to-[#121c2e] border border-cyan-500/40 text-cyan-50 shadow-md ml-auto rounded-tr-sm break-words'
                                        : 'w-full max-w-[96%] p-5 bg-[#0e131b] border border-white/10 text-slate-200 rounded-tl-sm shadow-lg'
                                )}
                            >
                                {/* 用户附件图片 */}
                                {msg.image && (
                                    <div className="mb-3 max-w-sm rounded-xl overflow-hidden border border-white/15 bg-black/40">
                                        <img src={msg.image} alt="User attachment" className="w-full object-cover max-h-72" />
                                    </div>
                                )}

                                {/* 纯文本说明 (AI 助手的消息正文，无论是否附带候选卡片，均完整呈现段落排版与自然语气) */}
                                {msg.text && (
                                    <div className={clsx(
                                        'whitespace-pre-wrap text-sm leading-relaxed font-sans',
                                        isUser ? 'text-slate-100 font-medium' : 'text-slate-200'
                                    )}>
                                        {isUser ? (
                                            <span>{msg.text}</span>
                                        ) : (
                                            <GameColorText text={msg.text} />
                                        )}
                                    </div>
                                )}

                                {/* 宽幅富交互大卡片体系 */}
                                {msg.cardType && (
                                    <div className={clsx('space-y-3', msg.text && 'mt-3.5 pt-3.5 border-t border-white/10')}>
                                        {/* 0. 识图校对卡（新协议）：只显示参与计算的字段，未识别项可手填 */}
                                        {msg.cardType === 'c_panel_review' && msg.cardData?.panel && (
                                            <VisionReviewCard
                                                panel={msg.cardData.panel as RecognizedPanel}
                                                onImport={handleImportReviewPanel}
                                                onArchive={handleArchivePanel}
                                                onOpenXyc={handleOpenXyc}
                                                onOpenTianyuan={handleOpenTianyuan}
                                            />
                                        )}

                                        {/* 2. BOSS 抗性大卡片 (1:1 游戏原生高保真全维度矩阵) */}
                                        {msg.cardType === 'boss' && msg.cardData && (
                                            <div className="w-full">
                                                <BossDetailCard
                                                    monster={msg.cardData.monster || {
                                                        MonsterID: msg.cardData.monsterId || '',
                                                        MonsterName: msg.cardData.name || '',
                                                        MonsterAttributeModifiers: {
                                                            MonsterDefense: msg.cardData.def ?? 0,
                                                            MonsterCriticalHitRateReduction: msg.cardData.critRed ?? 0,
                                                            MonsterCriticalDamagePercentReduction: msg.cardData.critDmgRed ?? 0,
                                                            MonsterHealth: msg.cardData.hp ?? 0,
                                                        },
                                                        displayAttributes: {
                                                            defense: msg.cardData.def ?? 0,
                                                            critRateReduction: msg.cardData.critRed ?? 0,
                                                            critDamageReduction: msg.cardData.critDmgRed ?? 0,
                                                            health: msg.cardData.hp ?? 0,
                                                        }
                                                    }}
                                                    dungeon={msg.cardData.dungeon || { DungeonID: msg.cardData.dungeonId, DungeonName: msg.cardData.dungeonName }}
                                                    categoryLabel={msg.cardData.categoryLabel}
                                                    onBringToCalculator={handleBringToCalculator}
                                                />
                                            </div>
                                        )}

                                        {/* 2.1 副本 BOSS 多候选切换卡片 */}
                                        {msg.cardType === 'boss_candidates' && msg.cardData?.candidates && (() => {
                                            const list: BossCandidateItem[] = msg.cardData.candidates;
                                            const activeIdx = selectedCandidateIndex[msg.id] ?? 0;
                                            const activeBoss = list[activeIdx] || list[0];

                                            return (
                                                <div className="w-full min-w-0 max-w-full overflow-hidden flex flex-col gap-3">
                                                    <CandidateSelectorBar
                                                        items={list.map((b, idx) => ({
                                                            id: b.id || `${b.dungeonId}_${b.monsterId}_${idx}`,
                                                            title: b.monsterName
                                                        }))}
                                                        activeIndex={activeIdx}
                                                        onSelect={(idx) => setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: idx }))}
                                                        summaryText={msg.cardData.dungeonName
                                                            ? `【${msg.cardData.dungeonName}】共 ${list.length} 位 BOSS（点选切换）：`
                                                            : msg.cardData.seriesName
                                                                ? `【${msg.cardData.seriesName}】系列共 ${list.length} 位 BOSS（点选切换）：`
                                                                : msg.cardData.categoryLabel
                                                                    ? `【${msg.cardData.categoryLabel}】核心副本 BOSS（点选切换）：`
                                                                    : `全网 16 大核心副本代表 BOSS（点选切换）：`}
                                                    />

                                                    {activeBoss && (
                                                        <BossDetailCard
                                                            monster={activeBoss.monster || {
                                                                MonsterID: activeBoss.monsterId,
                                                                MonsterName: activeBoss.monsterName,
                                                                MonsterAttributeModifiers: {
                                                                    MonsterDefense: activeBoss.def,
                                                                    MonsterCriticalHitRateReduction: activeBoss.critRed,
                                                                    MonsterCriticalDamagePercentReduction: activeBoss.critDmgRed,
                                                                    MonsterHealth: activeBoss.hp,
                                                                },
                                                                displayAttributes: {
                                                                    defense: activeBoss.def,
                                                                    critRateReduction: activeBoss.critRed,
                                                                    critDamageReduction: activeBoss.critDmgRed,
                                                                    health: activeBoss.hp,
                                                                }
                                                            }}
                                                            dungeon={activeBoss.dungeon || { DungeonID: activeBoss.dungeonId, DungeonName: activeBoss.dungeonName, difficulty: activeBoss.difficulty }}
                                                            categoryLabel={activeBoss.categoryLabel || activeBoss.dungeonShortLabel}
                                                            onBringToCalculator={handleBringToCalculator}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* 3. 技能机制大卡片 (1:1 游戏原生高保真卡片) */}
                                        {msg.cardType === 'skill' && msg.cardData && (
                                            <div className="w-full">
                                                {msg.cardData.skill ? (
                                                    <SkillDetailCard
                                                        skill={msg.cardData.skill}
                                                        onSelectSkillName={(name) => onSendMessage(name)}
                                                    />
                                                ) : (
                                                    <div className="rounded-xl bg-[#121824] border border-cyan-500/20 p-4 space-y-3">
                                                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                            <div className="text-sm font-bold text-cyan-300">{msg.cardData.name}</div>
                                                            <button
                                                                type="button"
                                                                onClick={() => navigate(msg.cardData.route)}
                                                                className="px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1"
                                                            >
                                                                <span>技能库详情</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                                                            <span>命中段数: <strong className="text-cyan-300">{msg.cardData.hits}</strong></span>
                                                            <span>冷却时间: <strong className="text-cyan-300">{msg.cardData.cooldown}s</strong></span>
                                                            <span>施法时间: <strong className="text-cyan-300">{msg.cardData.castTime}</strong>s</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 3.1 技能多候选切换 */}
                                        {msg.cardType === 'skill_candidates' && msg.cardData?.candidates && (() => {
                                            const list: CuratedSkillItem[] = msg.cardData.candidates;
                                            const activeIdx = selectedCandidateIndex[msg.id] ?? 0;
                                            const activeItem = list[activeIdx] || list[0];

                                            return (
                                                <div className="w-full min-w-0 max-w-full overflow-hidden flex flex-col gap-3">
                                                    <CandidateSelectorBar
                                                        items={list.map((c, idx) => ({
                                                            id: `${c.id || 0}_${c.name}_${idx}`,
                                                            title: c.name
                                                        }))}
                                                        activeIndex={activeIdx}
                                                        onSelect={(idx) => setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: idx }))}
                                                        summaryText={`候选技能 (${list.length})`}
                                                    />

                                                    {activeItem && (
                                                        <SkillDetailCard
                                                            key={activeItem.id || activeItem.name}
                                                            skill={activeItem}
                                                            onSelectSkillName={(name) => onSendMessage(name)}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* 4. 极致属性攻略信息卡（全领域细分 inline 呈现，窄屏自适应，不再跳转路由页） */}
                                        {msg.cardType === 'ceiling' && msg.cardData && (
                                            <CeilingDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6. 开服雷达卡片 - 战区展示 */}
                                        {msg.cardType === 'server' && msg.cardData?.subType === 'zhanqu' && (
                                            <div className="rounded-xl bg-[#121824] border border-emerald-500/30 p-3.5 flex flex-col gap-2.5">
                                                <div className="flex items-center justify-between gap-2.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                                            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                                        </div>
                                                        <div className="text-sm font-bold text-emerald-300 truncate">
                                                            {msg.cardData.title || msg.cardData.zhanQu}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (onOpenSplitWorkspace) {
                                                                onOpenSplitWorkspace('server', { zhanQu: msg.cardData.zhanQu });
                                                            } else if (msg.cardData.route) {
                                                                navigate(msg.cardData.route);
                                                            }
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors whitespace-nowrap"
                                                    >
                                                        <span>{msg.cardData.btnText || '在右侧打开此战区'}</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>

                                                {/* 战区下服务器快捷网格（去除多余说明文字，直接呈现芯片） */}
                                                {Array.isArray(msg.cardData.servers) && msg.cardData.servers.length > 0 && (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                                                        {msg.cardData.servers.map((sv: any) => (
                                                            <button
                                                                key={sv.serverId || sv.server}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (onOpenSplitWorkspace) {
                                                                        onOpenSplitWorkspace('server', {
                                                                            zhanQu: msg.cardData.zhanQu,
                                                                            serverName: sv.name,
                                                                            serverId: sv.serverId,
                                                                        });
                                                                    } else if (msg.cardData.route) {
                                                                        navigate(msg.cardData.route);
                                                                    }
                                                                }}
                                                                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/40 text-left cursor-pointer transition-all group"
                                                            >
                                                                <span className="text-xs text-slate-200 group-hover:text-emerald-300 font-medium truncate">
                                                                    {sv.name}
                                                                </span>
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse group-hover:animate-ping shrink-0 ml-1"
                                                                    title="开服正常"
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 6. 开服雷达卡片 - 单服展示（统一纯呼吸绿点，无多余加框，与战区芯片一致） */}
                                        {msg.cardType === 'server' && msg.cardData?.subType === 'single_server' && (
                                            <div className="rounded-xl bg-[#121824] border border-emerald-500/30 p-3.5 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
                                                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                                    </div>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-sm font-bold text-emerald-300 truncate">
                                                            {msg.cardData.title || `${msg.cardData.zhanQu} · ${msg.cardData.serverName}`}
                                                        </span>
                                                        <span
                                                            className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"
                                                            title="开服正常"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onOpenSplitWorkspace) {
                                                            onOpenSplitWorkspace('server', {
                                                                zhanQu: msg.cardData.zhanQu,
                                                                serverName: msg.cardData.serverName,
                                                                serverId: msg.cardData.serverId,
                                                            });
                                                        } else if (msg.cardData.route) {
                                                            navigate(msg.cardData.route);
                                                        }
                                                    }}
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors whitespace-nowrap"
                                                >
                                                    <span>{msg.cardData.btnText || '在右侧打开'}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* 6. 开服雷达卡片 - 宏观全区卡 */}
                                        {msg.cardType === 'server' && msg.cardData?.subType !== 'zhanqu' && msg.cardData?.subType !== 'single_server' && (
                                            <div className="rounded-xl bg-[#121824] border border-emerald-500/30 p-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-bold text-emerald-300">{msg.cardData.title}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{msg.cardData.desc}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onOpenSplitWorkspace) {
                                                            onOpenSplitWorkspace('server');
                                                        } else if (msg.cardData.route) {
                                                            navigate(msg.cardData.route);
                                                        }
                                                    }}
                                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                                                >
                                                    <span>{msg.cardData.btnText || '进入开服雷达'}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* 6.0 轩辕策文本意图：轻量入口卡（只打开模拟器，不再跳路由页） */}
                                        {msg.cardType === 'xyc_diag' && msg.cardData && (
                                            <div
                                                data-testid="xyc-entry-card"
                                                className="rounded-xl bg-[#121824] border border-cyan-500/20 p-3.5 flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm font-bold text-slate-100 truncate">
                                                        {msg.cardData.title || '轩辕策'}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                        {msg.cardData.desc || '按系别 / 普通·英雄 / 品阶查词条池'}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onOpenSplitWorkspace) onOpenSplitWorkspace('xyc');
                                                        else navigate('/tools/xyc');
                                                    }}
                                                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium shrink-0 transition-all"
                                                >
                                                    打开轩辕策模拟
                                                </button>
                                            </div>
                                        )}

                                        {/* 6.1 核心功能与微工具导航卡片 */}
                                        {msg.cardType === 'tool_card' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/30 p-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-bold text-cyan-300">{msg.cardData.title}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{msg.cardData.desc}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (msg.cardData.workspaceMode && onOpenSplitWorkspace) {
                                                            onOpenSplitWorkspace(msg.cardData.workspaceMode);
                                                        } else if (msg.cardData.route) {
                                                            navigate(msg.cardData.route);
                                                        }
                                                    }}
                                                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                                                >
                                                    <span>{msg.cardData.btnText || '立即前往'}</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* 6.5 裸职业名歧义分流卡（T-15a）：点击入口=无状态重发查询词。
                                                        色调规矩：所有歧义分流 hub（class_hub/slot_hub）统一用全站唯一
                                                        强调色 cyan，区分靠标题文案不靠颜色（2026-10-16 立） */}
                                        {msg.cardType === 'class_hub' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/30 p-4 space-y-3">
                                                <div className="text-sm font-bold text-cyan-300">
                                                    职业【{msg.cardData.className}】· 请选择查询方向
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(msg.cardData.options || []).map((opt: { key: string; label: string; query: string }) => (
                                                        <button
                                                            key={opt.key}
                                                            type="button"
                                                            onClick={() => {
                                                                trackCardClick(String(msg.cardType || ''), opt.key, cardSubject(msg.cardData));
                                                                onSendMessage(opt.query);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 border border-cyan-500/40 text-cyan-200 text-xs font-medium cursor-pointer transition-colors"
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 6.5b 四象裸词歧义分流卡（xyc_hub）：青龙/白虎/朱雀/玄武 = 轩辕策某系 or 副本BOSS */}
                                        {msg.cardType === 'xyc_hub' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/30 p-4 space-y-3">
                                                <div className="text-sm font-bold text-cyan-300">
                                                    【{msg.cardData.title}】· 请选择查询方向
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(msg.cardData.options || []).map((opt: { key: string; label: string; query: string }) => (
                                                        <button
                                                            key={opt.key}
                                                            type="button"
                                                            onClick={() => {
                                                                trackCardClick(String(msg.cardType || ''), opt.key, cardSubject(msg.cardData));
                                                                onSendMessage(opt.query);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 border border-cyan-500/40 text-cyan-200 text-xs font-medium cursor-pointer transition-colors"
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 6.6 裸部位名歧义分流卡（T-16 方案A）：点击入口=无状态重发品质 部位」查询词 */}
                                        {msg.cardType === 'slot_hub' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/30 p-4 space-y-3">
                                                <div className="text-sm font-bold text-cyan-300">
                                                    {msg.cardData.slot === '项链' || msg.cardData.slot === '戒指' || msg.cardData.slot === '锦囊' || msg.cardData.slot === '罡气' || msg.cardData.slot === '法身' || msg.cardData.slot === '玺绶'
                                                        ? `装备部位【${msg.cardData.slot}】· 请选择系列`
                                                        : `装备部位【${msg.cardData.slot}】· 请选择品质系列`}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(msg.cardData.options || []).map((opt: { key: string; label: string; query: string }) => (
                                                        <button
                                                            key={opt.key}
                                                            type="button"
                                                            // 所有按钮 query 均为自然词（含 exclude 型其他X」补集），无需 displayText
                                                            onClick={() => {
                                                                trackCardClick(String(msg.cardType || ''), opt.key, cardSubject(msg.cardData));
                                                                onSendMessage(opt.query);
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 border border-cyan-500/40 text-cyan-200 text-xs font-medium cursor-pointer transition-colors"
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 6.6b 装备/技能/经验/升级/属性测算/玩法攻略/全景导航/模拟器/天缘分流卡（T-18） */}
                                        {(msg.cardType === 'exp_hub' || msg.cardType === 'measure_hub' || msg.cardType === 'guide_hub' || msg.cardType === 'top_hub' || msg.cardType === 'equip_hub' || msg.cardType === 'skill_hub' || msg.cardType === 'tianyuan_hub' || msg.cardType === 'sim_hub') && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/30 p-4 space-y-3">
                                                <div className="text-sm font-bold text-cyan-300">
                                                    {msg.cardData.title || '分类导航'} · 点选直达对应功能
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {(msg.cardData.options || []).map((opt: { key: string; label: string; query: string; workspaceMode?: string }) => (
                                                        <button
                                                            key={opt.key}
                                                            type="button"
                                                        onClick={() => {
                                                            // 选项可直接指定右分屏模式（如「伤害计算」→ calc），
                                                            // 否则只发查询词、由意图匹配决定卡片
                                                            trackCardClick(String(msg.cardType || ''), opt.key, cardSubject(msg.cardData));
                                                            if (opt.workspaceMode && onOpenSplitWorkspace) {
                                                                onOpenSplitWorkspace(opt.workspaceMode as WorkspaceMode);
                                                            } else {
                                                                onSendMessage(opt.query);
                                                            }
                                                        }}
                                                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/45 border border-cyan-500/40 text-cyan-200 text-xs font-medium cursor-pointer transition-colors"
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 6.7 职业状态摘要卡（T-15b）：标题去掉辅助/输出徽章，支持多阵营 Tab 切换、易伤规范化及全 11 项战斗增减益指标 */}
                                        {msg.cardType === 'class_status' && msg.cardData && (
                                            <ClassStatusCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8 圣粹佩章信息卡：五大分类切换、炼器升降级、寻宝网高保真 Tooltip 及隐藏属性池 */}
                                        {msg.cardType === 'peizhang' && (
                                            <PeizhangDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8b 佩章·九纹琅信息卡：1~40级属性与三套升级配方材料对照 */}
                                        {msg.cardType === 'jiuwenlang' && (
                                            <JiuwenlangDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8c 旧天缘属性信息卡：4大部位词条池与满级(10级)自动推算 */}
                                        {msg.cardType === 'tianyuan_old' && (
                                            <OldTianyuanDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8c2 新天缘属性信息卡：须弥刃/甲/冠3大部位词条池与天命增益推算 */}
                                        {msg.cardType === 'tianyuan_new' && (
                                            <NewTianyuanDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8c3 新天缘模拟卡：开箱生成 + 精炼天命（对话内嵌，不跳 tools） */}
                                        {msg.cardType === 'tianyuan_sim' && (
                                            <NewTianyuanSimCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8c3 轩辕策属性信息卡：四系×普通/英雄、Lv.1–20 词条区间、青龙/白虎 III 代进阶技能 */}
                                        {msg.cardType === 'xyc_tome' && (
                                            <XycTomeDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8c4 轩辕策洗练模拟卡：1:1 物品窗 + 大衍奇术/一元道契/太乙宝函 */}
                                        {msg.cardType === 'xyc_wash' && (
                                            <XycWashCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8d 星宿属性及升星增益卡：启明/荧惑/重华3大星辰与1~5星测算 */}
                                        {msg.cardType === 'xingsu' && (
                                            <XingsuDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8e 宝石属性及升级全景卡：12种宝石普通/完美1~10级与多孔测算 */}
                                        {msg.cardType === 'baoshi' && (
                                            <BaoshiDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8e2 四灵本元卡（装备大类·伏龙鼎镶嵌）：四灵×五阶词条概率池与折算数值 */}
                                        {msg.cardType === 'silin_benyuan' && (
                                            <SilinBenyuanCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.8f 贺岁时装技能图鉴卡：12生肖特技、参数规格与代际联动推演 */}
                                        {msg.cardType === 'fashion_skill' && (
                                            <FashionSkillDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.9 宸极·凝灵契信息卡（T-18 攻略体系）：12孔属性池全量呈现、稀有上限规则与灵契秘效 */}
                                        {msg.cardType === 'ninglingqi' && (
                                            <NinglingqiDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.10 宠物结誓与誓印信息卡（T-18 攻略体系）：原版预览、5类上限对比及誓印指南 */}
                                        {msg.cardType === 'pet_pledge' && (
                                            <PetPledgeDetailCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.11 阵灵聚灵升级消耗卡（T-18 攻略体系）：1~12阶金紫消耗与6金2紫顶配测算 */}
                                        {msg.cardType === 'zhenling_upgrade' && (
                                            <ZhenlingUpgradeCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.12 法宝经验等级对照卡（T-18 攻略体系）：1~40级经验与魔血对照及速算 */}
                                        {msg.cardType === 'fabao_upgrade' && (
                                            <FabaoUpgradeCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.13 神机属性洗练模拟器：品质/部位/蕴灵选择 + 左右锻造对比 */}
                                        {msg.cardType === 'shenji_forge' && (
                                            <ShenjiForgeCard cardData={msg.cardData} />
                                        )}

                                        {/* 6.14 装备蕴灵轻量卡：装备本体 + 蕴灵按钮 + 右侧逐级手数/月德符 */}
                                        {msg.cardType === 'yunling_forge' && (
                                            <YunlingForgeCard cardData={msg.cardData} />
                                        )}

                                        {/* 7. 法宝图鉴单卡 */}
                                        {msg.cardType === 'fabao' && msg.cardData && (
                                            <div className="w-full">
                                                <FabaoDetailCard
                                                    fabao={msg.cardData.fabao || {
                                                        id: msg.cardData.id || 0,
                                                        名称: msg.cardData.name || '法宝',
                                                        等级: 135,
                                                        类型: msg.cardData.grade || '战斗法宝',
                                                        skillName: msg.cardData.skillName,
                                                        描述_纯文本: msg.cardData.description,
                                                        技能特效: {
                                                            普通: {
                                                                name: msg.cardData.skillName || '法宝特技',
                                                                str1: msg.cardData.skillEffect,
                                                                str2: msg.cardData.cooldown ? `技能冷却时间：${msg.cardData.cooldown}` : undefined
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* 7.1 法宝多候选切换 */}
                                        {msg.cardType === 'fabao_candidates' && msg.cardData?.candidates && (() => {
                                            const list: FabaoItem[] = msg.cardData.candidates;
                                            const activeIdx = selectedCandidateIndex[msg.id] ?? 0;
                                            const activeItem = list[activeIdx] || list[0];

                                            return (
                                                <div className="w-full min-w-0 max-w-full overflow-hidden flex flex-col gap-3">
                                                    <CandidateSelectorBar
                                                        items={list.map((c, idx) => ({
                                                            id: c.id || idx,
                                                            title: c.名称
                                                        }))}
                                                        activeIndex={activeIdx}
                                                        onSelect={(idx) => setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: idx }))}
                                                        summaryText={`候选法宝 (${list.length})`}
                                                    />

                                                    {activeItem && (
                                                        <FabaoDetailCard fabao={activeItem} />
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* 8. 装备单卡 (1:1 高保真卡片，支持强化 / 升降阶) */}
                                        {msg.cardType === 'equip' && msg.cardData && (
                                            <div className="w-full">
                                                <EquipDetailCard
                                                    item={msg.cardData.equip || msg.cardData}
                                                    initialRefLevel={msg.cardData.initialRefLevel}
                                                    allEquips={msg.cardData.allEquips}
                                                />
                                            </div>
                                        )}

                                        {/* 8.1 装备多候选切换 */}
                                        {msg.cardType === 'equip_candidates' && msg.cardData?.candidates && (() => {
                                            const list: CuratedEquipItem[] = msg.cardData.candidates;
                                            const allEquips: CuratedEquipItem[] = msg.cardData.allEquips || list;

                                            // 按剔除（男）/（女）括号后的纯净名称去重，避免男女版生成两个重复按钮
                                            const uniqueCandidates: { item: CuratedEquipItem; rawIdx: number }[] = [];
                                            const seenNames = new Set<string>();
                                            list.forEach((c, idx) => {
                                                const clean = (c.name || '').replace(/[（(][男女][）)]/g, '').trim();
                                                if (!seenNames.has(clean)) {
                                                    seenNames.add(clean);
                                                    uniqueCandidates.push({ item: c, rawIdx: idx });
                                                }
                                            });

                                            const activeIdx = selectedCandidateIndex[msg.id] ?? 0;
                                            const activeItem = list[activeIdx] || list[0];

                                            return (
                                                <div className="w-full min-w-0 max-w-full overflow-hidden flex flex-col gap-3">
                                                    <CandidateSelectorBar
                                                        items={uniqueCandidates.map((u, uIdx) => ({
                                                            id: `${u.item.id || 0}_${u.item.name}_${uIdx}`,
                                                            title: (u.item.name || '').replace(/[（(][男女][）)]/g, '').trim()
                                                        }))}
                                                        activeIndex={uniqueCandidates.findIndex(u => u.rawIdx === activeIdx) >= 0 ? uniqueCandidates.findIndex(u => u.rawIdx === activeIdx) : 0}
                                                        onSelect={(uIdx) => {
                                                            const targetRawIdx = uniqueCandidates[uIdx]?.rawIdx ?? 0;
                                                            setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: targetRawIdx }));
                                                        }}
                                                        summaryText={`候选装备 (${uniqueCandidates.length})`}
                                                    />

                                                    {activeItem && (
                                                        <EquipDetailCard
                                                            key={`${activeItem.id || activeItem.name}_${activeIdx}`}
                                                            item={activeItem}
                                                            initialRefLevel={msg.cardData.initialRefLevel}
                                                            allEquips={allEquips}
                                                        />
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-cyan-300 p-3 rounded-xl bg-white/5 border border-white/5 w-fit">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>推演运算中，正在提取数据并调用确定性战斗引擎...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* 底部固定对话输入舱：高对比度、科技光晕边缘与醒目交互，强化视觉焦点 */}
            <div className="relative z-30 p-3 md:p-4 backdrop-blur-xl bg-[#090d15]/98 border-t border-cyan-500/30 rounded-b-2xl shrink-0 shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
                {/* 选中的图片缩略预览 */}
                {selectedImage && (
                    <div className="mb-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between max-w-sm">
                        <div className="flex items-center gap-2">
                            <img src={selectedImage} alt="Attachment" className="w-8 h-8 rounded object-cover border border-cyan-400/30" />
                            <span className="text-xs text-cyan-200">已附加截图（识图功能受限使用）</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setSelectedImage(null)}
                            className="p-1 rounded text-slate-400 hover:text-white"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <div className="relative flex items-center bg-[#0c111c] border-2 border-cyan-500/40 hover:border-cyan-400/70 focus-within:border-cyan-400 focus-within:shadow-[0_0_24px_rgba(6,182,212,0.3)] rounded-xl p-1.5 transition-all">
                    <ChatPlusMenu
                        isOpen={isPlusMenuOpen}
                        onClose={() => setIsPlusMenuOpen(false)}
                        onSelectUpload={() => fileInputRef.current?.click()}
                        onSelectWorkspace={(mode) => onOpenSplitWorkspace && onOpenSplitWorkspace(mode)}
                        onSendMessage={(q) => onSendMessage(q)}
                        placement="up"
                    />

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={() => setIsPlusMenuOpen(prev => !prev)}
                        title={isPlusMenuOpen ? '收起工作台菜单' : '战术工作台与微工具 (+)'}
                        className={clsx(
                            'p-1.5 bg-transparent border-0 outline-none transition-colors shrink-0 cursor-pointer rounded-lg hover:bg-white/5',
                            isPlusMenuOpen
                                ? 'text-cyan-300'
                                : 'text-slate-400 hover:text-cyan-300'
                        )}
                    >
                        {isPlusMenuOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>

                    <input
                        ref={chatInputRef}
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onFocus={() => {
                            // L2 预取（装备库/法宝库）：聚焦输入框即后台拉，回车前就绪。
                            // 首页不再预取这两个大文件，避免首屏下载 6MB+。
                            DataService.getInstance().preloadCopilotDataWarm();
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSend();
                        }}
                        placeholder={isMobile ? '问点什么？试试四灵本元…' : '问点什么，比如四灵本元，神机洗练，昭武衣服，苍龙啸，新天缘等...'}
                        className="flex-1 min-w-0 px-1 py-2 bg-transparent text-slate-100 placeholder-slate-400 text-[16px] md:text-sm focus:outline-none"
                    />

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={isLoading}
                        className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/30 cursor-pointer shrink-0 active:scale-95 disabled:opacity-50 ml-2"
                        title="发送至天书大模型 (Enter)"
                    >
                        <Send className="w-4 h-4 text-slate-950" />
                    </button>
                </div>

                <p className="text-[11px] text-slate-500 tracking-wide text-center pt-2 select-none">
                    天书万象 AI 诛仙全知大模型 · 规则与数据源于实测
                </p>
            </div>
        </div>
    );
};
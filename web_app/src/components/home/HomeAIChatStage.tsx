import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    ArrowLeft,
    Plus,
    Send,
    Image as ImageIcon,
    X,
    ExternalLink,
    RefreshCw,
    Sliders,
    Check,
    Copy,
    ArrowRight,
    Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    CopilotService,
    type CopilotMessage,
    type ExtractedCPanel
} from '../../services/CopilotService';
import { FabaoDetailCard } from '../compendium/FabaoDetailCard';
import { EquipDetailCard } from '../compendium/EquipDetailCard';
import { SkillDetailCard } from '../compendium/SkillDetailCard';
import { CandidateSelectorBar } from './CandidateSelectorBar';
import { GameColorText } from '../ui/GameColorText';
import { useApp } from '../../context/AppContext';
import type { FabaoItem, CuratedEquipItem, CuratedSkillItem } from '../../types';

interface HomeAIChatStageProps {
    messages: CopilotMessage[];
    isLoading: boolean;
    onSendMessage: (text: string, image?: string) => void;
    onBackToHome: () => void;
    onNewChat: () => void;
}

export const HomeAIChatStage: React.FC<HomeAIChatStageProps> = ({
    messages,
    isLoading,
    onSendMessage,
    onBackToHome,
    onNewChat
}) => {
    const navigate = useNavigate();
    const { updateCharacterAttributes, updateCharacterClass } = useApp();

    const [inputText, setInputText] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // 候选列表选中的索引状态（按消息 ID 索引）
    const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<Record<string, number>>({});

    // 活跃的微调面板状态（按消息 ID 索引）
    const [expandedTunerMsgId, setExpandedTunerMsgId] = useState<string | null>(null);
    const [tuningCPanels, setTuningCPanels] = useState<Record<string, ExtractedCPanel>>({});
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const lastUserMsgElRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const getTunedPanel = (msgId: string, initialPanel: ExtractedCPanel): ExtractedCPanel => {
        return tuningCPanels[msgId] || initialPanel;
    };

    const updateTunedField = (msgId: string, base: ExtractedCPanel, field: keyof ExtractedCPanel, val: number) => {
        const current = getTunedPanel(msgId, base);
        setTuningCPanels(prev => ({
            ...prev,
            [msgId]: {
                ...current,
                [field]: isNaN(val) ? 0 : val
            }
        }));
    };

    const stepTunedField = (msgId: string, base: ExtractedCPanel, field: keyof ExtractedCPanel, delta: number) => {
        const current = getTunedPanel(msgId, base);
        const nextVal = Math.max(0, Number(((Number(current[field] || 0)) + delta).toFixed(2)));
        setTuningCPanels(prev => ({
            ...prev,
            [msgId]: {
                ...current,
                [field]: nextVal
            }
        }));
    };

    const handleImportToSimulator = (panel: ExtractedCPanel) => {
        if (panel.characterClass) {
            updateCharacterClass(panel.characterClass, panel.faction || 'XIAN');
        }
        updateCharacterAttributes({
            CharacterMaxAttack: panel.attack || 180000,
            CharacterMinAttack: (panel.attack || 180000) * 0.9,
            CharacterDefense: panel.defense || 90000,
            CharacterHealth: panel.hp || 3000000,
            CharacterMana: panel.mp || 1000000,
            CharacterCriticalHitRatePercent: panel.critRate || 140,
            CharacterCriticalHitDamagePercent: panel.critDamage || 850,
            CharacterMonsterDamageIncreasePercent: panel.monsterDamageBonus || 70,
        });
        navigate('/');
    };

    const handleCopyJson = (msgId: string, panel: ExtractedCPanel) => {
        navigator.clipboard.writeText(JSON.stringify(panel, null, 2));
        setCopiedId(msgId);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="w-full max-w-[1060px] mx-auto h-[calc(100vh-5rem)] min-h-[580px] max-h-[920px] flex flex-col rounded-2xl border border-white/10 bg-[#0b0e14]/90 shadow-2xl overflow-hidden my-1 animate-in fade-in duration-300">
            {/* 顶部控制栏：固定顶部不滚动 */}
            <div className="py-2.5 px-4 backdrop-blur-xl bg-[#0b0e14]/95 border-b border-white/10 flex items-center justify-between rounded-t-2xl shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBackToHome}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>返回主页</span>
                    </button>
                    <button
                        type="button"
                        onClick={onNewChat}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>新对话</span>
                    </button>
                </div>
            </div>

            {/* 消息对话主画卷：独立定高内部滚动区，不再让全局窗口拉伸 */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-6 min-h-0">
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
                                <span>{isUser ? '你' : 'AI 战术智囊'}</span>
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

                                {/* 纯文本说明 */}
                                <div className="whitespace-pre-wrap text-slate-200 text-sm leading-relaxed">
                                    <GameColorText text={msg.text} />
                                </div>

                                {/* 宽幅富交互大卡片体系 */}
                                {msg.cardType && (
                                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                                        {/* 1. C 界面识图测伤与实战伤害报告 */}
                                        {msg.cardType === 'c_panel_diag' && msg.cardData && (() => {
                                            const basePanel: ExtractedCPanel = msg.cardData.cPanel;
                                            const activePanel = getTunedPanel(msg.id, basePanel);
                                            const liveDamage = CopilotService.getInstance().calculateT20Damage(activePanel);
                                            const isTunerOpen = expandedTunerMsgId === msg.id;

                                            return (
                                                <div className="rounded-xl bg-gradient-to-br from-[#121927] to-[#0d121c] border border-cyan-500/30 p-5 space-y-4 shadow-xl">
                                                    {/* 报告标头与秒伤 KPI */}
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-100">
                                                                    {activePanel.characterClass || '角色'} 属性推演报告
                                                                </span>
                                                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                                                    {activePanel.faction === 'FO' ? '佛' : activePanel.faction === 'MO' ? '魔' : '仙'}阵营
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                测算首领: {liveDamage.dungeonName} · {liveDamage.bossName}
                                                            </p>
                                                        </div>

                                                        {/* 秒伤大字 KPI */}
                                                        <div className="sm:text-right">
                                                            <div className="text-[11px] text-amber-300 font-medium">T20 实战爆发秒伤推演</div>
                                                            <div className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-300 to-amber-100 tracking-tight">
                                                                {liveDamage.estimatedTotalDamage}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 核心面板攻防 8 项数值矩阵 */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-slate-400">大攻攻击力</div>
                                                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                                                                {(activePanel.attack || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-slate-400">防御力</div>
                                                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                                                                {(activePanel.defense || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-amber-300 font-medium">无视伤害减免</div>
                                                            <div className="text-sm font-bold text-amber-300 mt-0.5">
                                                                {activePanel.ignoreReduction || 0}%
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-emerald-300 font-medium">减免伤害</div>
                                                            <div className="text-sm font-bold text-emerald-300 mt-0.5">
                                                                {activePanel.damageReduction || 0}%
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-rose-300 font-medium">对怪物增伤</div>
                                                            <div className="text-sm font-bold text-rose-300 mt-0.5">
                                                                {activePanel.monsterDamageBonus || 0}%
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-slate-400">暴击率 / 暴伤</div>
                                                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                                                                {activePanel.critRate || 0}% / {activePanel.critDamage || 0}%
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-slate-400">减暴击率</div>
                                                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                                                                {activePanel.critReduction || 0}%
                                                            </div>
                                                        </div>
                                                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                                                            <div className="text-[11px] text-slate-400">气血总量 (HP)</div>
                                                            <div className="text-sm font-semibold text-slate-200 mt-0.5">
                                                                {(activePanel.hp || 0).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* 内嵌横向数值微调面板 (无需弹窗，在画布内直接改) */}
                                                    <div className="pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedTunerMsgId(isTunerOpen ? null : msg.id)}
                                                            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 transition-colors"
                                                        >
                                                            <Sliders className="w-3.5 h-3.5" />
                                                            <span>{isTunerOpen ? '收起属性微调工作台' : '展开数值微调工作台（可单点校对 OCR 数值并即时重测）'}</span>
                                                        </button>

                                                        {isTunerOpen && (
                                                            <div className="mt-3 p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                                                <div className="text-xs font-medium text-slate-300">
                                                                    微调数值实时联动刷新上方 T20 伤害推演：
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                                                    <InlineNumberRow
                                                                        label="大攻攻击力"
                                                                        value={activePanel.attack || 0}
                                                                        unit="点"
                                                                        step={5000}
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'attack', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'attack', d)}
                                                                    />
                                                                    <InlineNumberRow
                                                                        label="防御力"
                                                                        value={activePanel.defense || 0}
                                                                        unit="点"
                                                                        step={2000}
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'defense', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'defense', d)}
                                                                    />
                                                                    <InlineNumberRow
                                                                        label="无视伤害减免"
                                                                        value={activePanel.ignoreReduction || 0}
                                                                        unit="%"
                                                                        step={0.5}
                                                                        highlight="text-amber-300 font-semibold"
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'ignoreReduction', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'ignoreReduction', d)}
                                                                    />
                                                                    <InlineNumberRow
                                                                        label="减免伤害"
                                                                        value={activePanel.damageReduction || 0}
                                                                        unit="%"
                                                                        step={0.5}
                                                                        highlight="text-emerald-300 font-semibold"
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'damageReduction', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'damageReduction', d)}
                                                                    />
                                                                    <InlineNumberRow
                                                                        label="对怪伤害增加"
                                                                        value={activePanel.monsterDamageBonus || 0}
                                                                        unit="%"
                                                                        step={1.0}
                                                                        highlight="text-rose-300 font-semibold"
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'monsterDamageBonus', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'monsterDamageBonus', d)}
                                                                    />
                                                                    <InlineNumberRow
                                                                        label="暴击伤害"
                                                                        value={activePanel.critDamage || 0}
                                                                        unit="%"
                                                                        step={5.0}
                                                                        onChange={v => updateTunedField(msg.id, basePanel, 'critDamage', v)}
                                                                        onStep={d => stepTunedField(msg.id, basePanel, 'critDamage', d)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 操作底栏 */}
                                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyJson(msg.id, activePanel)}
                                                            className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                                                        >
                                                            {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                            <span>{copiedId === msg.id ? '已复制' : '复制属性 JSON'}</span>
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleImportToSimulator(activePanel)}
                                                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all"
                                                        >
                                                            <span>一键带入主战斗模拟室</span>
                                                            <ArrowRight className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 2. BOSS 首领抗性大卡片 */}
                                        {msg.cardType === 'boss' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-cyan-500/20 p-4 space-y-3">
                                                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                                    <div>
                                                        <div className="text-sm font-bold text-cyan-300">{msg.cardData.name}</div>
                                                        <div className="text-xs text-slate-400">副本: {msg.cardData.dungeonName}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(msg.cardData.route)}
                                                        className="px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-medium flex items-center gap-1"
                                                    >
                                                        <span>全景资料馆</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                                        <span className="text-slate-400 block text-[11px]">防御力</span>
                                                        <span className="font-semibold text-slate-200">{msg.cardData.def}</span>
                                                    </div>
                                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                                        <span className="text-slate-400 block text-[11px]">气血总量</span>
                                                        <span className="font-semibold text-rose-300">{msg.cardData.hp}</span>
                                                    </div>
                                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                                        <span className="text-slate-400 block text-[11px]">减暴击率</span>
                                                        <span className="font-semibold text-amber-300">{msg.cardData.critRed}%</span>
                                                    </div>
                                                    <div className="p-2 rounded bg-black/40 border border-white/5">
                                                        <span className="text-slate-400 block text-[11px]">减暴击伤害</span>
                                                        <span className="font-semibold text-amber-300">{msg.cardData.critDmgRed}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. 技能机制大卡片 (1:1 游戏原生高保真卡片) */}
                                        {msg.cardType === 'skill' && msg.cardData && (
                                            <div className="w-full">
                                                {msg.cardData.skill ? (
                                                    <SkillDetailCard skill={msg.cardData.skill} />
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
                                                            title: c.name,
                                                            badge: c.group_name || `${c.el_max || 1}阶`
                                                        }))}
                                                        activeIndex={activeIdx}
                                                        onSelect={(idx) => setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: idx }))}
                                                        summaryText={`为你检索到 ${list.length} 个符合条件的技能：`}
                                                    />

                                                    {activeItem && (
                                                        <SkillDetailCard key={activeItem.id || activeItem.name} skill={activeItem} />
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* 4. 极致属性攻略卡片 */}
                                        {msg.cardType === 'ceiling' && msg.cardData && (
                                            <div className="rounded-xl bg-[#151a24] border border-amber-500/30 p-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-bold text-amber-300">{msg.cardData.title}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">理论最高基准: {msg.cardData.ceilingVal}%</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(msg.cardData.route)}
                                                    className="px-3.5 py-1.5 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-xs font-medium flex items-center gap-1.5"
                                                >
                                                    <span>查看极致攻略拆解</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* 5. 轩辕策四象卡片 */}
                                        {msg.cardType === 'xyc_diag' && msg.cardData && (
                                            <div className="rounded-xl bg-[#151a24] border border-teal-500/30 p-4 flex items-center justify-between gap-4">
                                                <div>
                                                    <div className="text-sm font-bold text-teal-300">{msg.cardData.title}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">{msg.cardData.desc}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(msg.cardData.route)}
                                                    className="px-3.5 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 text-teal-200 text-xs font-medium flex items-center gap-1.5"
                                                >
                                                    <span>进入四象模拟器</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}

                                        {/* 6. 开服雷达卡片 */}
                                        {msg.cardType === 'server' && msg.cardData && (
                                            <div className="rounded-xl bg-[#121824] border border-emerald-500/30 p-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-2.5">
                                                    <Radio className="w-4 h-4 text-emerald-400" />
                                                    <div>
                                                        <div className="text-sm font-bold text-emerald-300">{msg.cardData.title}</div>
                                                        <div className="text-xs text-slate-400 mt-0.5">{msg.cardData.desc}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(msg.cardData.route)}
                                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center gap-1.5"
                                                >
                                                    <span>查看开服雷达</span>
                                                    <ExternalLink className="w-3 h-3" />
                                                </button>
                                            </div>
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
                                                <div className="w-full flex flex-col gap-3">
                                                    <CandidateSelectorBar
                                                        items={list.map((c, idx) => ({
                                                            id: c.id || idx,
                                                            title: c.名称,
                                                            badge: `${c.等级 || 135}级`
                                                        }))}
                                                        activeIndex={activeIdx}
                                                        onSelect={(idx) => setSelectedCandidateIndex(prev => ({ ...prev, [msg.id]: idx }))}
                                                        summaryText={`为你检索到 ${list.length} 件符合条件的候选法宝：`}
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
                                                        summaryText={`为你检索到 ${uniqueCandidates.length} 件候选装备：`}
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
            <div className="p-3 md:p-4 backdrop-blur-xl bg-[#090d15]/98 border-t border-cyan-500/30 rounded-b-2xl shrink-0 shadow-[0_-8px_24px_rgba(0,0,0,0.6)]">
                {/* 选中的图片缩略预览 */}
                {selectedImage && (
                    <div className="mb-2 px-3 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between max-w-sm">
                        <div className="flex items-center gap-2">
                            <img src={selectedImage} alt="Attachment" className="w-8 h-8 rounded object-cover border border-cyan-400/30" />
                            <span className="text-xs text-cyan-200">已附加截图（将激活视觉通道）</span>
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

                <div className="flex items-center gap-2 bg-[#0c111c] border-2 border-cyan-500/40 hover:border-cyan-400/70 focus-within:border-cyan-400 focus-within:shadow-[0_0_24px_rgba(6,182,212,0.3)] rounded-xl p-1.5 transition-all">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="上传截图 / 支持直接 Ctrl+V 粘贴"
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors"
                    >
                        <ImageIcon className="w-4 h-4" />
                    </button>

                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleSend();
                        }}
                        placeholder="向 AI 提问、粘贴截图，或输入如「大乘战罡」「逍遥锦囊」「太虚」「惊涛」..."
                        className="flex-1 px-3 py-2 bg-transparent text-slate-100 placeholder-slate-400 text-sm focus:outline-none"
                    />

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={isLoading || (!inputText.trim() && !selectedImage)}
                        className="px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 text-slate-950 font-bold transition-all shadow-md shadow-cyan-500/30 flex items-center gap-1.5"
                    >
                        <Send className="w-4 h-4 text-slate-950" />
                        <span className="text-xs hidden sm:inline">发送</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

interface InlineNumberRowProps {
    label: string;
    value: number;
    unit: string;
    step: number;
    highlight?: string;
    onChange: (val: number) => void;
    onStep: (delta: number) => void;
}

const InlineNumberRow: React.FC<InlineNumberRowProps> = ({
    label,
    value,
    unit,
    step,
    highlight,
    onChange,
    onStep
}) => {
    return (
        <div className="flex items-center justify-between gap-1.5 p-2 rounded-lg bg-black/30 border border-white/5">
            <span className={clsx('text-[11px]', highlight || 'text-slate-300')}>{label}</span>
            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onStep(-step)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px]"
                >
                    -
                </button>
                <div className="relative">
                    <input
                        type="number"
                        value={value}
                        onChange={e => onChange(parseFloat(e.target.value))}
                        className="w-20 px-1.5 py-0.5 text-xs text-right bg-black/60 border border-white/10 rounded text-cyan-200 focus:outline-none focus:border-cyan-400 pr-4"
                    />
                    <span className="absolute right-1 top-0.5 text-[9px] text-slate-500 pointer-events-none">
                        {unit}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => onStep(step)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-white/5 hover:bg-white/10 text-slate-300 text-[10px]"
                >
                    +
                </button>
            </div>
        </div>
    );
};

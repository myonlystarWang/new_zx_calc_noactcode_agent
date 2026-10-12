import React, { useState, useRef, useEffect } from 'react';
import {
    Bot,
    Sparkles,
    Send,
    Image as ImageIcon,
    X,
    Sliders,
    Settings,
    ExternalLink,
    RefreshCw,
    Radio,
    KeyRound,
    Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { CopilotService } from '../../services/CopilotService';
import type {
    CopilotMessage,
    ExtractedCPanel,
    UserCustomApiKeys
} from '../../services/CopilotService';
import { QuickEditDrawer } from './QuickEditDrawer';

export const GameAICopilotModal: React.FC = () => {
    const navigate = useNavigate();
    const copilot = CopilotService.getInstance();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<CopilotMessage[]>([
        {
            id: 'init-msg',
            sender: 'assistant',
            text: '你好！我是诛仙3战术推演智囊。\n\n我支持：\n1. 【双轨分流】：纯文本极速答疑，多模态识图独立通道\n2. 【识图测伤害】：直接粘贴或上传 C 界面属性截图，秒测 T20 副本实战爆发\n3. 【四象推演】：上传轩辕策截图，推算 20 阶极限与毕业百分比\n4. 【全库秒答】：开服雷达、首领抗性、技能机制、极致属性一键直达',
            time: '刚刚'
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // 微调抽屉状态
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeCPanel, setActiveCPanel] = useState<ExtractedCPanel | undefined>(undefined);

    // 用户自定义 API Keys
    const [customKeys, setCustomKeys] = useState<UserCustomApiKeys>(() => copilot.getUserKeys());
    const [keysSaved, setKeysSaved] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    // 监听全局 Ctrl+V 粘贴截图
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (!isOpen) return;
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
    }, [isOpen]);

    const handleSaveKeys = () => {
        copilot.saveUserKeys(customKeys);
        setKeysSaved(true);
        setTimeout(() => setKeysSaved(false), 2000);
    };

    const handleSend = async (overrideText?: string) => {
        const text = (overrideText !== undefined ? overrideText : inputValue).trim();
        if (!text && !selectedImage) return;

        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const userMsg: CopilotMessage = {
            id: `usr-${Date.now()}`,
            sender: 'user',
            text: text || (selectedImage ? '[发送了游戏截图]' : ''),
            image: selectedImage || undefined,
            time: timeStr
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        const currentImage = selectedImage;
        setSelectedImage(null);
        setIsLoading(true);

        try {
            // 路径 A: 包含图片 -> 专属视觉多模态通道 (L3)
            if (currentImage) {
                const diag = await copilot.diagnoseImage(currentImage, text);
                let assistantMsg: CopilotMessage;

                if (diag.mode === 'c_panel' && diag.cPanelData) {
                    const dmg = copilot.calculateT20Damage(diag.cPanelData);
                    assistantMsg = {
                        id: `ast-${Date.now()}`,
                        sender: 'assistant',
                        text: `${diag.rawExplanation}\n\n已通过本地无损战力引擎测算出该面板在【${dmg.dungeonName}】的实战战力（见下方诊断卡片）：`,
                        time: timeStr,
                        cardType: 'c_panel_diag',
                        cardData: {
                            cPanel: diag.cPanelData,
                            damage: dmg
                        }
                    };
                } else if (diag.mode === 'xyc' && diag.xycData) {
                    assistantMsg = {
                        id: `ast-${Date.now()}`,
                        sender: 'assistant',
                        text: `${diag.rawExplanation}\n\n识别到【${diag.xycData.beast}】轩辕策（当前 ${diag.xycData.level} 阶），点击卡片可直接进入四象模拟器：`,
                        time: timeStr,
                        cardType: 'xyc_diag',
                        cardData: {
                            title: `${diag.xycData.beast}轩辕策`,
                            route: `/tools/xyc?beast=${encodeURIComponent(diag.xycData.beast)}&lvl=${diag.xycData.level}`,
                            desc: '支持四象 1~20 阶成长推算与极品毕业度评级'
                        }
                    };
                } else {
                    assistantMsg = {
                        id: `ast-${Date.now()}`,
                        sender: 'assistant',
                        text: diag.rawExplanation || '已完成图像特征解析。',
                        time: timeStr
                    };
                }

                setMessages(prev => [...prev, assistantMsg]);
            }
            // 路径 B: 纯文本问答
            else {
                // 1. 先尝试 L1 本地秒答引擎（0ms、0 Token 消耗）
                const localMatch = copilot.matchLocalIntent(text);
                if (localMatch) {
                    setMessages(prev => [...prev, localMatch]);
                } else {
                    // 2. 本地未命中，走 L2 纯文本专属高 RPM 模型池
                    const history = messages.slice(-4).map(m => ({
                        role: m.sender === 'user' ? 'user' : 'assistant',
                        content: m.text
                    }));
                    const reply = await copilot.chatText(text, history);
                    setMessages(prev => [
                        ...prev,
                        {
                            id: `ast-${Date.now()}`,
                            sender: 'assistant',
                            text: reply,
                            time: timeStr
                        }
                    ]);
                }
            }
        } catch (error) {
            console.error('Copilot send error:', error);
            setMessages(prev => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    sender: 'assistant',
                    text: '处理咨询时发生网络异常，请稍后重试或检查自定义 Key 配置。',
                    time: timeStr
                }
            ]);
        } finally {
            setIsLoading(false);
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

    const handleQuickPrompt = (prompt: string, autoSend: boolean = false) => {
        if (autoSend) {
            handleSend(prompt);
        } else {
            setInputValue(prompt);
        }
    };

    return (
        <>
            {/* 右下角悬浮水晶球按钮 */}
            {!isOpen && (
                <div className="fixed bottom-6 right-6 z-40 group">
                    <button
                        onClick={() => setIsOpen(true)}
                        className="relative p-3.5 rounded-2xl bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 hover:from-cyan-500 hover:to-blue-500 text-white shadow-2xl shadow-cyan-900/60 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2.5 border border-cyan-400/40"
                    >
                        <div className="relative">
                            <Bot className="w-6 h-6 text-cyan-100" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <div className="text-xs font-bold tracking-wide">诛仙战术智囊</div>
                            <div className="text-[10px] text-cyan-200/80">双轨 AI 识图测伤</div>
                        </div>
                    </button>
                </div>
            )}

            {/* AI 助手全功能交互面板 */}
            {isOpen && (
                <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[95vw] sm:w-[460px] h-[640px] max-h-[85vh] bg-[#121620] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-md animate-in zoom-in-95 duration-200">
                    {/* 头部标题与通道标识 */}
                    <div className="px-4 py-3 bg-[#161c2b] border-b border-cyan-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                                <Sparkles className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-100 flex items-center gap-2">
                                    <span>诛仙3 战术推演智囊</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                                        双轨多模态
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-400">
                                    L1直答 / L2纯文本池 / L3视觉通道
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                title="设置模型 Key"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
                            >
                                <Settings className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* 自定义 API Keys 设置弹层 */}
                    {showSettings && (
                        <div className="px-4 py-3 bg-[#0d1017] border-b border-cyan-500/20 text-xs space-y-2 animate-in slide-in-from-top duration-200">
                            <div className="flex items-center justify-between text-cyan-300 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>自定义模型 Key（可选）</span>
                                </div>
                                <span className="text-[10px] text-gray-500">留空则自动使用内置免费池</span>
                            </div>
                            <div className="space-y-1.5">
                                <input
                                    type="password"
                                    placeholder="智谱 API Key (GLM-4 / GLM-4V)"
                                    value={customKeys.zhipuKey || ''}
                                    onChange={e => setCustomKeys({ ...customKeys, zhipuKey: e.target.value })}
                                    className="w-full px-2.5 py-1 rounded bg-black/40 border border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                                />
                                <input
                                    type="password"
                                    placeholder="硅基流动 API Key (Qwen2.5 / Qwen2-VL)"
                                    value={customKeys.siliconflowKey || ''}
                                    onChange={e => setCustomKeys({ ...customKeys, siliconflowKey: e.target.value })}
                                    className="w-full px-2.5 py-1 rounded bg-black/40 border border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                                />
                                <input
                                    type="password"
                                    placeholder="Google Gemini API Key (Gemini-1.5-Flash)"
                                    value={customKeys.geminiKey || ''}
                                    onChange={e => setCustomKeys({ ...customKeys, geminiKey: e.target.value })}
                                    className="w-full px-2.5 py-1 rounded bg-black/40 border border-gray-700 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-400"
                                />
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={handleSaveKeys}
                                    className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium flex items-center gap-1"
                                >
                                    {keysSaved ? <Check className="w-3 h-3 text-emerald-300" /> : null}
                                    <span>{keysSaved ? '已保存' : '保存配置'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 快捷提问胶囊条 */}
                    <div className="px-3 py-2 bg-[#141924] border-b border-white/5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => {
                                fileInputRef.current?.click();
                            }}
                            className="shrink-0 px-2.5 py-1 rounded-full bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-300 text-[11px] font-medium flex items-center gap-1 transition-all"
                        >
                            <ImageIcon className="w-3 h-3" />
                            <span>传图测T20伤害</span>
                        </button>
                        <button
                            onClick={() => handleQuickPrompt('今天哪个服开机了？', true)}
                            className="shrink-0 px-2.5 py-1 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] transition-all"
                        >
                            📡 开服雷达
                        </button>
                        <button
                            onClick={() => handleQuickPrompt('极致无视伤害减免最高多少？', true)}
                            className="shrink-0 px-2.5 py-1 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] transition-all"
                        >
                            🛡️ 极致无视
                        </button>
                        <button
                            onClick={() => handleQuickPrompt('逆戟鲸神', true)}
                            className="shrink-0 px-2.5 py-1 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] transition-all"
                        >
                            👾 T20首领抗性
                        </button>
                        <button
                            onClick={() => handleQuickPrompt('四象青龙书满级极限如何？', true)}
                            className="shrink-0 px-2.5 py-1 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 text-gray-300 text-[11px] transition-all"
                        >
                            📜 轩辕策四象
                        </button>
                    </div>

                    {/* 聊天消息滚动视图 */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-gradient-to-b from-[#121620] to-[#0d1017]">
                        {messages.map(msg => (
                            <div
                                key={msg.id}
                                className={clsx(
                                    'flex flex-col',
                                    msg.sender === 'user' ? 'items-end' : 'items-start'
                                )}
                            >
                                <div
                                    className={clsx(
                                        'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
                                        msg.sender === 'user'
                                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-sm'
                                            : 'bg-[#182030] text-gray-200 border border-cyan-500/20 rounded-bl-sm'
                                    )}
                                >
                                    {/* 用户上传的图片预览 */}
                                    {msg.image && (
                                        <div className="mb-2 rounded-lg overflow-hidden border border-white/20 max-w-[200px]">
                                            <img src={msg.image} alt="User upload" className="w-full object-cover" />
                                        </div>
                                    )}

                                    {/* 消息文本内容 */}
                                    <div className="whitespace-pre-wrap">{msg.text}</div>

                                    {/* 结构化富交互卡片 */}
                                    {msg.cardType && (
                                        <div className="mt-2.5 pt-2 border-t border-white/10">
                                            {/* 1. BOSS 首领卡片 */}
                                            {msg.cardType === 'boss' && (
                                                <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/30 space-y-1.5">
                                                    <div className="flex items-center justify-between text-cyan-300 font-bold">
                                                        <span>{msg.cardData.name}</span>
                                                        <span className="text-[10px] text-gray-400">{msg.cardData.dungeonName}</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1 text-[11px] text-gray-300">
                                                        <div>防御: <span className="text-cyan-200">{msg.cardData.def}</span></div>
                                                        <div>气血: <span className="text-rose-200">{msg.cardData.hp}</span></div>
                                                        <div>减暴击: <span className="text-amber-200">{msg.cardData.critRed}%</span></div>
                                                        <div>减暴伤: <span className="text-amber-200">{msg.cardData.critDmgRed}%</span></div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(msg.cardData.route);
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full mt-1 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-[10px] font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span>前往首领资料馆</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* 2. 技能卡片 */}
                                            {msg.cardType === 'skill' && (
                                                <div className="p-2.5 rounded-lg bg-black/40 border border-cyan-500/30 space-y-1.5">
                                                    <div className="text-cyan-300 font-bold">{msg.cardData.name}</div>
                                                    <div className="flex items-center gap-3 text-[11px] text-gray-300">
                                                        <span>段数: {msg.cardData.hits}</span>
                                                        <span>冷却: {msg.cardData.cooldown}s</span>
                                                        <span>施法: {msg.cardData.castTime}s</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(msg.cardData.route);
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full mt-1 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-[10px] font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span>查看技能全等级数值</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* 3. 极致攻略卡片 */}
                                            {msg.cardType === 'ceiling' && (
                                                <div className="p-2.5 rounded-lg bg-black/40 border border-amber-500/30 space-y-1.5">
                                                    <div className="flex items-center justify-between text-amber-300 font-bold">
                                                        <span>{msg.cardData.title}</span>
                                                        <span className="text-xs font-black text-amber-200">{msg.cardData.ceilingVal}%</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(msg.cardData.route);
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full mt-1 py-1 rounded bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-200 text-[10px] font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span>打开极致属性拆解</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* 4. 开服雷达卡片 */}
                                            {msg.cardType === 'server' && (
                                                <div className="p-2.5 rounded-lg bg-black/40 border border-emerald-500/30 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-emerald-300 font-bold">
                                                        <Radio className="w-3.5 h-3.5 animate-pulse" />
                                                        <span>{msg.cardData.title}</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-400">{msg.cardData.desc}</div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(msg.cardData.route);
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full mt-1 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-200 text-[10px] font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span>进入开服雷达看板</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* 5. C界面识图测伤卡片 */}
                                            {msg.cardType === 'c_panel_diag' && (
                                                <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-950/90 to-blue-950/80 border border-cyan-400/50 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-cyan-300">
                                                            {msg.cardData.cPanel?.characterClass || '角色'} 伤害推演
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                                            T20 爆发估算
                                                        </span>
                                                    </div>
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-xl font-black text-amber-300">
                                                            {msg.cardData.damage?.estimatedTotalDamage}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            ({msg.cardData.damage?.bossName})
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1 text-[10px] text-gray-300 bg-black/30 p-2 rounded">
                                                        <div>无视减免: <span className="text-cyan-300 font-bold">{msg.cardData.cPanel?.ignoreReduction}%</span></div>
                                                        <div>怪伤增加: <span className="text-rose-300 font-bold">{msg.cardData.cPanel?.monsterDamageBonus}%</span></div>
                                                        <div>暴击/暴伤: <span className="text-amber-300">{msg.cardData.cPanel?.critRate}% / {msg.cardData.cPanel?.critDamage}%</span></div>
                                                        <div>减免伤害: <span className="text-emerald-300">{msg.cardData.cPanel?.damageReduction}%</span></div>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setActiveCPanel(msg.cardData.cPanel);
                                                            setDrawerOpen(true);
                                                        }}
                                                        className="w-full py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-cyan-900/40 transition-colors"
                                                    >
                                                        <Sliders className="w-3.5 h-3.5" />
                                                        <span>打开微调抽屉（1键带入模拟室）</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* 6. 轩辕策四象卡片 */}
                                            {msg.cardType === 'xyc_diag' && (
                                                <div className="p-2.5 rounded-lg bg-black/40 border border-purple-500/30 space-y-1.5">
                                                    <div className="text-purple-300 font-bold">{msg.cardData.title}</div>
                                                    <div className="text-[11px] text-gray-400">{msg.cardData.desc}</div>
                                                    <button
                                                        onClick={() => {
                                                            navigate(msg.cardData.route);
                                                            setIsOpen(false);
                                                        }}
                                                        className="w-full mt-1 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-[10px] font-medium flex items-center justify-center gap-1"
                                                    >
                                                        <span>推算四象成长极限</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[9px] text-gray-500 mt-1 px-1">{msg.time}</span>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>推演运算中，正在提取数据并调用本地数学引擎...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* 图片预览浮层 */}
                    {selectedImage && (
                        <div className="px-4 py-2 bg-[#182030] border-t border-cyan-500/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={selectedImage} alt="Selected" className="w-10 h-10 object-cover rounded border border-cyan-500/40" />
                                <span className="text-xs text-cyan-300">已附加截图（将激活多模态视觉通道）</span>
                            </div>
                            <button
                                onClick={() => setSelectedImage(null)}
                                className="p-1 rounded text-gray-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {/* 输入底栏 */}
                    <div className="p-3 bg-[#161c28] border-t border-cyan-500/20 flex items-center gap-2">
                        {/* 传图按钮 */}
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
                            title="上传截图（或直接在窗口内 Ctrl+V 粘贴）"
                            className="p-2 rounded-xl bg-black/40 hover:bg-white/10 text-cyan-400 border border-cyan-500/30 transition-colors"
                        >
                            <ImageIcon className="w-4 h-4" />
                        </button>

                        {/* 文本输入框 */}
                        <input
                            type="text"
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSend();
                            }}
                            placeholder="问属性/首领/技能，或 Ctrl+V 贴图测伤害..."
                            className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-black/50 border border-gray-700 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-400"
                        />

                        {/* 发送按钮 */}
                        <button
                            type="button"
                            onClick={() => handleSend()}
                            disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                            className="p-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white disabled:opacity-40 transition-all"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* 属性微调抽屉 */}
            <QuickEditDrawer
                isOpen={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                initialData={activeCPanel}
            />
        </>
    );
};
